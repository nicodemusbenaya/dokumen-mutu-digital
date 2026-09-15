// ─────────────────────────────────────────────────────────────────
//  RBAC — Role-Based Access Control
//  Mendefinisikan permission matrix untuk semua role
// ─────────────────────────────────────────────────────────────────

export type Role =
  | 'Penyusun Dokumen'
  | 'Tim Mutu'
  | 'Manager Bidang'
  | 'Pimpinan Unit'
  | 'Admin Sistem';

export type Permission =
  | 'document:create'       // Buat dokumen baru
  | 'document:edit'         // Edit draft dokumen
  | 'document:submit'       // Ajukan ke review
  | 'document:review'       // Review (Tim Mutu)
  | 'document:approve:mgr'  // Approve Manager Bidang
  | 'document:approve:pimpinan' // Approve Pimpinan Unit
  | 'document:read'         // Baca dokumen aktif
  | 'document:generate_pdf' // Generate PDF
  | 'reference:create'      // Tambah master referensi
  | 'reference:delete'      // Hapus master referensi
  | 'audit:read'            // Baca audit log
  | 'user:manage';          // Kelola user (admin only)

const PERMISSIONS: Record<Role, Permission[]> = {
  'Penyusun Dokumen': [
    'document:create', 'document:edit', 'document:submit',
    'document:read', 'document:generate_pdf',
    'audit:read',
  ],
  'Tim Mutu': [
    'document:review', 'document:read', 'document:generate_pdf',
    'audit:read',
  ],
  'Manager Bidang': [
    'document:approve:mgr', 'document:read', 'document:generate_pdf',
    'audit:read',
  ],
  'Pimpinan Unit': [
    'document:approve:pimpinan', 'document:read', 'document:generate_pdf',
    'audit:read',
  ],
  'Admin Sistem': [
    'document:create', 'document:edit', 'document:submit',
    'document:review', 'document:approve:mgr', 'document:approve:pimpinan',
    'document:read', 'document:generate_pdf',
    'reference:create', 'reference:delete',
    'audit:read', 'user:manage',
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = PERMISSIONS[role as Role];
  if (!perms) return false;
  return perms.includes(permission);
}

export function canEditDocument(role: string, docStatus: string, docPenyusunId: number, userId: number): boolean {
  // Admin bisa edit apapun
  if (role === 'Admin Sistem') return true;
  // Penyusun hanya bisa edit dokumennya sendiri dan hanya saat Draft
  if (role === 'Penyusun Dokumen') {
    return docStatus === 'Draft' && docPenyusunId === userId;
  }
  return false;
}

export function canApprove(role: string, workflowStage: number): boolean {
  if (role === 'Tim Mutu'      && workflowStage === 1) return true;
  if (role === 'Manager Bidang' && workflowStage === 2) return true;
  if (role === 'Pimpinan Unit'  && workflowStage === 3) return true;
  if (role === 'Admin Sistem') return workflowStage >= 1 && workflowStage <= 3;
  return false;
}
