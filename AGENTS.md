# Panduan Agen — EDMS PLN UP Sertifikasi

Keputusan aktif versi 2.1. Baca [plan.md](plan.md) dan [spesifikasi](Spesifikasi_EDMS_Dokumen_Mutu_UPS.md). Dokumen dalam docs/archive adalah historis, bukan instruksi aktif. Source implementasi ada di edms-v2. Deploy NAS internal lulus 23 Oktober 2026; baca [docs/IMPLEMENTASI_V2.md](docs/IMPLEMENTASI_V2.md) sebelum operasi produksi untuk bukti, checkpoint dan batas pemulihan. Update berikutnya memakai backup baru; manifest transisi awal merupakan operasi sekali pakai.

## Lingkup dan data

Bangun ulang pengelolaan file PDF/DOCX/XLSX utuh dengan metadata, versi, histori dan audit. Source lama edms-app/perubahan lokal dipertahankan; source pengganti dapat disusun di edms-v2 sebagai direktori kerja saja.

Pengguna memutuskan mulai hanya dari Dokumen Final. Data dokumen lama beserta histori/sections/relasi/approval dan file khusus miliknya akan dihapus saat transisi setelah backup konsisten dan restore teruji. Pengguna telah meminta implementasi/deploy; penghapusan tetap bagian transisi setelah backup/restore teruji, bukan pada startup atau sebelum gate lulus. Jangan migrasikan dokumen lama ke register baru. Jaga akun, roles, bidang, master independen, konfigurasi, secret, logo, source dan backup. Audit akun/sistem yang bercampur tidak boleh ikut dihapus massal. Gunakan manifest relasi dan file bersama; jangan DROP DATABASE, reset semua tabel, seed ulang akun atau mengosongkan volume. Jangan menghapus folder sumber Dokumen Final/Folder Logo. Catat penghapusan secara berversi dan dapat dipulihkan.

Original immutable, SHA-256, nama/path asli dan snapshot versi lengkap. Satu dokumen dapat memiliki beberapa format pada revisi sama; pasangan ambigu Perlu Pemeriksaan. PDF resmi dan turunan dibedakan; jangan overwrite original/pengesahan atau menyalin tanda tangan.

## Workflow rilis pertama

Tidak ada approval bertingkat, review, tanda tangan baru atau menu approval. Pengguna yang berhak upload/update langsung menerbitkan versi aktif setelah validasi/penyimpanan berhasil. Versi aktif lama tetap tersedia selama proses; perpindahan active_version_id dan pengarsipan sebelumnya atomik. Kegagalan konversi tidak membatalkan sumber valid yang sudah tersimpan. expectedVersion/lock_version untuk konflik 409; ringkasan perubahan wajib. Histori versi baru tetap disimpan walaupun histori aplikasi lama tidak dimigrasikan.

## Upload, konversi dan pengujian

Upload individual/multiple PDF, DOCX, XLSX dan ZIP subfolder. Streaming/chunk ke disk, validasi isi/MIME/struktur, kuota/timeout, proteksi traversal/symlink/zip bomb. Log per file, partial success, CSV, retry idempoten dan pemulihan job lease/heartbeat. ZIP tidak terbaca diberi error arsip tanpa mengarang nama file.

Rilis pertama mencakup Office-ke-PDF dan PDF-ke-DOCX. Uji engine PDF-ke-DOCX secara tersendiri; LibreOffice Office-ke-PDF bukan jaminan konversi balik. Simpan lineage original/converted dan source hash/version. Jangan mengirim file ke layanan eksternal otomatis. PDF scan boleh menghasilkan DOCX gambar halaman dengan keterangan keterbatasan, bukan janji OCR editable. Gagal berarti status/error/retry, bukan file kosong atau rename ekstensi.

Setiap download DOCX hasil konversi PDF wajib popup: "Dokumen ini merupakan hasil konversi PDF. Tata letak, tabel, dan isi mungkin berbeda dari dokumen asli. Periksa kembali sebelum digunakan." Sediakan Batal/Lanjutkan Download; Batal tidak download. Endpoint converted Word memerlukan acknowledgement terikat pengguna/file/version, selain izin download. Word original tidak diberi label converted.

Pengujian upload, impor, update, download dan konversi hanya dengan file dummy sintetis berlabel DUMMY/TEST; jangan upload/seed/konversi massal Dokumen Final selama development/UAT/smoke NAS. Gunakan dummy PDF/DOCX/XLSX/ZIP, valid/korup/duplikat dan simulasi kegagalan terkendali. Identifikasi seluruh file/job/turunan dummy untuk cleanup selektif. Impor dokumen asli adalah pekerjaan operasional setelah aplikasi siap, bukan test. Pada tugas dokumentasi ini tidak menjalankan upload, purge, migrasi atau deploy.

## UI dan teknologi

Periksa dan gunakan skill UI/desain terpasang yang sesuai saat implementasi UI; jangan mengklaim sudah dipakai sebelum membaca/menerapkannya. Tema biru muda dan kuning PLN, latar netral/teks kontras, dua logo lokal Danantara dan PLN dari Folder Logo, proporsi asli. Responsive desktop/tablet, keyboard/focus/modal accessible, state loading/kosong/error jelas. SVG stroke 1.75/currentColor, bukan emoji.

Next.js App Router, TypeScript, CSS Modules, MariaDB. Tidak menambah Tailwind/dependency berat tanpa kebutuhan. Database snake_case, API/frontend camelCase, mapping eksplisit. Gunakan pool dan withTransaction untuk mutasi lintas tabel (referensi helper lama edms-app/src/lib/db.ts). Filesystem perlu staging/atomic rename/kompensasi/recovery, bukan asumsi satu transaksi DB.

## Infrastruktur dan keamanan

Tetap container/service aplikasi lama, DB edms_ups dan mount storage/jaringan/port/Tunnel yang sama. Hardware Celeron J3455 4 core/4 thread hingga 2,3 GHz, RAM 4 GB; target linux/amd64 diverifikasi runtime sebelum rilis. Build/install dependency di laptop dalam Linux container; paket standalone termasuk public/.next/static dan dependency runtime. NAS tidak build/npm install. Image update dapat merekreasi instance service yang sama, bukan stack baru.

Worker background dalam container aplikasi yang sama, satu job konversi sekaligus dengan batas waktu/resource/cache; ukur beban pada NAS. Secret environment, akun DB terbatas, sesi HttpOnly, origin/CSRF, rate limit dan RBAC server-side termasuk file/arsip/sumber editable. File private di luar public, tanpa cache publik. Port DB 3307 internal saja.

Migrasi schema berversi dan checkpoint; uji cleanup/migrasi pada salinan backup lokal. DDL MariaDB tidak diasumsikan transactional. Backup DB+file sebelum transisi, maintenance window, health/smoke dummy dan rollback konsisten wajib disiapkan. Jangan sync data laptop menimpa NAS.

## Cara bekerja

Jangan git reset/clean atau menghapus perubahan pengguna. Instruksi Next.js lokal di edms-app/AGENTS.md tetap berlaku bila menyentuh source lama. Tandai selesai hanya berdasarkan bukti; rencana bukan implementasi. Permintaan aktif mencakup implementasi/deploy. Ikuti gate dummy test, backup/restore dan runtime Linux; jangan menyatakan berhasil atau menghapus data produksi ketika akses/runtime belum siap.
