'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login gagal.');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('Tidak dapat terhubung ke server. Periksa koneksi Anda.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>⚡</div>
          <div>
            <div className={styles.logoTitle}>Sistem Dokumen Mutu</div>
            <div className={styles.logoSub}>PLN UP Sertifikasi — EDMS v1.0</div>
          </div>
        </div>
        <form onSubmit={handleLogin}>
          <div className="field">
            <label>Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Masukkan username..."
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label>Kata Sandi</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi..."
              required
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Memproses...' : 'Masuk ke Sistem'}
          </button>
        </form>
        <div className={styles.hint}>
          <strong>Akun default:</strong> username = fakhri / sari / riko / budi / admin<br />
          Password = <code>edms2026</code>
        </div>
      </div>
    </div>
  );
}
