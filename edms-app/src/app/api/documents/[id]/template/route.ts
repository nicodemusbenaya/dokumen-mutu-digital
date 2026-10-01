import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { query } from '@/lib/db';
import { addAuditLog } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';

type Params = { params: Promise<{ id: string }> };

// ─── POST /api/documents/[id]/template ─────────────────────────
// Tandai dokumen sebagai Template (is_template=1) — RENCANA §6.4.
// Tidak ada syarat status (Cabang #7); audit selalu dicatat (§11 S7).

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!hasPermission(user.role, 'template:set')) return forbidden();

  const docId = parseInt((await params).id);
  if (isNaN(docId)) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });

  const rows = await query<RowDataPacket[]>('SELECT id, kode, is_template FROM documents WHERE id = ?', [docId]);
  if (!rows.length) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });

  if (Number(rows[0].is_template) === 1) {
    return NextResponse.json({ message: 'Dokumen sudah berlabel template.' });
  }

  // updated_at = updated_at agar penandaan tidak mengubah timestamp register
  await query(
    'UPDATE documents SET is_template = 1, updated_at = updated_at WHERE id = ?',
    [docId]
  );

  await addAuditLog(user, 'UPDATE', {
    documentId: docId,
    docKode:    rows[0].kode,
    note:       'Ditandai sebagai Template Dokumen',
    ipAddress:  req.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({ message: 'Dokumen ditandai sebagai template.' });
}

// ─── DELETE /api/documents/[id]/template ───────────────────────
// Batalkan penandaan (dokumen TIDAK dihapus — hanya flag, §12.6).

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!hasPermission(user.role, 'template:set')) return forbidden();

  const docId = parseInt((await params).id);
  if (isNaN(docId)) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });

  const rows = await query<RowDataPacket[]>('SELECT id, kode, is_template FROM documents WHERE id = ?', [docId]);
  if (!rows.length) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });

  if (Number(rows[0].is_template) === 0) {
    return NextResponse.json({ message: 'Dokumen tidak dalam tanda template.' });
  }

  await query(
    'UPDATE documents SET is_template = 0, updated_at = updated_at WHERE id = ?',
    [docId]
  );

  await addAuditLog(user, 'UPDATE', {
    documentId: docId,
    docKode:    rows[0].kode,
    note:       'Tanda Template dihapus — dokumen kembali ke Daftar Dokumen',
    ipAddress:  req.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({ message: 'Tanda template dihapus.' });
}
