# Panduan Target Pembaruan Dokumen — EDMS v2

Keputusan 22 Oktober 2026 versi 2.1. Ini alur yang akan dibuat, bukan klaim fitur source lama. Lihat [plan.md](plan.md).

## Mengubah dokumen

1. Login dengan hak upload/update pada dokumen terkait.
2. Buka Daftar Dokumen dan detail dokumen.
3. Download Word asli atau Excel. Untuk PDF-only, minta konversi ke Word dan tunggu selesai.
4. Sebelum download Word hasil konversi PDF, baca popup: "Dokumen ini merupakan hasil konversi PDF. Tata letak, tabel, dan isi mungkin berbeda dari dokumen asli. Periksa kembali sebelum digunakan." Pilih Batal atau Lanjutkan Download. Batal tidak memulai download; Word asli tidak mendapat peringatan ini.
5. Edit lokal dan periksa hasil, terutama tabel, layout dan halaman pengesahan. PDF scan tidak dijanjikan menghasilkan teks editable; keterbatasan hasil harus ditampilkan.
6. Pilih Update Dokumen, upload revisi dan isi ringkasan perubahan. Periksa metadata/nomor revisi; PDF lama tidak otomatis ikut menjadi pasangan revisi baru.
7. Setelah validasi dan penyimpanan berhasil, versi baru langsung Aktif. Tidak ada review/approval bertingkat. Versi sebelumnya tetap di Histori.

Jika upload gagal, versi aktif lama tidak berubah. Jika pengguna lain sudah menerbitkan revisi baru, periksa konflik sebelum mengirim ulang. Kegagalan konversi PDF tidak menghapus sumber valid yang tersimpan; status/retry ditampilkan. Penggantian versi tidak menghapus file lama pada histori aplikasi baru.

## Format, asal dan izin

PDF resmi/original dan hasil konversi diberi label berbeda. Word hasil PDF adalah turunan dari file/versi tertentu, bukan jaminan dokumen identik. Download sumber/arsip mengikuti hak akses. Riwayat mencatat pengguna, waktu, versi, ringkasan dan file; aplikasi tidak menambahkan tanda tangan atau mengklaim pengesahan baru.

## Impor dan pengujian

Upload ZIP/individual memuat progres dan log per file; kegagalan sebagian tidak membatalkan file lain. Kandidat pasangan ambigu diperiksa metadatanya terlebih dahulu. Retry tidak menggandakan file.

Selama development/UAT/smoke, gunakan hanya dummy PDF/DOCX/XLSX/ZIP berlabel DUMMY/TEST. Jangan upload dokumen asli untuk menguji fitur. Data dummy dibersihkan selektif setelah uji.

Saat transisi nanti, data dokumen aplikasi lama dibersihkan setelah backup, sementara akun/config dipertahankan. Impor operasional dimulai dari Dokumen Final setelah aplikasi siap; bukan bagian pekerjaan dokumentasi sekarang.
