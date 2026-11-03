# Update NAS 2.1.9 — Form Zoho (read-only)

Isi rilis: menu **Form** sekarang hanya **menampilkan entri dari Zoho Forms**. Entri dikirim Zoho lewat webhook dan tampil dalam hitungan detik. Builder, link isi publik (`/f/...`), dan isi form di EDMS dihapus. Untuk 4 form FR.UPS/Kode Etik tersedia: daftar entri, detail, Download Excel, dan Cetak/Simpan PDF per entri. Super user dapat menambah form Zoho lain (tombol **Tambah form**) dan mengimpor jawaban lama dari CSV Export Zoho (tombol **Impor entri lama**). Pemasangan webhook di Zoho dijelaskan di [FORM_ZOHO_WEBHOOK.md](FORM_ZOHO_WEBHOOK.md).

Perubahan database (migrasi 010):
- Tabel baru `v2_zoho_forms` (4 form) dan `v2_zoho_entries`, plus izin SELECT/INSERT/UPDATE/DELETE akun runtime hanya pada dua tabel itu.
- **Tabel form builder 2.1.8 dihapus**: `v2_forms`, `v2_form_versions`, `v2_form_submissions`, termasuk jawaban yang pernah diisi lewat EDMS. Ini keputusan pengguna (3 Nov 2026). Jumlah baris yang dihapus dicetak di baris `ZOHO_MIGRATION_PASS`, dan isinya tetap ada di backup langkah 2.
- Dokumen, file, akun, master dan histori aktivitas tidak diubah. Service, container, mount, port dan DB tetap sama.

## Syarat

- Laptop tersambung ke jaringan NAS (akses `\\10.10.200.166\Container` dan terminal QTS/SSH NAS).
- Docker Desktop di laptop berjalan.
- Paket laptop: `edms-v2\release\app-update-2.1.9` (berisi image, skrip dan SHA256SUMS).
- Aplikasi NAS sedang **berjalan** dengan image 2.1.4–2.1.8.

## Langkah

1. **Salin paket ke NAS**: salin folder `edms-v2\release\app-update-2.1.9` ke `\\10.10.200.166\Container\edms-release\app-update-2.1.9`.

2. **Backup + maintenance (di terminal NAS)**:
   ```
   cd /share/Container/edms-release/app-update-2.1.9 && sha256sum -c SHA256SUMS
   sh /share/Container/edms-release/app-update-2.1.9/nas-app-backup.sh --maintenance
   ```
   Catat path dari baris `BACKUP_READY_FOR_RESTORE /share/Container/edms-backups/edms-update-…`. Aplikasi sekarang STOPPED. Untuk batal tanpa update: `docker start edms-ups-app`.

3. **Uji restore backup (di laptop, PowerShell dari folder `edms-v2`)**. Ganti `<NAMA>` dengan nama folder backup:
   ```
   .\scripts\verify-nas-backup.ps1 -Backup \\10.10.200.166\Container\edms-backups\<NAMA> -RestoreImage edms-ups:2.1.9
   ```

4. **Buat gate (di laptop)**:
   ```
   .\scripts\prepare-app-update-gate-2.1.9.ps1 -Backup \\10.10.200.166\Container\edms-backups\<NAMA> -RestoreReport .\release\restore-verification\<RUN>\result.json
   ```
   Salin `release\app-update-2.1.9\update-restore-gate.json` ke folder paket yang sama di NAS.

5. **Update (di terminal NAS)**:
   ```
   sh /share/Container/edms-release/app-update-2.1.9/nas-app-update.sh /share/Container/edms-backups/<NAMA>
   ```
   Update berhasil bila tercetak `ZOHO_MIGRATION_PASS …` lalu `NAS_APP_UPDATE_PASS …`.

6. **Cek**: buka EDMS, login sebagai Super user, menu **Form**. Harus tampil 4 form dengan tanda "Webhook belum aktif". Lanjutkan pemasangan webhook sesuai [FORM_ZOHO_WEBHOOK.md](FORM_ZOHO_WEBHOOK.md).

## Bila gagal

- **Gagal sebelum `ZOHO_MIGRATION_PASS`**: tidak ada perubahan dan aplikasi tetap STOPPED. Jalankan `docker start edms-ups-app` untuk kembali ke versi lama.
- **Gagal setelah migrasi** (health/preflight): skrip otomatis mengembalikan image lama (`APP_UPDATE_REVERTING_IMAGE`). Menu lain tetap normal. Menu Form versi lama tidak berfungsi karena tabelnya sudah dihapus. Jawaban form lama hanya bisa dipulihkan dari backup langkah 2.
- Skrip dapat diulang dengan backup yang sama selama aplikasi tetap STOPPED. Migrasi 010 aman diulang.

## Bukti laptop

Lihat `edms-v2\release\verification-2.1.9\result.json`.
