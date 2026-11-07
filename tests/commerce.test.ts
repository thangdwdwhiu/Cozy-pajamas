import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { randomUUID, createHmac } from 'node:crypto';
let db: typeof import('../src/db').db,
  pool: typeof import('../src/db').pool,
  s: typeof import('../src/db/schema'),
  commerce: typeof import('../src/lib/commerce'),
  payments: typeof import('../src/lib/payments');
const customer = {
  name: 'Integration Test',
  email: 'integration@example.test',
  phone: '0901234567',
  address: '123 Test, phường Test, thành phố Test',
};
before(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = '/cozy_pajamas_test';
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const c = new Client({ connectionString: admin.toString() });
  await c.connect();
  if (
    !(await c.query('select 1 from pg_database where datname=$1', ['cozy_pajamas_test'])).rowCount
  )
    await c.query('CREATE DATABASE cozy_pajamas_test');
  await c.end();
  process.env.DATABASE_URL = url.toString();
  process.env.PAYMENT_LIVE_ENABLED = 'false';
  process.env.BANK_ACCOUNT_NUMBER = 'TEST_ACCOUNT_ONLY';
  ({ db, pool } = await import('../src/db'));
  s = await import('../src/db/schema');
  commerce = await import('../src/lib/commerce');
  payments = await import('../src/lib/payments');
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db
    .insert(s.categories)
    .values({ id: 'test', slug: 'test', name: 'Test' })
    .onConflictDoNothing();
});
after(async () => {
  await pool?.end();
});

test('catalog creates Vietnamese slugs automatically, handles collisions, and persists gallery order', async () => {
  const { saveProduct, saveCategory, slugify } = await import('../src/lib/admin-catalog');
  assert.equal(slugify('Đồ ngủ mùa hè'), 'do-ngu-mua-he');
  const name = 'Danh mục kiểm thử ' + randomUUID();
  const categories = await Promise.all([
    saveCategory({ name, slug: 'manual-slug-must-be-ignored' }, 'test'),
    saveCategory({ name }, 'test'),
  ]);
  assert.notEqual(categories[0].slug, categories[1].slug);
  assert.ok(categories.every((c) => c.slug.startsWith('danh-muc-kiem-thu-')));
  const productName = 'Pijama Đêm Hồng ' + randomUUID();
  const input = {
    name: productName,
    slug: 'manual',
    categoryId: categories[0].id,
    description: 'Sản phẩm kiểm thử nhiều ảnh',
    material: 'Cotton',
    images: ['/images/rose.svg', '/images/cloud.svg'],
    active: true,
    featured: false,
    initialVariants: [{ color: 'Hồng', size: 'M', price: 199000, stock: 2 }],
  };
  const created = await Promise.all([saveProduct(input, 'test'), saveProduct(input, 'test')]);
  assert.notEqual(created[0].slug, created[1].slug);
  assert.deepEqual(created[0].images, input.images);
  const updated = await saveProduct(
    { ...input, id: created[0].id, name: 'Tên đã đổi', images: [...input.images].reverse() },
    'test',
  );
  assert.equal(updated.slug, created[0].slug);
  assert.equal(updated.image, '/images/cloud.svg');
  assert.equal(updated.categoryId, categories[0].id);
  const renamed = await saveCategory({ id: categories[0].id, name: 'Danh mục đã đổi' }, 'test');
  assert.equal(renamed.slug, categories[0].slug);
  await assert.rejects(saveProduct({ ...input, images: [] }, 'test'));
  await assert.rejects(
    saveProduct({ ...input, images: ['https://untrusted.example/secret'] }, 'test'),
  );
  await assert.rejects(saveProduct({ ...input, categoryId: 'missing' }, 'test'));
});
async function fixture(stock = 5) {
  const id = randomUUID();
  await db.insert(s.products).values({
    id,
    slug: id,
    name: 'Test pajama',
    description: 'Test only',
    material: 'Cotton',
    categoryId: 'test',
    image: '/images/rose.svg',
  });
  await db
    .insert(s.variants)
    .values({ id, productId: id, sku: id, color: 'Pink', size: 'M', price: 100000, stock });
  return id;
}
function input(id: string) {
  return {
    items: [{ variantId: id, quantity: 1 }],
    customer,
    method: 'BANK' as const,
    idempotencyKey: randomUUID(),
  };
}
async function getOrder(id: string) {
  const { eq } = await import('drizzle-orm');
  return (await db.select().from(s.orders).where(eq(s.orders.id, id)))[0];
}
test('concurrent checkout never oversells the last unit', async () => {
  const id = await fixture(1);
  const results = await Promise.allSettled([
    commerce.checkout(input(id)),
    commerce.checkout(input(id)),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const { eq } = await import('drizzle-orm');
  const [v] = await db.select().from(s.variants).where(eq(s.variants.id, id));
  assert.equal(v.stock, 0);
});
test('duplicate checkout key creates only one order and reservation', async () => {
  const id = await fixture(3),
    body = input(id);
  const results = await Promise.allSettled([commerce.checkout(body), commerce.checkout(body)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const { eq } = await import('drizzle-orm');
  assert.equal((await db.select().from(s.variants).where(eq(s.variants.id, id)))[0].stock, 2);
});
test('cancel restores stock once; second cancellation rejected', async () => {
  const id = await fixture(1),
    o = await commerce.checkout(input(id));
  await commerce.transition(o.id, 'CANCELLED', 'test');
  await assert.rejects(commerce.transition(o.id, 'CANCELLED', 'test'));
  const { eq } = await import('drizzle-orm');
  assert.equal((await db.select().from(s.variants).where(eq(s.variants.id, id)))[0].stock, 1);
});
test('order lookup rejects missing token and other account', async () => {
  const o = await commerce.checkout(input(await fixture()));
  await assert.rejects(commerce.orderAccess(o.id));
  await assert.rejects(commerce.orderAccess(o.id, undefined, { id: 'other', role: 'CUSTOMER' }));
  assert.equal((await commerce.orderAccess(o.id, o.access)).id, o.id);
});
test('HMAC checks raw bytes, timestamp and signature', () => {
  const raw = '{"id":1}',
    time = String(Math.floor(Date.now() / 1000)),
    secret = 'test-secret';
  const signature =
    'sha256=' +
    createHmac('sha256', secret)
      .update(time + '.' + raw)
      .digest('hex');
  assert.ok(payments.verifySignature(raw, time, signature, secret));
  assert.equal(payments.verifySignature(raw + ' ', time, signature, secret), false);
  assert.equal(payments.verifySignature(raw, '1', signature, secret), false);
  assert.equal(payments.verifySignature(raw, time, signature, ''), false);
});
test('concurrent duplicate webhook confirms once', async () => {
  const o = await commerce.checkout(input(await fixture()));
  const p = {
    id: randomUUID(),
    gateway: 'VietinBank',
    accountNumber: 'TEST_ACCOUNT_ONLY',
    transferType: 'in',
    transferAmount: 130000,
    content: o.code,
  };
  const results = await Promise.all([
    payments.processPayment(p, true),
    payments.processPayment(p, true),
  ]);
  assert.equal(results.filter((r) => 'duplicate' in r).length, 1);
  assert.equal((await getOrder(o.id)).paymentStatus, 'PAID');
});
test('wrong amount/account/direction/mode never confirms payment', async () => {
  for (const change of [
    { transferAmount: 129999 },
    { transferAmount: 130001 },
    { accountNumber: 'wrong' },
    { transferType: 'out' },
    { gateway: 'OtherBank' },
  ]) {
    const o = await commerce.checkout(input(await fixture()));
    const p = {
      id: randomUUID(),
      gateway: 'VietinBank',
      accountNumber: 'TEST_ACCOUNT_ONLY',
      transferType: 'in',
      transferAmount: 130000,
      content: o.code,
      ...change,
    };
    await payments.processPayment(p, true);
    assert.equal((await getOrder(o.id)).paymentStatus, 'UNPAID');
  }
  const o = await commerce.checkout(input(await fixture()));
  await payments.processPayment(
    {
      id: randomUUID(),
      gateway: 'VietinBank',
      accountNumber: 'TEST_ACCOUNT_ONLY',
      transferType: 'in',
      transferAmount: 130000,
      content: o.code,
    },
    false,
  );
  assert.equal((await getOrder(o.id)).paymentStatus, 'UNPAID');
});
test('late payment retained for review, expired stock returned', async () => {
  const o = await commerce.checkout(input(await fixture(1)));
  const { eq } = await import('drizzle-orm');
  await db
    .update(s.orders)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(s.orders.id, o.id));
  const result = await payments.processPayment(
    {
      id: randomUUID(),
      gateway: 'VietinBank',
      accountNumber: 'TEST_ACCOUNT_ONLY',
      transferType: 'in',
      transferAmount: 130000,
      content: o.code,
    },
    true,
  );
  assert.equal('outcome' in result && result.outcome, 'LATE_PAYMENT');
  await commerce.expireOrders();
  assert.equal((await getOrder(o.id)).status, 'EXPIRED');
});
test('voucher quota is atomic across simultaneous checkouts', async () => {
  const code = 'TEST' + randomUUID();
  await db
    .insert(s.vouchers)
    .values({ code, percent: 10, limit: 1, expiresAt: new Date(Date.now() + 60000) });
  const a = input(await fixture()),
    b = input(await fixture());
  const results = await Promise.allSettled([
    commerce.checkout({ ...a, voucher: code.toUpperCase() }),
    commerce.checkout({ ...b, voucher: code.toUpperCase() }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 0);
  const { eq } = await import('drizzle-orm');
  await db.update(s.vouchers).set({ code: code.toUpperCase() }).where(eq(s.vouchers.code, code));
  const retry = await Promise.allSettled([
    commerce.checkout({ ...a, voucher: code.toUpperCase() }),
    commerce.checkout({ ...b, voucher: code.toUpperCase() }),
  ]);
  assert.equal(retry.filter((r) => r.status === 'fulfilled').length, 1);
});
test('unpaid transfer cannot advance to fulfillment', async () => {
  const o = await commerce.checkout(input(await fixture()));
  await assert.rejects(commerce.transition(o.id, 'CONFIRMED', 'admin', true));
  await assert.rejects(commerce.transition(o.id, 'COMPLETED', 'admin', true));
});
