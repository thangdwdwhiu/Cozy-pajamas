import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const created = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  password: text('password').notNull(),
  role: text('role').notNull().default('CUSTOMER'),
  createdAt: created(),
});
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
export const categories = pgTable('categories', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
});
export const products = pgTable('products', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  material: text('material').notNull(),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id),
  image: text('image').notNull(),
  images: jsonb('images').$type<string[]>().default([]).notNull(),
  featured: boolean('featured').default(false).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: created(),
});
export const variants = pgTable(
  'variants',
  {
    id: id(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    sku: text('sku').notNull().unique(),
    color: text('color').notNull(),
    size: text('size').notNull(),
    price: integer('price').notNull(),
    stock: integer('stock').notNull().default(0),
  },
  (t) => [
    check('stock_nonnegative', sql`${t.stock} >= 0`),
    check('price_positive', sql`${t.price} > 0`),
    index('variant_product_idx').on(t.productId),
  ],
);
export const vouchers = pgTable(
  'vouchers',
  {
    id: id(),
    code: text('code').notNull().unique(),
    percent: integer('percent').notNull(),
    minimum: integer('minimum').default(0).notNull(),
    limit: integer('usage_limit').default(100).notNull(),
    used: integer('used').default(0).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    active: boolean('active').default(true).notNull(),
  },
  (t) => [check('valid_percent', sql`${t.percent} between 1 and 100`)],
);
export const orders = pgTable(
  'orders',
  {
    id: id(),
    code: text('code').notNull().unique(),
    accessHash: text('access_hash').notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    userId: text('user_id').references(() => users.id),
    customer: jsonb('customer')
      .$type<{ name: string; email: string; phone: string; address: string }>()
      .notNull(),
    subtotal: integer('subtotal').notNull(),
    shipping: integer('shipping').notNull(),
    discount: integer('discount').default(0).notNull(),
    total: integer('total').notNull(),
    voucherId: text('voucher_id').references(() => vouchers.id),
    status: text('status').default('PENDING').notNull(),
    paymentStatus: text('payment_status').default('UNPAID').notNull(),
    method: text('method').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    test: boolean('test').default(false).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: created(),
  },
  (t) => [
    index('order_user_idx').on(t.userId),
    index('order_expiry_idx').on(t.status, t.expiresAt),
  ],
);
export const orderItems = pgTable('order_items', {
  id: id(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id),
  variantId: text('variant_id')
    .notNull()
    .references(() => variants.id),
  name: text('name').notNull(),
  sku: text('sku').notNull(),
  image: text('image').notNull(),
  color: text('color').notNull(),
  size: text('size').notNull(),
  price: integer('price').notNull(),
  quantity: integer('quantity').notNull(),
});
export const transactions = pgTable('transactions', {
  id: id(),
  providerId: text('provider_id').notNull().unique(),
  orderId: text('order_id').references(() => orders.id),
  amount: integer('amount').notNull(),
  outcome: text('outcome').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: created(),
});
export const inventory = pgTable('inventory_movements', {
  id: id(),
  variantId: text('variant_id')
    .notNull()
    .references(() => variants.id),
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(),
  actor: text('actor'),
  createdAt: created(),
});
export const addresses = pgTable('addresses', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
});
export const reviews = pgTable(
  'reviews',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    approved: boolean('approved').default(false).notNull(),
    createdAt: created(),
  },
  (t) => [check('valid_rating', sql`${t.rating} between 1 and 5`)],
);
export const returns = pgTable('returns', {
  id: id(),
  orderId: text('order_id')
    .notNull()
    .unique()
    .references(() => orders.id),
  reason: text('reason').notNull(),
  status: text('status').default('REQUESTED').notNull(),
  createdAt: created(),
});
export const content = pgTable('content', {
  id: text('id').primaryKey(),
  value: text('value').notNull(),
});
export const audit = pgTable('audit', {
  id: id(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  target: text('target').notNull(),
  createdAt: created(),
});
export const rateLimits = pgTable('rate_limits', {
  id: text('id').primaryKey(),
  count: integer('count').notNull(),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
});
