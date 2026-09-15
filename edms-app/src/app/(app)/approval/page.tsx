'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const STATUS_CLASS: Record<string,string> = {
  'Draft':'draft','Review':'review','Menunggu Approval':'approval','Aktif':'aktif','Obsolete':'obsolete',
};

export default function ApprovalPage() {
  const [docs,    setDocs]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    const res = await fetch('/api/documents?status=Review&limit=100');
    const res2= await fetch('/api/documents?status=Menunggu+Approval&limit=100');
    if (res.ok && res2.ok) {
      const j1 = await res.json();
      const j2 = await res2.json();
      setDocs([...j1.data, ...j2.data]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  return (
    <>
      <div className="page-title">Approval & Review</div>
      <p className="page-sub">Daftar dokumen yang memerlukan tindakan review atau approval dari Anda.</p>

      {loading ? (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {Array.from({length:4}).map((_,i) => (
            <div key={i} className="skeleton" style={{height:80,borderRadius:'var(--r-lg)'}}></div>
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="card card-body" style={{textAlign:'center',padding:80}}>
          <div style={{fontSize:50,marginBottom:16}}>🎉</div>
          <div style={{fontSize:18,fontWeight:700,marginBottom:6}}>Semua beres!</div>
          <div style={{color:'var(--ink-soft)'}}>Tidak ada dokumen yang menunggu review atau approval saat ini.</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {docs.map((d: any) => (
            <div key={d.id} className="card card-hover" style={{padding:'18px 22px',display:'flex',alignItems:'center',gap:16}}>
              <div style={{width:12,height:12,borderRadius:'50%',background:d.status==='Review'?'var(--navy)':'var(--amber)',flexShrink:0}}></div>
              <div style={{flex:1}}>
                <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:5}}>
                  <code style={{fontSize:12,background:'var(--paper)',padding:'2px 8px',borderRadius:20,border:'1px solid var(--paper-line)',fontWeight:700}}>{d.kode}</code>
                  <span className={`badge badge-${STATUS_CLASS[d.status]}`}>{d.status}</span>
                </div>
                <div style={{fontWeight:700,fontSize:14}}>{d.judul}</div>
                <div style={{fontSize:12,color:'var(--ink-soft)',marginTop:3}}>{d.bidang} · v{d.current_version} · Penyusun: {d.penyusun_name}</div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <Link href={`/documents/${d.id}`} className="btn btn-primary btn-sm">
                  ✍️ Review & Approve
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
