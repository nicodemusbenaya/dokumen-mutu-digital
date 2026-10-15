'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  IconDownload, IconFileText, IconCheckCircle, IconAlertCircle, IconArrowLeft,
} from '@/components/icons/Icons';
import { hasPermission } from '@/lib/rbac';

type ImportItem = {
  rel: string;
  kode: string;
  judul: string;
  jenis: string;
  bidang: string;
  version: string;
  mode: 'create' | 'update';
  status: 'created' | 'updated' | 'skipped' | 'failed';
  sectionCount: number;
  error?: string;
  warnings: string[];
};

type ImportStats = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  deleted: number;
  sections: number;
  parents: number;
};

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  created: { label: 'Baru', bg: '#DCFCE7', fg: '#15803D' },
  updated: { label: 'Diperbarui', bg: '#DBEAFE', fg: '#1D4ED8' },
  skipped: { label: 'Dilewati', bg: '#F1F5F9', fg: '#475569' },
  failed: { label: 'Gagal', bg: '#FEE2E2', fg: '#B91C1C' },
};

export default function ImportPage() {
  const [userRole, setUserRole] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sync, setSync] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [result, setResult] = useState<{ stats: ImportStats; items: ImportItem[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(json => { if (json?.data?.role) setUserRole(json.data.role); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const allowed = loaded && !!userRole && hasPermission(userRole, 'document:create');
  const isAdmin = userRole === 'Admin Sistem';

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.zip')) {
      setError('Format berkas harus .zip.');
      setFile(null);
      return;
    }
    setError('');
    setFile(f);
    setResult(null);
  }

  async function handleUpload() {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (sync && isAdmin) fd.append('sync', '1');
      const res = await fetch('/api/documents/bulk-import', { method: 'POST', body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        setError(json?.error || 'Impor gagal dijalankan.');
        return;
      }
      setResult({ stats: json.stats, items: json.items });
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch {
      setError('Terjadi kesalahan jaringan saat mengunggah berkas.');
    } finally {
      setBusy(false);
    }
  }

  if (loaded && !allowed) {
    return (
      <>
        <div className="page-title">Impor Massal</div>
        <div className="card card-body" style={{ padding: 24, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>
            <IconAlertCircle size={18} /> Akses ditolak — fitur ini hanya untuk Penyusun Dokumen dan Admin Sistem.
          </div>
          <div style={{ marginTop: 14 }}>
            <Link href="/documents" className="btn btn-ghost btn-sm"><IconArrowLeft size={14} /> Kembali ke Daftar Dokumen</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div className="page-title">Impor Massal Dokumen</div>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Unggah satu berkas <strong style={{ color: 'var(--ink)' }}>.zip</strong> berisi folder dokumen mutu.
            Sistem membuat dokumen baru dan memperbarui dokumen yang kodenya sudah ada.
          </p>
        </div>
        <Link href="/documents" className="btn btn-ghost btn-sm"><IconArrowLeft size={14} /> Daftar Dokumen</Link>
      </div>

      <div className="card card-body" style={{ padding: 18, marginBottom: 18 }}>
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${drag ? 'var(--pln-blue, #0C4DA2)' : 'var(--paper-line-dark)'}`,
            borderRadius: 'var(--r-md)',
            padding: '34px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: drag ? 'rgba(12,77,162,.05)' : 'var(--paper)',
            transition: 'border-color .15s, background .15s',
          }}
        >
          <IconFileText size={28} />
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginTop: 10 }}>
            {file ? file.name : 'Seret berkas .zip ke sini, atau klik untuk memilih'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
            {file
              ? `${(file.size / 1024 / 1024).toFixed(1)} MB siap diunggah`
              : 'Maksimal 300 MB · berkas .docx / .pdf / .xlsx'}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={e => pickFile(e.target.files?.[0])}
          />
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
          <label
            title={isAdmin ? 'Hapus dokumen yang kodenya tidak ada di berkas zip' : 'Hanya Admin Sistem'}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
              color: isAdmin ? 'var(--ink)' : 'var(--ink-muted)',
              opacity: isAdmin ? 1 : 0.7, cursor: isAdmin ? 'pointer' : 'not-allowed',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={sync && isAdmin}
              disabled={!isAdmin}
              onChange={e => setSync(e.target.checked)}
              style={{ accentColor: 'var(--pln-blue, #0C4DA2)', cursor: isAdmin ? 'pointer' : 'not-allowed' }}
            />
            Mode sinkron — hapus dokumen yang tidak ada di zip
          </label>
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={handleUpload} disabled={!file || busy}>
            <IconDownload size={15} />
            {busy ? 'Memproses…' : 'Mulai Impor'}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--red)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <IconAlertCircle size={15} /> {error}
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ink-muted)', lineHeight: 1.7 }}>
          Aturan impor: judul & kode diambil dari nama berkas (penanda <code>REV.nn</code> → versi), folder
          <em> Formulir Versi PDF </em>diabaikan karena teks diambil dari berkas Word, lampiran Manual Mutu
          memakai kode <code>MAN.MUTU.UPS.LAMP.nn-00</code>, dan berkas .xlsx disimpan tanpa seksi teks.
        </div>
      </div>

      {busy && (
        <div className="card card-body" style={{ padding: 18 }}>
          <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 16, width: '70%' }} />
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 12 }}>
            Membaca zip, memparse isi dokumen, dan menyimpan ke database. Jangan tutup halaman ini…
          </div>
        </div>
      )}

      {result && (
        <div className="card card-body" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <IconCheckCircle size={18} />
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Impor selesai</span>
            <span style={{ flex: 1 }} />
            <Link href="/documents" className="btn btn-ghost btn-sm">Lihat Daftar Dokumen</Link>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              ['Baru', result.stats.created],
              ['Diperbarui', result.stats.updated],
              ['Dilewati', result.stats.skipped],
              ['Gagal', result.stats.failed],
              ['Dihapus (sinkron)', result.stats.deleted],
              ['Seksi tersimpan', result.stats.sections],
              ['Relasi induk', result.stats.parents],
            ].map(([label, n]) => (
              <span key={String(label)} className="badge" style={{ background: 'var(--paper)', border: '1px solid var(--paper-line-dark)', color: 'var(--ink)', padding: '4px 10px' }}>
                {label}: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</strong>
              </span>
            ))}
          </div>

          <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '26%' }}>Kode</th>
                  <th>Judul</th>
                  <th style={{ width: '15%' }}>Berkas</th>
                  <th style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Seksi</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((it, idx) => {
                  const meta = STATUS_META[it.status] ?? STATUS_META.skipped;
                  return (
                    <tr key={`${it.rel}-${idx}`}>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11.5 }}>
                        {it.kode}
                        <span style={{ marginLeft: 6, color: 'var(--ink-muted)', fontWeight: 400 }}>v{it.version}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>{it.judul}</div>
                        {(it.error || it.warnings.length > 0) && (
                          <div style={{ fontSize: 11, color: it.error ? 'var(--red)' : 'var(--ink-muted)', marginTop: 2 }}>
                            {it.error || it.warnings.join(' · ')}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--ink-soft)', wordBreak: 'break-all' }}>{it.rel}</td>
                      <td>
                        <span className="badge" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                        {it.sectionCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
