# Persiapan update NAS EDMS v2.1.3

**Deployment selesai 30 Oktober 2026.** NAS mencetak `NAS_UPDATE_PASS` pada checkpoint `edms-update-20261029T235901Z-20829`; health LAN mengonfirmasi versi 2.1.3/database OK. Smoke, restart, publikasi dan retensi lulus: 2 dokumen, 2 file beserta hash, 6 akun dan histori tetap ada. Rehearsal final `DUMMY-RESTORE-8593ff71504e`. Instruksi eksekusi di bawah merupakan catatan operasi yang sudah selesai; jangan menjalankan ulang backup/apply checkpoint ini untuk update baru. Detail kegagalan, perbaikan dan pemakaian ulang backup tercatat di IMPLEMENTASI_V2.md.

Status 30 Oktober 2026: paket telah disalin ke NAS dan seluruh 34 checksum cocok. Percobaan backup pertama berhenti sebelum maintenance karena `nas-update-backup.sh` berformat CRLF. Kedua skrip NAS telah diperbaiki ke LF, disinkronkan ulang beserta `SHA256SUMS`, dan 34 checksum NAS cocok kembali (manifest SHA-256 `c7f67b61f094c5075533a59c46e51919a00a0ca056176dda1471e28cff5c19aa`). Health produksi sesudah kegagalan masih v2.1.1 dan database OK. Belum ada backup baru atau perubahan service. Paket v2.1.2 sebelumnya adalah riwayat dan tidak memuat migrasi Peta Dokumen/Lampiran.

## Paket dan bukti lokal

- Direktori: `edms-v2/release/nas-update-9b220b7a` (34 file dalam `SHA256SUMS`).
- Image: `edms-ups:2.1.3`, Linux/amd64, ID `sha256:a1bb3aac1aac38883e83988deb7fb31d84bcefe8ecfb562a56215713c14b8cbe`.
- Tar: `edms-ups-2.1.3.tar`, SHA-256 `9b220b7a11c91bd9651d0f22360de12ca2c7fdc6c98f459978c7bbaa8467a24a`.
- Gate rilis: `release/verification/DUMMY-4809624e1b14/result.json`, passed; 53 tes inti, runtime Linux, integrasi MariaDB/file/ZIP/konversi, browser/UI termasuk Peta Dokumen. Audit dependency runtime: 0 temuan. Seluruh hash paket dan kecocokan layer image diperiksa lokal (`UPDATE_PACKAGE_PASS`).
- Migrasi update aditif 004–008; 007 menambah tanggal dan relasi peta, 008 mengaktifkan jenis Lampiran. Verifikasi retensi mencakup dokumen, versi, file/hash, akun dan master. Penerapan pada salinan backup NAS terbaru tetap belum teruji.
- Rehearsal backup lama `edms-update-20261029T084625Z-30182` lulus pada laptop (`DUMMY-RESTORE-a8323563ac33`): 24 tabel/objek database, 33.593 hash file arsip, 1.007 file storage, migrasi/idempotensi dan rollback. Receipt lama sengaja tidak digunakan karena checksum paket telah berubah dan backup produksi baru masih diperlukan.

## Urutan di kantor

1. Salin seluruh direktori `edms-v2/release/nas-update-9b220b7a` ke `/share/Container/edms-release/nas-update-9b220b7a` di NAS (SMB: `\\10.10.200.166\Container\edms-release\nas-update-9b220b7a`). Pastikan cukup ruang untuk paket sekitar 400 MB, backup DB+aplikasi+image lama, dan restore lokal. Di terminal NAS, dari direktori paket jalankan `sha256sum -c SHA256SUMS`. Jangan jalankan paket v2.1.2.
2. Periksa health dan versi aplikasi aktif serta image/container NAS. Skrip backup mengharapkan `edms-ups-app` masih berjalan dengan image `edms-ups:2.1.1` dan mount lama; jika berbeda, berhenti untuk inventaris ulang. Pastikan tidak ada klien laptop yang menulis ke `edms_ups`, pilih maintenance window, lalu di terminal NAS jalankan:

   ```sh
   sh /share/Container/edms-release/nas-update-9b220b7a/nas-update-start-backup.sh
   ```

   Skrip memvalidasi paket/image/DB, mengambil backup konsisten baru, lalu membiarkan hanya aplikasi EDMS berhenti. Catat path `BACKUP_READY_FOR_RESTORE`. Jangan lanjut apply apabila backup belum lengkap.
3. Akses atau salin direktori backup baru itu dari laptop dengan Docker Linux aktif. Contoh path SMB backup: `\\10.10.200.166\Container\edms-backups\edms-update-...`. Di PowerShell dalam `edms-v2` jalankan:

   ```powershell
   .\scripts\verify-nas-backup.ps1 -Backup '<path-backup-baru>' -RehearseUpdate -UpdatePackage '.\release\nas-update-9b220b7a' -UpdateImage 'edms-ups:2.1.3'
   ```

   Tunggu `NAS_BACKUP_RESTORE_PASS`. Ini memulihkan DB/file pada lingkungan lokal terisolasi, menguji migrasi/idempotensi, dan rollback. Verifier menulis receipt `update-rehearsal-pass.json` di **paket lokal**. Salin receipt itu ke direktori paket NAS, misalnya dari PowerShell:

   ```powershell
   Copy-Item -LiteralPath '.\release\nas-update-9b220b7a\update-rehearsal-pass.json' -Destination '\\10.10.200.166\Container\edms-release\nas-update-9b220b7a\update-rehearsal-pass.json'
   ```

   Receipt harus berasal dari backup baru dan checksum paket yang sama. Jangan gunakan receipt rehearsal backup lama. Jika gagal, pertahankan backup dan hentikan alur apply untuk diagnosis.
4. Hanya setelah receipt lulus, di terminal NAS jalankan:

   ```sh
   sh /share/Container/edms-release/nas-update-9b220b7a/scripts/nas-update-apply.sh --deploy '<path-backup-baru>'
   ```

   Selesai bila tercetak `NAS_UPDATE_PASS`. Periksa health LAN, versi 2.1.3, login, File Explorer, Peta Dokumen, jenis Lampiran, jumlah dokumen/akun dan bukti hash/retensi. Skrip menjalankan smoke DUMMY dan cleanup selektif. Jangan mengimpor atau mengubah Dokumen Final untuk pengujian.

Backup baru, receipt restore, log dan image lama harus dipertahankan sebagai checkpoint pemulihan. Jangan memakai manifest transisi pertama, mengosongkan database, atau menyalin data laptop ke NAS.
