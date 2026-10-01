// Migrasi file dari public/uploads (di dalam container, hilang saat update image)
// ke storage/ (persisten via volume mount).
// Jalankan: node scripts/migrate_uploads_to_storage.mjs
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUBDIRS = ['signatures', 'pdf', 'attachments'];

let totalCopied = 0;
for (const sub of SUBDIRS) {
  const src = path.join(root, 'public', 'uploads', sub);
  const dst = path.join(root, 'storage', sub);
  try {
    const files = await fs.readdir(src);
    await fs.mkdir(dst, { recursive: true });
    let copied = 0;
    for (const f of files) {
      const s = path.join(src, f);
      const d = path.join(dst, f);
      const st = await fs.stat(s);
      if (!st.isFile()) continue;
      try {
        await fs.access(d); // sudah ada → skip
      } catch {
        await fs.copyFile(s, d); // copy (bukan move) agar file lama tetap jadi cadangan
        copied++;
      }
    }
    totalCopied += copied;
    console.log(`${sub}: ${copied}/${files.length} file baru disalin ke storage/${sub}`);
  } catch (e) {
    if (e.code === 'ENOENT') console.log(`${sub}: tidak ada (skip)`);
    else throw e;
  }
}
console.log(`Selesai. Total ${totalCopied} file dimigrasikan ke storage/.`);
