import type { MetadataRoute } from 'next';
import { getCatalog } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? 'http://localhost:3000';
  const data = await getCatalog();
  return [
    '',
    '/san-pham',
    '/cau-chuyen',
    '/chinh-sach',
    ...data.products.map((p) => '/san-pham/' + p.slug),
  ].map((path) => ({
    url: base + path,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
