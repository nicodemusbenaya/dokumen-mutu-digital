import {query, pool} from '../src/lib/db.mjs';
import bcrypt from 'bcryptjs';

if (process.env.ALLOW_ACCOUNT_CREATE !== 'true') {
  throw new Error('Dibatalkan: set ALLOW_ACCOUNT_CREATE=true untuk mengaktifkan pembuatan akun.');
}
const username = 'user123';
const password = 'user123';
try {
  const roles = await query("SELECT id FROM roles WHERE name='Admin Sistem' LIMIT 1");
  if (!roles.length) throw new Error("Role 'Admin Sistem' tidak ditemukan. Jalankan migrasi/schema lama terlebih dahulu.");
  const hash = await bcrypt.hash(password, 12);
  await query(`INSERT INTO users (username, full_name, password_hash, role_id, bidang, is_active)
    VALUES (?, ?, ?, ?, ?, TRUE)
    ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), password_hash=VALUES(password_hash), role_id=VALUES(role_id), bidang=VALUES(bidang), is_active=TRUE`,
    [username, 'Pengguna Lokal', hash, roles[0].id, 'Umum']);
  console.log('AKUN_LOKAL_SIAP');
  console.log('Username: user123');
  console.log('Password: user123');
} finally { await pool().end(); }
