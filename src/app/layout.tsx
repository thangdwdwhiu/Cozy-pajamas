import type { Metadata } from 'next';
import './globals.css';
import './admin.css';
export const metadata: Metadata = {
  title: { default: 'Cozy pajamas — Êm ái từng khoảnh khắc', template: '%s | Cozy pajamas' },
  description:
    'Pijama, váy ngủ và đồ mặc nhà nhẹ nhàng, tinh tế. Khám phá những điều mềm mại tại Cozy pajamas.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="stylesheet" href="/fonts/fonts.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
