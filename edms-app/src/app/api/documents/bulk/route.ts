import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { hasPermission, canApprove } from '@/lib/rbac';
import { bumpMajorVersion } from '@/lib/revisionUtils';

// â”€â”€â”€ POST /api/documents/bulk â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Aksi massal atas daftar dokumen terpilih â€” Â§9.4 & keputusan RBAC massal
// mengikuti RBAC per-dokumen yang sudah ada:
//   delete        â†’ Admin Sistem
//   set/unset-template â†’ template:set
//   submit        â†’ document:submit (+ kepemilikan & kelengkapan isi)
//   approve       â†’ canApprove(role, stage) â€” 1 TTD untuk semua dokumen
//   export        â†’ login (document:read)

const MAX_IDS = 500;

type BulkAction = 'delete' | 'set-template' | 'unset-template' | 'submit' | 'approve' | 'export';

type ItemResult = {
  id: number;
  kode?: string;
  status: 'ok' | 'skipped' | 'error';
  error?: string;
};

type DocRow = {
  id: number;
  kode: string;
  judul: string;
  status: string;
  jenis: string;
  penyusun_id: number;
  is_template: number | null;
  current_version: string;
};

type SectionRow = { section_key: string; content: string | null };

type ExportRow = {
  kode: string;
  judul: string;
  bidang: string;
  jenis: string;
  current_version: string;
  status: string;
  is_template: number | null;
  updated_at: Date | string | null;
  penyusun: string | null;
};

const BULK_ACTIONS: BulkAction[] = ['delete', 'set-template', 'unset-template', 'submit', 'approve', 'export'];

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body permintaan tidak valid.' }, { status: 400 });
  }

  const action = body.action as BulkAction;
  if (!BULK_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `Aksi "${String(action)}" tidak dikenal.` }, { status: 400 });
  }

  const rawIds: unknown[] = Array.isArray(body.ids) ? body.ids : [];
  const ids: number[] = [...new Set<number>(
    rawIds.map(v => Number(v)).filter(v => Number.isInteger(v) && v > 0),
  )];
  if (!ids.length) {
    return NextResponse.json({ error: 'Pilih minimal satu dokumen.' }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Maksimal ${MAX_IDS} dokumen per aksi massal.` }, { status: 400 });
  }

  // â”€â”€ RBAC â”€â”€
  if (action === 'delete') {
    if (user.role !== 'Admin Sistem') return forbidden();
  } else if (action === 'set-template' || action === 'unset-template') {
    if (!hasPermission(user.role, 'template:set')) return forbidden();
  } else if (action === 'submit') {
    if (!hasPermission(user.role, 'document:submit')) return forbidden();
  } else if (action === 'approve') {
    const stage = Number(body.stage);
    if (![1, 2, 3].includes(stage)) {
      return NextResponse.json({ error: 'Parameter stage (1|2|3) wajib untuk aksi approve.' }, { status: 400 });
    }
    if (!canApprove(user.role, stage)) return forbidden();
  }

  const placeholders = ids.map(() => '?').join(',');
  const docs = await query<DocRow[]>(
    `SELECT id, kode, judul, status, jenis, penyusun_id, is_template, current_version
     FROM documents WHERE id IN (${placeholders})`,
    ids,
  );
  const byId = new Map(docs.map(d => [d.id, d]));

  const results: ItemResult[] = [];
  const ip = req.headers.get('x-forwarded-for') ?? undefined;

  const markMissing = (id: number) => results.push({ id, status: 'error', error: 'Dokumen tidak ditemukan.' });

  switch (action) {
    case 'export': {
      const rows = await query<ExportRow[]>(`SELECT d.kode, d.judul, d.bidang, d.jenis, d.current_version, d.status,
                d.is_template, d.updated_at, u.full_name AS penyusun
         FROM documents d LEFT JOIN users u ON u.id = d.penyusun_id
         WHERE d.id IN (${placeholders}) ORDER BY d.kode`,
        ids,
      );
      const header = ['Kode', 'Judul', 'Bidang', 'Jenis', 'Versi', 'Status', 'Template', 'Penyusun', 'Diubah'];
      const lines = [header.map(csvCell).join(';')];
      for (const r of rows) {
        lines.push([
          r.kode, r.judul, r.bidang, r.jenis, r.current_version, r.status,
          Number(r.is_template) === 1 ? 'Ya' : 'Tidak',
          r.penyusun ?? '',
          r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : '',
        ].map(csvCell).join(';'));
      }
      const csv = 'ï»¿' + lines.join('\r\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="dokumen-mutu-${new Date().toISOString().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    case 'delete': {
      for (const id of ids) {
        const doc = byId.get(id);
        if (!doc) { markMissing(id); continue; }
        try {
          await query('DELETE FROM documents WHERE id = ?', [id]);
          await fs.rm(path.join(process.cwd(), 'storage', 'media', String(id)), { recursive: true, force: true });
          await addAuditLog(user, 'DELETE', {
            documentId: id,
            docKode: doc.kode,
            note: `Dokumen ${doc.kode} dihapus massal oleh Admin`,
            ipAddress: ip ?? undefined,
          });
          results.push({ id, kode: doc.kode, status: 'ok' });
        } catch (err) {
          results.push({ id, kode: doc.kode, status: 'error', error: (err as Error).message });
        }
      }
      break;
    }

    case 'set-template':
    case 'unset-template': {
      const flag = action === 'set-template' ? 1 : 0;
      for (const id of ids) {
        const doc = byId.get(id);
        if (!doc) { markMissing(id); continue; }
        if (Number(doc.is_template ?? 0) === flag) {
          results.push({ id, kode: doc.kode, status: 'skipped', error: 'Sudah dalam kondisi yang sama.' });
          continue;
        }
        // updated_at dipertahankan agar penandaan massal tidak mengubah timestamp register
        await query(
          'UPDATE documents SET is_template = ?, updated_at = updated_at WHERE id = ?',
          [flag, id],
        );
        await addAuditLog(user, 'UPDATE', {
          documentId: id,
          docKode: doc.kode,
          note: flag
            ? 'Ditandai sebagai Template Dokumen (massal)'
            : 'Tanda Template dihapus â€” dokumen kembali ke Daftar Dokumen (massal)',
          ipAddress: ip ?? undefined,
        });
        results.push({ id, kode: doc.kode, status: 'ok' });
      }
      break;
    }

    case 'submit': {
      for (const id of ids) {
        const doc = byId.get(id);
        if (!doc) { markMissing(id); continue; }
        if (doc.status !== 'Draft') {
          results.push({ id, kode: doc.kode, status: 'skipped', error: `Status ${doc.status}, bukan Draft.` });
          continue;
        }
        if (doc.penyusun_id !== user.id && user.role !== 'Admin Sistem') {
          results.push({ id, kode: doc.kode, status: 'skipped', error: 'Bukan dokumen Anda.' });
          continue;
        }
        try {
          const sections = await query<SectionRow[]>(
            'SELECT section_key, content FROM document_sections WHERE document_id = ?', [id],
          );
          const hasText = sections.some(s => (s.content || '').replace(/<[^>]*>/g, '').trim().length > 0);
          if (!sections.length || !hasText) {
            results.push({ id, kode: doc.kode, status: 'skipped', error: 'Isi bagian dokumen masih kosong.' });
            continue;
          }
          if (doc.jenis === 'SOP/Prosedur' || doc.jenis === 'Instruksi Kerja') {
            const tujuan = sections.find(s => s.section_key === 'tujuan');
            if (!tujuan || !(tujuan.content || '').replace(/<[^>]*>/g, '').trim()) {
              results.push({ id, kode: doc.kode, status: 'skipped', error: 'Bagian "1. Tujuan" belum diisi.' });
              continue;
            }
          }
          await query(
            `UPDATE documents SET status = 'Review', version_number = version_number + 1, updated_at = NOW()
             WHERE id = ?`, [id],
          );
          await addAuditLog(user, 'SUBMIT', {
            documentId: id,
            docKode: doc.kode,
            note: 'Diajukan untuk review Tim Mutu (massal)',
            ipAddress: ip ?? undefined,
          });
          results.push({ id, kode: doc.kode, status: 'ok' });
        } catch (err) {
          results.push({ id, kode: doc.kode, status: 'error', error: (err as Error).message });
        }
      }
      break;
    }

    case 'approve': {
      const stage = Number(body.stage);
      const decision: 'Approve' | 'Reject' = body.decision === 'Reject' ? 'Reject' : 'Approve';
      const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 1000) : null;
      const signatureData = typeof body.signatureData === 'string' ? body.signatureData : '';

      if (decision === 'Approve' && !signatureData) {
        return NextResponse.json({ error: 'Tanda tangan digital wajib untuk persetujuan massal.' }, { status: 400 });
      }

      // Satu file TTD dipakai untuk seluruh dokumen dalam aksi ini.
      let signaturePath: string | null = null;
      if (signatureData && decision === 'Approve') {
        try {
          const sigDir = path.join(process.cwd(), 'storage', 'signatures');
          await fs.mkdir(sigDir, { recursive: true });
          const fileName = `sig_${user.id}_bulk_stage${stage}_${Date.now()}.png`;
          const base64 = signatureData.replace(/^data:image\/\w+;base64,/, '');
          await fs.writeFile(path.join(sigDir, fileName), Buffer.from(base64, 'base64'));
          signaturePath = `/uploads/signatures/${fileName}`;
        } catch (err) {
          console.error('[Bulk signature save error]', err);
          return NextResponse.json({ error: 'Gagal menyimpan tanda tangan.' }, { status: 500 });
        }
      }

      const expectedStatus = stage === 1 ? 'Review' : 'Menunggu Approval';

      for (const id of ids) {
        const doc = byId.get(id);
        if (!doc) { markMissing(id); continue; }
        if (doc.status !== expectedStatus) {
          results.push({
            id, kode: doc.kode, status: 'skipped',
            error: `Status ${doc.status}, bukan ${expectedStatus} (stage ${stage}).`,
          });
          continue;
        }
        try {
          const winRows = await query<Array<{ window_id: number | string }>>(
            `SELECT GREATEST(
               COALESCE((SELECT MAX(id) FROM approvals WHERE document_id = ? AND stage = 3 AND action = 'Approve'), 0),
               COALESCE((SELECT MAX(id) FROM approvals WHERE document_id = ? AND action = 'Reject'), 0)
             ) AS window_id`, [id, id],
          );
          const win = Number(winRows?.[0]?.window_id || 0);

          const dup = await query<Array<{ id: number }>>(
            `SELECT id FROM approvals
             WHERE document_id = ? AND stage = ? AND action = 'Approve' AND doc_version = ? AND id > ?`,
            [id, stage, doc.current_version, win],
          );
          if (dup.length) {
            results.push({ id, kode: doc.kode, status: 'skipped', error: 'Tahap ini sudah disetujui untuk versi ini.' });
            continue;
          }
          if (stage >= 2) {
            const prev = await query<Array<{ id: number }>>(
              `SELECT id FROM approvals
               WHERE document_id = ? AND stage = ? AND action = 'Approve' AND doc_version = ? AND id > ?`,
              [id, stage - 1, doc.current_version, win],
            );
            if (!prev.length) {
              results.push({ id, kode: doc.kode, status: 'skipped', error: `Stage ${stage - 1} belum disetujui.` });
              continue;
            }
          }

          const priorPub = await query<Array<{ id: number }>>(
            "SELECT id FROM approvals WHERE document_id = ? AND stage = 3 AND action = 'Approve' LIMIT 1",
            [id],
          );

          let resultVersion = doc.current_version;
          await withTransaction(async (conn) => {
            await conn.execute(
              `INSERT INTO approvals (document_id, stage, action, actor_id, note, signature_path, doc_version)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [id, stage, decision, user.id, note, signaturePath, doc.current_version],
            );

            if (decision === 'Approve') {
              let nextStatus: string;
              let newVersion = doc.current_version;
              if (stage === 1 || stage === 2) {
                nextStatus = 'Menunggu Approval';
              } else {
                nextStatus = 'Aktif';
                if (priorPub.length) {
                  newVersion = bumpMajorVersion(doc.current_version);
                  await conn.execute(
                    `INSERT INTO document_versions (document_id, version, status, deskripsi, archived_by)
                     VALUES (?, ?, 'Obsolete', ?, ?)`,
                    [id, doc.current_version, `Digantikan oleh v${newVersion}`, user.id],
                  );
                }
                await conn.execute(
                  `INSERT INTO audit_logs (user_id, user_name, action_type, document_id, doc_kode, note)
                   VALUES (?, ?, 'PUBLISH', ?, ?, ?)`,
                  [user.id, user.fullName, id, doc.kode, `Dokumen terbit & aktif v${newVersion} (massal)`],
                );
              }
              await conn.execute(
                `UPDATE documents
                 SET status = ?, current_version = ?, version_number = version_number + 1, updated_at = NOW()
                 WHERE id = ?`,
                [nextStatus, newVersion, id],
              );
              resultVersion = newVersion;
            } else {
              await conn.execute(
                `UPDATE documents SET status = 'Draft', version_number = version_number + 1, updated_at = NOW()
                 WHERE id = ?`, [id],
              );
            }
          });

          await addAuditLog(user, decision === 'Approve' ? 'APPROVE' : 'REJECT', {
            documentId: id,
            docKode: doc.kode,
            note: `${decision} stage ${stage} (massal)${stage === 3 && decision === 'Approve' ? ` (v${resultVersion})` : ''}${note ? ': ' + note : ''}`,
            ipAddress: ip ?? undefined,
          });
          results.push({ id, kode: doc.kode, status: 'ok' });
        } catch (err) {
          results.push({ id, kode: doc.kode, status: 'error', error: (err as Error).message });
        }
      }
      break;
    }
  }

  const stats = {
    ok: results.filter(r => r.status === 'ok').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    error: results.filter(r => r.status === 'error').length,
    total: results.length,
  };

  return NextResponse.json({ action, stats, results });
}
