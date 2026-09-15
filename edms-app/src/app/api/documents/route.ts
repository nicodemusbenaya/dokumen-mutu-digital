import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';

// ─── GET /api/documents ───────────────────────────────────────
// Query params: ?status=&bidang=&q=&page=&limit=

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || '';
  const bidang = searchParams.get('bidang') || '';
  const q      = searchParams.get('q')      || '';
  const page   = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit  = Math.min(100, parseInt(searchParams.get('limit') || '50'));
  const offset = (page - 1) * limit;

  let conditions = ['1=1'];
  let params: unknown[] = [];

  if (status) { conditions.push('d.status = ?'); params.push(status); }
  if (bidang) { conditions.push('d.bidang = ?'); params.push(bidang); }
  if (q) {
    conditions.push('(d.kode LIKE ? OR d.judul LIKE ? OR d.bidang LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  const where = conditions.join(' AND ');

  const [docs, countRows] = await Promise.all([
    query<any[]>(
      `SELECT d.*, u.full_name AS penyusun_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.penyusun_id
       WHERE ${where}
       ORDER BY d.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ),
    query<any[]>(
      `SELECT COUNT(*) AS total FROM documents d WHERE ${where}`,
      params
    ),
  ]);

  return NextResponse.json({
    data:  docs,
    total: countRows[0]?.total ?? 0,
    page,
    limit,
  });
}

// ─── POST /api/documents ──────────────────────────────────────
// Buat dokumen baru (Penyusun / Admin)

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!hasPermission(user.role, 'document:create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { kode, judul, bidang, jenis, siklusReview } = body;

  if (!kode || !judul || !bidang || !jenis) {
    return NextResponse.json({ error: 'Kode, judul, bidang, dan jenis wajib diisi.' }, { status: 400 });
  }

  // Cek duplikat kode
  const existing = await query<any[]>('SELECT id FROM documents WHERE kode = ?', [kode]);
  if (existing.length) {
    return NextResponse.json({ error: `Kode dokumen "${kode}" sudah digunakan.` }, { status: 409 });
  }

  const result = await withTransaction(async (conn) => {
    const [res] = await conn.execute(
      `INSERT INTO documents (kode, judul, bidang, jenis, siklus_review, penyusun_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [kode, judul, bidang, jenis, siklusReview || '2 tahun', user.id]
    ) as any;
    const docId = res.insertId;

    // Insert empty sections
    const sectionKeys = ['tujuan', 'ruang_lingkup', 'definisi', 'prosedur', 'lampiran'];
    for (const key of sectionKeys) {
      await conn.execute(
        'INSERT INTO document_sections (document_id, section_key, content) VALUES (?, ?, ?)',
        [docId, key, '']
      );
    }
    return docId;
  });

  await addAuditLog(user, 'CREATE', {
    documentId: result,
    docKode:    kode,
    note:       'Dokumen baru dibuat',
    ipAddress:  req.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({ data: { id: result }, message: 'Dokumen berhasil dibuat.' }, { status: 201 });
}
