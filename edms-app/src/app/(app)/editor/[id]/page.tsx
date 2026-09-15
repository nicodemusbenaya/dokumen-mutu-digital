'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Lazy load TipTap to avoid SSR issues
const TipTapEditor = dynamic(() => import('@/components/editor/TipTapEditor'), { ssr: false });

const SECTIONS = [
  { key: 'tujuan',        label: '1. Tujuan', hint: 'Nyatakan tujuan utama dokumen ini.' },
  { key: 'ruang_lingkup', label: '2. Ruang Lingkup', hint: 'Jelaskan cakupan dan batasan berlakunya dokumen.' },
  { key: 'definisi',      label: '3. Definisi & Istilah', hint: 'Definisikan istilah-istilah teknis yang digunakan.' },
  { key: 'prosedur',      label: '4. Prosedur', hint: 'Uraikan langkah-langkah prosedur secara rinci dan berurutan.' },
  { key: 'lampiran',      label: '5. Lampiran', hint: 'Cantumkan formulir, tabel, atau dokumen pendukung.' },
];

export default function EditorPage() {
  const params  = useParams();
  const router  = useRouter();
  const isNew   = params.id === 'new';
  const docId   = isNew ? null : params.id as string;

  const [doc,     setDoc]     = useState<any>(null);
  const [header,  setHeader]  = useState({ kode:'', judul:'', bidang:'', jenis:'SOP/Prosedur', siklusReview:'2 tahun' });
  const [sections,setSections]= useState<Record<string,string>>({});
  const [refs,    setRefs]    = useState<any[]>([]);
  const [allRefs, setAllRefs] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState('tujuan');
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [msgType, setMsgType] = useState<'ok'|'err'>('ok');
  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [refSearch,     setRefSearch]     = useState('');
  const versionRef = useRef<number>(1);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchDoc = useCallback(async () => {
    if (!docId) return;
    const res = await fetch(`/api/documents/${docId}`);
    if (res.ok) {
      const json = await res.json();
      const d = json.data;
      setDoc(d);
      setHeader({ kode: d.kode, judul: d.judul, bidang: d.bidang, jenis: d.jenis, siklusReview: d.siklus_review });
      setSections(d.sections || {});
      setRefs(d.refs || []);
      versionRef.current = d.version_number;
    }
  }, [docId]);

  const fetchRefs = useCallback(async () => {
    const res = await fetch('/api/references');
    if (res.ok) {
      const json = await res.json();
      setAllRefs(json.data || []);
    }
  }, []);

  useEffect(() => { fetchDoc(); fetchRefs(); }, [fetchDoc, fetchRefs]);

  function notify(text: string, type: 'ok'|'err' = 'ok') {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  }

  async function handleSave(auto = false) {
    setSaving(true);
    if (isNew) {
      // Create new
      if (!header.kode || !header.judul || !header.bidang) {
        notify('Kode, Judul, dan Bidang wajib diisi.', 'err');
        setSaving(false);
        return;
      }
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...header }),
      });
      const json = await res.json();
      if (res.ok) {
        router.replace(`/editor/${json.data.id}`);
        notify('Dokumen berhasil dibuat!');
      } else {
        notify(json.error, 'err');
      }
    } else {
      // Update
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...header, sections, versionNumber: versionRef.current }),
      });
      const json = await res.json();
      if (res.ok) {
        versionRef.current = json.data?.versionNumber ?? versionRef.current;
        if (!auto) notify('Tersimpan ✓');
      } else if (res.status === 409) {
        notify('⚠️ Konflik: dokumen telah diubah di perangkat lain. Muat ulang!', 'err');
      } else {
        notify(json.error, 'err');
      }
    }
    setSaving(false);
  }

  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => handleSave(true), 30_000);
  }

  function handleSectionChange(key: string, html: string) {
    setSections(prev => ({ ...prev, [key]: html }));
    scheduleAutoSave();
  }

  function addRef(ref: any) {
    if (!refs.find((r: any) => r.id === ref.id)) {
      setRefs(prev => [...prev, ref]);
    }
    setRefPickerOpen(false);
  }

  function removeRef(id: number) {
    setRefs(prev => prev.filter((r: any) => r.id !== id));
  }

  const filteredRefs = allRefs.filter(r =>
    !refs.find((lr: any) => lr.id === r.id) &&
    (r.nomor.toLowerCase().includes(refSearch.toLowerCase()) ||
     r.judul.toLowerCase().includes(refSearch.toLowerCase()))
  );

  return (
    <>
      {msg && (
        <div className="notif-bar no-print">
          <div className={`notif ${msgType === 'ok' ? 'success' : 'error'}`}>{msg}</div>
        </div>
      )}

      {/* Header Bar */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <Link href="/documents" style={{fontSize:13,color:'var(--ink-soft)'}}>← Daftar Dokumen</Link>
          </div>
          <div className="page-title">{isNew ? 'Buat Dokumen Baru' : `Edit: ${doc?.kode || '...'}`}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>Batal</button>
          <button className="btn btn-amber" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? '⏳ Menyimpan...' : '💾 Simpan'}
          </button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:20}}>
        {/* Left: metadata + nav */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="card card-body">
            <div style={{fontWeight:700,fontSize:13,marginBottom:14}}>📋 Informasi Dokumen</div>
            <div className="field">
              <label>Kode Dokumen *</label>
              <input value={header.kode} onChange={e => setHeader(h=>({...h,kode:e.target.value}))} placeholder="SOP.UPS.XX.2026" readOnly={!isNew} />
            </div>
            <div className="field">
              <label>Judul *</label>
              <input value={header.judul} onChange={e => setHeader(h=>({...h,judul:e.target.value}))} placeholder="Judul dokumen..." />
            </div>
            <div className="field">
              <label>Bidang *</label>
              <input value={header.bidang} onChange={e => setHeader(h=>({...h,bidang:e.target.value}))} placeholder="Manajemen Mutu / Sertifikasi / ..." />
            </div>
            <div className="field">
              <label>Jenis Dokumen</label>
              <select value={header.jenis} onChange={e => setHeader(h=>({...h,jenis:e.target.value}))}>
                <option>SOP/Prosedur</option>
                <option>Manual Mutu</option>
                <option>Instruksi Kerja</option>
                <option>Formulir Kerja</option>
              </select>
            </div>
            <div className="field">
              <label>Siklus Review</label>
              <select value={header.siklusReview} onChange={e => setHeader(h=>({...h,siklusReview:e.target.value}))}>
                <option value="1 tahun">1 tahun</option>
                <option value="2 tahun">2 tahun</option>
                <option value="3 tahun">3 tahun</option>
              </select>
            </div>
          </div>

          {/* Section nav */}
          <div className="card card-body">
            <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>📑 Bagian Dokumen</div>
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                style={{
                  display:'block',width:'100%',textAlign:'left',
                  padding:'8px 10px',borderRadius:'var(--r-md)',border:'none',cursor:'pointer',
                  marginBottom:4,fontSize:12.5,fontWeight:500,
                  background: activeSection === s.key ? 'var(--navy)' : 'transparent',
                  color: activeSection === s.key ? '#fff' : 'var(--ink-soft)',
                  transition: 'all var(--t-fast)',
                }}
              >
                {s.label}
                {sections[s.key]?.trim() && <span style={{float:'right',fontSize:11,opacity:.7}}>✓</span>}
              </button>
            ))}
          </div>

          {/* Referensi */}
          <div className="card card-body">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:13}}>📚 Referensi</div>
              <button className="btn btn-xs btn-outline" onClick={() => setRefPickerOpen(true)}>+ Tambah</button>
            </div>
            {refs.length === 0
              ? <div style={{fontSize:12,color:'var(--ink-muted)',textAlign:'center',padding:'10px 0'}}>Belum ada referensi</div>
              : refs.map((r: any) => (
                  <div key={r.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid var(--paper-line)'}}>
                    <span className="badge badge-draft" style={{fontSize:10,padding:'1px 6px'}}>{r.kategori}</span>
                    <div style={{flex:1,minWidth:0,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.nomor}</div>
                    <button style={{border:'none',background:'none',color:'var(--red)',cursor:'pointer',fontSize:14}} onClick={() => removeRef(r.id)}>×</button>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Right: Editor */}
        <div>
          {SECTIONS.map(sec => (
            <div key={sec.key} style={{display: activeSection === sec.key ? 'block' : 'none'}}>
              <div className="card">
                <div style={{padding:'14px 18px',borderBottom:'1px solid var(--paper-line)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontFamily:'var(--serif)',fontWeight:700,fontSize:16}}>{sec.label}</div>
                    <div style={{fontSize:12,color:'var(--ink-muted)',marginTop:2}}>{sec.hint}</div>
                  </div>
                </div>
                <div style={{minHeight:400}}>
                  <TipTapEditor
                    key={sec.key}
                    content={sections[sec.key] || ''}
                    onChange={html => handleSectionChange(sec.key, html)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ref Picker Modal */}
      {refPickerOpen && (
        <div className="overlay" onClick={() => setRefPickerOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Pilih Referensi</div>
              <button className="modal-close" onClick={() => setRefPickerOpen(false)}>×</button>
            </div>
            <input
              style={{width:'100%',padding:'9px 12px',border:'1.5px solid var(--paper-line)',borderRadius:'var(--r-md)',marginBottom:12,fontSize:13}}
              placeholder="Cari referensi..."
              value={refSearch}
              onChange={e => setRefSearch(e.target.value)}
              autoFocus
            />
            <div style={{maxHeight:360,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
              {filteredRefs.map(r => (
                <button
                  key={r.id}
                  onClick={() => addRef(r)}
                  style={{textAlign:'left',padding:'10px 12px',borderRadius:'var(--r-md)',border:'1px solid var(--paper-line)',background:'var(--paper)',cursor:'pointer'}}
                  className="card-hover"
                >
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span className={`badge badge-${r.kategori==='Regulasi'?'review':r.kategori==='Standar'?'aktif':'draft'}`} style={{fontSize:10.5}}>{r.kategori}</span>
                    <strong style={{fontSize:12.5}}>{r.nomor}</strong>
                  </div>
                  <div style={{fontSize:12,color:'var(--ink-soft)',marginTop:3}}>{r.judul}</div>
                </button>
              ))}
              {filteredRefs.length === 0 && (
                <div style={{textAlign:'center',padding:30,color:'var(--ink-muted)'}}>Tidak ada referensi yang cocok</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
