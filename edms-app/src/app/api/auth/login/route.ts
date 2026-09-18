import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { setSession } from '@/lib/auth';
import { addAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body as { username: string; password: string };

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi.' }, { status: 400 });
    }

    // Query user + role
    const rows = await query<any[]>(
      `SELECT u.id, u.username, u.full_name, u.password_hash, u.bidang, u.is_active,
              r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.username = ?
       LIMIT 1`,
      [username]
    );

    if (!rows.length) {
      return NextResponse.json({ error: 'Username atau password salah.' }, { status: 401 });
    }

    const user = rows[0];

    if (!user.is_active) {
      return NextResponse.json({ error: 'Akun Anda tidak aktif. Hubungi Admin.' }, { status: 403 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Username atau password salah.' }, { status: 401 });
    }

    const sessionUser = {
      id:       user.id,
      username: user.username,
      fullName: user.full_name,
      role:     user.role,
      bidang:   user.bidang,
    };

    await setSession(sessionUser);

    // Audit log login
    await addAuditLog(sessionUser, 'LOGIN', {
      note:      'Login ke sistem EDMS',
      ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown',
    });

    return NextResponse.json({ data: sessionUser, message: 'Login berhasil.' });

  } catch (err: any) {
    console.error('[POST /api/auth/login]', err?.code, err?.message);
    const code = err?.code ?? 'UNKNOWN';
    if (code === 'ECONNREFUSED') {
      return NextResponse.json({ error: `Koneksi DB ditolak (ECONNREFUSED). Host: ${process.env.DB_HOST}:${process.env.DB_PORT}` }, { status: 503 });
    }
    if (code === 'ETIMEDOUT') {
      return NextResponse.json({ error: `Koneksi DB timeout. Host: ${process.env.DB_HOST}:${process.env.DB_PORT} tidak merespons dalam 8 detik.` }, { status: 503 });
    }
    if (code === 'ENOTFOUND') {
      return NextResponse.json({ error: `Host DB tidak ditemukan (ENOTFOUND): "${process.env.DB_HOST}". Periksa DB_HOST di environment.` }, { status: 503 });
    }
    return NextResponse.json({ error: `Kesalahan server [${code}]: ${err?.message ?? 'Unknown error'}` }, { status: 500 });
  }
}
