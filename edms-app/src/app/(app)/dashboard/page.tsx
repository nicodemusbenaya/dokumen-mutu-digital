import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import Link from 'next/link';

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

  const ACTION_ICONS: Record<string,string> = {
    CREATE:'📝',SUBMIT:'📤',REVIEW:'👁',APPROVE:'✅',
    REJECT:'↩',PUBLISH:'🎉',GENERATE:'🖨️',LOGIN:'🔐',LOGOUT:'🚪',UPDATE:'✏️',
  };

  return (
    <>
      <div className="page-title">Dashboard</div>
      <p className="page-sub">Selamat datang, <strong>{session?.fullName}</strong>. Ringkasan kondisi dokumen mutu unit.</p>

      {dbError && (
        <div style={{background:'#FEF3C7',border:'1.5px solid #F59E0B',borderRadius:'var(--r-md)',padding:'14px 18px',marginBottom:20,fontSize:13.5,color:'#92400E'}}>
          <strong>⚠️ Perhatian: Database MariaDB belum terhubung</strong> ({dbError}).<br />
          Pastikan service MariaDB aktif di port sesuai konfigurasi <code>.env.local</code> dan schema database telah diimport:
          <pre style={{background:'rgba(0,0,0,0.06)',padding:'8px 12px',borderRadius:6,marginTop:8,fontFamily:'monospace',fontSize:12}}>
mysql -u [user] -p edms_ups &lt; sql/001_schema.sql<br />
mysql -u [user] -p edms_ups &lt; sql/002_seed.sql
          </pre>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <Link href="/documents" className="stat-card" style={{textDecoration:'none',color:'inherit'}}>
          <div className="stat-icon">📄</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Dokumen</div>
          <div className="stat-accent" style={{background:'var(--navy)'}}></div>
        </Link>
        <Link href="/documents?status=Aktif" className="stat-card" style={{textDecoration:'none',color:'inherit'}}>
          <div className="stat-icon">✅</div>
          <div className="stat-value">{stats.aktif}</div>
          <div className="stat-label">Dokumen Aktif</div>
          <div className="stat-accent" style={{background:'var(--green)'}}></div>
        </Link>
        <Link href="/approval" className="stat-card" style={{textDecoration:'none',color:'inherit'}}>
          <div className="stat-icon">⏳</div>
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Menunggu Approval</div>
          <div className="stat-accent" style={{background:'var(--amber)'}}></div>
        </Link>
        <Link href="/documents?status=Draft" className="stat-card" style={{textDecoration:'none',color:'inherit'}}>
          <div className="stat-icon">📝</div>
          <div className="stat-value">{stats.draft}</div>
          <div className="stat-label">Masih Draft</div>
          <div className="stat-accent" style={{background:'var(--ink-muted)'}}></div>
        </Link>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 340px', gap:22}}>
        {/* Pending Actions */}
        <div>
          <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>⏰ Perlu Perhatian</div>
          {pendingDocs.length === 0 ? (
            <div className="card card-body" style={{textAlign:'center',color:'var(--ink-muted)',padding:40}}>
              <div style={{fontSize:40,marginBottom:10}}>🎉</div>
              Tidak ada dokumen yang menunggu tindakan
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {pendingDocs.map((d: any) => (
                <Link key={d.id} href={`/documents/${d.id}`} style={{textDecoration:'none'}}>
                  <div className="card card-hover" style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                    <div style={{width:10,height:10,borderRadius:'50%',background:d.status==='Review'?'var(--navy)':'var(--amber)',flexShrink:0}}></div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13}}>{d.kode}</div>
                      <div style={{fontSize:12,color:'var(--ink-soft)'}}>{d.judul}</div>
                    </div>
                    <span className={`badge badge-${d.status==='Aktif'?'aktif':d.status==='Review'?'review':d.status==='Menunggu Approval'?'approval':d.status==='Draft'?'draft':'obsolete'}`}>
                      {d.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity */}
        <div>
          <div className="card">
            <div className="card-body">
              <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>📋 Aktivitas Terbaru</div>
              <div style={{display:'flex',flexDirection:'column'}}>
                {recentLogs.map((log: any) => (
                  <div key={log.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--paper-line)'}}>
                    <div style={{width:30,height:30,borderRadius:6,background:'var(--paper)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>
                      {ACTION_ICONS[log.action_type] || '📋'}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:12}}>{log.user_name}</div>
                      <div style={{fontSize:11.5,color:'var(--ink-soft)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.note}</div>
                    </div>
                    <div style={{fontSize:10.5,color:'var(--ink-muted)',flexShrink:0}}>
                      {new Date(log.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short'})}
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
