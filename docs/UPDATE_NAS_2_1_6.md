# Bidang manual per file dan Lewati dari impor

30 Oktober 2026. Pengguna menetapkan bahwa upload massal tetap menahan konflik bidang. Khusus item gagal/perlu pemeriksaan, pilihan manual berlaku untuk file itu; upload satu file dapat memilih bidang manual. Pilihan per file tidak mengubah bidang folder atau dokumen lain dan tetap dibatasi RBAC. Pemasangan format ke dokumen existing mempertahankan bidang/folder/versi tujuan; expectedVersion/lockVersion tetap diperiksa saat publikasi. Pemilihan manual dan penyelesaian item diaudit. Editor tetap dibatasi bidang akun dan akses foldernya; Super user dapat menangani pengecualian bidang dokumen dalam folder.

Tambahan permintaan pengguna: item gagal atau needs_review dapat dilewati dari impor. Aksi skip hanya untuk job import yang sudah terminal, item belum diterbitkan, dan pemilik job/Super user dengan hak edit. Item mendapat state skipped dengan error asli tetap tersimpan untuk log/CSV dan audit SKIP_IMPORT_ITEM. Tidak menghapus dokumen atau original; job selesai bila semua item sukses/duplikat/dilewati. Retry tidak membuka item skipped dan tidak menggandakan item sukses. Retry, resolve dan skip mengunci row job untuk mencegah perubahan bersamaan dengan antrean. Tidak ada perubahan schema (state sudah VARCHAR).

Paket image-only 2.1.6 untuk NAS 2.1.4/2.1.5: `/share/Container/edms-release/app-update-2.1.6`. Mempertahankan DB/storage/mount/port/service, tanpa backup data baru atau migrasi schema. Eksekusi di terminal NAS:

```sh
sh /share/Container/edms-release/app-update-2.1.6/nas-app-update.sh
```

Gate final `DUMMY-596a76e9d5ec` lulus pada image Linux/amd64: 56 tes inti, integrasi dummy bidang manual per file, ZIP massal tetap menahan konflik, pairing mempertahankan bidang/folder/versi tujuan, item sukses ditolak untuk skip, item job lain ditolak, job berjalan ditolak, skip idempoten, status done setelah seluruh kegagalan dilewati, dan retry tidak menggandakan atau membuka kembali skipped. Browser menguji checkbox manual hanya untuk single-file, Lewati menjadi Dilewati/Selesai, serta UI/layout/UX desktop/mobile. Pemeriksaan TypeScript dan detector UI lulus. Konfigurasi image-only diuji offline dengan konfigurasi NAS 2.1.5.

Status: paket disiapkan dan disinkronkan ke NAS; deployment produksi belum dikonfirmasi. Gunakan Perbaiki identitas/pasangkan format untuk memilih bidang khusus file gagal, atau Lewati dari impor untuk mengecualikannya tanpa menghapus dokumen yang sudah tersimpan. Pilihan pada satu item tidak otomatis menerbitkan item lain yang masih konflik.
