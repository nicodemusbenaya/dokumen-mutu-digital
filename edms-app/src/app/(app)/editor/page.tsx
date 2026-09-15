'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Document } from '@/types';

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div className="page-title">Editor Dokumen Mutu</div>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Pilih dokumen yang ingin diedit atau buat dokumen baru dengan standar seksi terstruktur.
          </p>
        </div>
        <Link href="/editor/new" className="btn btn-primary">
          ＋ Buat Dokumen Baru
        </Link>
      </div>

      <div style={{ marginBottom: 18 }}>
        <input
          style={{
            width: '100%',
            padding: '11px 16px',
            border: '1.5px solid var(--paper-line)',
            borderRadius: 'var(--r-md)',
            fontSize: 13.5,
            outline: 'none',
            background: 'var(--card)',
            color: 'var(--ink)'
          }}
          placeholder="🔍 Cari dokumen yang ingin diedit..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Judul Dokumen</th>
                <th>Bidang</th>
                <th>Jenis</th>
                <th>Versi</th>
                <th>Status</th>
                <th>Aksi</th>
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
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-muted)' }}>
                    Tidak ada dokumen ditemukan. Silakan{' '}
                    <Link href="/editor/new" style={{ color: 'var(--navy)', textDecoration: 'underline' }}>
                      buat dokumen baru
                    </Link>.
                  </td>
                </tr>
              ) : (
                filtered.map(d => (
                  <tr key={d.id}>
                    <td>
                      <code style={{ fontWeight: 700, color: 'var(--navy)' }}>{d.kode}</code>
                    </td>
                    <td>
                      <strong>{d.judul}</strong>
                    </td>
                    <td>{d.bidang}</td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{d.jenis}</span>
                    </td>
                    <td>v{d.currentVersion || (d as any).current_version}</td>
                    <td>
                      <span
                        className={`badge badge-${d.status === 'Aktif' ? 'aktif' : d.status === 'Review' ? 'review' : d.status === 'Menunggu Approval' ? 'approval' : 'draft'}`}
                        style={{ fontSize: 11 }}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/editor/${d.id}`} className="btn btn-outline btn-sm">
                        ✏️ Buka Editor
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
