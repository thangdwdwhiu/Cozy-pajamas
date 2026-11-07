import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveImage, validImageUrl } from '../src/lib/media';
test('Supabase adapter persists an image with server credentials and returns its public URL', async () => {
  const before = { ...process.env },
    fetchOriginal = globalThis.fetch;
  try {
    process.env.MEDIA_STORAGE = 'supabase';
    process.env.SUPABASE_URL = 'https://storage.example.test';
    process.env.SUPABASE_STORAGE_BUCKET = 'product-images';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-key';
    let called = false;
    globalThis.fetch = async (input, options) => {
      called = true;
      assert.ok(
        String(input).startsWith('https://storage.example.test/storage/v1/object/product-images/'),
      );
      assert.equal(options?.method, 'POST');
      assert.equal((options?.headers as Record<string, string>).apikey, 'test-server-key');
      assert.equal((options?.headers as Record<string, string>)['Content-Type'], 'image/webp');
      return new Response('{}', { status: 200 });
    };
    const url = await saveImage(Buffer.from('test-image'));
    assert.ok(called);
    assert.ok(validImageUrl(url));
    assert.ok(
      url.startsWith('https://storage.example.test/storage/v1/object/public/product-images/'),
    );
    assert.equal(validImageUrl('https://untrusted.example/anything.webp'), false);
  } finally {
    process.env = before;
    globalThis.fetch = fetchOriginal;
  }
});
test('Supabase upload failure is explicit and never falls back to ephemeral disk', async () => {
  const before = { ...process.env },
    fetchOriginal = globalThis.fetch;
  try {
    process.env.MEDIA_STORAGE = 'supabase';
    process.env.SUPABASE_URL = 'https://storage.example.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    globalThis.fetch = async () => new Response('{}', { status: 403 });
    await assert.rejects(saveImage(Buffer.from('test')), /Không thể lưu ảnh/);
  } finally {
    process.env = before;
    globalThis.fetch = fetchOriginal;
  }
});
test('Vercel refuses local uploads without configured persistent storage', async () => {
  const before = { ...process.env };
  try {
    process.env.VERCEL = '1';
    process.env.MEDIA_STORAGE = 'local';
    await assert.rejects(saveImage(Buffer.from('test')), /Supabase Storage/);
  } finally {
    process.env = before;
  }
});
