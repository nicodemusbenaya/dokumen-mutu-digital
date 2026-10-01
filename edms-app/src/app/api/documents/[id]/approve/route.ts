import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { canApprove } from '@/lib/rbac';
import { bumpMajorVersion } from '@/lib/revisionUtils';
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

  // Jendela siklus approval: hanya baris SETELAH pengesahan final (stage 3) terakhir
  // atau reject terakhir yang dihitung. Approval siklus sebelumnya tidak lagi memblokir
  // sehingga siklus revisi berikutnya bisa menyetujui stage yang sama lagi.
  const winRows = await query<{ window_id: number | string }[]>(
    `SELECT GREATEST(
       COALESCE((SELECT MAX(id) FROM approvals WHERE document_id = ? AND stage = 3 AND action = 'Approve'), 0),
       COALESCE((SELECT MAX(id) FROM approvals WHERE document_id = ? AND action = 'Reject'), 0)
     ) AS window_id`,
    [docId, docId]
  );
  const approvalWindow = Number(winRows[0]?.window_id || 0);

  // Pernah terbit (pengesahan final pernah dilakukan) → siklus ini adalah revisi
  const priorPublishRows = await query<{ id: number }[]>(
    "SELECT id FROM approvals WHERE document_id = ? AND stage = 3 AND action = 'Approve' LIMIT 1",
    [docId]
  );
  const priorPublished = priorPublishRows.length > 0;

  // Pastikan stage tidak sudah di-approve sebelumnya dalam siklus berjalan
  const existingApproval = await query<any[]>(
    "SELECT id FROM approvals WHERE document_id = ? AND stage = ? AND action = 'Approve' AND doc_version = ? AND id > ?",
    [docId, stage, doc.current_version, approvalWindow]
  );
  if (existingApproval.length) {
    return NextResponse.json({ error: 'Tahap ini sudah disetujui sebelumnya untuk versi dokumen ini.' }, { status: 409 });
  }

  // Pastikan tahapan sebelumnya sudah disetujui secara berurutan (dalam siklus berjalan)
  if (stage === 2) {
    const stage1Approval = await query<any[]>(
      "SELECT id FROM approvals WHERE document_id = ? AND stage = 1 AND action = 'Approve' AND doc_version = ? AND id > ?",
      [docId, doc.current_version, approvalWindow]
    );
    if (!stage1Approval.length) {
      return NextResponse.json({ error: 'Stage 1 (Review Tim Mutu) harus disetujui terlebih dahulu.' }, { status: 409 });
    }
  } else if (stage === 3) {
    const stage2Approval = await query<any[]>(
      "SELECT id FROM approvals WHERE document_id = ? AND stage = 2 AND action = 'Approve' AND doc_version = ? AND id > ?",
      [docId, doc.current_version, approvalWindow]
    );
    if (!stage2Approval.length) {
      return NextResponse.json({ error: 'Stage 2 (Approval Manager Bidang) harus disetujui terlebih dahulu.' }, { status: 409 });
    }
  }

  // Simpan signature jika ada
  let signaturePath: string | null = null;
  if (signatureData && action === 'Approve') {
    try {
      const sigDir = path.join(process.cwd(), 'storage', 'signatures');
      await fs.mkdir(sigDir, { recursive: true });
      const fileName = `sig_${user.id}_doc${docId}_stage${stage}_${Date.now()}.png`;
      const base64 = signatureData.replace(/^data:image\/\w+;base64,/, '');
      await fs.writeFile(path.join(sigDir, fileName), Buffer.from(base64, 'base64'));
      signaturePath = `/uploads/signatures/${fileName}`;
    } catch (e) {
      console.error('[Signature save error]', e);
    }
  }

  let resultVersion = doc.current_version; // versi final setelah transaksi (bump di stage 3)

  await withTransaction(async (conn) => {
    // Simpan approval record
    await conn.execute(
      `INSERT INTO approvals (document_id, stage, action, actor_id, note, signature_path, doc_version)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [docId, stage, action, user.id, note || null, signaturePath, doc.current_version]
    );

    if (action === 'Approve') {
      let nextStatus: string;
      let newVersion = doc.current_version;
      if (stage === 1) nextStatus = 'Menunggu Approval'; // → ke stage Manager
      else if (stage === 2) nextStatus = 'Menunggu Approval'; // → ke stage Pimpinan
      else {
        // Stage 3: dokumen Aktif; jika sudah pernah terbit, naikkan versi (1.0 → 2.0 → 3.0)
        // dan arsipkan versi lama sebagai Obsolete demi retensi audit ISO.
        nextStatus = 'Aktif';

        if (priorPublished) {
          newVersion = bumpMajorVersion(doc.current_version);
          await conn.execute(
            `INSERT INTO document_versions (document_id, version, status, deskripsi, archived_by)
             VALUES (?, ?, 'Obsolete', ?, ?)`,
            [docId, doc.current_version, `Digantikan oleh v${newVersion}`, user.id]
          );
        }

        // Log publish
        await conn.execute(
          `INSERT INTO audit_logs (user_id, user_name, action_type, document_id, doc_kode, note)
           VALUES (?, ?, 'PUBLISH', ?, ?, ?)`,
          [user.id, user.fullName, docId, doc.kode, `Dokumen terbit & aktif v${newVersion}`]
        );
      }

      await conn.execute(
        `UPDATE documents
         SET status = ?, current_version = ?, version_number = version_number + 1, updated_at = NOW()
         WHERE id = ?`,
        [nextStatus, newVersion, docId]
      );
      resultVersion = newVersion;
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
    note:       `${action} stage ${stage}${stage === 3 && action === 'Approve' ? ` (v${resultVersion})` : ''}${note ? ': ' + note : ''}`,
    ipAddress:  req.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({
    message: action === 'Approve'
      ? stage === 3 ? `Dokumen resmi terbit dan aktif v${resultVersion}.` : 'Disetujui dan diteruskan ke tahap berikutnya.'
      : 'Dokumen dikembalikan ke Penyusun.',
  });
}
