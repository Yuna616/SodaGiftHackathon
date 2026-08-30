import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import BottomNav from '@/components/BottomNav';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sodapick',
});

export const metadata: Metadata = {
  title: 'SodaPick',
  description: '무료로 예측하고, 진짜 기프티콘 리워드를 받는 경험',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={jakarta.variable}>
      <body>
        <div className="app-shell">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
