# Design — EDMS PLN UPS

World: identitas PLN yang sudah ditentukan pengguna; mode Operate. Ruang kerja dokumen internal, bukan halaman pemasaran. Sidebar putih, navigasi biru tua, area kerja netral terang, aksen biru muda dan kuning, register tabel padat dengan detail sebagai fokus. Tanpa ilustrasi/dekorasi yang menutupi pekerjaan.

Tokens: brand #007f9f; light #e6f5fa; yellow #f7d447; ink #173344; secondary #526875; background #f4f7fa; line #dce6eb. Font Inter lokal dengan fallback sans. Heading 28-34px, body 14-16px. Teks kontras dan state/fokus keyboard eksplisit.

Logo Danantara/PLN tampil berdampingan tanpa distorsi; nama produk Dokumen Mutu. Sidebar memuat Ringkasan, Daftar Dokumen, Upload & Impor, Histori Aktivitas. Daftar dengan pencarian/filter/pagination dan tindakan per baris. Detail memuat format, preview, versi serta form update. Upload progress per file/job, error eksplisit dan retry. Popup native dialog untuk warning converted Word, fokus dan Batal.

User telah menyetujui implementasi dan tema; lanjut code-first pada sesi ini tanpa menulis default workflow skill. Responsif desktop/tablet/mobile, motion minimal dan reduced-motion dihormati.

## Components

Tambahan pengelolaan 22 Oktober 2026 meneruskan dunia Operate dan komponen ruang kerja yang ada, tanpa mengganti identitas visual, logo, tipografi atau palet di atas. Catatan ini berdasarkan source `edms-v2/src/components/Management.tsx`, `Management.module.css`, `edms-v2/src/app/page.tsx` dan `docs/FITUR_PENGELOLAAN_V2.md`; bukan hasil verifikasi screenshot/browser atau deployment.

- Navigasi menambahkan Kelola Dokumen; Deteksi Duplikat mengikuti akses upload; Kelola Pengguna hanya untuk Admin Sistem. Semuanya memakai shell/sidebar, ikon SVG, penanda halaman aktif dan breadcrumb yang sama dengan permukaan sebelumnya.
- Kelola Dokumen mempertahankan panel putih dan register tabel padat. Filter berlabel mencakup pencarian, status Aktif/Diarsipkan/Sampah, jenis, bidang, kategori, format, tanggal dan urutan. Grid filter menyesuaikan lebar dengan kolom minimum 180px; tabel minimum 580px berada dalam pembungkus scroll horizontal agar informasi tidak dipotong pada layar sempit.
- Checkbox aksen brand berukuran 18px memilih dokumen individual atau halaman ini; toolbar terpisah garis tipis menampilkan jumlah pilihan, Pilih semua hasil dan Batal pilih. Semua hasil dibatasi 500 dokumen. Perubahan filter/halaman membersihkan pilihan dan aksi agar target tetap jelas. Toolbar membungkus; pada lebar hingga 760px jumlah pilihan mengambil satu baris penuh dan jarak filter dipadatkan.
- Aksi massal berada dekat jumlah pilihan: ZIP asli, arsip/aktifkan, hapus ke Sampah/pulihkan, dan perubahan kategori/bidang sesuai izin. Konfirmasi tampil inline, bukan dialog baru: panel kuning pucat (#fff6d3), sudut 12px, padding 20px (16px hingga 760px), penjelasan dampak, alasan wajib, Konfirmasi dan Batal. Hapus berarti Sampah yang dapat dipulihkan, bukan penghapusan permanen. Hasil berhasil/gagal ditampilkan per dokumen; ekspor menampilkan antrean/proses, kegagalan atau tautan unduh saat siap, disertai keterangan original-only dan masa tersedia 24 jam.
- Detail menambahkan panel Pengelolaan dokumen hanya saat `canEdit`: edit metadata, alasan perubahan, tombol simpan/batal serta arsip/aktifkan/hapus/pulihkan sesuai status. Bidang hanya dapat diubah Admin Sistem. Histori revisi tetap berupa bagian yang dapat dibuka; versi lama pada dokumen aktif menawarkan pemulihan dengan alasan dan penjelasan bahwa salinan lengkap diterbitkan sebagai versi baru, bukan menimpa histori.
- Deteksi Duplikat memakai pilihan metode SHA-256 atau kemungkinan pasangan berjudul sama. Kelompok dipisahkan garis tipis dengan jumlah dokumen sebagai heading, tautan detail dan subbaris versi/nama file; tersedia pagination dan pesan kosong. Pemeriksaan tidak menggabungkan atau menghapus otomatis.
- Kelola Pengguna memakai tabel nama/username, role/bidang, status dan tindakan Edit / reset password. Tombol Tambah user baru membuka form inline dalam panel yang sama: label eksplisit, role/status berupa select, password tidak ditampilkan dalam daftar, tombol Simpan akun/Batal dan pesan hasil. Tidak menambahkan identitas visual khusus untuk administrasi.

Loading/disabled, pesan kosong, error berperan alert dan hasil berperan status mengikuti pola ruang kerja yang ada. Perluasan berikutnya tetap memakai tombol primer/sekunder/teks dan form berlabel yang sama; jangan mengganti konfirmasi operasional ini dengan dekorasi atau menambah alur approval.
## Penyesuaian 23 Oktober 2026

Logo Danantara dan PLN memakai dua slot grid selebar sama, dengan object-fit contain dan rasio aset asli. PLN merupakan wordmark horizontal 2000x714, sehingga tidak lagi diberi kotak ikon selebar 31px. Di sidebar ponsel, ruang logo dibatasi agar nama produk tetap muat. Dropdown memakai tinggi minimal 44px, padding konsisten dan chevron SVG stroke 1.75/currentColor; label Metode pemeriksaan dan toolbar aksi memiliki batas lebar responsif.

Hapus biasa tetap berarti Sampah. Penambahan Hapus permanen khusus Admin hanya muncul pada status Sampah melalui aksi pilihan, dengan panel konfirmasi dampak, alasan, frasa ketik HAPUS PERMANEN, dan tombol merah. UI menjelaskan cadangan pemulihan/audit tetap tersimpan. Tidak menawarkan tombol Kosongkan semua Sampah. Semua catatan ini berdasarkan source; belum QA browser untuk perubahan terbaru.
## Kelola Master — 23 Oktober 2026

Menu Admin Kelola Master mengikuti panel dan tabel pengelolaan yang ada, dengan dropdown kelompok Kategori/folder, Bidang, Jenis dokumen; form inline tambah/edit; status aktif/nonaktif; nilai kanonis tetap dan nama tampilan dapat diubah. Upload & Impor memakai tiga dropdown berlabel dari master, jenis/bidang wajib dan Tanpa kategori opsional. Scope bidang penyusun mengikuti akun. Tidak menambah dependensi UI atau mengubah identitas visual. State loading, error/retry dan kosong memakai pola shell yang sama. Source selesai; QA browser terbaru masih tertahan.
