import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
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
