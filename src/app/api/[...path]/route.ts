import { saveProduct, saveCategory } from '@/lib/admin-catalog';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as s from '@/db/schema';
import {
  checkOrigin,
  createSession,
  currentUser,
  hash,
  passwordHash,
  passwordValid,
  rateLimit,
  requireUser,
} from '@/lib/security';
import { checkout, checkoutSchema, expireOrders, orderAccess, transition } from '@/lib/commerce';
import { paymentSchema, processPayment, verifySignature } from '@/lib/payments';
import { assertLivePaymentConfig } from '@/lib/payment-config';
import {publicApiError} from '@/lib/api-errors';
export const runtime = 'nodejs';
const safeUser = {
  id: s.users.id,
  name: s.users.name,
  email: s.users.email,
  role: s.users.role,
  createdAt: s.users.createdAt,
};
async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await params).path.join('/');
    const get = req.method === 'GET';
    if (path === 'webhooks/sepay') {
      if (get) return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
      if (process.env.PAYMENT_LIVE_ENABLED !== 'true')
        return NextResponse.json({ error: 'Live payment disabled' }, { status: 503 });
      assertLivePaymentConfig();
      const raw = await req.text();
      if (raw.length > 32000) throw Error('Payload too large');
      if (
        !verifySignature(
          raw,
          req.headers.get('x-sepay-timestamp') ?? '',
          req.headers.get('x-sepay-signature') ?? '',
          process.env.SEPAY_WEBHOOK_SECRET ?? '',
        )
      )
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      await processPayment(paymentSchema.parse(JSON.parse(raw)));
      return NextResponse.json({ success: true });
    }
    if (path === 'cron/expire') {
      if (
        !process.env.CRON_SECRET ||
        req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
      )
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return NextResponse.json({ expired: await expireOrders() });
    }
    if (!get) await checkOrigin();
    const user = await currentUser();
    if (get) {
      if (path === 'catalog') {
        const products = await db.select().from(s.products).where(eq(s.products.active, true));
        const variants = await db.select().from(s.variants);
        const reviews = await db
          .select({
            productId: s.reviews.productId,
            rating: s.reviews.rating,
            comment: s.reviews.comment,
          })
          .from(s.reviews)
          .where(eq(s.reviews.approved, true));
        return NextResponse.json({
          products: products.map((p) => ({
            ...p,
            variants: variants.filter((v) => v.productId === p.id),
            reviews: reviews.filter((r) => r.productId === p.id),
          })),
          categories: await db.select().from(s.categories),
          content: await db.select().from(s.content),
          user,
          live: process.env.PAYMENT_LIVE_ENABLED === 'true',
        });
      }
      if (path === 'account') {
        const u = await requireUser();
        return NextResponse.json({
          user: u,
          orders: await db
            .select({
              id: s.orders.id,
              code: s.orders.code,
              total: s.orders.total,
              status: s.orders.status,
              paymentStatus: s.orders.paymentStatus,
              createdAt: s.orders.createdAt,
            })
            .from(s.orders)
            .where(eq(s.orders.userId, u.id))
            .orderBy(desc(s.orders.createdAt))
            .limit(100),
          addresses: await db.select().from(s.addresses).where(eq(s.addresses.userId, u.id)),
        });
      }
      if (path.startsWith('orders/')) {
        const id = path.split('/')[1];
        const order = await orderAccess(id, req.headers.get('x-order-token') ?? undefined, user);
        const { accessHash, idempotencyKey, ...safe } = order;
        void accessHash;
        void idempotencyKey;
        const live =
          !order.test && order.method === 'BANK' && process.env.PAYMENT_LIVE_ENABLED === 'true';
        const qr =
          live && order.paymentStatus === 'UNPAID' && order.status === 'PENDING'
            ? `https://qr.sepay.vn/img?${new URLSearchParams({ acc: process.env.BANK_ACCOUNT_NUMBER!, bank: 'VietinBank', amount: String(order.total), des: order.code })}`
            : null;
        return NextResponse.json({
          order: safe,
          items: await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, id)),
          qr,
          bankName: live ? process.env.BANK_ACCOUNT_NAME : null,
          bankAccount: live ? process.env.BANK_ACCOUNT_NUMBER : null,
          returns: await db.select().from(s.returns).where(eq(s.returns.orderId, id)),
        });
      }
      if (path === 'admin') {
        await requireUser(true);
        return NextResponse.json({
          products: await db.select().from(s.products),
          variants: await db.select().from(s.variants),
          categories: await db.select().from(s.categories),
          orders: await db
            .select({
              id: s.orders.id,
              code: s.orders.code,
              customer: s.orders.customer,
              total: s.orders.total,
              status: s.orders.status,
              paymentStatus: s.orders.paymentStatus,
              method: s.orders.method,
              test: s.orders.test,
              createdAt: s.orders.createdAt,
            })
            .from(s.orders)
            .orderBy(desc(s.orders.createdAt))
            .limit(500),
          users: await db.select(safeUser).from(s.users).limit(500),
          vouchers: await db.select().from(s.vouchers),
          transactions: await db
            .select({
              id: s.transactions.id,
              providerId: s.transactions.providerId,
              orderId: s.transactions.orderId,
              amount: s.transactions.amount,
              outcome: s.transactions.outcome,
              createdAt: s.transactions.createdAt,
            })
            .from(s.transactions)
            .orderBy(desc(s.transactions.createdAt))
            .limit(200),
          reviews: await db.select().from(s.reviews).limit(200),
          returns: await db.select().from(s.returns).limit(200),
          content: await db.select().from(s.content),
          inventory: await db
            .select()
            .from(s.inventory)
            .orderBy(desc(s.inventory.createdAt))
            .limit(100),
          audit: await db.select().from(s.audit).orderBy(desc(s.audit.createdAt)).limit(100),
        });
      }
    } else {
      const raw = await req.text();
      if (raw.length > 64000) throw Error('Dữ liệu quá lớn');
      const body = raw ? JSON.parse(raw) : {};
      if (path === 'auth/register' || path === 'auth/login') {
        const input = z
          .object({
            email: z.email().max(200),
            password: z.string().min(10).max(128),
            name: z.string().min(2).max(100).optional(),
          })
          .parse(body);
        input.email = input.email.toLowerCase();
        await rateLimit('auth:global', 300);
        await rateLimit('auth:' + input.email);
        if (path.endsWith('register')) {
          if (!input.name) throw Error('Vui lòng nhập tên');
          const [u] = await db
            .insert(s.users)
            .values({
              email: input.email,
              name: input.name,
              password: passwordHash(input.password),
            })
            .onConflictDoNothing()
            .returning();
          if (!u) throw Error('Không thể đăng ký email này');
          await createSession(u.id);
        } else {
          const [u] = await db.select().from(s.users).where(eq(s.users.email, input.email));
          if (!u || !passwordValid(input.password, u.password))
            throw Error('Email hoặc mật khẩu không đúng');
          await createSession(u.id);
        }
        return NextResponse.json({ success: true });
      }
      if (path === 'auth/logout') {
        const token = (await cookies()).get('cozy_session')?.value;
        if (token) await db.delete(s.sessions).where(eq(s.sessions.id, hash(token)));
        (await cookies()).delete('cozy_session');
        return NextResponse.json({ success: true });
      }
      if (path === 'checkout') {
        const input = checkoutSchema.parse(body);
        await rateLimit('checkout:' + input.customer.email, 20);
        return NextResponse.json(await checkout(input, user?.id));
      }
      if (path === 'orders/action') {
        const input = z
          .object({
            id: z.string(),
            token: z.string().optional(),
            action: z.enum(['cancel', 'return']),
            reason: z.string().min(10).max(1000).optional(),
          })
          .parse(body);
        const o = await orderAccess(input.id, input.token, user);
        if (input.action === 'cancel') await transition(o.id, 'CANCELLED', user?.id ?? 'guest');
        else {
          if (
            o.status !== 'COMPLETED' ||
            !o.completedAt ||
            Date.now() - o.completedAt.getTime() > 7 * 86400000 ||
            !input.reason
          )
            throw Error('Chỉ yêu cầu đổi trả khi đã nhận hàng và có lý do');
          await db
            .insert(s.returns)
            .values({ orderId: o.id, reason: input.reason })
            .onConflictDoNothing();
        }
        return NextResponse.json({ success: true });
      }
      if (path === 'addresses') {
        const u = await requireUser();
        const input = z
          .object({
            name: z.string().min(2).max(100),
            phone: z.string().min(10).max(15),
            address: z.string().min(10).max(500),
          })
          .parse(body);
        await db.insert(s.addresses).values({ ...input, userId: u.id });
        return NextResponse.json({ success: true });
      }
      if (path === 'reviews') {
        const u = await requireUser();
        const input = z
          .object({
            productId: z.string(),
            rating: z.number().int().min(1).max(5),
            comment: z.string().min(5).max(2000),
          })
          .parse(body);
        const purchased = await db
          .select()
          .from(s.orders)
          .innerJoin(s.orderItems, eq(s.orders.id, s.orderItems.orderId))
          .innerJoin(s.variants, eq(s.orderItems.variantId, s.variants.id))
          .where(
            and(
              eq(s.orders.userId, u.id),
              eq(s.orders.status, 'COMPLETED'),
              eq(s.variants.productId, input.productId),
            ),
          )
          .limit(1);
        if (!purchased.length) throw Error('Bạn cần mua và nhận sản phẩm trước khi đánh giá');
        await db.insert(s.reviews).values({ ...input, userId: u.id });
        return NextResponse.json({ success: true });
      }
      if (path.startsWith('admin/')) {
        const u = await requireUser(true);
        const action = path.slice(6);
        if (action === 'order') {
          const b = z
            .object({
              id: z.string(),
              status: z.enum(['CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED']),
            })
            .parse(body);
          await transition(b.id, b.status, u.id, true);
        } else if (action === 'stock') {
          const b = z
            .object({
              id: z.string(),
              delta: z.number().int().min(-10000).max(10000),
              reason: z.string().min(3).max(200),
            })
            .parse(body);
          await db.transaction(async (tx) => {
            const [v] = await tx
              .select()
              .from(s.variants)
              .where(eq(s.variants.id, b.id))
              .for('update');
            if (!v || v.stock + b.delta < 0) throw Error('Tồn kho không hợp lệ');
            await tx
              .update(s.variants)
              .set({ stock: v.stock + b.delta })
              .where(eq(s.variants.id, b.id));
            await tx
              .insert(s.inventory)
              .values({ variantId: b.id, delta: b.delta, reason: b.reason, actor: u.id });
          });
        } else if (action === 'product') {
          return NextResponse.json({ success: true, product: await saveProduct(body, u.id) });
        } else if (action === 'variant') {
          const b = z
            .object({
              id: z.string().optional(),
              productId: z.string(),
              sku: z.string().min(2),
              color: z.string().min(2),
              size: z.string().min(1),
              price: z.number().int().min(1000).max(100000000),
            })
            .parse(body);
          if (b.id) await db.update(s.variants).set(b).where(eq(s.variants.id, b.id));
          else await db.insert(s.variants).values({ ...b, stock: 0 });
        } else if (action === 'category') {
          return NextResponse.json({ success: true, category: await saveCategory(body, u.id) });
        } else if (action === 'voucher') {
          const b = z
            .object({
              code: z.string().min(3).max(30),
              percent: z.number().int().min(1).max(100),
              minimum: z.number().int().nonnegative(),
              limit: z.number().int().positive(),
              expiresAt: z.string(),
              active: z.boolean(),
            })
            .parse(body);
          await db
            .insert(s.vouchers)
            .values({ ...b, code: b.code.toUpperCase(), expiresAt: new Date(b.expiresAt) })
            .onConflictDoUpdate({
              target: s.vouchers.code,
              set: { ...b, expiresAt: new Date(b.expiresAt) },
            });
        } else if (action === 'content') {
          const b = z
            .object({
              id: z.enum(['hero', 'announcement', 'about']),
              value: z.string().min(2).max(2000),
            })
            .parse(body);
          await db
            .insert(s.content)
            .values(b)
            .onConflictDoUpdate({ target: s.content.id, set: { value: b.value } });
        } else if (action === 'review') {
          const b = z.object({ id: z.string(), approved: z.boolean() }).parse(body);
          await db.update(s.reviews).set({ approved: b.approved }).where(eq(s.reviews.id, b.id));
        } else if (action === 'role') {
          if (u.role !== 'ADMIN') throw Error('Chỉ chủ cửa hàng được đổi quyền');
          const b = z
            .object({ id: z.string(), role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']) })
            .parse(body);
          if (b.id === u.id) throw Error('Không tự thay đổi vai trò');
          await db.update(s.users).set({ role: b.role }).where(eq(s.users.id, b.id));
          await db.delete(s.sessions).where(eq(s.sessions.userId, b.id));
        } else if (action === 'return') {
          const b = z
            .object({ id: z.string(), status: z.enum(['APPROVED', 'REJECTED', 'RECEIVED']) })
            .parse(body);
          await db.update(s.returns).set({ status: b.status }).where(eq(s.returns.id, b.id));
        } else if (action === 'cod-paid') {
          const b = z.object({ id: z.string() }).parse(body);
          const [o] = await db.select().from(s.orders).where(eq(s.orders.id, b.id));
          if (o?.method !== 'COD' || o.status !== 'COMPLETED')
            throw Error('Chỉ ghi nhận COD đã giao');
          await db.update(s.orders).set({ paymentStatus: 'PAID' }).where(eq(s.orders.id, b.id));
        } else if (action === 'expire') await expireOrders();
        else throw Error('Thao tác không hỗ trợ');
        await db
          .insert(s.audit)
          .values({ actor: u.id, action, target: String(body.id ?? body.code ?? 'store') });
        return NextResponse.json({ success: true });
      }
    }
    return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });
  } catch (error) {
    const result=publicApiError(error);
    return NextResponse.json(result.body,{status:result.status});
  }
}
export const GET = handle;
export const POST = handle;
