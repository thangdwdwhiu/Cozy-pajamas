import Store from '@/components/store';
import { getCatalog } from '@/lib/catalog';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
type Props = { params: Promise<{ slug?: string[] }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug ?? [];
  const catalog = await getCatalog();
  const product =
    slug[0] === 'san-pham' && slug[1]
      ? catalog.products.find((p) => p.slug === slug[1])
      : undefined;
  const privatePage = [
    'tai-khoan',
    'admin',
    'don-hang',
    'gio-hang',
    'thanh-toan',
    'yeu-thich',
  ].includes(slug[0]);
  return {
    title:
      product?.name ??
      {
        'san-pham': 'Bộ sưu tập',
        'cau-chuyen': 'Câu chuyện Cozy',
        'chinh-sach': 'Chính sách mua hàng',
      }[slug[0]] ??
      'Êm ái từng khoảnh khắc',
    description: product?.description,
    alternates: {
      canonical: (process.env.APP_URL ?? 'http://localhost:3000') + '/' + slug.join('/'),
    },
    robots: privatePage ? { index: false, follow: false } : undefined,
  };
}
export default async function Page({ params }: Props) {
  const slug = (await params).slug ?? [];
  const catalog = await getCatalog();
  const product =
    slug[0] === 'san-pham' && slug[1]
      ? catalog.products.find((p) => p.slug === slug[1])
      : undefined;
  if (
    (slug[0] === 'san-pham' && slug[1] && !product) ||
    (slug[0] &&
      ![
        'san-pham',
        'cau-chuyen',
        'chinh-sach',
        'tai-khoan',
        'admin',
        'don-hang',
        'gio-hang',
        'thanh-toan',
        'yeu-thich',
      ].includes(slug[0]))
  )
    notFound();
  const structured = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        image: new URL(product.image, process.env.APP_URL).toString(),
        brand: { '@type': 'Brand', name: 'Cozy pajamas' },
        offers: product.variants.map((v) => ({
          '@type': 'Offer',
          sku: v.sku,
          price: v.price,
          priceCurrency: 'VND',
          availability:
            v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: process.env.APP_URL + '/san-pham/' + product.slug,
        })),
      }
    : null;
  return (
    <>
      {structured && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, '\\u003c') }}
        />
      )}
      <Store initial={catalog} />
    </>
  );
}
