import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { query } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { canEditDocument } from '@/lib/rbac';

// POST /api/documents/[id]/revise
// Buka siklus revisi: dokumen Aktif → Draft agar bisa diedit kembali.
// Versi baru (2.0, 3.0, ...) baru dibuat saat pengesahan final (stage 3).

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const docId = parseInt(id);

  const rows = await query<{ id: number; status: string; kode: string; penyusun_id: number }[]>(
    'SELECT id, status, kode, penyusun_id FROM documents WHERE id = ?',
    [docId]
  );
  if (!rows.length) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
  const doc = rows[0];

  if (doc.status !== 'Aktif') {
    return NextResponse.json({
      error: `Hanya dokumen berstatus Aktif yang bisa direvisi. Status saat ini: ${doc.status}`,
    }, { status: 409 });
  }

  // 'Draft' = status TUJUAN setelah reopen (penyusun hanya boleh saat Draft);
  // Admin selalu lolos, Penyusun hanya dokumen miliknya.
  if (!canEditDocument(user.role, 'Draft', doc.penyusun_id, user.id)) {
    return forbidden();
  }

  await query(
    `UPDATE documents
     SET status = 'Draft', version_number = version_number + 1, updated_at = NOW()
     WHERE id = ?`,
    [docId]
  );

  await addAuditLog(user, 'UPDATE', {
    documentId: docId,
    docKode:    doc.kode,
    note:       'Siklus revisi dibuka: dokumen Aktif kembali ke Draft',
    ipAddress:  req.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({
    message: 'Siklus revisi dibuka. Dokumen kembali ke Draft untuk diedit dan diajukan review ulang.',
  });
}
