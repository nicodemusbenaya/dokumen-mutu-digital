'use client';

import { useRouter, usePathname } from 'next/navigation';
import type { SessionUser } from '@/lib/auth';
import { IconSearch } from '@/components/icons/Icons';

const PATH_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard Mutu',
  '/documents': 'Daftar Dokumen Mutu',
  '/editor': 'Editor Dokumen',
  '/approval': 'Approval & Pengesahan',
  '/pdf': 'Lihat & Cetak PDF',
  '/manage': 'Peta Dokumen Terkendali',
  '/references': 'Master Referensi Standard',
  '/audit': 'Audit Trail & Jejak Aktivitas',
};

export default function Topbar({ title, user }: { title?: string; user: SessionUser }) {
  const router = useRouter();
  const pathname = usePathname();

  const activeTitle = title || (
    Object.keys(PATH_TITLES).find(k => pathname === k || pathname.startsWith(k + '/'))
      ? PATH_TITLES[Object.keys(PATH_TITLES).find(k => pathname === k || pathname.startsWith(k + '/'))!]
      : 'Sistem Dokumen Mutu'
  );

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value.trim();
    if (q) router.push(`/documents?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="topbar">
      <div className="topbar-title-wrap">
        <h1 className="topbar-title" id="page-title">{activeTitle}</h1>
        <div className="topbar-breadcrumb">
          <span>PLN UP Sertifikasi</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{activeTitle}</span>
        </div>
      </div>

      <div className="topbar-actions">
        {/* Search input with SVG icon */}
        <form onSubmit={handleSearch} className="topbar-search-form">
          <div className="topbar-search">
            <IconSearch size={16} className="search-icon" />
            <input
              name="q"
              placeholder="Cari kode atau judul dokumen..."
              autoComplete="off"
              aria-label="Cari dokumen mutu"
            />
            <kbd className="search-kbd">⌘K</kbd>
          </div>
        </form>

        {/* Intranet Status Indicator */}
        <div className="unit-badge" title="Terkoneksi ke Intranet Server PLN UP Sertifikasi">
          <span className="status-indicator-dot" />
          <span className="unit-badge-text">Intranet UPS</span>
        </div>
      </div>
    </header>
  );
}
