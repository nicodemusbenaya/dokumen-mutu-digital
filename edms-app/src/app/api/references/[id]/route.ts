import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { query } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';

type Params = { params: Promise<{ id: string }> };

// DELETE /api/references/[id] (Admin only)
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!hasPermission(user.role, 'reference:delete')) return forbidden();

  const { id } = await params;
  const refId = parseInt(id);

  // Cek apakah masih dipakai
  const usage = await query<any[]>(
    'SELECT COUNT(*) AS cnt FROM document_references WHERE reference_id = ?', [refId]
  );
  if (usage[0]?.cnt > 0) {
    return NextResponse.json({
      error: `Referensi masih digunakan oleh ${usage[0].cnt} dokumen. Hapus tautan terlebih dahulu.`,
    }, { status: 409 });
  }

  // Soft delete (set is_active = 0)
  await query('UPDATE `references` SET is_active = 0 WHERE id = ?', [refId]);

  await addAuditLog(user, 'UPDATE', { note: `Referensi ID ${refId} dinonaktifkan` });

  return NextResponse.json({ message: 'Referensi dinonaktifkan.' });
}

// POST /api/references/[id]/link — tautkan referensi ke dokumen
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const refId = parseInt(id);
  const body  = await req.json();
  const { documentId } = body;

  if (!documentId) return NextResponse.json({ error: 'documentId wajib.' }, { status: 400 });

  await query(
    `INSERT IGNORE INTO document_references (document_id, reference_id, linked_by)
     VALUES (?, ?, ?)`,
    [documentId, refId, user.id]
  );

  return NextResponse.json({ message: 'Referensi berhasil ditautkan.' });
}
