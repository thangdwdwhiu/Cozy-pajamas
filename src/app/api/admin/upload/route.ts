import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin, requireUser, rateLimit } from '@/lib/security';
import { MAX_IMAGE_BYTES, saveImage } from '@/lib/media';
import sharp from 'sharp';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    await checkOrigin();
    const user = await requireUser(true);
    await rateLimit('upload:' + user.id, 150);
    if (Number(req.headers.get('content-length')) > MAX_IMAGE_BYTES + 65536)
      return NextResponse.json({ error: 'Mỗi ảnh tối đa 3 MB' }, { status: 413 });
    const form = await req.formData();
    const file = form.get('file');
    if (
      !(file instanceof File) ||
      file.size > MAX_IMAGE_BYTES ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    )
      throw Error('Chỉ nhận JPG, PNG hoặc WebP tối đa 3 MB mỗi ảnh');
    const image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25000000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    return NextResponse.json({ url: await saveImage(image) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Không thể tải ảnh' },
      { status: 400 },
    );
  }
}
