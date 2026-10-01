'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TemplateRow } from '@/types';
import { IconSearch, IconTemplate } from '@/components/icons/Icons';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/documentTypes';

// Dialog pemilih template (RENCANA §6.2 — "Dokumen Baru → Dari template…").
// Mencari di pustaka /api/documents?isTemplate=1; hasil dipilih → onSelect.

const PICKER_PAGE_SIZE = 50;

export default function TemplatePicker({
  onSelect,
  onClose,
}: {
  onSelect: (t: TemplateRow) => void;
  onClose: () => void;
}) {
  const [items,  setItems]  = useState<TemplateRow[]>([]);
  const [total,  setTotal]  = useState(0);
  const [page,   setPage]   = useState(1);
  const [q,      setQ]      = useState('');
  const [jenis,  setJenis]  = useState('');
  const [loading,setLoading]= useState(true);

  const fetchTemplates = useCallback(async () => {
    // Tanpa setState sinkron di sini — semua setelah await
    // (react-hooks/set-state-in-effect); loading=true di-set dari handler event.
    const params = new URLSearchParams();
    params.set('isTemplate', '1');
    params.set('page', String(page));
    params.set('limit', String(PICKER_PAGE_SIZE));
    if (q)     params.set('q', q);
    if (jenis) params.set('jenis', jenis);
    try {
      const res = await fetch(`/api/documents?${params}`);
      if (res.ok) {
        const json = await res.json();
        setItems(prev => (page === 1 ? json.data : [...prev, ...json.data]));
        setTotal(json.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [q, jenis, page]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Reset halaman di handler (bukan effect) agar tidak balapan dengan fetch
  // saat query/jenis berubah — satu batch React = satu fetch dengan page=1.
  function resetAnd<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setPage(1);
    setItems([]);
    setLoading(true);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconTemplate size={16} />
            <span>Pilih Template Dokumen</span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 200, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 12, color: 'var(--ink-muted)', display: 'flex', pointerEvents: 'none' }}>
              <IconSearch size={15} />
            </span>
            <input
              style={{
                width: '100%', padding: '8px 12px 8px 34px',
                border: '1px solid var(--paper-line-dark)', borderRadius: 'var(--r-md)',
                fontSize: 12.5, outline: 'none', background: 'var(--card)',
              }}
              placeholder="Cari kode atau judul template..."
              value={q}
              onChange={e => resetAnd(setQ, e.target.value)}
            />
          </div>
          <select
            style={{
              padding: '8px 12px', border: '1px solid var(--paper-line-dark)',
              borderRadius: 'var(--r-md)', fontSize: 12.5, background: 'var(--card)', color: 'var(--ink)',
            }}
            value={jenis}
            onChange={e => resetAnd(setJenis, e.target.value)}
          >
            <option value="">Semua Jenis</option>
            {DOCUMENT_TYPES.map(t => (
              <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t] || t}</option>
            ))}
          </select>
        </div>

        <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && items.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--r-md)' }} />
            ))
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: 36, fontSize: 13 }}>
              Tidak ada template yang sesuai.
            </div>
          ) : (
            items.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t)}
                style={{
                  textAlign: 'left', cursor: 'pointer', padding: '11px 14px',
                  border: '1px solid var(--paper-line)', borderRadius: 'var(--r-md)',
                  background: 'var(--card)', display: 'flex', gap: 12,
                  alignItems: 'center', justifyContent: 'space-between',
                  transition: 'border-color .15s, background .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--pln-blue, #0C4DA2)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--paper-line)'; }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <code style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: 'var(--ink)' }}>
                      {t.kode}
                    </code>
                    <span className={`badge badge-${t.status === 'Aktif' ? 'aktif' : t.status === 'Obsolete' ? 'obsolete' : 'draft'}`}>
                      {t.status || 'Draft'}
                    </span>
                  </span>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginTop: 3 }}>
                    {t.judul}
                  </span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                    {t.jenis} · {t.bidang}
                    {typeof t.sectionCount === 'number' && ` · ${t.sectionCount} seksi`}
                  </span>
                </span>
                <span className="btn btn-outline btn-xs" style={{ flexShrink: 0 }}>Pilih</span>
              </button>
            ))
          )}

          {items.length < total && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setPage(p => p + 1); setLoading(true); }}
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? 'Memuat...' : `Muat lebih banyak (${items.length}/${total})`}
            </button>
          )}
        </div>

        <div className="modal-footer">
          <span style={{ fontSize: 12, color: 'var(--ink-muted)', marginRight: 'auto' }}>
            {total} template tersedia
          </span>
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}
