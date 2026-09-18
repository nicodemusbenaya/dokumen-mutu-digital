import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    host: '10.10.200.166',
    port: 3307,
    user: 'root',
    password: '12345678',
  });
  const conn2 = await mysql.createConnection({
    host: '10.10.200.166',
    port: 3307,
    user: 'root',
    password: '12345678',
    database: 'edms_ups'
  });
  await conn2.query("ALTER TABLE documents MODIFY COLUMN jenis VARCHAR(100) NOT NULL");
  const [colsAfter] = await conn2.query("SHOW COLUMNS FROM documents LIKE 'jenis'");
  console.log('Jenis column updated:', colsAfter);
  await conn2.end();
  await conn.end();
}

main().catch(console.error);
