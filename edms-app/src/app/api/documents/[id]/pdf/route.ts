import path from 'path';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized } from '@/lib/auth';
import { query } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { generatePdf, PdfDocumentData } from '@/lib/pdf';
import { findCycleApproval } from '@/lib/approvalCycle';

// POST /api/documents/[id]/pdf
// Generate PDF dan kembalikan URL file

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const docId = parseInt(id);

  // Ambil data dokumen + sections + refs + approvals + versions
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
      `SELECT r.kategori, r.nomor, r.judul
       FROM document_references dr JOIN \`references\` r ON r.id = dr.reference_id
       WHERE dr.document_id = ?`, [docId]
    ),
    query<any[]>(
      `SELECT a.*, u.full_name AS actor_name
       FROM approvals a JOIN users u ON u.id = a.actor_id
       WHERE a.document_id = ?
       ORDER BY a.id`, [docId]
    ),
    query<any[]>(
      'SELECT * FROM document_versions WHERE document_id = ? ORDER BY id ASC', [docId]
    ),
  ]);

  if (!docs.length) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });

  const doc = docs[0];
  const sectionsMap: Record<string, string> = {};
  sections.forEach((s: any) => { sectionsMap[s.section_key] = s.content; });

  // Pilih approval milik siklus berjalan (baris terbaru setelah pengesahan final /
  // reject terakhir) — bukan approval sintetis hasil import atau siklus lama.
  const mgrApproval     = findCycleApproval(approvals, 2, doc.status);
  const pimpinanApproval= findCycleApproval(approvals, 3, doc.status);

  // Muat gambar tanda tangan ke base64 agar zero latency dan offline-safe di Puppeteer.
  // Cek storage/ (persisten via volume) dulu, lalu public/uploads (legacy). Jika tidak
  // ada → null (tanpa fallback HTTP localhost yang menyebabkan stall 8 detik).
  const loadSignatureDataUrl = async (sigPath: string | null): Promise<string | null> => {
    if (!sigPath) return null;
    const clean = sigPath.replace(/^\//, ''); // uploads/signatures/x.png
    const candidates = [
      path.join(process.cwd(), 'storage', clean.replace(/^uploads\//, '')), // storage/signatures/x.png
      path.join(process.cwd(), 'public', clean),                            // public/uploads/signatures/x.png (legacy)
    ];
    for (const p of candidates) {
      try {
        const buf = await fs.readFile(p);
        if (buf.length > 200) return `data:image/png;base64,${buf.toString('base64')}`;
      } catch { /* coba kandidat berikutnya */ }
    }
    console.warn(`[PDF] Signature file tidak ditemukan/terlalu kecil: ${sigPath}`);
    return null;
  };

  const mgrSignatureDataUrl      = await loadSignatureDataUrl(mgrApproval?.signature_path ?? null);
  const pimpinanSignatureDataUrl = await loadSignatureDataUrl(pimpinanApproval?.signature_path ?? null);

  const pdfData: PdfDocumentData = {
    kode:     doc.kode,
    judul:    doc.judul,
    jenis:    doc.jenis,
    bidang:   doc.bidang,
    versi:    doc.current_version,
    status:   doc.status,
    kopPath:  doc.kop_path ?? null,
    createdAt:doc.created_at,
    updatedAt:doc.updated_at,
    sections: sectionsMap,
    refs,
    versions: versions || [],
    penyusun: doc.penyusun_name,
    mgrApprover:       mgrApproval?.actor_name ?? null,
    mgrSignature:      mgrSignatureDataUrl,
    pimpinanApprover:  pimpinanApproval?.actor_name ?? null,
    pimpinanSignature: pimpinanSignatureDataUrl,
  };

  try {
    const pdfUrl = await generatePdf(pdfData);

    await addAuditLog(user, 'GENERATE', {
      documentId: docId,
      docKode:    doc.kode,
      note:       `Generate PDF v${doc.current_version}`,
    });

    return NextResponse.json({ data: { url: pdfUrl }, message: 'PDF berhasil dibuat.' });
  } catch (err: any) {
    console.error('[PDF Generation Error]', err);
    return NextResponse.json(
      { error: `Gagal generate PDF: ${err?.message || 'Pastikan Chromium/Chrome tersedia di server.'}` },
      { status: 500 }
    );
  }
}
