# AI Agent Context & Development Guide
## EDMS PLN UP Sertifikasi — Sistem Dokumen Mutu Digital

Dokumen ini berisi konteks arsitektur, lingkungan kerja, target deployment, dan konvensi proyek untuk asisten AI (AI Agents). Dokumen ini mengacu langsung pada [Spesifikasi_EDMS_Dokumen_Mutu_UPS.md](file:///c:/Users/Nicodemus/Documents/Code/Dokumen%20Mutu%20Digital/Spesifikasi_EDMS_Dokumen_Mutu_UPS.md).

---

## 1. Ringkasan & Ruang Lingkup Sistem (Sesuai Spesifikasi Bab 1–2)
Aplikasi Electronic Document Management System (EDMS) khusus modul **Quality Document Control** untuk pengelolaan dokumen mutu terkendali (*controlled documents*) di lingkungan internal **PLN UP Sertifikasi (UPS)**.

* **Jenis Dokumen Mutu**:
  1. Manual Mutu (Pedoman Mutu)
  2. Prosedur Mutu / SOP
  3. Instruksi Kerja (IK)
  4. Formulir Kerja
* **Pendekatan Dokumen**: Dokumen dikelola sebagai **data terstruktur** di dalam database (bukan sekadar upload file Word/PDF).
* **Tanda Tangan Digital**: Menggunakan signature pad internal (canvas mouse/touchscreen) dengan metadata keabsahan (user login, timestamp, IP/device, hash dokumen saat disahkan). Tidak memerlukan sertifikat pihak ketiga (BSrE/PSrE) untuk versi awal.

---

## 2. Peran Pengguna & Hak Akses (RBAC — Sesuai Spesifikasi Bab 3)

| Peran | Hak Akses Utama |
|---|---|
| **Penyusun Dokumen (Staf Bidang)** | Membuat draft dokumen baru, mengajukan revisi, menautkan referensi dari master referensi |
| **Tim Mutu / Reviewer** | Meninjau draft, memberi catatan revisi, meneruskan ke persetujuan (approval) |
| **Manager Bidang** | Menandatangani persetujuan tahap 1 (approval) untuk dokumen di bidangnya |
| **Pimpinan Unit** | Menandatangani persetujuan final (pengesahan) sebelum dokumen berstatus Aktif |
| **Seluruh Pengguna Internal (Viewer)** | Membaca, mencari, mengunduh PDF dokumen aktif, serta melakukan acknowledge dokumen |
| **Admin Sistem** | Mengelola master referensi, struktur bidang, akun/hak akses, dan siklus review |

---

## 3. Workflow Siklus Hidup Dokumen (Sesuai Spesifikasi Bab 4.2)

Status dokumen bergerak secara berjenjang:
```text
[Draft] ──> [Review Tim Mutu] ──> [Menunggu Approval Manager] ──> [Menunggu Approval Pimpinan] ──> [Aktif]
   ▲                 │                         │                               │                      │
   └─ Catatan Revisi ┴──────── Catatan Revisi ─┴────────────── Catatan Revisi ─┘                      ▼
                                                                                           [Obsolete / Diarsipkan]
```
* Setiap pengesahan versi baru otomatis menandai versi sebelumnya sebagai **Obsolete** dan mengarsipkannya (tidak dihapus demi retensi audit ISO).
* Riwayat approval (siapa, kapan, catatan revisi, dan tanda tangan) tersimpan permanen di tabel `approvals` dan `audit_logs`.

---

## 4. Target Deployment & Arsitektur Jaringan (Sesuai Spesifikasi Bab 9)

### A. Server Produksi: QNAP NAS Internal
* **Host Internal**: `10.10.200.166`
* **Port MariaDB Internal**: `3307` (Hanya internal NAS, **tidak boleh di-port-forward ke internet publik**)
* **Nama Database**: `edms_ups`
* **Spesifikasi Mesin**: QNAP NAS (Resource hemat/entry-level).
* **Strategi Deployment**:
  * Next.js dikompilasi dengan mode `output: 'standalone'` agar hemat memori (RAM ~50MB–100MB).
  * Dijalankan melalui **Container Station (Docker)** di QNAP.
  * Penyimpanan file fisik (PDF, attachment, signature image) disimpan di storage lokal NAS, bukan blob database (Sesuai Bab 9.5 Spesifikasi).

### B. Akses Luar Kantor (WFH) & Tanpa Port Forwarding: Cloudflare Tunnel
* **Kondisi Kantor**:
  * Tidak ada VPN kantor.
  * Tidak bisa membuka/mem-forward port di router kantor.
* **Solusi**: Menggunakan **Cloudflare Tunnel (`cloudflared`)** sebagai container pendamping di QNAP.
* `cloudflared` membuat koneksi aman *outbound* (keluar) ke Cloudflare Edge sehingga aplikasi dapat diakses dari internet publik via domain resmi (misal `https://edms-mutu.domain.com`) secara **gratis, otomatis HTTPS, tanpa buka port router, dan tanpa VPN**.

---

## 5. Struktur Penyimpanan Fisik & Database (Sesuai Spesifikasi Bab 9.5)

```text
Database MariaDB (edms_ups)
├── users & roles
├── documents & document_versions
├── document_sections (data teks terstruktur TipTap)
├── approvals & audit_logs
└── master_references & document_references

Storage Fisik NAS (/share/Container/edms-app/storage/)
├── documents/
│   ├── pdf/           (File PDF dokumen resmi Controlled Copy)
│   └── attachments/   (Lampiran formulir / file pendukung)
└── signatures/        (File gambar tanda tangan digital)
```

---

## 6. Concurrency & Multi-User Safety (Sesuai Spesifikasi Bab 9.4)

* **Atomic Transaction**: Operasi mutasi yang melibatkan beberapa tabel (dokumen, section, referensi, approval) **wajib** menggunakan `withTransaction` dari [db.ts](file:///c:/Users/Nicodemus/Documents/Code/Dokumen%20Mutu%20Digital/edms-app/src/lib/db.ts).
* **Pencegahan Lost Update**: Gunakan pengecekan nomor versi (*optimistic locking*) saat menyimpan revisi dokumen agar perubahan pengguna tidak saling menimpa secara diam-diam.
* **Jejak Audit Otomatis**: Setiap perubahan data wajib mencatat user ID, timestamp, IP/device, dan action context ke tabel `audit_logs`.

---

## 7. Lingkungan Pengembangan (Development Workflow)

### Skenario 1: Bekerja dari Luar Kantor / Rumah (WFH)
Karena IP NAS `10.10.200.166` tidak bisa diakses langsung dari jaringan luar tanpa VPN:
* **Gunakan Database Lokal** di laptop pengembang (Docker Desktop / MariaDB lokal).
* Konfigurasi [.env.local](file:///c:/Users/Nicodemus/Documents/Code/Dokumen%20Mutu%20Digital/edms-app/.env.local):
  ```env
  DB_HOST=127.0.0.1
  DB_PORT=3307
  DB_NAME=edms_ups
  DB_USER=root
  DB_PASSWORD=12345678
  ```
* Schema dan data master diimpor dari:
  * `edms-app/sql/001_schema.sql`
  * `edms-app/sql/002_seed.sql`

### Skenario 2: Bekerja di Jaringan Kantor (On-Premise)
* Terhubung langsung ke Wi-Fi / LAN intranet kantor PLN.
* Konfigurasi [.env.local](file:///c:/Users/Nicodemus/Documents/Code/Dokumen%20Mutu%20Digital/edms-app/.env.local):
  ```env
  DB_HOST=10.10.200.166
  DB_PORT=3307
  DB_NAME=edms_ups
  DB_USER=root
  DB_PASSWORD=12345678
  ```

---

## 8. Struktur Direktori Proyek

```
Dokumen Mutu Digital/
├── AGENTS.md                         # Dokumen konteks & panduan agen ini
├── QNAP_DEPLOYMENT_GUIDE.md           # Panduan lengkap deployment ke QNAP & Cloudflare Tunnel
├── Spesifikasi_EDMS_Dokumen_Mutu_UPS.md # Dokumen Spesifikasi Kebutuhan v1.0 resmi
├── edms-dokumen-mutu.html             # Prototipe visual interaktif 6 modul
└── edms-app/                         # Aplikasi Fullstack Next.js
    ├── Dockerfile                     # Multi-stage build ringan untuk QNAP
    ├── docker-compose.yml             # Compose file untuk Container Station QNAP
    ├── sql/
    │   ├── 001_schema.sql             # DDL MariaDB (tabel, relasi, constraint)
    │   └── 002_seed.sql               # Data master (users, roles, referensi standar ISO)
    ├── src/
    │   ├── app/
    │   │   ├── (app)/                 # Rute utama (dashboard, editor, approval, audit, dll)
    │   │   ├── api/                   # API Routes (auth, documents, approvals, audit, pdf)
    │   │   └── login/                 # Halaman login
    │   ├── components/                # Komponen modular UI (editor, signature pad, layout)
    │   └── lib/                       # Utility (db.ts, auth.ts, rbac.ts, audit.ts, pdf.ts)
    ├── .env.local                     # Environment variables lokal
    └── next.config.ts                 # Konfigurasi Next.js (output: 'standalone')
```

---

## 9. Pedoman Khusus Pengkodean untuk AI Agent

1. **Jaga Efisiensi Resource**:
   * Jangan menambahkan dependency berat yang tidak esensial karena target server adalah QNAP entry-level.
   * Pertahankan konfigurasi `output: 'standalone'` pada build Next.js.
2. **Koneksi Database & Pool**:
   * Selalu gunakan pool dari [db.ts](file:///c:/Users/Nicodemus/Documents/Code/Dokumen%20Mutu%20Digital/edms-app/src/lib/db.ts).
   * Parameter koneksi **wajib** membaca dari `process.env` (jangan pernah hardcode host, user, atau password).
3. **Styling & CSS**:
   * Proyek ini menggunakan **Vanilla CSS Modules** (desain modern, responsif desktop & tablet). Jangan menambahkan TailwindCSS kecuali ada instruksi eksplisit dari pengguna.
4. **Keamanan & Validasi Server**:
   * Validasi token JWT session dan hak akses peran (RBAC) wajib diterapkan di level API endpoint / server actions, bukan sekadar menyembunyikan tombol di frontend.
5. **Generator PDF ISO**:
   * Modul PDF di [pdf.ts](file:///c:/Users/Nicodemus/Documents/Code/Dokumen%20Mutu%20Digital/edms-app/src/lib/pdf.ts) menggunakan `puppeteer-core` dan `@sparticuz/chromium-min` untuk lingkungan server/container Linux/Windows dengan layout kop surat resmi dan watermark *Controlled Copy*.
