import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import Link from 'next/link';
import {
  IconDocuments,
  IconCheck,
  IconApproval,
  IconEditor,
  IconAudit,
} from '@/components/icons/Icons';

export const metadata = { title: 'Dashboard — EDMS PLN UPS' };

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
          <div className="stat-icon" style={{ color: 'var(--pln-blue)' }}>
            <IconDocuments size={24} />
          </div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Dokumen Mutu</div>
          <div className="stat-accent" style={{ background: 'var(--pln-blue)' }} />
        </Link>

        <Link href="/documents?status=Aktif" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-icon" style={{ color: 'var(--green)' }}>
            <IconCheck size={24} />
          </div>
          <div className="stat-value">{stats.aktif}</div>
          <div className="stat-label">Dokumen Berstatus Aktif</div>
          <div className="stat-accent" style={{ background: 'var(--green)' }} />
        </Link>

        <Link href="/approval" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-icon" style={{ color: 'var(--amber)' }}>
            <IconApproval size={24} />
          </div>
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Menunggu Review / Approval</div>
          <div className="stat-accent" style={{ background: 'var(--amber)' }} />
        </Link>

        <Link href="/documents?status=Draft" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-icon" style={{ color: 'var(--ink-soft)' }}>
            <IconEditor size={24} />
          </div>
          <div className="stat-value">{stats.draft}</div>
          <div className="stat-label">Draft Dokumen Mutu</div>
          <div className="stat-accent" style={{ background: 'var(--paper-line-dark)' }} />
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 22 }}>
        {/* Pending Actions */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconApproval size={17} style={{ color: 'var(--amber)' }} />
            <span>Dokumen Perlu Tindakan</span>
          </div>

          {pendingDocs.length === 0 ? (
            <div className="card card-body" style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: '48px 24px' }}>
              <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', background: 'var(--green-soft)', color: 'var(--green)', marginBottom: 10 }}>
                <IconCheck size={28} />
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
                <IconAudit size={17} style={{ color: 'var(--pln-blue)' }} />
                <span>Aktivitas Dokumen Terbaru</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentLogs.map((log: any) => (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--paper-line)' }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'var(--paper)',
                      border: '1px solid var(--paper-line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--pln-blue)',
                      flexShrink: 0,
                      marginTop: 2
                    }}>
                      <IconAudit size={14} />
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
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
