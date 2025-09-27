import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'scaff - 建築作図エディタ',
  description: '足場・建築向けの多視点同期型作図エディタ'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
