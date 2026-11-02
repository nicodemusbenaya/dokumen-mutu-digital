# Rencana Deployment EDMS v2 ke QNAP

Status 23 Oktober 2026: deployment v2.1.0 lulus, akses LAN http://10.10.200.166:3000. Image Linux, backup/restore, smoke dummy NAS dan restart telah diverifikasi. Bukti dan checkpoint ada di [docs/IMPLEMENTASI_V2.md](docs/IMPLEMENTASI_V2.md); acuan keputusan [plan.md](plan.md).

Urutan transisi di bawah adalah referensi rilis pertama yang sudah dijalankan. Untuk update berikutnya, buat backup konsisten baru dan paket teruji; pertahankan dokumen/versi aktif. Manifest pengosongan register awal serta helper resume/finalisasi terikat checkpoint lama dan tidak boleh dipakai ulang pada produksi aktif.

## Infrastruktur tetap

Gunakan container/service aplikasi lama, database edms_ups dan mount storage/jaringan/port yang sama. Pengguna mengonfirmasi akses hanya LAN pada http://10.10.200.166:3000; domain HTTPS publik tidak digunakan. MariaDB 3307 tetap internal. Intel Celeron J3455 4 core/4 thread hingga 2,3 GHz, RAM 4 GB; runtime linux/amd64 terverifikasi.

Build/install dependency dalam Linux container di laptop. Paket final mencakup standalone, public, .next/static dan dependency konversi yang diuji. NAS hanya menjalankan runtime, tanpa npm install/npm run build. Compose produksi image tanpa build. Update image dapat merekreasi instance container pada service yang sama, bukan membuat stack paralel.

Worker berada dalam container aplikasi sama; satu job konversi sekaligus, timeout, cache per hash/version dan restart recovery. Rilis mencakup Office-ke-PDF serta PDF-ke-DOCX; pilih engine PDF-ke-DOCX melalui proof-of-concept dummy tersendiri. Ukur beban web+worker di NAS 4 GB; jangan menjanjikan batas RAM tanpa pengukuran. Optimasi sebelum meminta perubahan arsitektur.

## Isi rilis

Image/paket runtime, manifest versi/arsitektur/checksum/schema, konfigurasi runtime tanpa secret, migrasi/checkpoint, cleanup data dokumen lama yang terarah, health check dan prosedur rollback teruji. Jangan memasukkan .env.local, cookie, dokumen pengguna atau dump database ke image.

## Data dan urutan transisi

1. Uji lokal dengan dummy sintetis; uji migrasi/cleanup pada salinan backup secara terkontrol.
2. Build image Linux amd64 di laptop dan smoke test paket final menggunakan dummy.
3. Backup konsisten DB+file, verifikasi restore dan simpan runtime sebelumnya.
4. Masuk maintenance, hentikan penulisan; buat manifest record/file dokumen lama dan relasinya.
5. Hapus data dokumen lama, revisi/sections/relasi/approval dan file khusus miliknya dalam urutan FK yang benar. Jangan membawa dokumen lama ke register baru. Jaga akun/role/bidang, master independen, konfigurasi, logo dan backup; pilah audit sistem/akun yang bercampur. Jangan DROP DATABASE/reset semua tabel atau mengosongkan volume. Jangan menghapus Dokumen Final.
6. Migrasi schema dengan versi/checkpoint, perbarui runtime service lama, mount/environment tetap. DDL MariaDB tidak dianggap transactional; siapkan recovery tiap tahap.
7. Jalankan health/RBAC/upload/download/update/konversi/popup memakai dummy saja pada NAS. Versi baru langsung aktif setelah validasi; tidak ada approval bertingkat.
8. Bersihkan semua file/job/versi/turunan dummy melalui penandanya, buka kembali endpoint lama setelah pemeriksaan lulus.

Impor asli dari Dokumen Final dilakukan sebagai pekerjaan operasional setelah aplikasi siap, bukan sebagai test development/UAT/smoke. Jangan otomatis mengupload dokumen asli untuk pembuktian fitur. Manifest inventaris 351 file awal diperbarui bila folder berubah.

## Storage dan rollback

Mount storage lama tetap di luar image; tambah subfolder original/derived/staging sesuai kebutuhan. Cleanup khusus file yang masuk manifest data dokumen lama dan tidak dipakai akun/config/data bersama. Staging cleanup berdasar TTL dan referensi aktif. Jangan sync data laptop menimpa NAS.

Rollback image memerlukan schema kompatibel; bila cleanup/migrasi merusak kompatibilitas, hentikan penulisan dan restore DB+file dari backup pra-transisi bersama runtime lama. Backup untuk recovery, bukan migrasi dokumen lama ke aplikasi baru.

## Tunnel dan penerimaan

Produksi saat ini hanya LAN; Tunnel tetap stopped setelah maintenance. Jika kelak akses publik diperlukan, konfigurasi HTTPS/origin dan Tunnel menjadi perubahan operasional tersendiri. Chunk upload, expiry/checksum/kuota sesi dan file privat tanpa cache publik tetap berlaku. Penerimaan: NAS tanpa build/install, akun/config tetap, register akhir tanpa dokumen lama/dummy, restart lulus, beban terukur, restore/rollback terbukti. PDF asli utuh; setiap download DOCX converted memerlukan warning/acknowledgement.

Referensi: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
