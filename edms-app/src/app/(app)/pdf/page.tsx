'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Document, DocumentDetail } from '@/types';
import { DOCUMENT_SECTIONS, DocumentType, getSectionLabel, getOrderedSections, getDisplaySectionLabel } from '@/lib/documentTypes';
import { injectSignaturesIntoFormHtml } from '@/lib/pdf-utils';
import { getRevisionHistory, RevisionRow } from '@/lib/revisionUtils';
import { IconEditor, IconDownload, IconSearch } from '@/components/icons/Icons';
import Image from 'next/image';

const FORMULIR_TYPES = new Set([
  'Formulir Standar (FR.01.04)',
  'Berita Acara Pemusnahan (FR.01.05)',
  'Pernyataan Kerahasiaan (FR.01.06)',
  'Daftar Rekaman Mutu (FR.01.07)',
  'BA Pemusnahan Rekaman',
  'Pernyataan Kerahasiaan',
  'Daftar Rekaman Mutu',
  'Formulir Kerja',
  'Formulir Tambahan'
]);

const FORMULIR_OFFICIAL_HEADERS: Record<string, { title: string; formNo: string }> = {
  'Formulir Standar (FR.01.04)': {
    title: 'FORMULIR REKAMAN MUTU STANDAR',
    formNo: 'FR.UPS.SER3.BMK.01.04-00'
  },
  'Berita Acara Pemusnahan (FR.01.05)': {
    title: 'FORMULIR BERITA ACARA<br>PEMUSNAHAN REKAMAN MUTU',
    formNo: 'FR.UPS.SER3.BMK.01.05-00'
  },
  'Pernyataan Kerahasiaan (FR.01.06)': {
    title: 'FORMULIR PERNYATAAN KERAHASIAAN',
    formNo: 'FR.UPS.SER3.BMK.01.06-00'
  },
  'Daftar Rekaman Mutu (FR.01.07)': {
    title: 'DAFTAR REKAMAN MUTU',
    formNo: 'FR.UPS.SER3.BMK.01.07-00'
  },
  'BA Pemusnahan Rekaman': {
    title: 'FORMULIR BERITA ACARA<br>PEMUSNAHAN REKAMAN MUTU',
    formNo: 'FR.UPS.SER3.BMK.01.05-00'
  },
  'Pernyataan Kerahasiaan': {
    title: 'FORMULIR PERNYATAAN KERAHASIAAN',
    formNo: 'FR.UPS.SER3.BMK.01.06-00'
  },
  'Daftar Rekaman Mutu': {
    title: 'DAFTAR REKAMAN MUTU',
    formNo: 'FR.UPS.SER3.BMK.01.07-00'
  },
  'Formulir Kerja': {
    title: 'FORMULIR REKAMAN MUTU STANDAR',
    formNo: 'FR.UPS.SER3.BMK.01.04-00'
  },
  'Formulir Tambahan': {
    title: 'FORMULIR REKAMAN MUTU TAMBAHAN',
    formNo: 'FR.UPS.SER3.BMK.01.XX-00'
  }
};

function RevisionTableComponent({ rows }: { rows: RevisionRow[] }) {
  return (
    <div style={{ margin: '18px 0 22px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0B192C', letterSpacing: '0.03em', marginBottom: 8, textTransform: 'uppercase', textAlign: 'center' }}>
        RIWAYAT PERUBAHAN
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#F1F5F9' }}>
            <th style={{ width: '5%', textAlign: 'center', padding: '8px 6px', border: '1px solid #000', fontWeight: 800 }}>No</th>
            <th style={{ width: '14%', textAlign: 'center', padding: '8px 10px', border: '1px solid #000', fontWeight: 800 }}>Tanggal</th>
            <th style={{ width: '11%', textAlign: 'center', padding: '8px 10px', border: '1px solid #000', fontWeight: 800 }}>Halaman</th>
            <th style={{ width: '31%', textAlign: 'center', padding: '8px 10px', border: '1px solid #000', fontWeight: 800 }}>Uraian yang Dirubah</th>
            <th style={{ width: '31%', textAlign: 'center', padding: '8px 10px', border: '1px solid #000', fontWeight: 800 }}>Uraian Perubahan</th>
            <th style={{ width: '8%', textAlign: 'center', padding: '8px 6px', border: '1px solid #000', fontWeight: 800 }}>Revisi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.no}>
              <td style={{ textAlign: 'center', padding: '8px 6px', border: '1px solid #000' }}>{r.no}</td>
              <td style={{ textAlign: 'center', padding: '8px 10px', border: '1px solid #000', whiteSpace: 'nowrap' }}>{r.tanggal}</td>
              <td style={{ textAlign: 'center', padding: '8px 10px', border: '1px solid #000' }}>{r.halaman}</td>
              <td style={{ padding: '8px 10px', border: '1px solid #000', lineHeight: 1.4 }}>{r.uraianSebelumDiubah}</td>
              <td style={{ padding: '8px 10px', border: '1px solid #000', lineHeight: 1.4 }}>{r.uraianSetelahDiubah}</td>
              <td style={{ textAlign: 'center', padding: '8px 6px', border: '1px solid #000', fontWeight: 700 }}>{r.revisi}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PdfPreviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const docIdParam = searchParams.get('id');

  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(docIdParam ? parseInt(docIdParam) : null);
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch all documents for switcher dropdown
  useEffect(() => {
    async function loadDocs() {
      try {
        const res = await fetch('/api/documents?limit=100');
        if (res.ok) {
          const json = await res.json();
          const list = json.data || [];
          setDocs(list);
          if (!selectedId && list.length > 0) {
            setSelectedId(list[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadDocs();
  }, [selectedId]);

  // Fetch detail for selected document
  const fetchDoc = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (res.ok) {
        const json = await res.json();
        setDoc(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchDoc(selectedId);
    }
  }, [selectedId, fetchDoc]);

  async function handleDownloadPdf() {
    if (!doc) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/pdf`, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.url) {
          window.open(json.data.url, '_blank');
        }
      } else {
        const err = await res.json().catch(() => ({ error: 'Gagal generate PDF.' }));
        alert(err.error || 'Gagal generate PDF. Silakan coba lagi.');
      }
    } catch {
      alert('Gagal menghubungi server. Pastikan server berjalan dan Chromium tersedia.');
    } finally {
      setDownloading(false);
    }
  }

  // Get approval signature details
  const mutuAppr = doc?.approvals?.find(a => a.stage === 1 && a.action === 'Approve');
  const mgrAppr  = doc?.approvals?.find(a => a.stage === 2 && a.action === 'Approve');
  const pimpAppr = doc?.approvals?.find(a => a.stage === 3 && a.action === 'Approve');

  // Filtered documents based on search
  const filteredDocs = docs.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return d.kode.toLowerCase().includes(q) || d.judul.toLowerCase().includes(q) || d.status.toLowerCase().includes(q);
  });

  const selectedDoc = docs.find(d => d.id === selectedId);

  return (
    <>
      {/* Top action bar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="page-title">Lihat & Cetak PDF</div>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Dokumen dirender ke layout PDF resmi PLN UP Sertifikasi dengan pengesahan tanda tangan digital.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Searchable Document Switcher */}
          <div style={{ position: 'relative', minWidth: 300 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                border: '1.5px solid var(--paper-line)',
                borderRadius: 'var(--r-md)',
                background: 'var(--card)',
                cursor: 'pointer',
                transition: 'border-color var(--t-fast)'
              }}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
            >
              <IconSearch size={15} style={{ color: 'var(--ink-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Cari kode atau judul dokumen..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 13,
                  color: 'var(--ink)',
                  width: '100%',
                  fontWeight: 500
                }}
                onClick={e => e.stopPropagation()}
              />
              {selectedDoc && !searchQuery && (
                <span style={{ fontSize: 11, color: 'var(--ink-soft)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  [{selectedDoc.status}] {selectedDoc.kode}
                </span>
              )}
            </div>
            {dropdownOpen && filteredDocs.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: 'var(--card)',
                border: '1px solid var(--paper-line)',
                borderRadius: 'var(--r-md)',
                boxShadow: 'var(--sh-lg)',
                maxHeight: 280,
                overflowY: 'auto',
                zIndex: 50
              }}>
                {filteredDocs.map(d => (
                  <div
                    key={d.id}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      borderBottom: '1px solid var(--paper-line)',
                      background: d.id === selectedId ? 'var(--pln-blue-soft)' : 'transparent',
                      transition: 'background var(--t-fast)'
                    }}
                    onMouseEnter={e => { if (d.id !== selectedId) (e.currentTarget.style.background = 'var(--paper)'); }}
                    onMouseLeave={e => { if (d.id !== selectedId) (e.currentTarget.style.background = 'transparent'); }}
                    onClick={() => {
                      setSelectedId(d.id);
                      setSearchQuery('');
                      setDropdownOpen(false);
                      router.replace(`/pdf?id=${d.id}`);
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{d.kode}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.judul}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {dropdownOpen && searchQuery && filteredDocs.length === 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: 'var(--card)',
                border: '1px solid var(--paper-line)',
                borderRadius: 'var(--r-md)',
                boxShadow: 'var(--sh-lg)',
                padding: '20px 12px',
                textAlign: 'center',
                fontSize: 12.5,
                color: 'var(--ink-muted)',
                zIndex: 50
              }}>
                Tidak ada dokumen ditemukan
              </div>
            )}
          </div>

          {doc && (
            <Link href={`/editor/${doc.id}`} className="btn btn-outline btn-sm">
              <IconEditor size={15} />
              <span>Edit Dokumen</span>
            </Link>
          )}

          <button
            className="btn btn-primary btn-sm"
            onClick={handleDownloadPdf}
            disabled={downloading || !doc}
          >
            <IconDownload size={15} />
            <span>{downloading ? 'Menyiapkan PDF...' : 'Cetak / Simpan PDF'}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--ink-soft)' }}>
          Memuat preview dokumen PDF...
        </div>
      ) : !doc ? (
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--ink-muted)' }}>
          Dokumen tidak ditemukan.
        </div>
      ) : (
        <div className="pdf-wrap">
          <div className="pdf-page">

            {(() => {
              const isFormulir = FORMULIR_TYPES.has(doc.jenis);
              const formHeader = FORMULIR_OFFICIAL_HEADERS[doc.jenis] || {
                title: `FORMULIR ${doc.judul.toUpperCase()}`,
                formNo: doc.kode
              };
              const formattedDate = doc.updatedAt
                ? new Date(doc.updatedAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
                : '-';

              if (isFormulir) {
                return (
                  <>
                    {/* Kop Formulir Kotak 3-Kolom Baku PLN UP Sertifikasi */}
                    <table className="kop-formulir-table">
                      <tbody>
                        <tr>
                          <td className="kop-form-logo">
                            <div className="kop-logo-box">
                              <div className="kop-logo-row">
                                <Image
                                  src="/images/logo-danantara.svg"
                                  alt="Danantara Indonesia"
                                  width={90}
                                  height={20}
                                  className="kop-logo-danantara"
                                  style={{ height: 20, width: 'auto', objectFit: 'contain' }}
                                />
                                <div className="kop-logo-divider" />
                                <Image
                                  src="/images/logo-pln.png"
                                  alt="PLN"
                                  width={26}
                                  height={26}
                                  className="kop-logo-pln"
                                  style={{ height: 26, width: 'auto', objectFit: 'contain' }}
                                />
                              </div>
                              <div className="kop-logo-text">
                                <div className="kop-text-pln">PT PLN (PERSERO)</div>
                                <div className="kop-text-ups">UNIT PELAKSANA SERTIFIKASI</div>
                              </div>
                              <div className="uncontrolled-notice" style={{ marginTop: 4, textAlign: 'center' }}>
                                Uncontrolled when printed or downloaded
                              </div>
                            </div>
                          </td>
                          <td className="kop-form-title">
                            <div dangerouslySetInnerHTML={{ __html: formHeader.title }} />
                          </td>
                          <td className="kop-form-meta">
                            <div><strong>Nomor:</strong> {formHeader.formNo}</div>
                            <div><strong>Tanggal:</strong> {formattedDate}</div>
                            <div><strong>Halaman:</strong> 1 dari 1</div>
                            <div><strong>Status:</strong> <span className={`kop-meta-status ${doc.status === 'Aktif' ? 'status-controlled' : 'status-draft'}`}>{doc.status === 'Aktif' ? 'Controlled' : doc.status}</span></div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Lembar Pengesahan Resmi Formulir */}
                    <div style={{ margin: '14px 0 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0B192C', letterSpacing: '0.02em', marginBottom: 6 }}>LEMBAR PENGESAHAN</div>
                      <div style={{ fontSize: 11.5, color: '#64748B', marginBottom: 8 }}>Jakarta, {formattedDate}</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ width: '50%', textAlign: 'center', padding: '10px 14px', border: '1px solid #334155' }}>
                              <div style={{ fontWeight: 700, fontSize: 12 }}>Disusun Oleh:</div>
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Manager Bidang Terkait</div>
                              <div style={{ height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {mgrAppr?.signaturePath ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={mgrAppr.signaturePath} alt="TTD Manager" style={{ maxHeight: 44, maxWidth: 120 }} />
                                ) : (
                                  <span style={{ color: '#94A3B8' }}>—</span>
                                )}
                              </div>
                              <div style={{ fontWeight: 700, fontSize: 12, marginTop: 4 }}>{mgrAppr?.actorName || '( ..................................... )'}</div>
                            </td>
                            <td style={{ width: '50%', textAlign: 'center', padding: '10px 14px', border: '1px solid #334155' }}>
                              <div style={{ fontWeight: 700, fontSize: 12 }}>Disahkan Oleh:</div>
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Senior Manager UPS</div>
                              <div style={{ height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {pimpAppr?.signaturePath ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={pimpAppr.signaturePath} alt="TTD Pimpinan" style={{ maxHeight: 44, maxWidth: 120 }} />
                                ) : (
                                  <span style={{ color: '#94A3B8' }}>—</span>
                                )}
                              </div>
                              <div style={{ fontWeight: 700, fontSize: 12, marginTop: 4 }}>{pimpAppr?.actorName || '( ..................................... )'}</div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Riwayat Perubahan Tepat di Bawah Lembar Pengesahan */}
                    <RevisionTableComponent rows={getRevisionHistory(doc, (doc as any).versions || [], doc.approvals || [])} />

                    {/* Formulir Body dengan judul klausul terstruktur */}
                    <div className="pdf-body">
                      {(() => {
                        const orderedSections = getOrderedSections(doc.jenis, doc.sections);
                        const activeSections = orderedSections.filter(sec => doc.sections?.[sec.key] && doc.sections[sec.key].trim());
                        const sigData = {
                          mgrSignature: mgrAppr?.signaturePath ?? null,
                          mgrApprover: mgrAppr?.actorName ?? null,
                          pimpinanSignature: pimpAppr?.signaturePath ?? null,
                          pimpinanApprover: pimpAppr?.actorName ?? null,
                        };
                        const SUPPRESS_TITLE_KEYS = new Set([
                          'judul_formulir',
                          'identitas_ba',
                          'identitas_pihak',
                          'pernyataan_komitmen',
                          'konsekuensi_penutup'
                        ]);
                        return activeSections
                          .map((sec, idx) => {
                            const content = injectSignaturesIntoFormHtml(doc.sections[sec.key], sigData);
                            if (SUPPRESS_TITLE_KEYS.has(sec.key)) {
                              return (
                                <div key={sec.key} style={{ marginBottom: 14 }} dangerouslySetInnerHTML={{ __html: content }} />
                              );
                            }
                            const label = getDisplaySectionLabel(sec, idx, doc.jenis);
                            return (
                              <div key={sec.key} className="doc-section" style={{ marginBottom: 16 }}>
                                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0B192C', borderBottom: '1.5px solid #CBD5E1', paddingBottom: 4, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                  {label}
                                </h4>
                                <div dangerouslySetInnerHTML={{ __html: content }} />
                              </div>
                            );
                          });
                      })()}
                    </div>
                  </>
                );
              }

              // Untuk SOP / Prosedur / IK / Manual Mutu
              return (
                <>
                  {/* Kop Surat Resmi Standard */}
                  <div className="pdf-kop">
                    <div className="pdf-kop-left">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <Image
                            src="/images/logo-danantara.svg"
                            alt="Logo Danantara Indonesia"
                            width={130}
                            height={32}
                            className="pdf-kop-logo-img"
                            style={{ height: 32, width: 'auto' }}
                          />
                          <div className="pdf-kop-divider" />
                          <Image
                            src="/images/logo-pln.png"
                            alt="Logo PLN"
                            width={36}
                            height={36}
                            className="pdf-kop-logo-img"
                            style={{ height: 36, width: 'auto' }}
                          />
                        </div>
                        <div className="uncontrolled-notice" style={{ marginTop: 4 }}>
                          Uncontrolled when printed or downloaded
                        </div>
                      </div>
                      <div className="pdf-kop-text">
                        <h3>PT PLN (PERSERO) UNIT PELAKSANA SERTIFIKASI</h3>
                        <p>SISTEM MANAJEMEN TERINTEGRASI — DOKUMEN MUTU TERKENDALI</p>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Table */}
                  <table className="pdf-meta-table">
                    <tbody>
                      <tr>
                        <td>Kode Dokumen</td>
                        <td><strong>{doc.kode}</strong></td>
                        <td>Versi</td>
                        <td>v{doc.currentVersion || (doc as any).current_version}</td>
                      </tr>
                      <tr>
                        <td>Jenis Dokumen</td>
                        <td>{doc.jenis}</td>
                        <td>Status</td>
                        <td><strong>{doc.status}</strong></td>
                      </tr>
                      <tr>
                        <td>Bidang Pemilik</td>
                        <td>{doc.bidang}</td>
                        <td>Tanggal Terbit / Update</td>
                        <td>{formattedDate}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Title */}
                  <div className="pdf-title">{doc.judul.toUpperCase()}</div>

                  {/* Lembar Pengesahan Resmi */}
                  <div style={{ margin: '18px 0 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0B192C', letterSpacing: '0.02em', marginBottom: 6 }}>LEMBAR PENGESAHAN</div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginBottom: 8 }}>Jakarta, {formattedDate}</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr>
                          <td style={{ width: '50%', textAlign: 'center', padding: '10px 14px', border: '1px solid #334155' }}>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>Disusun Oleh:</div>
                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                              {doc.jenis === 'Manual Mutu' ? 'Para Manager Bidang' : 'Manager Bidang Terkait'}
                            </div>
                            <div style={{ height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {mgrAppr?.signaturePath ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={mgrAppr.signaturePath} alt="TTD Manager" style={{ maxHeight: 44, maxWidth: 120 }} />
                              ) : (
                                <span style={{ color: '#94A3B8' }}>—</span>
                              )}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 12, marginTop: 4 }}>{mgrAppr?.actorName || '( ..................................... )'}</div>
                          </td>
                          <td style={{ width: '50%', textAlign: 'center', padding: '10px 14px', border: '1px solid #334155' }}>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>Disahkan Oleh:</div>
                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Senior Manager UPS</div>
                            <div style={{ height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {pimpAppr?.signaturePath ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={pimpAppr.signaturePath} alt="TTD Pimpinan" style={{ maxHeight: 44, maxWidth: 120 }} />
                              ) : (
                                <span style={{ color: '#94A3B8' }}>—</span>
                              )}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 12, marginTop: 4 }}>{pimpAppr?.actorName || '( ..................................... )'}</div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Riwayat Perubahan Resmi Tepat di Bawah Lembar Pengesahan */}
                  <RevisionTableComponent rows={getRevisionHistory(doc, (doc as any).versions || [], doc.approvals || [])} />

                  {/* Content Sections */}
                  <div className="pdf-body">
                    {(() => {
                      const typeSections = (DOCUMENT_SECTIONS[doc.jenis as DocumentType] || []).map(s => s.key);
                      const docSectionKeys = Object.keys(doc.sections || {}).filter(k => k !== 'riwayat_perubahan');
                      const allKeys = Array.from(new Set([...typeSections, ...docSectionKeys]));
                      const sigData = {
                        mgrSignature: mgrAppr?.signaturePath ?? null,
                        mgrApprover: mgrAppr?.actorName ?? null,
                        pimpinanSignature: pimpAppr?.signaturePath ?? null,
                        pimpinanApprover: pimpAppr?.actorName ?? null,
                      };
                      const orderedSections = getOrderedSections(doc.jenis, doc.sections);
                      const activeSections = orderedSections.filter(sec => doc.sections?.[sec.key] && doc.sections[sec.key].trim());
                      return activeSections
                        .map((sec, idx) => {
                          const label = getDisplaySectionLabel(sec, idx, doc.jenis);
                          return (
                            <div key={sec.key} className="doc-section" style={{ marginBottom: 16 }}>
                              <h4>{label.toUpperCase()}</h4>
                              <div dangerouslySetInnerHTML={{ __html: injectSignaturesIntoFormHtml(doc.sections[sec.key], sigData) }} />
                            </div>
                          );
                        });
                    })()}

                    {/* Referensi Terkait */}
                    {doc.refs && doc.refs.length > 0 && (
                      <div className="doc-section" style={{ marginBottom: 16 }}>
                        <h4>6. REFERENSI & STANDAR TERKAIT</h4>
                        <ul style={{ paddingLeft: 22, marginTop: 8 }}>
                          {doc.refs.map(r => (
                            <li key={r.id} style={{ fontSize: 13, marginBottom: 4 }}>
                              <strong>[{r.kategori}] {r.nomor}</strong> — {r.judul}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Signature Block */}
            <div className="pdf-sig-row">
              <div className="pdf-sig-col">
                <div className="pdf-sig-label">Disusun Oleh</div>
                <div className="pdf-sig-drawn">
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>✓ Dibuat</span>
                </div>
                <div className="pdf-sig-name-line">
                  <div className="pdf-sig-name">{doc.penyusunName || 'Penyusun'}</div>
                  <div className="pdf-sig-title">Staf Manajemen Mutu</div>
                </div>
              </div>

              <div className="pdf-sig-col">
                <div className="pdf-sig-label">Ditinjau (Tim Mutu)</div>
                <div className="pdf-sig-drawn">
                  {mutuAppr ? (
                    mutuAppr.signaturePath ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={mutuAppr.signaturePath} alt="TTD Tim Mutu" style={{ maxHeight: 46, maxWidth: 100 }} />
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>✓ Disetujui</span>
                    )
                  ) : (
                    <span style={{ color: 'var(--ink-muted)' }}>Belum</span>
                  )}
                </div>
                <div className="pdf-sig-name-line">
                  <div className="pdf-sig-name">{mutuAppr?.actorName || 'Tim Mutu'}</div>
                  <div className="pdf-sig-title">Reviewer Mutu</div>
                </div>
              </div>

              <div className="pdf-sig-col">
                <div className="pdf-sig-label">Disetujui (Manager)</div>
                <div className="pdf-sig-drawn">
                  {mgrAppr ? (
                    mgrAppr.signaturePath ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={mgrAppr.signaturePath} alt="TTD Manager" style={{ maxHeight: 46, maxWidth: 100 }} />
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>✓ Disetujui</span>
                    )
                  ) : (
                    <span style={{ color: 'var(--ink-muted)' }}>Belum</span>
                  )}
                </div>
                <div className="pdf-sig-name-line">
                  <div className="pdf-sig-name">{mgrAppr?.actorName || 'Manager Bidang'}</div>
                  <div className="pdf-sig-title">Manager Bidang Mutu</div>
                </div>
              </div>

              <div className="pdf-sig-col">
                <div className="pdf-sig-label">Disahkan (Pimpinan)</div>
                <div className="pdf-sig-drawn">
                  {pimpAppr ? (
                    pimpAppr.signaturePath ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={pimpAppr.signaturePath} alt="TTD Pimpinan" style={{ maxHeight: 46, maxWidth: 100 }} />
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>✓ Disahkan</span>
                    )
                  ) : (
                    <span style={{ color: 'var(--ink-muted)' }}>Belum</span>
                  )}
                </div>
                <div className="pdf-sig-name-line">
                  <div className="pdf-sig-name">{pimpAppr?.actorName || 'Pimpinan Unit'}</div>
                  <div className="pdf-sig-title">Senior Manager / General Manager</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
