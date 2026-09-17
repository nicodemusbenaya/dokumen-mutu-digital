# Panduan Deployment QNAP NAS & Cloudflare Tunnel
## EDMS PLN UP Sertifikasi — Sistem Dokumen Mutu Digital

Panduan ini ditujukan untuk memandu proses deployment aplikasi EDMS ke server **QNAP NAS internal kantor** tanpa memerlukan port forwarding router dan tanpa VPN, serta bagaimana mengelolanya dari Web Admin QNAP (QTS).

---

## 1. Arsitektur Deployment

```
[ Pengguna di Rumah / Luar Kantor ]
               │ (HTTPS: https://edms-mutu.domain.com)
               ▼
      [ Cloudflare Edge ]
               │ (Jalur Tunnel Aman Outbound - Tanpa Buka Port)
               ▼
   [ QNAP NAS Internal (10.10.200.166) ]
   ├── Container 1: cloudflared (Connector Cloudflare)
   ├── Container 2: edms-ups-app (Next.js Standalone Port 3000)
   └── Service Bawaan: MariaDB 10.5.8 (Port 3307 internal)
```

---

## 2. Persiapan Sebelum ke Kantor

Build aplikasi di laptop agar menghasilkan berkas produksi (*standalone*) yang ringan dan hemat RAM:

1. Buka folder `edms-app` di terminal:
   ```bash
   cd "edms-app"
   npm run build
   ```
2. Hasil build akan berada di `.next/standalone`. Berkas ini sangat hemat memori (hanya butuh RAM ~50MB–100MB di QNAP).

---

## 3. Langkah Setup di Web Admin QNAP (QTS)

Semua langkah di bawah ini dilakukan melalui browser (Web Admin QNAP) tanpa perlu terminal SSH.

### Langkah 1: Instal Container Station
1. Login ke Web Admin QNAP (`http://10.10.200.166:8080`).
2. Buka menu **App Center**.
3. Cari **Container Station** dan klik **Install** (gratis).

### Langkah 2: Setup Database MariaDB di QNAP
1. Pastikan fitur **MariaDB / MySQL Server** di QNAP aktif (Menu: *Control Panel* -> *Applications* -> *SQL Server*).
2. Port database standar pada NAS Anda: `3307`.
3. Buka **phpMyAdmin** di QNAP:
   * Buat database baru: `edms_ups`.
   * Klik menu **Import**, pilih berkas `sql/001_schema.sql` lalu klik **Go**.
   * Klik menu **Import**, pilih berkas `sql/002_seed.sql` lalu klik **Go**.

---

## 4. Setup Cloudflare Tunnel (Akses dari Luar Tanpa Buka Port)

Layanan ini **100% gratis** dari Cloudflare Zero Trust:

1. Buka dan daftar akun di [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) (Gratis).
2. Masuk ke menu **Networks** -> **Tunnels** -> Klik **Add a tunnel**.
3. Pilih tipe **Cloudflared**, beri nama tunnel (misal: `qnap-edms-ups`).
4. Pada halaman *Install connector*, pilih **Docker**.
5. Salin kode token yang muncul di layar, formatnya seperti:
   `eyJhIjoiYmNm...`
6. Pada tab **Public Hostname**:
   * Masukkan subdomain yang diinginkan, misal: `edms-mutu` pada domain Anda.
   * Service Type: `HTTP`
   * URL: `edms-app:3000` (atau `10.10.200.166:3000`).
7. Klik **Save hostname**.

---

## 5. Menjalankan Aplikasi di QNAP Container Station

1. Buka **Container Station** di Web QTS.
2. Klik menu **Applications** (atau *Aplikasi*) di bilah kiri.
3. Klik tombol **Create** (Buat).
4. Beri nama aplikasi: `edms-mutu-system`.
5. Di kolom teks YAML (Docker Compose), masukkan konfigurasi berikut:

```yaml
version: '3.8'

services:
  # Layanan Web EDMS Next.js
  edms-app:
    image: node:20-alpine
    container_name: edms-ups-app
    restart: always
    working_dir: /app
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DB_HOST=10.10.200.166
      - DB_PORT=3307
      - DB_NAME=edms_ups
      - DB_USER=root
      - DB_PASSWORD=12345678
      - JWT_SECRET=bff080224bc66715307017bd9ef28b2f14d7c8c5985c00e7afa4a04ab9fc2162
      - SESSION_COOKIE=edms_session
      - NEXT_PUBLIC_APP_URL=http://localhost:3000
    volumes:
      - /share/Container/edms-app:/app
      # Storage fisik NAS untuk PDF, lampiran, dan tanda tangan (Sesuai Bab 9.5 Spesifikasi)
      - /share/Container/edms-app/storage:/app/storage
    command: sh -c "node server.js"

  # Layanan Cloudflare Tunnel
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: edms-cloudflare-tunnel
    restart: always
    command: tunnel --no-autoupdate run --token MASUKKAN_TOKEN_CLOUDFLARE_DISINI
    depends_on:
      - edms-app
```
*(Ganti `MASUKKAN_TOKEN_CLOUDFLARE_DISINI` dengan token yang Anda dapatkan di langkah 4).*

6. Klik **Validate YAML**, lalu klik **Create**.
7. Container Station akan otomatis mengunduh image dan menjalankan aplikasi.

---

## 6. URL / Link yang Dihasilkan

Setelah container berjalan:
* **Akses Internal Kantor**: `http://10.10.200.166:3000`
* **Akses Eksternal (WFH / Rumah / Mobile)**: `https://edms-mutu.domainanda.com` (Otomatis HTTPS aman, tanpa perlu VPN kantor).

---

## 7. Catatan Pemeliharaan & Troubleshooting

* **Jika QNAP restart (misal setelah mati lampu):** Container Station telah diatur dengan opsi `restart: always`, sehingga aplikasi dan Cloudflare Tunnel akan otomatis menyala kembali saat NAS hidup.
* **Melihat Log Aplikasi:** Buka *Container Station* -> Klik *Containers* -> Klik container `edms-ups-app` atau `edms-cloudflare-tunnel` -> Tab *Logs*.
* **Backup Database:** Database tersimpan di MariaDB QNAP, backup otomatis dapat dijadwalkan menggunakan fitur *Backup Station* atau *Hybrid Backup Sync (HBS 3)* bawaan QNAP ke disk eksternal/cloud.
