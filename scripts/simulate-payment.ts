import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, pool } from '../src/db';
import { orders } from '../src/db/schema';
import { processPayment } from '../src/lib/payments';
async function main() {
  if (process.env.PAYMENT_LIVE_ENABLED === 'true') throw Error('Simulator disabled in live mode');
  const id = process.argv[2];
  if (!id) throw Error('Usage: npm run payment:simulate -- ORDER_ID');
  const [o] = await db.select().from(orders).where(eq(orders.id, id));
  if (!o?.test || o.method !== 'BANK') throw Error('Only a test bank order can be simulated');
  const result = await processPayment(
    {
      id: randomUUID(),
      gateway: 'VietinBank',
      accountNumber: process.env.BANK_ACCOUNT_NUMBER ?? '',
      transferType: 'in',
      transferAmount: o.total,
      content: o.code,
    },
    true,
  );
  console.log('Test payment result:', result);
  await pool.end();
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Simulation failed');
  process.exit(1);
});
