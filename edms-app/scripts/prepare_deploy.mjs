import fs from 'fs';
import path from 'path';

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');

// 1. Copy .next/static -> .next/standalone/.next/static
const srcStatic = path.join(root, '.next', 'static');
const dstStatic = path.join(standalone, '.next', 'static');

if (fs.existsSync(srcStatic)) {
  fs.mkdirSync(dstStatic, { recursive: true });
  fs.cpSync(srcStatic, dstStatic, { recursive: true });
  console.log('✓ Copied .next/static to .next/standalone/.next/static');
}

// 2. Copy public -> .next/standalone/public (excluding uploads)
const srcPub = path.join(root, 'public');
const dstPub = path.join(standalone, 'public');

if (fs.existsSync(srcPub)) {
  fs.mkdirSync(dstPub, { recursive: true });
  const items = fs.readdirSync(srcPub);
  for (const item of items) {
    if (item === 'uploads') continue; // do not overwrite uploads
    fs.cpSync(path.join(srcPub, item), path.join(dstPub, item), { recursive: true });
  }
  console.log('✓ Copied public assets (excl uploads) to .next/standalone/public');
}

console.log('✅ Standalone preparation complete!');
