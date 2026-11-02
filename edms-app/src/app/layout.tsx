import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({
  src: './fonts/inter-latin.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-inter',
  display: 'swap',
});

const playfair = localFont({
  src: './fonts/playfair-display-latin.woff2',
  weight: '400 900',
  style: 'normal',
  adjustFontFallback: 'Times New Roman',
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EDMS — Sistem Dokumen Mutu Digital | PLN UP Sertifikasi',
  description: 'Electronic Document Management System untuk pengelolaan dokumen mutu PLN UP Sertifikasi. Paperless, terstruktur, dan terkendali.',
  icons: {
    icon: '/images/logo-pln.png',
    shortcut: '/images/logo-pln.png',
    apple: '/images/logo-pln.png',
  },
  robots: 'noindex, nofollow', // Internal system
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}
