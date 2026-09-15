'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { SessionUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';

interface NavItem {
  href:  string;
  icon:  string;
  label: string;
  perm?: string;
  badgeKey?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  icon: '🏠', label: 'Dashboard' },
  { href: '/documents',  icon: '📄', label: 'Daftar Dokumen' },
  { href: '/editor',     icon: '✏️', label: 'Editor Dokumen' },
  { href: '/approval',   icon: '✅', label: 'Approval', badgeKey: 'approval' },
  { href: '/pdf',        icon: '📑', label: 'Lihat PDF' },
  { href: '/manage',     icon: '📁', label: 'Manajemen Dokumen' },
  { href: '/references', icon: '📚', label: 'Master Referensi' },
  { href: '/audit',      icon: '🔍', label: 'Audit Log' },
];

export default function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router   = useRouter();
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
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo">
          <div className="sidebar-brand-icon">📋</div>
          <div className="sidebar-brand-name">Dokumen Mutu<br />Digital</div>
        </div>
        <div className="sidebar-unit">PLN UP Sertifikasi · EDMS v1.0</div>
      </div>

      <div className="sidebar-user">
        <div className="user-avatar">{initials}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.fullName}
          </div>
          <div className="user-role" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.role}
          </div>
        </div>
      </div>

      <div className="sidebar-section-label">Menu Utama</div>

      <nav>
        {visibleItems.map(item => {
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${active ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badgeKey === 'approval' && approvalCount > 0 && (
                <span className="nav-badge">{approvalCount}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sidebar-footer-btn"
          title="Keluar"
          onClick={handleLogout}
          style={{ flex: 1 }}
        >
          🚪 Keluar
        </button>
      </div>
    </aside>
  );
}
