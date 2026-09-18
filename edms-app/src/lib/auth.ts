import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────
//  Authentication & Session — JWT via HttpOnly cookie
// ─────────────────────────────────────────────────────────────────

export interface SessionUser {
  id:       number;
  username: string;
  fullName: string;
  role:     string;
  bidang:   string | null;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set in environment');
  return new TextEncoder().encode(secret);
}

const COOKIE_NAME  = process.env.SESSION_COOKIE || 'edms_session';
const EXPIRES_IN   = 60 * 60 * 8; // 8 jam

// ─── Create signed JWT ────────────────────────────────────────

export async function createToken(user: SessionUser): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(getSecret());
}

// ─── Verify JWT ───────────────────────────────────────────────

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

// ─── Set session cookie ───────────────────────────────────────

export async function setSession(user: SessionUser): Promise<void> {
  const token = await createToken(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.COOKIE_SECURE === 'true' || (process.env.NEXT_PUBLIC_APP_URL?.startsWith('https') ?? false),
    sameSite: 'lax',
    maxAge:   EXPIRES_IN,
    path:     '/',
  });
}

// ─── Get current session ──────────────────────────────────────

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── Clear session ────────────────────────────────────────────

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ─── Middleware helper: get session from Request ──────────────

export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── API Route guard ──────────────────────────────────────────

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized: Silakan login terlebih dahulu.' }, { status: 401 });
}
export function forbidden(): NextResponse {
  return NextResponse.json({ error: 'Forbidden: Role Anda tidak memiliki akses ke fungsi ini.' }, { status: 403 });
}
