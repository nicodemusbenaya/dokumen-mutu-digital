'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';
import { IconUser, IconLock } from '@/components/icons/Icons';

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
        setError(data.error || 'Login gagal. Periksa username dan kata sandi Anda.');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('Tidak dapat terhubung ke server database. Periksa koneksi jaringan Anda.');
    } finally {
      setLoading(false);
    }
  }

  function fillAccount(u: string) {
    setUsername(u);
    setPassword('edms2026');
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          {/* Dual Brand Header: Danantara & PLN (Emblem Only) */}
          <div className={styles.brandHeader}>
            <div className={styles.brandCard}>
              <div className={styles.danantaraWrap}>
                <Image
                  src="/images/logo-danantara.svg"
                  alt="Danantara Indonesia"
                  width={140}
                  height={28}
                  style={{ width: 'auto', height: 28 }}
                  className={styles.danantaraImg}
                  priority
                />
              </div>
              <div className={styles.brandDivider} />
              <div className={styles.plnWrap} title="Logo PLN (Emblem Resmi)">
                <Image
                  src="/images/logo-pln.png"
                  alt="Logo PLN"
                  width={32}
                  height={32}
                  style={{ width: 'auto', height: 32 }}
                  className={styles.plnImg}
                  priority
                />
              </div>
            </div>

            <div className={styles.titleWrap}>
              <h1 className={styles.sysTitle}>Sistem Dokumen Mutu Digital</h1>
              <p className={styles.sysSub}>
                PT PLN (Persero) Unit Pelaksana Sertifikasi — Danantara Indonesia
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="username">Username Pengguna</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><IconUser size={16} /></span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Masukkan username Anda..."
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Kata Sandi (Password)</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><IconLock size={16} /></span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  required
                />
              </div>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? (
                <span className={styles.btnLoading}>
                  <span className={styles.spinner} />
                  Memverifikasi Kredensial...
                </span>
              ) : (
                'Masuk ke Sistem EDMS'
              )}
            </button>
          </form>

          {/* Quick Account Chips for Testing & Demonstration */}
          <div className={styles.quickAccounts}>
            <div className={styles.quickLabel}>Pilih Cepat Akun Demo (Password: <code>edms2026</code>):</div>
            <div className={styles.chipsRow}>
              <button type="button" className={styles.chip} onClick={() => fillAccount('fakhri')} title="Staf Bidang / Penyusun">
                <strong>fakhri</strong> · Staf
              </button>
              <button type="button" className={styles.chip} onClick={() => fillAccount('sari')} title="Tim Mutu / Reviewer">
                <strong>sari</strong> · Mutu
              </button>
              <button type="button" className={styles.chip} onClick={() => fillAccount('riko')} title="Manager Bidang">
                <strong>riko</strong> · Mgr
              </button>
              <button type="button" className={styles.chip} onClick={() => fillAccount('budi')} title="Pimpinan Unit / Pengesahan">
                <strong>budi</strong> · Pimpinan
              </button>
              <button type="button" className={styles.chip} onClick={() => fillAccount('admin')} title="Administrator">
                <strong>admin</strong> · Admin
              </button>
            </div>
          </div>

          <div className={styles.footerNote}>
            ISO 9001:2015 · ISO 14001:2015 · ISO 45001:2018 · ISO/IEC 17025:2017
          </div>
        </div>
      </div>
    </div>
  );
}
