import path from 'path';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized } from '@/lib/auth';
import { query } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { generatePdf, PdfDocumentData } from '@/lib/pdf';

// POST /api/documents/[id]/pdf
// Generate PDF dan kembalikan URL file

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const docId = parseInt(id);

  // Ambil data dokumen + sections + refs + approvals
  const [docs, sections, refs, approvals] = await Promise.all([
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
       WHERE a.document_id = ? AND a.action = 'Approve'
       ORDER BY a.stage`, [docId]
    ),
  ]);

  if (!docs.length) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });

  const doc = docs[0];
  const sectionsMap: Record<string, string> = {};
  sections.forEach((s: any) => { sectionsMap[s.section_key] = s.content; });

  const mgrApproval     = approvals.find((a: any) => a.stage === 2);
  const pimpinanApproval= approvals.find((a: any) => a.stage === 3);

  // Build base URL for signature images
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Muat gambar tanda tangan ke base64 agar zero latency dan offline-safe di Puppeteer
  let mgrSignatureDataUrl: string | null = null;
  if (mgrApproval?.signature_path) {
    try {
      const cleanPath = mgrApproval.signature_path.replace(/^\//, '');
      const filePath = path.join(process.cwd(), 'public', cleanPath);
      const fileBuf = await fs.readFile(filePath);
      mgrSignatureDataUrl = `data:image/png;base64,${fileBuf.toString('base64')}`;
    } catch {
      mgrSignatureDataUrl = `${baseUrl}${mgrApproval.signature_path}`;
    }
  }

  let pimpinanSignatureDataUrl: string | null = null;
  if (pimpinanApproval?.signature_path) {
    try {
      const cleanPath = pimpinanApproval.signature_path.replace(/^\//, '');
      const filePath = path.join(process.cwd(), 'public', cleanPath);
      const fileBuf = await fs.readFile(filePath);
      pimpinanSignatureDataUrl = `data:image/png;base64,${fileBuf.toString('base64')}`;
    } catch {
      pimpinanSignatureDataUrl = `${baseUrl}${pimpinanApproval.signature_path}`;
    }
  }

  const pdfData: PdfDocumentData = {
    kode:     doc.kode,
    judul:    doc.judul,
    jenis:    doc.jenis,
    bidang:   doc.bidang,
    versi:    doc.current_version,
    status:   doc.status,
    updatedAt:doc.updated_at,
    sections: sectionsMap,
    refs,
    penyusun: doc.penyusun_name,
    mgrApprover:       mgrApproval?.actor_name ?? null,
    mgrSignature:      mgrSignatureDataUrl,
    pimpinanApprover:  pimpinanApproval?.actor_name ?? null,
    pimpinanSignature: pimpinanSignatureDataUrl,
  };

  try {
    const pdfUrl = await generatePdf(pdfData, docId);

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
