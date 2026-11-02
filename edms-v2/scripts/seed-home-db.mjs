import bcrypt from 'bcryptjs';
import {query, pool} from '../src/lib/db.mjs';

// This fixture is deliberately restricted to the database and loopback port
// owned by compose.home.yml. Never import an account from the NAS.
if (process.env.EDMS_HOME !== 'true' || process.env.DB_NAME !== 'edms_home' ||
    process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '33307') {
  throw new Error('Fixture rumah hanya boleh memakai MariaDB edms_home di 127.0.0.1:33307.');
}
if (!process.env.HOME_ADMIN_PASSWORD || process.env.HOME_ADMIN_PASSWORD.length < 24) {
  throw new Error('Password akun lokal belum tersedia.');
}
try {
  const [database] = await query('SELECT DATABASE() AS name');
  if (database.name !== 'edms_home') throw new Error('Database tujuan tidak sesuai.');
  await query(`CREATE TABLE IF NOT EXISTS roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL UNIQUE
  ) ENGINE=InnoDB`);
  await query(`CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT UNSIGNED NOT NULL,
    bidang VARCHAR(80),
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY(role_id) REFERENCES roles(id)
  ) ENGINE=InnoDB`);
  await query("INSERT IGNORE INTO roles(name) VALUES('Super user'),('Editor'),('Viewer')");
  const [role] = await query("SELECT id FROM roles WHERE name='Super user'");
  const [existing] = await query("SELECT id FROM users WHERE username='DUMMY-home-admin'");
  if (!existing) {
    const hash = await bcrypt.hash(process.env.HOME_ADMIN_PASSWORD, 12);
    await query('INSERT INTO users(username,full_name,password_hash,role_id,bidang,is_active) VALUES(?,?,?,?,?,1)',
      ['DUMMY-home-admin', 'DUMMY Admin Rumah', hash, role.id, 'Umum']);
  }
  console.log('HOME_DUMMY_ACCOUNT_READY');
} finally {
  await pool().end();
}
