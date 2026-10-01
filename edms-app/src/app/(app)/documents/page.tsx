'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Document, TemplateRow } from '@/types';
import { IconPlus, IconSearch, IconTrash, IconTemplate, IconEditor } from '@/components/icons/Icons';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/documentTypes';
import { hasPermission } from '@/lib/rbac';
import TemplatePicker from '@/components/template/TemplatePicker';
import TemplateForm from '@/components/template/TemplateForm';

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

const PAGE_SIZE = 50; // selaras dengan default limit API /api/documents

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [docs,    setDocs]    = useState<Document[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');

  const [q,      setQ]      = useState(searchParams.get('q') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [bidang, setBidang] = useState(searchParams.get('bidang') || '');
  const [jenis,  setJenis]  = useState(searchParams.get('jenis') || '');
  const [page,   setPage]   = useState(1);

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; doc: Document | null }>({ open: false, doc: null });
  const [deleting, setDeleting] = useState(false);

  // Dropdown "Dokumen Baru" + pustaka template (RENCANA §6.2/§6.3)
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [pickerOpen,    setPickerOpen]    = useState(false);
  const [formTemplate,  setFormTemplate]  = useState<TemplateRow | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q)      params.set('q', q);
    if (status) params.set('status', status);
    if (bidang) params.set('bidang', bidang);
    if (jenis)  params.set('jenis', jenis);
    // Pencarian menyentuh register + pustaka template (R1);
    // toggle manual untuk penelusuran biasa.
    if (showTemplates || q.trim()) params.set('includeTemplates', '1');
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    const res = await fetch(`/api/documents?${params}`);
    if (res.ok) {
      const json = await res.json();
      setDocs(json.data);
      setTotal(json.total);
      // Filter menyusutkan hasil -> jangan biarkan halaman melewati halaman terakhir.
      const lastPage = Math.max(1, Math.ceil((json.total || 0) / PAGE_SIZE));
      if (page > lastPage) setPage(lastPage);
    }
    setLoading(false);
  }, [q, status, bidang, jenis, page, showTemplates]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    if (!dropdownOpen) return;
    function onDocClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [dropdownOpen]);

  // Fetch current user role
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.data?.role) setUserRole(json.data.role); })
      .catch(() => {});
  }, []);

  async function handleDelete() {
    if (!deleteModal.doc || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${deleteModal.doc.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteModal({ open: false, doc: null });
        fetchDocs();
      } else {
        const json = await res.json();
        alert(json.error || 'Gagal menghapus dokumen.');
      }
    } catch {
      alert('Terjadi kesalahan saat menghapus dokumen.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-title">Daftar Dokumen Mutu</div>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Register resmi seluruh dokumen mutu terkendali unit. Terdaftar: <strong style={{ color: 'var(--ink)' }}>{total} dokumen</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, position: 'relative' }} ref={dropdownRef}>
          <button className="btn btn-primary" onClick={() => setDropdownOpen(o => !o)} aria-haspopup="menu" aria-expanded={dropdownOpen}>
            <IconPlus size={16} />
            <span>Dokumen Baru</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2, transform: dropdownOpen ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40,
              minWidth: 250, background: 'var(--card)', border: '1px solid var(--paper-line-dark)',
              borderRadius: 'var(--r-md)', boxShadow: '0 10px 30px rgba(15,23,42,.14)', padding: 6,
            }}>
              <button
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                  width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none',
                  background: 'none', cursor: 'pointer', borderRadius: 6,
                }}
                onClick={() => { setDropdownOpen(false); router.push('/editor/new'); }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  <IconEditor size={14} /> Dokumen kosong
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-soft)', paddingLeft: 22 }}>
                  Mulai dari nol — perilaku lama (editor baru)
                </span>
              </button>
              {userRole && hasPermission(userRole, 'document:create') && (
                <button
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                    width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none',
                    background: 'none', cursor: 'pointer', borderRadius: 6,
                  }}
                  onClick={() => { setDropdownOpen(false); setPickerOpen(true); }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    <IconTemplate size={14} /> Dari template…
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-soft)', paddingLeft: 22 }}>
                    Salin sections, kop, gambar & referensi dari template
                  </span>
                </button>
              )}
            </div>
          )}
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

        <label
          style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-soft)', cursor: 'pointer', userSelect: 'none' }}
          title="Tampilkan juga 148 dokumen yang ditandai sebagai template"
        >
          <input
            type="checkbox"
            checked={showTemplates}
            onChange={e => { setShowTemplates(e.target.checked); setPage(1); }}
            style={{ accentColor: 'var(--pln-blue, #0C4DA2)', cursor: 'pointer' }}
          />
          Tampilkan template
        </label>

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setQ(''); setStatus(''); setBidang(''); setJenis(''); setShowTemplates(false); setPage(1); }}
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
                  {(d.is_template || Number(d.is_template) === 1) && (
                    <span className="badge" style={{ marginLeft: 6, background: '#EDE9FE', color: '#6D28D9', border: '1px solid #DDD6FE', fontSize: 10, padding: '2px 7px' }}>
                      Template
                    </span>
                  )}
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
                    {userRole === 'Admin Sistem' && (
                      <button
                        className="btn btn-xs"
                        style={{ color: 'var(--red)', border: '1px solid var(--red-border)', background: 'var(--red-soft)' }}
                        onClick={() => setDeleteModal({ open: true, doc: d })}
                      >
                        <IconTrash size={12} />
                        Hapus
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 14 }}>
            Menampilkan{' '}
            <strong style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {rangeStart}&ndash;{rangeEnd}
            </strong>{' '}
            dari{' '}
            <strong style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{total}</strong> dokumen
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, alignItems: 'center' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                Sebelumnya
              </button>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums', padding: '0 8px' }}>
                Halaman {page} dari {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                Selanjutnya
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.doc && (
        <div className="overlay" onClick={() => !deleting && setDeleteModal({ open: false, doc: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Hapus Dokumen</div>
              <button className="modal-close" onClick={() => !deleting && setDeleteModal({ open: false, doc: null })}>×</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.6 }}>
              <p>Anda yakin ingin menghapus dokumen berikut?</p>
              <div style={{ background: 'var(--paper)', border: '1px solid var(--paper-line)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginTop: 12 }}>
                <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{deleteModal.doc.kode}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{deleteModal.doc.judul}</div>
              </div>
              <p style={{ marginTop: 12, fontSize: 12, color: 'var(--red)' }}>Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteModal({ open: false, doc: null })} disabled={deleting}>Batal</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Menghapus...' : 'Hapus Dokumen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pilih template → form isian → buat dokumen */}
      {pickerOpen && (
        <TemplatePicker
          onClose={() => setPickerOpen(false)}
          onSelect={t => { setPickerOpen(false); setFormTemplate(t); }}
        />
      )}
      {formTemplate && (
        <TemplateForm template={formTemplate} onClose={() => setFormTemplate(null)} />
      )}
    </>
  );
}
