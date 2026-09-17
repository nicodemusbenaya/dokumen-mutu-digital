'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Document, DocumentDetail } from '@/types';
import { DOCUMENT_SECTIONS, DocumentType, getSectionLabel } from '@/lib/documentTypes';
import { IconEditor, IconDownload } from '@/components/icons/Icons';
import Image from 'next/image';

const FORMULIR_TYPES = new Set([
  'BA Pemusnahan Rekaman',
  'Pernyataan Kerahasiaan',
  'Daftar Rekaman Mutu',
  'Formulir Kerja',
  'Formulir Tambahan'
]);

const FORMULIR_OFFICIAL_HEADERS: Record<string, { title: string; formNo: string }> = {
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
    formNo: 'FR.UPS.SER3.BSB.01.07-00'
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

export default function PdfPreviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const docIdParam = searchParams.get('id');

  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(docIdParam ? parseInt(docIdParam) : null);
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

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
        window.print();
      }
    } catch {
      window.print();
    } finally {
      setDownloading(false);
    }
  }

  // Get approval signature details
  const mutuAppr = doc?.approvals?.find(a => a.stage === 1 && a.action === 'Approve');
  const mgrAppr  = doc?.approvals?.find(a => a.stage === 2 && a.action === 'Approve');
  const pimpAppr = doc?.approvals?.find(a => a.stage === 3 && a.action === 'Approve');

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
          {/* Document Switcher */}
          <select
            style={{
              padding: '9px 14px',
              border: '1.5px solid var(--paper-line)',
              borderRadius: 'var(--r-md)',
              fontSize: 13,
              background: 'var(--card)',
              color: 'var(--ink)',
              fontWeight: 500,
              cursor: 'pointer'
            }}
            value={selectedId || ''}
            onChange={e => {
              const newId = parseInt(e.target.value);
              setSelectedId(newId);
              router.replace(`/pdf?id=${newId}`);
            }}
          >
            {docs.map(d => (
              <option key={d.id} value={d.id}>
                [{d.status}] {d.kode} - {d.judul}
              </option>
            ))}
          </select>

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
            {/* Stamp Status Badge */}
            {doc.status === 'Aktif' ? (
              <div className="pdf-controlled">CONTROLLED COPY</div>
            ) : (
              <div className="pdf-draft-badge">DRAFT · {doc.status.toUpperCase()}</div>
            )}

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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <Image src="/images/logo-danantara.svg" alt="Danantara" width={100} height={24} style={{ height: 24, width: 'auto' }} />
                              <Image src="/images/logo-pln.png" alt="PLN" width={28} height={28} style={{ height: 28, width: 'auto' }} />
                            </div>
                            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0B192C', lineHeight: 1.25 }}>
                              PT PLN (PERSERO)<br />UNIT PELAKSANA SERTIFIKASI
                            </div>
                          </td>
                          <td className="kop-form-title">
                            <div dangerouslySetInnerHTML={{ __html: formHeader.title }} />
                          </td>
                          <td className="kop-form-meta">
                            <div><strong>Nomor:</strong> {formHeader.formNo}</div>
                            <div><strong>Tanggal:</strong> {formattedDate}</div>
                            <div><strong>Halaman:</strong> 1 dari 1</div>
                            <div><strong>Status:</strong> {doc.status === 'Aktif' ? 'Controlled' : doc.status}</div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Formulir Body mengalir presisi tanpa judul bab h4 */}
                    <div className="pdf-body">
                      {(() => {
                        const typeSections = (DOCUMENT_SECTIONS[doc.jenis as DocumentType] || []).map(s => s.key);
                        const docSectionKeys = Object.keys(doc.sections || {});
                        const allKeys = Array.from(new Set([...typeSections, ...docSectionKeys]));
                        return allKeys
                          .filter(key => doc.sections?.[key])
                          .map(key => (
                            <div key={key} style={{ marginBottom: 14 }} dangerouslySetInnerHTML={{ __html: doc.sections[key] }} />
                          ));
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
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Image
                          src="/images/logo-danantara.svg"
                          alt="Logo Danantara Indonesia"
                          width={130}
                          height={32}
                          className="pdf-kop-logo-img"
                          style={{ height: 32, width: 'auto' }}
                        />
                      </div>
                      <div className="pdf-kop-divider" />
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Image
                          src="/images/logo-pln.png"
                          alt="Logo PLN"
                          width={36}
                          height={36}
                          className="pdf-kop-logo-img"
                          style={{ height: 36, width: 'auto' }}
                        />
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

                  {/* Riwayat Perubahan Resmi 6-Kolom */}
                  <div style={{ margin: '16px 0 24px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0B192C', letterSpacing: '0.02em', marginBottom: 6 }}>RIWAYAT PERUBAHAN</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                      <thead>
                        <tr style={{ background: '#F1F5F9' }}>
                          <th style={{ width: '6%', textAlign: 'center', padding: '6px 8px', border: '1px solid #334155' }}>No</th>
                          <th style={{ width: '14%', textAlign: 'center', padding: '6px 8px', border: '1px solid #334155' }}>Tanggal</th>
                          <th style={{ width: '10%', textAlign: 'center', padding: '6px 8px', border: '1px solid #334155' }}>Halaman</th>
                          <th style={{ width: '32%', textAlign: 'center', padding: '6px 8px', border: '1px solid #334155' }}>Uraian yang Diubah</th>
                          <th style={{ width: '28%', textAlign: 'center', padding: '6px 8px', border: '1px solid #334155' }}>Uraian Perubahan</th>
                          <th style={{ width: '10%', textAlign: 'center', padding: '6px 8px', border: '1px solid #334155' }}>Revisi</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ textAlign: 'center', padding: '6px 8px', border: '1px solid #475569' }}>1</td>
                          <td style={{ textAlign: 'center', padding: '6px 8px', border: '1px solid #475569' }}>{formattedDate}</td>
                          <td style={{ textAlign: 'center', padding: '6px 8px', border: '1px solid #475569' }}>Semua</td>
                          <td style={{ padding: '6px 8px', border: '1px solid #475569' }}>Penerbitan Dokumen Mutu</td>
                          <td style={{ padding: '6px 8px', border: '1px solid #475569' }}>Dokumen Mutu Terkendali Resmi Terbit di EDMS</td>
                          <td style={{ textAlign: 'center', padding: '6px 8px', border: '1px solid #475569' }}>v{doc.currentVersion || (doc as any).current_version}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Content Sections */}
                  <div className="pdf-body">
                    {(() => {
                      const typeSections = (DOCUMENT_SECTIONS[doc.jenis as DocumentType] || []).map(s => s.key);
                      const docSectionKeys = Object.keys(doc.sections || {});
                      const allKeys = Array.from(new Set([...typeSections, ...docSectionKeys]));
                      return allKeys
                        .filter(key => doc.sections?.[key])
                        .map(key => (
                          <div key={key} style={{ marginBottom: 16 }}>
                            <h4>{getSectionLabel(key, doc.jenis).toUpperCase()}</h4>
                            <div dangerouslySetInnerHTML={{ __html: doc.sections[key] }} />
                          </div>
                        ));
                    })()}

                    {/* Referensi Terkait */}
                    {doc.refs && doc.refs.length > 0 && (
                      <>
                        <h4>6. REFERENSI & STANDAR TERKAIT</h4>
                        <ul style={{ paddingLeft: 22, marginTop: 8 }}>
                          {doc.refs.map(r => (
                            <li key={r.id} style={{ fontSize: 13, marginBottom: 4 }}>
                              <strong>[{r.kategori}] {r.nomor}</strong> — {r.judul}
                            </li>
                          ))}
                        </ul>
                      </>
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
                    <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>✓ Disetujui</span>
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
