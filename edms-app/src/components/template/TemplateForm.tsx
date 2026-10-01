'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TemplateRow } from '@/types';

// Form isian sebelum membuat dokumen dari template (RENCANA §6.3):
// Kode & Judul wajib diisi ulang; Bidang default dari template (bisa diubah);
// Jenis & kop ikut dari template (lihat hint di bawah).
// Setelah sukses → langsung ke /editor/{idBaru}.

export default function TemplateForm({
  template,
  onClose,
}: {
  template: TemplateRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [kode,  setKode]  = useState('');
  const [judul, setJudul] = useState('');
  const [bidang, setBidang] = useState(template.bidang || '');
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');

  const nonAktif = Boolean(template.status && template.status !== 'Aktif');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!kode.trim() || !judul.trim()) {
      setError('Kode dan judul wajib diisi.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/documents/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          kode:  kode.trim(),
          judul: judul.trim(),
          bidang: bidang.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        router.push(`/editor/${json.data.id}`);
      } else {
        setError(json.error || 'Gagal membuat dokumen dari template.');
      }
    } catch {
      setError('Gagal menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Buat Dokumen dari Template</div>
          <button className="modal-close" onClick={() => !busy && onClose()} disabled={busy}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Ringkasan template terpilih */}
          <div style={{
            background: 'var(--paper)', border: '1px solid var(--paper-line)',
            borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{
                fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5,
                color: 'var(--ink)',
              }}>{template.kode}</code>
              {template.status && (
                <span className={`badge badge-${template.status === 'Aktif' ? 'aktif' : template.status === 'Obsolete' ? 'obsolete' : 'draft'}`}>
                  {template.status}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginTop: 4 }}>
              {template.judul}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
              {template.jenis} · {template.bidang}
            </div>
          </div>

          {nonAktif && (
            <div style={{
              background: '#FEF3C7', border: '1px solid #F59E0B',
              borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 14,
              fontSize: 12.5, color: '#92400E', lineHeight: 1.6,
            }}>
              <strong>Perhatian:</strong> template ini berstatus <strong>{template.status}</strong> (bukan Aktif).
              Dokumen hasil tetap melewati siklus review & approval penuh sebelum terbit.
            </div>
          )}

          <div className="field">
            <label>Kode Dokumen <span style={{ color: 'var(--red)' }}>*</span></label>
            <input
              value={kode}
              onChange={e => setKode(e.target.value)}
              placeholder="mis. FR.UPS.SER3.BMK.01.04-12"
              autoFocus
              required
              disabled={busy}
            />
            <div className="field-hint" style={{ fontSize: 11.5, marginTop: 4 }}>
              Harus unik — dicek terhadap seluruh dokumen di sistem.
            </div>
          </div>

          <div className="field">
            <label>Judul Dokumen <span style={{ color: 'var(--red)' }}>*</span></label>
            <input
              value={judul}
              onChange={e => setJudul(e.target.value)}
              placeholder="Judul lengkap dokumen"
              required
              disabled={busy}
            />
          </div>

          <div className="field">
            <label>Bidang</label>
            <input
              value={bidang}
              onChange={e => setBidang(e.target.value)}
              placeholder="Bidang penanggung jawab"
              disabled={busy}
            />
          </div>

          <div className="field">
            <label>Jenis Dokumen</label>
            <input value={template.jenis} disabled style={{ opacity: 0.7, cursor: 'not-allowed' }} />
            <div className="field-hint" style={{ fontSize: 11.5, marginTop: 4 }}>
              Ikut dari template. Kop surat & seluruh isi sections juga ikut tersalin —
              bisa disesuaikan di editor setelah dokumen dibuat.
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--red-soft, #FEE2E2)', border: '1px solid var(--red-border, #FECACA)',
              borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 14,
              fontSize: 12.5, color: 'var(--red)',
            }}>
              {error}
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Membuat dokumen...' : 'Buat Dokumen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
