// ═══════════════════════════════════════════════════════════════
//  Template Copy Engine — RENCANA_FITUR_TEMPLATE_DOKUMEN.md §7
//  Membuat dokumen Draft baru dari template (is_template=1):
//    • sections + urutan (_section_order) — riwayat_perubahan direset '[]'
//    • jenis, bidang, siklus_review, audit_ref, relasi parent
//    • referensi standar (document_references)
//    • seluruh folder media storage/media/{idLama} → {idBaru}
//    • URL /uploads/media/{idLama}/ di-rewrite ke {idBaru}
//    • TIDAK ikut: approvals, versi, acknowledge (§7.2)
//  Gagal copy file → transaksi DB digulungkan + folder hasil dibersihkan (R5).
// ═══════════════════════════════════════════════════════════════

import fs from 'fs/promises';
import path from 'path';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { withTransaction } from './db';
import { getDefaultSectionsForType } from './documentTypes';

export interface FromTemplateInput {
  templateId: number;
  kode: string;
  judul: string;
  bidang?: string; // default: bidang template
  userId: number;
}

export class TemplateCopyError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface TemplateDocRow extends RowDataPacket {
  id: number;
  kode: string;
  judul: string;
  bidang: string;
  jenis: string;
  siklus_review: string;
  status: string;
  is_template: number;
  audit_ref: string | null;
  parent_prosedur_id: number | null;
  kop_path: string | null;
  source_path: string | null;
  source_name: string | null;
  source_ext: string | null;
}

interface SectionRow extends RowDataPacket {
  section_key: string;
  content: string | null;
}

interface RefRow extends RowDataPacket {
  reference_id: number;
}

/** Ganti referensi media lama → baru di seluruh string HTML/path. */
function rewriteMediaUrls(html: string | null, oldId: number, newId: number): string | null {
  if (html == null) return html;
  return html.split(`/uploads/media/${oldId}/`).join(`/uploads/media/${newId}/`);
}

/** Akar penyimpanan fisik (sama dengan routes /uploads/[...path]). */
function mediaDir(docId: number): { storage: string; legacy: string } {
  const root = process.cwd();
  return {
    storage: path.join(root, 'storage', 'media', String(docId)),
    legacy:  path.join(root, 'public', 'uploads', 'media', String(docId)),
  };
}

async function folderExists(p: string): Promise<boolean> {
  try { return (await fs.stat(p)).isDirectory(); } catch { return false; }
}

export async function createDocumentFromTemplate(input: FromTemplateInput): Promise<number> {
  const { templateId, kode, judul, userId } = input;

  // Kode unik dicek dulu di route agar pesan error jelas sebelum transaksi (R3);
  // constraint UNIQUE tetap jadi penjaga akhir di sini.
  // Objek agar penyimpanan di closure tidak ter-narrowing jadi null oleh TS.
  const cleanup: { dir: string | null } = { dir: null };

  try {
    const docId = await withTransaction(async (conn) => {
      const [tplRes] = await conn.execute(
        'SELECT * FROM documents WHERE id = ? FOR UPDATE',
        [templateId]
      );
      const tpl = (tplRes as TemplateDocRow[])[0];
      if (!tpl) throw new TemplateCopyError('Template tidak ditemukan.', 404);
      if (!Number(tpl.is_template)) {
        throw new TemplateCopyError('Dokumen tersebut bukan template (is_template=0).', 409);
      }

      const bidang = (input.bidang && input.bidang.trim()) ? input.bidang.trim() : tpl.bidang;

      // 1. Header dokumen baru (tanpa kop/source dulu — diisi setelah id diketahui)
      const [insRes] = await conn.execute(
        `INSERT INTO documents
           (kode, judul, bidang, jenis, siklus_review, status,
            current_version, version_number, penyusun_id,
            audit_ref, parent_prosedur_id, is_template, template_source_id)
         VALUES (?, ?, ?, ?, ?, 'Draft', '1.0', 1, ?, ?, ?, 0, ?)`,
        [
          kode, judul, bidang, tpl.jenis, tpl.siklus_review,
          userId, tpl.audit_ref ?? null, tpl.parent_prosedur_id ?? null, templateId,
        ]
      );
      const newId = (insRes as ResultSetHeader).insertId;

      // 2. Copy seluruh folder media SEBELUM insert path (gagal → rollback, §11 R5)
      const dirs = mediaDir(templateId);
      const tplHasMedia = Boolean(tpl.source_path || tpl.kop_path);
      const srcDir = (await folderExists(dirs.storage))
        ? dirs.storage
        : ((await folderExists(dirs.legacy)) ? dirs.legacy : null);

      if (srcDir) {
        const destDir = mediaDir(newId).storage;
        await fs.mkdir(path.dirname(destDir), { recursive: true });
        await fs.cp(srcDir, destDir, { recursive: true });
        cleanup.dir = destDir;
      } else if (tplHasMedia) {
        throw new TemplateCopyError(
          `Berkas media template tidak ditemukan di storage (media/${templateId}). ` +
          'Pastikan folder sumber masih ada sebelum menyalin.',
          422
        );
      }

      // 3. Kop & berkas sumber — kolom diisi dengan URL yang sudah di-rewrite
      await conn.execute(
        `UPDATE documents SET kop_path = ?, source_path = ?, source_name = ?, source_ext = ?
         WHERE id = ?`,
        [
          rewriteMediaUrls(tpl.kop_path, templateId, newId),
          rewriteMediaUrls(tpl.source_path, templateId, newId),
          tpl.source_name ?? null,
          tpl.source_ext ?? null,
          newId,
        ]
      );

      // 4. Sections — salin semua baris; riwayat_perubahan direset (§7.2)
      const [secRes] = await conn.execute(
        'SELECT section_key, content FROM document_sections WHERE document_id = ? ORDER BY id',
        [templateId]
      );
      const secRows = secRes as SectionRow[];

      if (secRows.length > 0) {
        for (const s of secRows) {
          const content =
            s.section_key === 'riwayat_perubahan'
              ? '[]'
              : (rewriteMediaUrls(s.content ?? '', templateId, newId) ?? '');
          await conn.execute(
            'INSERT INTO document_sections (document_id, section_key, content) VALUES (?, ?, ?)',
            [newId, s.section_key, content]
          );
        }
      } else {
        // Template tanpa sections → isi default baku jenisnya (agar hasil tetap terpakai)
        const fallback = getDefaultSectionsForType(tpl.jenis);
        for (const [key, content] of Object.entries(fallback)) {
          await conn.execute(
            'INSERT INTO document_sections (document_id, section_key, content) VALUES (?, ?, ?)',
            [newId, key, content]
          );
        }
      }

      // 5. Referensi standar
      const [refRes] = await conn.execute(
        'SELECT reference_id FROM document_references WHERE document_id = ?',
        [templateId]
      );
      for (const r of refRes as RefRow[]) {
        await conn.execute(
          'INSERT INTO document_references (document_id, reference_id) VALUES (?, ?)',
          [newId, r.reference_id]
        );
      }

      return newId;
    });

    return docId;
  } catch (err) {
    // Kompensasi: bila file sudah tersalin tapi transaksi gagal setelahnya,
    // hapus folder hasil agar tidak menumpuk sebagai orphan.
    if (cleanup.dir) {
      await fs.rm(cleanup.dir, { recursive: true, force: true }).catch(() => {});
    }
    if ((err as { code?: string })?.code === 'ER_DUP_ENTRY') {
      throw new TemplateCopyError(`Kode dokumen "${kode}" sudah digunakan.`, 409);
    }
    throw err;
  }
}
