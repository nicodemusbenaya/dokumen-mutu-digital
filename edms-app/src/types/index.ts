// ─────────────────────────────────────────────────────────────────
//  Shared TypeScript types for EDMS
// ─────────────────────────────────────────────────────────────────

export type DocumentStatus = 'Draft' | 'Review' | 'Menunggu Approval' | 'Aktif' | 'Obsolete';
export type DocumentJenis  = 
  | 'SOP/Prosedur' 
  | 'Manual Mutu' 
  | 'Instruksi Kerja' 
  | 'Formulir Standar (FR.01.04)'
  | 'Berita Acara Pemusnahan (FR.01.05)'
  | 'Pernyataan Kerahasiaan (FR.01.06)'
  | 'Daftar Rekaman Mutu (FR.01.07)'
  | 'Formulir Kerja' 
  | 'Formulir Tambahan'
  | 'BA Pemusnahan Rekaman';
export type RefKategori    = 'Regulasi' | 'Standar' | 'Internal';
export type ApprovalStage  = 1 | 2 | 3; // 1=Tim Mutu, 2=Manager, 3=Pimpinan

export interface User {
  id:       number;
  username: string;
  fullName: string;
  email:    string | null;
  role:     string;
  bidang:   string | null;
  isActive: boolean;
}

export interface Document {
  id:             number;
  kode:           string;
  judul:          string;
  bidang:         string;
  jenis:          DocumentJenis;
  siklusReview:   string;
  status:         DocumentStatus;
  currentVersion: string;
  versionNumber:  number;
  penyusunId:     number;
  penyusunName?:  string;
  auditRef:       string | null;
  ackTotal:       number;
  ackDone:        number;
  createdAt:      string;
  updatedAt:      string;
}

export interface DocumentDetail extends Document {
  sections:  Record<string, string>; // key = section_key, value = HTML content
  refs:      Reference[];
  approvals: Approval[];
  versions:  DocumentVersion[];
}

export interface DocumentSection {
  id:         number;
  documentId: number;
  sectionKey: string;
  content:    string;
  updatedAt:  string;
}

export interface DocumentVersion {
  id:          number;
  documentId:  number;
  version:     string;
  status:      string;
  deskripsi:   string | null;
  archivedAt:  string;
  archivedBy:  number | null;
}

export interface Reference {
  id:        number;
  kategori:  RefKategori;
  nomor:     string;
  judul:     string;
  deskripsi: string | null;
  isActive:  boolean;
  createdBy: number;
  usageCount?: number;
}

export interface Approval {
  id:            number;
  documentId:    number;
  stage:         ApprovalStage;
  action:        'Approve' | 'Reject';
  actorId:       number;
  actorName?:    string;
  note:          string | null;
  signaturePath: string | null;
  docVersion:    string;
  createdAt:     string;
}

export interface AuditLog {
  id:         number;
  userId:     number | null;
  userName:   string;
  actionType: string;
  documentId: number | null;
  docKode:    string | null;
  note:       string | null;
  ipAddress:  string | null;
  createdAt:  string;
}

// ─── API Response wrappers ────────────────────────────────────

export interface ApiSuccess<T> {
  data:    T;
  message?: string;
}

export interface ApiError {
  error:   string;
  details?: string;
}

// ─── Workflow stage helper ────────────────────────────────────

export function statusToStage(status: DocumentStatus): number {
  const map: Record<DocumentStatus, number> = {
    'Draft':              0,
    'Review':             1,
    'Menunggu Approval':  2, // bisa stage 2 atau 3
    'Aktif':              4,
    'Obsolete':           5,
  };
  return map[status] ?? 0;
}

export function getWorkflowStage(approvals: Approval[]): number {
  const done = approvals.filter(a => a.action === 'Approve').map(a => a.stage);
  if (done.includes(3)) return 4;
  if (done.includes(2)) return 3;
  if (done.includes(1)) return 2;
  return 1;
}
