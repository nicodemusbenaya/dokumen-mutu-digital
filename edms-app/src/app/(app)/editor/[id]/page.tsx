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
  isFormulirType,
  FORMULIR_OFFICIAL_HEADERS,
  DocumentSectionConfig,
  getOrderedSections,
  getDisplaySectionLabel,
  cleanSectionTitle,
} from '@/lib/documentTypes';

import {
  IconArrowLeft,
  IconCheck,
  IconSearch,
  IconTable,
  IconEditor,
  IconPlus,
  IconFileText,
} from '@/components/icons/Icons';

import { getSnippetsForSection, ClauseSnippet } from '@/lib/documentSnippets';
import { getRevisionHistory, RevisionRow } from '@/lib/revisionUtils';
import RevisionHistoryEditor from '@/components/editor/RevisionHistoryEditor';
import '@/components/editor/editor.css';

// Lazy load TipTap and TableGridEditor to avoid SSR issues
const TipTapEditor = dynamic(() => import('@/components/editor/TipTapEditor'), { ssr: false });
const TableGridEditor = dynamic(() => import('@/components/editor/TableGridEditor'), { ssr: false });

export default function EditorPage() {
  const params  = useParams();
  const router  = useRouter();
  const isNew   = params.id === 'new';
  const docId   = isNew ? null : params.id as string;

  const initialSectionsRef = useRef<Record<string, string>>({});
  const [doc,     setDoc]     = useState<any>(null);
  const [header,  setHeader]  = useState({ kode:'', judul:'', bidang:'', jenis:'SOP/Prosedur', siklusReview:'2 tahun' });
  const [sections,setSections]= useState<Record<string,string>>(() => {
    const init = isNew ? getDefaultSectionsForType('SOP/Prosedur') : {};
    initialSectionsRef.current = { ...init };
    return init;
  });
  const [orderedSections, setOrderedSections] = useState<DocumentSectionConfig[]>(() => {
    return isNew ? getOrderedSections('SOP/Prosedur') : [];
  });
  const [deletedSectionKeys, setDeletedSectionKeys] = useState<string[]>([]);
  const [addSectionModalOpen, setAddSectionModalOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [refs,    setRefs]    = useState<any[]>([]);
  const [allRefs, setAllRefs] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState('tujuan');
  const [saving,  setSaving]  = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [msg,     setMsg]     = useState('');
  const [msgType, setMsgType] = useState<'ok'|'err'>('ok');
  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [refSearch,     setRefSearch]     = useState('');

  // UX Enhancement States
  const [isFullscreen, setIsFullscreen]   = useState(false);
  const [isSplitPreview, setIsSplitPreview] = useState(false);
  const [snippetsOpen, setSnippetsOpen]   = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findText, setFindText]           = useState('');
  const [replaceText, setReplaceText]     = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'offline'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState('');
  const [localDraftAvailable, setLocalDraftAvailable] = useState(false);
  const [localDraftData, setLocalDraftData] = useState<any>(null);

  const versionRef = useRef<number>(1);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Document Import States
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLoading, setImportLoading]     = useState(false);
  const [importError, setImportError]         = useState<string | null>(null);
  const [importResult, setImportResult]       = useState<{
    judul: string;
    kode: string;
    detectedType: string;
    sections: Record<string, string>;
    unmatchedSections?: Array<{ title: string; content: string }>;
    fileName: string;
    sourceType: 'docx' | 'pdf';
    sectionCount: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileImport(file: File) {
    setImportLoading(true);
    setImportError(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/documents/import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal memproses berkas');
      }

      setImportResult(json.data);
    } catch (err: any) {
      setImportError(err.message || 'Terjadi kesalahan saat mengunggah');
    } finally {
      setImportLoading(false);
    }
  }

  function handleApplyImport() {
    if (!importResult) return;

    setHeader(prev => ({
      ...prev,
      judul: importResult.judul && !importResult.judul.startsWith('...') && importResult.judul !== 'PROSEDUR OPERASIONAL MUTU' && importResult.judul !== 'FORMULIR MUTU STANDAR'
        ? importResult.judul
        : prev.judul,
      kode: importResult.kode ? importResult.kode : prev.kode,
      jenis: (importResult.detectedType as any) || prev.jenis,
    }));

    setSections(prev => {
      const newSections = { ...prev, ...importResult.sections };
      const newOrd = getOrderedSections(importResult.detectedType || prev.jenis, newSections);
      setOrderedSections(newOrd);
      return newSections;
    });

    setIsDirty(true);
    setImportModalOpen(false);
  }

  // Bagian seksi dinamis berdasarkan orderedSections (auto-renumbering)
  const currentSections = useMemo(() => {
    if (orderedSections.length === 0) {
      const typeSections = DOCUMENT_SECTIONS[header.jenis as DocumentType] || DOCUMENT_SECTIONS['SOP/Prosedur'];
      return typeSections.map((s, idx) => ({
        key: s.key,
        label: `${idx + 1}. ${cleanSectionTitle(s.label)}`,
        title: cleanSectionTitle(s.label),
        hint: s.hint || 'Bagian klausul dokumen.',
        isCustom: false,
      }));
    }
    return orderedSections.map((s, idx) => ({
      key: s.key,
      label: getDisplaySectionLabel(s, idx, header.jenis),
      title: s.title,
      hint: s.isCustom ? 'Seksi klausul kustom dokumen.' : 'Bagian klausul standar dokumen.',
      isCustom: s.isCustom,
    }));
  }, [orderedSections, header.jenis]);

  const sectionLabelsMap = useMemo(() => {
    const map: Record<string, string> = {};
    currentSections.forEach(s => {
      map[s.key] = s.label;
    });
    return map;
  }, [currentSections]);

  const revisionRows = useMemo(() => {
    return getRevisionHistory(
      {
        ...doc,
        kode: header.kode,
        judul: header.judul,
        jenis: header.jenis,
        bidang: header.bidang,
        currentVersion: doc?.currentVersion || '1.0',
        createdAt: doc?.createdAt || doc?.created_at,
        updatedAt: doc?.updatedAt || doc?.updated_at,
        sections,
      },
      doc?.versions || [],
      doc?.approvals || []
    );
  }, [doc, header, sections]);

  // Hitung kelengkapan klausul dokumen
  const filledCount = useMemo(() => {
    return currentSections.filter(s => {
      const raw = (sections[s.key] || '').replace(/<[^>]+>/g, '').trim();
      return raw.length > 0;
    }).length;
  }, [currentSections, sections]);

  const completionPercent = currentSections.length > 0
    ? Math.round((filledCount / currentSections.length) * 100)
    : 0;

  useEffect(() => {
    if (activeSection === 'riwayat_perubahan') return;
    if (currentSections.length > 0 && !currentSections.some(s => s.key === activeSection)) {
      setActiveSection(currentSections[0].key);
    }
  }, [currentSections, activeSection]);

  // Cek apakah ada draf lokal di localStorage browser
  useEffect(() => {
    try {
      const draftKey = `edms_draft_${docId || 'new'}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && parsed.savedAt) {
          setLocalDraftData(parsed);
          setLocalDraftAvailable(true);
        }
      }
    } catch {}
  }, [docId]);

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
      versionRef.current = Number(d.versionNumber ?? d.version_number ?? 1);
      const loadedSections = d.sections || {};
      setSections(loadedSections);
      initialSectionsRef.current = { ...loadedSections };
      const ord = getOrderedSections(d.jenis, loadedSections);
      setOrderedSections(ord);
      setRefs(d.refs || []);
      setIsDirty(false);
      setAutoSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
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
    markDirty();
  }

  function updateSection(key: string, html: string) {
    setSections(s => ({ ...s, [key]: html }));
    markDirty();
  }

  function markDirty() {
    setIsDirty(true);
    setAutoSaveStatus('dirty');

    // Backup ke localStorage seketika
    try {
      const draftKey = `edms_draft_${docId || 'new'}`;
      localStorage.setItem(draftKey, JSON.stringify({
        header,
        sections,
        orderedSections,
        refs,
        savedAt: Date.now(),
      }));
    } catch {}

    // Debounce Auto-Save ke server (4 detik setelah user berhenti mengetik)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      triggerAutoSave();
    }, 4000);
  }

  const triggerAutoSave = async () => {
    if (!header.kode.trim() || !header.judul.trim()) return;
    setAutoSaveStatus('saving');
    try {
      await handleSave(true);
      setAutoSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setAutoSaveStatus('offline');
    }
  };

  async function handleSave(silent = false) {
    if (!header.kode.trim() || !header.judul.trim()) {
      if (!silent) notify('Kode dan judul dokumen wajib diisi!', 'err');
      return;
    }
    setSaving(true);
    if (!silent) setAutoSaveStatus('saving');

    const sectionsPayload = {
      ...sections,
      _section_order: JSON.stringify(orderedSections),
    };

    const payload = {
      ...header,
      sections: sectionsPayload,
      deletedSectionKeys,
      refIds: refs.map(r => r.id),
      references: refs.map(r => r.id),
      versionNumber: versionRef.current,
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
        if (res.status === 409) {
          // Sinkronisasi versionNumber terkini dari server
          try {
            const checkRes = await fetch(`/api/documents/${docId}`);
            if (checkRes.ok) {
              const checkJson = await checkRes.json();
              const latestVer = Number(checkJson.data?.versionNumber ?? checkJson.data?.version_number ?? 1);
              versionRef.current = latestVer;
            }
          } catch {}
        }
        if (!silent) notify(json.error || 'Gagal menyimpan dokumen.', 'err');
        setAutoSaveStatus('offline');
      } else {
        setIsDirty(false);
        setDeletedSectionKeys([]);
        setAutoSaveStatus('saved');
        const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastSavedTime(now);
        if (!silent) notify('Dokumen berhasil disimpan!');
        
        // Hapus backup lokal karena sudah tersimpan di server
        try {
          localStorage.removeItem(`edms_draft_${docId || 'new'}`);
          setLocalDraftAvailable(false);
        } catch {}

        if (isNew && json.data?.id) {
          router.push(`/editor/${json.data.id}`);
        } else {
          const newVer = Number(json.data?.versionNumber ?? json.data?.version ?? (versionRef.current + 1));
          versionRef.current = newVer;
          setDoc((prev: any) => ({
            ...prev,
            versionNumber: newVer,
            version_number: newVer,
          }));
        }
      }
    } catch {
      if (!silent) notify('Koneksi server gagal. Data aman tersimpan di draf lokal browser.', 'err');
      setAutoSaveStatus('offline');
    } finally {
      setSaving(false);
    }
  }

  function handleRestoreLocalDraft() {
    if (!localDraftData) return;
    if (localDraftData.header) setHeader(localDraftData.header);
    if (localDraftData.sections) setSections(localDraftData.sections);
    if (localDraftData.orderedSections) setOrderedSections(localDraftData.orderedSections);
    if (localDraftData.refs) setRefs(localDraftData.refs);
    setIsDirty(true);
    setLocalDraftAvailable(false);
    notify('Draf lokal berhasil dipulihkan!');
  }

  function handleDiscardLocalDraft() {
    try {
      localStorage.removeItem(`edms_draft_${docId || 'new'}`);
      setLocalDraftAvailable(false);
      notify('Draf lokal dibersihkan.');
    } catch {}
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
    setOrderedSections(getOrderedSections(j, tmpl));
    markDirty();
    notify(`Template baku "${j}" berhasil diterapkan!`);
  }

  function handleJenisChange(newJenis: string) {
    setHeader(h => ({ ...h, jenis: newJenis }));
    markDirty();
    if (isNew) {
      const tmpl = getDefaultSectionsForType(newJenis);
      setSections({ ...tmpl });
      setOrderedSections(getOrderedSections(newJenis, tmpl));
      notify(`Format template berganti ke "${newJenis}"`);
    }
  }

  function handleMoveSection(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= orderedSections.length || fromIndex === toIndex) return;
    setOrderedSections(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setIsDirty(true);
    markDirty();
  }

  function handleAddSection() {
    const trimmed = newSectionTitle.trim();
    if (!trimmed) return;
    const newKey = `sec_${Date.now()}`;
    const newSection: DocumentSectionConfig = {
      key: newKey,
      title: trimmed,
      isCustom: true,
    };
    setOrderedSections(prev => [...prev, newSection]);
    setSections(prev => ({
      ...prev,
      [newKey]: '<p>Tuliskan uraian untuk seksi ini...</p>',
    }));
    setActiveSection(newKey);
    setIsDirty(true);
    markDirty();
    setAddSectionModalOpen(false);
    setNewSectionTitle('');
    notify(`Seksi "${trimmed}" berhasil ditambahkan!`);
  }

  function handleDeleteSection(key: string, title: string) {
    if (!confirm(`Hapus seksi "${title}"? Seluruh isi seksi ini akan dihapus.`)) return;
    setOrderedSections(prev => prev.filter(s => s.key !== key));
    setDeletedSectionKeys(prev => [...prev, key]);
    setSections(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (activeSection === key) {
      const remaining = orderedSections.filter(s => s.key !== key);
      if (remaining.length > 0) {
        setActiveSection(remaining[0].key);
      }
    }
    setIsDirty(true);
    markDirty();
    notify(`Seksi "${title}" telah dihapus.`);
  }

  function addRef(ref: any) {
    // 1. Tautkan ke daftar referensi dokumen (untuk database & metadata tab detail)
    if (!refs.find((r: any) => r.id === ref.id)) {
      setRefs(prev => [...prev, ref]);
      markDirty();
    }

    // 2. Sisipkan otomatis ke dalam teks klausul yang sedang aktif / seksi referensi
    const refLine = `<li><strong>[${ref.kategori || 'Standar'}] ${ref.nomor}</strong> — ${ref.judul}</li>`;
    const targetKey = (activeSection && activeSection !== 'riwayat_perubahan')
      ? activeSection
      : (sections.referensi !== undefined ? 'referensi' : (sections.dokumen_referensi !== undefined ? 'dokumen_referensi' : (currentSections[0]?.key || '')));

    if (targetKey) {
      setSections(prev => {
        const currentHtml = prev[targetKey] || '';
        let updatedHtml = '';
        if (currentHtml.includes('</ul>')) {
          updatedHtml = currentHtml.replace('</ul>', `  ${refLine}\n</ul>`);
        } else if (currentHtml.includes('</ol>')) {
          updatedHtml = currentHtml.replace('</ol>', `  ${refLine}\n</ol>`);
        } else if (currentHtml.trim()) {
          updatedHtml = `${currentHtml}\n<ul>\n  ${refLine}\n</ul>`;
        } else {
          updatedHtml = `<ul>\n  ${refLine}\n</ul>`;
        }
        return { ...prev, [targetKey]: updatedHtml };
      });
      markDirty();
    }

    notify(`Referensi "${ref.nomor}" berhasil ditautkan & disisipkan ke isi seksi!`);
    setRefPickerOpen(false);
  }

  function removeRef(id: number) {
    setRefs(prev => prev.filter((r: any) => r.id !== id));
    markDirty();
  }

  // Wizard Navigation
  const activeIdx = currentSections.findIndex(s => s.key === activeSection);
  const prevSection = activeIdx > 0 ? currentSections[activeIdx - 1] : null;
  const nextSection = activeIdx < currentSections.length - 1 ? currentSections[activeIdx + 1] : null;

  function handleWizardPrev() {
    if (prevSection) setActiveSection(prevSection.key);
  }

  async function handleWizardNext() {
    if (nextSection) {
      if (isDirty) triggerAutoSave();
      setActiveSection(nextSection.key);
    } else {
      await handleSave(false);
    }
  }

  // Quick Snippet Insert
  function handleInsertSnippet(snip: ClauseSnippet) {
    const existing = sections[activeSection] || '';
    const updated = existing.trim() ? `${existing}\n${snip.htmlContent}` : snip.htmlContent;
    updateSection(activeSection, updated);
    setSnippetsOpen(false);
    notify(`Klausul "${snip.title}" berhasil disisipkan!`);
  }

  // Find & Replace
  const totalFindMatches = useMemo(() => {
    if (!findText.trim()) return 0;
    let count = 0;
    const re = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    for (const secKey of Object.keys(sections)) {
      const matches = (sections[secKey] || '').match(re);
      if (matches) count += matches.length;
    }
    return count;
  }, [findText, sections]);

  function handleReplaceAll() {
    if (!findText) return;
    const re = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(sections)) {
      updated[k] = (v || '').replace(re, replaceText);
    }
    setSections(updated);
    markDirty();
    notify(`Berhasil mengganti ${totalFindMatches} kecocokan di seluruh seksi dokumen!`);
    setFindReplaceOpen(false);
  }

  const filteredRefs = allRefs.filter(r =>
    r.nomor.toLowerCase().includes(refSearch.toLowerCase()) ||
    r.judul.toLowerCase().includes(refSearch.toLowerCase()) ||
    (r.kategori && r.kategori.toLowerCase().includes(refSearch.toLowerCase()))
  );

  const activeSnippets = getSnippetsForSection(activeSection);

  // Helper untuk rendering lembar A4 Live Preview
  const renderA4LiveSheet = () => {
    const isFormulir = isFormulirType(header.jenis);
    const formHeader = FORMULIR_OFFICIAL_HEADERS[header.jenis] || {
      title: `FORMULIR ${header.judul ? header.judul.toUpperCase() : 'MUTU STANDAR'}`,
      formNo: header.kode || 'FR.UPS.SER3.BMK.01.04-00',
    };
    const formattedDate = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const mgrAppr = doc?.approvals?.find((a: any) => a.stage === 2 && a.action === 'Approve');
    const pimpAppr = doc?.approvals?.find((a: any) => a.stage === 3 && a.action === 'Approve');

    if (isFormulir) {
      return (
        <div className="a4-sheet">
          {/* Kop Formulir Kotak 3-Kolom Baku PLN UP Sertifikasi Sesuai Template Folder Formulir */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, border: '1.5px solid #000' }}>
            <tbody>
              <tr>
                <td style={{ width: '28%', border: '1px solid #000', padding: '8px 10px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 900, color: '#005f73', letterSpacing: 0.5 }}>DANANTARA</span>
                    <span style={{ height: 14, width: 1.5, background: '#94a3b8' }}></span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#0b192c' }}>PLN</span>
                  </div>
                  <div style={{ fontSize: 8.5, fontWeight: 800, color: '#0b192c', lineHeight: 1.25 }}>
                    PT PLN (PERSERO)<br />UNIT PELAKSANA SERTIFIKASI
                  </div>
                  <div style={{ fontSize: 7, color: '#1d4ed8', marginTop: 3, fontWeight: 500, letterSpacing: '0.01em' }}>
                    Uncontrolled when printed or downloaded
                  </div>
                </td>
                <td style={{ width: '44%', border: '1px solid #000', padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#000', textTransform: 'uppercase' }}>FORMULIR</div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#000', marginTop: 2 }} dangerouslySetInnerHTML={{ __html: formHeader.title }} />
                </td>
                <td style={{ width: '28%', border: '1px solid #000', padding: '8px 10px', fontSize: 8.5, verticalAlign: 'middle', lineHeight: 1.5 }}>
                  <div><strong>Nomor:</strong> {formHeader.formNo || header.kode || '-'}</div>
                  <div><strong>Tanggal:</strong> {formattedDate}</div>
                  <div><strong>Status:</strong> {doc?.status || 'Draft'}</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Lembar Pengesahan Resmi Formulir */}
          <div style={{ margin: '12px 0 14px', border: '1px solid #334155', padding: '8px 10px' }}>
            <div style={{ fontWeight: 800, fontSize: 9.5, color: '#0B192C', letterSpacing: '0.02em', marginBottom: 2 }}>
              LEMBAR PENGESAHAN
            </div>
            <div style={{ fontSize: 8.5, color: '#64748B', marginBottom: 6 }}>Jakarta, {formattedDate}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5 }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', textAlign: 'center', padding: '6px 8px', border: '1px solid #94a3b8' }}>
                    <div style={{ fontWeight: 700, fontSize: 9 }}>Disusun Oleh:</div>
                    <div style={{ fontSize: 8, color: '#64748B', marginTop: 1 }}>Manager Bidang Terkait</div>
                    <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {mgrAppr?.signaturePath ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={mgrAppr.signaturePath} alt="TTD Manager" style={{ maxHeight: 32, maxWidth: 100 }} />
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 8.5 }}>[ Tanda Tangan Digital ]</span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 9, marginTop: 2 }}>
                      {mgrAppr?.actorName || doc?.penyusunName || '( ..................................... )'}
                    </div>
                  </td>
                  <td style={{ width: '50%', textAlign: 'center', padding: '6px 8px', border: '1px solid #94a3b8' }}>
                    <div style={{ fontWeight: 700, fontSize: 9 }}>Disahkan Oleh:</div>
                    <div style={{ fontSize: 8, color: '#64748B', marginTop: 1 }}>Senior Manager UPS</div>
                    <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {pimpAppr?.signaturePath ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={pimpAppr.signaturePath} alt="TTD Pimpinan" style={{ maxHeight: 32, maxWidth: 100 }} />
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 8.5 }}>[ Tanda Tangan Digital ]</span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 9, marginTop: 2 }}>
                      {pimpAppr?.actorName || '( ..................................... )'}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tabel Riwayat Perubahan Tepat di Bawah Lembar Pengesahan */}
          <div style={{ margin: '14px 0 16px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: '#000', letterSpacing: '0.04em', marginBottom: 6, textTransform: 'uppercase', textAlign: 'center' }}>
              RIWAYAT PERUBAHAN
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5, border: '1.5px solid #000' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', fontWeight: 800, textAlign: 'center' }}>
                  <th style={{ width: '5%', padding: '5px 4px', border: '1px solid #000' }}>No</th>
                  <th style={{ width: '14%', padding: '5px 6px', border: '1px solid #000' }}>Tanggal</th>
                  <th style={{ width: '11%', padding: '5px 6px', border: '1px solid #000' }}>Halaman</th>
                  <th style={{ width: '31%', padding: '5px 8px', border: '1px solid #000' }}>Uraian yang Dirubah</th>
                  <th style={{ width: '31%', padding: '5px 8px', border: '1px solid #000' }}>Uraian Perubahan</th>
                  <th style={{ width: '8%', padding: '5px 4px', border: '1px solid #000' }}>Revisi</th>
                </tr>
              </thead>
              <tbody>
                {revisionRows.map(r => (
                  <tr key={r.no}>
                    <td style={{ textAlign: 'center', padding: '5px 4px', border: '1px solid #000' }}>{r.no}</td>
                    <td style={{ textAlign: 'center', padding: '5px 6px', border: '1px solid #000', whiteSpace: 'nowrap' }}>{r.tanggal}</td>
                    <td style={{ textAlign: 'center', padding: '5px 6px', border: '1px solid #000' }}>{r.halaman}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid #000', lineHeight: 1.4 }}>{r.uraianSebelumDiubah}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid #000', lineHeight: 1.4 }}>{r.uraianSetelahDiubah}</td>
                    <td style={{ textAlign: 'center', padding: '5px 4px', border: '1px solid #000', fontWeight: 700 }}>{r.revisi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Konten Formulir Mengalir Sesuai Template Folder Formulir */}
          {currentSections.map(sec => {
            if (sec.key === 'riwayat_perubahan') return null;
            const content = sections[sec.key];
            if (!content || !content.trim()) return null;
            return (
              <div key={sec.key} style={{ marginBottom: 12 }}>
                {sec.key !== 'judul_formulir' && sec.key !== 'isian_formulir' && sec.key !== 'daftar_rekaman' && (
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    {sec.label}
                  </div>
                )}
                <div
                  style={{ fontSize: 10, lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="a4-sheet">
        <div className="a4-kop">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#005f73', letterSpacing: 1 }}>DANANTARA</span>
              <span style={{ height: 18, width: 1.5, background: '#cbd5e1' }}></span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#0b192c' }}>PLN UP SERTIFIKASI</span>
            </div>
            <div style={{ fontSize: 7.5, color: '#1d4ed8', marginTop: 2, fontWeight: 500, letterSpacing: '0.01em' }}>
              Uncontrolled when printed or downloaded
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 9, color: '#64748B' }}>
            <div><strong>KODE:</strong> {header.kode || 'DRAFT'}</div>
            <div><strong>STATUS:</strong> {doc?.status || 'Draft'}</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 9.5 }}>
          <tbody>
            <tr>
              <td style={{ width: '25%', background: '#f8fafc', fontWeight: 'bold' }}>Kode Dokumen</td>
              <td style={{ width: '35%' }}>{header.kode || '-'}</td>
              <td style={{ width: '20%', background: '#f8fafc', fontWeight: 'bold' }}>Versi</td>
              <td style={{ width: '20%' }}>v{doc?.currentVersion || '1.0'}</td>
            </tr>
            <tr>
              <td style={{ background: '#f8fafc', fontWeight: 'bold' }}>Jenis</td>
              <td>{header.jenis}</td>
              <td style={{ background: '#f8fafc', fontWeight: 'bold' }}>Bidang</td>
              <td>{header.bidang || '-'}</td>
            </tr>
          </tbody>
        </table>

        <div className="a4-title">{header.judul || 'JUDUL DOKUMEN MUTU'}</div>

        {/* Lembar Pengesahan Resmi Sesuai Template FR.01.01 / 01.02 / 01.03 */}
        <div style={{ margin: '14px 0 16px', border: '1px solid #334155', padding: '10px 12px' }}>
          <div style={{ fontWeight: 800, fontSize: 10, color: '#0B192C', letterSpacing: '0.02em', marginBottom: 2 }}>
            LEMBAR PENGESAHAN
          </div>
          <div style={{ fontSize: 9, color: '#64748B', marginBottom: 8 }}>Jakarta, {formattedDate}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', textAlign: 'center', padding: '8px 10px', border: '1px solid #94a3b8' }}>
                  <div style={{ fontWeight: 700, fontSize: 9.5 }}>Disusun Oleh:</div>
                  <div style={{ fontSize: 8.5, color: '#64748B', marginTop: 2 }}>
                    {header.jenis === 'Manual Mutu' ? 'Para Manager Bidang' : 'Manager Bidang Terkait'}
                  </div>
                  <div style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {mgrAppr?.signaturePath ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={mgrAppr.signaturePath} alt="TTD Manager" style={{ maxHeight: 36, maxWidth: 110 }} />
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 9 }}>[ Tanda Tangan Digital ]</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 9.5, marginTop: 2 }}>
                    {mgrAppr?.actorName || doc?.penyusunName || '( ..................................... )'}
                  </div>
                </td>
                <td style={{ width: '50%', textAlign: 'center', padding: '8px 10px', border: '1px solid #94a3b8' }}>
                  <div style={{ fontWeight: 700, fontSize: 9.5 }}>Disahkan Oleh:</div>
                  <div style={{ fontSize: 8.5, color: '#64748B', marginTop: 2 }}>Senior Manager UPS</div>
                  <div style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {pimpAppr?.signaturePath ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={pimpAppr.signaturePath} alt="TTD Pimpinan" style={{ maxHeight: 36, maxWidth: 110 }} />
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 9 }}>[ Tanda Tangan Digital ]</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 9.5, marginTop: 2 }}>
                    {pimpAppr?.actorName || '( ..................................... )'}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Riwayat Perubahan Resmi 6-Kolom Tepat di Bawah Lembar Pengesahan */}
        <div style={{ margin: '14px 0 18px' }}>
          <div style={{ fontWeight: 800, fontSize: 9.5, color: '#0B192C', letterSpacing: '0.04em', marginBottom: 5, textTransform: 'uppercase', textAlign: 'center' }}>
            RIWAYAT PERUBAHAN
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5, border: '1.5px solid #000' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', fontWeight: 800, textAlign: 'center' }}>
                <th style={{ width: '5%', padding: '5px 4px', border: '1px solid #000' }}>No</th>
                <th style={{ width: '14%', padding: '5px 6px', border: '1px solid #000' }}>Tanggal</th>
                <th style={{ width: '11%', padding: '5px 6px', border: '1px solid #000' }}>Halaman</th>
                <th style={{ width: '31%', padding: '5px 8px', border: '1px solid #000' }}>Uraian yang Dirubah</th>
                <th style={{ width: '31%', padding: '5px 8px', border: '1px solid #000' }}>Uraian Perubahan</th>
                <th style={{ width: '8%', padding: '5px 4px', border: '1px solid #000' }}>Revisi</th>
              </tr>
            </thead>
            <tbody>
              {revisionRows.map(r => (
                <tr key={r.no}>
                  <td style={{ textAlign: 'center', padding: '5px 4px', border: '1px solid #000' }}>{r.no}</td>
                  <td style={{ textAlign: 'center', padding: '5px 6px', border: '1px solid #000', whiteSpace: 'nowrap' }}>{r.tanggal}</td>
                  <td style={{ textAlign: 'center', padding: '5px 6px', border: '1px solid #000' }}>{r.halaman}</td>
                  <td style={{ padding: '5px 8px', border: '1px solid #000', lineHeight: 1.4 }}>{r.uraianSebelumDiubah}</td>
                  <td style={{ padding: '5px 8px', border: '1px solid #000', lineHeight: 1.4 }}>{r.uraianSetelahDiubah}</td>
                  <td style={{ textAlign: 'center', padding: '5px 4px', border: '1px solid #000', fontWeight: 700 }}>{r.revisi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {currentSections.map(sec => {
          if (sec.key === 'riwayat_perubahan') return null;
          const content = sections[sec.key];
          if (!content || !content.trim()) return null;
          return (
            <div key={sec.key} style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: '#0b192c', margin: '8px 0 4px', borderBottom: '1px solid #cbd5e1', paddingBottom: 2 }}>
                {sec.label}
              </h3>
              <div
                style={{ fontSize: 10, lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {msg && (
        <div className="notif-bar no-print">
          <div className={`notif ${msgType === 'ok' ? 'success' : 'error'}`}>{msg}</div>
        </div>
      )}

      {/* Local Draft Recovery Banner */}
      {localDraftAvailable && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          padding: '10px 16px',
          borderRadius: 8,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#92400e' }}>
            <span>⚠️</span>
            <span>
              <strong>Ditemukan Draf Lokal Browser:</strong> Ada ketikan yang belum tersimpan dari sesi sebelumnya
              ({new Date(localDraftData?.savedAt || 0).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}).
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-xs btn-primary"
              style={{ background: '#d97706', borderColor: '#b45309' }}
              onClick={handleRestoreLocalDraft}
            >
              Pulihkan Draf
            </button>
            <button
              type="button"
              className="btn btn-xs btn-outline"
              onClick={handleDiscardLocalDraft}
            >
              Abaikan
            </button>
          </div>
        </div>
      )}

      {/* Main Container or Fullscreen Wrapper */}
      <div className={isFullscreen ? 'editor-fullscreen-container' : ''}>
        {/* Header Bar */}
        <div className={isFullscreen ? 'editor-fullscreen-topbar' : ''} style={!isFullscreen ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 } : {}}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={handleBack}
              className="btn btn-ghost btn-xs"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: isFullscreen ? '#fff' : undefined }}
            >
              <IconArrowLeft size={13} />
              <span>{isFullscreen ? 'Tutup' : 'Daftar Dokumen'}</span>
            </button>
            <div>
              <div style={{ fontSize: isFullscreen ? 14 : 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{isNew ? 'Buat Dokumen Baru' : (doc?.kode || 'Edit Dokumen')}</span>
                <span className="badge badge-aktif" style={{ fontSize: 11, padding: '2px 8px' }}>
                  v{doc?.currentVersion || '1.0'}
                </span>
              </div>
              {isFullscreen && (
                <div style={{ fontSize: 11, opacity: 0.8, maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {header.judul || 'Dokumen Tanpa Judul'}
                </div>
              )}
            </div>
          </div>

          {/* Quick Tools & Save Indicator */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Auto-save status badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 20,
              background: autoSaveStatus === 'saved' ? '#dcfce7' : autoSaveStatus === 'saving' ? '#fef3c7' : autoSaveStatus === 'offline' ? '#fee2e2' : '#f1f5f9',
              color: autoSaveStatus === 'saved' ? '#166534' : autoSaveStatus === 'saving' ? '#92400e' : autoSaveStatus === 'offline' ? '#991b1b' : '#475569',
              fontWeight: 500,
            }}>
              <span style={{
                height: 7,
                width: 7,
                borderRadius: '50%',
                background: autoSaveStatus === 'saved' ? '#16a34a' : autoSaveStatus === 'saving' ? '#d97706' : autoSaveStatus === 'offline' ? '#dc2626' : '#94a3b8',
              }}></span>
              <span>
                {autoSaveStatus === 'saving' ? 'Menyimpan...' :
                 autoSaveStatus === 'saved' ? `Tersimpan ${lastSavedTime ? '(' + lastSavedTime + ')' : ''}` :
                 autoSaveStatus === 'offline' ? 'Tersimpan Lokal' :
                 'Draf Belum Disimpan'}
              </span>
            </div>

            {/* Split Preview Toggle */}
            <button
              type="button"
              className={`btn btn-xs ${isSplitPreview ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setIsSplitPreview(!isSplitPreview)}
              title="Tampilkan pratinjau lembar kertas A4 langsung berdampingan dengan editor"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: isFullscreen && !isSplitPreview ? '#fff' : undefined }}
            >
              <span>📄 {isSplitPreview ? 'Tutup Pratinjau' : 'Pratinjau Kertas'}</span>
            </button>

            {/* Import Word / PDF Button */}
            <button
              type="button"
              className="btn btn-xs btn-outline"
              onClick={() => { setImportResult(null); setImportError(null); setImportModalOpen(true); }}
              title="Unggah berkas Word (.docx) atau PDF untuk membaca dan mengekstrak seluruh klausul dokumen langsung ke editor"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: isFullscreen ? '#fff' : undefined }}
            >
              <IconFileText size={13} />
              <span>Impor Word / PDF</span>
            </button>

            {/* Find & Replace */}
            <button
              type="button"
              className="btn btn-xs btn-outline"
              onClick={() => setFindReplaceOpen(true)}
              title="Cari & Ganti istilah di seluruh seksi dokumen"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: isFullscreen ? '#fff' : undefined }}
            >
              <IconSearch size={13} />
              <span>Cari & Ganti</span>
            </button>

            {/* Fullscreen / Focus Mode Toggle */}
            <button
              type="button"
              className={`btn btn-xs ${isFullscreen ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Keluar dari mode layar penuh' : 'Masuk mode layar penuh tanpa distraksi'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: isFullscreen ? '#fff' : undefined }}
            >
              <span>{isFullscreen ? '🗗 Keluar Fokus' : '🗖 Layar Penuh'}</span>
            </button>

            {/* Save Button */}
            <button className="btn btn-sm btn-primary" onClick={() => handleSave(false)} disabled={saving}>
              <IconCheck size={15} />
              <span>{saving ? 'Menyimpan...' : (isDirty ? 'Simpan Perubahan *' : 'Simpan Dokumen')}</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className={isFullscreen ? 'editor-fullscreen-content' : ''}>
          <div style={{ display: 'grid', gridTemplateColumns: isFullscreen ? '240px 1fr' : '280px 1fr', gap: 20 }}>
            
            {/* Left: metadata + nav + progress */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Progress Bar Card */}
              <div className="clause-progress-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 700 }}>
                  <span style={{ color: 'var(--ink)' }}>Kelengkapan Klausul</span>
                  <span style={{ color: completionPercent === 100 ? '#10b981' : '#0284c7' }}>{completionPercent}%</span>
                </div>
                <div className="clause-progress-bar-bg">
                  <div className="clause-progress-bar-fill" style={{ width: `${completionPercent}%` }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{filledCount} dari {currentSections.length} bagian terisi</span>
                  {completionPercent === 100 && <span style={{ color: '#10b981', fontWeight: 600 }}>Siap Review ✓</span>}
                </div>
              </div>

              {/* Section nav */}
              <div className="card card-body" style={{ padding: '14px 12px' }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📑 Seksi Klausul Dokumen</span>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={() => {
                      setNewSectionTitle('');
                      setAddSectionModalOpen(true);
                    }}
                    style={{ fontSize: 11, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    title="Tambah klausul / seksi baru"
                  >
                    <IconPlus size={12} />
                    <span>Tambah</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {currentSections.map((s, idx) => {
                    const isFilled = (sections[s.key] || '').replace(/<[^>]+>/g, '').trim().length > 0;
                    const isActive = activeSection === s.key;
                    const isDragging = draggedIndex === idx;
                    const isOver = dragOverIndex === idx;

                    return (
                      <div
                        key={s.key}
                        draggable
                        onDragStart={(e) => {
                          setDraggedIndex(idx);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(idx));
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverIndex !== idx) setDragOverIndex(idx);
                        }}
                        onDragEnd={() => {
                          setDraggedIndex(null);
                          setDragOverIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedIndex !== null && draggedIndex !== idx) {
                            handleMoveSection(draggedIndex, idx);
                          }
                          setDraggedIndex(null);
                          setDragOverIndex(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          width: '100%',
                          borderRadius: 'var(--r-md)',
                          background: isActive ? 'var(--navy)' : isOver ? '#e0f2fe' : isDragging ? '#f1f5f9' : 'transparent',
                          color: isActive ? '#fff' : 'var(--ink)',
                          border: isOver ? '1.5px dashed #0284c7' : '1px solid transparent',
                          transition: 'all 0.15s ease',
                          opacity: isDragging ? 0.4 : 1,
                        }}
                      >
                        {/* Drag Handle */}
                        <span
                          title="Tahan dan geser (drag & drop) untuk mengatur urutan atau halaman seksi"
                          style={{
                            cursor: 'grab',
                            padding: '8px 3px 8px 6px',
                            color: isActive ? 'rgba(255,255,255,0.6)' : 'var(--ink-muted)',
                            userSelect: 'none',
                            fontSize: 12,
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          ⋮⋮
                        </span>

                        {/* Clickable section title */}
                        <button
                          type="button"
                          onClick={() => setActiveSection(s.key)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            textAlign: 'left',
                            padding: '8px 4px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: isActive ? 700 : 500,
                            color: 'inherit',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.label}>
                            {s.label}
                          </span>
                          <span style={{
                            fontSize: 10,
                            padding: '1px 5px',
                            borderRadius: 4,
                            marginLeft: 4,
                            background: isActive ? 'rgba(255,255,255,0.2)' : isFilled ? '#dcfce7' : '#f1f5f9',
                            color: isActive ? '#fff' : isFilled ? '#166534' : '#94a3b8',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}>
                            {isFilled ? '✓' : '•'}
                          </span>
                        </button>

                        {/* Action buttons: Move Up, Move Down, Delete (if custom) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 1, paddingRight: 4 }}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => { e.stopPropagation(); handleMoveSection(idx, idx - 1); }}
                            title="Pindahkan seksi ke atas"
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: idx === 0 ? 'default' : 'pointer',
                              opacity: idx === 0 ? 0.15 : (isActive ? 0.8 : 0.45),
                              color: 'inherit',
                              padding: '2px 3px',
                              fontSize: 9,
                              lineHeight: 1,
                            }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={idx === currentSections.length - 1}
                            onClick={(e) => { e.stopPropagation(); handleMoveSection(idx, idx + 1); }}
                            title="Pindahkan seksi ke bawah"
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: idx === currentSections.length - 1 ? 'default' : 'pointer',
                              opacity: idx === currentSections.length - 1 ? 0.15 : (isActive ? 0.8 : 0.45),
                              color: 'inherit',
                              padding: '2px 3px',
                              fontSize: 9,
                              lineHeight: 1,
                            }}
                          >
                            ▼
                          </button>
                          {s.isCustom && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteSection(s.key, s.title); }}
                              title="Hapus seksi klausul ini"
                              style={{
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                color: isActive ? '#fca5a5' : '#ef4444',
                                padding: '1px 3px',
                                fontSize: 13,
                                lineHeight: 1,
                                fontWeight: 700,
                                marginLeft: 1,
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tombol Tambah Seksi di Bawah Daftar */}
                <button
                  type="button"
                  onClick={() => {
                    setNewSectionTitle('');
                    setAddSectionModalOpen(true);
                  }}
                  className="btn btn-outline btn-xs"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8, fontSize: 11.5, gap: 5 }}
                  title="Tambah klausul / seksi baru"
                >
                  <IconPlus size={13} />
                  <span>Tambah Seksi Baru</span>
                </button>

                {/* Riwayat Perubahan Nav Item */}
                <button
                  type="button"
                  onClick={() => setActiveSection('riwayat_perubahan')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 'var(--r-md)',
                    border: activeSection === 'riwayat_perubahan' ? 'none' : '1px dashed #cbd5e1',
                    cursor: 'pointer',
                    marginTop: 6,
                    fontSize: 12,
                    fontWeight: activeSection === 'riwayat_perubahan' ? 700 : 600,
                    background: activeSection === 'riwayat_perubahan' ? 'var(--navy)' : '#f8fafc',
                    color: activeSection === 'riwayat_perubahan' ? '#fff' : 'var(--navy)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📋 Riwayat Perubahan
                  </span>
                  <span style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 4,
                    marginLeft: 6,
                    background: activeSection === 'riwayat_perubahan' ? 'rgba(255,255,255,0.2)' : '#e0f2fe',
                    color: activeSection === 'riwayat_perubahan' ? '#fff' : '#0369a1',
                    fontWeight: 700,
                  }}>
                    {revisionRows.length} baris
                  </span>
                </button>
              </div>

              {/* Document metadata card */}
              <div className="card card-body" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 12 }}>Informasi Dokumen</div>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11.5 }}>Kode Dokumen *</label>
                  <input style={{ fontSize: 12, padding: '7px 10px' }} value={header.kode} onChange={e => updateHeader({ kode: e.target.value })} placeholder="SOP.UPS.XX.2026" readOnly={!isNew} />
                </div>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11.5 }}>Judul *</label>
                  <input style={{ fontSize: 12, padding: '7px 10px' }} value={header.judul} onChange={e => updateHeader({ judul: e.target.value })} placeholder="Judul dokumen..." />
                </div>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11.5 }}>Bidang *</label>
                  <input style={{ fontSize: 12, padding: '7px 10px' }} value={header.bidang} onChange={e => updateHeader({ bidang: e.target.value })} placeholder="Manajemen Mutu / Sertifikasi" />
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11.5 }}>Jenis Dokumen</label>
                  <select style={{ fontSize: 12, padding: '6px 8px' }} value={header.jenis} onChange={e => handleJenisChange(e.target.value)}>
                    {DOCUMENT_TYPES.map(t => (
                      <option key={t} value={t}>
                        {DOCUMENT_TYPE_LABELS[t] || t}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 11, marginBottom: 10 }}
                  onClick={() => handleApplyTemplate(header.jenis)}
                  title="Terapkan klausul dan kerangka isian resmi dari template Word PLN UPS"
                >
                  <span>Muat Template Baku</span>
                </button>
                <div className="field">
                  <label style={{ fontSize: 11.5 }}>Siklus Review</label>
                  <select style={{ fontSize: 12, padding: '6px 8px' }} value={header.siklusReview} onChange={e => updateHeader({ siklusReview: e.target.value })}>
                    <option value="1 tahun">1 tahun</option>
                    <option value="2 tahun">2 tahun</option>
                    <option value="3 tahun">3 tahun</option>
                  </select>
                </div>
              </div>

              {/* Master References Card */}
              <div className="card card-body" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>📚 Referensi Standar</div>
                  <button type="button" className="btn btn-xs btn-outline" onClick={() => setRefPickerOpen(true)}>+ Tambah</button>
                </div>
                {refs.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', textAlign: 'center', padding: '8px 0' }}>Belum ada referensi ditautkan</div>
                ) : (
                  refs.map((r: any) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid var(--paper-line)', fontSize: 11.5 }}>
                      <span className="badge badge-draft" style={{ fontSize: 9.5, padding: '1px 5px' }}>{r.kategori}</span>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nomor}</div>
                      <button type="button" style={{ border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13 }} onClick={() => removeRef(r.id)}>×</button>
                    </div>
                  ))
                )}
              </div>

              {/* Riwayat Perubahan Card */}
              <div
                className="card card-body"
                style={{ padding: 14, cursor: 'pointer', border: activeSection === 'riwayat_perubahan' ? '1.5px solid var(--navy)' : undefined }}
                onClick={() => setActiveSection('riwayat_perubahan')}
              >
                <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>📋 Riwayat Perubahan</span>
                  <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                    Auto Diff & Manual
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                  Tabel 6-kolom resmi sinkron dengan deteksi perubahan seksi dan input manual.
                </div>
                <div style={{ marginTop: 8, padding: '6px 8px', background: 'var(--paper)', borderRadius: 'var(--r-sm)', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><strong>Total:</strong> {revisionRows.length} baris</div>
                  <span style={{ color: '#0284c7', fontWeight: 600 }}>Buka Editor ➡</span>
                </div>
              </div>
            </div>

            {/* Right: Active Section Editor + Optional Split Preview */}
            <div className={isSplitPreview ? 'editor-split-container' : ''}>
              
              {/* Section Editor Card */}
              <div>
                {/* Riwayat Perubahan Interactive Editor */}
                <div style={{ display: activeSection === 'riwayat_perubahan' ? 'block' : 'none' }}>
                  <div className="card" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                    <RevisionHistoryEditor
                      rows={revisionRows}
                      onChange={updatedRows => {
                        updateSection('riwayat_perubahan', JSON.stringify(updatedRows));
                      }}
                      oldSections={initialSectionsRef.current}
                      newSections={sections}
                      sectionLabels={sectionLabelsMap}
                      currentVersion={doc?.currentVersion || '1.0'}
                      docStatus={doc?.status || 'Draft'}
                    />
                  </div>
                </div>

                {currentSections.map(sec => (
                  <div key={sec.key} style={{ display: activeSection === sec.key ? 'block' : 'none' }}>
                    <div className="card" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                      
                      {/* Section Top Header with Quick Snippet Button */}
                      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--paper-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 16, color: 'var(--navy)' }}>{sec.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>{sec.hint}</div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setRefSearch('');
                              setRefPickerOpen(true);
                            }}
                            className="editor-tool-badge"
                            style={{ borderColor: '#0284c7', color: '#0369a1', background: '#e0f2fe' }}
                            title="Pilih dari Master Referensi Standar dan langsung sisipkan ke klausul ini"
                          >
                            <span>📚 Sisipkan Referensi Standar</span>
                          </button>

                          {activeSnippets.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSnippetsOpen(true)}
                              className="editor-tool-badge"
                              style={{ borderColor: '#f59e0b', color: '#b45309', background: '#fef3c7' }}
                              title="Sisipkan klausul standar ISO yang baku untuk bagian ini"
                            >
                              <span>⚡ Klausul Standar</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Main Editor Component */}
                      <div style={{ minHeight: 420 }}>
                        <TableGridEditor
                          key={`${docId || 'new'}-${sec.key}`}
                          sectionKey={sec.key}
                          sectionLabel={sec.label}
                          content={sections[sec.key] || ''}
                          onChange={html => updateSection(sec.key, html)}
                        />
                      </div>

                      {/* Section Wizard Navigation Bar */}
                      <div className="section-wizard-bar">
                        <div>
                          {prevSection ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={handleWizardPrev}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              <span>⬅ {prevSection.label}</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Bagian Awal Dokumen</span>
                          )}
                        </div>

                        <div>
                          {nextSection ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={handleWizardNext}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              <span>Simpan & Lanjut: {nextSection.label} ➡</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => handleSave(false)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              <IconCheck size={14} />
                              <span>✓ Simpan Seluruh Dokumen</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Split Preview Panel */}
              {isSplitPreview && (
                <div className="editor-split-preview">
                  <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Pratinjau Kertas A4 (Live)</span>
                    <span style={{ fontSize: 11, opacity: 0.7 }}>Otomatis Ter-update</span>
                  </div>
                  {renderA4LiveSheet()}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Quick Snippets Modal */}
      {snippetsOpen && (
        <div className="overlay" style={{ zIndex: 10001 }} onClick={() => setSnippetsOpen(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⚡ Pilihan Klausul Standar ISO ({currentSections.find(s => s.key === activeSection)?.label})</span>
              </div>
              <button className="modal-close" onClick={() => setSnippetsOpen(false)}>×</button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
              Pilih salah satu klausul baku di bawah ini untuk disisipkan langsung ke dalam dokumen:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
              {activeSnippets.map(snip => (
                <div
                  key={snip.id}
                  style={{
                    border: '1px solid var(--paper-line)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    background: '#fff',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>{snip.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>{snip.description}</div>
                    </div>
                    <span className="badge badge-review" style={{ fontSize: 10 }}>{snip.category}</span>
                  </div>
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      maxHeight: 120,
                      overflowY: 'auto',
                      marginBottom: 10,
                      border: '1px solid #e2e8f0',
                    }}
                    dangerouslySetInnerHTML={{ __html: snip.htmlContent }}
                  />
                  <div style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-xs btn-primary"
                      onClick={() => handleInsertSnippet(snip)}
                    >
                      + Sisipkan ke Dokumen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Find & Replace Modal */}
      {findReplaceOpen && (
        <div className="overlay" style={{ zIndex: 10001 }} onClick={() => setFindReplaceOpen(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconSearch size={16} />
                <span>Cari & Ganti Istilah Lintas Seksi</span>
              </div>
              <button className="modal-close" onClick={() => setFindReplaceOpen(false)}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label style={{ fontSize: 12 }}>Teks / Istilah yang Dicari</label>
                <input
                  value={findText}
                  onChange={e => setFindText(e.target.value)}
                  placeholder="Contoh: Manager Bagian"
                  autoFocus
                />
              </div>
              <div className="field">
                <label style={{ fontSize: 12 }}>Ganti Menjadi</label>
                <input
                  value={replaceText}
                  onChange={e => setReplaceText(e.target.value)}
                  placeholder="Contoh: Manager Bidang"
                />
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                {findText.trim() ? (
                  <span>Ditemukan <strong>{totalFindMatches}</strong> kecocokan pada dokumen ini.</span>
                ) : (
                  <span>Ketik kata kunci di atas untuk mencari kecocokan.</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setFindReplaceOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleReplaceAll}
                  disabled={!findText.trim() || totalFindMatches === 0}
                >
                  Ganti Semua ({totalFindMatches})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ref Picker Modal */}
      {refPickerOpen && (
        <div className="overlay" onClick={() => setRefPickerOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Pilih Referensi Standar</div>
              <button className="modal-close" onClick={() => setRefPickerOpen(false)}>×</button>
            </div>
            <input
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--paper-line)', borderRadius: 'var(--r-md)', marginBottom: 12, fontSize: 13 }}
              placeholder="Cari nomor standar ISO, regulasi, atau judul..."
              value={refSearch}
              onChange={e => setRefSearch(e.target.value)}
              autoFocus
            />
            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredRefs.map(r => {
                const isLinked = !!refs.find((lr: any) => lr.id === r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => addRef(r)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 'var(--r-md)',
                      border: isLinked ? '1.5px solid #0284c7' : '1px solid var(--paper-line)',
                      background: isLinked ? '#f0f9ff' : 'var(--paper)',
                      cursor: 'pointer'
                    }}
                    className="card-hover"
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className={`badge badge-${r.kategori === 'Regulasi' ? 'review' : r.kategori === 'Standar' ? 'aktif' : 'draft'}`} style={{ fontSize: 10.5 }}>{r.kategori}</span>
                        <strong style={{ fontSize: 12.5 }}>{r.nomor}</strong>
                      </div>
                      {isLinked && (
                        <span style={{ fontSize: 10.5, color: '#0284c7', fontWeight: 700 }}>✓ Ditautkan</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>{r.judul}</div>
                  </button>
                );
              })}
              {filteredRefs.length === 0 && (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--ink-muted)' }}>Tidak ada referensi yang cocok</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Impor Dokumen (Word / PDF) Modal */}
      {importModalOpen && (
        <div className="overlay" style={{ zIndex: 10002 }} onClick={() => !importLoading && setImportModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconFileText size={18} style={{ color: 'var(--pln-blue)' }} />
                <span>Impor Dokumen (Word .docx / PDF) ke Editor</span>
              </div>
              <button className="modal-close" onClick={() => !importLoading && setImportModalOpen(false)} disabled={importLoading}>×</button>
            </div>

            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.5 }}>
              Unggah file dokumen mutu Anda (format <strong>Microsoft Word .docx</strong> atau <strong>PDF</strong>). Sistem akan secara otomatis membaca dan mengekstrak klausul <em>Tujuan</em>, <em>Ruang Lingkup</em>, <em>Referensi</em>, <em>Alur Prosedur</em>, serta format tabel isian ke dalam editor.
            </div>

            {/* Dropzone Area */}
            {!importResult && (
              <div
                style={{
                  border: '2px dashed var(--paper-line-dark)',
                  borderRadius: 'var(--r-lg)',
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--paper)',
                  cursor: importLoading ? 'wait' : 'pointer',
                  transition: 'all var(--t-fast)',
                }}
                onClick={() => !importLoading && fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (importLoading) return;
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFileImport(f);
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".docx,.pdf"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFileImport(f);
                  }}
                />

                {importLoading ? (
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Sedang membaca & menganalisis seksi dokumen...</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 4 }}>Mengekstrak judul klausul, teks paragraf, dan tabel</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                      Klik untuk memilih berkas atau Tarik & Lepas di sini
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 5 }}>
                      Mendukung berkas <strong>.docx</strong> (Word) dan <strong>.pdf</strong> resmi
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error Banner */}
            {importError && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 12.5 }}>
                <strong>Gagal:</strong> {importError}
              </div>
            )}

            {/* Success Preview Card */}
            {importResult && (
              <div style={{ marginTop: 12, background: 'var(--card)', border: '1px solid var(--paper-line)', borderRadius: 'var(--r-md)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>✅</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                        {importResult.fileName}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>
                        Format: {importResult.sourceType.toUpperCase()} · Ditemukan {importResult.sectionCount} Bagian
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-aktif" style={{ fontSize: 11 }}>
                    {importResult.detectedType}
                  </span>
                </div>

                <div style={{ background: 'var(--paper)', padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
                  <div><strong>Judul Terdeteksi:</strong> {importResult.judul || '(Gunakan judul saat ini)'}</div>
                  {importResult.kode && (
                    <div style={{ marginTop: 3 }}><strong>Kode Terdeteksi:</strong> {importResult.kode}</div>
                  )}
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Seksi Klausul yang Berhasil Dibaca:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto', marginBottom: 16 }}>
                  {Object.keys(importResult.sections).map(k => (
                    <span
                      key={k}
                      style={{
                        fontSize: 11,
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontWeight: 600,
                      }}
                    >
                      ✓ {getSectionLabel(k, importResult.detectedType)}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--paper-line)', paddingTop: 14 }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => { setImportResult(null); setImportError(null); }}
                  >
                    Pilih Berkas Lain
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleApplyImport}
                    style={{ padding: '8px 18px', fontWeight: 700 }}
                  >
                    <span>✓ Terapkan ke Editor</span>
                  </button>
                </div>
              </div>
            )}

            {!importResult && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setImportModalOpen(false)}
                  disabled={importLoading}
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {addSectionModalOpen && (
        <div className="overlay" style={{ zIndex: 10002 }} onClick={() => setAddSectionModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconPlus size={16} />
                <span>Tambah Seksi / Klausul Baru</span>
              </div>
              <button className="modal-close" onClick={() => setAddSectionModalOpen(false)}>×</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleAddSection(); }}>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 14, lineHeight: 1.5 }}>
                Klausul baru akan disisipkan ke daftar seksi dokumen. Anda dapat menggeser urutannya ke atas atau ke bawah kapan saja, dan nomor urut klausul otomatis menyesuaikan.
              </p>
              <div className="field" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Judul Klausul / Seksi *</label>
                <input
                  value={newSectionTitle}
                  onChange={e => setNewSectionTitle(e.target.value)}
                  placeholder="Contoh: Diagram Alir Pelaksanaan, Ketentuan Khusus, Lampiran"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13 }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setAddSectionModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  disabled={!newSectionTitle.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <IconPlus size={14} />
                  <span>Tambahkan Seksi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
