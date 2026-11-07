import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as s from '@/db/schema';
export function verifySignature(
  raw: string,
  timestamp: string,
  signature: string,
  secret: string,
  now = Date.now(),
) {
  if (!secret || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300)
    return false;
  const expected = Buffer.from(
    'sha256=' +
      createHmac('sha256', secret)
        .update(timestamp + '.' + raw)
        .digest('hex'),
  );
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const paymentSchema = z.object({
  id: z.union([z.number().int(), z.string().min(1)]),
  gateway: z.string(),
  accountNumber: z.string(),
  transferType: z.string(),
  transferAmount: z.number().int().nonnegative().max(2000000000),
  content: z.string(),
  referenceCode: z.string().optional(),
});
export async function processPayment(payload: z.infer<typeof paymentSchema>, test = false) {
  return db.transaction(async (tx) => {
    const providerId = (test ? 'test:' : 'sepay:') + payload.id;
    const [inserted] = await tx
      .insert(s.transactions)
      .values({ providerId, amount: payload.transferAmount, outcome: 'REVIEW', payload })
      .onConflictDoNothing()
      .returning();
    if (!inserted) return { duplicate: true };
    const code = payload.content.toUpperCase().match(/\bSEVQR[A-F0-9]{12}\b/)?.[0];
    let outcome = 'UNMATCHED';
    let orderId: string | undefined;
    if (payload.transferType !== 'in') outcome = 'OUTGOING';
    else if (
      payload.accountNumber !== process.env.BANK_ACCOUNT_NUMBER ||
      payload.gateway.toLowerCase() !== 'vietinbank'
    )
      outcome = 'WRONG_ACCOUNT';
    else if (code) {
      const [o] = await tx.select().from(s.orders).where(eq(s.orders.code, code)).for('update');
      if (o) {
        orderId = o.id;
        if (o.test !== test) outcome = 'MODE_MISMATCH';
        else if (o.paymentStatus === 'PAID') outcome = 'EXTRA_PAYMENT';
        else if (o.status !== 'PENDING' || o.expiresAt < new Date()) outcome = 'LATE_PAYMENT';
        else if (payload.transferAmount !== o.total)
          outcome = payload.transferAmount < o.total ? 'UNDERPAID' : 'OVERPAID';
        else {
          outcome = 'MATCHED';
          await tx
            .update(s.orders)
            .set({ paymentStatus: 'PAID', status: 'CONFIRMED' })
            .where(eq(s.orders.id, o.id));
          await tx.insert(s.audit).values({
            actor: test ? 'test-webhook' : 'sepay',
            action: 'PAYMENT_CONFIRMED',
            target: o.id,
          });
        }
      }
    }
    await tx
      .update(s.transactions)
      .set({ outcome, orderId })
      .where(eq(s.transactions.id, inserted.id));
    return { outcome };
  });
}
