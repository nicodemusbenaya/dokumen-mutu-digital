# DOKUMEN SPESIFIKASI KEBUTUHAN

## Electronic Document Management System (EDMS)
### Dokumen Mutu — PLN UP Sertifikasi (UPS)

**Versi 1.0 · 13 September 2026**  
Disusun untuk disposisi pembangunan aplikasi ke tim pengembang.

## 1. Latar Belakang & Tujuan
PLN UP Sertifikasi (UPS) telah menerapkan sistem manajemen terintegrasi berbasis beberapa standar ISO, yang didokumentasikan dalam dokumen mutu berupa Manual Mutu, Prosedur/SOP, dan Formulir Kerja di tiap bidang. Saat ini seluruh dokumen dikelola dalam format Word/PDF, dengan pencatatan perubahan manual dan proses pengesahan menggunakan tanda tangan basah.
Aplikasi EDMS ini dibangun untuk menggantikan proses tersebut menjadi digital dan paperless, dengan dokumen dikelola sebagai data terstruktur di dalam sistem — bukan sekadar penyimpanan file.
### 1.1 Kategori Sistem
Aplikasi ini dikategorikan sebagai Electronic Document Management System (EDMS) — lebih spesifik sebagai modul Quality Document Control, karena berfokus pada pengelolaan dokumen terkendali (controlled documents) dengan siklus hidup, version control, dan alur pengesahan berjenjang — bukan sekadar penyimpanan file generik.
### 1.2 Tujuan
Menggantikan pengelolaan dokumen mutu berbasis Word/PDF manual menjadi aplikasi terpusat.
Menyederhanakan proses revisi, review, dan pengesahan dokumen (paperless).
Menyediakan jejak audit (log perubahan) otomatis untuk kebutuhan audit internal/eksternal (BNSP, KAN, DJK).
Memastikan hanya versi dokumen terbaru yang aktif digunakan di lapangan.
Menyediakan master referensi dokumen agar regulasi/standar yang dipakai berulang tidak perlu diketik ulang di tiap prosedur.
## 2. Ruang Lingkup
Skala pengguna: Internal unit PLN UP Sertifikasi (bukan platform korporat lintas unit)
Jenis dokumen: Manual Mutu, Prosedur/SOP, Instruksi Kerja, Formulir Kerja
Di luar cakupan: Tanda tangan elektronik bersertifikat (BSrE/PSrE) — cukup signature pad internal; integrasi ke sistem korporat (CERMAT/HXMS) tidak termasuk versi awal
## 3. Peran Pengguna (User Roles)

| Peran | Hak Akses Utama |
| --- | --- |
| Penyusun Dokumen (Staf Bidang) | Membuat draft dokumen baru, mengajukan revisi, menautkan referensi dari master |
| Tim Mutu / Reviewer | Meninjau draft, memberi catatan revisi, meneruskan ke approval |
| Manager Bidang | Menandatangani (approval tahap 1) dokumen di bidangnya |
| Pimpinan Unit | Menandatangani (approval final) sebelum dokumen berstatus Aktif |
| Seluruh Pengguna Internal | Membaca, mencari, mengunduh PDF dokumen aktif; acknowledge dokumen baru |
| Admin Sistem | Mengelola master referensi, struktur bidang, hak akses, dan pengaturan siklus review |

## 4. Modul Fungsional
### 4.1 Document Editor & Template Engine
Dokumen dikelola sebagai data terstruktur (bukan file upload), mengikuti template baku per jenis dokumen.
Field baku: kode dokumen, judul, bidang pemilik, tujuan, ruang lingkup, definisi, referensi dokumen, prosedur, lampiran formulir.
Rich text editor untuk isi (numbering, tabel, penyisipan gambar/diagram alur).
Auto-generate nomor dokumen dan versi sesuai aturan penomoran organisasi.
Draft tersimpan otomatis (autosave) sebelum diajukan review.
### 4.2 Workflow Approval Berjenjang
Status dokumen: Draft → Review Tim Mutu → Menunggu Approval Manager Bidang → Menunggu Approval Pimpinan → Aktif → Obsolete.
Notifikasi otomatis (in-app/email) ke pihak terkait pada setiap perpindahan status.
Reviewer/approver dapat menyetujui atau mengembalikan dengan catatan revisi.
Riwayat siapa approve, kapan, dan catatannya tersimpan sebagai jejak audit.
### 4.3 Modul Tanda Tangan Digital (Signature Pad)
Area canvas untuk menggambar tanda tangan (mouse/layar sentuh), disimpan sebagai gambar terikat ke akun pengguna.
Tanda tangan otomatis dibubuhkan ke posisi yang sesuai saat status berubah menjadi 'Disahkan'.
Metadata pelengkap disimpan untuk jejak keabsahan: user login, timestamp, IP/device, hash dokumen saat ditandatangani.
Bukan e-signature bersertifikat (di luar cakupan versi awal) — cukup untuk kebutuhan operasional internal unit.
### 4.4 Version Control & Log Perubahan Otomatis
Setiap pengesahan ulang otomatis menandai versi sebelumnya sebagai Obsolete dan mengarsipkannya.
Log otomatis: siapa mengubah apa, kapan, dan alasan revisi (dapat ditautkan ke temuan audit/permintaan perubahan).
Fitur bandingkan (compare) isi antar versi secara visual, per bagian dokumen.
### 4.5 Convert to PDF & Distribusi
Tombol 'Generate PDF' merender data terstruktur menjadi layout PDF resmi (kop surat, tanda tangan, label status).
PDF hasil generate ditandai sebagai 'Controlled Copy'; salinan cetak ulang dapat ditandai berbeda (uncontrolled).
Opsi ekspor tambahan ke format Word bila dibutuhkan pihak eksternal.
### 4.6 Document Register & Dashboard Monitoring
Tabel master seluruh dokumen: kode, judul, versi, status, pemilik bidang, tanggal terbit, tanggal review berikutnya.
Dashboard notifikasi dokumen yang mendekati jadwal review/kadaluarsa.
Rekap dokumen per bidang untuk kebutuhan audit internal/eksternal.
### 4.7 Manajemen & Penelusuran Dokumen
Tree browser dokumen terstruktur per bidang, dengan indikator status (aktif/review/draft/obsolete).
Pencarian berbasis kode, judul, maupun isi/konten dokumen (full-text search).
Tampilan detail dokumen dengan tab: Isi Dokumen, Riwayat Versi, Info & Metadata.
Metadata mencakup: pemilik bidang, penyusun, siklus review, keterkaitan temuan audit, status pembacaan/acknowledge oleh staf.
### 4.8 Master Referensi Dokumen
Repositori pusat untuk regulasi, standar, dan dokumen internal yang dipakai berulang di banyak prosedur, agar cukup ditautkan sekali tanpa perlu diketik ulang.
Kategori referensi: Regulasi (Permenaker, Peraturan BNSP, dll.), Standar (ISO 9001, ISO/IEC 17024, dll.), dan Internal (dokumen mutu lain seperti Manual Mutu).
Setiap referensi menampilkan jumlah/daftar dokumen yang menggunakannya (usage tracking) — memudahkan analisis dampak bila referensi berubah.
Fitur 'Ambil dari Master Referensi' pada Document Editor: memilih referensi via picker, referensi ditautkan (bukan disalin isinya) ke dokumen.
Admin dapat menambah, mengubah, atau menonaktifkan entri master referensi.
## 5. Kebutuhan Non-Fungsional

| Aspek | Kebutuhan |
| --- | --- |
| Keamanan | Autentikasi login per pengguna; hak akses berbasis peran (role-based access control); jejak audit tidak dapat diubah/dihapus pengguna biasa |
| Ketersediaan | Dapat diakses seluruh staf unit melalui jaringan internal/intranet |
| Skalabilitas data | Mendukung ratusan dokumen dan ribuan versi historis tanpa penurunan performa pencarian |
| Kompatibilitas | Berbasis web (dapat diakses lewat browser standar), responsif untuk desktop dan tablet |
| Retensi data | Dokumen berstatus Obsolete tetap tersimpan (tidak dihapus) sesuai kebutuhan retensi audit |

## 6. Alur Pengguna Utama (User Flow)
Penyusun membuat/merevisi dokumen di Document Editor, menautkan referensi dari Master Referensi bila diperlukan.
Dokumen diajukan dan direview oleh Tim Mutu.
Dokumen disetujui berjenjang oleh Manager Bidang lalu Pimpinan Unit melalui signature pad.
Sistem otomatis menandai versi lama sebagai Obsolete dan mengaktifkan versi baru.
Dokumen aktif dapat digenerate ke PDF dan ditelusuri oleh seluruh pengguna melalui Document Register/Manajemen Dokumen.
## 7. Referensi Prototipe
Alur dan tampilan di atas telah digambarkan dalam prototipe wireframe interaktif (file terpisah: prototipe-dokumen-mutu.html) yang mencakup 6 layar: Daftar Dokumen, Editor SOP, Approval & Tanda Tangan, Hasil Terbit (PDF), Manajemen Dokumen, dan Master Referensi. Prototipe ini dapat dijadikan acuan visual awal bagi tim pengembang sebelum masuk ke tahap desain UI resmi.
## 8. Catatan untuk Tim Pengembang
Dokumen bersifat data terstruktur — rancang skema database yang mendukung version history per bagian, bukan hanya per file.
Signature pad cukup solusi ringan (mis. library signature_pad.js) yang disimpan sebagai gambar + metadata jejak keabsahan, tanpa perlu integrasi e-signature bersertifikat.
Generate PDF sebaiknya dari data terstruktur (HTML-to-PDF), bukan dari file yang diupload manual, agar layout selalu konsisten.
Modul Master Referensi perlu relasi many-to-many antara dokumen dan referensi agar usage tracking akurat.
Spesifikasi ini adalah versi awal (v1.0) — dapat disesuaikan lebih lanjut setelah diskusi teknis dengan tim pengembang.
## 9. Tech Stack & Arsitektur Teknis

### 9.1 Tech Stack yang Direkomendasikan

| Komponen | Teknologi |
| --- | --- |
| Frontend | Next.js / React |
| Backend / API | Node.js berbasis Next.js |
| Database | MariaDB 10.5.8 |
| Deployment | Server/NAS internal, tanpa Docker pada versi awal |
| File Storage | Storage lokal NAS |
| Authentication | Login internal EDMS |
| Authorization | Role-Based Access Control (RBAC) |
| Rich Text Editor | Library Rich Text Editor berbasis JavaScript, misalnya TipTap atau Quill |
| Signature Pad | `signature_pad.js` atau library sejenis |
| PDF Generation | HTML-to-PDF |
| Web Server / Reverse Proxy | Dapat menggunakan Nginx atau reverse proxy yang tersedia pada NAS |
| HTTPS | Disarankan untuk akses aplikasi melalui jaringan publik/internet |
| Backup | Backup database dan file dokumen secara berkala ke media/lokasi terpisah |

### 9.2 Arsitektur Deployment

Aplikasi pada versi awal dijalankan langsung pada NAS dan tidak mensyaratkan penggunaan Docker.

```text
Internet / Jaringan Internal
            │
            ▼
      Port Publik 18080
            │
            ▼
       EDMS Web App
      Next.js / Node.js
            │
            │ koneksi internal
            ▼
     MariaDB 10.5.8
          Port 3307
       (internal only)
            │
            ▼
       Storage NAS
   ├── PDF Dokumen
   ├── Signature
   └── Attachment
```

Port database MariaDB `3307` tidak perlu dan tidak disarankan untuk di-port-forward ke internet. Port publik hanya digunakan untuk mengakses aplikasi EDMS. Aplikasi yang berjalan pada NAS mengakses MariaDB melalui koneksi internal.

### 9.3 Authentication & RBAC

Sistem menggunakan authentication internal EDMS dan Role-Based Access Control (RBAC).

Setiap pengguna memiliki akun sendiri dan hak akses ditentukan berdasarkan role. Minimal role mengikuti peran yang telah didefinisikan pada bagian **3. Peran Pengguna (User Roles)**.

Sistem harus memastikan bahwa pengguna hanya dapat melakukan tindakan yang diizinkan oleh role-nya.

### 9.4 Concurrency & Multi-User Safety

Sistem harus dirancang untuk mendukung penggunaan secara bersamaan oleh beberapa pengguna tanpa menyebabkan data saling tertimpa, inkonsisten, atau menimbulkan error akibat concurrent access.

Ketentuan minimum:

- Setiap perubahan data harus memiliki identitas pengguna, timestamp, dan konteks perubahan.
- Penyimpanan data harus menggunakan transaksi database dan mekanisme validasi untuk menjaga konsistensi data.
- Sistem harus mencegah **lost update**, yaitu perubahan dari satu pengguna tidak boleh diam-diam menimpa perubahan pengguna lain.
- Untuk dokumen yang sedang diedit oleh beberapa pengguna, sistem harus memiliki mekanisme **concurrency control**, misalnya optimistic locking dengan version number atau mekanisme locking yang sesuai.
- Autosave harus menyimpan perubahan secara aman dan tidak menghapus perubahan yang telah disimpan oleh pengguna lain.
- Setiap versi dokumen harus memiliki identifier/version number yang unik dan berurutan sesuai aturan sistem.
- Proses approval tidak boleh berjalan pada data versi yang sudah berubah atau tidak lagi valid.
- Operasi yang melibatkan beberapa tabel harus menggunakan transaksi agar tidak menghasilkan data setengah tersimpan.
- Error pada satu sesi pengguna tidak boleh menyebabkan sesi pengguna lain ikut gagal.

### 9.5 Struktur Penyimpanan

Data terstruktur disimpan di MariaDB, sedangkan file fisik disimpan pada storage NAS.

Contoh kelompok data database:

```text
MariaDB
├── users
├── roles
├── documents
├── document_versions
├── document_sections
├── approvals
├── audit_logs
├── references
└── document_references
```

Contoh kelompok file:

```text
NAS Storage
├── documents/
│   ├── pdf/
│   └── attachments/
└── signatures/
```

Database tidak digunakan sebagai tempat utama untuk menyimpan file PDF atau attachment berukuran besar. Database menyimpan metadata, relasi, status, versioning, dan referensi terhadap file.

### 9.6 Keamanan & Akses

- MariaDB tidak diekspos langsung ke internet.
- Port `3307` digunakan untuk koneksi database internal.
- Hanya aplikasi EDMS yang perlu memiliki akses ke database.
- Password, secret key, dan credential database tidak boleh ditulis langsung di source code.
- Hak akses aplikasi harus diterapkan pada level server/API, bukan hanya disembunyikan pada tampilan frontend.
- Audit log harus tidak dapat diubah atau dihapus oleh pengguna biasa.
- Akses aplikasi melalui internet sebaiknya menggunakan HTTPS.

### 9.7 Backup & Retensi

Karena aplikasi ditempatkan pada NAS, mekanisme backup harus menjadi bagian dari deployment.

Backup sekurang-kurangnya mencakup:

- Database MariaDB.
- File PDF.
- Signature image.
- Attachment.
- File konfigurasi yang diperlukan untuk pemulihan aplikasi.

Backup sebaiknya memiliki salinan pada media atau lokasi terpisah dari NAS utama untuk mengurangi risiko kehilangan data akibat kerusakan perangkat.

### 9.8 Skalabilitas & Reliability

Arsitektur awal ditujukan untuk penggunaan internal unit. Implementasi harus tetap memperhatikan:

- Penggunaan bersamaan oleh beberapa pengguna.
- Ratusan dokumen dan ribuan versi historis.
- Konsistensi data ketika beberapa pengguna melakukan operasi secara bersamaan.
- Pencarian yang tetap responsif.
- Recovery ketika proses penyimpanan atau generate PDF gagal.
- Tidak adanya ketergantungan pada satu sesi browser untuk menjamin penyimpanan data.

### 9.9 Catatan Deployment

Pada versi awal, penggunaan Docker tidak diwajibkan. Aplikasi dapat dijalankan sebagai service Node.js langsung pada NAS.

Port publik yang tersedia dapat digunakan untuk mengakses aplikasi EDMS, sedangkan database tetap berada pada jaringan internal.

Apabila kebutuhan sistem berkembang, penggunaan Docker atau pemisahan service dapat dipertimbangkan pada tahap berikutnya tanpa mengubah struktur bisnis dan data utama aplikasi.
