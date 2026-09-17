'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Document } from '@/types';
import { IconPlus, IconSearch, IconEditor } from '@/components/icons/Icons';

export default function EditorIndexPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/documents?limit=50');
        if (res.ok) {
          const json = await res.json();
          setDocs(json.data || []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = docs.filter(d =>
    !q ||
    d.kode.toLowerCase().includes(q.toLowerCase()) ||
    d.judul.toLowerCase().includes(q.toLowerCase()) ||
    d.bidang.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title">Editor Dokumen Mutu Terstruktur</div>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Pilih dokumen yang ingin diedit atau buat dokumen mutu baru sesuai template klausul resmi.
          </p>
        </div>
        <Link href="/editor/new" className="btn btn-primary">
          <IconPlus size={16} />
          <span>Buat Dokumen Baru</span>
        </Link>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 14, color: 'var(--ink-muted)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
            <IconSearch size={16} />
          </span>
          <input
            style={{
              width: '100%',
              padding: '10px 16px 10px 40px',
              border: '1px solid var(--paper-line-dark)',
              borderRadius: 'var(--r-md)',
              fontSize: 13,
              outline: 'none',
              background: 'var(--card)',
              color: 'var(--ink)'
            }}
            placeholder="Cari kode dokumen, judul, atau bidang..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: '18%' }}>Kode Dokumen</th>
              <th style={{ width: '34%' }}>Judul Dokumen</th>
              <th>Bidang</th>
              <th>Jenis</th>
              <th>Versi</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>
                  Memuat dokumen...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--ink-muted)' }}>
                  Tidak ada dokumen ditemukan. Silakan{' '}
                  <Link href="/editor/new" style={{ color: 'var(--pln-blue)', textDecoration: 'underline' }}>
                    buat dokumen baru
                  </Link>.
                </td>
              </tr>
            ) : (
              filtered.map(d => (
                <tr key={d.id}>
                  <td>
                    <code style={{ fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                      {d.kode}
                    </code>
                  </td>
                  <td>
                    <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{d.judul}</strong>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{d.bidang}</td>
                  <td>
                    <span style={{ fontSize: 12, color: 'var(--ink-mid)' }}>{d.jenis}</span>
                  </td>
                  <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    v{d.currentVersion || (d as any).current_version}
                  </td>
                  <td>
                    <span
                      className={`badge badge-${d.status === 'Aktif' ? 'aktif' : d.status === 'Review' ? 'review' : d.status === 'Menunggu Approval' ? 'approval' : 'draft'}`}
                      style={{ fontSize: 11 }}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={`/editor/${d.id}`} className="btn btn-outline btn-xs">
                      <IconEditor size={13} />
                      <span>Buka Editor</span>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
