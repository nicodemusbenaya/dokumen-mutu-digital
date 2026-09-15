import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, clearSession } from '@/lib/auth';
import { addAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (user) {
    await addAuditLog(user, 'LOGOUT', { note: 'Logout dari sistem' });
  }
  await clearSession();
  return NextResponse.json({ message: 'Logout berhasil.' });
}
