# Perbaikan pemakaian ulang kategori/folder terhapus

30 Oktober 2026. Penyebab: penghapusan kategori akar menonaktifkan master kategori dan memberi folder penanda is_deleted. Pengaktifan master secara manual tidak menghapus penanda folder. Retry job juga melewati item needs_review dengan konflik folder.

Versi 2.1.5 memakai ulang node folder terhapus hanya jika kosong, memeriksa izin bidang, mengaktifkan master kategori terkait jika diperlukan, dan mencatat REUSE_DELETED_FOLDER dalam transaksi publikasi. Hanya path yang sedang dipakai diaktifkan; kategori yang dinonaktifkan secara eksplisit dengan folder aktif tetap ditolak. Folder berisi dokumen atau anak aktif tidak dipulihkan otomatis. Riwayat/identitas node lama tetap dipertahankan. Retry memeriksa ulang hanya konflik kategori nonaktif/folder terhapus untuk upload baru; item sukses dan konflik versi tetap tidak dibuka ulang otomatis.

Release Linux/amd64 2.1.5 lulus `DUMMY-e7a924433ab3`: 56 tes inti, integrasi dummy termasuk kategori nonaktif karena dihapus, master aktif tetapi folder terhapus, subfolder, akses Editor lintas bidang ditolak, serta retry tanpa duplikasi; browser/UI/layout/UX juga lulus. Build pertama terputus karena ECONNRESET npm, build terakhir dan seluruh gate lulus.

Paket `release/app-update-2.1.5` untuk `/share/Container/edms-release/app-update-2.1.5`. Update image-only dari 2.1.4 dengan konfigurasi service/mount/DB yang sama; tidak menjalankan migrasi schema, restore, atau backup data baru. Tetap memakai pola update tanpa backup baru yang diminta pengguna pada sesi ini. Periksa checksum/layer image, health versi 2.1.5 dan preflight; kegagalan mencoba kembali ke image 2.1.4.

```sh
sh /share/Container/edms-release/app-update-2.1.5/nas-app-update.sh
```

Status saat catatan ini dibuat: paket disiapkan; deployment belum dikonfirmasi. Setelah deployment lulus, pengguna dapat memilih Coba lagi pada job impor lama agar file yang sudah sukses tidak diunggah ulang.
