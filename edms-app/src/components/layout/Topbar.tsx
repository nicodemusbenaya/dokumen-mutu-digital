'use client';

import { useRouter } from 'next/navigation';
import type { SessionUser } from '@/lib/auth';

export default function Topbar({ title, user }: { title: string; user: SessionUser }) {
  const router = useRouter();

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value.trim();
    if (q) router.push(`/documents?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="topbar">
      <div className="topbar-title" id="page-title">{title}</div>
      <div style={{ display:'flex', gap:12, alignItems:'center' }}>
        <form onSubmit={handleSearch}>
          <div className="topbar-search">
            <span>🔍</span>
            <input name="q" placeholder="Cari dokumen..." autoComplete="off" />
          </div>
        </form>
      </div>
    </header>
  );
}
