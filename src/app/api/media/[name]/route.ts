import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-f0-9-]{36}\.webp$/.test(name)) return new NextResponse(null, { status: 404 });
  try {
    const data = await readFile(
      /* turbopackIgnore: true */
      join(
        /* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'),
        name,
      ),
    );
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
