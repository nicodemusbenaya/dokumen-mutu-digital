// ─────────────────────────────────────────────────────────────────
//  Approval Cycle — penentuan siklus approval yang sedang berjalan
//
//  Selaras dengan logika "jendela approval" di
//  src/app/api/documents/[id]/approve/route.ts:
//  hanya approval SETELAH pengesahan final (stage 3) terakhir
//  ATAU reject terakhir yang dihitung. Approval sintetis hasil
//  import (stage 2 & 3 langsung dibuat saat import) serta baris
//  siklus revisi lama diabaikan agar UI tidak menganggap tahap
//  sudah disetujui padahal belum pada siklus berjalan.
// ─────────────────────────────────────────────────────────────────

import type { Approval } from '@/types';

type MinimalApproval = Pick<Approval, 'id' | 'stage' | 'action'>;

/**
 * Saring approval yang termasuk siklus yang relevan dengan status dokumen:
 * - Draft / Review / Menunggu Approval → siklus berjalan
 *   (baris SETELAH penutup siklus terakhir)
 * - Aktif / Obsolete → siklus yang ditutup pengesahan final terakhir
 *   (baris SETELAH penutup siklus sebelumnya, s.d. pengesahan final)
 * - Dokumen tanpa pengesahan final/reject sama sekali (data legacy)
 *   → seluruh baris dianggap satu siklus.
 */
export function getApprovalCycle<T extends MinimalApproval>(approvals: T[], status: string): T[] {
  if (!Array.isArray(approvals) || approvals.length === 0) return [];

  const boundaries = approvals
    .filter(a => (a.stage === 3 && a.action === 'Approve') || a.action === 'Reject')
    .map(a => a.id);

  const windowId = boundaries.length ? Math.max(...boundaries) : 0;
  const published = status === 'Aktif' || status === 'Obsolete';
  const hasWindow = published && windowId > 0;

  const ceil  = hasWindow ? windowId : Number.POSITIVE_INFINITY;
  const floor = hasWindow
    ? boundaries.filter(id => id < windowId).reduce((m, id) => Math.max(m, id), 0)
    : windowId;

  return approvals.filter(a => a.id > floor && a.id <= ceil);
}

/**
 * Approval "Approve" terbaru untuk stage tertentu dalam siklus yang relevan.
 * Mengembalikan undefined bila tahap tersebut belum disetujui pada siklus ini.
 */
export function findCycleApproval<T extends MinimalApproval>(
  approvals: T[],
  stage: number,
  status: string
): T | undefined {
  let best: T | undefined;
  for (const a of getApprovalCycle(approvals, status)) {
    if (a.stage === stage && a.action === 'Approve' && (!best || a.id > best.id)) {
      best = a;
    }
  }
  return best;
}
