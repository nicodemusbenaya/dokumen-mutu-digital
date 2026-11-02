# EDMS v2 — implementasi pengganti

Status implementasi dan hambatan deployment tercatat di ../docs/IMPLEMENTASI_V2.md. Source baru memakai akun/roles lama dan tabel dokumen baru berprefix v2_ pada database edms_ups yang sama. Tidak ada data dokumen lama dimigrasikan.

## Lokal

### Pengembangan dari rumah tanpa NAS

Gunakan Docker Desktop Linux dan Node.js yang sudah terpasang di laptop. Dari folder `edms-v2`:

```powershell
npm ci
npm run dev:home
```

Perintah ini membuat `.env.home` berisi kredensial acak lokal (diabaikan Git), menyalakan MariaDB `edms_home` pada `127.0.0.1:33307`, membuat akun `DUMMY-home-admin`, menerapkan migrasi v2, lalu membuka aplikasi di `http://localhost:3100`. Username dan password dummy ditampilkan pada terminal setiap kali dijalankan. Storage lokal berada di `edms-v2/storage/home`; database berada di volume Docker `edms-v2-home_home_db`. Keduanya terpisah dari NAS, database `edms_ups`, dan folder Dokumen Final. Gunakan hanya file sintetis DUMMY/TEST untuk upload dan konversi development.

Tekan Ctrl+C untuk menghentikan aplikasi. `npm run dev:home:stop` menghentikan MariaDB tanpa menghapus data lokal. Perintah ini memerlukan Docker Linux yang dapat diakses; jika Docker Desktop belum berjalan atau izin API ditolak, jalankan Docker Desktop lalu ulangi. Dependency dan image MariaDB perlu diunduh sekali saat internet tersedia; setelah tersedia di laptop, jaringan kantor/NAS tidak diperlukan. Konversi Office membutuhkan LibreOffice lokal dan PDF ke DOCX membutuhkan Python/dependency lokal; pasang dependency itu di laptop bila mengerjakan konversi.

Jika migrasi development berhenti di tengah, jalankan ulang `npm run dev:home`. Migrasi v2 bersifat idempoten dan volume lokal tidak perlu dihapus. Buka aplikasi melalui `http://localhost:3100` agar origin login sesuai profil rumah.

Jangan menjalankan `npm run migrate` biasa untuk development rumah: perintah tersebut membaca `.env.local` dan bisa mengarah ke DB lain. `dev:home` memasok konfigurasi DB lokal secara eksplisit kepada migrasi, seed, web, dan worker. Jangan gabungkan `compose.home.yml` dengan Compose produksi.

Konfigurasi .env.local disalin dari edms-app; tidak masuk Git/image. Pastikan APP_ORIGIN cocok dengan origin browser dan STORAGE_ROOT menunjuk volume yang benar. Gunakan database development/salinan backup untuk pengujian. Jangan menjalankan test terhadap dokumen asli.

- npm ci (saat jaringan tersedia); dependency lokal yang tersedia dipakai dalam sesi implementasi ini.
- npm run migrate: hanya membuat tabel v2_, tidak menghapus data lama.
- npm run migrate -- --only 003: menerapkan master saja setelah schema 001/002 tersedia; jalankan pada database yang benar melalui prosedur backup/migrasi. Tidak dijalankan otomatis oleh startup aplikasi.
- npm run dev: web port 3100 dan worker background.
- npm test: fixture dummy, ZIP dan PDF-ke-DOCX tanpa memerlukan database.
- node tests/ui.mjs: browser integration dengan API mock; bukan bukti DB/upload sebenarnya.
- node scripts/preflight.mjs: cek DB/storage/runtime tanpa mencetak secret.

## Rilis Linux

Jalankan scripts/build-release.ps1 di laptop dengan Docker Desktop Linux. Image memuat standalone dan dependency konversi. NAS tidak build/install. Runtime berada di /opt/edms agar mount /app lama tidak menutupi image. Gabungkan compose.override.yml dengan konfigurasi produksi; DB/session/Tunnel/ports/mount lama diwariskan. Periksa izin tulis volume bagi UID node sebelum cutover.

Jangan jalankan source-update/deploy lama. Jangan menyalin .next standalone Windows ke NAS. Jangan menyatakan rilis Linux siap jika docker build/export belum lulus.

## Sebelum NAS diganti

Backup konsisten DB dan file serta buktikan restore. Uji integrasi DB/upload/resume/revisi/konflik dan konversi Office memakai dummy. Masuk maintenance; buat manifest dan bersihkan hanya dokumen lama/relasinya, pertahankan akun/config/master independen. DDL memerlukan checkpoint. Uji image Linux, update service/container lama, smoke dummy, cleanup dummy lalu buka akses. Source ini tidak otomatis menjalankan purge pada startup.

Impor asli dari Dokumen Final menunggu kesiapan aplikasi; bukan bagian test. File dummy di tests/output diabaikan Git.

## Peta Dokumen (pengembangan lokal)

Menu **Peta Dokumen** menampilkan dokumen aktif yang sudah terdaftar menurut Level 1 Dokumen Mutu, Level 2 Prosedur/SOP, Level 3 Instruksi Kerja, dan Level 4 Formulir Mutu. Level dibaca dari kode atau jenis dokumen sesuai aturan pada prosedur informasi terdokumentasi. Hubungan otomatis hanya muncul bila satu-satunya induk dapat dipastikan dari kode: Prosedur ke satu Dokumen Mutu aktif, atau Formulir ke Prosedur dengan kode fungsi, bidang, dan nomor prosedur yang sama (revisi diabaikan). Kode Instruksi Kerja tidak mencantumkan induk Prosedur secara tegas; hubungannya diatur admin lewat **Atur**. Jika ada dua calon induk berkode sama atau induk tidak ada, dokumen tetap belum terhubung untuk diperiksa. Hubungan manual mengesampingkan hasil otomatis; tidak ada data `map_parent_id` yang ditulis hanya karena inferensi tampilan.

Pilih **Daftar hierarki** untuk tampilan tabel seperti daftar dokumen, atau **Bagan hubungan** untuk melihat garis penghubung antar dokumen manual maupun otomatis. Hubungan otomatis diberi label jelas. Dokumen tanpa induk yang sah tampil di bagian Belum terhubung. Admin dapat mengoreksi atau menetapkan induk lewat **Atur** pada Daftar hierarki. Formulir boleh terkait langsung ke Prosedur bila kode mengacu kepadanya, walaupun Level 3 tidak ada di antaranya.

Tanggal dokumen dicoba dibaca dari bagian awal DOCX atau halaman pertama PDF saat file asli diterbitkan. Tanggal riwayat perubahan tidak dipakai. Untuk dokumen yang sudah terdaftar sebelum fitur ini, admin dapat memakai **Baca tanggal** pada satu dokumen, lalu memeriksa atau mengoreksinya melalui **Atur**. Tanggal yang tidak ada atau ambigu tetap bertanda **Perlu pemeriksaan**. XLSX dan PDF scan yang tidak menghasilkan teks tanggal membutuhkan pemeriksaan manual. Pembacaan ulang tidak mengirim file ke layanan eksternal.

Upload ZIP memproses setiap PDF/DOCX/XLSX yang valid secara terpisah melalui jalur penerbitan yang sama. Karena itu tanggal dibaca dari masing-masing DOCX/PDF di dalam ZIP, bukan dari nama atau tanggal ZIP. Jika item ZIP gagal validasi atau menunggu klasifikasi, tanggalnya belum tersedia sampai file tersebut berhasil diterbitkan.

Migrasi aditif `007_document_map.sql` berjalan bersama `npm run dev:home` pada database rumah. Source ini belum dideploy ke NAS; deployment produksi memerlukan paket Linux, backup baru, restore/rehearsal migrasi, dan smoke dummy sesuai gate di `docs/IMPLEMENTASI_V2.md`.

## Konversi PDF ke Word

PDF teks diekstrak ke paragraf DOCX yang dapat diedit; tata letak, tabel dan gambar tidak dijamin setara. Halaman tanpa teks dirender menjadi gambar di DOCX, tanpa OCR. PDF asli tidak diubah. Tiap download DOCX turunan memerlukan popup peringatan dan ticket terikat pengguna/file dengan masa berlaku dua menit. LibreOffice dalam image digunakan untuk DOCX/XLSX ke PDF.

## Build Windows yang sudah berhasil
Pengguna berhasil menjalankan npm.cmd run build dari PowerShell biasa. node scripts/prepare-standalone.mjs sudah dijalankan untuk melengkapi aset dan worker tanpa secret. Ini membuktikan kegagalan packaging EPERM sebelumnya khusus percobaan sesi agen; kompatibilitas runtime Linux masih harus diverifikasi. Pemeriksaan berikut dari terminal pengguna: docker version dan node --env-file=.env.local scripts/preflight.mjs. Nilai productionReady=false pada Windows memang diharapkan karena target produksi Linux, tetapi database/storage/secret dapat dicek terpisah.


## Verifikasi image Linux di laptop
Setelah build-release berhasil, jalankan powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1 dari folder edms-v2. Script membuat database/container dummy sementara pada Docker laptop dan menguji image tanpa menyentuh NAS. Jika image mariadb:10.11 belum ada, Docker mengunduhnya. Hasil/log tersimpan pada release/verification/DUMMY-*/. result.json harus passed=true; bila UI dilewati dengan -SkipBrowser, verifikasi UI tetap wajib sebelum produksi.

