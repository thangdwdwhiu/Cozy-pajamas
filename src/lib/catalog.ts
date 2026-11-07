import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
export const getCatalog = cache(async () => {
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
  return {
    products: products.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      variants: variants.filter((v) => v.productId === p.id),
      reviews: reviews.filter((r) => r.productId === p.id),
    })),
    categories: await db.select().from(s.categories),
    content: await db.select().from(s.content),
  };
});
