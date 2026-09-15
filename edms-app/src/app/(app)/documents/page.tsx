'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Document, DocumentStatus } from '@/types';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Semua Status' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Review', label: 'Review' },
  { value: 'Menunggu Approval', label: 'Menunggu Approval' },
  { value: 'Aktif', label: 'Aktif' },
  { value: 'Obsolete', label: 'Obsolete' },
];

const STATUS_CLASS: Record<string,string> = {
  'Draft':'draft','Review':'review','Menunggu Approval':'approval','Aktif':'aktif','Obsolete':'obsolete',
};

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [docs,    setDocs]    = useState<Document[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);

  const [q,      setQ]      = useState(searchParams.get('q') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [bidang, setBidang] = useState(searchParams.get('bidang') || '');
  const [page,   setPage]   = useState(1);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q)      params.set('q', q);
    if (status) params.set('status', status);
    if (bidang) params.set('bidang', bidang);
    params.set('page', String(page));
    const res = await fetch(`/api/documents?${params}`);
    if (res.ok) {
      const json = await res.json();
      setDocs(json.data);
      setTotal(json.total);
    }
    setLoading(false);
  }, [q, status, bidang, page]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  return (
    <>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:20}}>
        <div>
          <div className="page-title">Daftar Dokumen</div>
          <p className="page-sub" style={{marginBottom:0}}>Register semua dokumen mutu unit. Total: <strong>{total}</strong></p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <Link href="/editor/new" className="btn btn-primary">＋ Dokumen Baru</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-body" style={{marginBottom:18, display:'flex', gap:12, flexWrap:'wrap', padding:'14px 18px'}}>
        <input
          className="field"
          style={{flex:2,minWidth:200,margin:0,padding:'8px 12px',border:'1.5px solid var(--paper-line)',borderRadius:'var(--r-md)',fontSize:13}}
          placeholder="🔍 Cari kode, judul, atau bidang..."
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
        />
        <select
          style={{padding:'8px 12px',border:'1.5px solid var(--paper-line)',borderRadius:'var(--r-md)',fontSize:13,background:'white'}}
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input
          style={{padding:'8px 12px',border:'1.5px solid var(--paper-line)',borderRadius:'var(--r-md)',fontSize:13,minWidth:150}}
          placeholder="Bidang..."
          value={bidang}
          onChange={e => { setBidang(e.target.value); setPage(1); }}
        />
        <button className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setStatus(''); setBidang(''); setPage(1); }}>
          Reset
        </button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Judul</th>
              <th>Bidang</th>
              <th>Jenis</th>
              <th>Versi</th>
              <th>Status</th>
              <th>Diperbarui</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({length:6}).map((_,i) => (
                <tr key={i}>
                  {Array.from({length:8}).map((_,j) => (
                    <td key={j}><div className="skeleton" style={{height:16,width:`${60+Math.random()*30}%`}}></div></td>
                  ))}
                </tr>
              ))
            ) : docs.length === 0 ? (
              <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'var(--ink-muted)'}}>Tidak ada dokumen ditemukan</td></tr>
            ) : docs.map((d: any) => (
              <tr key={d.id} className="row-click" onClick={() => router.push(`/documents/${d.id}`)}>
                <td style={{fontFamily:'monospace',fontWeight:700,fontSize:12}}>{d.kode}</td>
                <td style={{maxWidth:240}}>
                  <div style={{fontWeight:600,fontSize:13}}>{d.judul}</div>
                  {d.penyusun_name && <div style={{fontSize:11.5,color:'var(--ink-muted)'}}>📝 {d.penyusun_name}</div>}
                </td>
                <td style={{fontSize:12,color:'var(--ink-soft)'}}>{d.bidang}</td>
                <td style={{fontSize:12}}>{d.jenis}</td>
                <td style={{fontWeight:600}}>v{d.current_version}</td>
                <td>
                  <span className={`badge badge-${STATUS_CLASS[d.status] ?? 'draft'}`}>{d.status}</span>
                </td>
                <td style={{fontSize:12,color:'var(--ink-soft)',whiteSpace:'nowrap'}}>
                  {new Date(d.updated_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div style={{display:'flex',gap:6}}>
                    <Link href={`/documents/${d.id}`} className="btn btn-ghost btn-xs">Detail</Link>
                    {d.status === 'Draft' && (
                      <Link href={`/editor/${d.id}`} className="btn btn-xs btn-outline">Edit</Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
