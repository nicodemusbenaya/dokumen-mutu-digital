import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { query } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';

// POST /api/documents/[id]/submit
// Ajukan Draft ke Review (Tim Mutu)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!hasPermission(user.role, 'document:submit')) return forbidden();

  const { id } = await params;
  const docId = parseInt(id);

  const rows = await query<any[]>('SELECT * FROM documents WHERE id = ?', [docId]);
  if (!rows.length) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });

  const doc = rows[0];

  if (doc.status !== 'Draft') {
    return NextResponse.json({ error: `Hanya dokumen berstatus Draft yang bisa diajukan. Status saat ini: ${doc.status}` }, { status: 409 });
  }
  if (doc.penyusun_id !== user.id && user.role !== 'Admin Sistem') {
    return forbidden();
  }

  // Cek minimal Tujuan dan Judul terisi
  const sections = await query<any[]>(
    "SELECT section_key, content FROM document_sections WHERE document_id = ? AND section_key = 'tujuan'",
    [docId]
  );
  if (!sections.length || !sections[0].content?.trim()) {
    return NextResponse.json({ error: 'Bagian "Tujuan" harus diisi sebelum mengajukan review.' }, { status: 422 });
  }

  await query(
    `UPDATE documents
     SET status = 'Review', version_number = version_number + 1, updated_at = NOW()
     WHERE id = ?`,
    [docId]
  );

  await addAuditLog(user, 'SUBMIT', {
    documentId: docId,
    docKode:    doc.kode,
    note:       'Diajukan untuk review Tim Mutu',
    ipAddress:  req.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({ message: 'Dokumen berhasil diajukan untuk review.' });
}
