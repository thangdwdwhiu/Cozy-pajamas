import { and, eq, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/db';
import * as s from '@/db/schema';
import { hash } from './security';
import { assertLivePaymentConfig } from './payment-config';
export const checkoutSchema = z.object({
  items: z
    .array(z.object({ variantId: z.string(), quantity: z.number().int().min(1).max(20) }))
    .min(1)
    .max(30),
  customer: z.object({
    name: z.string().min(2).max(100),
    email: z.email(),
    phone: z.string().regex(/^(0|\+84)[0-9]{9,10}$/),
    address: z.string().min(10).max(500),
  }),
  method: z.enum(['COD', 'BANK']),
  voucher: z.string().max(40).optional(),
  idempotencyKey: z.string().uuid(),
});
export async function checkout(input: z.infer<typeof checkoutSchema>, userId?: string) {
  if (input.method === 'BANK') assertLivePaymentConfig();
  const access = randomBytes(32).toString('hex');
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))`);
    const [prior] = await tx
      .select()
      .from(s.orders)
      .where(eq(s.orders.idempotencyKey, input.idempotencyKey));
    if (prior) throw Error('Yêu cầu này đã được xử lý. Kiểm tra lịch sử đơn hàng.');
    const quantities = new Map<string, number>();
    for (const item of input.items)
      quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
    const lines = [];
    let subtotal = 0;
    for (const [variantId, quantity] of [...quantities].sort(([a], [b]) => a.localeCompare(b))) {
      const [v] = await tx
        .select()
        .from(s.variants)
        .where(eq(s.variants.id, variantId))
        .for('update');
      if (!v || v.stock < quantity)
        throw Error('Sản phẩm không đủ tồn kho. Vui lòng cập nhật giỏ hàng.');
      const [p] = await tx.select().from(s.products).where(eq(s.products.id, v.productId));
      if (!p?.active) throw Error('Sản phẩm ngừng bán');
      subtotal += v.price * quantity;
      lines.push({
        variantId: v.id,
        name: p.name,
        sku: v.sku,
        image: p.image,
        color: v.color,
        size: v.size,
        price: v.price,
        quantity,
      });
    }
    let discount = 0,
      voucherId: string | undefined;
    if (input.voucher) {
      const [v] = await tx
        .select()
        .from(s.vouchers)
        .where(eq(s.vouchers.code, input.voucher.toUpperCase()))
        .for('update');
      if (!v || !v.active || v.expiresAt < new Date() || v.used >= v.limit || subtotal < v.minimum)
        throw Error('Voucher không hợp lệ, hết hạn hoặc chưa đạt giá trị tối thiểu');
      discount = Math.floor((subtotal * v.percent) / 100);
      voucherId = v.id;
      await tx
        .update(s.vouchers)
        .set({ used: v.used + 1 })
        .where(eq(s.vouchers.id, v.id));
    }
    const shipping = subtotal >= 599000 ? 0 : 30000;
    const code = 'SEVQR' + randomBytes(6).toString('hex').toUpperCase();
    const [order] = await tx
      .insert(s.orders)
      .values({
        code,
        accessHash: hash(access),
        idempotencyKey: input.idempotencyKey,
        userId,
        customer: input.customer,
        subtotal,
        shipping,
        discount,
        total: subtotal + shipping - discount,
        voucherId,
        method: input.method,
        test: input.method === 'BANK' && process.env.PAYMENT_LIVE_ENABLED !== 'true',
        expiresAt: new Date(Date.now() + 30 * 60000),
      })
      .returning();
    await tx.insert(s.orderItems).values(lines.map((line) => ({ ...line, orderId: order.id })));
    for (const line of lines) {
      await tx
        .update(s.variants)
        .set({ stock: sql`${s.variants.stock}-${line.quantity}` })
        .where(eq(s.variants.id, line.variantId));
      await tx.insert(s.inventory).values({
        variantId: line.variantId,
        delta: -line.quantity,
        reason: `Đặt đơn ${code}`,
        actor: userId,
      });
    }
    return { id: order.id, code, access };
  });
}
export async function orderAccess(
  id: string,
  token?: string,
  user?: { id: string; role: string } | null,
) {
  const [order] = await db.select().from(s.orders).where(eq(s.orders.id, id));
  if (
    !order ||
    (!(user && (order.userId === user.id || ['ADMIN', 'STAFF'].includes(user.role))) &&
      (!token || hash(token) !== order.accessHash))
  )
    throw Error('Không tìm thấy đơn hàng hoặc không có quyền truy cập');
  return order;
}
export async function transition(id: string, status: string, actor: string, admin = false) {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(s.orders).where(eq(s.orders.id, id)).for('update');
    if (!o) throw Error('Không tìm thấy đơn hàng');
    const allowed: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
      CONFIRMED: ['SHIPPING', 'CANCELLED'],
      SHIPPING: ['COMPLETED'],
      COMPLETED: [],
    };
    if (
      !allowed[o.status]?.includes(status) ||
      (!admin && (status !== 'CANCELLED' || o.status !== 'PENDING'))
    )
      throw Error('Không thể chuyển trạng thái đơn hàng');
    if (status === 'CONFIRMED' && o.method === 'BANK' && o.paymentStatus !== 'PAID')
      throw Error('Đơn chuyển khoản chưa được thanh toán');
    if (status === 'CANCELLED' || status === 'EXPIRED') {
      const items = await tx.select().from(s.orderItems).where(eq(s.orderItems.orderId, id));
      for (const i of items.sort((a, b) => a.variantId.localeCompare(b.variantId))) {
        await tx
          .update(s.variants)
          .set({ stock: sql`${s.variants.stock}+${i.quantity}` })
          .where(eq(s.variants.id, i.variantId));
        await tx.insert(s.inventory).values({
          variantId: i.variantId,
          delta: i.quantity,
          reason: `Hoàn kho ${o.code}`,
          actor,
        });
      }
      if (o.voucherId)
        await tx
          .update(s.vouchers)
          .set({ used: sql`greatest(0,${s.vouchers.used}-1)` })
          .where(eq(s.vouchers.id, o.voucherId));
    }
    await tx
      .update(s.orders)
      .set({
        status,
        ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
        paymentStatus:
          (status === 'CANCELLED' || status === 'EXPIRED') && o.paymentStatus === 'PAID'
            ? 'REFUND_PENDING'
            : o.paymentStatus,
      })
      .where(eq(s.orders.id, id));
    await tx.insert(s.audit).values({ actor, action: status, target: id });
  });
}
export async function expireOrders() {
  const rows = await db
    .select({ id: s.orders.id })
    .from(s.orders)
    .where(
      and(
        eq(s.orders.status, 'PENDING'),
        eq(s.orders.method, 'BANK'),
        eq(s.orders.paymentStatus, 'UNPAID'),
        sql`${s.orders.expiresAt}<now()`,
      ),
    );
  for (const o of rows) {
    try {
      await transition(o.id, 'EXPIRED', 'system', true);
    } catch {
      /* A concurrent webhook may already have confirmed this order. */
    }
  }
  return rows.length;
}
