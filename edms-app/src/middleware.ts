import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

// Protect all routes under (app) group
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/documents/:path*',
    '/editor/:path*',
    '/approval/:path*',
    '/pdf/:path*',
    '/references/:path*',
    '/audit/:path*',
    '/manage/:path*',
  ],
};

export async function middleware(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}
