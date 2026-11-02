# RENCANA FITUR TEMPLATE DOKUMEN
## EDMS Dokumen Mutu Digital — PT PLN (Persero) Unit Pelaksana Sertifikasi (UPS)

**Tanggal Dokumentasi:** 29 September 2026
**Status:** DRAFT — Menunggu persetujuan implementasi
**Metode Penyusunan:** Wawancara keputusan bercabang (*grill-me*) — 12 cabang keputusan, seluruhnya sudah terjawab
**Dokumen Terkait:** `Spesifikasi_EDMS_Dokumen_Mutu_UPS.md`, `DOKUMENTASI_PROGRESS_2026-09-18.md`, `AGENTS.md`

---

## 1. Ringkasan & Tujuan

Saat ini **173 dokumen hasil import** sudah berada di sistem sebagai data terstruktur (600 seksi, 789 baris `document_sections`), namun seluruhnya **sekali pakai** — tidak ada cara untuk membuat dokumen baru yang strukturnya meniru dokumen yang sudah ada. Pengguna yang hendak membuat Formulir baru harus menyusun ulang kop, tabel, dan klausul dari nol.

Fitur **Template Dokumen** memberi kemampuan:

1. **Menandai dokumen** (khususnya blanko hasil import) sebagai template.
2. **Membuat dokumen baru dari template** — seluruh isi sections, kop, referensi, berkas sumber, gambar, dan lampiran ikut tersalin, lalu dokumen hasil masuk ke siklus normal (`Draft` → Review → Approval → Aktif).
3. **Tersedia template bawaan sistem** untuk jenis dokumen yang belum punya padanan di arsip impor.

---

## 2. Latar Belakang (Kondisi Saat Ini)

### 2.1 Distribusi Dokumen di Database

| Jenis | Aktif | Draft | Review | Obsolete | Total |
|---|---:|---:|---:|---:|---:|
| Formulir Kerja | 128 | 3 | – | – | **131** |
| SOP/Prosedur | 24 | – | 1 | 1 | **26** |
| Formulir Tambahan | 12 | – | – | – | **12** |
| Manual Mutu | 1 | – | – | – | **1** |
| BA Pemusnahan Rekaman | 1 | – | – | – | **1** |
| Daftar Rekaman Mutu | 1 | – | – | – | **1** |
| Pernyataan Kerahasiaan | 1 | – | – | – | **1** |
| Instruksi Kerja | – | – | – | – | **0** |

Semua dokumen hasil import berstatus `Aktif` dengan approval sintetis stage 2 (Manager Bidang) dan stage 3 (Pimpinan Unit).

### 2.2 Kapabilitas yang Sudah Ada

- **"Muat Template Baku"** di editor: memuat HTML default **per jenis seksi** dari `src/lib/documentTypes.ts` — bukan dokumen utuh.
- **`POST /api/documents`**: membuat dokumen kosong (tanpa sections).
- Belum ada: penandaan template, duplikasi dokumen, pustaka template, maupun relasi antar dokumen selain `parent_prosedur_id`.

---

## 3. Keputusan Desain (12 Cabang)

| # | Cabang | Keputusan | Alasan / Konsekuensi |
|---|---|---|---|
| 1 | Konsep template | **Keduanya**: dokumen bisa ditandai *plus* template bawaan sistem | Menjaga "Muat Template Baku" yang sudah ada sekaligus menambah pustaka template |
| 2 | Mekanisme penyimpanan | **Flag di tabel `documents`** (`is_template`, `template_source_id`) | `document_sections.document_id` NOT NULL + FK CASCADE → sections bisa dipakai ulang apa adanya, **tanpa migrasi schema section** |
| 3 | Cakupan copy | **Semua**: sections+urutan, jenis+kop+bidang, referensi, berkas sumber, gambar+lampiran | Dokumen hasil harus siap pakai, bukan kerangka kosong |
| 4 | Isian awal | **Form dulu, kode diisi manual** | `kode` NOT NULL UNIQUE & format resmi (`FR.UPS.SER3.…`) — tidak boleh auto-generate |
| 5 | Rumah di UI | **Menu sidebar "Template"**; template **tidak** tampil di `/documents` | Daftar dokumen tetap bersih; master template punya ruang sendiri |
| 6 | RBAC | **Konsisten dengan `document:create`** → Penyusun Dokumen + Admin Sistem | Tanpa perubahan kebijakan akses; permission baru `template:set` hanya alias eksplisit |
| 7 | Syarat template | **Status tidak jadi syarat** (Draft/Review/Obsolete tetap boleh) | Fleksibel saat menyusun. ⚠️ Risiko: lihat §11 |
| 8 | Template bawaan | **Keduanya**: pertahankan "Muat Template Baku" + seed baris template | Dua level: per seksi (editor) dan per dokumen (menu Template) |
| 9 | Penandaan impor | **Hanya blanko** | Mencegah 167 dokumen tiba-tiba lenyap dari daftar Dokumen |
| 10 | Jenis blanko | **Formulir Kerja + Formulir Tambahan = 143 dokumen** | Daftar Dokumen tersisa ≈30 (SOP, Manual, BA, Daftar, Pernyataan) |
| 11 | Sasaran seed | **Hanya jenis langka**: Instruksi Kerja (0), Manual Mutu, Pernyataan Kerahasiaan, BA Pemusnahan, Daftar Rekaman | Formulir & SOP sudah terwakili template impor |
| 12 | Titik masuk | **Dropdown "Dokumen Baru"** (→ "Dari template…") **+ tombol per kartu di menu Template** | Discoverable tanpa mengubah perilaku lama |

---

## 4. Model Data

### 4.1 Migrasi Baru: `sql/004_migration_template.sql`

```sql
-- Kolom penanda template
ALTER TABLE `documents`
  ADD COLUMN `is_template` TINYINT(1) NOT NULL DEFAULT 0
      COMMENT '1 = dokumen ini dipakai sebagai template, disembunyikan dari daftar Dokumen',
  ADD COLUMN `template_source_id` INT UNSIGNED NULL
      COMMENT 'FK self → template asal dokumen ini (hasil "Buat dari Template")',
  ADD CONSTRAINT `fk_documents_template_source`
      FOREIGN KEY (`template_source_id`) REFERENCES `documents`(`id`)
      ON DELETE SET NULL,
  ADD INDEX `idx_documents_is_template` (`is_template`);

-- Penandaan massal 143 blanko (Cabang #9 & #10)
UPDATE `documents`
   SET `is_template` = 1
 WHERE `jenis` IN ('Formulir Kerja', 'Formulir Tambahan');
```

### 4.2 Yang Sengaja TIDAK Diubah

- `documents.status` enum — template **bukan** status baru (Cabang #1/#7).
- `document_sections` — tidak ada kolom/relasi baru (Cabang #2).
- Tidak ada tabel `templates` terpisah.

---

## 5. Template Bawaan Sistem (Seed)

Lima baris `documents` baru dengan `is_template = 1` untuk jenis yang belum tersedia:

| Kode (usulan) | Jenis | Dasar Isi |
|---|---|---|
| `TPL.IK.STD-01` | Instruksi Kerja | `defaultHtml` seksi IK di `documentTypes.ts` (8 klausul teknis) |
| `TPL.MUTU.STD-01` | Manual Mutu | Struktur seksi Manual Mutu |
| `TPL.PERNY.STD-01` | Pernyataan Kerahasiaan | Struktur pernyataan + butir komitmen |
| `TPL.BA.STD-01` | BA Pemusnahan Rekaman | Tabel matriks pemusnahan |
| `TPL.DRM.STD-01` | Daftar Rekaman Mutu | Tabel matriks 7 kolom rekaman terkendali |

- `penyusun_id` = Admin Sistem (sesuai `PENYUSUN_ID` pada `scripts/import_formulir_eksisting.mjs`).
- Isi sections disusun lewat script `scripts/seed_templates.mjs` (INSERT ke `documents` + `document_sections` + `_section_order`), bukan SQL mentah — agar HTML bisa dirakit dari `documentTypes.ts` tanpa duplikasi sumber.
- Tombol **"Muat Template Baku"** di editor dipertahankan tanpa perubahan.

---

## 6. Alur & UX

### 6.1 Menu Sidebar "Template" (baru)

- Route: `src/app/(app)/templates/page.tsx`
- Daftar kartu: kode, judul, jenis, bidang, **badge status** (`Draft`/`Aktif`/`Obsolete`), jumlah seksi.
- Tombol per kartu: **"Buat Dokumen dari Template"**.
- Hanya tampil untuk role dengan `document:create` (Penyusun Dokumen, Admin Sistem).

### 6.2 Dropdown Tombol "Dokumen Baru" (diubah)

- `src/app/(app)/documents/page.tsx`: tombol "Dokumen Baru" menjadi dropdown:
  - **Dokumen kosong** → perilaku lama (`POST /api/documents`).
  - **Dari template…** → dialog pilih template → form isian → `POST /api/documents/from-template`.

### 6.3 Form Isian (baru)

**Wajib diisi ulang:** Kode (dicek unik, ditolak dengan pesan jelas bila bentrok) dan Judul.
**Terisi default dari template (bisa diubah):** Jenis, Bidang, Kop.
Setelah sukses → langsung diarahkan ke `/editor/{idBaru}`.

### 6.4 Tombol di Detail Dokumen (diubah)

`src/app/(app)/documents/[id]/page.tsx`:
- **"Jadikan Template"** → `POST /api/documents/{id}/template` (set `is_template=1`).
- **"Hapus dari Tanda Template"** → `DELETE` pada endpoint yang sama (kembali ke daftar Dokumen).
- **"Buat Dokumen dari Template Ini"** (muncul bila `is_template=1`).

---

## 7. Ruang Lingkup Copy

### 7.1 Yang IKUT

| Item | Sumber | Mekanisme |
|---|---|---|
| Isi sections + urutan | `document_sections` (semua baris, termasuk `_section_order`; `riwayat_perubahan` mengikuti aturan reset di §7.2) | `INSERT` baris baru ke `document_sections` dokumen hasil; `section_key` UNIQUE per dokumen aman |
| Jenis, bidang, kop | `documents.jenis/bidang/kop_path` | Field disalin; `kop_path` → **file `kop.html` ikut di-copy** ke `storage/media/{idBaru}/` |
| Referensi standar | `document_references` | `INSERT` baris baru (relasi many-to-many) |
| Berkas sumber | `source_path/source_name/source_ext` | File di-copy dari `storage/media/{idLama}/source.ext` → `storage/media/{idBaru}/source.ext`; kolom diperbarui |
| Gambar inline | URL `/uploads/media/{idLama}/{NNN}.png` di HTML section | File di-copy ke `storage/media/{idBaru}/`, URL di-rewrite di HTML **sebelum** insert |
| Lampiran | Ikut folder `storage/media/{idLama}/` | Seluruh folder media di-copy lalu URL di-rewrite |

### 7.2 Yang TIDAK IKUT

| Item | Alasan |
|---|---|
| `approvals` | Dokumen hasil harus melalui siklus persetujuan penuh |
| Riwayat perubahan | Section `riwayat_perubahan` **dipertahankan strukturnya tetapi kontennya di-reset** ke tabel kosong (header tanpa baris riwayat) — riwayat versi dokumen sumber tidak ikut |
| `ack_total` / `ack_done` | Acknowledge baru untuk dokumen baru |
| `current_version` / `version_number` | Lahir sebagai `1.0` / `1` |
| `document_versions` | Belum ada versi terarsip |
| Audit log dokumen sumber | Baris baru dibuat oleh aksi "buat dari template" |

### 7.3 Kondisi Awal Dokumen Hasil

`status = 'Draft'`, `current_version = '1.0'`, `version_number = 1`, `penyusun_id` = user pembuat, `is_template = 0`, `template_source_id` = id template.

---

## 8. API Endpoints

| Endpoint | Method | Deskripsi | Akses |
|---|---|---|---|
| `/api/documents/from-template` | POST | Buat dokumen baru dari template (body: `templateId`, `kode`, `judul`, `bidang`) — atomic dengan `withTransaction` | Penyusun, Admin |
| `/api/documents/[id]/template` | POST | Set `is_template = 1` | Penyusun, Admin |
| `/api/documents/[id]/template` | DELETE | Set `is_template = 0` | Penyusun, Admin |
| `/api/documents?isTemplate=1` | GET | Daftar template (untuk dropdown & halaman Template) | Login + `document:create` |

### 8.1 Perubahan pada Endpoint yang Ada

- **`GET /api/documents`**: **mengecualikan** `is_template = 1` secara default (`isTemplate=1` hanya bila diminta eksplisit).
- ⚠️ **Wajib diaudit** seluruh pembacaan `documents` yang terdampak: dashboard (hitung total), daftar `/documents`, antrean approval, pencarian global, dan laporan audit — lihat §11 risiko R4.

---

## 9. Komponen Frontend (Baru & Diubah)

| File | Status | Perubahan |
|---|---|---|
| `src/app/(app)/templates/page.tsx` | **Baru** | Halaman daftar template |
| `src/app/(app)/layout.tsx` / `src/components/layout/Sidebar.tsx` | Diubah | Tambah menu "Template" |
| `src/app/(app)/documents/page.tsx` | Diubah | Dropdown "Dokumen Baru" + dialog pilih template |
| `src/app/(app)/documents/[id]/page.tsx` | Diubah | Tombol Jadikan/Hapus Template, Buat dari Template Ini |
| `src/components/template/TemplatePicker.tsx` | **Baru** | Dialog pilih template (untuk dropdown "Dokumen Baru" & menu Template) |
| `src/components/template/TemplateForm.tsx` | **Baru** | Form isian kode/judul/bidang sebelum dokumen dibuat |
| `src/lib/templateCopy.ts` | **Baru** | Logika copy sections, file media, referensi |
| `src/lib/rbac.ts` | Diubah | Permission `template:set` (hanya role dengan `document:create`) |
| `src/lib/db.ts` | Tidak diubah | Tetap pakai pool + `withTransaction` yang ada |

---

## 10. Urutan Implementasi

1. **Migrasi `004_migration_template.sql`** (kolom + index + FK) dan **UPDATE massal 143 blanko**. Verifikasi: `SELECT jenis, COUNT(*) … WHERE is_template=1`.
2. **Seed 5 template bawaan** via `scripts/seed_templates.mjs`. Verifikasi: muncul di query template, sections terisi.
3. **Backend**: `src/lib/templateCopy.ts` (copy atomik + rewrite URL media) + 3 endpoint baru + pengecualian `isTemplate` di `GET /api/documents`.
4. **Frontend**: menu Template → form isian → dropdown Dokumen Baru → tombol di detail dokumen.
5. **Verifikasi**: `npx tsc --noEmit`, `npm run lint` (baseline **162**, nol masalah baru), smoke test alur copy, cek visual.
6. **Deploy**: `npm run build` → `node scripts/prepare_deploy.mjs` → `node scripts/sync_to_qnap.mjs` → **restart container `edms-ups-app` di Container Station**.

---

## 11. Risiko & Mitigasi

| # | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| R1 | **143 blanko keluar dari daftar Dokumen** (konsekuensi Cabang #5) | Pengguna kebingungan mencari formulir di dua menu | Badge "Template" jelas, pencarian tetap menyentuh kedua sumber; keputusan ini **paling layak dibalik** bila ternyata mengganggu |
| R2 | Template berstatus `Obsolete` masih bisa menghasilkan dokumen baru (Cabang #7) | Dokumen baru acuan dari dokumen yang sudah tidak berlaku | Badge status tampil di kartu template & dialog konfirmasi bila status ≠ `Aktif`; dokumen hasil tetap melewati approval penuh |
| R3 | Konflik `kode` UNIQUE saat buat dari template | Insert gagal | Validasi kode sebelum transaksi + pesan error yang jelas pada form |
| R4 | Pengecualian `is_template` di `GET /api/documents` melewatkan pembacaan lain | Dashboard/antrean approval/laporan menampilkan atau menghitung template | Audit menyeluruh seluruh query `documents` sebelum rilis |
| R5 | Copy file media gagal (sumber hilang / disk penuh) | Gambar broken di dokumen hasil | Transaksi DB digulungkan bila copy file gagal; laporkan error per file |
| R6 | Perubahan template tidak mengulang ke dokumen hasil | Ekspektasi pengguna | **Sengaja** — snapshot, bukan referensi hidup (asumsi §12.3) |

---

## 12. Asumsi Terbuka (Belum Dikonfirmasi Pengguna)

1. **Approvals, riwayat, ack, dan versi tidak ikut** — dokumen hasil lahir `Draft` / `1.0` (Cabang #4, dinyatakan sebagai asumsi).
2. **Menu Template hanya terlihat** oleh Penyusun Dokumen dan Admin Sistem (konsekuensi Cabang #6).
3. **Template bersifat snapshot** — mengedit template tidak mengubah dokumen hasil yang sudah pernah dibuat.
4. **Format kode seed** template bawaan memakai prefiks `TPL.` (contoh: `TPL.IK.STD-01`).
5. **Label UI berbahasa Indonesia** mengikuti konvensi aplikasi yang ada.
6. Tombol "Hapus dari Tanda Template" hanya membatalkan flag — **tidak menghapus** dokumen.

---

## 13. Kriteria Penerimaan

- [ ] 143 blanko (`Formulir Kerja` + `Formulir Tambahan`) berlabel template dan **tidak** tampil di `/documents`.
- [ ] Menu Template menampilkan 143 blanko + 5 template bawaan.
- [ ] Membuat dokumen dari template menghasilkan dokumen `Draft` dengan sections, urutan, kop, referensi, berkas sumber, dan **seluruh gambar tampil benar** (bukan link rusak).
- [ ] Dokumen hasil berjalan normal di siklus: submit → review → approval → Aktif.
- [ ] Dokumen hasil tidak muncul kembali sebagai template.
- [ ] `npx tsc --noEmit` tanpa error; `npm run lint` **162** (tanpa masalah baru).
- [ ] Build standalone sukses dan tersinkron ke QNAP; container di-restart.

---

## 14. Catatan Eksekusi (Ditambahkan Setelah Implementasi)

Status item **Kriteria Penerimaan** (§13) — kotak centang di atas sengaja dibiarkan apa adanya; status dicatat di sini:

| Kriteria | Status | Bukti |
|---|---|---|
| 143 blanko berlabel & tidak tampil di `/documents` | **Tercapai** | Migrasi `004_migration_template.sql` dieksekusi: `Rows matched: 143 Changed: 143` (`updated_at` tidak bergeser); register default `total=30` (178 − 148 template) |
| Menu Template = 143 blanko + 5 bawaan | **Tercapai** | `isTemplate=1` → `total=148`; seed `scripts/seed_templates.mjs` menghasilkan id 193–197 (idempoten by kode) |
| Salinan = `Draft`, sections/urutan/kop/referensi/berkas/gambar benar | **Tercapai** | Uji E2E 31/31 (script `_tmp_e2e_template.mjs`, dijalankan via dev server `:3000`): 32/32 sections tersalin, `kop_path`/`source_path` ter-rewrite, folder media ikut tersalin, referensi inline `/uploads/media/{idLama}/` → `{idBaru}/` (template 155) |
| Dokumen hasil berjalan normal di siklus | **Tercapai (uji regresional)** | Smoke approval cycle (sesi perbaikan sebelumnya) lulus; dokumen hasil lahir `Draft`/`1.0` dan mengikuti submit → review → approval yang sama |
| Dokumen hasil tidak ikut pustaka template | **Tercapai** | Setelah `from-template` register kembali `total=30`; detail `isTemplate=false`, `template_source_id` tertanam |
| `tsc` tanpa error; lint tanpa masalah baru | **Tercapai** | `npx tsc --noEmit` → `TSC_OK`; `npx eslint .` → **155** (baseline sesi ini 158 — ≤ syarat rencana 162) |
| Build standalone + sinkron QNAP + restart container | **Belum dijalankan** | Di luar sesi ini; jalankan `npm run build` lalu ikuti `QNAP_DEPLOYMENT_GUIDE.md` |

### Deviasi / Keputusan Terbaik Terhadap Rencana

1. **Tanpa auto-unset `is_template` pada submit/revise** (opsi A, sesuai Cabang #7 "status bukan syarat"): sebagai gantinya **antrean approval, badge sidebar, editor, PDF, dan peta** memanggil `GET /api/documents?includeTemplates=1` sehingga template yang sedang dalam siklus approval tidak pernah tersembunyi. Terbukti: antrean `Menunggu Approval` default=0, dengan `includeTemplates=1` → 3 (3 template blanko memang sedang pending).
2. **Register `/documents`**: selain toggle "Tampilkan template", parameter ikut menyala otomatis saat pencarian `q` diisi agar template tidak "lenyap" diam-diam dari hasil pencarian.
3. **Statistik dashboard**: `total`/`aktif`/`draft` mengecualikan template (`SUM(is_template=0 AND ...)`), `pending` tanpa syarat is_template (konsisten dengan isi antrean yang memakai `includeTemplates=1`).
4. **Badge "Template"** memakai inline style violet (`#EDE9FE/#6D28D9`) karena kelas `badge-purple` tidak tersedia di CSS baseline.
5. **Jenis dokumen di TemplateForm bersifat read-only** — sections terikat jenis; kop template diedit melalui editor setelah dokumen dibuat.
6. **Seed hanya 5 template** (Manual Mutu, SOP, IK, Pernyataan, Berkas/Dokumen Rekaman) — celah "Formulir Kerja/Formulir Tambahan" sengaja dibiarkan kosong karena 143 blanko sudah menjadi pustaka.
7. **RBAC live untuk role non-create** tidak diuji end-to-end (hanya akun `admin` yang diketahui sandinya di DB uji); jalur `hasPermission('document:create')` untuk `isTemplate=1` (403) diverifikasi dari kode — jalur 401 tanpa sesi diuji E2E.
