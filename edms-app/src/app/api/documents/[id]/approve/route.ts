import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { canApprove } from '@/lib/rbac';
import path from 'path';
import fs from 'fs/promises';

// POST /api/documents/[id]/approve
// Body: { action: 'Approve'|'Reject', stage: 1|2|3, note?: string, signatureData?: string }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const docId = parseInt(id);

  const body = await req.json();
  const { action, stage, note, signatureData } = body as {
    action:        'Approve' | 'Reject';
    stage:         1 | 2 | 3;
    note?:         string;
    signatureData?: string; // base64 PNG dari signature pad
  };

  if (!action || !stage || !['Approve','Reject'].includes(action)) {
    return NextResponse.json({ error: 'Parameter action dan stage wajib.' }, { status: 400 });
  }

  // RBAC check
  if (!canApprove(user.role, stage)) return forbidden();

  // Ambil dokumen
  const rows = await query<any[]>('SELECT * FROM documents WHERE id = ?', [docId]);
  if (!rows.length) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });

  const doc = rows[0];

  // Pastikan dokumen ada di stage yang benar
  const expectedStatus = stage === 1 ? 'Review' : 'Menunggu Approval';
  if (doc.status !== expectedStatus) {
    return NextResponse.json({
      error: `Dokumen tidak dalam tahap yang tepat. Status saat ini: ${doc.status}`,
    }, { status: 409 });
  }

  // Pastikan stage tidak sudah di-approve sebelumnya
  const existingApproval = await query<any[]>(
    "SELECT id FROM approvals WHERE document_id = ? AND stage = ? AND action = 'Approve'",
    [docId, stage]
  );
  if (existingApproval.length) {
    return NextResponse.json({ error: 'Tahap ini sudah disetujui sebelumnya.' }, { status: 409 });
  }

  // Simpan signature jika ada
  let signaturePath: string | null = null;
  if (signatureData && action === 'Approve') {
    try {
      const sigDir = path.join(process.cwd(), 'public', 'uploads', 'signatures');
      await fs.mkdir(sigDir, { recursive: true });
      const fileName = `sig_${user.id}_doc${docId}_stage${stage}_${Date.now()}.png`;
      const base64 = signatureData.replace(/^data:image\/\w+;base64,/, '');
      await fs.writeFile(path.join(sigDir, fileName), Buffer.from(base64, 'base64'));
      signaturePath = `/uploads/signatures/${fileName}`;
    } catch (e) {
      console.error('[Signature save error]', e);
    }
  }

  await withTransaction(async (conn) => {
    // Simpan approval record
    await conn.execute(
      `INSERT INTO approvals (document_id, stage, action, actor_id, note, signature_path, doc_version)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [docId, stage, action, user.id, note || null, signaturePath, doc.current_version]
    );

    if (action === 'Approve') {
      let nextStatus: string;
      if (stage === 1) nextStatus = 'Menunggu Approval'; // → ke stage Manager
      else if (stage === 2) nextStatus = 'Menunggu Approval'; // → ke stage Pimpinan
      else {
        // Stage 3: dokumen Aktif, versi lama jadi Obsolete
        nextStatus = 'Aktif';

        // Arsipkan versi aktif sebelumnya jika ada
        await conn.execute(
          `INSERT INTO document_versions (document_id, version, status, deskripsi, archived_by)
           SELECT id, current_version, 'Obsolete',
                  CONCAT('Digantikan oleh v', current_version, ' pada ', NOW()),
                  ?
           FROM documents WHERE id = ? AND status = 'Aktif'`,
          [user.id, docId]
        );

        // Log publish
        await conn.execute(
          `INSERT INTO audit_logs (user_id, user_name, action_type, document_id, doc_kode, note)
           VALUES (?, ?, 'PUBLISH', ?, ?, ?)`,
          [user.id, user.fullName, docId, doc.kode, `Dokumen terbit & aktif v${doc.current_version}`]
        );
      }

      await conn.execute(
        `UPDATE documents
         SET status = ?, version_number = version_number + 1, updated_at = NOW()
         WHERE id = ?`,
        [nextStatus, docId]
      );
    } else {
      // Reject → kembali ke Draft
      await conn.execute(
        `UPDATE documents
         SET status = 'Draft', version_number = version_number + 1, updated_at = NOW()
         WHERE id = ?`,
        [docId]
      );
    }
  });

  const actionType = action === 'Approve' ? 'APPROVE' : 'REJECT';
  await addAuditLog(user, actionType as any, {
    documentId: docId,
    docKode:    doc.kode,
    note:       `${action} stage ${stage}${note ? ': ' + note : ''}`,
    ipAddress:  req.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({
    message: action === 'Approve'
      ? stage === 3 ? 'Dokumen resmi terbit dan aktif! 🎉' : 'Disetujui dan diteruskan ke tahap berikutnya.'
      : 'Dokumen dikembalikan ke Penyusun.',
  });
}
