'use client';

import { useState, useEffect, useCallback } from 'react';
import { IconSearch } from '@/components/icons/Icons';

const ACTION_TYPES = ['', 'CREATE', 'SUBMIT', 'REVIEW', 'APPROVE', 'REJECT', 'PUBLISH', 'GENERATE', 'LOGIN', 'LOGOUT', 'UPDATE'];

export default function AuditPage() {
  const [logs,   setLogs]   = useState<any[]>([]);
  const [total,  setTotal]  = useState(0);
  const [loading,setLoading]= useState(true);
  const [q,      setQ]      = useState('');
  const [type,   setType]   = useState('');
  const [page,   setPage]   = useState(1);
  const LIMIT = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q)    params.set('q',    q);
    if (type) params.set('type', type);
    params.set('page',  String(page));
    params.set('limit', String(LIMIT));
    const res = await fetch(`/api/audit?${params}`);
    if (res.ok) {
      const json = await res.json();
      setLogs(json.data);
      setTotal(json.total);
    }
    setLoading(false);
  }, [q, type, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <div className="page-title">Audit Trail & Jejak Aktivitas</div>
      <p className="page-sub">
        Rekam jejak seluruh mutasi dan aktivitas sistem. Bersifat read-only, tamper-evident, dan permanen demi kepatuhan audit ISO. Total rekam: <strong>{total} log</strong>
      </p>

      <div className="card card-body" style={{ marginBottom: 16, display: 'flex', gap: 12, padding: '12px 16px', alignItems: 'center' }}>
        <div style={{ flex: 2, position: 'relative', display: 'flex', alignItems: 'center' }}>
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
            placeholder="Cari pengguna, catatan mutasi, kode dokumen..."
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
          />
        </div>

        <select
          style={{ padding: '8px 12px', border: '1px solid var(--paper-line-dark)', borderRadius: 'var(--r-md)', fontSize: 12.5, background: 'var(--card)', color: 'var(--ink)' }}
          value={type}
          onChange={e => { setType(e.target.value); setPage(1); }}
        >
          {ACTION_TYPES.map(t => <option key={t} value={t}>{t ? `Tipe: ${t}` : 'Semua Tipe Aksi'}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: '16%' }}>Waktu & Tanggal</th>
              <th style={{ width: '15%' }}>Nama Pengguna</th>
              <th style={{ width: '12%' }}>Tipe Aksi</th>
              <th style={{ width: '18%' }}>Kode Dokumen</th>
              <th>Catatan Aktivitas</th>
              <th style={{ width: '14%' }}>Alamat IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 14, width: '75%' }} /></td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--ink-muted)' }}>
                  Tidak ada rekam jejak audit yang sesuai filter.
                </td>
              </tr>
            ) : logs.map((log: any) => (
              <tr key={log.id}>
                <td style={{ fontSize: 11.5, color: 'var(--ink-soft)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(log.created_at).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </td>
                <td style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{log.user_name}</td>
                <td>
                  <span className={`audit-badge audit-${log.action_type}`}>{log.action_type}</span>
                </td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                  {log.doc_kode || '—'}
                </td>
                <td style={{ fontSize: 12, maxWidth: 300, color: 'var(--ink-mid)' }}>{log.note || '—'}</td>
                <td style={{ fontSize: 11.5, color: 'var(--ink-muted)', fontFamily: 'var(--mono)' }}>
                  {log.ip_address || '127.0.0.1'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            Sebelumnya
          </button>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums', padding: '0 8px' }}>
            Halaman {page} dari {totalPages}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Selanjutnya
          </button>
        </div>
      )}
    </>
  );
}
