# Sistem EDMS Dokumen Mutu Digital
## PT PLN (Persero) Unit Pelaksana Sertifikasi (UPS)

Sistem Electronic Document Management System (EDMS) berbasis web untuk pengelolaan dokumen mutu terkendali (controlled documents) sesuai standar ISO di lingkungan internal PT PLN (Persero) Unit Pelaksana Sertifikasi (UPS).

Sistem ini mengelola dokumen sebagai data terstruktur (bukan sekadar file upload), mendukung penyusunan langsung melalui browser, penomoran klausul dinamis, alur persetujuan bertingkat dengan tanda tangan digital internal, jejak audit otomatis, serta ekspor PDF resmi berstandar ISO.

---

## 1. Fitur Utama Sistem

### Manajemen Dokumen Mutu Terstruktur
Mendukung 7 jenis dokumen mutu baku sesuai format resmi PLN UPS:
* Manual Mutu (Pedoman Mutu)
* Prosedur Mutu / SOP (7 klausul baku)
* Instruksi Kerja (IK) (8 klausul baku)
* Formulir Standar (FR.01.04)
* Berita Acara Pemusnahan Rekaman Mutu (FR.01.05)
* Formulir Pernyataan Kerahasiaan (FR.01.06 - Kepatuhan UU PDP No. 27/2022)
* Formulir Daftar Rekaman Mutu (FR.01.07 - Matriks rekaman 7 kolom)

### Editor Dokumen Interaktif
* TipTap Rich Text Editor untuk klausul naratif.
* TableGridEditor untuk formulir tabel matriks kustom.
* Riwayat revisi terintegrasi (RevisionHistoryEditor) yang mencatat tanggal, revisi, deskripsi, dan paraf pengesahan.
* Penambahan seksi kustom dan pengaturan urutan seksi secara dinamis (drag & drop) dengan penomoran otomatis (auto-renumbering).

### Alur Persetujuan Bertingkat (RBAC Workflow)
Status dokumen bergerak secara terstruktur:
* Draft (Penyusun Dokumen)
* Review (Tim Mutu)
* Menunggu Approval Manager (Manager Bidang)
* Menunggu Approval Pimpinan (Pimpinan Unit)
* Aktif (Dokumen sah dan berlaku)
* Obsolete / Diarsipkan (Otomatis saat versi baru terbit)

### Tanda Tangan Digital Internal
* Komponen canvas tanda tangan digital untuk verifikasi persetujuan di setiap tahapan.
* Metadata keabsahan tersimpan lengkap: user ID, timestamp pengesahan, role, dan file bukti tanda tangan.
* Penempatan otomatis tanda tangan pada matriks persetujuan lembar dokumen dan ekspor PDF.

### Ekspor Dokumen PDF Standar ISO
* Header dokumen resmi: Logo Danantara di sisi kiri dan Logo PLN di sisi kanan.
* Keterangan watermark terkendali resmi: "UNCONTROLLED COPY WHEN DOWNLOADED OR PRINTED".
* Tata letak margin standar ISO (margin atas halaman lanjutan konsisten).
* Mekanisme smart page-break: mencegah pemotongan seksi di tengah halaman (seksi yang tidak muat otomatis berpindah rapi ke halaman berikutnya).

### Keamanan Data & Multi-User Safety
* Optimistic Locking: Pencegahan lost-update saat ada lebih dari satu pengguna mengedit dokumen yang sama.
* Jejak Audit (Audit Logs): Setiap aktivitas login, perubahan dokumen, submit, approval, dan ekspor tercatat secara transparan.

---

## 2. Arsitektur & Teknologi

* Frontend: Next.js 14 (App Router), TypeScript, Vanilla CSS Modules
* Rich Text Editor: TipTap Editor
* Signature Pad: signature_pad (HTML5 Canvas)
* Backend: Next.js API Routes (Server-side RBAC & validation)
* Database: MariaDB 10.5+ (Connection pooling dengan transaksi atomik)
* PDF Engine: Puppeteer Core + Chromium
* Mode Build: Next.js Standalone Mode (efisiensi memori ~50MB - 100MB RAM)
* Target Deployment: QNAP NAS Container Station (Docker) + Cloudflare Tunnel

---

## 3. Struktur Direktori

```text
Dokumen Mutu Digital/
├── README.md                          # Dokumentasi utama proyek
├── AGENTS.md                          # Panduan arsitektur dan konvensi AI Agent
├── QNAP_DEPLOYMENT_GUIDE.md           # Panduan deployment Docker NAS & Cloudflare Tunnel
├── Spesifikasi_EDMS_Dokumen_Mutu_UPS.md # Spesifikasi fungsional dan teknis v1.0
├── DOKUMENTASI_PROGRESS_2026-09-18.md # Laporan audit dan penambahan fitur terkini
└── edms-app/                          # Source code aplikasi Next.js
    ├── Dockerfile                     # Multi-stage build ringan untuk NAS
    ├── docker-compose.yml             # Konfigurasi container service
    ├── docker-compose-qnap.yml        # Konfigurasi spesifik QNAP Container Station
    ├── sql/
    │   ├── 001_schema.sql             # Skema DDL MariaDB
    │   └── 002_seed.sql               # Data inisialisasi awal (roles, users, referensi)
    ├── scripts/
    │   ├── audit_system_2026_09_18.mjs # Skrip validasi menyeluruh (56 test case)
    │   ├── prepare_deploy.mjs         # Skrip bundler standalone untuk produksi
    │   └── sync_to_qnap.mjs           # Skrip otomatisasi sinkronisasi ke storage NAS
    └── src/
        ├── app/                       # Rute aplikasi dan API Next.js
        ├── components/                # Komponen UI modular (Editor, Table, Layout, Icons)
        ├── lib/                       # Modul inti (db, auth, rbac, pdf, documentTypes)
        └── types/                     # Definisi TypeScript
```

---

## 4. Panduan Menjalankan Sistem Secara Lokal

### Prasyarat
* Node.js versi 18 atau lebih baru
* npm versi 9 atau lebih baru
* Akses ke database MariaDB (lokal atau database NAS pada port 3307)

### Langkah 1: Kloning Repositori
```bash
git clone https://github.com/nicodemusbenaya/dokumen-mutu-digital.git
cd dokumen-mutu-digital/edms-app
```

### Langkah 2: Konfigurasi Environment
Salin file `.env.local.example` menjadi `.env.local`:
```bash
cp .env.local.example .env.local
```

Sesuaikan variabel di dalam `.env.local`:
```env
DB_HOST=10.10.200.166
DB_PORT=3307
DB_NAME=edms_ups
DB_USER=root
DB_PASSWORD=your_password
JWT_SECRET=your_generated_jwt_secret_hex_64_characters
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Langkah 3: Inisialisasi Database (Jika Menggunakan Database Baru)
Jalankan file SQL ke dalam MariaDB:
```bash
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p edms_ups < sql/001_schema.sql
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p edms_ups < sql/002_seed.sql
```

### Langkah 4: Instalasi Dependensi
```bash
npm install
```

### Langkah 5: Menjalankan Server Development
```bash
npm run dev
```
Akses aplikasi melalui peramban web di: `http://localhost:3000`

---

## 5. Akun Pengguna Bawaan (Default Testing Accounts)

Password default untuk seluruh akun pengujian adalah: `edms2026`

| Username | Nama Lengkap | Peran (Role) | Hak Akses Utama |
|---|---|---|---|
| fakhri | Fakhri Ramadhan | Penyusun Dokumen | Membuat draft, menyusun seksi dokumen, submit review |
| sari | Sari Rahmawati | Tim Mutu (Reviewer) | Mereview draft dokumen, memberikan catatan revisi, approval tahap 1 |
| riko | Riko Firmansyah | Manager Bidang | Persetujuan manajerial tahap 2 dengan tanda tangan digital |
| budi | Budi Santoso | Pimpinan Unit | Pengesahan final dengan tanda tangan digital, penerbitan status Aktif |
| admin | Administrator | Admin Sistem | Manajemen pengguna, hak akses, master referensi standar, audit logs |

---

## 6. Verifikasi & Pengujian Sistem

Sistem dilengkapi skrip audit otomatis yang mencakup 56 parameter pengujian (kesesuaian 7 template formulir resmi, fungsi reordering & penambahan seksi, skema MariaDB, serta simulasi siklus hidup dokumen dari draft hingga aktif).

Untuk menjalankan audit sistem:
```bash
cd edms-app
npx tsx scripts/audit_system_2026_09_18.mjs
```

---

## 7. Deployment ke QNAP NAS & Cloudflare Tunnel

Untuk petunjuk lengkap deployment containerized menggunakan mode `standalone` ke server internal QNAP NAS serta konfigurasi Cloudflare Tunnel (akses aman tanpa port forwarding router), silakan merujuk ke dokumen:
* [QNAP_DEPLOYMENT_GUIDE.md](QNAP_DEPLOYMENT_GUIDE.md)
