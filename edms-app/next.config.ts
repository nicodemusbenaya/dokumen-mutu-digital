import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['puppeteer', 'puppeteer-core', '@sparticuz/chromium-min', 'mysql2', 'bcryptjs'],
  images: {
    unoptimized: true,  // Nonaktifkan image optimizer — tidak diperlukan untuk deployment internal NAS
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
