import path from 'path';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { query } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { canEditDocument } from '@/lib/rbac';

type Params = { params: Promise<{ id: string }> };

interface SourceRow {
  source_path: string | null;
  source_name: string | null;
  source_ext: string | null;
}

interface DocSourceRow {
  status: string;
  penyusun_id: number;
  kode: string;
  source_path: string | null;
}

function errMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Gagal menyimpan berkas sumber.';
}

// Berkas sumber hasil impor (docx/pdf/xlsx/…) disimpan sebagai file fisik
// di storage/media/{docId}/source{ext} — bukan blob di database (Bab 9.5).

const MIME_BY_EXT: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  rtf: 'application/rtf',
  odt: 'application/vnd.oasis.opendocument.text',
};

const ALLOWED_EXT = Object.keys(MIME_BY_EXT);

const mediaDir = (docId: number) => path.join(process.cwd(), 'storage', 'media', String(docId));
const sourceRelUrl = (docId: number, ext: string) => `/uploads/media/${docId}/source.${ext}`;

/** Source path (URL /uploads/…) → path fisik lokal. */
function resolveSourcePath(srcPath: string): string | null {
  const clean = srcPath.replace(/^\/+/, '');
  const rel = clean.replace(/^uploads\//, '');
  return path.join(process.cwd(), 'storage', rel);
}

function attachmentHeaders(name: string, mime: string): HeadersInit {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return {
    'Content-Type': mime,
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Cache-Control': 'no-store',
  };
}

// ─── GET /api/documents/[id]/source ─── Unduh berkas sumber asli

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const docId = parseInt(id);
  if (isNaN(docId)) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });

  const rows = await query<SourceRow[]>(
    'SELECT source_path, source_name, source_ext FROM documents WHERE id = ?', [docId]
  );
  if (!rows.length) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });

  const { source_path, source_name, source_ext } = rows[0];
  if (!source_path) {
    return NextResponse.json({ error: 'Dokumen ini tidak memiliki berkas sumber.' }, { status: 404 });
  }

  const abs = resolveSourcePath(source_path);
  if (!abs) return NextResponse.json({ error: 'Path berkas sumber tidak valid.' }, { status: 400 });

  try {
    const buf = await fs.readFile(abs);
    const ext = (source_ext || path.extname(abs).replace('.', '')).toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
    const name = source_name || `source.${ext}`;
    return new NextResponse(new Uint8Array(buf), { headers: attachmentHeaders(name, mime) });
  } catch {
    return NextResponse.json(
      { error: 'File sumber tidak ditemukan di storage. Mungkin belum pernah diunggah.' },
      { status: 404 }
    );
  }
}

// ─── PUT /api/documents/[id]/source ─── Ganti berkas sumber

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const docId = parseInt(id);
  if (isNaN(docId)) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });

  const rows = await query<DocSourceRow[]>(
    'SELECT status, penyusun_id, kode, source_path FROM documents WHERE id = ?', [docId]
  );
  if (!rows.length) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
  const doc = rows[0];

  if (!canEditDocument(user.role, doc.status, doc.penyusun_id, user.id)) return forbidden();

  let file: File | null = null;
  try {
    const formData = await req.formData();
    file = formData.get('file') as File | null;
  } catch {
    /* body bukan multipart */
  }
  if (!file) {
    return NextResponse.json({ error: 'Berkas tidak ditemukan pada unggahan.' }, { status: 400 });
  }

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json(
      { error: `Format .${ext || '?'} tidak didukung. Format: ${ALLOWED_EXT.join(', ').toUpperCase()}.` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length) return NextResponse.json({ error: 'Berkas kosong.' }, { status: 400 });
  if (buffer.length > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'Berkas melebihi batas 25 MB.' }, { status: 413 });
  }

  try {
    const dir = mediaDir(docId);
    await fs.mkdir(dir, { recursive: true });
    const abs = path.join(dir, `source.${ext}`);
    await fs.writeFile(abs, buffer);

    // Bersihkan source.* lama dengan ekstensi berbeda (jangan meninggalkan duplikat).
    const entries = await fs.readdir(dir).catch(() => [] as string[]);
    for (const e of entries) {
      const m = /^source\.([a-z0-9]+)$/i.exec(e);
      if (m && m[1].toLowerCase() !== ext) {
        await fs.unlink(path.join(dir, e)).catch(() => {});
      }
    }

    await query(
      `UPDATE documents
       SET source_path = ?, source_name = ?, source_ext = ?, updated_at = NOW()
       WHERE id = ?`,
      [sourceRelUrl(docId, ext), file.name, ext, docId]
    );

    await addAuditLog(user, 'UPDATE', {
      documentId: docId,
      docKode: doc.kode,
      note: `Berkas sumber diganti: ${file.name}`,
    });

    return NextResponse.json({
      data: { sourcePath: sourceRelUrl(docId, ext), sourceName: file.name, sourceExt: ext },
      message: 'Berkas sumber berhasil diganti.',
    });
  } catch (err) {
    console.error('[Source Upload Error]', err);
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
