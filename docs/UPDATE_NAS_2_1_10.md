# Update NAS 2.1.10 — Hapus data Form & impor CSV Zoho

Isi rilis (menu **Form**, khusus Super user):
- **Hapus entri**: satu entri, entri per periode (cek jumlah, ketik `HAPUS`), atau form beserta seluruh entrinya. Semua tercatat di Histori Aktivitas.
- **Impor CSV Zoho** mendukung header dua baris (matriks dan subform).
- URL webhook di panel Super user langsung memakai alamat publik Tailscale Funnel.

Perubahan database: **tidak ada** (update image saja). Service, container, mount, port dan DB tetap sama. Panduan pemakaian: [FORM_ZOHO_WEBHOOK.md](FORM_ZOHO_WEBHOOK.md).

## Langkah (sama dengan 2.1.9)

1. Salin `edms-v2\release\app-update-2.1.10` ke `/share/Container/edms-release/app-update-2.1.10` (scp lewat SSH port 222, atau share `Container`).
2. Terminal NAS:
   ```
   cd /share/Container/edms-release/app-update-2.1.10 && sha256sum -c SHA256SUMS
   (trap "" HUP; exec sh ./nas-app-backup.sh --maintenance) > backup-run.log 2>&1 < /dev/null &
   ```
   Tunggu `BACKUP_READY_FOR_RESTORE …` di `backup-run.log` (±20 menit). Menjalankan dengan `trap "" HUP` membuat backup tetap jalan walau SSH terputus.
3. Laptop: salin folder backup ke folder lokal **di luar OneDrive** (`scp -P 222 -r admin@10.10.200.166:/share/Container/edms-backups/<NAMA> <folder-lokal>`), lalu dari salinan kode di luar OneDrive (`git worktree`) jalankan:
   ```
   .\scripts\verify-nas-backup.ps1 -Backup <folder-lokal>\<NAMA> -RestoreImage edms-ups:2.1.10
   .\scripts\prepare-app-update-gate-2.1.10.ps1 -Backup <folder-lokal>\<NAMA> -RestoreReport <result.json>
   ```
   Salin `update-restore-gate.json` ke folder paket di NAS. Hapus salinan backup lokal setelahnya.
4. Terminal NAS:
   ```
   cd /share/Container/edms-release/app-update-2.1.10 && (trap "" HUP; exec sh ./nas-app-update.sh /share/Container/edms-backups/<NAMA>) > update-run.log 2>&1 < /dev/null &
   ```
   Berhasil bila `update-run.log` berisi `NAS_APP_UPDATE_PASS`.

## Bila gagal

- Gagal sebelum container direkreasi: tidak ada perubahan; `docker start edms-ups-app` mengembalikan versi lama.
- Gagal sesudahnya (health/preflight): skrip otomatis kembali ke image 2.1.9 (`APP_UPDATE_REVERTING_IMAGE`). Tidak ada perubahan skema yang perlu dipulihkan.
