import mysql from 'mysql2/promise';

// ─────────────────────────────────────────────────────────────────
//  Database connection pool — MariaDB 10.5.8
//  Credentials dari environment variables (tidak hardcode)
// ─────────────────────────────────────────────────────────────────

declare global {
  // Prevent multiple pools in Next.js dev HMR
  var _edmsPool: mysql.Pool | undefined;
}

function createPool(): mysql.Pool {
  return mysql.createPool({
    host:               process.env.DB_HOST?.trim()!,
    port:               parseInt(process.env.DB_PORT?.trim() || '3307'),
    database:           process.env.DB_NAME?.trim()!,
    user:               process.env.DB_USER?.trim()!,
    password:           process.env.DB_PASSWORD?.trim()!,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    connectTimeout:     5000,
    timezone:           '+07:00',
    charset:            'utf8mb4',
  });
}

const pool: mysql.Pool =
  global._edmsPool ?? (global._edmsPool = createPool());

export default pool;

// ─── Typed query helper ────────────────────────────────────────

export async function query<T = mysql.RowDataPacket[]>(
  sql: string,
  values?: any[]
): Promise<T> {
  const [rows] = await pool.execute(sql, values as any);
  return rows as T;
}

// ─── Transaction helper ────────────────────────────────────────

export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
