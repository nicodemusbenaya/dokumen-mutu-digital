'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export default function ReferencesPage() {
  const [refs,   setRefs]   = useState<any[]>([]);
  const [loading,setLoading]= useState(true);
  const [q,      setQ]      = useState('');
  const [kategori,setKategori]=useState('');
  const [modal,  setModal]  = useState(false);
  const [form,   setForm]   = useState({ kategori:'Regulasi', nomor:'', judul:'', deskripsi:'' });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');

  const fetchRefs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q)       params.set('q', q);
    if (kategori)params.set('kategori', kategori);
    const res = await fetch(`/api/references?${params}`);
    if (res.ok) { const json = await res.json(); setRefs(json.data); }
    setLoading(false);
  }, [q, kategori]);

  useEffect(() => { fetchRefs(); }, [fetchRefs]);

  function notify(text: string) { setMsg(text); setTimeout(() => setMsg(''), 4000); }

  async function handleSave() {
    setSaving(true);
    const res = await fetch('/api/references', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (res.ok) {
      setModal(false);
      setForm({ kategori:'Regulasi', nomor:'', judul:'', deskripsi:'' });
      notify('Referensi berhasil ditambahkan.');
      fetchRefs();
    } else {
      notify(json.error || 'Gagal menyimpan.');
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm('Nonaktifkan referensi ini?')) return;
    const res = await fetch(`/api/references/${id}`, { method: 'DELETE' });
    const json = await res.json();
    notify(res.ok ? json.message : json.error);
    if (res.ok) fetchRefs();
  }

  const KATEGORI_OPTIONS = ['', 'Regulasi', 'Standar', 'Internal'];

  return (
    <>
      {msg && (
        <div className="notif-bar no-print">
          <div className="notif success">{msg}</div>
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:20}}>
        <div>
          <div className="page-title">Master Referensi</div>
          <p className="page-sub" style={{marginBottom:0}}>Daftar regulasi, standar, dan referensi internal yang dapat dikaitkan ke dokumen.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>＋ Tambah Referensi</button>
      </div>

      <div className="card card-body" style={{marginBottom:16,display:'flex',gap:12,padding:'12px 16px'}}>
        <input
          style={{flex:2,padding:'8px 12px',border:'1.5px solid var(--paper-line)',borderRadius:'var(--r-md)',fontSize:13}}
          placeholder="🔍 Cari nomor atau judul..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select
          style={{padding:'8px 12px',border:'1.5px solid var(--paper-line)',borderRadius:'var(--r-md)',fontSize:13,background:'white'}}
          value={kategori}
          onChange={e => setKategori(e.target.value)}
        >
          {KATEGORI_OPTIONS.map(k => <option key={k} value={k}>{k || 'Semua Kategori'}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Nomor / Kode</th>
              <th>Judul</th>
              <th>Deskripsi</th>
              <th>Dipakai</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({length:5}).map((_,i) => (
                <tr key={i}>{Array.from({length:6}).map((_,j) => (
                  <td key={j}><div className="skeleton" style={{height:16,width:'80%'}}></div></td>
                ))}</tr>
              ))
            ) : refs.length === 0 ? (
              <tr><td colSpan={6} style={{textAlign:'center',padding:40,color:'var(--ink-muted)'}}>Tidak ada referensi</td></tr>
            ) : refs.map((r: any) => (
              <tr key={r.id}>
                <td>
                  <span className={`badge badge-${r.kategori==='Regulasi'?'review':r.kategori==='Standar'?'aktif':'draft'}`}>
                    {r.kategori}
                  </span>
                </td>
                <td style={{fontWeight:700,fontSize:13}}>{r.nomor}</td>
                <td style={{maxWidth:300,fontSize:13}}>{r.judul}</td>
                <td style={{fontSize:12,color:'var(--ink-soft)',maxWidth:200}}>{r.deskripsi || '—'}</td>
                <td style={{fontSize:12,textAlign:'center'}}>{r.usage_count} dok</td>
                <td>
                  <button className="btn btn-xs btn-danger" onClick={() => handleDelete(r.id)}>Nonaktifkan</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Tambah Referensi Baru</div>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="field">
              <label>Kategori *</label>
              <select value={form.kategori} onChange={e => setForm(f=>({...f,kategori:e.target.value}))}>
                <option>Regulasi</option>
                <option>Standar</option>
                <option>Internal</option>
              </select>
            </div>
            <div className="field">
              <label>Nomor / Kode *</label>
              <input value={form.nomor} onChange={e => setForm(f=>({...f,nomor:e.target.value}))} placeholder="ISO 9001:2015 / Permenaker No. 5/2018 / ..." />
            </div>
            <div className="field">
              <label>Judul *</label>
              <input value={form.judul} onChange={e => setForm(f=>({...f,judul:e.target.value}))} placeholder="Nama lengkap regulasi atau standar..." />
            </div>
            <div className="field">
              <label>Deskripsi Singkat</label>
              <textarea value={form.deskripsi} onChange={e => setForm(f=>({...f,deskripsi:e.target.value}))} placeholder="Keterangan singkat tentang referensi ini..." rows={3} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Menyimpan...' : '+ Simpan Referensi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
