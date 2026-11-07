import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export function validImageUrl(value: string) {
  if (/^\/images\/[a-z0-9.-]+$/.test(value) || /^\/api\/media\/[a-f0-9-]{36}\.webp$/.test(value))
    return true;
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'product-images';
  if (!base) return false;
  const prefix = `${base}/storage/v1/object/public/${bucket}/`;
  return value.startsWith(prefix) && /^[a-f0-9-]{36}\.webp$/.test(value.slice(prefix.length));
}
export async function saveImage(image: Buffer) {
  const name = randomUUID() + '.webp';
  if (process.env.MEDIA_STORAGE === 'supabase') {
    const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'product-images';
    if (!base || !secret || !/^https:\/\//.test(base) || !/^[a-z0-9-]+$/.test(bucket))
      throw Error('Chưa cấu hình kho ảnh Supabase');
    const response = await fetch(`${base}/storage/v1/object/${bucket}/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        apikey: secret,
        'Content-Type': 'image/webp',
        'x-upsert': 'false',
        'Cache-Control': '3600',
      },
      body: new Uint8Array(image),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw Error('Không thể lưu ảnh vào Supabase. Kiểm tra cấu hình bucket và quyền của server.');
    return `${base}/storage/v1/object/public/${bucket}/${name}`;
  }
  if (process.env.VERCEL)
    throw Error('Cần cấu hình Supabase Storage trước khi tải ảnh trên Vercel');
  const dir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), image, { flag: 'wx' });
  return '/api/media/' + name;
}
