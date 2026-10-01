'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { TemplateRow } from '@/types';
import { IconSearch, IconTemplate, IconPlus } from '@/components/icons/Icons';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/documentTypes';
import TemplateForm from '@/components/template/TemplateForm';

// Pustaka Template Dokumen (RENCANA §6.1) — menu hanya terlihat untuk role
// dengan document:create; API isTemplate=1 juga menegakkan hal itu.

const PAGE_SIZE = 48;

export default function TemplatesPage() {
  const [items,   setItems]   = useState<TemplateRow[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [q,       setQ]       = useState('');
  const [jenis,   setJenis]   = useState('');
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [formTemplate, setFormTemplate] = useState<TemplateRow | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchTemplates = useCallback(async () => {
    // Catatan: tidak ada setState sinkron di sini — semua setelah await
    // (react-hooks/set-state-in-effect). loading=true di-set dari handler event.
    const params = new URLSearchParams();
    params.set('isTemplate', '1');
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (q)     params.set('q', q);
    if (jenis) params.set('jenis', jenis);
    try {
      const res = await fetch(`/api/documents?${params}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data || []);
        setTotal(json.total || 0);
        setForbidden(false);
        const lastPage = Math.max(1, Math.ceil((json.total || 0) / PAGE_SIZE));
        if (page > lastPage) setPage(lastPage);
      } else if (res.status === 403) {
        setForbidden(true);
      }
    } finally {
      setLoading(false);
    }
  }, [q, jenis, page]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  if (forbidden) {
    return (
      <div className="card card-body" style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Akses ditolak</div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Pustaka Template hanya tersedia untuk Penyusun Dokumen dan Admin Sistem.
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title">Pustaka Template Dokumen</div>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Master template siap salin — blanko hasil import & template bawaan sistem. Terdaftar:{' '}
            <strong style={{ color: 'var(--ink)' }}>{total} template</strong>
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card card-body" style={{ marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', padding: '14px 18px', alignItems: 'center' }}>
        <div style={{ flex: 2, minWidth: 220, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 12, color: 'var(--ink-muted)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
            <IconSearch size={15} />
          </span>
          <input
            style={{
              width: '100%', padding: '8px 12px 8px 34px',
              border: '1px solid var(--paper-line-dark)', borderRadius: 'var(--r-md)',
              fontSize: 12.5, outline: 'none', background: 'var(--card)',
            }}
            placeholder="Cari kode, judul, atau bidang template..."
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); setLoading(true); }}
          />
        </div>

        <select
          style={{
            padding: '8px 12px', border: '1px solid var(--paper-line-dark)',
            borderRadius: 'var(--r-md)', fontSize: 12.5, background: 'var(--card)', color: 'var(--ink)',
          }}
          value={jenis}
          onChange={e => { setJenis(e.target.value); setPage(1); setLoading(true); }}
        >
          <option value="">Semua Jenis Dokumen</option>
          {DOCUMENT_TYPES.map(t => (
            <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t] || t}</option>
          ))}
        </select>

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setQ(''); setJenis(''); setPage(1); setLoading(true); }}
        >
          Reset
        </button>
      </div>

      {/* Cards */}
      {loading && items.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 150, borderRadius: 'var(--r-md)' }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card card-body" style={{ textAlign: 'center', padding: 60 }}>
          <IconTemplate size={34} className="" style={{ color: 'var(--ink-muted)', margin: '0 auto 10px' }} />
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Tidak ada template ditemukan</div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            Coba ubah kata kunci pencarian, atau tandai dokumen lewat tombol “Jadikan Template” di halaman detail.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {items.map(t => (
            <div
              key={t.id}
              className="card"
              style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <code style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: 'var(--ink)' }}>
                  {t.kode}
                </code>
                <span className={`badge badge-${t.status === 'Aktif' ? 'aktif' : t.status === 'Obsolete' ? 'obsolete' : 'draft'}`}>
                  {t.status || 'Draft'}
                </span>
              </div>

              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', lineHeight: 1.45 }}>
                {t.judul}
              </div>

              <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                {t.jenis} · {t.bidang}
                {typeof t.sectionCount === 'number' && ` · ${t.sectionCount} seksi`}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => setFormTemplate(t)}
                >
                  <IconPlus size={14} />
                  <span>Buat Dokumen dari Template</span>
                </button>
                <Link href={`/documents/${t.id}`} className="btn btn-ghost btn-sm">
                  Detail
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18, alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setPage(p => Math.max(1, p - 1)); setLoading(true); }}
            disabled={page === 1 || loading}
          >
            Sebelumnya
          </button>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums', padding: '0 8px' }}>
            Halaman {page} dari {totalPages}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setLoading(true); }}
            disabled={page === totalPages || loading}
          >
            Selanjutnya
          </button>
        </div>
      )}

      {/* Form buat dari template */}
      {formTemplate && (
        <TemplateForm template={formTemplate} onClose={() => setFormTemplate(null)} />
      )}
    </>
  );
}
