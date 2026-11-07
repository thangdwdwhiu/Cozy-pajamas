import 'dotenv/config';
import { db, pool } from '../src/db';
import { orders } from '../src/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { transition } from '../src/lib/commerce';
async function main() {
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, 'PENDING'),
        sql`${orders.customer}->>'email' = 'browser@example.test'`,
        sql`${orders.customer}->>'name' = 'Browser Test'`,
      ),
    );
  for (const o of rows) await transition(o.id, 'CANCELLED', 'browser-test-cleanup', true);
  console.log('Cancelled unfinished browser-test orders:', rows.length);
  await pool.end();
}
main().catch(() => {
  console.error('Cleanup failed');
  process.exit(1);
});
