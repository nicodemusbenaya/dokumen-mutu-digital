'use client';

import { useState, useEffect, useCallback } from 'react';

const ACTION_TYPES = ['','CREATE','SUBMIT','REVIEW','APPROVE','REJECT','PUBLISH','GENERATE','LOGIN','LOGOUT','UPDATE'];

export default function AuditPage() {
  const [logs,   setLogs]   = useState<any[]>([]);
  const [total,  setTotal]  = useState(0);
  const [loading,setLoading]= useState(true);
  const [q,      setQ]      = useState('');
  const [type,   setType]   = useState('');
  const [page,   setPage]   = useState(1);
  const LIMIT = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q)    params.set('q',    q);
    if (type) params.set('type', type);
    params.set('page',  String(page));
    params.set('limit', String(LIMIT));
    const res = await fetch(`/api/audit?${params}`);
    if (res.ok) {
      const json = await res.json();
      setLogs(json.data);
      setTotal(json.total);
    }
    setLoading(false);
  }, [q, type, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <div className="page-title">Audit Log</div>
      <p className="page-sub">Rekam jejak seluruh aktivitas sistem. Read-only, tidak dapat diubah atau dihapus. Total: <strong>{total}</strong></p>

      <div className="card card-body" style={{marginBottom:16,display:'flex',gap:12,padding:'12px 16px'}}>
        <input
          style={{flex:2,padding:'8px 12px',border:'1.5px solid var(--paper-line)',borderRadius:'var(--r-md)',fontSize:13}}
          placeholder="🔍 Cari user, catatan, kode dokumen..."
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
        />
        <select
          style={{padding:'8px 12px',border:'1.5px solid var(--paper-line)',borderRadius:'var(--r-md)',fontSize:13,background:'white'}}
          value={type}
          onChange={e => { setType(e.target.value); setPage(1); }}
        >
          {ACTION_TYPES.map(t => <option key={t} value={t}>{t || 'Semua Tipe Aksi'}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Pengguna</th>
              <th>Tipe Aksi</th>
              <th>Kode Dokumen</th>
              <th>Catatan</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({length:8}).map((_,i) => (
                <tr key={i}>{Array.from({length:6}).map((_,j) => (
                  <td key={j}><div className="skeleton" style={{height:14,width:'75%'}}></div></td>
                ))}</tr>
              ))
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{textAlign:'center',padding:40,color:'var(--ink-muted)'}}>Tidak ada log</td></tr>
            ) : logs.map((log: any) => (
              <tr key={log.id}>
                <td style={{fontSize:11.5,color:'var(--ink-soft)',whiteSpace:'nowrap'}}>
                  {new Date(log.created_at).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                </td>
                <td style={{fontWeight:600,fontSize:13}}>{log.user_name}</td>
                <td>
                  <span className={`audit-badge audit-${log.action_type}`}>{log.action_type}</span>
                </td>
                <td style={{fontFamily:'monospace',fontSize:12}}>{log.doc_kode || '—'}</td>
                <td style={{fontSize:12.5,maxWidth:280}}>{log.note || '—'}</td>
                <td style={{fontSize:11.5,color:'var(--ink-muted)'}}>{log.ip_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:16}}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>← Prev</button>
          <span style={{display:'flex',alignItems:'center',fontSize:13,color:'var(--ink-soft)'}}>
            Halaman {page} / {totalPages}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}>Next →</button>
        </div>
      )}
    </>
  );
}
