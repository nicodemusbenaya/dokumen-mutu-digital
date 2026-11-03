# Update NAS 2.1.8 — Fitur Form

Isi rilis: menu **Form** (form builder, link isi, jawaban, Download Excel/PDF) dan 4 form asli yang disamakan dengan Zoho Forms (Ceklis Pengawasan FR.UPS.2026.BST.01.01-00, Berita Acara FR.UPS.2026.BST.01.02-00, Matriks Potensi Kecurangan FR.UPS.2026.BST.01.03-00, Kode Etik & Deklarasi Ketidakberpihakan). Keempat form masuk sebagai **draf**; publish dari menu Form setelah dicek.

Perubahan database: migrasi aditif 009 (tabel baru `v2_forms`, `v2_form_versions`, `v2_form_submissions`) dan izin SELECT/INSERT/UPDATE/DELETE akun runtime hanya pada tiga tabel itu. Dokumen, file, akun dan histori lama tidak diubah. Service, container, mount, port dan DB tetap sama.

Keputusan pengguna (3 Nov 2026): **tidak ada smoke/data DUMMY di produksi**; form diuji langsung oleh pengguna. Pengaman yang tetap: backup DB+file baru, uji restore backup di laptop, image Linux/amd64 terverifikasi, health/preflight, dan rollback image otomatis bila gagal.

## Syarat

- Laptop tersambung ke jaringan NAS (akses `\\10.10.200.166\Container` dan terminal QTS/SSH NAS).
- Docker Desktop di laptop berjalan.
- Paket laptop: `edms-v2\release\app-update-2.1.8` (sudah berisi image, skrip dan SHA256SUMS).
- Aplikasi NAS sedang **berjalan** dengan image 2.1.4–2.1.7. Bila masih berhenti dari percobaan 2.1.7 (30 Okt), jalankan dulu `docker start edms-ups-app` dan pastikan aplikasi terbuka.

## Langkah

1. **Salin paket ke NAS**: salin folder `edms-v2\release\app-update-2.1.8` ke `\\10.10.200.166\Container\edms-release\app-update-2.1.8`.

2. **Backup + maintenance (di terminal NAS)**:
   ```
   cd /share/Container/edms-release/app-update-2.1.8 && sha256sum -c SHA256SUMS
   sh /share/Container/edms-release/app-update-2.1.8/nas-app-backup.sh --maintenance
   ```
   Catat path dari baris `BACKUP_READY_FOR_RESTORE /share/Container/edms-backups/edms-update-…`. Aplikasi sekarang STOPPED (maintenance). Batal tanpa update: `docker start edms-ups-app`.

3. **Uji restore backup (di laptop, PowerShell dari folder `edms-v2`)** — ganti `<NAMA>` dengan nama folder backup:
   ```
   .\scripts\verify-nas-backup.ps1 -Backup \\10.10.200.166\Container\edms-backups\<NAMA> -RestoreImage edms-ups:2.1.8
   ```
   Laporan ada di `release\restore-verification\DUMMY-RESTORE-…\result.json` (restore terisolasi di laptop, tidak menyentuh NAS).

4. **Buat gate (di laptop)**:
   ```
   .\scripts\prepare-app-update-gate-2.1.8.ps1 -Backup \\10.10.200.166\Container\edms-backups\<NAMA> -RestoreReport .\release\restore-verification\<RUN>\result.json
   ```
   Salin `release\app-update-2.1.8\update-restore-gate.json` ke folder paket yang sama di NAS.

5. **Update (di terminal NAS)**:
   ```
   sh /share/Container/edms-release/app-update-2.1.8/nas-app-update.sh /share/Container/edms-backups/<NAMA>
   ```
   Berhasil bila tercetak `FORMS_MIGRATION_PASS`, empat baris `dibuat (draf): …`, lalu `NAS_APP_UPDATE_PASS …`.

6. **Cek**: buka `http://10.10.200.166:3000`, login, menu **Form** → 4 form tampil sebagai Draf → Edit → Pratinjau → Publish bila sudah sesuai.

## Bila gagal

- Gagal sebelum `FORMS_MIGRATION_PASS`: tidak ada perubahan; aplikasi tetap STOPPED. Jalankan `docker start edms-ups-app` untuk kembali ke versi lama, lalu kirim output ke tim.
- Gagal setelah migrasi (health/preflight/seed): skrip otomatis mengembalikan image lama (`APP_UPDATE_REVERTING_IMAGE`). Tabel form baru tetap ada tetapi kosong dan tidak dipakai versi lama; data lama tidak tersentuh.
- Skrip dapat diulang dengan backup yang sama selama aplikasi tetap STOPPED. Seed tidak menimpa form yang sudah ada.

## Bukti laptop

Lihat `edms-v2\release\verification-2.1.8\result.json` (tes inti form, runtime Linux dalam image, migrasi 009 + izin runtime + seed pada MariaDB uji terisolasi).
