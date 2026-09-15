'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Document, DocumentDetail } from '@/types';

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
              ✏️ Edit
            </Link>
          )}

          <button
            className="btn btn-primary btn-sm"
            onClick={handleDownloadPdf}
            disabled={downloading || !doc}
          >
            {downloading ? 'Menyiapkan PDF...' : '🖨️ Cetak / Simpan PDF'}
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

            {/* Kop Surat */}
            <div className="pdf-kop">
              <div className="pdf-kop-logo">⚡</div>
              <div className="pdf-kop-text">
                <h3>PLN UP SERTIFIKASI</h3>
                <p>SISTEM MANAJEMEN TERINTEGRASI — DOKUMEN MUTU</p>
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
                  <td>{doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</td>
                </tr>
              </tbody>
            </table>

            {/* Title */}
            <div className="pdf-title">{doc.judul.toUpperCase()}</div>

            {/* Content Sections */}
            <div className="pdf-body">
              <h4>1. TUJUAN</h4>
              <div dangerouslySetInnerHTML={{ __html: doc.sections?.tujuan || '<p>— Belum diisi —</p>' }} />

              <h4>2. RUANG LINGKUP</h4>
              <div dangerouslySetInnerHTML={{ __html: doc.sections?.ruang_lingkup || '<p>— Belum diisi —</p>' }} />

              <h4>3. DEFINISI & ISTILAH</h4>
              <div dangerouslySetInnerHTML={{ __html: doc.sections?.definisi || '<p>— Belum diisi —</p>' }} />

              <h4>4. PROSEDUR PELAKSANAAN</h4>
              <div dangerouslySetInnerHTML={{ __html: doc.sections?.prosedur || '<p>— Belum diisi —</p>' }} />

              <h4>5. LAMPIRAN</h4>
              <div dangerouslySetInnerHTML={{ __html: doc.sections?.lampiran || '<p>— Tidak ada lampiran —</p>' }} />

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
