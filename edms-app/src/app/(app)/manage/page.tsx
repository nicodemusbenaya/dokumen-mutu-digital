'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Document, DocumentDetail } from '@/types';

export default function ManagePage() {
  const searchParams = useSearchParams();
  const initialDocId = searchParams.get('id');

  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(initialDocId ? parseInt(initialDocId) : null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'isi' | 'riwayat' | 'info'>('isi');
  const [collapsedBidangs, setCollapsedBidangs] = useState<Record<string, boolean>>({});

  // Fetch all documents
  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents?limit=100');
      if (res.ok) {
        const json = await res.json();
        setDocs(json.data || []);
        if (!selectedId && json.data?.length > 0) {
          setSelectedId(json.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load documents', err);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  // Fetch detail for selected document
  const fetchDocDetail = useCallback(async (id: number) => {
    setDocLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedDoc(json.data);
      }
    } catch (err) {
      console.error('Failed to load doc detail', err);
    } finally {
      setDocLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  useEffect(() => {
    if (selectedId) {
      fetchDocDetail(selectedId);
    }
  }, [selectedId, fetchDocDetail]);

  // Group docs by bidang
  const groupedDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = docs.filter(d =>
      !q ||
      d.kode.toLowerCase().includes(q) ||
      d.judul.toLowerCase().includes(q) ||
      d.bidang.toLowerCase().includes(q)
    );

    const groups: Record<string, Document[]> = {};
    for (const d of filtered) {
      if (!groups[d.bidang]) groups[d.bidang] = [];
      groups[d.bidang].push(d);
    }
    return groups;
  }, [docs, search]);

  function toggleBidang(bidang: string) {
    setCollapsedBidangs(prev => ({ ...prev, [bidang]: !prev[bidang] }));
  }

  function getDotClass(status: string) {
    switch (status) {
      case 'Aktif': return 'dot-aktif';
      case 'Review': return 'dot-review';
      case 'Menunggu Approval': return 'dot-approval';
      case 'Obsolete': return 'dot-obsolete';
      default: return 'dot-draft';
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div className="page-title">Manajemen Dokumen</div>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Telusuri dokumen per bidang, buka isi, lihat riwayat versi, atau unduh PDF.
          </p>
        </div>
        <Link href="/editor/new" className="btn btn-primary">
          ＋ Dokumen Baru
        </Link>
      </div>

      <div style={{ marginBottom: 16 }}>
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
          placeholder="🔍 Cari kode, judul, atau bidang dokumen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="manage-layout">
        {/* Left column: Tree Explorer */}
        <div className="tree-panel">
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13 }}>
              Memuat daftar dokumen...
            </div>
          ) : Object.keys(groupedDocs).length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13 }}>
              Tidak ada dokumen yang sesuai
            </div>
          ) : (
            Object.entries(groupedDocs).map(([bidang, bDocs]) => {
              const isCollapsed = !!collapsedBidangs[bidang];
              return (
                <div key={bidang} className={`tree-group ${isCollapsed ? 'collapsed' : ''}`}>
                  <div className="tree-group-head" onClick={() => toggleBidang(bidang)}>
                    <span className="chev">▼</span>
                    <span>{bidang}</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--ink-soft)', fontWeight: 400, fontSize: 12 }}>
                      {bDocs.length}
                    </span>
                  </div>
                  <div className="tree-children">
                    {bDocs.map(d => (
                      <div
                        key={d.id}
                        className={`tree-item ${d.id === selectedId ? 'selected' : ''}`}
                        onClick={() => setSelectedId(d.id)}
                      >
                        <span className={`dot ${getDotClass(d.status)}`}></span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <strong>{d.kode}</strong> - {d.judul}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right column: Document Detail Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 560 }}>
          {docLoading ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-soft)' }}>
              Memuat detail dokumen...
            </div>
          ) : selectedDoc ? (
            <>
              <div className="doc-detail-head">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="dcode">
                      <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{selectedDoc.kode}</span> · v{selectedDoc.currentVersion || (selectedDoc as any).current_version} ·{' '}
                      <span className={`badge badge-${selectedDoc.status === 'Aktif' ? 'aktif' : selectedDoc.status === 'Review' ? 'review' : selectedDoc.status === 'Menunggu Approval' ? 'approval' : 'draft'}`} style={{ fontSize: 10.5 }}>
                        {selectedDoc.status}
                      </span>
                    </div>
                    <div className="doc-detail-title">{selectedDoc.judul}</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link href={`/editor/${selectedDoc.id}`} className="btn btn-outline btn-sm">
                      ✏️ Edit Dokumen
                    </Link>
                    <Link href={`/pdf?id=${selectedDoc.id}`} className="btn btn-ghost btn-sm">
                      📑 Cetak / PDF
                    </Link>
                    <Link href={`/documents/${selectedDoc.id}`} className="btn btn-primary btn-sm">
                      🔍 Lihat Lengkap
                    </Link>
                  </div>
                </div>

                <div className="tab-bar">
                  <button
                    className={`tab-btn ${activeTab === 'isi' ? 'active' : ''}`}
                    onClick={() => setActiveTab('isi')}
                  >
                    📄 Isi Dokumen
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'riwayat' ? 'active' : ''}`}
                    onClick={() => setActiveTab('riwayat')}
                  >
                    ⏱ Riwayat Versi
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
                    onClick={() => setActiveTab('info')}
                  >
                    ℹ️ Info & Metadata
                  </button>
                </div>
              </div>

              <div className="doc-detail-body">
                {activeTab === 'isi' && (
                  <div>
                    {selectedDoc.sections && Object.keys(selectedDoc.sections).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {[
                          { key: 'tujuan', label: '1. Tujuan' },
                          { key: 'ruang_lingkup', label: '2. Ruang Lingkup' },
                          { key: 'definisi', label: '3. Definisi & Istilah' },
                          { key: 'prosedur', label: '4. Prosedur' },
                          { key: 'lampiran', label: '5. Lampiran' },
                        ].map(sec => (
                          <div key={sec.key} style={{ background: 'var(--paper)', padding: '16px 20px', borderRadius: 'var(--r-md)', border: '1px solid var(--paper-line)' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 8 }}>
                              {sec.label}
                            </div>
                            <div
                              style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink)' }}
                              dangerouslySetInnerHTML={{
                                __html: selectedDoc.sections[sec.key] || '<span style="color:var(--ink-muted);font-style:italic">Belum ada isi seksi ini.</span>'
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-muted)' }}>
                        Konten dokumen belum diisi.{' '}
                        <Link href={`/editor/${selectedDoc.id}`} style={{ color: 'var(--navy)', textDecoration: 'underline' }}>
                          Buka di Editor
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'riwayat' && (
                  <div>
                    {selectedDoc.versions && selectedDoc.versions.length > 0 ? (
                      <ul className="vhist">
                        {selectedDoc.versions.map((v, i) => (
                          <li key={v.id || i}>
                            <div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span className="vtag">v{v.version}</span>
                                <span className="badge badge-draft" style={{ fontSize: 10 }}>{v.status}</span>
                              </div>
                              <div className="vnote">{v.deskripsi || 'Arsip versi terdahulu'}</div>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                              {v.archivedAt ? new Date(v.archivedAt).toLocaleDateString('id-ID') : '-'}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-muted)' }}>
                        Belum ada arsip versi sebelumnya (dokumen ini merupakan versi pertama v{selectedDoc.currentVersion || '1.0'}).
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'info' && (
                  <div>
                    <div className="meta-grid">
                      <div className="mi">
                        <label>Kode Dokumen</label>
                        <div className="mv">{selectedDoc.kode}</div>
                      </div>
                      <div className="mi">
                        <label>Jenis Dokumen</label>
                        <div className="mv">{selectedDoc.jenis}</div>
                      </div>
                      <div className="mi">
                        <label>Bidang Pemilik</label>
                        <div className="mv">{selectedDoc.bidang}</div>
                      </div>
                      <div className="mi">
                        <label>Status</label>
                        <div className="mv">{selectedDoc.status}</div>
                      </div>
                      <div className="mi">
                        <label>Siklus Review</label>
                        <div className="mv">{selectedDoc.siklusReview || '2 tahun'}</div>
                      </div>
                      <div className="mi">
                        <label>Penyusun</label>
                        <div className="mv">{selectedDoc.penyusunName || 'Tim Dokumen Mutu'}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 24 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)', marginBottom: 12 }}>
                        📚 Referensi Terkait ({selectedDoc.refs?.length || 0})
                      </div>
                      {selectedDoc.refs && selectedDoc.refs.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {selectedDoc.refs.map(r => (
                            <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--paper)', padding: '10px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--paper-line)' }}>
                              <span className={`badge badge-${r.kategori === 'Regulasi' ? 'review' : r.kategori === 'Standar' ? 'aktif' : 'draft'}`} style={{ fontSize: 10.5 }}>
                                {r.kategori}
                              </span>
                              <div>
                                <strong style={{ fontSize: 12.5 }}>{r.nomor}</strong> - <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{r.judul}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--ink-muted)', fontSize: 13 }}>
                          Tidak ada referensi yang ditautkan ke dokumen ini.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ padding: 80, textAlign: 'center', color: 'var(--ink-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Pilih dokumen dari daftar di kiri</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Klik salah satu dokumen pada panel bidang untuk melihat isi dan riwayatnya.</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
