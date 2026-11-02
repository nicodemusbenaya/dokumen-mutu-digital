import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { parseDocxBuffer, parsePdfBuffer, materializeParsedAssets } from '@/lib/docParser';
import { canEditDocument, hasPermission } from '@/lib/rbac';
import { query } from '@/lib/db';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!hasPermission(user.role, 'document:create')) return forbidden();

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Berkas tidak ditemukan. Harap sertakan file Word (.docx) atau PDF.' },
        { status: 400 }
      );
    }
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Ukuran berkas maksimal 20 MB.' }, { status: 413 });
    const documentIdInput = formData.get('documentId');
    const documentId = documentIdInput === null ? null : Number(documentIdInput);
    if (documentId !== null) {
      if (!Number.isSafeInteger(documentId) || documentId < 1) return NextResponse.json({ error: 'ID dokumen tidak valid.' }, { status: 400 });
      const docs = await query<Array<{ status: string; penyusun_id: number }>>('SELECT status, penyusun_id FROM documents WHERE id = ?', [documentId]);
      if (!docs.length) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
      if (!canEditDocument(user.role, docs[0].status, docs[0].penyusun_id, user.id)) return forbidden();
    }

    const fileName = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!fileName.endsWith('.docx') && !fileName.endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Format berkas tidak didukung. Harap unggah berkas Microsoft Word (.docx) atau dokumen PDF (.pdf).' },
        { status: 400 }
      );
    }
    const ctx = { fileName: file.name };
    const parsed = fileName.endsWith('.docx') ? await parseDocxBuffer(buffer, ctx) : await parsePdfBuffer(buffer, ctx);
    // Preview images must have real URLs before they enter TipTap. Buffers and
    // @@IMG placeholders are not usable in the browser or saved document.
    const importDir = `import-${randomUUID()}`;
    const mediaOwner = documentId === null ? `drafts/${user.id}` : String(documentId);
    const materialized = await materializeParsedAssets(parsed,
      path.join(process.cwd(), 'storage', 'media', mediaOwner, importDir),
      `/uploads/media/${mediaOwner}/${importDir}`);
    return NextResponse.json({ success: true, data: {
      ...parsed, assets: undefined, ...materialized, fileName: file.name,
      sectionCount: Object.keys(parsed.sections).filter(key => key !== '_section_order').length,
    } });
  } catch (err: any) {
    console.error('Error importing document:', err);
    return NextResponse.json(
      { error: `Gagal membaca isi dokumen: ${err.message || 'Terjadi kesalahan sistem'}` },
      { status: 500 }
    );
  }
}
