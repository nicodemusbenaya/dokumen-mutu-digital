import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import Link from 'next/link';
import {
  IconDocuments,
  IconCheckCircle,
  IconClock,
  IconFileText,
  IconApproval,
  IconEditor,
  IconAudit,
  IconActivity,
} from '@/components/icons/Icons';

export const metadata = { title: 'Dashboard — EDMS PLN UPS' };

const ACTIVITY_ICONS: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  CREATE:    { icon: <IconFileText size={14} />,    color: '#0284C7', bg: '#E0F2FE' },
  UPDATE:    { icon: <IconEditor size={14} />,      color: '#D97706', bg: '#FEF3C7' },
  APPROVE:   { icon: <IconApproval size={14} />,    color: '#16A34A', bg: '#DCFCE7' },
  SUBMIT:    { icon: <IconActivity size={14} />,    color: '#7C3AED', bg: '#EDE9FE' },
  GENERATE:  { icon: <IconDocuments size={14} />,   color: '#0284C7', bg: '#E0F2FE' },
  DEFAULT:   { icon: <IconAudit size={14} />,       color: '#64748B', bg: '#F1F5F9' },
};

function getActivityIcon(actionType: string) {
  const key = (actionType || '').toUpperCase();
  if (key.includes('APPROVE')) return ACTIVITY_ICONS.APPROVE;
  if (key.includes('CREATE'))  return ACTIVITY_ICONS.CREATE;
  if (key.includes('UPDATE'))  return ACTIVITY_ICONS.UPDATE;
  if (key.includes('SUBMIT'))  return ACTIVITY_ICONS.SUBMIT;
  if (key.includes('GENERATE')) return ACTIVITY_ICONS.GENERATE;
  return ACTIVITY_ICONS.DEFAULT;
}

export default async function DashboardPage() {
  const session = await getSession();

  let statsRows: any[] = [];
  let pendingDocs: any[] = [];
  let recentLogs: any[] = [];
  let dbError: string | null = null;

  try {
    [statsRows, pendingDocs, recentLogs] = await Promise.all([
      query<any[]>(`
        SELECT
          COUNT(*) AS total,
          SUM(status='Aktif') AS aktif,
          SUM(status='Draft') AS draft,
          SUM(status IN ('Review','Menunggu Approval')) AS pending
        FROM documents
      `),
      query<any[]>(`
        SELECT d.id, d.kode, d.judul, d.status, d.bidang, d.updated_at
        FROM documents d
        WHERE d.status IN ('Review','Menunggu Approval')
        ORDER BY d.updated_at DESC
        LIMIT 10
      `),
      query<any[]>(`
        SELECT l.*, d.kode AS doc_kode2
        FROM audit_logs l
        LEFT JOIN documents d ON d.id = l.document_id
        ORDER BY l.created_at DESC
        LIMIT 8
      `),
    ]);
  } catch (err: any) {
    dbError = err.message || 'Koneksi ke MariaDB gagal';
  }

  const stats = statsRows[0] ?? { total: 0, aktif: 0, draft: 0, pending: 0 };

  return (
    <>
      <div className="page-title">Dashboard Mutu</div>
      <p className="page-sub">
        Selamat datang, <strong>{session?.fullName}</strong>. Ringkasan kondisi dokumen mutu terkendali unit.
      </p>

      {dbError && (
        <div style={{
          background: '#FEF3C7',
          border: '1px solid #F59E0B',
          borderRadius: 'var(--r-md)',
          padding: '14px 18px',
          marginBottom: 20,
          fontSize: 13,
          color: '#92400E'
        }}>
          <strong>Perhatian: Database MariaDB belum terhubung</strong> ({dbError}).<br />
          Pastikan service MariaDB aktif di port sesuai konfigurasi <code>.env.local</code>.
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <Link href="/documents" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-head">
            <div className="stat-icon" style={{ background: '#E0F2FE', color: 'var(--pln-blue)' }}>
              <IconDocuments size={20} />
            </div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Dokumen Mutu</div>
          </div>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--pln-blue)', opacity: 0.6 }} />
        </Link>

        <Link href="/documents?status=Aktif" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-head">
            <div className="stat-icon" style={{ background: '#DCFCE7', color: 'var(--green)' }}>
              <IconCheckCircle size={20} />
            </div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{stats.aktif}</div>
            <div className="stat-label">Dokumen Berstatus Aktif</div>
          </div>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--green)', opacity: 0.6 }} />
        </Link>

        <Link href="/approval" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-head">
            <div className="stat-icon" style={{ background: '#FEF3C7', color: 'var(--amber)' }}>
              <IconClock size={20} />
            </div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Menunggu Review / Approval</div>
          </div>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--amber)', opacity: 0.6 }} />
        </Link>

        <Link href="/documents?status=Draft" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-head">
            <div className="stat-icon" style={{ background: '#F1F5F9', color: 'var(--ink-soft)' }}>
              <IconEditor size={20} />
            </div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{stats.draft}</div>
            <div className="stat-label">Draft Dokumen Mutu</div>
          </div>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--ink-soft)', opacity: 0.4 }} />
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 22 }}>
        {/* Pending Actions */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconClock size={17} style={{ color: 'var(--amber)' }} />
            <span>Dokumen Perlu Tindakan</span>
          </div>

          {pendingDocs.length === 0 ? (
            <div className="card card-body" style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: '48px 24px' }}>
              <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', background: 'var(--green-soft)', color: 'var(--green)', marginBottom: 10 }}>
                <IconCheckCircle size={28} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-mid)' }}>Semua Dokumen Telah Diproses</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>Tidak ada dokumen yang menunggu tindakan saat ini.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingDocs.map((d: any) => (
                <Link key={d.id} href={`/documents/${d.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card card-hover" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: d.status === 'Review' ? 'var(--amber)' : 'var(--pln-blue)',
                      flexShrink: 0
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--ink)' }}>{d.kode}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.judul}
                      </div>
                    </div>
                    <span className={`badge badge-${d.status === 'Aktif' ? 'aktif' : d.status === 'Review' ? 'review' : d.status === 'Menunggu Approval' ? 'approval' : 'draft'}`}>
                      {d.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div>
          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconActivity size={17} style={{ color: 'var(--pln-blue)' }} />
                <span>Aktivitas Dokumen Terbaru</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentLogs.map((log: any) => {
                  const activityStyle = getActivityIcon(log.action_type);
                  return (
                    <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--paper-line)' }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: activityStyle.bg,
                        border: `1px solid ${activityStyle.color}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: activityStyle.color,
                        flexShrink: 0,
                        marginTop: 2
                      }}>
                        {activityStyle.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)' }}>{log.user_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.note}
                        </div>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
