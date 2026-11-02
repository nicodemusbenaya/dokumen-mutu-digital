# EDMS v2.1.2 — status paket dan deployment NAS

Tanggal: 29 Oktober 2026  
Produksi saat pemeriksaan: `http://10.10.200.166:3000`, v2.1.1, database OK  
Status: paket tersinkron; backup dan apply produksi belum dijalankan.

## Bukti release

- Image `edms-ups:2.1.2`, Linux/amd64, ID `sha256:24b85585cb4bcd8095a582e85e8993c2aba937162412e956a7f63a1d17eb6695`.
- Tar SHA-256 `6fe0841fd1abcbc1b6c3abf8c69e4a15729802b5da4d0c0b9390407cbc5bf478`.
- Full release gate lulus pada `release/verification/DUMMY-8772bed1954e/result.json`: core 45/45, runtime Linux, MariaDB/file integration, ZIP partial-success/traversal, upload/revisi/konversi, UI, layout, dan UX.
- `npm audit --omit=dev` pada lockfile release: 0 info/low/moderate/high/critical.
- Package preflight lulus; image ID dan semua layer cocok dengan metadata release.
- Paket lokal `edms-v2/release/nas-update-6fe0841f` tersinkron ke `/share/Container/edms-release/nas-update-6fe0841f`; 27 file diverifikasi dengan SHA-256 setelah salin.

## Kondisi produksi

Health LAN terakhir: `ok=true`, `version=2.1.1`, `database=true`. Sampai status ini dibuat, sesi tidak menghentikan service, tidak mengambil backup baru, tidak mengubah database/master, tidak menjalankan migrasi, tidak mengirim file dokumen asli, dan tidak mengganti image.

Gate update belum dapat dimulai tanpa terminal NAS berotorisasi. SSH 22 dan 2222 tertutup; endpoint TLS Docker 2376 memerlukan sertifikat klien yang tidak tersedia pada Docker context laptop. Tool browser/komputer tidak dapat menginisialisasi runtime untuk terminal QTS. Paket sudah disiapkan agar tahap backup dapat dimulai dengan satu perintah dari terminal QTS/SSH NAS.

## Langkah lanjutan setelah akses terminal NAS tersedia

Jalankan di terminal NAS:

```sh
sh /share/Container/edms-release/nas-update-6fe0841f/nas-update-start-backup.sh
```

Skrip memeriksa checksum paket, image, health/inventory DB, dan baseline; lalu mengambil backup konsisten DB+file serta menghentikan hanya `edms-ups-app` sampai verifikasi restore selesai. Skrip tidak menerapkan migrasi. Setelah path backup baru muncul, salin/akses backup tersebut dari laptop, jalankan:

```powershell
.\scripts\verify-nas-backup.ps1 -Backup <path-backup-baru> -RehearseUpdate -UpdatePackage .\release\nas-update-6fe0841f
```

Apply hanya boleh diteruskan setelah verifier menulis `update-rehearsal-pass.json` yang cocok dengan checksum backup dan paket. Skrip apply menggunakan service lama, mempertahankan database/storage, memeriksa retensi record/hash, melakukan smoke DUMMY dengan cleanup selektif, dan mengembalikan service pada port yang sama.
