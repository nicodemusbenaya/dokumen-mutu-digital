import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { query } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { createDocumentFromTemplate, TemplateCopyError } from '@/lib/templateCopy';

// ─── POST /api/documents/from-template ─────────────────────────
// Buat dokumen Draft baru dari template (RENCANA §8).
// Body: { templateId, kode, judul, bidang? }

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!hasPermission(user.role, 'document:create')) return forbidden();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 });
  }
  const body = (raw ?? {}) as Partial<{
    templateId: unknown;
    kode: unknown;
    judul: unknown;
    bidang: unknown;
  }>;

  const templateId = parseInt(String(body.templateId ?? ''));
  const kode       = String(body.kode ?? '').trim();
  const judul      = String(body.judul ?? '').trim();
  const bidang     = body.bidang ? String(body.bidang).trim() : undefined;

  if (isNaN(templateId) || !templateId) {
    return NextResponse.json({ error: 'Template wajib dipilih.' }, { status: 400 });
  }
  if (!kode || !judul) {
    return NextResponse.json({ error: 'Kode dan judul wajib diisi.' }, { status: 400 });
  }

  // Validasi kode unik di awal (R3) — pesan jelas sebelum proses copy
  const dup = await query<RowDataPacket[]>('SELECT id FROM documents WHERE kode = ?', [kode]);
  if (dup.length) {
    return NextResponse.json(
      { error: `Kode dokumen "${kode}" sudah digunakan. Silakan gunakan kode lain.` },
      { status: 409 }
    );
  }

  try {
    const newId = await createDocumentFromTemplate({
      templateId, kode, judul, bidang, userId: user.id,
    });

    const tpl = await query<RowDataPacket[]>('SELECT kode FROM documents WHERE id = ?', [templateId]);
    await addAuditLog(user, 'CREATE', {
      documentId: newId,
      docKode:    kode,
      note:       `Dokumen baru dibuat dari template ${tpl[0]?.kode ?? templateId}`,
      ipAddress:  req.headers.get('x-forwarded-for') ?? undefined,
    });

    return NextResponse.json(
      { data: { id: newId }, message: 'Dokumen berhasil dibuat dari template.' },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof TemplateCopyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal membuat dokumen dari template.' },
      { status: 500 }
    );
  }
}
