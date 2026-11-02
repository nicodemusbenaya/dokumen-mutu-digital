import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: 'standalone',
  // The QNAP release is built under /app/update-* while /app has its own
  // package-lock.json. Keep tracing and @/ imports rooted in this release.
  outputFileTracingRoot: process.cwd(),
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(process.cwd(), 'src'),
    };
    return config;
  },
  serverExternalPackages: ['puppeteer', 'puppeteer-core', '@sparticuz/chromium-min', 'mysql2', 'bcryptjs',
    'pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
  // pdfjs-dist/pdf-parse dimuat sebagai external (build terbundel tidak punya
  // pdf.worker.mjs sehingga parse PDF gagal). Tracing default Next hanya menyalin
  // berkas yang diimpor eksplisit, jadi worker + canvas harus dimasukkan manual
  // supaya ikut ke payload standalone di QNAP.
  outputFileTracingIncludes: {
    '/**': [
      'node_modules/pdfjs-dist/**/*',
      'node_modules/pdf-parse/**/*',
      'node_modules/@napi-rs/**/*',
      'node_modules/fflate/**/*',
    ],
  },
  images: {
    unoptimized: true,  // Nonaktifkan image optimizer — tidak diperlukan untuk deployment internal NAS
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
