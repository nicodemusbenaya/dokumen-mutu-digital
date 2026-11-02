# Panduan operator pengganti: update EDMS di NAS

Repo GitHub menyimpan **source**, bukan image siap jalan, database, storage, secret, atau dokumen asli. `git pull` di NAS tidak mengupdate aplikasi. NAS menjalankan image Linux/amd64 yang dibangun dan diuji pada komputer dengan Docker Linux, lalu dikemas sebagai paket rilis. Jangan build atau `npm install` di NAS.

## Akses yang perlu disiapkan sebelum pemilik tidak ada

- Beri operator akses baca ke repo privat GitHub dan akses terminal QTS/SSH pada NAS melalui akun pribadi, bukan berbagi password pemilik. Operator juga perlu akses Docker/Container Station dan share `/share/Container/edms-release` serta `/share/Container/edms-backups` sesuai tugasnya.
- Pastikan ada komputer Linux/Docker Linux untuk build dan restore test, akses ke backup NAS, serta prosedur transfer paket ke share NAS. Simpan kredensial produksi di pengelola rahasia organisasi; jangan masukkan ke GitHub, image, atau dokumen ini.
- Tunjuk orang kedua untuk memeriksa receipt backup/restore, versi image, dan hasil health sebelum membuka aplikasi. Catat siapa yang menjalankan update, waktu, commit Git, paket, backup, dan hasilnya.

## Alur setiap rilis

1. Pada komputer build: clone repo, checkout **commit/tag rilis yang disetujui**, baca `AGENTS.md`, `plan.md`, `docs/IMPLEMENTASI_V2.md`, dan catatan rilis terbaru. Periksa `git status` bersih. Jangan gunakan `edms-app` atau skrip transisi awal untuk update rutin.
2. Di `edms-v2`, jalankan `npm ci`, tes relevan, `scripts/build-release.ps1`, dan `scripts/verify-release.ps1` pada Docker Linux. Pastikan hasil verifikasi menyebut `passed=true`, arsitektur `linux/amd64`, dan tes dummy. Jangan gunakan Dokumen Final sebagai fixture.
3. Kemas image dan helper versi tersebut dengan skrip paket rilis yang sesuai; periksa `SHA256SUMS`, lalu salin paket ke `/share/Container/edms-release/<paket>`. Repo GitHub saja tidak cukup untuk tahap ini.
4. Catat baseline read-only NAS: image, service `edms-ups-app`, mount, versi, health, jumlah dokumen/file/akun, job aktif dan ruang disk. Hentikan writer lain; masuk maintenance. Buat **backup baru** DB + seluruh storage/app/Compose/image lama dengan skrip versi rilis. Jangan gunakan backup transisi Oktober sebagai gate update baru.
5. Pulihkan backup tersebut di komputer uji yang terisolasi; verifikasi hash DB/file, akun dan dokumen tetap ada. Rehearsal migrasi schema dan rollback bila rilis mengubah schema. Receipt harus cocok dengan backup dan paket yang akan dipasang.
6. Jalankan skrip apply dari paket versi tersebut pada terminal NAS. Skrip harus memeriksa gate, checksum, image amd64, mount/service/port yang sama, lalu health dan smoke **DUMMY**. Bersihkan hanya data dummy yang tercatat. Periksa ulang jumlah/metadata dan hash file existing serta restart/health. Simpan receipt.
7. Jika gate gagal sebelum apply, biarkan versi lama dan selesaikan penyebabnya. Jika gagal sesudah apply, ikuti batas rollback di catatan rilis itu; setelah aplikasi dibuka dan mungkin menerima tulisan baru, jangan memulihkan backup lama secara otomatis.

## Kondisi saat panduan ini ditulis (2 November 2026)

Catatan terakhir `docs/IMPLEMENTASI_V2.md` menyatakan percobaan 2.1.7 belum membuktikan `NAS_APP_UPDATE_PASS`; versi LAN terakhir yang tercatat sehat adalah 2.1.6. Jangan menganggap source GitHub atau paket 2.1.7 sudah terpasang. Prosedur khusus 2.1.7 memerlukan backup `edms-update-20261030T074540Z-2104`, receipt restore yang cocok, `scripts/prepare-app-update-gate-2.1.7.ps1`, dan `nas-app-update.sh <backup-path>`; cocokkan lagi kondisi NAS saat operator mulai. Bila ada penulisan setelah backup itu, buat backup baru dan ulangi restore/gate.

Simpan catatan rilis baru untuk setiap update. Jangan menjalankan `nas-cutover`, `legacy-cleanup`, `empty-register`, `seed`, atau sinkronisasi storage laptop pada operasi update rutin.
