import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { canEditDocument } from '@/lib/rbac';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/documents/[id] ──────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const docId = parseInt(id);
  if (isNaN(docId)) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });

  const [docs, sections, refs, approvals, versions] = await Promise.all([
    query<any[]>(
      `SELECT d.*, u.full_name AS penyusun_name
       FROM documents d LEFT JOIN users u ON u.id = d.penyusun_id
       WHERE d.id = ?`, [docId]
    ),
    query<any[]>(
      'SELECT section_key, content FROM document_sections WHERE document_id = ?', [docId]
    ),
    query<any[]>(
      `SELECT r.id, r.kategori, r.nomor, r.judul, r.deskripsi
       FROM document_references dr
       JOIN \`references\` r ON r.id = dr.reference_id
       WHERE dr.document_id = ?`, [docId]
    ),
    query<any[]>(
      `SELECT a.*, u.full_name AS actor_name
       FROM approvals a JOIN users u ON u.id = a.actor_id
       WHERE a.document_id = ?
       ORDER BY a.stage, a.created_at`, [docId]
    ),
    query<any[]>(
      'SELECT * FROM document_versions WHERE document_id = ? ORDER BY id DESC', [docId]
    ),
  ]);

  if (!docs.length) {
    return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
  }

  const raw = docs[0];
  const doc = {
    ...raw,
    siklusReview:  raw.siklus_review,
    currentVersion: raw.current_version,
    versionNumber: raw.version_number,
    penyusunId:    raw.penyusun_id,
    penyusunName:  raw.penyusun_name,
    auditRef:      raw.audit_ref,
    ackTotal:      raw.ack_total,
    ackDone:       raw.ack_done,
    createdAt:     raw.created_at,
    updatedAt:     raw.updated_at,
  };
  const sectionsMap: Record<string, string> = {};
  sections.forEach((s: any) => { sectionsMap[s.section_key] = s.content; });

  const mappedApprovals = approvals.map((a: any) => ({
    id:            a.id,
    documentId:    a.document_id,
    stage:         a.stage,
    action:        a.action,
    actorId:       a.actor_id,
    actorName:     a.actor_name,
    note:          a.note,
    signaturePath: a.signature_path,
    docVersion:    a.doc_version,
    createdAt:     a.created_at,
  }));

  return NextResponse.json({
    data: { ...doc, sections: sectionsMap, refs, approvals: mappedApprovals, versions }
  });
}

// ─── PUT /api/documents/[id] ──────────────────────────────────
// Optimistic locking via version_number

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const docId = parseInt(id);
  if (isNaN(docId)) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });

  const body = await req.json();
  const { judul, bidang, jenis, siklusReview, sections, refIds, versionNumber } = body;

  // Ambil dokumen current
  const rows = await query<any[]>('SELECT * FROM documents WHERE id = ?', [docId]);
  if (!rows.length) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });

  const doc = rows[0];

  // RBAC check
  if (!canEditDocument(user.role, doc.status, doc.penyusun_id, user.id)) {
    return forbidden();
  }

  // Optimistic locking check (numeric comparison)
  if (versionNumber !== undefined && Number(doc.version_number) !== Number(versionNumber)) {
    return NextResponse.json({
      error: 'Konflik: Dokumen ini telah diubah oleh pengguna lain. Silakan coba simpan kembali.',
      code:  'CONFLICT',
    }, { status: 409 });
  }

  try {
    await withTransaction(async (conn) => {
      // Update dokumen header
      await conn.execute(
        `UPDATE documents
         SET judul = ?, bidang = ?, jenis = ?, siklus_review = ?,
             version_number = version_number + 1, updated_at = NOW()
         WHERE id = ?`,
        [
          judul       ?? doc.judul,
          bidang      ?? doc.bidang,
          jenis       ?? doc.jenis,
          siklusReview ?? doc.siklus_review,
          docId,
        ]
      );

      // Update sections
      if (sections && typeof sections === 'object') {
        for (const [key, content] of Object.entries(sections)) {
          await conn.execute(
            `INSERT INTO document_sections (document_id, section_key, content)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE content = VALUES(content)`,
            [docId, key, content as string]
          );
        }
      }

      // Hapus seksi jika ada permintaan penghapusan seksi kustom
      if (Array.isArray(body.deletedSectionKeys) && body.deletedSectionKeys.length > 0) {
        for (const delKey of body.deletedSectionKeys) {
          if (typeof delKey === 'string' && delKey.trim()) {
            await conn.execute(
              'DELETE FROM document_sections WHERE document_id = ? AND section_key = ?',
              [docId, delKey]
            );
          }
        }
      }

      // Update references (mendukung refIds maupun references)
      const targetRefIds = Array.isArray(refIds) ? refIds : (Array.isArray(body.references) ? body.references : null);
      if (targetRefIds !== null) {
        await conn.execute('DELETE FROM document_references WHERE document_id = ?', [docId]);
        for (const refId of targetRefIds) {
          await conn.execute(
            'INSERT INTO document_references (document_id, reference_id) VALUES (?, ?)',
            [docId, refId]
          );
        }
      }
    });

    await addAuditLog(user, 'UPDATE', {
      documentId: docId,
      docKode:    doc.kode,
      note:       'Draft diperbarui',
    });

    // Kembalikan version_number baru
    const updated = await query<any[]>('SELECT version_number FROM documents WHERE id = ?', [docId]);
    const newVer = updated[0]?.version_number;

    return NextResponse.json({
      data:    { versionNumber: newVer, version: newVer },
      message: 'Dokumen berhasil disimpan.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal menyimpan perubahan dokumen.' }, { status: 500 });
  }
}

// ─── DELETE /api/documents/[id] ───────────────────────────────
// Hanya Admin, dan hanya dokumen Obsolete

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (user.role !== 'Admin Sistem') return forbidden();

  const { id } = await params;
  const docId = parseInt(id);

  const rows = await query<any[]>('SELECT status, kode FROM documents WHERE id = ?', [docId]);
  if (!rows.length) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });

  // Dokumen Obsolete bisa dihapus oleh Admin, tapi biarkan log tetap ada
  await query('DELETE FROM documents WHERE id = ?', [docId]);

  await addAuditLog(user, 'UPDATE', {
    note: `Dokumen ${rows[0].kode} dihapus oleh Admin`,
  });

  return NextResponse.json({ message: 'Dokumen dihapus.' });
}
