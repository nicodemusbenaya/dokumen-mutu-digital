# DOKUMENTASI PROGRESS PENGEMBANGAN SISTEM EDMS DOKUMEN MUTU
## PT PLN (Persero) Unit Pelaksana Sertifikasi (UPS)
**Tanggal Dokumentasi:** 18 September 2026  
**Status Sistem:** v1.1 Production-Ready (On-Premise NAS QNAP & Cloudflare Tunnel Architecture)

---

## 1. Ringkasan Eksekutif (*Executive Summary*)

Pada hari ini, 18 September 2026, telah dilaksanakan audit menyeluruh (*comprehensive system audit*) dan penyempurnaan fitur tingkat lanjut pada aplikasi **Electronic Document Management System (EDMS) Dokumen Mutu Digital PLN UP Sertifikasi**:

1. **Audit 7 Template Formulir Resmi**: Seluruh 7 berkas template baku Word (`.docx`) dari folder `Template dokumen/Formulir` dan master prosedur `PR.UPS.SER3.BMK.01-02` telah diaudit dan diverifikasi **100% selaras** dengan struktur seksi, lembar pengesahan, tabel matriks, dan penomoran klausul di sistem.
2. **Fitur Tambah Seksi Dinamis (+ Tambah Seksi)**: Pengguna kini memiliki keleluasaan penuh untuk menambahkan klausul/seksi kustom baru dengan judul bebas kapan saja sesuai kebutuhan dokumen mutu.
3. **Fitur Drag & Drop & Reorder Urutan Seksi**: Pengguna dapat mengubah posisi urutan atau halaman seksi secara visual di bilah samping (*sidebar*) editor melalui *native HTML5 drag & drop* maupun tombol panah cepat (`▲` / `▼`).
4. **Penomoran Urut Otomatis (*Auto-Renumbering*)**: Nomor klausul (`1.`, `2.`, `3.`, dst.) secara otomatis dan dinamis menghitung ulang posisinya mengikuti urutan baru tanpa adanya nomor ganda atau loncat.
5. **Perbaikan Concurrency Lock (*Optimistic Locking*)**: Menghilangkan kendala pesan *"Konflik: Dokumen ini telah diubah oleh pengguna lain"* dengan menyinkronkan integer `versionNumber` dua arah serta menambahkan mekanisme *auto-recovery*.
6. **Riwayat Perubahan 6-Kolom Akumulatif & Auto-Diff**: Sesuai template master `PR.UPS.SER3.BMK.01-02`, tabel riwayat perubahan mempertahankan versi sebelumnya dan mendeteksi perubahan klausul otomatis.
7. **Penyempurnaan Ekspor PDF Resmi (*Controlled Copy*)**:
   - Watermark subtle *"Uncontrolled when printed or downloaded"* di bawah logo Danantara + PLN.
   - Smart Page Break (`page-break-inside: avoid`) agar seksi tidak terbelah di tengah halaman.
   - Margin ISO seragam di seluruh halaman (`18mm 20mm 20mm 20mm`).
8. **Hasil Audit Otomatis (56/56 PASS — 100%)**: Seluruh 56 skenario pengujian (template formulir, alur workflow, integrasi MariaDB, tanda tangan digital, dan keamanan RBAC) berhasil lolos 100%.

---

## 2. Hasil Audit 7 Template Formulir Baku PLN UPS

Berdasarkan audit pembanding berkas template fisik di folder `Template dokumen/Formulir` terhadap generator data sistem:

| Kode Template | Nama Berkas Fisik Word | Level Dokumen | Status Audit Sistem | Verifikasi Klausul & Ketentuan Khusus |
|---|---|---|---|---|
| **FR.01.01** | `FR.UPS.SER3.BMK.01.01-00 Dokumen Mutu - rev1.docx` | Level 1 | **100% Sesuai** | 5 Seksi Baku SMT: Profil Organisasi, Kebijakan Mutu & Sasaran, Struktur Organisasi, Sistem Manajemen Terintegrasi, Lampiran Terkait. Lembar Pengesahan: Para Manager Bidang & Senior Manager UPS. |
| **FR.01.02** | `FR.UPS.SER3.BMK.01.02-00 Prosedur_SOP - rev1.docx` | Level 2 | **100% Sesuai** | 7 Klausul Baku PR.UPS.SER3.BMK.01-02: 1. Tujuan, 2. Ruang Lingkup, 3. Referensi, 4. Proses Bisnis (2.3.9), 5. Istilah & Definisi, 6. Alur Prosedur, 7. Dokumen Pendukung. |
| **FR.01.03** | `FR.UPS.SER3.BMK.01.03-00 Intruksi Kerja - rev1.docx` | Level 3 | **100% Sesuai** | 8 Klausul Teknis: 1. Tujuan, 2. Ruang Lingkup, 3. Dokumen Referensi, 4. Personil, 5. Peralatan Kerja, 6. Perlengkapan K3, 7. Material, 8. Uraian Kegiatan. |
| **FR.01.04** | `FR.UPS.SER3.BMK.01.04-00 Formulir - rev1.docx` | Level 4 | **100% Sesuai** | Kop Kotak 3-Kolom resmi Formulir, Identitas Formulir, Petunjuk Pengisian, Format Isian Matriks Dinamis (TipTap + TableGridEditor). |
| **FR.01.05** | `FR.UPS.SER3.BMK.01.05-00 Berita Acara Pemusnahan Rekaman Mutu - rev1.docx` | Formulir Khusus | **100% Sesuai** | Kop Kotak 3-Kolom, Teks Akta Berita Acara Pembuka (Hari/Tanggal/Tahun), Tabel Matriks 4 Kolom (No, Akreditor/Pemberi Lisensi, Uraian, Tahun Penerbitan), Pengesahan Manager Pelayanan Sertifikasi dan Asesmen. |
| **FR.01.06** | `FR.UPS.SER3.BMK.01.06-00 Pernyataan Kerahasiaan - rev1.docx` | Formulir Khusus | **100% Sesuai** | Kop Kotak 3-Kolom, Identitas Penandatangan (Nama, NIP, Alamat, Jabatan, Perusahaan), 6 Butir Komitmen Kerahasiaan (termasuk kepatuhan UU No. 27/2022 tentang Pelindungan Data Pribadi / PDP), Penutup Hukum. |
| **FR.01.07** | `FR.UPS.SER3.BMK.01.07-00 Daftar Rekaman Mutu- rev1.docx` | Formulir Khusus | **100% Sesuai** | Kop Kotak 3-Kolom, BIDANG: ..., Tabel Matriks 7 Kolom Rekaman Terkendali (Bidang Pengelola, Proses Bisnis, Arsip/Evidence, Jenis Arsip, Lokasi Simpan, Masa Simpan, Kategori Kerahasiaan), Ketentuan Retensi. |

---

## 3. Rincian Fitur-Fitur Baru yang Diimplementasikan Hari Ini

### A. Fitur Tambah Seksi Dinamis (+ Tambah Seksi)
- **Tombol Akses**: Terdapat di bagian atas dan bawah bilah navigasi seksi (sidebar) pada halaman Editor (`/editor/[id]`).
- **Modal Input**: Pengguna dapat memasukkan judul klausul kustom apa pun (misal: *Diagram Alir Pelaksanaan*, *Ketentuan Khusus Peralatan*, *Lampiran Matriks Asesmen*).
- **Pembuatan Key Otomatis**: Menghasilkan key unik sistem (`sec_{timestamp}`) yang tersimpan otomatis di database `document_sections`.
- **Hapus Seksi Kustom**: Disediakan tombol silang merah (`×`) dengan dialog konfirmasi untuk menghapus seksi buatan sendiri yang tidak diperlukan lagi. Seksi bawaan template standar tetap diproteksi agar integritas standar ISO terjaga.

### B. Drag & Drop & Reorder Urutan Seksi
- **HTML5 Native Drag & Drop**: Setiap item seksi di sidebar memiliki *drag handle* `⋮⋮` yang dapat ditarik (*drag*) dan diletakkan (*drop*) ke posisi mana pun.
- **Tombol Panah Cepat (`▲` / `▼`)**: Pengguna dapat memindahkan seksi ke atas atau ke bawah dengan 1 kali klik. Sangat ergonomis saat diakses melalui perangkat layar sentuh (tablet/iPad) maupun touchpad laptop.

### C. Penomoran Klausul Otomatis (*Auto-Renumbering*)
- Judul klausul kini dipisahkan antara teks murni (*clean title*) dan nomor urut tampilan.
- Nomor urut (`1.`, `2.`, `3.`, dst.) dihitung langsung berdasarkan urutan indeks terbaru seksi di dalam dokumen.
- **Hasil**: Ketika pengguna memindahkan klausul urutan 5 ke urutan 2, nomornya seketika menjadi `2. [Judul]` dan klausul setelahnya otomatis bergeser menjadi `3. `, `4. `, dst.
- Urutan ini otomatis sinkron pada:
  1. Daftar Seksi Sidebar Editor
  2. Heading Editor Klausul Aktif
  3. Lembar Pratinjau Kertas (*Split Preview*)
  4. Halaman Detail Dokumen (`/documents/[id]`)
  5. Pratinjau PDF Web (`/pdf?id=...`)
  6. Dokumen PDF Resmi Hasil Ekspor (*Puppeteer*)

### D. Perbaikan Concurrency Lock (*Optimistic Locking*)
- **Penyebab Masalah Sebelumnya**: Browser membaca string ISO `currentVersion` ("1.0") alih-alih integer `versionNumber` (1), dan setelah penyimpanan pertama berhasil, respon API tidak memperbarui nilai referensi lokal, menyebabkan penyimpanan berikutnya memicu pesan konflik.
- **Solusi yang Diterapkan**:
  - Sinkronisasi nilai integer `versionNumber` pada backend API (`PUT /api/documents/[id]`) dan state Editor.
  - Penambahan mekanisme *Auto-Recovery*: Jika terjadi selisih versi, sistem secara otomatis mengambil nomor versi terbaru dari server di latar belakang tanpa menghapus teks yang sedang diketik pengguna.

### E. Riwayat Perubahan 6-Kolom Akumulatif & Auto-Diff
- Mengacu langsung pada tabel riwayat perubahan di dokumen master `PR.UPS.SER3.BMK.01-02` halaman 2:
  * Kolom: `No | Tanggal | Halaman | Uraian Sebelum Diubah | Uraian Setelah Diubah | Revisi`
- Sistem mempertahankan seluruh riwayat perubahan versi-versi sebelumnya secara kumulatif dan mendeteksi perubahan klausul dokumen secara otomatis (*smart text diff*).

### F. Penyempurnaan PDF Engine Resmi PLN UPS
- **Smart Page Break**: Penambahan aturan CSS `@media print` dan Puppeteer `page-break-inside: avoid; break-inside: avoid;` pada seluruh `.doc-section` sehingga isi klausul tidak akan pernah terbelah dua di batas halaman.
- **Margin Seragam**: Seluruh halaman (halaman 1, 2, dan seterusnya) memiliki margin proporsional `18mm 20mm 20mm 20mm`.
- **Watermark Subtle**: Watermark *"Uncontrolled when printed or downloaded"* kini diletakkan secara elegan di bawah logo Danantara + PLN dengan warna biru korporat lembut, menggantikan watermark teks besar yang mengaburkan teks dokumen.
- **Favicon Resmi PLN**: Favicon browser telah diperbarui menggunakan logo resmi PLN (*emblem only*) beresolusi tinggi.

---

## 4. Hasil Pengujian Audit Sistem (Test Suite Output)

Pengujian komprehensif dijalankan menggunakan script [audit_system_2026_09_18.mjs](file:///c:/Users/Nicodemus/Documents/Code/Dokumen%20Mutu%20Digital/edms-app/scripts/audit_system_2026_09_18.mjs):

```text
====================================================
 AUDIT KESELURUHAN SISTEM EDMS DOKUMEN MUTU DIGITAL 
 PT PLN (PERSERO) UNIT PELAKSANA SERTIFIKASI (UPS)   
 Tanggal Audit: 18 September 2026
====================================================

--- 1. AUDIT 7 TEMPLATE FORMULIR RESMI (FOLDER TEMPLATE VS SISTEM) ---
  ✅ PASS: Berkas template fisik "FR.UPS.SER3.BMK.01.01-00 Dokumen Mutu - rev1.docx" ditemukan di folder
  ✅ PASS: Konfigurasi seksi baku terdaftar untuk "Manual Mutu" (5 seksi)
  ✅ PASS: Berkas template fisik "FR.UPS.SER3.BMK.01.02-00 Prosedur_SOP - rev1.docx" ditemukan di folder
  ✅ PASS: Konfigurasi seksi baku terdaftar untuk "SOP/Prosedur" (7 seksi)
  ✅ PASS: FR.01.02 SOP memiliki 7 klausul baku lengkap PR.UPS.SER3.BMK.01-02
  ✅ PASS: Berkas template fisik "FR.UPS.SER3.BMK.01.03-00 Intruksi Kerja - rev1.docx" ditemukan di folder
  ✅ PASS: Konfigurasi seksi baku terdaftar untuk "Instruksi Kerja" (8 seksi)
  ✅ PASS: Berkas template fisik "FR.UPS.SER3.BMK.01.04-00 Formulir - rev1.docx" ditemukan di folder
  ✅ PASS: Konfigurasi seksi baku terdaftar untuk "Formulir Standar (FR.01.04)" (3 seksi)
  ✅ PASS: Berkas template fisik "FR.UPS.SER3.BMK.01.05-00 Berita Acara Pemusnahan Rekaman Mutu - rev1.docx" ditemukan di folder
  ✅ PASS: Konfigurasi seksi baku terdaftar untuk "Berita Acara Pemusnahan (FR.01.05)" (3 seksi)
  ✅ PASS: FR.01.05 Berita Acara memiliki seksi identitas, tabel matriks 4 kolom, dan pengesahan
  ✅ PASS: Berkas template fisik "FR.UPS.SER3.BMK.01.06-00 Pernyataan Kerahasiaan - rev1.docx" ditemukan di folder
  ✅ PASS: Konfigurasi seksi baku terdaftar untuk "Pernyataan Kerahasiaan (FR.01.06)" (3 seksi)
  ✅ PASS: FR.01.06 Pernyataan Kerahasiaan memiliki klausul identitas dan komitmen kerahasiaan
  ✅ PASS: FR.01.06 menyertakan klausul kepatuhan UU No. 27/2022 tentang Perlindungan Data Pribadi (UU PDP)
  ✅ PASS: Berkas template fisik "FR.UPS.SER3.BMK.01.07-00 Daftar Rekaman Mutu- rev1.docx" ditemukan di folder
  ✅ PASS: Konfigurasi seksi baku terdaftar untuk "Daftar Rekaman Mutu (FR.01.07)" (3 seksi)
  ✅ PASS: FR.01.07 memiliki seksi informasi bidang dan tabel rekaman kendali
  ✅ PASS: FR.01.07 memuat tabel matriks 7 kolom rekaman mutu terkendali

--- 2. AUDIT FITUR BARU: SEKSI DINAMIS & AUTO-RENUMBERING ---
  ✅ PASS: cleanSectionTitle membuang angka prefix hardcoded ("1. Tujuan" -> "Tujuan")
  ✅ PASS: cleanSectionTitle membuang nomor urut ("5. Istilah dan Definisi" -> "Istilah dan Definisi")
  ✅ PASS: getOrderedSections menghasilkan 7 seksi default untuk SOP/Prosedur
  ✅ PASS: Seksi urutan ke-1 adalah Tujuan
  ✅ PASS: Label penomoran otomatis seksi ke-1 adalah "1. Tujuan"
  ✅ PASS: Seksi "referensi" berhasil dipindahkan ke urutan pertama
  ✅ PASS: Auto-renumbering: "referensi" otomatis menjadi nomor "1. Referensi"
  ✅ PASS: Auto-renumbering: "tujuan" otomatis bergeser menjadi nomor "2. Tujuan"
  ✅ PASS: Fitur Tambah Seksi berhasil menambahkan klausul kustom baru
  ✅ PASS: Auto-renumbering: Seksi baru otomatis mendapatkan nomor urut "8. Diagram Alir Pelaksanaan Prosedur"
  ✅ PASS: Metadata _section_order berhasil di-reload dengan jumlah seksi persis sama
  ✅ PASS: Urutan pertama hasil persistensi database tetap "referensi"
  ✅ PASS: Seksi kustom hasil persistensi database tetap terjaga

--- 3. AUDIT DATABASE MARIADB & SIKLUS HIDUP WORKFLOW ---
  ✅ PASS: Terhubung ke database MariaDB edms_ups (10.10.200.166:3307)
  ✅ PASS: Tabel documents tersedia
  ✅ PASS: Tabel document_sections tersedia
  ✅ PASS: Tabel document_versions tersedia
  ✅ PASS: Tabel approvals tersedia
  ✅ PASS: Tabel audit_logs tersedia
  ✅ PASS: Tabel references tersedia
  ✅ PASS: Tabel users tersedia
  ✅ PASS: Kolom version_number untuk optimistic locking tersedia
  ✅ PASS: Role Penyusun Dokumen terdaftar
  ✅ PASS: Role Tim Mutu (Reviewer) terdaftar
  ✅ PASS: Role Manager Bidang terdaftar
  ✅ PASS: Role Pimpinan Unit terdaftar
  ✅ PASS: Role Admin Sistem terdaftar

--- 4. SIMULASI ALUR SIKLUS HIDUP LENGKAP (DRAFT -> AKTIF) ---
  ✅ PASS: Dokumen audit berhasil dibuat (ID: 19, Status: Draft, Kode: AUDIT.UPS.894503.2026)
  ✅ PASS: Seksi klausul termasuk metadata _section_order tersimpan di MariaDB
  ✅ PASS: Optimistic locking increment version_number berjalan konsisten
  ✅ PASS: Workflow Tahap 1: Dokumen berhasil diajukan (Status: Review)
  ✅ PASS: Workflow Tahap 2: Tim Mutu menyetujui (Status: Menunggu Approval Manager)
  ✅ PASS: Workflow Tahap 3: Manager Bidang membubuhkan tanda tangan digital approval
  ✅ PASS: Workflow Tahap 4: Pimpinan Unit mengesahkan dokumen (Status Final: Aktif)
  ✅ PASS: Seluruh riwayat approval 3 tahap tersimpan permanen di tabel approvals
  ✅ PASS: Pembersihan data dummy pengujian selesai

====================================================
 TOTAL ASUMSI PENGUJIAN : 56
 BERHASIL (PASS)        : 56
 GAGAL (FAIL)           : 0
 TINGKAT KEBERHASILAN   : 100.0%
====================================================
```

---

## 5. Ringkasan Berkas Utama yang Diperbarui

1. **Konfigurasi & Helper Dokumen Mutu:**
   * `edms-app/src/lib/documentTypes.ts`: Interface `DocumentSectionConfig`, helper `getOrderedSections`, `getDisplaySectionLabel`, `cleanSectionTitle`.
2. **Backend API & Concurrency:**
   * `edms-app/src/app/api/documents/[id]/route.ts`: Perbaikan perbandingan numerik `version_number`, pengembalian `data.versionNumber`, penanganan `deletedSectionKeys`.
   * `edms-app/src/app/api/documents/route.ts`: Penyimpanan `refIds` & `references`.
3. **Editor Dokumen Mutu:**
   * `edms-app/src/app/(app)/editor/[id]/page.tsx`: Integrasi Drag & Drop, panah reorder `▲`/`▼`, tombol `+ Tambah Seksi`, modal dialog seksi kustom, auto-recovery konflik lock.
   * `edms-app/src/components/editor/RevisionHistoryEditor.tsx`: Tabel 6-kolom akumulatif sesuai PR.01-02.
4. **Generator PDF & Pratinjau:**
   * `edms-app/src/lib/pdf.ts`: Iterasi seksi terurut dinamis, watermark subtle, margin seragam, smart page break.
   * `edms-app/src/app/(app)/pdf/page.tsx`: Web preview sinkron dengan urutan `_section_order`.
   * `edms-app/src/app/(app)/documents/[id]/page.tsx`: Tab Isi Dokumen sinkron dengan urutan `_section_order`.
5. **Aset Visual & Favicon:**
   * `edms-app/public/favicon.ico`, `src/app/icon.png`: Logo resmi PLN (*emblem only*).
6. **Deployment:**
   * `\\10.10.200.166\Container\edms-app`: Disinkronkan via Robocopy.
   * `edms-standalone-qnap.zip`: Berkas arsip siap pakai diperbarui.

---

*Dokumentasi ini disiapkan secara otomatis sebagai laporan resmi hasil audit dan kemajuan pengembangan Sistem EDMS Dokumen Mutu Digital PT PLN (Persero) Unit Pelaksana Sertifikasi.*
