const config = {
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
  // Direct worker imports must remain available outside the Next.js route bundle.
  serverExternalPackages: [
    'mysql2', 'bcryptjs', 'jszip', 'jose', 'pdf-parse', 'pdfjs-dist', '@napi-rs/canvas',
  ],
  outputFileTracingIncludes: {
    '/**': [
      'src/lib/**/*.mjs', 'scripts/*.mjs', 'scripts/*.py', 'sql/*.sql',
      'node_modules/jose/**/*', 'node_modules/pdfjs-dist/**/*',
      'node_modules/pdf-parse/**/*', 'node_modules/@napi-rs/**/*',
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [{source:'/:path*', headers:[
      {key:'X-Content-Type-Options', value:'nosniff'},
      {key:'Referrer-Policy', value:'same-origin'},
      {key:'X-Frame-Options', value:'SAMEORIGIN'},
    ]}];
  },
};
export default config;
