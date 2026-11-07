import 'dotenv/config';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { Pool } from 'pg';
const base = 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname))
  throw Error('This test only runs against a local database');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ baseURL: base, viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let categoryId, productId;
try {
  await page.goto('/tai-khoan');
  await page.getByLabel('Email', { exact: true }).fill(process.env.ADMIN_EMAIL);
  await page.getByLabel('Mật khẩu (ít nhất 10 ký tự)').fill(process.env.ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('heading', { name: 'Xin chào, Cozy Admin' }).waitFor();
  await page.goto('/admin');
  await page.getByRole('heading', { name: 'Tổng quan', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'docs/screenshots/admin-redesign.png', fullPage: true });
  await page.getByRole('button', { name: 'Sản phẩm', exact: true }).click();
  await page.getByPlaceholder('Tìm theo tên sản phẩm…').waitFor();
  assert.equal(await page.locator('header').count(), 0);
  await page.screenshot({ path: 'docs/screenshots/admin-products.png', fullPage: true });
  await page.getByRole('button', { name: 'Thêm danh mục', exact: true }).click();
  const categoryName = 'QA Đồ ngủ ' + Date.now();
  await page.getByLabel('Tên danh mục', { exact: true }).fill(categoryName);
  assert.equal(await page.locator('input[name=slug]').count(), 0);
  const categoryResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/admin/category') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Tạo danh mục', exact: true }).click();
  categoryId = (await (await categoryResponse).json()).category.id;
  await page.getByRole('heading', { name: categoryName, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Thêm sản phẩm', exact: true }).click();
  const productName = 'QA Pijama hồng ' + Date.now();
  await page.getByLabel('Tên sản phẩm', { exact: true }).fill(productName);
  await page.getByLabel('Chất liệu', { exact: true }).fill('Cotton mềm');
  await page
    .getByLabel('Mô tả sản phẩm', { exact: true })
    .fill('Mô tả kiểm thử nhiều ảnh và danh mục sản phẩm.');
  await page.getByLabel('Danh mục sản phẩm', { exact: true }).selectOption(categoryId);
  await page.getByLabel('Giá bán (₫)', { exact: true }).fill('350.000');
  await page.getByLabel('Màu sắc', { exact: true }).fill('Hồng');
  await page.getByLabel('Tồn kho ban đầu cho mỗi kích thước', { exact: true }).fill('3');
  const a = await sharp('public/images/rose.svg').png().toBuffer(),
    b = await sharp('public/images/cloud.svg').png().toBuffer();
  await page.getByLabel('Tải nhiều ảnh sản phẩm').setInputFiles([
    { name: 'rose.png', mimeType: 'image/png', buffer: a },
    { name: 'cloud.png', mimeType: 'image/png', buffer: b },
  ]);
  await page.getByRole('button', { name: 'Đặt ảnh 2 làm ảnh bìa', exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Tạo sản phẩm', exact: true })
    .waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.upload-zone.uploading'));
  await page.getByRole('button', { name: 'Đặt ảnh 2 làm ảnh bìa', exact: true }).click();
  assert.equal(await page.getByLabel('Tên sản phẩm', { exact: true }).inputValue(), productName);
  await page.getByLabel('Mô tả sản phẩm', { exact: true }).fill('ngắn');
  await page.getByRole('button', { name: 'Tạo sản phẩm', exact: true }).click();
  await page
    .locator('.field-error')
    .filter({ hasText: 'Mô tả sản phẩm cần ít nhất 10 ký tự' })
    .waitFor();
  assert.equal(await page.getByLabel('Tên sản phẩm', { exact: true }).inputValue(), productName);
  await page.getByRole('button', { name: 'Bỏ ảnh 2', exact: true }).waitFor();
  const invalid = await page.evaluate(async () => {
    const response = await fetch('/api/admin/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'a',
        description: 'ngắn',
        material: '',
        categoryId: '',
        images: [],
        active: true,
        featured: false,
      }),
    });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(invalid.status, 422);
  assert.ok(invalid.body.fieldErrors.description);
  await page.screenshot({ path: 'docs/screenshots/admin-validation.png', fullPage: true });
  await page
    .getByLabel('Mô tả sản phẩm', { exact: true })
    .fill('Mô tả kiểm thử nhiều ảnh và danh mục sản phẩm.');
  await page.screenshot({ path: 'docs/screenshots/admin-product-editor.png', fullPage: true });
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/admin/product') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Tạo sản phẩm', exact: true }).click();
  const result = await (await response).json();
  assert.ok(result.product, JSON.stringify(result));
  const product = result.product;
  productId = product.id;
  assert.equal(product.images.length, 2);
  assert.equal(product.image, product.images[0]);
  assert.ok(product.slug.startsWith('qa-pijama-hong-'));
  assert.equal(product.categoryId, categoryId);
  await page.getByRole('button', { name: 'Chỉnh sửa ' + productName, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Chỉnh sửa ' + productName, exact: true }).click();
  await page.getByRole('button', { name: 'Bỏ ảnh 2', exact: true }).click();
  await page.getByLabel('Tên sản phẩm', { exact: true }).fill(productName + ' sửa');
  const update = page.waitForResponse(
    (r) => r.url().endsWith('/api/admin/product') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  const edited = (await (await update).json()).product;
  assert.equal(edited.images.length, 1);
  assert.equal(edited.slug, product.slug);
  await page.goto('/san-pham/' + product.slug);
  await page.getByRole('heading', { name: productName + ' sửa' }).waitFor();
  // Restore the second image through the authenticated endpoint and verify customer gallery.
  const restored = await page.request.post('/api/admin/product', {
    headers: { origin: base },
    data: {
      id: product.id,
      name: productName,
      categoryId,
      description: product.description,
      material: product.material,
      images: product.images,
      active: true,
      featured: false,
    },
  });
  assert.equal(restored.status(), 200);
  await page.reload();
  await page.getByRole('button', { name: 'Xem ảnh 2', exact: true }).click();
  assert.equal(await page.locator('.detail-image>img').getAttribute('src'), product.images[1]);
  await page.goto('/admin');
  await page.getByRole('heading', { name: 'Tổng quan', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Thêm sản phẩm', exact: true }).click();
  await page.getByLabel('Tên sản phẩm', { exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: 'docs/screenshots/admin-mobile.png', fullPage: true });
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    'PASS: separate Admin tabs, automatic slugs, category assignment, multi-upload, cover/order, edit without lost fields, removal persistence, storefront gallery, mobile layout.',
  );
} finally {
  await browser.close();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    if (productId) {
      await c.query(
        'DELETE FROM inventory_movements WHERE variant_id IN (SELECT id FROM variants WHERE product_id=$1)',
        [productId],
      );
      await c.query('DELETE FROM variants WHERE product_id=$1', [productId]);
      await c.query('DELETE FROM products WHERE id=$1', [productId]);
      await c.query('DELETE FROM audit WHERE target=$1', [productId]);
    }
    if (categoryId) {
      await c.query('DELETE FROM categories WHERE id=$1', [categoryId]);
      await c.query('DELETE FROM audit WHERE target=$1', [categoryId]);
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}
