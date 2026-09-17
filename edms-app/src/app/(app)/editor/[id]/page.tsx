'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  DOCUMENT_SECTIONS,
  DocumentType,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  getDefaultSectionsForType,
  getSectionLabel,
} from '@/lib/documentTypes';

import { IconArrowLeft, IconCheck } from '@/components/icons/Icons';

// Lazy load TipTap and TableGridEditor to avoid SSR issues
const TipTapEditor = dynamic(() => import('@/components/editor/TipTapEditor'), { ssr: false });
const TableGridEditor = dynamic(() => import('@/components/editor/TableGridEditor'), { ssr: false });

export default function EditorPage() {
  const params  = useParams();
  const router  = useRouter();
  const isNew   = params.id === 'new';
  const docId   = isNew ? null : params.id as string;

  const [doc,     setDoc]     = useState<any>(null);
  const [header,  setHeader]  = useState({ kode:'', judul:'', bidang:'', jenis:'SOP/Prosedur', siklusReview:'2 tahun' });
  const [sections,setSections]= useState<Record<string,string>>(() => {
    return isNew ? getDefaultSectionsForType('SOP/Prosedur') : {};
  });
  const [refs,    setRefs]    = useState<any[]>([]);
  const [allRefs, setAllRefs] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState('tujuan');
  const [saving,  setSaving]  = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [msg,     setMsg]     = useState('');
  const [msgType, setMsgType] = useState<'ok'|'err'>('ok');
  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [refSearch,     setRefSearch]     = useState('');
  const versionRef = useRef<number>(1);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Bagian seksi dinamis berdasarkan jenis dokumen baku
  const currentSections = useMemo(() => {
    const typeSections = DOCUMENT_SECTIONS[header.jenis as DocumentType] || DOCUMENT_SECTIONS['SOP/Prosedur'];
    const keysInDoc = Object.keys(sections);
    const knownKeys = new Set(typeSections.map(s => s.key));
    const extraSections = keysInDoc
      .filter(k => !knownKeys.has(k) && sections[k]?.trim())
      .map(k => ({
        key: k,
        label: getSectionLabel(k, header.jenis),
        hint: 'Bagian dokumen tersimpan.',
      }));
    return [...typeSections, ...extraSections];
  }, [header.jenis, sections]);

  useEffect(() => {
    if (currentSections.length > 0 && !currentSections.some(s => s.key === activeSection)) {
      setActiveSection(currentSections[0].key);
    }
  }, [currentSections, activeSection]);

  const fetchDoc = useCallback(async () => {
    if (isNew) return;
    const res = await fetch(`/api/documents/${docId}`);
    if (res.ok) {
      const json = await res.json();
      const d = json.data;
      setDoc(d);
      setHeader({
        kode: d.kode,
        judul: d.judul,
        bidang: d.bidang,
        jenis: d.jenis,
        siklusReview: d.siklusReview || '2 tahun',
      });
      versionRef.current = d.currentVersion || 1;
      setSections(d.sections || {});
      setRefs(d.refs || []);
      setIsDirty(false);
    }
  }, [docId, isNew]);

  useEffect(() => { fetchDoc(); }, [fetchDoc]);

  // Load all master refs for picker
  useEffect(() => {
    fetch('/api/references?limit=100')
      .then(r => r.json())
      .then(j => setAllRefs(j.data || []))
      .catch(console.error);
  }, []);

  function notify(text: string, type: 'ok'|'err' = 'ok') {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  }

  function updateHeader(patch: Partial<typeof header>) {
    setHeader(h => ({ ...h, ...patch }));
    setIsDirty(true);
  }

  function updateSection(key: string, html: string) {
    setSections(s => ({ ...s, [key]: html }));
    setIsDirty(true);
  }

  async function handleSave(silent = false) {
    if (!header.kode.trim() || !header.judul.trim()) {
      notify('Kode dan judul dokumen wajib diisi!', 'err');
      return;
    }
    setSaving(true);

    const payload = {
      ...header,
      sections,
      references: refs.map(r => r.id),
      version: versionRef.current,
    };

    try {
      const url = isNew ? '/api/documents' : `/api/documents/${docId}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        notify(json.error || 'Gagal menyimpan dokumen.', 'err');
      } else {
        setIsDirty(false);
        if (!silent) notify('Dokumen berhasil disimpan!');
        if (isNew && json.data?.id) {
          router.push(`/editor/${json.data.id}`);
        } else {
          versionRef.current = json.data?.version || versionRef.current;
          setDoc(json.data);
        }
      }
    } catch {
      notify('Koneksi server gagal.', 'err');
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (isDirty) {
      const confirmLeave = window.confirm(
        'Perubahan dokumen belum disimpan!\n\nKlik "OK" untuk tetap kembali tanpa menyimpan, atau "Batal" untuk melanjutkan pengeditan.'
      );
      if (!confirmLeave) return;
    }
    router.push('/documents');
  }

  function handleApplyTemplate(j: string) {
    const tmpl = getDefaultSectionsForType(j);
    const hasContent = Object.values(sections).some(v => v && v.trim() && v !== '<p></p>');
    if (hasContent) {
      if (!confirm(`Terapkan template baku untuk "${j}"? Isi seksi saat ini akan digantikan dengan format baku resmi PLN UPS.`)) {
        return;
      }
    }
    setSections({ ...tmpl });
    setIsDirty(true);
    notify(`Template baku "${j}" berhasil diterapkan!`);
  }

  function handleJenisChange(newJenis: string) {
    setHeader(h => ({ ...h, jenis: newJenis }));
    setIsDirty(true);
    if (isNew) {
      const tmpl = getDefaultSectionsForType(newJenis);
      setSections({ ...tmpl });
      notify(`Format template berganti ke "${newJenis}"`);
    }
  }

  function addRef(ref: any) {
    if (!refs.find((r: any) => r.id === ref.id)) {
      setRefs(prev => [...prev, ref]);
      setIsDirty(true);
    }
    setRefPickerOpen(false);
  }

  function removeRef(id: number) {
    setRefs(prev => prev.filter((r: any) => r.id !== id));
    setIsDirty(true);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <button
              type="button"
              onClick={handleBack}
              className="btn btn-ghost btn-xs"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <IconArrowLeft size={13} />
              <span>Kembali ke Daftar</span>
            </button>
          </div>
          <div className="page-title">{isNew ? 'Buat Dokumen Baru' : `Edit: ${doc?.kode || '...'}`}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <IconArrowLeft size={14} />
            <span>Kembali</span>
          </button>
          <button className="btn btn-primary" onClick={() => handleSave(false)} disabled={saving}>
            <IconCheck size={15} />
            <span>{saving ? 'Menyimpan...' : (isDirty ? 'Simpan Perubahan *' : 'Simpan Dokumen')}</span>
          </button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:20}}>
        {/* Left: metadata + nav */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="card card-body">
            <div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Informasi Dokumen</div>
            <div className="field">
              <label>Kode Dokumen *</label>
              <input value={header.kode} onChange={e => updateHeader({ kode: e.target.value })} placeholder="SOP.UPS.XX.2026" readOnly={!isNew} />
            </div>
            <div className="field">
              <label>Judul *</label>
              <input value={header.judul} onChange={e => updateHeader({ judul: e.target.value })} placeholder="Judul dokumen..." />
            </div>
            <div className="field">
              <label>Bidang *</label>
              <input value={header.bidang} onChange={e => updateHeader({ bidang: e.target.value })} placeholder="Manajemen Mutu / Sertifikasi / ..." />
            </div>
            <div className="field">
              <label>Jenis & Template Dokumen *</label>
              <select value={header.jenis} onChange={e => handleJenisChange(e.target.value)}>
                {DOCUMENT_TYPES.map(t => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t] || t}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: -4, marginBottom: 14 }}>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                style={{ width: '100%', justifyContent: 'center', gap: 6, fontSize: 11.5 }}
                onClick={() => handleApplyTemplate(header.jenis)}
                title="Terapkan klausul dan kerangka isian resmi dari template Word PLN UPS"
              >
                <span>Muat Template Baku Resmi</span>
              </button>
            </div>
            <div className="field">
              <label>Siklus Review</label>
              <select value={header.siklusReview} onChange={e => updateHeader({ siklusReview: e.target.value })}>
                <option value="1 tahun">1 tahun</option>
                <option value="2 tahun">2 tahun</option>
                <option value="3 tahun">3 tahun</option>
              </select>
            </div>
          </div>

          {/* Section nav */}
          <div className="card card-body">
            <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>📑 Bagian Dokumen Baku</div>
            {currentSections.map(s => (
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
          {currentSections.map(sec => (
            <div key={sec.key} style={{display: activeSection === sec.key ? 'block' : 'none'}}>
              <div className="card">
                <div style={{padding:'14px 18px',borderBottom:'1px solid var(--paper-line)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontFamily:'var(--serif)',fontWeight:700,fontSize:16}}>{sec.label}</div>
                    <div style={{fontSize:12,color:'var(--ink-muted)',marginTop:2}}>{sec.hint}</div>
                  </div>
                </div>
                <div style={{minHeight:400}}>
                  <TableGridEditor
                    key={`${docId || 'new'}-${sec.key}`}
                    sectionKey={sec.key}
                    sectionLabel={sec.label}
                    content={sections[sec.key] || ''}
                    onChange={html => updateSection(sec.key, html)}
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
