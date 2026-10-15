import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';
import { unzipSync, type Unzipped } from 'fflate';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import {
  parseFileName,
  detectType,
  parseDocxBuffer,
  parsePdfBuffer,
  materializeParsedAssets,
} from '@/lib/docParser';

export const runtime = 'nodejs';

// ─── POST /api/documents/bulk-import ────────────────────────────
// Impor massal dari satu berkas .zip — keputusan Cabang #9/#11:
//   * create/update per kode (tabrakan kode → 1 baris, duplikat dilewati)
//   * opsional "mode sinkron": kode yang tidak ada di zip ikut dihapus
//     (hanya Admin Sistem)
// Aturan klasifikasi, normalisasi kode, dan versi REV sama dengan
// scripts/import_formulir_eksisting.mjs (migrasi CLI 351 berkas).

const MAX_ZIP_BYTES = 300 * 1024 * 1024;
const MAX_FILES = 1000;
const MEDIA_ROOT = path.join(process.cwd(), 'storage', 'media');
const UPSERT_KODE = 'MAN.MUTU.UPS.2025.00';

const ALLOW_EXT = new Set(['.docx', '.pdf', '.xlsx', '.xls', '.doc', '.csv', '.rtf', '.odt']);
// Salinan PDF dari folder formulir diabaikan — sumber teksnya berkas Word.
const SKIP_DIR = /Formulir Versi PDF/i;
const JENIS_ENUM = new Set([
  'SOP/Prosedur', 'Manual Mutu', 'Instruksi Kerja', 'Formulir Kerja',
  'Formulir Tambahan', 'BA Pemusnahan Rekaman', 'Pernyataan Kerahasiaan', 'Daftar Rekaman Mutu',
]);

type Plan = {
  rel: string;
  ext: string;
  data: Uint8Array;
  baseKode: string;
  judul: string;
  rawBase: string;
  bidangFolder: string;
  parentDir: string;
  prFolder: string;
  kode: string;
  bidang: string;
  jenis: string;
  version: { number: number; text: string };
  parentKode: string;
  sourceType: string;
  skip: string;
  warnings: string[];
  mode: 'create' | 'update';
  documentId: number | null;
  existingVersion: string;
  existingVersionNumber: number;
  sectionCount: number;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  error?: string;
};

function bidangFolderOf(relParts: string[]): string {
  for (const p of relParts) {
    if (/^0\.\s*MM/.test(p)) return 'MM';
    if (/^1\.\s*BMK/.test(p)) return 'BMK';
    if (/^2\.\s*BMA/.test(p)) return 'BMA';
    if (/^3\.\s*BST/.test(p)) return 'BST';
  }
  return '';
}

function bidangOf(relParts: string[]): string {
  switch (bidangFolderOf(relParts)) {
    case 'BMA': return 'Pengembangan Materi';
    case 'BST': return 'Pelayanan Sertifikasi';
    default: return 'Manajemen Mutu'; // MM & BMK
  }
}

function versionOf(fileName: string): { number: number; text: string } {
  const stem = fileName.replace(/\.[a-z0-9]+(?:\.[a-z0-9]+)?$/i, '');
  const m = stem.match(/REV[\s._-]*(\d{1,2})/i);
  const n = Math.min(99, Math.max(1, m ? parseInt(m[1], 10) : 1));
  return { number: n, text: `${n}.0` };
}

function buildPlan(entries: Unzipped): Plan[] {
  // Nama entri dinormalkan (zip lama kadang memakai backslash).
  const store = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith('/')) continue;
    store.set(name.replace(/\\/g, '/'), data);
  }

  const files = [...store.keys()]
    .filter(n => ALLOW_EXT.has(path.posix.extname(n).toLowerCase()))
    .filter(n => !SKIP_DIR.test(n))
    .filter(n => !path.posix.basename(n).startsWith('~$'))
    .sort((a, b) => a.localeCompare(b));

  const items: Plan[] = files.map(rel => {
    const parts = rel.split('/');
    const baseName = path.posix.basename(rel);
    const meta = parseFileName(baseName);
    const ext = path.posix.extname(rel).toLowerCase().replace('.', '');
    const parentDir = parts.slice(0, -1).join('/');
    return {
      rel,
      ext,
      data: store.get(rel)!,
      baseKode: meta.kode,
      judul: meta.judul || baseName.replace(path.posix.extname(baseName), ''),
      rawBase: meta.base,
      bidangFolder: bidangFolderOf(parts),
      parentDir,
      prFolder: parts.find(p => /^\d+\.\s*PR\./i.test(p) || /^PR\./i.test(p)) || '',
      kode: '',
      bidang: bidangOf(parts),
      jenis: '',
      version: versionOf(baseName),
      parentKode: '',
      sourceType: ['docx', 'pdf'].includes(ext) ? ext
        : ['xlsx', 'xls', 'csv'].includes(ext) ? 'xlsx' : 'unsupported',
      skip: '',
      warnings: [],
      mode: 'create',
      documentId: null,
      existingVersion: '1.0',
      existingVersionNumber: 1,
      sectionCount: 0,
      status: 'skipped',
    };
  });

  // ── 1a. kode untuk berkas tanpa kode ──
  const lampiran = items.filter(i => !i.baseKode && i.bidangFolder === 'MM' && /lampiran/i.test(i.parentDir));
  lampiran.sort((a, b) => {
    const na = Number((a.rawBase.match(/lampiran\s+(\d+)/i) || [])[1] || 0);
    const nb = Number((b.rawBase.match(/lampiran\s+(\d+)/i) || [])[1] || 0);
    return na - nb;
  });
  lampiran.forEach((i, n) => { i.kode = `MAN.MUTU.UPS.LAMP.${String(n + 1).padStart(2, '0')}-00`; });

  items.forEach((i, n) => {
    if (i.baseKode) i.kode = i.baseKode;
    else if (/^(?:manual\s+mutu|dokumen\s+mutu\s+smt)/i.test(i.rawBase)) i.kode = UPSERT_KODE;
    else if (!i.kode) i.kode = `DOC.UPS.${String(n + 1).padStart(3, '0')}-00`;
    i.kode = i.kode.slice(0, 80);
  });

  // ── 1b. tabrakan kode → pakai satu, sisanya dilewati ──
  const rank = (e: string) => (e === 'docx' ? 0 : e === 'pdf' ? 1 : 2);
  const byKode = new Map<string, Plan[]>();
  for (const i of items) {
    if (!byKode.has(i.kode)) byKode.set(i.kode, []);
    byKode.get(i.kode)!.push(i);
  }
  for (const [kode, group] of byKode) {
    if (group.length < 2) continue;
    group.sort((a, b) => rank(a.ext) - rank(b.ext));
    for (const dup of group.slice(1)) {
      dup.skip = `Kode "${kode}" juga dipakai oleh ${group[0].rel} — dilewati agar tidak ganda.`;
      dup.warnings.push(dup.skip);
    }
  }

  // ── 1c. jenis + induk ──
  for (const i of items) {
    if (i.skip) continue;
    const jenis = detectType({ fileName: path.posix.basename(i.rel), relPath: i.rel, kode: i.kode, judul: i.judul });
    i.jenis = JENIS_ENUM.has(jenis) ? jenis : 'Formulir Kerja';
  }

  const prChildren = new Map<string, string>();
  for (const i of items) {
    if (i.skip || !/^PR\./i.test(i.baseKode)) continue;
    if (!prChildren.has(i.parentDir) || i.ext === 'docx') prChildren.set(i.parentDir, i.kode);
  }
  for (const i of items) {
    if (i.skip) continue;
    const parts = i.rel.split('/');
    const idx = parts.findIndex(p => /^\d+\.\s*PR\./i.test(p) || /^PR\./i.test(p));
    if (idx < 0) continue;
    const folderRel = parts.slice(0, idx + 1).join('/');
    if (folderRel === i.parentDir) continue; // prosedur itu sendiri
    const parent = prChildren.get(folderRel) || '';
    i.parentKode = parent === i.kode ? '' : parent;
  }

  return items;
}

async function persistItem(
  plan: Plan,
  parsed: Awaited<ReturnType<typeof parseDocxBuffer>> | null,
  userId: number,
): Promise<void> {
  await withTransaction(async conn => {
    let id: number;
    // Versi tidak pernah mundur saat update; berkas REV.n → n.0
    const targetMajor = plan.mode === 'update'
      ? Math.max(plan.existingVersionNumber, plan.version.number)
      : plan.version.number;
    const versionText = plan.mode === 'update' && targetMajor === plan.existingVersionNumber
      ? plan.existingVersion
      : `${targetMajor}.0`;

    if (plan.mode === 'update' && plan.documentId) {
      id = plan.documentId;
      await conn.execute(
        `UPDATE documents
         SET judul = ?, bidang = ?, jenis = ?, current_version = ?, updated_at = NOW()
         WHERE id = ?`,
        [plan.judul.slice(0, 500), plan.bidang, plan.jenis, versionText, id],
      );
    } else {
      const [res] = await conn.execute(
        `INSERT INTO documents
           (kode, judul, bidang, jenis, siklus_review, status,
            current_version, version_number, penyusun_id,
            ack_total, ack_done, created_at, updated_at)
         VALUES (?, ?, ?, ?, '2 tahun', 'Aktif', ?, ?, ?, 0, 0, NOW(), NOW())`,
        [plan.kode, plan.judul.slice(0, 500), plan.bidang, plan.jenis,
          versionText, targetMajor, userId],
      );
      id = (res as { insertId: number }).insertId;
    }
    plan.documentId = id;

    const dir = path.join(MEDIA_ROOT, String(id));
    await fs.mkdir(dir, { recursive: true });
    for (const e of await fs.readdir(dir)) {
      if (/^\d{3}\.[a-z0-9]+$/i.test(e) || e === 'kop.html') await fs.rm(path.join(dir, e), { force: true });
    }

    let sections: Record<string, string> | null = null;
    let kopHtml: string | null = null;
    if (parsed) {
      const mat = await materializeParsedAssets(parsed, dir, `/uploads/media/${id}`);
      sections = mat.sections;
      kopHtml = mat.kopHtml;
      plan.sectionCount = Object.keys(sections).length - (sections._section_order ? 1 : 0);
    }

    let kopPath: string | null = null;
    if (kopHtml) {
      await fs.writeFile(path.join(dir, 'kop.html'), kopHtml, 'utf8');
      kopPath = `/uploads/media/${id}/kop.html`;
    }

    const sourcePath = `/uploads/media/${id}/source.${plan.ext}`;
    await fs.writeFile(path.join(dir, `source.${plan.ext}`), Buffer.from(plan.data));

    if (sections) {
      for (const [key, content] of Object.entries(sections)) {
        await conn.execute(
          `INSERT INTO document_sections (document_id, section_key, content)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE content = VALUES(content)`,
          [id, key, content],
        );
      }
    }

    await conn.execute(
      'UPDATE documents SET source_path = ?, source_name = ?, source_ext = ?, kop_path = ? WHERE id = ?',
      [sourcePath, path.posix.basename(plan.rel), plan.ext, kopPath, id],
    );
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!hasPermission(user.role, 'document:create')) return forbidden();

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Body permintaan tidak valid.' }, { status: 400 });

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Pilih berkas .zip hasil kompresi folder dokumen.' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.zip')) {
    return NextResponse.json({ error: 'Format berkas harus .zip.' }, { status: 400 });
  }
  if (file.size > MAX_ZIP_BYTES) {
    return NextResponse.json({ error: 'Ukuran zip melebihi batas 300 MB.' }, { status: 413 });
  }

  const wantSync = formData.get('sync') === '1';
  if (wantSync && user.role !== 'Admin Sistem') return forbidden();

  let entries: Unzipped;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: 'Berkas zip tidak dapat dibaca / rusak.' }, { status: 400 });
  }

  const items = buildPlan(entries);
  if (!items.length) {
    return NextResponse.json({
      error: 'Tidak ada berkas yang bisa diimpor. Pastikan zip berisi .docx/.pdf/.xlsx dan bukan hanya "Formulir Versi PDF".',
    }, { status: 422 });
  }
  if (items.length > MAX_FILES) {
    return NextResponse.json({ error: `Maksimal ${MAX_FILES} berkas per impor.` }, { status: 413 });
  }

  const existingRows = await query<Array<{
    id: number; kode: string; current_version: string; version_number: number;
  }>>('SELECT id, kode, current_version, version_number FROM documents');
  const existingByKode = new Map(existingRows.map(r => [r.kode, r]));
  for (const i of items) {
    const found = existingByKode.get(i.kode);
    if (found) {
      i.mode = 'update';
      i.documentId = found.id;
      i.existingVersion = found.current_version || '1.0';
      i.existingVersionNumber = Number(found.version_number) || 1;
    }
  }

  for (const i of items) {
    if (i.skip) { i.status = 'skipped'; continue; }
    try {
      let parsed: Awaited<ReturnType<typeof parseDocxBuffer>> | null = null;
      const ctx = { fileName: path.posix.basename(i.rel), relPath: i.rel };
      if (i.ext === 'docx') parsed = await parseDocxBuffer(Buffer.from(i.data), ctx);
      else if (i.ext === 'pdf') parsed = await parsePdfBuffer(Buffer.from(i.data), ctx);
      else i.warnings.push(`Format .${i.ext} tidak dikonversi ke teks — dokumen disimpan tanpa seksi.`);

      if (parsed?.judul) i.judul = parsed.judul;
      await persistItem(i, parsed, user.id);
      i.status = i.mode === 'update' ? 'updated' : 'created';
    } catch (err) {
      i.status = 'failed';
      i.error = (err as Error).message;
    }
  }

  // ── Pasang induk ──
  let parents = 0;
  const all = await query<Array<{ id: number; kode: string }>>('SELECT id, kode FROM documents');
  const idByKode = new Map(all.map(r => [r.kode, r.id]));
  for (const i of items) {
    if (!i.parentKode || !i.documentId) continue;
    const parentId = idByKode.get(i.parentKode);
    if (!parentId) {
      i.warnings.push(`Induk "${i.parentKode}" tidak ditemukan — parent_prosedur_id dikosongkan.`);
      continue;
    }
    await query('UPDATE documents SET parent_prosedur_id = ? WHERE id = ?', [parentId, i.documentId]);
    parents++;
  }

  // ── Mode sinkron: hapus kode yang tidak ada di zip ──
  let deleted = 0;
  if (wantSync) {
    const planKodes = new Set(items.filter(i => !i.skip).map(i => i.kode));
    const orphans = existingRows.filter(r => !planKodes.has(r.kode));
    for (const o of orphans) {
      await query('DELETE FROM documents WHERE id = ?', [o.id]);
      await fs.rm(path.join(MEDIA_ROOT, String(o.id)), { recursive: true, force: true });
      deleted++;
    }
  }

  const stats = {
    created: items.filter(i => i.status === 'created').length,
    updated: items.filter(i => i.status === 'updated').length,
    skipped: items.filter(i => i.status === 'skipped').length,
    failed: items.filter(i => i.status === 'failed').length,
    deleted,
    sections: items.reduce((s, i) => s + i.sectionCount, 0),
    parents,
  };

  await addAuditLog(user, 'CREATE', {
    note: `Impor massal "${file.name}": ${stats.created} dibuat, ${stats.updated} diperbarui, ${stats.skipped} dilewati, ${stats.failed} gagal, ${stats.deleted} dihapus (sinkron)`,
    ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({
    stats,
    items: items.map(i => ({
      rel: i.rel,
      kode: i.kode,
      judul: i.judul,
      jenis: i.jenis,
      bidang: i.bidang,
      version: i.version.text,
      mode: i.mode,
      status: i.status,
      documentId: i.documentId,
      sectionCount: i.sectionCount,
      error: i.error,
      warnings: i.warnings,
    })),
  });
}
