import type { MetadataRoute } from 'next';
export const dynamic = 'force-dynamic';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/tai-khoan', '/don-hang/', '/thanh-toan', '/gio-hang'],
    },
    sitemap: process.env.APP_URL + '/sitemap.xml',
  };
}
