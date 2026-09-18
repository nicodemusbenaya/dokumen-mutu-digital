'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { IconCheck, IconApproval, IconAlertCircle } from '@/components/icons/Icons';

const STATUS_CLASS: Record<string, string> = {
  'Draft': 'draft',
  'Review': 'review',
  'Menunggu Approval': 'approval',
  'Aktif': 'aktif',
  'Obsolete': 'obsolete',
};

export default function ApprovalPage() {
  const [docs,        setDocs]        = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading,     setLoading]     = useState(true);

  const fetchDocs = useCallback(async () => {
    const res = await fetch('/api/documents?status=Review&limit=100');
    const res2 = await fetch('/api/documents?status=Menunggu+Approval&limit=100');
    if (res.ok && res2.ok) {
      const j1 = await res.json();
      const j2 = await res2.json();
      setDocs([...j1.data, ...j2.data]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.data) setCurrentUser(json.data);
      })
      .catch(() => {});
  }, []);

  const isStaff = currentUser?.role === 'Penyusun Dokumen';

  return (
    <>
      <div className="page-title">Approval & Review Mutu</div>
      <p className="page-sub">
        {isStaff
          ? 'Status pemantauan dokumen mutu yang sedang dalam proses review dan pengesahan.'
          : 'Daftar dokumen yang memerlukan tinjauan mutu atau pengesahan tanda tangan digital dari Anda.'}
      </p>

      {isStaff && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: '#F0F9FF',
          border: '1px solid #BAE6FD',
          borderRadius: 'var(--r-md)',
          marginBottom: 16,
          fontSize: 13,
          color: '#0369A1'
        }}>
          <IconAlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>
            Anda masuk sebagai <strong>Penyusun Dokumen</strong>. Dokumen di bawah ini sedang dalam antrean review Tim Mutu atau pengesahan Manajemen. Anda dapat memantau progresnya di sini.
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--r-lg)' }} />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="card card-body" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <div style={{ display: 'inline-flex', padding: 14, borderRadius: '50%', background: 'var(--green-soft)', color: 'var(--green)', marginBottom: 12 }}>
            <IconCheck size={36} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--ink)' }}>Semua Dokumen Telah Diproses</div>
          <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Tidak ada dokumen yang menunggu review atau approval saat ini.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {docs.map((d: any) => {
            const canAct = currentUser && (
              currentUser.role === 'Admin Sistem' ||
              (d.status === 'Review' && currentUser.role === 'Tim Mutu') ||
              (d.status === 'Menunggu Approval' && (currentUser.role === 'Manager Bidang' || currentUser.role === 'Pimpinan Unit'))
            );

            return (
              <div key={d.id} className="card card-hover" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: d.status === 'Review' ? 'var(--amber)' : 'var(--pln-blue)',
                  flexShrink: 0
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 5 }}>
                    <code style={{ fontSize: 11.5, background: 'var(--paper)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--paper-line)', fontWeight: 700, color: 'var(--ink)' }}>
                      {d.kode}
                    </code>
                    <span className={`badge badge-${STATUS_CLASS[d.status]}`}>{d.status}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{d.judul}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>
                    {d.bidang} · v{d.current_version} · Penyusun: <strong>{d.penyusun_name}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {canAct ? (
                    <Link href={`/documents/${d.id}`} className="btn btn-primary btn-sm">
                      <IconApproval size={15} />
                      <span>{d.status === 'Review' ? 'Review & Tindak Lanjut' : 'Approval & Pengesahan'}</span>
                    </Link>
                  ) : (
                    <Link href={`/documents/${d.id}`} className="btn btn-ghost btn-sm">
                      <span>Lihat Detail</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
