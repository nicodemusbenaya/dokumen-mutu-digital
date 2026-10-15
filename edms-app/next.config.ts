import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
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
