import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Sidebar from '@/components/layout/Sidebar';
import Topbar  from '@/components/layout/Topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="app-shell">
      <Sidebar user={session} />
      <div className="main-wrap">
        <Topbar title="" user={session} />
        <main className="content-area">
          {children}
        </main>
      </div>
    </div>
  );
}
