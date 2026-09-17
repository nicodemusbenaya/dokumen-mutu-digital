import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { query } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';

// GET /api/references?q=&kategori=

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const q       = searchParams.get('q')       || '';
  const kategori= searchParams.get('kategori')|| '';

  let conditions = ['r.is_active = 1'];
  let params: unknown[] = [];

  if (kategori) { conditions.push('r.kategori = ?'); params.push(kategori); }
  if (q) {
    conditions.push('(r.nomor LIKE ? OR r.judul LIKE ? OR r.deskripsi LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  const refs = await query<any[]>(
    `SELECT r.*,
            (SELECT COUNT(*) FROM document_references dr WHERE dr.reference_id = r.id) AS usage_count
     FROM \`references\` r
     WHERE ${conditions.join(' AND ')}
     ORDER BY r.kategori, r.nomor`,
    params
  );

  return NextResponse.json({ data: refs });
}

// POST /api/references (Admin only)

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!hasPermission(user.role, 'reference:create')) return forbidden();

  const body = await req.json();
  const { kategori, nomor, judul, deskripsi } = body;

  if (!kategori || !nomor || !judul) {
    return NextResponse.json({ error: 'Kategori, nomor, dan judul wajib diisi.' }, { status: 400 });
  }

  const res = await query<any>(
    'INSERT INTO `references` (kategori, nomor, judul, deskripsi, created_by) VALUES (?, ?, ?, ?, ?)',
    [kategori, nomor, judul, deskripsi || null, user.id]
  );

  await addAuditLog(user, 'CREATE', {
    note: `Referensi baru ditambahkan: [${kategori}] ${nomor}`,
  });

  return NextResponse.json({ data: { id: res.insertId }, message: 'Referensi ditambahkan.' }, { status: 201 });
}

// PUT /api/references (Admin only)
export async function PUT(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!hasPermission(user.role, 'reference:update')) return forbidden();

  const body = await req.json();
  const { id, kategori, nomor, judul, deskripsi, isActive } = body;

  if (!id || !kategori || !nomor || !judul) {
    return NextResponse.json({ error: 'ID, kategori, nomor, dan judul wajib diisi.' }, { status: 400 });
  }

  await query(
    'UPDATE `references` SET kategori = ?, nomor = ?, judul = ?, deskripsi = ?, is_active = ? WHERE id = ?',
    [kategori, nomor, judul, deskripsi || null, isActive !== undefined ? (isActive ? 1 : 0) : 1, id]
  );

  await addAuditLog(user, 'UPDATE', {
    note: `Referensi diperbarui: [${kategori}] ${nomor}`,
  });

  return NextResponse.json({ message: 'Referensi berhasil diperbarui.' });
}
