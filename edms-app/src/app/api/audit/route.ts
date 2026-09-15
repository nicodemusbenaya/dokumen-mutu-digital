import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized } from '@/lib/auth';
import { query } from '@/lib/db';

// GET /api/audit?q=&type=&page=&limit=

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const q     = searchParams.get('q')    || '';
  const type  = searchParams.get('type') || '';
  const page  = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(200, parseInt(searchParams.get('limit') || '100'));
  const offset= (page - 1) * limit;

  let conditions = ['1=1'];
  let params: unknown[] = [];

  if (type) { conditions.push('l.action_type = ?'); params.push(type); }
  if (q) {
    conditions.push('(l.user_name LIKE ? OR l.note LIKE ? OR l.doc_kode LIKE ? OR l.action_type LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const where = conditions.join(' AND ');

  const [logs, countRows] = await Promise.all([
    query<any[]>(
      `SELECT l.* FROM audit_logs l WHERE ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ),
    query<any[]>(`SELECT COUNT(*) AS total FROM audit_logs l WHERE ${where}`, params),
  ]);

  return NextResponse.json({
    data:  logs,
    total: countRows[0]?.total ?? 0,
    page,
    limit,
  });
}
