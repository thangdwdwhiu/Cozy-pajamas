import 'dotenv/config';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('docs/screenshots', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({
  baseURL: 'http://localhost:3000',
  viewport: { width: 1440, height: 1000 },
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto('http://localhost:3000');
  await page.getByRole('heading', { name: 'Êm ái từng khoảnh khắc.' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'docs/screenshots/desktop.png', fullPage: true });
  await page.goto('http://localhost:3000/san-pham/rose');
  await page.getByRole('button', { name: 'Hồng phấn / M', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm vào giỏ hàng' }).click();
  await page.goto('http://localhost:3000/gio-hang');
  await page.getByRole('link', { name: 'Tiến hành thanh toán' }).click();
  await page.getByLabel('Họ và tên').fill('Browser Test');
  await page.getByLabel('Email', { exact: true }).fill('browser@example.test');
  await page.getByLabel('Số điện thoại').fill('0901234567');
  await page.getByLabel('Địa chỉ đầy đủ').fill('123 Test, phường Test, Thành phố Test');
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click();
  await page.waitForURL('**/don-hang/**');
  await page.getByRole('heading', { name: 'Cảm ơn bạn đã chọn sự dịu dàng.' }).waitFor();
  const orderId = page.url().split('/').at(-1);
  const denied = await page.request.get('/api/orders/' + orderId);
  assert.equal(denied.status(), 403);
  const adminDenied = await page.request.get('/api/admin');
  assert.equal(adminDenied.status(), 401);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Hủy đơn hàng', exact: true }).click();
  await page.getByText('Đã hủy', { exact: true }).waitFor();
  await page.goto('http://localhost:3000/tai-khoan');
  await page.getByLabel('Email', { exact: true }).fill(process.env.ADMIN_EMAIL);
  await page.getByLabel('Mật khẩu (ít nhất 10 ký tự)').fill(process.env.ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('heading', { name: 'Xin chào, Cozy Admin' }).waitFor();
  await page.goto('http://localhost:3000/admin');
  await page.getByRole('heading', { name: 'Tổng quan', exact: true }).waitFor();
  await page.screenshot({ path: 'docs/screenshots/admin.png', fullPage: true });
  const csrf = await page.request.post('/api/admin/content', {
    headers: { origin: 'https://invalid.example' },
    data: { id: 'hero', value: 'tampered' },
  });
  assert.equal(csrf.status(), 400);
  await page.getByRole('button', { name: 'Kho hàng', exact: true }).click();
  await page.getByRole('heading', { name: 'Quản lý tồn kho' }).waitFor();
  const invalidUpload = await page.request.post('/api/admin/upload', {
    headers: { origin: 'http://localhost:3000' },
    multipart: {
      file: { name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
    },
  });
  assert.equal(invalidUpload.status(), 400);
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ddaaaa' } })
    .png()
    .toBuffer();
  const upload = await page.request.post('/api/admin/upload', {
    headers: { origin: 'http://localhost:3000' },
    multipart: { file: { name: 'test.png', mimeType: 'image/png', buffer: png } },
  });
  assert.equal(upload.status(), 200);
  const uploaded = await upload.json();
  const media = await page.request.get(uploaded.url);
  assert.equal(media.headers()['content-type'], 'image/webp');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000');
  await page.getByRole('heading', { name: 'Êm ái từng khoảnh khắc.' }).waitFor();
  await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'mobile page overflows',
  );
  await page.getByRole('button', { name: 'Mở menu' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Sản phẩm', exact: true }).click();
  await page.getByRole('heading', { name: 'Tủ đồ của những ngày dịu dàng' }).waitFor();
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    'PASS: desktop/mobile, cart, guest checkout, cancellation, admin login, admin catalog, IDOR, auth guard, CSRF, no browser errors.',
  );
} finally {
  await browser.close();
}
