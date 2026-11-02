import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { hasPermission, canEditDocument } from '@/lib/rbac';

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
  if (!hasPermission(user.role, 'document:edit')) return forbidden();

  const { id } = await params;
  const refId = parseInt(id);
  const body  = await req.json();
  const { documentId } = body;

  if (!Number.isSafeInteger(Number(documentId)) || Number(documentId) < 1 || !Number.isSafeInteger(refId) || refId < 1) {
    return NextResponse.json({ error: 'ID dokumen dan referensi harus valid.' }, { status: 400 });
  }
  const error = await withTransaction(async conn => {
    const [docs] = await conn.execute<RowDataPacket[]>('SELECT status, penyusun_id FROM documents WHERE id = ? FOR UPDATE', [documentId]);
    if (!docs.length) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
    if (!canEditDocument(user.role, docs[0].status, docs[0].penyusun_id, user.id)) return forbidden();
    const [refs] = await conn.execute<RowDataPacket[]>('SELECT id FROM `references` WHERE id = ? AND is_active = 1', [refId]);
    if (!refs.length) return NextResponse.json({ error: 'Referensi aktif tidak ditemukan.' }, { status: 404 });
    const [inserted] = await conn.execute<ResultSetHeader>(
      'INSERT IGNORE INTO document_references (document_id, reference_id, linked_by) VALUES (?, ?, ?)', [documentId, refId, user.id]);
    if (inserted.affectedRows) {
      await conn.execute('UPDATE documents SET version_number = version_number + 1, updated_at = NOW() WHERE id = ?', [documentId]);
      await conn.execute(
        'INSERT INTO audit_logs (user_id, user_name, action_type, document_id, note, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
        [user.id, user.fullName, 'UPDATE', documentId, `Referensi ${refId} ditautkan`, req.headers.get('x-forwarded-for')]);
    }
    return null;
  });
  if (error) return error;
  return NextResponse.json({ message: 'Referensi berhasil ditautkan.' });
}
