'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import type { SessionUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import {
  IconDashboard,
  IconDocuments,
  IconEditor,
  IconApproval,
  IconPdf,
  IconPeta,
  IconReferences,
  IconAudit,
  IconLogout,
} from '@/components/icons/Icons';

interface NavItem {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  perm?: string;
  badgeKey?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  icon: IconDashboard,  label: 'Dashboard' },
  { href: '/documents',  icon: IconDocuments,  label: 'Daftar Dokumen' },
  { href: '/editor',     icon: IconEditor,     label: 'Editor Dokumen' },
  { href: '/approval',   icon: IconApproval,   label: 'Approval Mutu', badgeKey: 'approval' },
  { href: '/pdf',        icon: IconPdf,        label: 'Lihat & Cetak PDF' },
  { href: '/manage',     icon: IconPeta,       label: 'Peta Dokumen' },
  { href: '/references', icon: IconReferences, label: 'Master Referensi' },
  { href: '/audit',      icon: IconAudit,      label: 'Audit Trail' },
];

export default function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [approvalCount, setApprovalCount] = useState<number>(0);

  const initials = user.fullName
    ? user.fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/documents?limit=100');
        if (res.ok) {
          const json = await res.json();
          const pending = (json.data || []).filter(
            (d: any) => d.status === 'Review' || d.status === 'Menunggu Approval'
          ).length;
          setApprovalCount(pending);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadStats();
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const visibleItems = NAV_ITEMS.filter(item => {
    if (!item.perm) return true;
    return hasPermission(user.role, item.perm as any);
  });

  return (
    <aside className="sidebar">
      {/* Brand Header with Dual Logos: Danantara & PLN (Emblem Only) */}
      <div className="sidebar-brand">
        <div className="sidebar-logo-card">
          <div className="sidebar-logo-row">
            {/* Danantara Logo */}
            <div className="danantara-logo-wrap">
              <Image
                src="/images/logo-danantara.svg"
                alt="Logo Danantara Indonesia"
                width={120}
                height={22}
                style={{ width: 'auto', height: 22 }}
                className="danantara-img"
                priority
              />
            </div>
            <div className="brand-divider" />
            {/* PLN Emblem ONLY (No PLN text) */}
            <div className="pln-emblem-wrap" title="PLN (Emblem Resmi)">
              <Image
                src="/images/logo-pln.png"
                alt="PLN Emblem"
                width={26}
                height={26}
                style={{ width: 'auto', height: 26 }}
                className="pln-emblem-img"
                priority
              />
            </div>
          </div>
        </div>

        <div className="sidebar-brand-text">
          <div className="sidebar-brand-title">DOKUMEN MUTU DIGITAL</div>
          <div className="sidebar-brand-sub">PLN UP Sertifikasi · EDMS v1.0</div>
        </div>
      </div>

      {/* User profile card */}
      <div className="sidebar-user">
        <div className="user-avatar">{initials}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="user-name" title={user.fullName}>
            {user.fullName}
          </div>
          <div className="user-role" title={user.role}>
            {user.role}
          </div>
        </div>
      </div>

      <div className="sidebar-section-label">Navigasi Utama</div>

      {/* Navigation items */}
      <nav className="sidebar-nav">
        {visibleItems.map(item => {
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);

          const IconComp = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${active ? 'active' : ''}`}
            >
              <span className="nav-icon">
                <IconComp size={18} />
              </span>
              <span className="nav-label">{item.label}</span>
              {item.badgeKey === 'approval' && approvalCount > 0 && (
                <span className="nav-badge">{approvalCount}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer & Logout */}
      <div className="sidebar-footer">
        <button
          className="sidebar-footer-btn"
          title="Keluar dari sesi ini"
          onClick={handleLogout}
        >
          <IconLogout size={16} />
          <span>Keluar Sistem</span>
        </button>
      </div>
    </aside>
  );
}
