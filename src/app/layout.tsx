import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'scaff-web',
  description: 'Multi-view building editor PoC'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>
      </body>
    </html>
  );
}
