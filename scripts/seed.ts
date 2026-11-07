import 'dotenv/config';
import { scryptSync, randomBytes } from 'node:crypto';
import { db, pool } from '../src/db';
import * as s from '../src/db/schema';
async function main() {
  const cats = [
    ['pajama', 'Bộ pijama'],
    ['vay-ngu', 'Váy ngủ'],
    ['mac-nha', 'Đồ mặc nhà'],
  ];
  for (const [slug, name] of cats)
    await db.insert(s.categories).values({ id: slug, slug, name }).onConflictDoNothing();
  const data = [
    ['rose', 'Pijama lụa Rose', 'pajama', 'Lụa satin', 389000, 'Hồng phấn'],
    ['cloud', 'Pijama cotton Cloud', 'pajama', 'Cotton 100%', 329000, 'Trắng kem'],
    ['sage', 'Bộ mặc nhà Sage', 'mac-nha', 'Modal mềm', 359000, 'Xanh sage'],
    ['pearl', 'Váy ngủ Pearl', 'vay-ngu', 'Lụa satin', 289000, 'Trắng ngọc'],
    ['bloom', 'Pijama Bloom', 'pajama', 'Cotton 100%', 369000, 'Hồng hoa'],
    ['moon', 'Pijama Midnight', 'pajama', 'Lụa satin', 419000, 'Xanh navy'],
    ['sunday', 'Bộ mặc nhà Sunday', 'mac-nha', 'Cotton muslin', 299000, 'Be sữa'],
    ['petal', 'Váy ngủ Petal', 'vay-ngu', 'Modal mềm', 319000, 'Hồng đất'],
  ] as const;
  for (const [slug, name, categoryId, material, price, color] of data) {
    await db
      .insert(s.products)
      .values({
        id: slug,
        slug,
        name,
        categoryId,
        material,
        description: `${name} mang đến cảm giác nhẹ nhàng cho những giờ nghỉ ngơi. Chất liệu ${material.toLowerCase()} mềm mại, phom thoải mái và đường may tinh tế. Giặt nhẹ dưới 30°C, tránh chất tẩy và phơi trong bóng râm.`,
        image: `/images/${slug}.svg`,
        featured: true,
      })
      .onConflictDoNothing();
    for (const size of ['S', 'M', 'L', 'XL'])
      await db
        .insert(s.variants)
        .values({
          id: `${slug}-${size}`,
          productId: slug,
          sku: `COZY-${slug.toUpperCase()}-${size}`,
          color,
          size,
          price,
          stock: 20,
        })
        .onConflictDoNothing();
  }
  if (!process.env.ADMIN_PASSWORD) throw Error('Run db:setup first');
  const salt = randomBytes(16).toString('hex');
  await db
    .insert(s.users)
    .values({
      email: process.env.ADMIN_EMAIL!,
      name: 'Cozy Admin',
      role: 'ADMIN',
      password: salt + ':' + scryptSync(process.env.ADMIN_PASSWORD, salt, 64).toString('hex'),
    })
    .onConflictDoNothing();
  await db
    .insert(s.vouchers)
    .values({ code: 'COZY10', percent: 10, minimum: 300000, expiresAt: new Date('2027-12-31') })
    .onConflictDoNothing();
  for (const [id, value] of [
    ['hero', 'Êm ái từng khoảnh khắc.'],
    ['announcement', 'Miễn phí vận chuyển cho đơn từ 599.000đ'],
    [
      'about',
      'Cozy pajamas tin rằng sự thoải mái cũng là một cách yêu bản thân. Những thiết kế nhẹ nhàng để bạn luôn là chính mình.',
    ],
  ])
    await db.insert(s.content).values({ id, value }).onConflictDoNothing();
  console.log(
    'Seed ready: 8 products, 32 variants, voucher COZY10, administrator from private .env.',
  );
  await pool.end();
}
main().catch(() => {
  console.error('Seed failed');
  process.exit(1);
});
