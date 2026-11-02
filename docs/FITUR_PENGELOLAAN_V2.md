# Pengelolaan EDMS v2 — 22 Oktober 2026

Permintaan pengguna: seluruh fitur utama pengelolaan, deteksi duplikat, pemulihan versi, dan menu tambah user khusus Admin.

## Menu dan alur

- Kelola Dokumen: pencarian/filter status Aktif/Diarsipkan/Sampah, jenis, bidang, kategori, format aktif, rentang tanggal, urutan terbaru/terlama/judul/kode. Pagination 20 dokumen.
- Checkbox individual, halaman ini, atau semua hasil filter. Maksimal 500 dokumen per aksi. Pilihan dibersihkan saat filter/halaman berubah. Hasil request lama tidak menggantikan filter baru.
- Aksi individual/massal: hapus ke Sampah, pulihkan (kembali ke status sebelum dibuang), arsipkan/aktifkan, ubah kategori/bidang. Konfirmasi/alasan wajib, izin dan versi diperiksa per dokumen, laporan partial success tersedia. Pengubahan bidang khusus Admin.
- Detail: edit kode, judul, jenis, kategori, bidang, serta tombol arsip/hapus/pulihkan. Metadata tidak mengubah original/snapshot sebelumnya. Audit menyimpan nilai sebelum/sesudah dan alasan.
- Deteksi Duplikat: SHA-256 original versi aktif lintas dokumen; judul sama untuk kemungkinan pasangan. Histori, hasil konversi, dan Sampah tidak dihitung sebagai duplikat aktif. Tidak ada penggabungan/penghapusan otomatis.
- Pemulihan versi: dari histori, membuat versi baru dengan seluruh format, hash, origin dan lineage. File immutable tetap dipakai tanpa overwrite. Snapshot metadata disimpan untuk versi setelah migrasi 002. Versi lama tanpa snapshot memulihkan judul versi dan mempertahankan kode/bidang/jenis/kategori register saat ini; tidak mengarang metadata historis.
- Kelola Pengguna: khusus Admin Sistem. Tambah akun, edit nama/bidang/role/status, reset password. Role lama tetap tersedia. Password bcrypt tidak dikembalikan API/audit. Form minimal 8 karakter. Admin tidak bisa menonaktifkan/menurunkan role sendiri; minimal satu Admin aktif dijaga secara transactional.

## ZIP massal

Worker aplikasi yang sama membuat ZIP streaming dengan Python stdlib. Hanya original versi terpilih, bukan hasil konversi, sehingga warning converted Word tidak dibypass. Batas 500 dokumen, 1.000 file, total sumber 512 MB, timeout lima menit. ZIP private tersedia 24 jam; file kedaluwarsa dibersihkan worker. Izin/status/versi dicek kembali sebelum pemrosesan dan download. Maksimal dua ekspor menunggu/berjalan per pengguna dan request dibatasi rate limit. Lease yang kehabisan tiga percobaan menjadi failed.

## Schema dan penerapan

Migrasi edms-v2/sql/002_management.sql menambah lock_version/previous_status pada v2_documents, snapshot_json pada v2_versions, dan tabel v2_exports. DDL MariaDB idempoten, checkpoint 002 setelah selesai. Tidak menghapus data lama atau membuat akun otomatis.

Metadata/status/pemulihan menggunakan active_version dan lock_version. Revisi/attach membawa expectedLockVersion dan memeriksanya saat publikasi agar antrean tidak menimpa metadata baru. Job lama tanpa lock perlu diperbaiki/upload ulang. Endpoint status lama memakai guard yang sama. Sampah tidak dapat didownload/diupdate/dikonversi sebelum dipulihkan.

Preview development: hentikan server, jalankan npm.cmd run migrate dari edms-v2 dengan environment database yang disengaja, lalu npm.cmd run dev. Tidak perlu build image untuk preview lokal. Migrasi tidak otomatis pada startup. Tidak ada deploy atau cleanup produksi pada tugas fitur ini.

## Bukti dan batas validasi

Rilis sebelum fitur ini lulus DUMMY-d986acc327c6. Hasil itu tidak mencakup fitur baru ini.

Sesudah penambahan: 17 unit/regression test, TypeScript, syntax modul dan dependency checker Windows lulus. Detector UI tidak menemukan masalah mekanis. ZIP diuji dengan konten DUMMY sintetis. Review kode terpisah menutup bypass endpoint lama, konflik metadata/upload, race filter dan lease ekspor habis.

Integrasi diperluas: metadata/concurrent upload, pemulihan versi/hash/origin, Sampah/arsip/download ditolak, duplikat/filter, bulk partial success, ZIP original-only, akun/reset/nonaktif, RBAC Viewer/editor bidang lain, exhausted lease. UI mock ditambah menu baru, checkbox/konfirmasi hapus, duplikat, tambah user dan viewport desktop/mobile.

Integrasi Linux dan browser perubahan baru belum dieksekusi: Docker named pipe permission denied dan Chromium launch ditolak (3221225506). Jalankan build-release.ps1 -Verify melalui PowerShell pengguna untuk verifikasi rilis. NAS tidak diubah oleh agen; Dokumen Final tidak dipakai untuk test.

Penghapusan permanen tidak ditambahkan; Sampah dapat dipulihkan. Profil/password mandiri, wajib ganti password awal, ekspor register CSV/Excel dan dashboard storage tetap saran tahap berikutnya di luar cakupan fitur utama yang diminta.
## Tambahan 23 Oktober 2026: Hapus permanen dari Sampah

Permintaan pengguna menambahkan aksi Hapus permanen pada Kelola Dokumen, filter status Sampah. Hanya Admin Sistem yang dapat menjalankannya, maksimal 20 dokumen per tindakan, wajib alasan dan ketik `HAPUS PERMANEN`. Aksi hapus biasa tetap memindahkan ke Sampah. Viewer/Penyusun tidak mendapatkan opsi permanen; pembatasan berlaku kembali di server. Tidak ada dokumen pengguna yang dihapus selama implementasi ini.

Server memeriksa status Sampah, expectedVersion/lockVersion dan pekerjaan konversi aktif. Snapshot dokumen/seluruh versi/file serta referensi item impor ditulis ke `STORAGE_ROOT/backups/permanent-delete/<operationId>/manifest.json` versi 1. Semua file dicadangkan dan SHA-256 diverifikasi sebelum mutasi penghapusan. Gagal membaca/mencadangkan/memverifikasi file berarti transaksi DB dibatalkan dan original tetap ada. Audit penghapusan berada pada transaksi yang sama dan tetap dipertahankan. Akun, role, konfigurasi, master dan log pekerjaan tidak dihapus.

Sesudah DB commit, hanya file tanpa referensi `v2_files.disk_path` yang dihapus dari direktori originals/derived. File fisik bersama tetap disimpan. Cadangan pemulihan tidak otomatis dihapus, sehingga fitur ini tidak menjanjikan pengurangan ukuran total storage. Snapshot tidak dapat dipulihkan dari UI Sampah; pemulihan adalah pekerjaan administrator dengan maintenance dan pengecekan konflik. File turunan yang menjadi sumber dokumen lain memblokir penghapusan agar lineage tetap aman.

`manifest.json` berstatus prepared tidak sendirian membuktikan DB sudah terhapus: untuk pemulihan gangguan, periksa keberadaan dokumen dan audit `PERMANENT_DELETE` dengan operationId yang sama. `result.json` mencatat completed atau cleanup_pending setelah commit. Bila hasil menyebut pembersihan tertunda atau result.json tidak ada, jangan hapus backup atau menjalankan penghapusan massal; rekonsiliasi per-path dengan referensi DB dan checksum manifest. Tidak ada purge otomatis saat startup. Backup pra-transisi NAS dan restore teruji tetap wajib sebelum deployment.

Validasi lokal: 26 test lulus, termasuk pembatasan Admin/Sampah/versi/konfirmasi, backup sebelum delete, file bersama, checksum salah, pekerjaan berjalan dan rollback DB melalui dependency DB sintetis. TypeScript lulus. Skenario integrasi MariaDB dummy dan UI mock ditambahkan ke skrip verifikasi rilis; belum dijalankan pada Linux/browser/NAS untuk perubahan ini. Tampilan logo/dropdown juga masih memerlukan QA browser pada runtime yang tersedia.
## Master dan dropdown Upload & Impor — 23 Oktober 2026

Menu Kelola Master khusus Admin Sistem menyediakan tiga kelompok: Kategori/folder, Bidang, Jenis dokumen. Admin dapat menambah master, mengedit nama tampilan, dan mengaktifkan/menonaktifkan. Nilai tersimpan bersifat tetap setelah dibuat agar metadata dokumen, lingkup bidang, dan snapshot histori tidak berubah massal. Tidak ada penghapusan master yang dapat memutus referensi dokumen; nonaktif berarti tidak tersedia untuk upload baru. Role dan ekstensi file tetap mengikuti konfigurasi keamanan, bukan master bebas.

Kategori/folder bersifat logis (dapat memakai nilai seperti Sistem Mutu/Prosedur), bukan perintah membuat/memindahkan direktori storage. Original path dari file/ZIP tetap dicatat. Ketika dropdown Tanpa kategori dipilih, worker menyimpan kategori kosong; path subfolder ZIP tetap utuh dan tidak otomatis membuat kategori di luar daftar master.

Upload & Impor memakai dropdown jenis, bidang, kategori. Admin dapat memilih bidang aktif; penyusun hanya bidang akunnya. Jenis dan bidang wajib, kategori opsional. Loading/error master tampil jelas dan form ditahan saat pilihan gagal dimuat. Endpoint upload memvalidasi master aktif dan lingkup bidang server-side. Update revisi dokumen yang ada mempertahankan identitas/lingkupnya. Perubahan metadata ke nilai baru juga diperiksa terhadap master; nilai lama yang tidak berubah boleh dipertahankan. Jenis tambahan tersedia pada pilihan upload, filter register dan edit metadata.

Schema berversi `003_masters.sql` menambah tabel independen v2_master_values, mengisi jenis awal serta Umum, dan mendaftarkan bidang akun serta metadata dokumen v2 yang sudah ada sebagai master. Tidak mengimpor dokumen aplikasi lama, tidak mereset akun/roles, dan tidak menyentuh folder Dokumen Final. Migrasi disiapkan di scripts/migrate.mjs, belum dieksekusi ke DB/NAS pada sesi ini. Pada deployment, jalankan melalui prosedur migrasi/backup/restore yang berlaku sebelum membuka runtime baru.

API GET masters tersedia untuk pengguna terautentikasi (Admin melihat juga nilai nonaktif); POST/PATCH hanya Admin, validasi panjang/jenis, optimistic locking dan audit CREATE_MASTER/UPDATE_MASTER. Nama tampilan dapat diubah tanpa mengganti nilai kanonis yang dipakai dokumen. Duplikat menghasilkan konflik dengan petunjuk mengedit/mengaktifkan kembali entri yang ada.

Verifikasi source: TypeScript dan 29 pengujian lokal lulus, termasuk validasi master, RBAC penulisan, pilihan aktif, binding SQL dan field kanonis tidak dapat diubah lewat edit. Integrasi dummy diperluas untuk master bertag run ID, jenis custom, konflik update master, dan penolakan upload dengan master tidak terdaftar. UI mock mencakup tambah kategori dan opsi dropdown upload; skrip diperiksa sintaksnya. Integrasi DB/Linux/browser untuk fitur baru belum dijalankan karena akses runtime tetap terhalang. Tidak ada upload atau perubahan data NAS.
## Perbaikan error master dan dropdown pengelolaan — 23 Oktober 2026

Pesan generik Layanan belum siap pada master sebelumnya juga mencakup tabel v2_master_values yang belum diterapkan. Endpoint master kini membedakan schema master belum tersedia (instruksi migrasi 003) dari koneksi/izin database bermasalah. Pemeriksaan read-only dari sesi agen kembali ditolak EACCES; ini tidak membuktikan tabel pada runtime pengguna hilang, dan migrasi belum dijalankan dari sesi ini. Diperlukan pemeriksaan/migrasi dari terminal yang dapat mengakses database runtime tersebut.

Migrator mendukung `npm run migrate -- --only 003` dari folder edms-v2 dengan konfigurasi environment yang sama dengan aplikasi. Mode ini mengecek checkpoint 001/002 dan hanya menjalankan schema master 003. Tidak mereset akun/data dan tidak mengeksekusi cleanup dokumen. Prosedur backup/restore dan gate deployment tetap berlaku; migrator bukan endpoint inisialisasi schema otomatis.

Kelola Dokumen kini memakai dropdown master untuk jenis, bidang, kategori pada filter; bidang/kategori pada aksi massal; dan jenis/bidang/kategori pada edit metadata detail. Master loading/error mempunyai status/retry, dan penyimpanan metadata ditahan sampai master siap. Nilai lama/nonaktif tetap dapat ditampilkan dan dipertahankan pada dokumen lama; perubahan ke nilai baru tetap membutuhkan master aktif. Penyusun tidak dapat mengganti bidang.

Aksi massal menyediakan Tidak diubah untuk kedua field dan Tanpa kategori untuk mengosongkan kategori secara eksplisit. Memilih keduanya Tidak diubah ditolak agar tidak mencatat perubahan kosong. Nilai kategori dikirim sebagai pilihan terkode untuk membedakan nilai master nyata dari sentinel Tidak diubah/Tanpa kategori.

Validasi lokal: TypeScript dan 32 test lulus, termasuk klasifikasi error database/schema serta rendering dropdown, nilai lama/nonaktif dan opsi kosong. Skrip UI mock diperluas dan sintaksnya diperiksa. Uji klik browser, akses DB serta migrasi aktual masih belum terverifikasi.
## Identitas dari nama panjang dan alias Windows — 23 Oktober 2026

Laporan pengguna: nama panjang PR.UPS.PBR3.BST.02-01.REV.01 PEMELIHARAAN SERTIFIKASI KOMPETENSI.pdf tampil sebagai judul PRUPSP~1 dan kode DOC-…. Pemeriksaan read-only nama sumber menemukan nama panjang tersebut masih ada. Pada source v2, nama upload dikirim dari File.name dan nama entri ZIP dari manifest arsip; tidak ditemukan fungsi pembentukan alias 8.3. Output lama PRUPSP~1/DOC-… konsisten dengan input alias PRUPSP~1.pdf, tetapi tahap aktual ketika nama berubah belum dibuktikan melalui log runtime/database/browser. Jangan mengklaim browser atau Windows pasti penyebab tanpa bukti nama di masing-masing tahap.

Parser identitas dipindah ke filename-identity.mjs yang dipakai server dan pratinjau browser. Nama lengkap contoh dikenali sebagai kode PR.UPS.PBR3.BST.02-01; judul tetap seluruh nama tanpa ekstensi, sesuai keputusan pengguna sebelumnya. Penanda .REV.01/REV2/REV_02 tidak ikut menjadi kode, termasuk varian kode tanpa tanda hubung. Deteksi angka revisi tidak otomatis mengganti isian revisi resmi; form tetap menjadi sumber nomor revisi.

Sebelum upload, daftar file menampilkan Nama yang diterima browser, perkiraan kode dan judul. Alias berbentuk PRUPSP~1 memerlukan kode/judul manual pada upload individual. Pada batch/ZIP, alias tanpa metadata lengkap menghasilkan status Perlu Pemeriksaan dan tidak menerbitkan dokumen berjudul alias dengan kode fallback. Pengguna dapat mengisi identitas pada perbaikan item. Nama panjang tidak dikarang/dipulihkan dari alias yang kehilangan informasi. Original filename/path/hash tetap disimpan sebagaimana diterima; tidak menimpa original atau membaca isi dokumen asli untuk eksperimen.

Endpoint pembuatan sesi mengembalikan nama yang diterima server; client membandingkannya dengan nama file yang dipilih sebelum pengiriman chunk. Perbedaan menghentikan upload dengan pesan jelas. Nama yang memang tidak memiliki pola kode (tetapi bukan alias pendek) tetap mengikuti kebijakan kode DOC-…. Isian manual tetap didahulukan.

Verifikasi: TypeScript dan 38 test lokal lulus, termasuk string contoh, variasi nama/revisi/path, alias, metadata manual dan publikasi dummy alias yang ditahan sebelum akses DB/copy original. Detector UI bersih. Tidak ada upload/konversi dokumen asli atau perubahan data dokumen yang sudah terdaftar. Koreksi record lama dilakukan melalui Edit metadata dengan pemeriksaan pengguna; upload ulang konten sama dapat terdeteksi duplikat dan bukan mekanisme mengganti metadata. Interaksi browser dan diagnosis runtime upload pengguna belum terverifikasi.
