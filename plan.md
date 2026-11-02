# Rencana Pembangunan Ulang EDMS PLN UP Sertifikasi

Status terbaru 30 Oktober 2026: update UI NAS v2.1.4 lulus dan health LAN terverifikasi; File Explorer memiliki tombol Kembali serta dialog folder yang tidak terpotong. Update mengganti image aplikasi saja, tanpa migrasi database atau backup data baru sesuai permintaan pengguna. Bukti di docs/UPDATE_NAS_UI_2_1_4.md. Status terdahulu di bawah adalah riwayat.

Status terbaru 30 Oktober 2026: deployment NAS v2.1.3 lulus. Health LAN, smoke DUMMY, restart, publikasi dan retensi 2 dokumen/2 file/6 akun terverifikasi. Checkpoint `edms-update-20261029T235901Z-20829`, paket `nas-update-9b220b7a`; detail dan batas pemulihan di [docs/IMPLEMENTASI_V2.md](docs/IMPLEMENTASI_V2.md). Status sebelumnya di bawah adalah riwayat.

Status terbaru 29 Oktober 2026, v2.1.3: paket image Linux/amd64 untuk Peta Dokumen, klasifikasi kode dan jenis Lampiran telah dibangun dan diverifikasi lokal. `DUMMY-4809624e1b14` lulus 53 tes inti, integrasi dan browser; audit runtime 0 temuan; paket `nas-update-9b220b7a` lolos checksum dan pemeriksaan image. Paket belum disalin ke NAS dan produksi belum diubah. Saat di kantor diperlukan salin paket, backup produksi baru, restore/rehearsal lokal dan receipt yang cocok sebelum apply. Lihat [docs/UPDATE_NAS_V2_1_3.md](docs/UPDATE_NAS_V2_1_3.md). Status versi terdahulu di bawah adalah riwayat.

Status terbaru 29 Oktober 2026, v2.1.2: implementasi lokal File Explorer, pohon ZIP, klasifikasi kode nama dan master bidang/jenis dokumen selesai. Linux/amd64 release verification lulus (`DUMMY-8772bed1954e`); 45 core test, integrasi MariaDB/file DUMMY, browser, layout dan UX lulus; audit dependency runtime 0 temuan. Paket `nas-update-6fe0841f` tersinkron ke `/share/Container/edms-release/nas-update-6fe0841f` dengan 27 hash cocok. NAS masih sehat di v2.1.1. Belum ada backup, migrasi atau perubahan kontainer produksi: sesi ini tidak memiliki terminal NAS berotorisasi (SSH 22/2222 tertutup dan Docker TLS memerlukan sertifikat klien). Deployment tetap menunggu fresh backup, restore/rehearsal dan akses eksekusi NAS; lihat [docs/UPDATE_NAS_V2_1_2.md](docs/UPDATE_NAS_V2_1_2.md). Catatan status di bawah adalah riwayat rilis sebelumnya.
Tanggal status: 23 Oktober 2026. Versi keputusan: 2.1. Status: deployment NAS v2.1.0 lulus, termasuk smoke dummy, restart, proteksi akun/master/audit dan register kosong. Akses internal http://10.10.200.166:3000; halaman dan health terverifikasi dari laptop. Bukti dan checkpoint: docs/IMPLEMENTASI_V2.md. Impor Dokumen Final belum dijalankan.
Acuan spesifikasi: [Spesifikasi_EDMS_Dokumen_Mutu_UPS.md](Spesifikasi_EDMS_Dokumen_Mutu_UPS.md).

Keputusan upload terbaru, 29 Oktober 2026, mengesampingkan aturan deduplikasi upload di bawah: upload baru tidak memeriksa/menolak/menggabungkan berdasarkan kesamaan isi, nama, judul atau kode. Setiap file menjadi dokumen terpisah dengan judul lengkap; update versi dan tambah format tetap melalui pilihan dokumen tujuan secara eksplisit. Rencana ZIP terbaru: folder teratas menjadi kategori dengan nama persis; subfolder dan folder kosong menjadi pohon folder yang dapat ditelusuri di File Explorer; file mempertahankan lokasi/path ZIP. Jika ZIP berisi beberapa folder tingkat teratas, setiap folder menjadi kategori; file langsung di root ZIP tampil di root Explorer. Nama ZIP tidak menambah folder pembungkus. Jalur folder identik dalam kategori yang sama dapat memakai node folder yang sama, tetapi setiap file upload tetap menjadi dokumen baru. Pengulangan finalize/retry job yang sama tetap idempoten berdasarkan identitas entri, bukan kesamaan isi. Hash SHA-256 tetap disimpan untuk integritas; menu pemeriksaan duplikat manual terpisah tetap tersedia. Upload tanpa deduplikasi sudah diterapkan pada NAS v2.1.1; struktur Explorer merupakan rencana lanjutan, belum diterapkan.

## 1. Keputusan final pengguna

| Aspek | Keputusan |
|---|---|
| Sumber awal | Mulai hanya dari folder Dokumen Final; data dokumen aplikasi lama tidak dimigrasikan |
| Register saat deploy | Keputusan 23 Oktober 2026: mulai kosong, termasuk 93 dokumen v2 pada snapshot NAS; impor Dokumen Final dilakukan terpisah setelah aplikasi siap. Akun, master, konfigurasi dan seluruh audit dipertahankan |
| Data lama | Hapus data dokumen lama dan histori terkait saat transisi, sesudah backup; akun dan konfigurasi dipertahankan |
| Penerbitan | Upload/update langsung aktif setelah validasi dan penyimpanan berhasil, tanpa approval bertingkat |
| Revisi baru | Riwayat versi aplikasi baru tetap disimpan; update bukan overwrite fisik file versi sebelumnya |
| PDF-only | Sediakan konversi ke DOCX; popup peringatan wajib sebelum download hasil konversi |
| Infrastruktur | Container/service aplikasi lama, database edms_ups dan storage/mount NAS yang sama; keputusan 23 Oktober 2026: hanya LAN http://10.10.200.166:3000, tanpa domain publik |
| Build | Di laptop dalam Linux container; NAS menjalankan hasil standalone siap pakai |
| Hardware | Intel Celeron J3455, 4 core/4 thread, hingga 2,3 GHz; RAM 4 GB; target Linux amd64 |
| UI | Biru muda dan kuning PLN, Logo Danantara dan PLN; gunakan skill UI terpasang yang relevan setelah diperiksa |
| Pengujian upload | Hanya file dummy sintetis, termasuk ZIP/PDF/DOCX/XLSX; bukan dokumen asli |

Implementasi dan deployment telah dijalankan dengan bukti di docs/IMPLEMENTASI_V2.md. Register dikosongkan melalui manifest yang lulus rehearsal setelah backup/restore terverifikasi; seluruh smoke NAS memakai dummy dan dibersihkan selektif. Backup pra-transisi serta checkpoint original dipertahankan untuk pemulihan. Impor asli tetap pekerjaan operasional terpisah.

## 2. Prinsip dokumen dan batas perubahan

File PDF, DOCX dan XLSX asli disimpan utuh; metadata dan versi di MariaDB. Pengguna download, edit lokal dan upload revisi. Jangan membangun ulang original dari HTML/editor. Versi baru menyimpan snapshot lengkap metadata dan file immutable beserta SHA-256.

Hapus hanya data dokumen aplikasi lama beserta versi, sections, relasi referensi dokumen, approval dan file hasil/turunan yang benar-benar miliknya, berdasarkan manifest dan relasi aktual. Akun, roles, bidang, master referensi independen, konfigurasi, secret, logo dan source tidak termasuk sasaran. Audit lama tidak dibawa sebagai histori dokumen baru; bila memuat aktivitas akun/sistem, pertahankan bagian tersebut dan jangan hapus seluruh tabel secara membabi buta. Salinan backup tetap tersedia untuk recovery.

Jangan menghapus folder lokal Dokumen Final atau Folder Logo, backup pra-transisi, file bersama, atau mengosongkan seluruh volume/database. Kebutuhan membersihkan dokumen lama tidak mengizinkan reset database atau seed ulang akun. Source lama/perubahan lokal tetap dijaga; source pengganti boleh disusun di edms-v2 sebagai direktori kerja, bukan stack produksi tambahan.

## 3. Inventaris sumber dan kebijakan dummy

Inventaris lokal awal 22 Oktober 2026: 351 file, terdiri dari 153 DOCX, 195 PDF dan 3 XLSX; total 194.708.120 byte. Ini jumlah file, bukan dokumen logis. Struktur subfolder memuat pasangan format, prosedur, formulir dan lampiran.

Inventaris awal menjadi acuan impor nyata setelah implementasi siap; bila isi folder berubah, buat ulang manifest read-only. Selama development/UAT, tidak upload, seed, konversi massal atau mengimpor file asli dari Dokumen Final. Membaca nama/ukuran untuk inventaris diperbolehkan; pengujian seluruh alur memakai file sintetis dengan penanda DUMMY/TEST dan job ID yang dapat dibersihkan selektif.

## 4. Cakupan rilis pertama

Sampah/pulihkan, pilihan/aksi massal, ZIP original, metadata/filter lanjutan, Admin kelola pengguna, duplikat dan pemulihan versi tersedia; lihat [docs/FITUR_PENGELOLAAN_V2.md](docs/FITUR_PENGELOLAAN_V2.md). Rilis Linux/browser lulus DUMMY-8528b15de030; smoke NAS terbaru juga lulus, termasuk hapus permanen dummy beserta cleanup salinan pemulihannya.

- Login/logout, sesi HttpOnly, RBAC server-side, hak upload/update/download sesuai lingkup pengguna.
- Upload individual/multiple PDF, DOCX, XLSX dan ZIP bertingkat; streaming/chunk, resume, progres.
- Impor background dengan manifest, log per file, partial success, retry idempoten, CSV log.
- Register, detail, pencarian metadata, filter/pagination, preview PDF dan download format tersedia.
- Pairing sumber/PDF pada identitas dan revisi yang sama, dengan pemeriksaan pasangan ambigu.
- Update langsung aktif setelah validasi; ringkasan perubahan wajib, snapshot versi, optimistic locking.
- DOCX/XLSX ke PDF dan PDF ke DOCX melalui antrean satu job konversi sekaligus.
- Popup peringatan hasil konversi PDF-ke-Word, label asal dan status konversi.
- Audit, arsip versi baru, backup/restore, health check dan rollback deployment.
- Tidak ada antrean review, tanda tangan baru, approval bertingkat atau tombol submit/approve/reject pada rilis ini.

## 5. Upload ZIP dan kegagalan

1. Buat upload session dan import job terautentikasi; staging potongan ke disk, bukan seluruh arsip di RAM.
2. Verifikasi ukuran/checksum, lalu finalisasi idempoten; batasi kuota, expiry dan sisa disk.
3. Baca manifest entri beserta path asli. Ekstrak bertahap dengan batas jumlah entri, ukuran total, rasio kompresi dan waktu.
4. Tolak path traversal, absolute path, symlink, ZIP terenkripsi, nested ZIP dan format tak didukung; log alasan per entri. Jangan mengeksekusi macro/konten aktif.
5. Validasi isi/MIME/struktur aktual DOCX/XLSX/PDF. Deteksi file korup dan karantina jika pemindai tersedia.
6. Saran identitas berdasarkan kode, revisi dan konteks folder. Pasangan ambigu tetap Perlu Pemeriksaan dan belum aktif; pemeriksaan metadata bukan workflow approval.
7. File valid dengan metadata cukup langsung masuk daftar aktif. Satu kegagalan tidak membatalkan file lain. Status tersimpan, konversi gagal dan gagal total harus dibedakan.
8. Ringkasan memuat hasil setiap file/folder, gagal dan perlu pemeriksaan; semua entri terhitung. Upload baru tidak menghasilkan status duplikat. Status duplikat historis tetap dapat dibaca. Log CSV dan retry tersedia.
9. Retry hanya memproses item yang belum berhasil; identitas job/entri mencegah publikasi ulang saat retry, tanpa melewati file dari upload baru yang kebetulan sama. Lease/heartbeat dan checkpoint memulihkan job sesudah restart.

ZIP yang terlalu rusak untuk membaca manifest diberi error tingkat arsip; jelaskan bahwa seluruh nama file belum dapat diketahui. Log mencatat job ID, path asli bila tersedia, tahap, status, kode/pesan aman, waktu, percobaan dan tindakan lanjut. Kegagalan konversi tidak membatalkan upload sumber.

## 6. Format, konversi dan popup

| Sumber tersedia | Download |
|---|---|
| DOCX + PDF pada revisi yang sama | Word asli dan PDF resmi |
| DOCX saja | Word asli; PDF turunan ketika konversi selesai |
| XLSX saja | Excel asli; PDF turunan ketika konversi selesai |
| PDF saja | PDF asli; Word hasil konversi ketika konversi selesai, dengan popup |

Simpan asal format sebagai original atau converted dan kaitkan turunan ke source file ID/hash serta versi. PDF resmi tidak ditimpa PDF hasil konversi. PDF versi lama tidak otomatis menjadi pasangan sumber versi baru. Original download harus identik hash dengan file upload.

Sebelum setiap download Word hasil konversi PDF, tampilkan:

> Dokumen ini merupakan hasil konversi PDF. Tata letak, tabel, dan isi mungkin berbeda dari dokumen asli. Periksa kembali sebelum digunakan.

Tombol modal: Batal dan Lanjutkan Download. Membatalkan tidak memulai download. Word asli tidak diberi peringatan yang keliru. Endpoint turunan memerlukan acknowledgement yang terikat pengguna dan file/version ID; jangan sediakan tautan statis publik yang melewati modal/izin. Catat acknowledgement/download dalam audit tanpa mengklaim pengguna telah memeriksa isi.

PDF-ke-DOCX termasuk rilis pertama. Engine konversi dipilih setelah proof-of-concept pada dummy representatif; LibreOffice untuk Office-ke-PDF bukan bukti kemampuan PDF-ke-DOCX. Uji tabel/gambar/font/halaman. PDF scan/tanpa teks diberi keterangan keterbatasan; DOCX dapat berisi gambar halaman, bukan janji teks editable/OCR. Jika converter gagal, tampilkan error/retry, jangan memberi file kosong/rusak atau sekadar mengganti ekstensi. OCR lanjutan ditunda. Tidak mengirim dokumen ke layanan pihak ketiga secara otomatis.

Konversi berjalan pada worker/proses dalam container aplikasi yang sama, satu job sekaligus, timeout, batas resource, lease/heartbeat dan cache per hash/versi. Perubahan arsitektur bila resource tidak cukup dibahas lebih dulu.

## 7. Update langsung dan histori

Daftar -> Detail -> Download Word/Excel (PDF-only: Word hasil konversi + popup) -> Edit lokal -> Update Dokumen -> Upload + ringkasan -> Validasi/simpan -> Versi baru Aktif.

- active_version_id berpindah atomik ke snapshot baru dan versi sebelumnya menjadi arsip; tidak menunggu review/approval.
- Versi lama tetap aktif selama upload/validasi belum selesai. Jika penyimpanan gagal, versi aktif tidak berubah.
- Konversi turunan berjalan sesudah file sumber tersimpan; kegagalannya tidak membatalkan publikasi sumber yang valid.
- expectedVersion/lock_version mencegah lost update; konflik 409 mengharuskan pengguna memeriksa versi terbaru.
- Pisahkan nomor versi internal dan nomor revisi resmi. Ringkasan diisi pengguna; diff isi otomatis ditunda.
- Pertahankan lembar pengesahan yang sudah ada dalam original. Aplikasi tidak menambah/memindahkan tanda tangan atau mengklaim pengesahan baru.

## 8. Hak akses dan model data

Viewer membaca/download aktif sesuai izin. Penyusun/Editor mengunggah serta memperbarui lingkup dokumennya. Admin mengelola akun, master, impor, arsip dan hak akses. Role lama tetap ada bila dipakai akun; keberadaan Tim Mutu/Manager/Pimpinan tidak memicu tahap approval. Izin sumber editable dan arsip dapat berbeda dari PDF.

Tabel target: users/roles/departments yang dipertahankan, documents, document_versions, document_files, categories/document_relations, audit_logs, import_jobs/import_items, upload_sessions/upload_parts, conversion_jobs dan migration_runs. Tidak perlu tabel approval baru untuk rilis ini. Audit baru tidak bergantung pada record dokumen lama yang akan dibersihkan.

Mutasi lintas tabel memakai pool MariaDB dan withTransaction; filesystem tidak ikut transaksi DB. Gunakan staging, atomic rename pada volume sama, kompensasi, checkpoint dan rekonsiliasi file yatim. File privat di luar public, endpoint terautentikasi; sesi HttpOnly, origin/CSRF, rate limit, validasi input, environment secret dan akun DB terbatas.

## 9. UI dan skill

Gunakan skill UI/desain yang sudah terpasang dan sesuai pekerjaan source aplikasi; periksa katalog/instruksinya pada tahap UI, jangan mengklaim skill sudah digunakan hanya karena tercantum. Pertahankan CSS Modules dan hindari dependency berat tanpa kebutuhan.

Tema biru muda dan kuning PLN dengan latar netral dan teks kontras. Kuning sebagai aksen; pastikan status tidak hanya dibedakan warna. Gunakan logo resmi lokal tanpa mengubah proporsi: Danantara SVG/PNG berwarna serta PLN PNG dari Folder Logo. Navigasi mencakup Dashboard, Daftar Dokumen, Upload/Impor, Histori dan pengaturan sesuai izin; tanpa menu approval. Desktop/tablet responsif, keyboard/focus/modal dapat diakses, state loading/kosong/sukses/error jelas. Ikon SVG stroke 1.75/currentColor, bukan emoji.

## 10. Infrastruktur dan transisi

Hardware pengguna: Celeron J3455, 4 core/4 thread, hingga 2,3 GHz, RAM 4 GB. Build target linux/amd64 di laptop; verifikasi runtime Container Station, mount, disk kosong dan font sebelum rilis. Model NAS belum diketahui dan bukan penghalang persiapan source.

Next.js standalone berisi public, .next/static dan dependency runtime/konversi, dikemas siap jalan. NAS tidak npm install/npm run build; Compose produksi image tanpa build. Gunakan container/service lama, DB edms_ups, port, jaringan, Tunnel dan volume/mount yang sama. Image update boleh merekreasi instance container tanpa stack paralel. Jangan menjanjikan RAM 50-100 MB; ukur web dan konversi pada NAS 4 GB.

Transisi data: backup konsisten DB+file -> verifikasi restore -> maintenance/hentikan penulisan -> manifest sasaran dokumen lama dan referensi -> hapus data dokumen lama dalam urutan FK yang benar -> migrasi schema -> update runtime -> smoke dengan dummy -> bersihkan dummy -> buka akses. Gunakan checkpoint; DDL MariaDB tidak diasumsikan transactional. Jangan DROP DATABASE/TRUNCATE semua tabel atau menghapus seluruh volume. Akun/role/bidang/master independen/config tetap ada; audit transisi mencatat hasil/count.

Impor Dokumen Final nyata adalah pekerjaan operasional sesudah pengujian siap, bukan bagian test dummy; jangan memulainya dalam tugas penyelarasan ini. Aplikasi baru dimulai tanpa data dokumen lama. Backup rollback dapat mengembalikan runtime/DB/file lama secara konsisten bila transisi gagal.

Cloudflare Tunnel tetap outbound, MariaDB 3307 internal. Upload chunk di bawah batas proxy; file privat tidak di-cache publik. Sync paket aplikasi tidak menimpa database/storage NAS dengan isi laptop.

## 11. Tahapan dan penerimaan

| Tahap | Hasil | Gerbang selesai |
|---|---|---|
| 0. Penyelarasan | Plan/spec/panduan konsisten | Semua keputusan terakhir dan dummy-only tercatat |
| 1. Fondasi | Source, schema, auth/RBAC, storage | Akun lama terjaga; izin teruji |
| 2. UI | Skill relevan, tema PLN dan dua logo | Responsive, kontras dan state halaman lulus |
| 3. Upload | ZIP/individual/chunk/log/retry | Seluruh dummy terhitung; partial failure jelas |
| 4. Dokumen | Register/download/update/histori | Aktif langsung, hash identik, konflik terdeteksi |
| 5. Konversi | Office-PDF dan PDF-DOCX, modal | Batal/lanjut benar; hasil valid atau error/retry jelas |
| 6. NAS | Build laptop, runtime sama, backup/rollback | Restart, resource, restore, smoke dummy lulus |
| 7. Transisi | Pembersihan dokumen lama dan kesiapan impor | Akun/config aman; tidak ada dummy tersisa; impor asli bukan test |
| 8. Explorer dan klasifikasi otomatis | Pohon folder, aksi folder, pemetaan kode dokumen/bidang dan master | Hierarki ZIP tepat; kode nama file mengisi jenis/bidang; RBAC serta data lama aman |
| 9. Rilis lanjutan | Migrasi aditif, backup/restore dan paket Linux amd64 | Uji dummy, health, pemulihan dan smoke pada service NAS yang sama lulus |

Rencana bukan implementasi. Jangan menandai upload, migrasi atau pengujian selesai sebelum benar-benar dijalankan dan ada buktinya.

## 12. Matriks pengujian dummy

Gunakan fixture sintetis: DOCX dengan tabel/gambar/halaman pengesahan dummy, PDF teks, PDF scan simulasi, XLSX multisheet/print area, pasangan sumber/PDF, revisi kedua dan nama Unicode/panjang. ZIP valid bersubfolder, campuran valid/korup/unsupported, duplikat, manifest tak terbaca, terenkripsi dan path traversal disimulasikan secara terbatas; jangan membuat zip bomb berbahaya sungguhan.

Uji resume/retry/finalisasi berulang/restart, disk/kuota/timeout melalui simulasi terkendali, download hash, konflik dua pengguna, URL langsung lintas peran, konversi gagal, popup setiap download converted Word, batal tanpa download, Word asli tanpa popup, preview, filter/pagination dan logout. Semua file, job, versi, turunan dan log uji diberi identitas dummy agar cleanup selektif tidak menyentuh data lain. Catat hasil dan bersihkan data dummy setelah uji. Tidak upload dokumen asli selama development/UAT, termasuk smoke NAS.

Rekonsiliasi seluruh 351 file asli hanya dilakukan pada impor operasional setelah implementasi siap, bukan acceptance test upload saat ini.

## 13. Ditunda dan prasyarat tahap berikut

Ditunda: approval bertingkat/tanda tangan baru, OCR lanjutan, editor browser, diff isi otomatis, pencarian full-text, email, reminder review, acknowledge dan template cloning.

Cek saat implementasi: skill UI tersedia, engine PDF-ke-DOCX dan kompatibilitas/lisensi/resource, runtime linux/amd64, mount/disk/font, batas upload, akses per bidang, penomoran revisi dan retensi backup. Tidak ada pertanyaan wajib tambahan untuk mulai fondasi.

## 14. Rencana lanjutan: File Explorer, struktur ZIP, dan klasifikasi otomatis

Status 29 Oktober 2026: pengguna menyetujui arah fitur dan label. Bagian ini adalah rencana, bukan bukti implementasi. Perubahan source, migrasi, pengujian, atau deployment belum dilakukan.

### Keputusan pengguna

- Kode bidang dibaca dari nama file yang diunggah. Sistem tidak mengandalkan isi dokumen untuk menebak jenis atau bidang.
- `FR` ditampilkan sebagai **Formulir Mutu** mengikuti referensi.
- Label bidang aplikasi mengikuti nama bidang pada folder sumber. Kode tiga huruf tetap menjadi kunci pemetaan.
- File Explorer mendukung penelusuran, breadcrumb, pencarian, pengurutan, membuka/mengunduh dokumen serta aksi membuat, mengganti nama, memindahkan, dan menghapus folder.
- Jenis/bidang yang diperlukan tetapi belum ada ditambahkan ke master. Master yang tidak diperlukan dirapikan sesudah pemakaian dan relasinya diperiksa.

### Bidang dan jenis dokumen

Nama folder sumber memuat bidang berikut; nama folder ZIP utuh tetap dipertahankan sebagai kategori, termasuk nomor, tanda baca, dan teks `PROSEDUR`:

| Kode | Label bidang aplikasi berdasarkan nama bidang dalam folder |
|---|---|
| BMK | Bidang Pengendalian Mutu, Kinerja, Keuangan dan Umum |
| BMA | Bidang Pengembangan Materi |
| BST | Bidang Sertifikasi Person dan Umum |

Label tersebut mengikuti folder sumber sesuai keputusan pengguna. Referensi Word menjelaskan ekspansi BMK/BST dengan redaksi berbeda; kode BMK/BMA/BST menjadi kunci teknis, sementara label aplikasi mengikuti nama folder.

Jenis dokumen yang dikenali dari awalan kode pada nama file:

| Pola kode | Jenis dokumen aplikasi |
|---|---|
| `MAN.MUTU.UPS.2025.RR` | Manual Mutu |
| `PR.UPS.YYYY.AAA.PP-RR` | SOP/Prosedur |
| `IK.UPS.YYYY.AAA.ZZ-RR` | Instruksi Kerja |
| `FR.UPS.YYYY.AAA.PP.ZZ-RR` | Formulir Mutu |

`YYYY` adalah kode klasifikasi fungsi (contoh `SER3` dan `PBR3`); `AAA` adalah kode bidang BMK/BMA/BST. Jenis dan bidang ditentukan dari kode file, bukan hanya dari folder induknya. Nomor dokumen dan revisi resmi `RR` dipisahkan saat pola valid dikenali. Kode tak dikenal atau tidak lengkap tetap dapat diisi manual dan tidak diberi klasifikasi tebak-tebakan.

Keputusan 29 Oktober 2026: nama file yang memuat kata `Lampiran` (tanpa membedakan huruf besar/kecil) otomatis memakai jenis dokumen **Lampiran**, termasuk item ZIP. Aturan ini berlaku untuk nama file, bukan nama folder; kode dan bidang tidak ditebak dari kata tersebut. File lain di folder MM tidak otomatis menjadi Lampiran.

Peta Dokumen menampilkan Lampiran sebagai level tampilan tersendiri dan dapat mengaitkannya ke Dokumen Mutu dalam kategori yang sama. Dokumen lama di subfolder `Lampiran` pada kategori MM dikenali pada peta tanpa mengubah metadata tersimpan secara massal. Bagan membuka cabang secara bertahap dan membatasi daftar tanpa induk agar ruang kosong serta halaman panjang tidak mendominasi tampilan; Daftar hierarki tetap tersedia.

### Perilaku File Explorer dan ZIP

1. Tambahkan menu **File Explorer** dengan kategori akar, pohon folder, breadcrumb, daftar file, pencarian, pengurutan, serta navigasi masuk/keluar folder. Buka file melalui detail dan endpoint yang sama-sama menerapkan hak akses.
2. Satu folder tingkat teratas dalam ZIP menjadi satu kategori bernama persis sesuai entri ZIP. Folder bertingkat menjadi node subfolder, bukan kategori baru. Folder kosong juga dipertahankan. Nama arsip ZIP sendiri tidak menambah pembungkus.
3. Bila ZIP memiliki beberapa folder teratas, masing-masing menjadi kategori. File yang langsung berada di root ZIP tampil di root Explorer. Path relatif ZIP dan nama asli file disimpan untuk penelusuran dan audit.
4. Folder dengan path yang sama di bawah kategori yang sama memakai node yang sama; setiap unggahan file tetap menghasilkan dokumen tersendiri tanpa deduplikasi isi, nama, judul, atau kode.
5. Folder dapat dibuat, diganti nama, dan dipindahkan. Penghapusan folder tidak menghapus dokumen secara berantai: folder berisi harus dikosongkan/dipindahkan dahulu; folder kosong dihapus secara lunak agar bisa dipulihkan. Perubahan dicatat di audit.
6. Super user mengelola semua folder; Editor dibatasi pada bidangnya; Viewer hanya menelusuri dan membaca. Izin diperiksa kembali di server untuk API Explorer, aksi folder, dan file.

### Master, migrasi, dan perlindungan data

- Inventarisasi nilai master `department` dan `kind` yang ada sebelum perubahan. Tambahkan label bidang BMK/BMA/BST dan jenis Manual Mutu, SOP/Prosedur, Instruksi Kerja, Formulir Mutu, serta Lampiran bila belum tersedia.
- Peta kode bidang ke label folder digunakan secara konsisten pada form upload, pemrosesan ZIP, filter, metadata dokumen, dan pembatasan RBAC.
- Periksa relasi dokumen dan akun sebelum merapikan nilai lama. Pindahkan referensi hanya dengan pemetaan yang jelas, pertahankan cakupan akun, lalu hapus atau nonaktifkan nilai yang terbukti tak terpakai melalui migrasi berversi. Jangan menghapus master yang masih dirujuk atau mengubah hak pengguna tanpa pemetaan.
- Tambahkan model folder secara aditif. Data dokumen, versi, file, hash, histori, akun, konfigurasi, dan folder asli tidak dihapus. Kategori/path lama dipertahankan atau dipetakan ke node pohon dengan checkpoint dan hasil rekonsiliasi.
- Nama file dan path ZIP disimpan apa adanya. Kode berawalan `FR`, `IK`, `PR`, atau `MAN.MUTU` dipetakan ke jenis; `AAA` memetakan bidang. Kata `Lampiran` pada nama file menetapkan jenis Lampiran. File tanpa pola kode maupun kata Lampiran meminta pemeriksaan/manual input.

### Implementasi dan penerimaan

1. Periksa skill UI yang tersedia dan terapkan yang sesuai sebelum mengubah antarmuka.
2. Buat migrasi skema berversi untuk folder, relasi dokumen-folder, serta master yang diperlukan; uji migrasi dan pemetaan pada salinan DB lokal sebelum rilis.
3. Implementasikan pemindai pola nama file untuk tipe dokumen, bidang, nomor, dan revisi; gunakan satu peta kode bidang untuk upload tunggal maupun item ZIP.
4. Bangun Explorer responsif dan dapat diakses keyboard; uji aksi folder, breadcrumb, pencarian, pengurutan, state kosong/error, dan akses per peran.
5. Uji hanya dengan file sintetis `DUMMY/TEST`: kode tiap jenis dan bidang, kode tidak lengkap/tidak dikenal, ZIP satu/lebih folder induk, file root, folder kosong, nested folder, path Unicode, retry, folder yang sama, file bernama/berisi sama, serta aksi folder dan RBAC.
6. Pastikan upload file dengan isi/nama/kode sama tetap membuat dokumen terpisah; retry job yang sama tetap idempoten. Tidak mengupload atau mengonversi Dokumen Final sebagai test.
7. Sesudah seluruh gate lulus, siapkan backup baru DB+file, latihan restore dan rollback, build Linux amd64 di laptop, lalu update image pada service NAS yang sama. NAS tidak melakukan build atau instalasi dependency.

Kriteria selesai: tiga bidang tampil dengan label folder yang benar; jenis file sesuai pola kodenya; master yang diperlukan tersedia dan nilai usang yang tak terpakai dirapikan aman; ZIP tampil dengan hierarki persis; aksi folder menghormati RBAC dan tidak menghapus dokumen; data NAS dan histori tetap utuh; uji dummy, backup/restore, health, dan smoke rilis lulus.

Dokumen historis di docs/archive tetap mencatat keputusan lama dan bukan aturan aktif. Referensi deployment: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
