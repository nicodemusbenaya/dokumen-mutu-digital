import { query } from './db';
import { SessionUser } from './auth';

// ─────────────────────────────────────────────────────────────────
//  Audit Log Writer — INSERT only, tidak ada UPDATE/DELETE
//  Semua mutasi data penting harus memanggil addAuditLog()
// ─────────────────────────────────────────────────────────────────

export type ActionType =
  | 'LOGIN' | 'LOGOUT'
  | 'CREATE' | 'SUBMIT'
  | 'REVIEW' | 'APPROVE' | 'REJECT'
  | 'PUBLISH'
  | 'GENERATE'
  | 'UPDATE';

export async function addAuditLog(
  user: SessionUser | { id: number; fullName: string },
  actionType: ActionType,
  options: {
    documentId?: number;
    docKode?:    string;
    note?:       string;
    ipAddress?:  string;
  } = {}
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs
         (user_id, user_name, action_type, document_id, doc_kode, note, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        (user as SessionUser).fullName ?? '',
        actionType,
        options.documentId ?? null,
        options.docKode    ?? null,
        options.note       ?? null,
        options.ipAddress  ?? null,
      ]
    );
  } catch (err) {
    // Audit log gagal tidak boleh crash aplikasi utama
    console.error('[AuditLog] Failed to write log:', err);
  }
}
