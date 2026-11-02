# Panduan Pembaruan Dokumen Mutu

**Aplikasi:** EDMS PLN UP Sertifikasi  
**Tanggal penyusunan:** 19 Oktober 2026  
**Sasaran:** Penyusun Dokumen, Tim Mutu, Manager Bidang, Pimpinan Unit, dan Admin Sistem  
**Dasar:** Implementasi kode aplikasi yang diperiksa pada tanggal penyusunan; panduan belum diverifikasi melalui pengujian langsung seluruh alur di browser.

## 1. Tujuan dan cakupan

Panduan ini menjelaskan fitur untuk membuat dan memperbarui isi dokumen, mencatat perubahan, menyimpan draft, serta mengajukan dokumen sampai disahkan. Jenis dokumen mencakup Manual Mutu, SOP/Prosedur, Instruksi Kerja, dan Formulir Kerja sesuai pilihan yang tersedia di aplikasi.

Isi yang dapat diedit dikelola sebagai bagian atau klausul terstruktur. Berkas sumber yang dilampirkan merupakan berkas tersendiri: mengganti berkas sumber tidak otomatis sama dengan memperbarui isi klausul.

## 2. Istilah yang perlu dipahami

| Istilah | Arti dalam aplikasi |
|---|---|
| Draft | Dokumen yang sedang disusun atau dikembalikan untuk diperbaiki. |
| Review | Dokumen sedang ditinjau Tim Mutu. |
| Menunggu Approval | Dokumen menunggu persetujuan Manager Bidang atau Pimpinan Unit. Tahap dibedakan melalui riwayat approval meskipun label statusnya sama. |
| Aktif | Dokumen sudah memperoleh pengesahan final. |
| Obsolete | Penanda versi lama yang telah digantikan. |
| Seksi/klausul | Bagian isi dokumen, misalnya Tujuan, Ruang Lingkup, dan Prosedur. |
| Berkas sumber | File asli, misalnya Word, PDF, atau Excel, yang disimpan bersama dokumen. |
| Riwayat Perubahan | Tabel uraian perubahan yang disusun di editor. |
| Riwayat Versi | Daftar versi dan metadata pengarsipannya di halaman detail dokumen. |

**Menyimpan draft tidak menerbitkan dokumen.** Dokumen baru berlaku sebagai Aktif setelah pengesahan final.

## 3. Peran pengguna

| Peran | Kegiatan dalam pembaruan dokumen |
|---|---|
| Penyusun Dokumen | Membuat dokumen, mengedit draft miliknya, memperbaiki hasil review, membuka revisi dokumen aktif miliknya, dan mengajukan review. |
| Tim Mutu | Meninjau isi, memberi catatan, menyetujui tahap review, atau mengembalikan dokumen ke Draft. |
| Manager Bidang | Memberi persetujuan tahap Manager atau mengembalikan dokumen untuk diperbaiki. |
| Pimpinan Unit | Memberi pengesahan final atau mengembalikan dokumen untuk diperbaiki. |
| Admin Sistem | Mengelola dokumen dan template serta memiliki hak persetujuan lintas tahap dalam implementasi saat ini. |

Tombol yang muncul mengikuti peran dan status dokumen. Pada halaman detail, tombol Edit Dokumen tersedia untuk draft bagi pengguna yang berhak. Admin memiliki kewenangan edit lebih luas di server; untuk pekerjaan rutin tetap gunakan siklus revisi agar perubahan melalui peninjauan.

## 4. Memilih cara pembaruan

| Kebutuhan | Cara yang digunakan |
|---|---|
| Memperbaiki draft yang belum terbit | Buka dokumen, lalu pilih **Edit Dokumen**. |
| Mengubah dokumen yang sudah Aktif | Pilih **Ajukan Revisi**, lalu edit setelah status menjadi Draft. |
| Menanggapi penolakan reviewer/approver | Baca catatan, edit draft, lalu ajukan review kembali. |
| Mengambil isi dari Word/PDF | Gunakan **Impor Word / PDF**, periksa hasil, lalu **Terapkan ke Editor**. |
| Memperbarui file asli yang disimpan | Gunakan **Ganti File** pada panel **Berkas Sumber**. |
| Membuat dokumen baru dengan format yang sudah ada | Gunakan pustaka **Template Dokumen** atau **Buat Dokumen dari Template Ini**. |

## 5. Langkah memperbarui draft

1. Login menggunakan akun yang memiliki hak edit.
2. Buka daftar dokumen dan pilih dokumen yang akan diperbarui.
3. Pastikan statusnya **Draft**, lalu pilih **Edit Dokumen**.
4. Periksa identitas dokumen: judul, bidang, jenis, dan siklus review.
5. Pilih klausul pada panel navigasi, lalu ubah isinya.
6. Perbarui tabel, referensi, dan urutan bagian jika diperlukan.
7. Buka **Riwayat Perubahan** dan catat perubahan yang relevan.
8. Pilih **Simpan Perubahan** atau **Simpan Dokumen**. Pastikan muncul pemberitahuan berhasil.
9. Kembali ke detail dokumen dan buka kembali isinya untuk memastikan perubahan tersimpan.
10. Jika sudah lengkap, pilih **Ajukan Review** dari halaman detail.

Kode dokumen tampil dalam identitas editor, tetapi endpoint pembaruan dokumen yang ada tidak memperbarui kode. Jangan mengandalkan pengeditan kolom tersebut untuk mengganti kode dokumen lama; koordinasikan perubahan identitas dengan Admin.

## 6. Langkah merevisi dokumen Aktif

1. Buka detail dokumen berstatus **Aktif**.
2. Pilih **Ajukan Revisi**.
3. Baca dan konfirmasikan pembukaan siklus revisi.
4. Dokumen berubah menjadi **Draft**. Pilih **Edit Dokumen**.
5. Lakukan perubahan dan isi riwayat perubahan.
6. Simpan, periksa kembali hasilnya, kemudian pilih **Ajukan Review**.
7. Dokumen melalui review Tim Mutu, approval Manager, dan pengesahan Pimpinan.
8. Setelah pengesahan final, dokumen kembali **Aktif**. Untuk dokumen yang pernah disahkan, versi naik, misalnya **1.0 → 2.0 → 3.0**.

**Perilaku saat ini:** pembukaan revisi mengubah dokumen Aktif yang sama menjadi Draft. Aplikasi belum memisahkan versi berlaku dan draft revisi sebagai dua salinan lengkap. Riwayat versi juga belum menyediakan snapshot lengkap isi versi lama. Sebelum memulai revisi, simpan PDF versi yang sudah disahkan melalui prosedur arsip unit.

## 7. Daftar fitur editor dan fungsinya

### 7.1 Identitas dokumen

| Fitur | Fungsi dan penggunaan |
|---|---|
| Judul | Menjelaskan nama atau pokok dokumen. |
| Bidang | Menentukan bidang pemilik dokumen. |
| Jenis Dokumen | Menentukan kerangka bagian yang sesuai. Periksa kembali isi dan urutan setelah mengganti jenis. |
| Siklus Review | Mencatat interval peninjauan dokumen. Pengisian nilai ini belum berarti pengingat otomatis tersedia. |
| Muat Template Baku | Memuat kerangka/isian baku sesuai jenis dokumen. Periksa dampaknya pada isi yang sudah ada sebelum menyimpan. |

### 7.2 Pengeditan isi

| Fitur | Fungsi |
|---|---|
| Teks tebal, miring, dan coret | Memberi penekanan atau format pada teks yang dipilih. |
| Heading H2/H3 | Membentuk subjudul di dalam bagian. |
| Daftar berpoin dan bernomor | Menyusun rincian atau langkah kerja. |
| Kutipan dan garis pemisah | Memisahkan atau menonjolkan isi tertentu. |
| Sisipkan tabel | Menambahkan tabel ke isi dokumen. |
| Tambah/hapus baris dan kolom | Menyesuaikan tabel dengan kebutuhan isi. |
| Undo/Redo | Membatalkan atau mengulangi tindakan pengeditan yang tersedia dalam sesi editor. Bukan pemulihan versi terbit. |

Kontrol dapat berbeda menurut jenis bagian dan editor yang digunakan, terutama untuk formulir atau tabel hasil impor.

### 7.3 Pengelolaan bagian

| Fitur | Fungsi |
|---|---|
| Navigasi Seksi Klausul Dokumen | Berpindah langsung ke bagian yang akan diedit. |
| Tambah / Tambah Seksi Baru | Menambahkan bagian khusus, misalnya Diagram Alir atau Lampiran. |
| Geser bagian / tombol naik-turun | Mengatur urutan bagian; label bagian mengikuti pengaturan penomoran aplikasi. |
| Hapus seksi | Menghapus bagian yang menyediakan kontrol hapus. Periksa isi sebelum menghapus. |
| Simpan & Lanjut | Meminta penyimpanan lalu berpindah ke bagian berikutnya. Tetap periksa pemberitahuan hasil simpan. |
| Simpan Seluruh Dokumen | Meminta penyimpanan isi dokumen dari area editor. |

### 7.4 Alat bantu

| Fitur | Fungsi | Hal yang perlu diperiksa |
|---|---|---|
| Kelengkapan Klausul | Menampilkan persentase bagian yang terisi. | Bukan penilaian mutu atau kepatuhan isi. |
| Cari & Ganti | Mencari istilah lintas bagian dan mengganti seluruh kecocokan. | Tinjau hasil penggantian agar istilah dalam konteks berbeda tidak ikut berubah secara keliru. |
| Pratinjau Kertas | Menampilkan pratinjau A4 berdampingan dengan editor. | Periksa juga PDF hasil akhir karena pratinjau belum menjamin tata letak PDF identik. |
| Layar Penuh | Memperluas ruang kerja dan mengurangi distraksi. | Keluar menggunakan kontrol yang tersedia. |
| Klausul Standar | Menyediakan pilihan isi baku untuk bagian tertentu. | Sesuaikan dengan proses nyata unit; teks baku tetap perlu ditinjau. |

## 8. Menyimpan dan memulihkan draft

### 8.1 Simpan manual dan otomatis

Gunakan tombol **Simpan Dokumen** atau **Simpan Perubahan** untuk meminta penyimpanan manual. Autosave dijadwalkan sekitar empat detik setelah perubahan yang memicu mekanisme tersebut dan pengguna berhenti mengetik.

| Indikator | Makna yang dimaksudkan aplikasi |
|---|---|
| Draf Belum Disimpan | Terdapat perubahan yang belum dikonfirmasi tersimpan. |
| Menyimpan... | Permintaan penyimpanan sedang berlangsung. |
| Tersimpan | Editor menampilkan status selesai menyimpan. |
| Tersimpan Lokal | Editor menandai kegagalan simpan atau kondisi koneksi; tersedia mekanisme cadangan browser. |

**Batasan yang diketahui:** indikator autosave dapat kembali menampilkan Tersimpan meskipun permintaan simpan gagal. Cadangan lokal juga belum menjadi jaminan bahwa semua perubahan terakhir berhasil dicadangkan. Untuk perubahan penting, lakukan simpan manual, pastikan pemberitahuan berhasil, lalu periksa isi dari halaman detail.

### 8.2 Pemulihan draft lokal

Jika editor menemukan cadangan, akan muncul pemberitahuan **Ditemukan Draf Lokal Browser**.

1. Pilih pemulihan jika ingin mengembalikan isi cadangan ke editor.
2. Periksa kembali isi yang dipulihkan.
3. Simpan ke server dan pastikan hasilnya berhasil.
4. Pilih **Abaikan** hanya jika cadangan tidak diperlukan.

Cadangan berada di browser yang digunakan. Jangan menganggapnya sebagai backup server atau cadangan yang dapat diakses dari perangkat lain.

### 8.3 Jika terjadi konflik penyimpanan

Konflik berarti versi server berbeda dari versi yang sedang diedit. Salin terlebih dahulu perubahan penting ke catatan sementara, koordinasikan dengan penyunting lain, lalu muat ulang dokumen dan terapkan perubahan pada isi terbaru. Hindari menekan simpan berulang tanpa memeriksa versi server: penanganan konflik saat ini belum menyediakan penggabungan isi otomatis.

## 9. Impor Word/PDF dan berkas sumber

### 9.1 Impor isi ke editor

1. Pilih **Impor Word / PDF**.
2. Unggah berkas `.docx` atau `.pdf`.
3. Tunggu pembacaan dan periksa hasil yang ditampilkan.
4. Pilih **Terapkan ke Editor**.
5. Periksa identitas, seluruh klausul, tabel, dan urutan bagian.
6. Simpan secara manual dan periksa kembali hasilnya.

Hasil impor digabungkan ke bagian yang ada; bagian dengan kunci yang sama dapat tertimpa. Judul, kode dalam editor, dan jenis juga dapat berubah mengikuti hasil deteksi. Pemformatan atau pengenalan isi dapat berbeda dari file asli. PDF hasil pindai tidak dijamin dapat diekstrak karena fitur OCR belum dipastikan tersedia.

### 9.2 Unduh dan Ganti File

Panel **Berkas Sumber** menyediakan unduh dan penggantian file untuk dokumen yang memiliki berkas sumber. Gunakan **Unduh** untuk mengambil file asli dan **Ganti File** untuk mengganti berkas yang disimpan.

**Ganti File berbeda dari Impor Word / PDF.** Jangan menganggap isi klausul ikut diperbarui setelah mengganti file. Jika file dan isi editor sama-sama perlu berubah, lakukan masing-masing langkah dan periksa kesesuaiannya.

Untuk format yang tidak didukung editor teks, aplikasi dapat menyimpan berkas apa adanya. Penyuntingan isi berkas tersebut dilakukan menggunakan aplikasi yang sesuai, kemudian berkas penggantinya diunggah kembali.

## 10. Referensi dan template

### 10.1 Referensi standar

Panel **Referensi Standar** digunakan untuk menautkan dokumen ke master referensi. Tombol **Sisipkan Referensi Standar** pada bagian tertentu membantu memilih dan memasukkan referensi ke isi bagian.

Periksa nomor, judul, dan kesesuaian referensi setelah penyisipan. Perubahan isi atau edisi standar tetap memerlukan peninjauan penyusun; tautan referensi bukan jaminan bahwa isi dokumen otomatis mengikuti standar terbaru. Pengelolaan master referensi dilakukan oleh Admin.

### 10.2 Dokumen dari template

Pengguna yang memiliki hak membuat dokumen dapat membuka **Template Dokumen** atau memilih **Buat Dokumen dari Template Ini** pada detail template. Salinan dibuat sebagai dokumen baru berstatus Draft, versi 1.0, dengan kode baru yang tidak boleh duplikat.

Isi, susunan bagian, referensi, dan media template disalin. Riwayat approval tidak diwariskan. Dokumen baru perlu diperiksa dan diajukan melalui workflow sendiri. Membuat salinan dari template bukan cara merevisi identitas dokumen yang sudah ada.

## 11. Mencatat riwayat perubahan

Panel **Riwayat Perubahan** menyediakan tabel dengan kolom nomor, tanggal, halaman/bagian, uraian sebelum diubah, uraian perubahan, dan revisi.

| Fitur | Fungsi |
|---|---|
| Tambah Baris Manual | Mencatat alasan dan rincian perubahan secara manual. |
| Deteksi & Sinkronkan Auto Diff | Membandingkan teks bagian awal yang dimuat di editor dengan teks saat ini, kemudian membantu mengisi ringkasan perubahan. |
| Edit/hapus baris | Menyesuaikan catatan di draft. Hindari menghapus riwayat yang masih dibutuhkan. |

Contoh catatan yang membantu reviewer: **“Bagian Prosedur: batas waktu pemeriksaan diubah dari 5 menjadi 3 hari kerja untuk menyesuaikan alur layanan.”**

Auto Diff bekerja pada perbandingan teks per bagian dalam konteks editor. Ini belum merupakan perbandingan lengkap antarversi terbit dan tidak menjamin perubahan format, gambar, atau struktur tabel terdeteksi. Lengkapi perubahan tersebut secara manual.

## 12. Pengajuan, review, dan pengesahan

Alur utama:

```text
Draft → Review Tim Mutu → Approval Manager → Pengesahan Pimpinan → Aktif
                   Penolakan pada salah satu tahap → Draft
```

### Penyusun

1. Simpan semua perubahan dan periksa hasilnya.
2. Buka detail dokumen, lalu pilih **Ajukan Review**.
3. Jika muncul pesan kelengkapan, perbaiki bagian yang diminta dan ajukan kembali.

Validasi server saat ini memeriksa keberadaan isi. Untuk SOP/Prosedur dan Instruksi Kerja, bagian Tujuan wajib terisi. Indikator kelengkapan tidak menggantikan pemeriksaan seluruh bagian wajib oleh penyusun.

### Reviewer dan approver

1. Buka dokumen pada antrean approval atau halaman detail.
2. Pilih **Review & Tinjau Dokumen** atau **Berikan Approval**, sesuai tahap.
3. Periksa isi, referensi, dan riwayat perubahan.
4. Masukkan catatan dan gunakan area tanda tangan sesuai kebutuhan tahap.
5. Pilih persetujuan untuk meneruskan proses atau penolakan untuk mengembalikan dokumen ke Draft.

Penyusun membaca catatan penolakan, memperbaiki draft, lalu mengajukan review kembali. Dalam implementasi saat ini, penolakan membuka kembali siklus peninjauan.

### Setelah pengesahan

Pastikan status sudah Aktif dan versi sesuai. Pilih **Generate PDF**, lalu periksa kop, isi, tabel, halaman, dan tanda tangan sebelum mendistribusikan dokumen.

## 13. Pemeriksaan sebelum mengajukan review

- [ ] Identitas, jenis, dan bidang sudah benar.
- [ ] Seluruh bagian yang diwajibkan prosedur unit telah diisi dan ditinjau.
- [ ] Tabel, istilah, gambar, dan urutan bagian sudah sesuai.
- [ ] Referensi sesuai dan masih relevan.
- [ ] Riwayat perubahan menjelaskan perubahan penting.
- [ ] Berkas sumber sesuai dengan isi editor bila keduanya dipelihara.
- [ ] Simpan manual berhasil dan isi sudah diperiksa kembali.
- [ ] Pratinjau atau PDF telah diperiksa sesuai kebutuhan.

## 14. Masalah yang sering ditemui

| Kondisi | Langkah pengguna |
|---|---|
| Tombol Edit Dokumen tidak muncul | Periksa status Draft, akun penyusun, dan hak akses. Hubungi Admin jika kepemilikan tidak sesuai. |
| Dokumen Aktif ingin diubah | Gunakan Ajukan Revisi dan lanjutkan setelah status menjadi Draft. |
| Dokumen dikembalikan | Baca catatan reviewer/approver, perbaiki, simpan, dan ajukan review ulang. |
| Isi hasil impor tidak rapi | Koreksi klausul dan tabel; bandingkan dengan file asli sebelum menyimpan. |
| Perubahan tidak terlihat setelah Ganti File | Periksa isi klausul secara terpisah; gunakan impor atau edit untuk memperbarui isi editor. |
| Indikator Tersimpan tetapi isi belum berubah | Simpan manual, periksa pesan hasil, lalu buka detail dokumen. Jangan menutup draft sebelum menyalin perubahan penting jika masih gagal. |
| Konflik saat simpan | Amankan perubahan sementara, koordinasikan, dan muat ulang versi server sebelum menerapkan ulang perubahan. |
| Ingin membuka isi versi lama | Riwayat Versi saat ini menyimpan metadata; gunakan arsip PDF yang sudah disimpan unit. |

## 15. Batasan versi aplikasi yang perlu diketahui

Fitur berikut belum boleh dianggap tersedia atau lengkap: penyuntingan bersama secara langsung, penggabungan konflik otomatis, pemulihan isi lengkap versi lama, pemisahan versi berlaku dari draft revisi, pengingat review otomatis, serta acknowledge per pengguna.

Tabel Riwayat Perubahan, Riwayat Versi, dan Audit memiliki fungsi berbeda. Tabel pertama membantu menjelaskan perubahan isi, tabel kedua menampilkan metadata versi, sedangkan Audit menampilkan aktivitas sistem. Ketiganya belum menggantikan arsip lengkap setiap versi yang disahkan.

## 16. Acuan pemeliharaan panduan

Panduan ini disusun dari halaman editor, detail dokumen, komponen riwayat perubahan, dan endpoint simpan, revisi, submit, approval, berkas sumber, serta penyalinan template di `edms-app/src/`. Perbarui panduan ketika label tombol, aturan akses, mekanisme penyimpanan, atau workflow aplikasi berubah.
