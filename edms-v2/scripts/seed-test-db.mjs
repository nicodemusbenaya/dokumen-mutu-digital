import {query, pool} from '../src/lib/db.mjs';

// Never load .env.local here: this command must only use the isolated test DB.
if (process.env.DB_NAME !== 'edms_dummy' || !/^DUMMY-[a-f0-9]+$/.test(process.env.DUMMY_TEST_RUN || '')) {
  throw new Error('Fixture hanya boleh dibuat pada database sementara edms_dummy.');
}
try {
  let connected = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { await query('SELECT 1'); connected = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  if (!connected) throw new Error('Database test tidak siap setelah 60 percobaan.');
  await query('ALTER DATABASE edms_dummy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await query(`CREATE TABLE IF NOT EXISTS roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(60) NOT NULL UNIQUE
  ) ENGINE=InnoDB`);
  await query(`CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, username VARCHAR(60) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL, password_hash VARCHAR(255) NOT NULL,
    role_id INT UNSIGNED NOT NULL, bidang VARCHAR(80), is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY(role_id) REFERENCES roles(id)
  ) ENGINE=InnoDB`);
  await query("INSERT IGNORE INTO roles(name) VALUES('Super user'),('Editor'),('Viewer')");
  console.log('DUMMY_TEST_SCHEMA_READY');
} finally { await pool().end(); }
