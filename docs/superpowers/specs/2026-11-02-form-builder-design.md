# Desain Fitur Form Builder — EDMS v2

Tanggal: 2026-11-02 · Branch kerja: `fitur/dev-lokal` · Lokasi kode: `edms-v2/`

## 1. Tujuan

Pengurus (Super user / Editor) membuat form seperti Google Forms/Zoho Forms di dalam EDMS v2, mempublish lalu membagikan link. Pengisi mengisi lewat link; jawaban tersimpan di database dan dapat dilihat, dicetak, dan didownload.

Kriteria sukses:
1. Empat form asli dari `edms-v2/form-contoh/` tersedia di aplikasi dengan bentuk dan isi sesuai file (satu file = satu form).
2. Form baru dapat dibuat manual di builder atau diimpor dari Word (.docx) lalu dirapikan.
3. Link form bekerja di jaringan kantor (NAS, LAN saja), dengan mode wajib login atau tanpa login per form.
4. Jawaban dapat dilihat (termasuk gambar tanda tangan), didownload Excel (.xlsx) dan CSV, dan satu jawaban dapat dicetak/disimpan PDF.

## 2. Keputusan yang sudah disetujui

| Topik | Keputusan |
|---|---|
| Pengisi | Lewat link `/f/<token>`; per form dipilih **wajib login** atau **tanpa login** |
| Pengelola | Super user: semua form. Editor: hanya form bidangnya (`departmentsMatch`, sama seperti dokumen). Form tanpa bidang hanya dikelola Super user. Viewer: hanya mengisi |
| Setelah kirim | Boleh kirim berkali-kali, tidak bisa edit. Jawaban salah ditandai/dihapus pengurus |
| Tanda tangan | Digambar di canvas (seperti Zoho) + nama; gambar terlihat di detail jawaban dan hasil cetak |
| Download | Excel (.xlsx) dan CSV; kolom tanda tangan berisi "Ditandatangani" + ID jawaban |
| Cetak | Tombol "Cetak / Simpan PDF" per jawaban via print browser |
| Form asli | 4 form disiapkan sebagai draf lewat script seed, **belum diberi bidang** (cukup tampil di menu Form); pengurus memeriksa lalu publish. Bidang diisi nanti di builder |
| Impor Word | Hasil impor menjadi draf di builder untuk dirapikan, tidak langsung tersimpan |
| Penyimpanan | Definisi dan jawaban sebagai JSON (Pendekatan 1) |

## 3. Batasan proyek yang berlaku

- Tanpa dependency baru. `.docx` dibaca dan `.xlsx` ditulis memakai `jszip` yang sudah terpasang; tanda tangan memakai `<canvas>` bawaan browser.
- RBAC di server, cek origin/CSRF untuk non-GET, `rate()` untuk endpoint publik, `withTransaction` untuk mutasi lintas tabel, audit ke `v2_audit`.
- Database snake_case, API camelCase dengan mapping eksplisit. Tabel berawalan `v2_`, migrasi berversi.
- UI: token PLN (DESIGN.md), CSS Modules, ikon SVG stroke 1.75/currentColor, keyboard/focus accessible, state loading/kosong/error. Skill UI terpasang dibaca dan diterapkan saat implementasi.
- Data uji (jawaban percobaan, file Word untuk tes impor) hanya DUMMY sintetis. Empat form asli dipakai sebagai definisi form, bukan sebagai data uji.
- Tidak ada deploy ke NAS dalam pekerjaan ini. Perubahan hanya di laptop dan DB lokal `edms_home`.

## 4. Model data definisi form

Satu form = objek JSON:

```json
{
  "schema": 1,
  "header": { "code": "FR.UPS.2026.BST.01.01-00", "subtitle": "…", "footer": "Bagian dari IK.UPS.2026.BST.01-00" },
  "fields": [ { "id": "f_x1", "type": "text", "label": "Skema/Okupasi", "required": true } ]
}
```

`id` setiap field unik dalam form, stabil saat field diubah, dan menjadi kunci jawaban. Jenis field:

| type | Properti | Nilai jawaban | Contoh di form asli |
|---|---|---|---|
| `heading` | `label`, `description?` | – | "A. Persiapan", "F. Log Izin Keluar" |
| `static` | `text` (baris diawali `- ` dirender sebagai bullet) | – | Kode etik, catatan, pernyataan |
| `text` | `label`, `required`, `placeholder?` | string ≤ 500 | Skema, TUK, Nomor BA |
| `textarea` | sama | string ≤ 10.000 | Kronologi, Barang Bukti |
| `date` | `label`, `required` | `YYYY-MM-DD` | Hari/Tanggal |
| `time` | `label`, `required`, `range?` | `HH:MM` atau `{from,to}` | Waktu Kejadian |
| `radio` | `label`, `required`, `options[]`, `other?` | `{value, other?}` | Akreditor, Mode Uji, Tingkat |
| `checkbox` | `label`, `required`, `options[]`, `other?` | `{values[], other?}` | Metode Uji, Jenis Kejadian, Role |
| `grid` | `label`, `fixedColumns[]`, `groups[{title?, rows[{id, cells[], blank?}]}]`, `choice{label, options[]}`, `remark?` (label kolom keterangan) | `{[rowId]: {choice, remark?, blank?}}` | Ceklis A–E (Ya/Tidak/N/A + Keterangan), Matriks 27 baris, Deklarasi E |
| `table` | `label`, `columns[{id, label, type: text\|date\|time\|radio, options?}]`, `minRows`, `maxRows` | `[{[colId]: value}]` | Log Izin Keluar, Deklarasi F, Lampiran 6.3 |
| `signature` | `label`, `required` | `{name, image, signedAt}` | Pengawas, Asesor, Saksi, Yang Menyatakan |

Catatan:
- `grid` menyatukan ceklis dan matriks. Ceklis memakai `fixedColumns:["Item"]`. Matriks potensi kecurangan memakai `fixedColumns:["Mode","Potensi Kecurangan","Penyebab","Pengendalian","Langkah IK"]` dengan `choice.label:"Penerapan Pengendalian"`. Kolom tetap hanya-baca.
- `blank: true` pada baris grid menampilkan isian kecil di dalam item (contoh "jumlah paket: ……").
- `required` pada `grid` berarti setiap baris wajib dipilih.
- `signature.image` berupa data URL `image/png`, ≤ 200 KB.

## 5. Skema database — `sql/009_forms.sql`

```sql
CREATE TABLE IF NOT EXISTS v2_forms (
 id CHAR(36) PRIMARY KEY, title VARCHAR(255) NOT NULL, department VARCHAR(160) NULL,   -- NULL = belum ada bidang, hanya Super user
 status VARCHAR(20) NOT NULL DEFAULT 'draft',          -- draft | published | closed
 access VARCHAR(20) NOT NULL DEFAULT 'login',          -- login | public
 public_token CHAR(32) NOT NULL UNIQUE, definition_json LONGTEXT NOT NULL,
 published_version INT NULL, lock_version INT NOT NULL DEFAULT 1,
 created_by INT UNSIGNED NOT NULL, updated_by INT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY(created_by) REFERENCES users(id), FOREIGN KEY(updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS v2_form_versions (
 form_id CHAR(36) NOT NULL, version INT NOT NULL, definition_json LONGTEXT NOT NULL, title VARCHAR(255) NOT NULL,
 published_by INT UNSIGNED NOT NULL, published_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(form_id,version), FOREIGN KEY(form_id) REFERENCES v2_forms(id) ON DELETE CASCADE,
 FOREIGN KEY(published_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS v2_form_submissions (
 id CHAR(36) PRIMARY KEY, form_id CHAR(36) NOT NULL, form_version INT NOT NULL, answers_json LONGTEXT NOT NULL,
 submitter_id INT UNSIGNED NULL, submitter_label VARCHAR(160) NOT NULL, ip VARCHAR(80) NULL,
 flagged TINYINT(1) NOT NULL DEFAULT 0, flag_note VARCHAR(500) NULL,
 deleted_at DATETIME(3) NULL, deleted_by INT UNSIGNED NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX idx_v2_form_sub(form_id,deleted_at,created_at),
 FOREIGN KEY(form_id,form_version) REFERENCES v2_form_versions(form_id,version),
 FOREIGN KEY(submitter_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Daftarkan `['009','009_forms.sql']` di `scripts/migrate.mjs`. `dev:home` otomatis menjalankannya.

Aturan:
- `definition_json` di `v2_forms` adalah draf kerja. Publish menyalin draf ke `v2_form_versions` dengan versi berikutnya dan mengisi `published_version`, dalam satu transaksi.
- Halaman isi selalu memakai versi publish terakhir. Jawaban menyimpan `form_version`, sehingga jawaban lama dirender dan diekspor dengan definisi versinya sendiri.
- Hapus jawaban bersifat soft delete (`deleted_at`) dan tetap tercatat di audit.
- Form hanya dapat dihapus jika belum punya jawaban. Jika sudah punya jawaban, form ditutup (`closed`). Membuka kembali = publish lagi.
- `submitter_label` diisi nama akun untuk form wajib login, atau "Anonim (link publik)" untuk form tanpa login.

## 6. API — modul `src/lib/forms-api.mjs`

Dipasang di `handle()` (`src/lib/api.mjs`) dengan pola `management()`. Endpoint publik ditangani **sebelum** `actor(req)`.

Endpoint terautentikasi. Semua memeriksa `canManage(user, form)`: Super user selalu boleh; Editor hanya bila `form.department` terisi dan cocok dengan bidangnya (`departmentsMatch`):

| Method | Path `/api/v2/…` | Fungsi |
|---|---|---|
| GET | `forms` | Daftar form sesuai cakupan, berisi jumlah jawaban dan `hasUnpublishedChanges` |
| POST | `forms` | Buat draf `{title, department?, definition?}`. Bidang Editor dipaksa ke bidangnya; Super user boleh mengosongkan |
| POST | `forms/import` | Upload .docx (≤ 5 MB) → `{title, definition}` untuk builder. Tidak menyimpan apa pun |
| GET | `forms/:id` | Detail + draf |
| PUT | `forms/:id` | Simpan draf `{title, department, access, definition, expectedVersion}`. Konflik `lock_version` → 409 |
| POST | `forms/:id/publish` · `forms/:id/close` | Ubah status |
| DELETE | `forms/:id` | Hanya jika tanpa jawaban |
| GET | `forms/:id/submissions?page=` | 30 per halaman, terbaru dulu, tanpa yang terhapus |
| GET | `forms/:id/export?format=xlsx\|csv` | File unduhan |
| GET · PATCH · DELETE | `form-submissions/:sid` | Detail (beserta definisi versinya) · `{flagged, flagNote}` · soft delete |

Endpoint publik:

| Method | Path | Fungsi |
|---|---|---|
| GET | `public-forms/:token` | `{title, definition, version}` jika status `published`. Jika `access='login'` dan belum login → 401 `{loginRequired:true}`. Draf/tutup/tidak ada → 404 "Form tidak tersedia" |
| POST | `public-forms/:token` | Kirim `{answers}`. Divalidasi terhadap versi publish terakhir. `rate(req,'form-submit',30)`. Body ≤ 3 MB |

Validasi jawaban (server, fungsi murni `validateAnswers(definition, answers)` di `src/lib/forms.mjs`):
- Field wajib harus terisi.
- Opsi radio/checkbox/grid harus termasuk opsi yang didefinisikan. "Lainnya" hanya boleh jika `other`.
- Batas panjang teks. Format tanggal dan jam.
- Jumlah baris tabel di antara `minRows` dan `maxRows`.
- Tanda tangan harus PNG valid (prefix data URL + magic bytes PNG) ≤ 200 KB, dan `name` wajib.
- Kunci jawaban yang tidak dikenal dibuang.
- Pelanggaran → 400 dengan `{error, fields:{[id]: pesan}}` agar UI dapat menandai field.

Validasi definisi (`validateDefinition`) saat simpan/publish:
- jenis field dikenal dan `id` unik;
- `radio`/`checkbox` punya ≥ 1 opsi;
- `grid` punya ≥ 1 baris dan ≥ 1 opsi;
- `table` punya ≥ 1 kolom;
- definisi ≤ 1 MB.

Audit (`v2_audit`, `document_id` NULL, `context_json` berisi `formId` dan bila relevan `submissionId`):
- Aksi: `FORM_CREATE`, `FORM_UPDATE`, `FORM_PUBLISH`, `FORM_CLOSE`, `FORM_DELETE`, `FORM_SUBMIT`, `FORM_SUBMISSION_FLAG`, `FORM_SUBMISSION_DELETE`, `FORM_EXPORT`.
- Kiriman anonim memanggil `audit()` dengan pelaku `{id:null, fullName:'Anonim (link publik)'}`. Kolom `actor_id` memang nullable.

## 7. Halaman dan komponen

| File | Isi |
|---|---|
| `src/app/page.tsx` | Menu sidebar "Form" (Super user/Editor) dengan view `forms`, `form-builder`, `form-responses` |
| `src/components/FormList.tsx` | Daftar form: status, bidang, jumlah jawaban, Salin link, Buat form, Impor Word |
| `src/components/FormBuilder.tsx` | Editor field: tambah per jenis, ubah properti, naik/turun, hapus; editor baris grid/kolom tabel; pengaturan akses; Pratinjau (memakai `FormFill`); Simpan, Publish, Tutup |
| `src/components/FormFill.tsx` | Render definisi menjadi isian (dipakai di halaman publik, pratinjau, detail jawaban read-only, dan halaman cetak) |
| `src/components/SignaturePad.tsx` | Canvas pointer events + tombol Ulangi, keluaran PNG |
| `src/components/FormResponses.tsx` | Tabel jawaban, detail, tandai/hapus, Download .xlsx/.csv, tombol Cetak |
| `src/components/Forms.module.css` | Gaya bersama |
| `src/app/f/[token]/page.tsx` | Halaman isi publik: logo Danantara & PLN, kode form, `FormFill`. Login inline bila `loginRequired`. Pesan sukses + "Isi lagi" |
| `src/app/forms/print/[id]/page.tsx` | Halaman cetak satu jawaban (perlu login + hak kelola): kop, kode form, isi read-only, gambar tanda tangan, waktu kirim. CSS `@media print`, tombol `window.print()` |

Params route dinamis di Next 16 mengikuti dokumentasi `node_modules/next/dist/docs/`. Dokumentasi tersebut dibaca sebelum menulis route.

Tampilan isi meniru urutan dokumen asli: heading bagian, grid berbentuk tabel dengan pilihan per baris (di layar sempit berubah menjadi kartu per baris), tabel berulang dengan tombol "Tambah baris", dan blok tanda tangan berdampingan di desktop.

## 8. Impor Word — `src/lib/form-import.mjs`

`importDocx(buffer) → {title, definition}`. Membaca `word/document.xml` lewat `jszip`. Proteksi:
- ukuran file ≤ 5 MB;
- `document.xml` ≤ 10 MB setelah dekompresi;
- file selain zip/docx valid → 400 "Bukan file Word (.docx) yang valid".

Heuristik berurutan:
1. Paragraf pertama yang tebal/besar menjadi `title`. Pola `FR.xxx` / `Lampiran …` menjadi `header.code`.
2. Paragraf berawalan huruf + titik (`A. `, `B. `) atau heading style menjadi `heading`.
3. Paragraf/sel berisi `☐`/`□` lebih dari satu kali menjadi `checkbox` (atau `radio` bila hanya satu yang boleh, defaultnya `checkbox`). Label diambil dari teks sebelum kotak pertama. Opsi "Lainnya" menjadi `other:true`.
4. Paragraf `Label : ……` atau `Label: ___` menjadi `text`. Label yang memuat "tanggal" menjadi `date`, "jam/waktu" menjadi `time`.
5. Tabel:
   - Header memuat Ya/Tidak (/N/A/NA) → `grid`. Kolom teks lain menjadi `fixedColumns`, kolom "Keterangan/Ket." menjadi `remark`.
   - Baris data kosong semua → `table` (kolom dari header, `maxRows` = max(jumlah baris × 2, 10)).
   - Baris dengan sel "Nama/Tanda tangan/Paraf" → `signature` per kolom.
   - Selain itu → `static` berisi teks tabel.
6. Paragraf lain menjadi `static`.

Hasil impor ditampilkan di builder dengan banner "Hasil impor otomatis — periksa dan rapikan sebelum publish". Impor tidak akan selalu sempurna. Builder adalah alat perbaikannya.

## 9. Ekspor — `src/lib/form-export.mjs`

`flatten(definition, submission)` menghasilkan baris kolom:
- Kolom tetap: `Waktu Kirim`, `ID Jawaban`, `Pengisi`, `Versi Form`, `Ditandai`.
- `text`/`textarea`/`date`: satu kolom.
- `time` range: `08:00–09:30`.
- `radio`/`checkbox`: satu kolom. Nilai checkbox digabung `; `, "Lainnya: …" disertakan.
- `grid`: per baris dua kolom, `"<grup> <no>. <item> — <choice.label>"` dan `"… — Keterangan"` bila `remark`. Isian `blank` digabung ke kolom keterangan.
- `table`: satu sel, satu baris per entri, kolom dipisah ` | `.
- `signature`: kolom `"<label> — Nama"` dan `"<label> — Tanda tangan"` berisi "Ditandatangani" / kosong.
- `heading`/`static`: tidak diekspor.

Bila jawaban berasal dari beberapa versi, kolom adalah gabungan field dari semua versi tersebut, berurutan sesuai versi terbaru.

Format file:
- **CSV:** UTF-8 dengan BOM, RFC 4180 (kutip ganda, newline di dalam sel dikutip).
- **XLSX:** dibuat dengan `jszip` (inline string, satu sheet, header tebal, kolom lebar wajar, wrap text).
- Nama file: `<judul>-jawaban-<YYYYMMDD>.xlsx`.
- Sel yang diawali `=`, `+`, `-`, `@` diberi awalan `'` untuk mencegah formula injection.

## 10. Seed 4 form asli — `scripts/seed-forms.mjs`

- Membaca definisi dari `scripts/form-templates/*.json`, satu file per form. JSON disusun tangan dari isi `form-contoh/` sehingga tetap tersedia setelah folder itu dihapus.
- Membuat draf dengan `department` NULL (belum ada bidang; ditampilkan "Belum ada bidang" di daftar Form dan diisi nanti di builder), `created_by` = Super user aktif pertama.
- Idempoten: form dengan judul yang sama tidak dibuat ulang.
- Dijalankan manual: `node --env-file=.env.home scripts/seed-forms.mjs`. Tidak otomatis di startup.

| File template | Judul | Isi utama |
|---|---|---|
| `ceklis-pengawasan.json` | Form Ceklis Pengawasan Pelaksanaan Uji Kompetensi | Header (Skema, Akreditor, Hari/Tanggal, TUK, Metode Uji, Mode Uji, Nama Pengawas); grid A–E (29 item, Ya/Tidak/N/A + Keterangan); tabel F Log Izin Keluar; tempat/tanggal; tanda tangan Pengawas & Asesor/Ketua Tim Uji |
| `berita-acara-kecurangan.json` | Form Berita Acara Kejadian/Dugaan Kecurangan | Identitas kejadian & terlapor; Jenis Kejadian (9 opsi + Lainnya); Kronologi, Barang Bukti, Tindakan Pengawas; Rekomendasi (Tingkat, Sanksi Peserta, Sanksi Personil); catatan; 4 tanda tangan |
| `matriks-potensi-kecurangan.json` | Form Matriks Potensi Kecurangan dan Pengendaliannya | Header (Skema, Hari/Tanggal, Mode Uji, Nama Pengawas); grid 27 baris dengan 5 kolom tetap + Penerapan (Ya/Tidak/NA); keterangan; tanda tangan Pengawas, Asesor, MAN PSA |
| `kode-etik-deklarasi.json` | Form Kode Etik dan Deklarasi Tanpa Konflik Kepentingan | Identitas + teks kode etik; Formulir Deklarasi A–H (role 12 opsi, grid E 10 baris, tabel F, pernyataan, tanda tangan, verifikasi); Lampiran 6.3 (header + tabel calon kandidat 9 kolom, hingga 50 baris) |

Kode formulir, nomor revisi, dan teks pernyataan disalin persis dari file asli.

## 11. Penanganan error

- UI menampilkan pesan dari `{error}` API. Field yang gagal validasi ditandai dan halaman menggulir ke field pertama.
- Kiriman gagal karena jaringan tidak menghapus isian. Jawaban yang sedang diisi disimpan di `sessionStorage` per token, dibungkus try/catch, dan dihapus setelah kiriman berhasil.
- Simpan draf bentrok (409): pesan "Form diubah pengguna lain, muat ulang" tanpa menimpa.
- Halaman publik untuk form draf/tutup/token salah: "Form tidak tersedia".
- Rate limit (429): pesan dari `rate()`.

## 12. Pengujian

Otomatis: `tests/forms.test.mjs` (`node --test`), hanya data DUMMY.
- `validateAnswers`: setiap jenis field, kasus valid dan tidak valid (wajib, opsi asing, Lainnya, panjang, tanggal/jam, baris tabel, PNG palsu/terlalu besar, kunci asing dibuang).
- `validateDefinition`: id ganda, jenis asing, opsi kosong.
- `importDocx`: docx DUMMY yang dibuat di dalam tes memakai `jszip` (judul, heading, checkbox ☐, `Label : ……`, tabel Ya/Tidak, tabel kosong, file bukan docx).
- `flatten` + CSV: grid, tabel, tanda tangan, gabungan versi, escape kutip/newline, pencegahan formula.
- Ke-4 template seed lolos `validateDefinition`.

Manual di `dev:home` (http://localhost:3100) dengan jawaban berlabel DUMMY:
1. Seed 4 form, buka masing-masing di builder, dan bandingkan dengan file asli.
2. Publish mode tanpa login, isi dari jendela incognito, lalu cek jawaban dan tanda tangan tampil.
3. Ubah ke wajib login: tanpa login muncul login inline. Login sebagai Viewer bisa mengisi tetapi tidak melihat menu Form.
4. Editor bidang lain tidak bisa melihat atau mengelola form (API 403).
5. Download .xlsx (buka di Excel) dan .csv. Cetak satu jawaban ke PDF.
6. Edit form, publish ulang, lalu pastikan jawaban lama tetap tampil sesuai versinya.
7. Impor docx DUMMY, rapikan, lalu publish.

## 13. Di luar lingkup

- Deploy ke NAS dan penyesuaian script update NAS (`scripts/nas-*`). Migrasi 009 ikut paket update berikutnya bila diminta.
- Edit jawaban oleh pengisi, batas satu jawaban per akun, notifikasi email, logika kondisional antar field, unggah lampiran file dalam form. Semua bisa ditambah kemudian.
- Ekspor PDF di server dan ekspor Word sesuai tata letak asli.
- Gambar tanda tangan di dalam file Excel.
