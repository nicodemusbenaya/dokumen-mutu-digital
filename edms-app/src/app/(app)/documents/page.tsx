'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Document } from '@/types';
import { IconPlus, IconSearch, IconFilter } from '@/components/icons/Icons';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/documentTypes';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Semua Status' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Review', label: 'Review Tim Mutu' },
  { value: 'Menunggu Approval', label: 'Menunggu Approval' },
  { value: 'Aktif', label: 'Aktif (Berlaku)' },
  { value: 'Obsolete', label: 'Obsolete' },
];

const STATUS_CLASS: Record<string, string> = {
  'Draft': 'draft',
  'Review': 'review',
  'Menunggu Approval': 'approval',
  'Aktif': 'aktif',
  'Obsolete': 'obsolete',
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
  const [jenis,  setJenis]  = useState(searchParams.get('jenis') || '');
  const [page,   setPage]   = useState(1);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q)      params.set('q', q);
    if (status) params.set('status', status);
    if (bidang) params.set('bidang', bidang);
    if (jenis)  params.set('jenis', jenis);
    params.set('page', String(page));
    const res = await fetch(`/api/documents?${params}`);
    if (res.ok) {
      const json = await res.json();
      setDocs(json.data);
      setTotal(json.total);
    }
    setLoading(false);
  }, [q, status, bidang, jenis, page]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title">Daftar Dokumen Mutu</div>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Register resmi seluruh dokumen mutu terkendali unit. Terdaftar: <strong style={{ color: 'var(--ink)' }}>{total} dokumen</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/editor/new" className="btn btn-primary">
            <IconPlus size={16} />
            <span>Buat Dokumen Baru</span>
          </Link>
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
              width: '100%',
              padding: '8px 12px 8px 34px',
              border: '1px solid var(--paper-line-dark)',
              borderRadius: 'var(--r-md)',
              fontSize: 12.5,
              outline: 'none',
              background: 'var(--card)'
            }}
            placeholder="Cari kode, judul, atau kata kunci..."
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
          />
        </div>

        <select
          style={{ padding: '8px 12px', border: '1px solid var(--paper-line-dark)', borderRadius: 'var(--r-md)', fontSize: 12.5, background: 'var(--card)', color: 'var(--ink)' }}
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          style={{ padding: '8px 12px', border: '1px solid var(--paper-line-dark)', borderRadius: 'var(--r-md)', fontSize: 12.5, background: 'var(--card)', color: 'var(--ink)' }}
          value={jenis}
          onChange={e => { setJenis(e.target.value); setPage(1); }}
        >
          <option value="">Semua Jenis Dokumen</option>
          {DOCUMENT_TYPES.map(t => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t] || t}
            </option>
          ))}
        </select>

        <input
          style={{ padding: '8px 12px', border: '1px solid var(--paper-line-dark)', borderRadius: 'var(--r-md)', fontSize: 12.5, minWidth: 130, background: 'var(--card)' }}
          placeholder="Filter Bidang..."
          value={bidang}
          onChange={e => { setBidang(e.target.value); setPage(1); }}
        />

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setQ(''); setStatus(''); setBidang(''); setJenis(''); setPage(1); }}
        >
          Reset
        </button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: '16%' }}>Kode Dokumen</th>
              <th style={{ width: '32%' }}>Judul Dokumen</th>
              <th>Bidang</th>
              <th>Jenis</th>
              <th>Versi</th>
              <th>Status</th>
              <th>Terakhir Diubah</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, width: ['70%', '85%', '60%', '75%', '50%', '65%', '80%', '60%'][j % 8] }} /></td>
                  ))}
                </tr>
              ))
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--ink-muted)' }}>
                  Tidak ada dokumen mutu yang sesuai dengan kriteria pencarian.
                </td>
              </tr>
            ) : docs.map((d: any) => (
              <tr key={d.id} className="row-click" onClick={() => router.push(`/documents/${d.id}`)}>
                <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: 'var(--ink)' }}>
                  {d.kode}
                </td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{d.judul}</div>
                  {d.penyusun_name && (
                    <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>
                      Penyusun: {d.penyusun_name}
                    </div>
                  )}
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{d.bidang}</td>
                <td style={{ fontSize: 12, color: 'var(--ink-mid)' }}>{d.jenis}</td>
                <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>v{d.current_version}</td>
                <td>
                  <span className={`badge badge-${STATUS_CLASS[d.status] ?? 'draft'}`}>{d.status}</span>
                </td>
                <td style={{ fontSize: 11.5, color: 'var(--ink-soft)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(d.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td onClick={e => e.stopPropagation()} style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Link href={`/documents/${d.id}`} className="btn btn-ghost btn-xs">
                      Detail
                    </Link>
                    {d.status === 'Draft' && (
                      <Link href={`/editor/${d.id}`} className="btn btn-xs btn-outline">
                        Edit
                      </Link>
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
