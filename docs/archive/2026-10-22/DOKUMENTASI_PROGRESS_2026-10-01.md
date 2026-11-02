# DOKUMENTASI PROGRESS PENGEMBANGAN SISTEM EDMS DOKUMEN MUTU
## PT PLN (Persero) Unit Pelaksana Sertifikasi (UPS)
**Tanggal Dokumentasi:** 1 Oktober 2026
**Status Sistem:** v1.1 — 4 Perbaikan PDF Terimplementasi, Ter-Commit (`88b4b86`), Ter-Deploy ke NAS, **MENUNGGU RESTART CONTAINER**

---

## 1. Ringkasan Eksekutif

Pada sesi ini (sejak anchor `_ai_work_prompt_20261001_130000`) dikerjakan **empat perbaikan tampilan ekspor PDF** yang sebelumnya dilaporkan "kurang rapi", lengkap dengan regenerasi data kop, verifikasi visual, quality gate, commit, dan deploy:

| No | Fix | Kode | Status |
|---|---|---|---|
| A | Daftar Isi (TOC) spesifik — bukan lagi "Tabel 1, Tabel 2…" | `documentTypes.ts` | ✅ Selesai & terverifikasi |
| B | Judul "RIWAYAT PERUBAHAN" tidak lagi ganda | `pdf.ts` | ✅ Selesai & terverifikasi |
| C | Daftar Referensi dideduplikasi (7 → 4 unik di doc1) | `pdf.ts` | ✅ Selesai & terverifikasi |
| D | Kop header Excel/Word dengan *vMerge* (rowspan) tidak terpotong dua baris | `docParser.ts` | ✅ Selesai & terverifikasi + data lama diregenerasi |

**Status akhir sesi:**
- Commit: `88b4b86` (5 file, 198 insertions / 49 deletions) di branch `main`.
- Quality gate: `tsc --noEmit` **exit 0**, `eslint .` **155 problems** (baseline 118 errors / 37 warnings — persis), `npm run build` **exit 0**.
- Deploy: **DEPLOY_OK**, BUILD_ID `bKNe1IsoEJHPFi7h8kT57` di `\\10.10.200.166\Container\edms-app`.
- Backup otomatis pre-deploy: `edms-app-backup-20261001-143146` (251.1 MB + dump DB `edms_ups.sql`, 1972 baris).
- **BELUM**: restart container, smoke produksi, verifikasi colSpan di produksi, regenerasi PDF via NAS.

---

## 2. Rincian Perbaikan PDF (Fix A–D)

### A. Daftar Isi Spesifik (`src/lib/documentTypes.ts`)
- Helper baru: `isJunkSectionTitle` (tolak judul `^Tabel \d+$` dan judul berisi *dot-run* `(?:\.|…){4,}`), `stripTagsToText`, `cleanDerivedTitle` (hapus dot-run, cap 100 char di *word-boundary* + `…`).
- `deriveSectionTitleFromContent` — 3 strategi berurutan:
  1. Teks `<strong>/<b>` (≤2 elemen) sebelum tabel pertama;
  2. Sel `<tr>` pertama (sel terpanjang, non-junk);
  3. Paragraf pertama yang valid (alfanumerik, ≥4 char).
- Terintegrasi di `getOrderedSections`: cabang `_section_order` (via binding `const secs = sections;` agar narrowing aman di callback) dan cabang ekstras langkah 3.
- **Hasil**: doc100 TOC = "1. CVP - CEKLIS VERIFIKASI PORTOFOLIO / 2. Skema Sertifikasi… / 3. PANDUAN BAGI ASESOR / 4. Bukti Portofolio…"; doc47 = "RENCANA AUDIT INTERNAL SMT / Kegiatan Tim Audit…"; doc183 = judul derive membedakan lingkup ("…JARAK JAUH (TUK)" dsb). Judul asli template (doc1) tidak tersentuh.

### B. Judul RIWAYAT Tunggal (`src/lib/pdf.ts`)
- Hapus div `.riwayat-page-title` dari `riwayatHtml` + hapus rule CSS-nya; caption tunggal dari `renderRevisionTableHtml` dipertahankan.
- **Hasil**: doc100 halaman riwayat = satu judul + tabel menempel (visual).

### C. Dedupe Referensi (`src/lib/pdf.ts`, `buildContentHtml`)
- Filter `doc.refs` dengan `Set` kunci `${kategori}|${nomor}|${judul}` (lowercase) sebelum render.
- **Hasil**: doc1 referensi 7 → 4 unik, terverifikasi visual (halaman terakhir: kop generik, seksi 1–7, 4 referensi, footer bersih).

### D. Parser Kop vMerge (`src/lib/docParser.ts`, `wmlTable`)
- Ditulis ulang dua-pass: tipe `MergeSpan {startRow,endRow}` + `CellDraft` per sel; Map `activeMerges`; `continue` → perpanjang `endRow` + **skip saat emit** (tercakup rowspan); `continue` tanpa restart → placeholder `<td>`; `restart` → emit `rowspan=endRow-startRow+1`.
- Bug yang sempat muncul dan sudah diperbaiki: *cleanup* akhir baris menghapus merge yang baru dibuka → dijaga dengan guard `m.startRow < rowIndex && !continuedCols.has(key)`.
- **Hasil**: doc100 kop = `[logo rowspan=2][title rowspan=2][Nomor] / [Tanggal]` — Nomor & Tanggal satu baris grid, border utuh (visual sempurna).

### Regenerasi Data Kop (141 file)
- Skrip one-off `edms-app/_tmp_regen_kop.mjs` (masih ada, untracked): bangun parser via tsc ke `scripts/.parser-build/`, parse `source.docx` dengan `fileName "${kode} ${judul}.docx"`, rewrite `@@IMG:n@@` inline, validasi (`<table>` + keberadaan file gambar + bandingkan set `<img>` dengan kop lama), `--write` → backup `kop.html.bak` lalu tulis ke **3 lokasi** (lokal + 2 share SMB NAS).
- Hasil: **165 dokumen berkop → ok=141, skip=3 (id 219/225/226 — dokumen test tanpa source), fail=21** (kop lama juga berupa paragraf non-tabel → file lama dipertahankan, bukan regresi). Semua UPDATE persis **+24 bytes** (2× `rowspan="2"`).
- Lokasi media (wajib sinkron jika ada perubahan manual):
  1. `edms-app\storage\media\{id}\`
  2. `\\10.10.200.166\Container\edms-data\media\{id}\`
  3. `\\10.10.200.166\Container\edms-app\storage\media\{id}\`

---

## 3. Verifikasi (Lokal, via Dev Server + Puppeteer)

- Dev server lokal (`npm run dev`, port 3000) dijalankan, lalu PDF diregenerasi via `node _tmp_pdf_report.mjs http://localhost:3000` (DB = NAS, storage = lokal).
- PDF dihasilkan OK: doc100 7h, doc47 6h, doc1 6h (dari 8h), doc2 41h, doc183 64h, doc44 5h.
- Verifikasi **visual** (PNG per halaman, tool `read`): TOC doc100/doc47/doc183, RIWAYAT doc100, kop doc100 hal.2, referensi doc1 hal.2, halaman pengesahan & footer — **semua fix lolos**.
- Catatan penting: ekstrak teks (`_tmp_text.mjs`) = *paint order*, urutan bisa menyesatkan (li `::before` counter) → **visual PNG lebih otoritatif**; limit `slice` sudah dinaikkan 600 → 5000. Tool `read` gambar pernah salah-*attach* (tertukar) → baca file PNG bernama unik satu per satu.

---

## 4. Perubahan Lain di Sesi Ini

1. **`eslint.config.mjs`** — tambah ignores `scripts/.parser-build/**` dan `_tmp_*` (baseline kembali bersih 155).
2. **`scripts/smoke_template.mjs`** — assert count **relatif terhadap baseline** (bukan angka absolut 30/148/178/31 yang mudah pecah saat data bertambah):
   - `baseExcl` = total default (tanpa template), `baseTpl` = total `isTemplate=1`;
   - `includeTemplates === baseExcl + baseTpl`; setelah create `=== baseExcl + 1`; setelah flag `=== baseExcl`; setelah unflag `=== baseExcl + 1`.
3. **Cleanup sesi** — semua file temp investigasi dihapus (`vfix_*.png`, `_tmp_pdf/`, `_tmp_*.txt`, `_tmp_dev.log`, `_tmp_find/heads/sections/t02`, `_tmp_header1.xml`, log di root). **Toolkit yang DIPERTAHANKAN** (untracked, di-ignore eslint): `_tmp_pdf_report.mjs`, `_tmp_render.mjs`, `_tmp_text.mjs`, `_tmp_compose.mjs`, `_tmp_inspect.mjs`, `_tmp_list.mjs`, `_tmp_recent.mjs`, `_tmp_refs.mjs`, `_tmp_regen_kop.mjs`, plus `scripts/.parser-build/` (output tsc parser, dibangun ulang on-demand).
4. **Dev server lokal dimatikan** — sesi berhenti dalam kondisi bersih, tidak ada proses berjalan.

---

## 5. Langkah Lanjutan di Sesi Baru (BELUM DILAKUKAN)

1. **Minta user restart container** `edms-ups-app` di Container Station
   (Applications/Compose → `edms-mutu-system` → `edms-ups-app` → Restart). Tidak bisa otomatis dari CLI.
2. **Tanyakan status mount volume `edms-data`** di Container Station (media sudah tersync manual, tapi mount penting untuk kelanjutan).
3. **Smoke produksi**: `node scripts/smoke_template.mjs` dengan `BASE_URL=http://10.10.200.166:3000` dan `STORAGE_ROOT='\\10.10.200.166\Container\edms-data'` (skrip sudah versi relatif, ikut ter-deploy).
4. **Verifikasi colSpan fix (`2a0fcfc`) di produksi**: puppeteer buka `/editor/{id}` template 38 terhadap NAS → 0 error console.
5. **Regenerasi PDF via NAS** untuk konfirmasi akhir: `node _tmp_pdf_report.mjs` (default `BASE=http://10.10.200.166:3000`), lalu render halaman kunci (doc100 hal.2–4, doc1 hal.2 terakhir, doc47 TOC) dan bandingkan dengan hasil lokal.
6. **Commit toolkit (opsional)** bila skrip audit mau dipertahankan permanen — saat ini semua `_tmp_*` untracked & sengaja tidak di-commit.
7. **Bereskan known issue**: doc2 front-matter ganda; 21 dokumen kop non-tabel (fail regen, file lama dipertahankan — pertimbangkan normalisasi bila perlu).

---

## 6. Fakta Lingkungan & Gotcha

- DB: MariaDB `10.10.200.166:3307/edms_ups` (login `admin`/`edms2026`); `.env.local` menunjuk NAS.
- Deploy: `powershell -File scripts\deploy\deploy-nas.ps1` dari `edms-app\` (backup otomatis; **tidak** menyalin `storage`); rollback: `rollback-nas.ps1 -Backup <nama>`.
- PowerShell 5.1: file `.ps1` wajib ASCII-only; **hindari `node -e` inline** (rawan gagal parsing) → tulis file `.mjs` sementara.
- PDF generik (bukan kop impor) memakai `buildHeaderTemplate` (3-kolom, Tanggal di bawah Nomor) — sudah rapi, jangan diutak-atik.
- Commit sesi ini: `88b4b86 fix(pdf): TOC judul turunan dari konten, kop vMerge, dedupe referensi, judul riwayat tunggal` — sebelumnya `2a0fcfc` (colSpan editor), `5fb0b78` (deploy/smoke scripts), `74894f9` (fitur template).

---

*Dokumentasi ini disiapkan sebagai catatan kelanjutan kerja (anchor sesi baru) untuk Sistem EDMS Dokumen Mutu Digital PT PLN (Persero) Unit Pelaksana Sertifikasi.*
