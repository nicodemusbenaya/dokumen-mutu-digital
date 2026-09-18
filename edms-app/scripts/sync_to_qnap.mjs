import fs from 'fs';
import path from 'path';

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');
const target = '\\\\10.10.200.166\\Container\\edms-app';

async function sync() {
  console.log('🚀 Syncing standalone build to QNAP NAS:', target);

  if (!fs.existsSync(target)) {
    throw new Error(`Target directory ${target} is not accessible!`);
  }

  // 1. Sync server.js
  const srcServer = path.join(standalone, 'server.js');
  const dstServer = path.join(target, 'server.js');
  if (fs.existsSync(srcServer)) {
    fs.copyFileSync(srcServer, dstServer);
    console.log('✓ server.js updated');
  }

  // 2. Sync .next directory
  const srcNext = path.join(standalone, '.next');
  const dstNext = path.join(target, '.next');
  if (fs.existsSync(srcNext)) {
    console.log('⏳ Copying .next build directory to QNAP...');
    fs.cpSync(srcNext, dstNext, { recursive: true, force: true });
    console.log('✓ .next directory updated on QNAP');
  }

  // 3. Sync public (excl uploads)
  const srcPub = path.join(standalone, 'public');
  const dstPub = path.join(target, 'public');
  if (fs.existsSync(srcPub)) {
    console.log('⏳ Copying public assets to QNAP...');
    const items = fs.readdirSync(srcPub);
    for (const item of items) {
      if (item === 'uploads') continue; // NEVER overwrite uploads
      fs.cpSync(path.join(srcPub, item), path.join(dstPub, item), { recursive: true, force: true });
    }
    console.log('✓ public assets updated on QNAP');
  }

  console.log('🎉 QNAP NAS deployment sync complete!');
}

sync().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
