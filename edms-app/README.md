# EDMS — Sistem Dokumen Mutu Digital
## PLN UP Sertifikasi | Next.js + MariaDB

### Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Backend**: Next.js API Routes
- **Database**: MariaDB 10.5.8 (NAS internal)
- **Auth**: JWT via HttpOnly cookie (jose + bcryptjs)
- **Rich Text**: TipTap
- **Signature**: signature_pad.js
- **PDF**: Puppeteer (HTML-to-PDF)

---

### Setup Awal

#### 1. Konfigurasi Database
Isi file `.env.local` dengan credentials database NAS Anda:
```
DB_HOST=<IP NAS>
DB_PORT=3307
DB_NAME=edms_ups
DB_USER=edms_app
DB_PASSWORD=<password>
JWT_SECRET=<64-char hex string>
```

Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### 2. Jalankan SQL ke MariaDB NAS
```bash
mysql -h <IP_NAS> -P 3307 -u <admin_user> -p < sql/001_schema.sql
mysql -h <IP_NAS> -P 3307 -u edms_ups -p edms_ups < sql/002_seed.sql
```

#### 3. Install Dependencies
```bash
npm install
```

#### 4. Jalankan Development Server
```bash
npm run dev
```
Buka: http://localhost:3000

#### 5. Akun Default (password: `edms2026`)
| Username | Role |
|----------|------|
| fakhri   | Penyusun Dokumen |
| sari     | Tim Mutu |
| riko     | Manager Bidang |
| budi     | Pimpinan Unit |
| admin    | Admin Sistem |

---

### Build Production (untuk deploy ke NAS)
```bash
npm run build
npm start
```

### Port NAS
- Aplikasi: `3000` (atau sesuai `--port` saat `npm start`)
- Forward port publik `18080` → `3000` internal

---

### Struktur Folder
```
src/
├── app/
│   ├── (app)/           # Protected pages (perlu login)
│   │   ├── dashboard/
│   │   ├── documents/
│   │   ├── editor/
│   │   ├── approval/
│   │   ├── references/
│   │   └── audit/
│   ├── api/             # API Routes
│   │   ├── auth/
│   │   ├── documents/
│   │   ├── references/
│   │   └── audit/
│   └── login/
├── components/
│   ├── layout/
│   └── editor/
├── lib/                 # Core utilities
│   ├── db.ts            # MariaDB pool
│   ├── auth.ts          # JWT session
│   ├── rbac.ts          # Permission matrix
│   ├── pdf.ts           # Puppeteer PDF
│   └── audit.ts         # Audit log writer
└── types/index.ts

sql/
├── 001_schema.sql       # DDL semua tabel
└── 002_seed.sql         # Data awal
```
