# Spesifikasi EDMS Dokumen Mutu — PLN UP Sertifikasi

Status terbaru 29 Oktober 2026: update NAS v2.1.1 lulus, akses LAN aktif; 108 dokumen, 109 file dan 6 akun existing dipertahankan. Upload tanpa deduplikasi dan folder ZIP otomatis sudah diterapkan. Backup/restore, migrasi, smoke dummy dan restart lulus; bukti terbaru di docs/IMPLEMENTASI_V2.md. Catatan status 23 Oktober berikut adalah riwayat rilis awal.
Versi 2.1. Status 23 Oktober 2026: implementasi edms-v2 telah dideploy sebagai v2.1.0 pada NAS internal http://10.10.200.166:3000, dengan register kosong dan smoke dummy/restart lulus. Bukti dan batasnya di docs/IMPLEMENTASI_V2.md. Menggantikan keputusan versi 2.0 yang masih mewajibkan approval dan menunda PDF-ke-Word. Acuan rinci: [plan.md](plan.md).

## 1. Tujuan dan keputusan

Pembaruan keputusan 29 Oktober 2026: upload baru menerima setiap file tanpa deduplikasi isi/nama/judul/kode, termasuk awalan judul atau kode yang sama dengan akhiran judul berbeda. Judul lengkap dipertahankan. Folder/subfolder di ZIP otomatis dibuat sebagai kategori/path folder berikut folder kosong, dengan file pada folder masing-masing. Kategori yang dipilih menjadi induk; file root ZIP masuk langsung ke induk tersebut, dan tanpa kategori struktur ZIP dimulai dari tingkat teratas. Tidak menambah folder dari nama arsip. Hash tetap untuk integritas dan retry job yang sama tetap idempoten berdasarkan identitas entri. Pemeriksaan duplikat manual bukan bagian validasi upload. Versi dan format pendamping digabung hanya melalui dokumen tujuan yang dipilih eksplisit, bukan otomatis karena kode sama. Source dan produksi telah diperbarui ke v2.1.1; lihat docs/IMPLEMENTASI_V2.md.

Pengelolaan file asli PDF/DOCX/XLSX dengan metadata, histori versi dan audit. Pengguna download, edit lokal dan upload revisi. Upload/update oleh pengguna berizin langsung aktif sesudah validasi dan penyimpanan; tanpa approval bertingkat atau tanda tangan baru. Histori revisi aplikasi baru tetap utuh.

Mulai hanya dari Dokumen Final. Data dokumen aplikasi lama beserta histori/sections/relasi/approval dan file khusus miliknya dibersihkan saat transisi setelah backup; bukan dimigrasikan. Akun/roles/bidang, master independen, konfigurasi, source, logo dan backup dipertahankan. Tidak menghapus folder sumber atau seluruh database/volume. Audit akun/sistem yang bercampur dipilah, bukan dihapus massal.

## 2. Persyaratan fungsional

| ID | Kebutuhan |
|---|---|
| FR-01 | Login/logout dan hak akses server-side per pengguna/lingkup |
| FR-02 | Upload individual/multiple PDF/DOCX/XLSX dan ZIP bersubfolder, chunk/resume |
| FR-03 | Manifest, progres persisten, partial success, error per file, CSV dan retry idempoten |
| FR-04 | ZIP tak terbaca dilaporkan tingkat arsip; tidak ada silent failure |
| FR-05 | File original immutable, hash/ukuran/nama/path asli dan snapshot metadata |
| FR-06 | Pairing identitas/revisi, pasangan ambigu Perlu Pemeriksaan tanpa workflow approval |
| FR-07 | Register/detail/search metadata/filter/pagination dan preview PDF tersimpan |
| FR-08 | Download original/turunan sesuai izin dan revisi, lineage original/converted |
| FR-09 | DOCX/XLSX ke PDF dan PDF ke DOCX melalui job konversi |
| FR-10 | Popup wajib setiap download Word hasil konversi PDF; Batal dan Lanjutkan Download |
| FR-11 | Update langsung aktif, ringkasan wajib, optimistic locking dan histori versi |
| FR-12 | Publikasi atomik mengganti active_version_id dan mengarsipkan versi sebelumnya |
| FR-13 | Kegagalan upload tidak mengubah versi aktif; gagal konversi tidak menghilangkan sumber |
| FR-14 | Audit unggah/update/publikasi/download/acknowledgement/cleanup dan pemulihan |
| FR-15 | Relasi kategori/prosedur/formulir/lampiran serta arsip sesuai izin |
| FR-16 | Backup/restore, job restart, health check dan rollback teruji |
| FR-17 | UI biru muda/kuning PLN dengan Logo Danantara dan PLN lokal, responsive/accessible |
| FR-18 | Seluruh pengujian upload memakai dummy sintetis, bukan dokumen final asli |

Popup: "Dokumen ini merupakan hasil konversi PDF. Tata letak, tabel, dan isi mungkin berbeda dari dokumen asli. Periksa kembali sebelum digunakan." Batal tidak mengunduh; Word original tidak menampilkan peringatan keliru. Download converted Word memerlukan acknowledgement pengguna/file/version dan RBAC, tanpa URL publik yang melewati alur.

PDF asli tetap utuh; PDF resmi dan turunan dibedakan. Engine PDF-ke-DOCX dipilih melalui proof-of-concept dummy; jangan menganggap engine Office-ke-PDF otomatis mendukung arah sebaliknya. PDF scan diberi keterangan keterbatasan; DOCX gambar halaman dimungkinkan tanpa janji OCR editable. Konversi gagal menampilkan error/retry, bukan file rusak/ekstensi palsu. Layanan pihak ketiga tidak digunakan otomatis.

## 3. Hak akses dan status

Viewer membaca/download sesuai izin. Penyusun/Editor upload/update lingkupnya. Admin mengelola akun/master/impor/arsip. Role lama dapat dipertahankan tanpa mengaktifkan tahap review/approval. Tidak ada tombol submit/approve/reject atau tanda tangan baru pada rilis ini.

Status dokumen: Aktif atau Diarsipkan. Status teknis Terunggah/Diproses/Perlu Pemeriksaan/Gagal terpisah dari versi aktif. Versi baru aktif sesudah validasi dan commit sukses; versi lama tersedia sampai itu terjadi. Pairing ambigu perlu koreksi metadata, bukan pengesahan bertingkat.

## 4. Data dan keamanan

Tabel: akun/roles/bidang yang dipertahankan; documents, document_versions, document_files, categories/document_relations, audit_logs, upload_sessions/upload_parts, import_jobs/import_items, conversion_jobs dan migration_runs. Tidak memerlukan approval baru. Nomor revisi resmi terpisah dari versi internal.

Pool MariaDB dan transaksi untuk mutasi lintas tabel, optimistic locking (409), staging/atomic rename/kompensasi/recovery file. Endpoint file privat memeriksa izin, source editable dan arsip; HttpOnly/origin-CSRF/rate limit/validasi. Secret environment dan akun DB terbatas; tidak ada cache publik file privat.

## 5. Infrastruktur dan tampilan

Container/service lama, database edms_ups dan storage/mount NAS yang sama. NAS Celeron J3455 4 core/4 thread hingga 2,3 GHz, RAM 4 GB; build Linux amd64 di laptop, NAS hanya runtime standalone siap pakai. Worker dalam container aplikasi sama, satu konversi sekaligus, timeout/cache; ukur resource. Tidak membuat stack produksi tambahan atau build di NAS. DB port 3307 internal, Tunnel outbound.

Next.js/TypeScript/CSS Modules. Periksa dan gunakan skill UI terpasang yang relevan saat tahap UI. Palet biru muda dan kuning PLN dengan teks kontras, SVG ikon stroke 1.75/currentColor, logo Danantara dan PLN dari Folder Logo tanpa distorsi, layout desktop/tablet dan modal/focus/keyboard accessible.

## 6. Transisi dan penerimaan

Backup konsisten DB+file/restore teruji, maintenance, manifest cleanup data dokumen lama dan relasi/file miliknya, migrasi schema berversi/checkpoint, update runtime pada service yang sama, smoke dummy, cleanup dummy lalu buka akses. DDL MariaDB tidak otomatis rollback; jangan reset seluruh DB atau seed ulang akun. Audit transisi memuat hasil/jumlah. Source lama tetap dijaga sampai pengganti siap.

Inventaris awal Dokumen Final: 351 file (153 DOCX/195 PDF/3 XLSX), 194.708.120 byte. Pengujian upload hanya dummy, termasuk valid/korup/duplikat, resume/retry/restart, konflik, izin URL langsung, modal Batal/Lanjutkan, konversi gagal dan rollback. Rekonsiliasi 351 file dilakukan pada impor nyata setelah siap, bukan test development/UAT. Impor asli dan penghapusan data lama tidak dijalankan pada tugas dokumentasi ini.

## 7. Ditunda

Approval bertingkat/tanda tangan baru, OCR lanjutan, editor browser, diff isi otomatis, full-text search, email, reminder, acknowledge dan template cloning. PDF-ke-DOCX bukan fitur yang ditunda.
