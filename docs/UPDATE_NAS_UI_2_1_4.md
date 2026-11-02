# Update UI File Explorer v2.1.4

Status akhir: deployment NAS lulus 30 Oktober 2026 pada `ui-update-2.1.4/attempt-20261030T005902Z-14581`. Health LAN terverifikasi `{ok:true,version:"2.1.4",database:true}`; container running/healthy, OOMKilled=false; preflight productionReady=true, storage/database/runtime OK dan 6 akun aktif. Receipt mengonfirmasi imageOnly=true, databaseMigration=false, newDataBackup=false. Pemeriksaan identitas image memakai RootFS.Layers karena Docker Desktop dan Docker NAS melaporkan jenis ID berbeda. Catatan persiapan di bawah adalah riwayat; operasi sudah selesai.

30 Oktober 2026. Perubahan: tombol Kembali ke folder induk, form Folder baru dibuka sesuai kebutuhan, tindakan folder dalam dialog native yang tetap masuk viewport dan dapat ditutup dengan Escape, serta tata letak folder pada ponsel. Tema dan fungsi folder dipertahankan.

Image Linux/amd64 `edms-ups:2.1.4` dibangun di laptop; gate `DUMMY-1105a0d420af` lulus 55 tes inti, integrasi MariaDB/file dummy, browser desktop/mobile, navigasi Kembali dan batas dialog. Pemeriksaan TypeScript dan detector desain lulus. Konfigurasi image-only telah diuji offline dengan konfigurasi NAS: hanya image service edms-app berubah.

Paket: `edms-v2/release/ui-update-2.1.4`, tujuan NAS `/share/Container/edms-release/ui-update-2.1.4`. Jalankan di terminal NAS:

```sh
sh /share/Container/edms-release/ui-update-2.1.4/nas-ui-update.sh
```

Permintaan eksplisit pengguna: tanpa backup baru. Skrip ini hanya merekreasi service aplikasi lama, tidak menjalankan migrasi schema, impor, restore, atau backup DB/storage. Image v2.1.3 tetap tersedia untuk pemulihan runtime. Skrip memverifikasi checksum dan ID image, mengubah hanya image Compose, memeriksa health versi 2.1.4 dan preflight, lalu menyimpan konfigurasi runtime. Kegagalan sebelum selesai mencoba mengembalikan image lama. Konfigurasi yang memuat environment disimpan privat dengan umask 077; jangan membagikan file before.json/next.json.

Berhasil hanya bila tercetak `NAS_UI_UPDATE_PASS` dan health LAN terverifikasi 2.1.4. Pada saat penulisan catatan ini, paket disiapkan; deployment produksi belum dikonfirmasi.
