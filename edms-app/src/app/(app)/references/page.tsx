'use client';

import { useState, useEffect, useCallback } from 'react';
import { IconPlus, IconSearch } from '@/components/icons/Icons';

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
      notify('Referensi berhasil ditambahkan ke database.');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title">Master Referensi Standard & Regulasi</div>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Daftar standar ISO, undang-undang, regulasi pemerintah, dan referensi internal PLN yang dapat ditautkan ke dokumen mutu.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          <IconPlus size={16} />
          <span>Tambah Referensi</span>
        </button>
      </div>

      <div className="card card-body" style={{ marginBottom: 16, display: 'flex', gap: 12, padding: '12px 16px', alignItems: 'center' }}>
        <div style={{ flex: 2, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 12, color: 'var(--ink-muted)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
            <IconSearch size={15} />
          </span>
          <input
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              border: '1px solid var(--paper-line-dark)',
              borderRadius: 'var(--r-md)',
              fontSize: 12.5,
              outline: 'none',
              background: 'var(--card)'
            }}
            placeholder="Cari nomor kode standar atau judul referensi..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <select
          style={{ padding: '8px 12px', border: '1px solid var(--paper-line-dark)', borderRadius: 'var(--r-md)', fontSize: 12.5, background: 'var(--card)', color: 'var(--ink)' }}
          value={kategori}
          onChange={e => setKategori(e.target.value)}
        >
          {KATEGORI_OPTIONS.map(k => <option key={k} value={k}>{k ? `Kategori: ${k}` : 'Semua Kategori'}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: '12%' }}>Kategori</th>
              <th style={{ width: '18%' }}>Nomor / Kode Standard</th>
              <th style={{ width: '35%' }}>Judul Referensi</th>
              <th>Deskripsi Singkat</th>
              <th style={{ width: '10%', textAlign: 'center' }}>Tautan</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>
                  ))}
                </tr>
              ))
            ) : refs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--ink-muted)' }}>
                  Tidak ada referensi ditemukan.
                </td>
              </tr>
            ) : refs.map((r: any) => (
              <tr key={r.id}>
                <td>
                  <span className={`badge badge-${r.kategori === 'Regulasi' ? 'review' : r.kategori === 'Standar' ? 'aktif' : 'draft'}`}>
                    {r.kategori}
                  </span>
                </td>
                <td style={{ fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--mono)' }}>{r.nomor}</td>
                <td style={{ fontSize: 13, color: 'var(--ink)' }}>{r.judul}</td>
                <td style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{r.deskripsi || '—'}</td>
                <td style={{ fontSize: 12, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  <strong>{r.usage_count}</strong> dok
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }} onClick={() => handleDelete(r.id)}>
                    Nonaktifkan
                  </button>
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
              <div className="modal-title">Tambah Referensi Standard Baru</div>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="field">
              <label>Kategori Referensi *</label>
              <select value={form.kategori} onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))}>
                <option>Regulasi</option>
                <option>Standar</option>
                <option>Internal</option>
              </select>
            </div>
            <div className="field">
              <label>Nomor / Kode Dokumen Standar *</label>
              <input value={form.nomor} onChange={e => setForm(f => ({ ...f, nomor: e.target.value }))} placeholder="Misal: ISO 9001:2015 / UU No. 1 Tahun 1970..." required />
            </div>
            <div className="field">
              <label>Judul Lengkap Referensi *</label>
              <input value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} placeholder="Nama lengkap regulasi atau standar..." required />
            </div>
            <div className="field">
              <label>Deskripsi Singkat / Ruang Lingkup</label>
              <textarea value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} placeholder="Keterangan singkat tentang penerapan referensi ini..." rows={3} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Referensi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
