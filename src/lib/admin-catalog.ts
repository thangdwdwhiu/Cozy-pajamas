import { eq, sql } from 'drizzle-orm';
import { productSchema, categorySchema } from './catalog-validation';
import { db } from '@/db';
import * as s from '@/db/schema';
import { validImageUrl } from './media';
export function slugify(name: string) {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100) || 'cozy'
  );
}
const productInput = productSchema(validImageUrl);
export async function saveProduct(body: unknown, actor: string) {
  const input = productInput.parse(body);
  return db.transaction(async (tx) => {
    const [category] = await tx
      .select()
      .from(s.categories)
      .where(eq(s.categories.id, input.categoryId));
    if (!category) throw Error('Danh mục không còn tồn tại. Vui lòng chọn lại.');
    const { id, initialVariants, images, ...fields } = input;
    const values = { ...fields, images: [...new Set(images)], image: images[0] };
    let product;
    if (id) {
      const [updated] = await tx
        .update(s.products)
        .set(values)
        .where(eq(s.products.id, id))
        .returning();
      if (!updated) throw Error('Không tìm thấy sản phẩm');
      product = updated;
    } else {
      if (!initialVariants?.length) throw Error('Cần ít nhất một màu / kích thước và giá bán');
      const combos = initialVariants.map((v) => v.color.toLowerCase() + '|' + v.size);
      if (new Set(combos).size !== combos.length) throw Error('Màu và kích thước bị trùng');
      const base = slugify(input.name);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'product-slug:' + base}))`);
      let slug = base;
      let suffix = 2;
      while (
        (await tx.select({ id: s.products.id }).from(s.products).where(eq(s.products.slug, slug)))
          .length
      )
        slug = base + '-' + suffix++;
      [product] = await tx
        .insert(s.products)
        .values({ ...values, slug })
        .returning();
      for (const [i, v] of initialVariants.entries()) {
        const [variant] = await tx
          .insert(s.variants)
          .values({
            ...v,
            productId: product.id,
            sku: `CZ-${product.id.slice(0, 8).toUpperCase()}-${i + 1}`,
          })
          .returning();
        if (v.stock)
          await tx.insert(s.inventory).values({
            variantId: variant.id,
            delta: v.stock,
            reason: 'Tồn kho khởi tạo sản phẩm',
            actor,
          });
      }
    }
    await tx
      .insert(s.audit)
      .values({ actor, action: id ? 'product.update' : 'product.create', target: product.id });
    return product;
  });
}
export async function saveCategory(body: unknown, actor: string) {
  const input = categorySchema.parse(body);
  return db.transaction(async (tx) => {
    let category;
    if (input.id) {
      [category] = await tx
        .update(s.categories)
        .set({ name: input.name })
        .where(eq(s.categories.id, input.id))
        .returning();
      if (!category) throw Error('Không tìm thấy danh mục');
    } else {
      const base = slugify(input.name);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'category-slug:' + base}))`);
      let slug = base,
        suffix = 2;
      while (
        (
          await tx
            .select({ id: s.categories.id })
            .from(s.categories)
            .where(eq(s.categories.slug, slug))
        ).length
      )
        slug = base + '-' + suffix++;
      [category] = await tx.insert(s.categories).values({ name: input.name, slug }).returning();
    }
    await tx.insert(s.audit).values({
      actor,
      action: input.id ? 'category.update' : 'category.create',
      target: category.id,
    });
    return category;
  });
}
