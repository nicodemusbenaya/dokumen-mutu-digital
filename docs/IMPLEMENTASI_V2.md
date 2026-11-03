# Status implementasi EDMS v2

## Paket 2.1.8 (Form) disiapkan di laptop — 3 November 2026

Paket `edms-v2/release/app-update-2.1.8` berisi image `edms-ups:2.1.8` (linux/amd64, `sha256:50359dd7f2c7…`), migrasi aditif 009 tabel Form dan seed 4 form asli (draf). Atas keputusan pengguna tidak ada suite DUMMY penuh/UI browser dan tidak ada smoke DUMMY di produksi; bukti laptop: tes form 24/24, typecheck, runtime image (health 2.1.8, preflight productionReady, pdf2docx), migrasi+izin runtime+seed pada MariaDB uji terisolasi, checksum/sintaks paket di BusyBox. NAS belum dijangkau (laptop tidak berada di jaringan NAS); belum ada backup, restore gate, maupun deploy. Langkah: [UPDATE_NAS_2_1_8.md](UPDATE_NAS_2_1_8.md). Status update 2.1.7 di NAS belum terkonfirmasi; periksa image dan status aplikasi sebelum backup.

## Insiden gate update 2.1.7 — 30 Oktober 2026

Backup maintenance NAS `edms-update-20261030T074540Z-2104` selesai dan aplikasi lama ditahan STOPPED. Restore terisolasi di laptop lulus sebagai `DUMMY-RESTORE-e252eef44b38`: 24 tabel/objek, arsip app/storage dan Compose terverifikasi. Gate untuk backup tersebut dibuat dan checksum salinan NAS cocok. Update belum terbukti selesai.

Percobaan update pertama berhenti karena `update-restore-gate.json` belum ada. Skrip update sekarang memeriksa keberadaan gate sebelum `docker load` dan menampilkan `RESTORE_GATE_MISSING`. Percobaan berikutnya berhenti pada `JSON.parse` karena PowerShell 5 menulis gate dengan UTF-8 BOM. Skrip `prepare-app-update-gate-2.1.7.ps1` sekarang memakai path provider untuk share UNC, `Get-FileHash`, dan menulis JSON UTF-8 tanpa BOM. Error ini terjadi sebelum `docker compose up`; image 2.1.7 sudah dimuat, tetapi belum ada bukti service diganti atau health 2.1.7 lulus. Jangan menyatakan deploy berhasil sebelum `NAS_APP_UPDATE_PASS` dan health diperiksa.

Lanjutkan dengan membuat ulang gate dari backup dan receipt restore yang sama, lalu salin `update-restore-gate.json` ke paket NAS. Pastikan byte pertama JSON adalah `{` (123) dan hash lokal/NAS cocok. Ulangi `nas-app-update.sh /share/Container/edms-backups/edms-update-20261030T074540Z-2104`. Backup baru tidak diperlukan selama maintenance dan snapshot yang terverifikasi tidak berubah. Jika update dibatalkan, prosedur backup mencatat `docker start edms-ups-app` untuk mengakhiri maintenance tanpa transisi.

## Paket converter PDF→DOCX 2.1.7 disiapkan di NAS — 30 Oktober 2026

Image Linux/amd64 `edms-ups:2.1.7` memasukkan `pdf2docx`; gate laptop `DUMMY-f9dca5af7ebf` lulus (56 tes inti, integrasi MariaDB/file, konversi dan UI). Paket `/share/Container/edms-release/app-update-2.1.7` sudah disalin melalui SMB dan checksum seluruh file cocok. Percobaan awal backup gagal pada CRLF dan percobaan kedua pada asumsi bahwa DB_USER aplikasi terbatas bernama root. Skrip diperbaiki ke LF dan memakai checkpoint kredensial admin DB terlindungi yang sudah dipakai prosedur NAS sebelumnya. Tidak ada backup lengkap baru; folder percobaan bertanda `INCOMPLETE`, health LAN tetap `{ok:true,version:"2.1.6",database:true}`, dan service tidak dihentikan.

SSH port 222 dapat dijangkau, tetapi autentikasi key sesi Codex ditolak. Skrip backup yang diperbaiki sudah disinkronkan dan seluruh checksum serta LF diverifikasi ulang. Langkah berikutnya perlu dijalankan pengguna dari terminal QTS/SSH: `sh /share/Container/edms-release/app-update-2.1.7/nas-app-backup.sh --maintenance`. Skrip membuat backup baru dan menahan aplikasi lama dalam maintenance setelah sukses. Salin path `BACKUP_READY_FOR_RESTORE` ke laptop, jalankan `scripts/verify-nas-backup.ps1 -RestoreImage edms-ups:2.1.7`, lalu `scripts/prepare-app-update-gate-2.1.7.ps1`. Setelah gate disalin ke paket NAS, `nas-app-update.sh <backup-path>` mengganti hanya image service dan rollback image bila health/preflight gagal. Belum ada restore/rehearsal backup baru atau deployment 2.1.7.

Keterbatasan hasil tetap berlaku: uji mixed PDF menemukan beberapa garis/kotak vektor tidak terbawa ke DOCX; PDF scan menjadi gambar halaman dan tidak memperoleh OCR. Hasil konversi harus diperiksa sebelum digunakan.

## UI NAS v2.1.4 lulus — 30 Oktober 2026

File Explorer diperbarui dengan tombol Kembali ke folder induk, form Folder baru sesuai kebutuhan, dialog Kelola folder yang tetap masuk layar, dan tata letak folder mobile. Image-only update lulus pada `edms-release/ui-update-2.1.4/attempt-20261030T005902Z-14581`. Health LAN versi 2.1.4/database OK, container running/healthy/OOMKilled=false, preflight productionReady=true dan 6 akun aktif. Sesuai permintaan eksplisit pengguna, tidak ada backup DB/storage baru atau migrasi database. Image 2.1.3 dan konfigurasi percobaan tetap tersedia. Gate laptop `DUMMY-1105a0d420af` lulus, termasuk UI Kembali/dialog desktop/mobile. Detail: UPDATE_NAS_UI_2_1_4.md.

## NAS v2.1.3 lulus — 30 Oktober 2026

NAS mencetak `NAS_UPDATE_PASS` pada checkpoint `/share/Container/edms-backups/edms-update-20261029T235901Z-20829`. Pemeriksaan LAN setelah publikasi mengonfirmasi `{ok:true,version:"2.1.3",database:true}`. Receipt `update-completed.json` menyatakan smoke/restart/published=true; `update-retention.json` membuktikan 2 dokumen, 2 file dengan hash cocok, 6 akun dan histori dipertahankan. Smoke DUMMY lengkap lulus, termasuk klasifikasi nama, folder/subfolder ZIP, retry, konversi, versi, sampah/pulihkan, arsip ZIP dan RBAC. Paket `/share/Container/edms-release/nas-update-9b220b7a`; receipt rehearsal final `DUMMY-RESTORE-8593ff71504e`. Backup asli telah lulus restore penuh; pemakaian ulang sesudah rollback didahului `EXISTING_BACKUP_MATCH_PASS` yang memeriksa snapshot database dan hash seluruh file terdaftar saat aplikasi berhenti. Backup percobaan `edms-update-20261030T003803Z-829` dibatalkan dan tidak dipakai.

Perbaikan operasional: shell paket dinormalisasi LF; fixture smoke tidak menulis ke mount tests yang read-only; guard rollback mengenali kolom baru dengan default tetapi tetap menolak perubahan data; update memberi akun runtime lama izin SELECT/INSERT/UPDATE/DELETE hanya pada dua tabel Explorer baru. Percobaan gagal pertama ditahan guard, percobaan berikutnya benar-benar rollback ke v2.1.1, lalu deploy final lulus. Jangan memakai kembali checkpoint ini untuk update berikutnya setelah produksi menerima penulisan baru. Catatan status lama di bawah adalah riwayat.

## Paket v2.1.3 siap dibawa ke kantor — 29 Oktober 2026

Source terbaru Peta Dokumen, bagan yang lebih rapat, klasifikasi nama file dan jenis Lampiran telah dibangun menjadi image Linux/amd64 `edms-ups:2.1.3`. Gate release `DUMMY-4809624e1b14` lulus: 53 tes inti, integrasi MariaDB/file/ZIP/konversi, runtime Linux dan browser UI. Audit dependency runtime 0 temuan. Paket lokal `release/nas-update-9b220b7a` memiliki 34 file ber-hash cocok; image ID dan layer cocok dengan bukti rilis (`UPDATE_PACKAGE_PASS`). Migrasi update kini mencakup 007/008, dan verifikasi retensi memeriksa kolom baru secara aditif. Paket ini belum disalin ke NAS; NAS belum diubah pada tahap persiapan ini. Backup produksi baru dan restore/rehearsal lokal masih wajib sebelum apply. Urutan operasi: [UPDATE_NAS_V2_1_3.md](UPDATE_NAS_V2_1_3.md). Catatan versi lama di bawah adalah riwayat.

## Peta Dokumen lokal — 29 Oktober 2026

Source `edms-v2` kini memiliki menu Peta Dokumen untuk dokumen aktif yang sudah terdaftar. Level 1–4 mengikuti pola kode dan jenis pada prosedur informasi terdokumentasi; hubungan induk diatur admin secara eksplisit. Tanggal dicoba dari cover/awal DOCX atau halaman pertama PDF saat upload, dan dapat dibaca ulang per dokumen terdaftar oleh admin. Tanggal kosong/ambigu tetap Perlu pemeriksaan; koreksi manual diaudit. Migrasi aditif 007 diterapkan hanya pada database development `edms_home`. Tes DUMMY 84/84, TypeScript, endpoint lokal 200, dan tampilan desktop/mobile lokal lulus; tidak ada upload atau perubahan dokumen asli pada sesi ini. Source fitur ini belum dibangun sebagai rilis Linux atau dideploy ke NAS. Gate backup baru, restore/rehearsal, dan smoke dummy tetap berlaku sebelum update produksi.

Pembaruan tampilan berikutnya menambahkan pilihan Bagan hubungan dengan garis antar dokumen yang telah diberi induk, sambil mempertahankan Daftar hierarki. Browser DUMMY empat level menunjukkan tiga penghubung, pergantian kembali ke tabel, tanpa error JavaScript atau overflow pada 1280 dan 390 px. ZIP menggunakan jalur `publish()` per file; pembacaan tanggal otomatis berlaku pada DOCX/PDF yang berhasil diterbitkan, termasuk isi ZIP, dengan pengecualian format/isi yang tak terbaca.

Inferensi hubungan read-only berikutnya: satu MAN aktif dapat menjadi induk PR; FR otomatis terkait ke PR hanya bila kode fungsi/bidang/nomor prosedur cocok dan calon PR tunggal. IK tetap manual karena nomornya tidak memuat referensi induk PR yang tegas. Relasi manual mengesampingkan inferensi; kandidat ambigu tidak dipilih. Pada register development lokal, API menampilkan 33 relasi otomatis dari 46 dokumen, tanpa perubahan `map_parent_id`; browser menampilkan 33 label otomatis, enam cabang penghubung dan tanpa overflow pada 1280/390 px. Ini bukti development lokal, bukan hasil NAS.

## Paket v2.1.2 tersinkron; deployment NAS menunggu backup dan terminal berotorisasi — 29 Oktober 2026

Implementasi lokal mencakup File Explorer hierarkis, struktur ZIP tanpa folder pembungkus nama arsip, kode jenis/bidang/revisi yang dibaca dari nama file, serta master kanonis dari referensi prosedur. Upload tidak menolak file baru berdasarkan nama, judul, kode atau isi yang sama. Release image `edms-ups:2.1.2` untuk Linux/amd64 dan suite release lulus pada `DUMMY-8772bed1954e`: 45 core test, preflight runtime Linux, integrasi MariaDB/upload/revisi/konversi/ZIP, UI, layout empat viewport, dan UX. Audit dependency runtime pada lockfile release menunjukkan 0 kerentanan.

Paket `release/nas-update-6fe0841f` disalin ke NAS `/share/Container/edms-release/nas-update-6fe0841f`; seluruh 27 file yang tercatat di `SHA256SUMS` diverifikasi kembali setelah salin. Image ID `sha256:24b85585cb4bcd8095a582e85e8993c2aba937162412e956a7f63a1d17eb6695`, checksum tar `6fe0841fd1abcbc1b6c3abf8c69e4a15729802b5da4d0c0b9390407cbc5bf478`.

Health LAN terakhir menjawab `ok=true`, `version=2.1.1`, `database=true`. Belum ada backup NAS baru, stop service, migrasi, smoke produksi atau pergantian image. Eksekusi terhenti sebelum backup karena sesi tidak memiliki terminal NAS berotorisasi: SSH 22/2222 tertutup; port Docker TLS 2376 tidak menerima request tanpa sertifikat klien; Docker context lokal hanya Docker Desktop. QTS web tersedia, tetapi tidak ada sesi terminal terautentikasi yang dapat digunakan dari tool saat ini. Gate sebelum deployment tetap fresh backup DB+storage, restore dan migration/rollback rehearsal lokal, lalu apply pada service lama. Detail/aksi berikutnya: [UPDATE_NAS_V2_1_2.md](UPDATE_NAS_V2_1_2.md).

## Update NAS v2.1.1 lulus — 29 Oktober 2026

NAS mencetak NAS_UPDATE_PASS pada `/share/Container/edms-backups/edms-update-20261029T041103Z-23507`. Pemeriksaan laptop setelah publikasi: health HTTP berhasil, ok=true, version=2.1.1, database=true. Receipt update-completed.json mengonfirmasi smoke/restart/published=true. Retensi lulus: 108 dokumen, 109 file (seluruh hash cocok), 6 akun dan histori existing dipertahankan. Pengujian sintetis dan cleanup dokumen/job/file dummy selesai melalui suite integrasi; tidak mengimpor Dokumen Final atau mengosongkan register.

Paket final `/share/Container/edms-release/nas-update-c25f4f49`; image Linux amd64 yang lulus rilis DUMMY-9039dcc27a56. Restore/rehearsal final DUMMY-RESTORE-ba5d004ed3e8 lulus, termasuk 33.322 hash file arsip, pemulihan 736 file storage, seluruh 109 referensi file DB, migrasi idempoten dan rollback. Migrasi 004/005 diterapkan; role Super user/Editor/Viewer aktif, timestamp/password/metadata akun dipertahankan. Guard menerima alias dan path fisik resmi share QNAP. Next.js 16.4.3 dan audit runtime nol temuan; dependency browser pengujian tidak masuk image.

Container service lama sudah direkreasi dan berjalan; akses LAN http://10.10.200.166:3000 telah dipublikasikan. Tidak perlu restart manual. Backup baru dan bukti di atas dipertahankan; jangan gunakan transisi/pengosongan register awal. Detail prosedur: UPDATE_NAS_2026-10-29.md. Catatan pending di bawah adalah riwayat sebelum update ini.


## Upload tanpa deduplikasi dan folder ZIP otomatis — 29 Oktober 2026

Keputusan pengguna: upload baru tidak melewati/menolak file karena kesamaan isi, nama, judul atau kode. Awalan judul/kode yang sama dengan akhiran berbeda tetap menjadi dokumen terpisah dan menyimpan judul lengkap. Hash original tetap dicatat untuk integritas. Update versi/tambah format masih memerlukan dokumen tujuan eksplisit; menu Deteksi Duplikat manual tetap terpisah dari upload.

Source lokal: worker menerbitkan tiap file, extractor mengeluarkan identitas stabil tiap entri (termasuk nama/path kembar), direktori ZIP termasuk yang kosong menjadi master kategori dengan path penuh dan seluruh ancestor. Kategori pilihan menjadi induk, file root ZIP tetap di induk, dan nama arsip tidak menambah folder pembungkus. Original tetap disimpan privat dengan ID unik dan original_path utuh; folder aplikasi memakai metadata kategori, bukan nama path fisik original. Folder nonaktif tidak diaktifkan ulang otomatis. Pembuatan folder diaudit dan berada dalam transaksi publikasi file; folder kosong memakai transaksi sendiri. Checkpoint sukses item dan publikasi tersimpan dalam transaksi yang sama agar restart/retry tidak membuat dokumen baru lagi untuk entri yang sudah berhasil. Form upload menjelaskan perilaku baru dan menyegarkan master setelah impor selesai.

Migrasi baru `005_upload_folders.sql` melepaskan UNIQUE kode dokumen (nilai kode lama tidak diubah; indeks pencarian biasa dipertahankan), menambah entry_key nullable dan indeks unik job/entry. Nomor 004 tetap milik migrasi role yang tertunda. Migrasi 005 idempoten secara langkah DDL, tercatat v2_migrations, dan tidak berjalan pada startup. Belum dijalankan pada database lokal/produksi; DDL perlu checkpoint/backup dan rehearsal MariaDB sebelum apply. Tidak menghapus dokumen, histori, master atau akun yang sudah ada.

Bukti sesi ini: `npm test` lulus 71 test/subtest dengan fixture DUMMY, `npx tsc --noEmit` lulus, syntax worker/migrasi/integrasi dan parser PowerShell verifier lulus, detector impeccable pada form upload menghasilkan `[]`. Regresi baru mencakup hierarki/induk/root/Unicode/batas path, folder kosong/nonaktif, audit folder sekali, path arsip identik dengan file fisik terpisah dan traversal direktori yang ditolak. Suite integrasi dummy disiapkan untuk kode/isi sama diterima, judul lengkap, kategori hasil ZIP, folder kosong serta retry tanpa publikasi ulang, berikut cleanup selektif master folder di bawah tag DUMMY milik run itu.

Uji integrasi MariaDB, migrasi 005, browser dan build/runtime Linux terbaru belum dijalankan: `docker version` gagal menemukan named pipe dockerDesktopLinuxEngine. Ini bukan hasil uji integrasi yang lulus. NAS tidak diakses/diubah, tidak ada upload dokumen asli. Produksi terakhir terverifikasi tetap v2.1.0. Update ini perlu digabung dengan perubahan role tertunda, build/test Linux/browser di laptop, backup DB+file produksi baru, restore/rehearsal migrasi dan rollback yang mempertahankan dokumen existing sebelum deployment pada service lama. Jangan memakai tooling pengosongan register/transisi awal.

## Update role v2.1.1 tertunda — 28 Oktober 2026

Pengguna memilih melanjutkan saat kembali ke kantor karena laptop sedang di rumah dan tidak dapat mengakses NAS. Tidak ada backup produksi baru, migrasi role atau deployment v2.1.1 yang dijalankan. Produksi terakhir yang terverifikasi tetap v2.1.0; inventaris NAS terakhir sebelum jeda mencatat 105 dokumen dan enam akun. Jumlah saat melanjutkan wajib diperiksa ulang.

Permintaan final: tiga role Super user (admin), Editor (bidang wajib; lihat/download semua bidang, edit hanya bidang akun tanpa pengecualian owner), dan Viewer (lihat/download tanpa upload/update). Kelola Pengguna memakai pilihan role lalu dropdown bidang wajib untuk Editor. Role lama dipindahkan ke role penggantinya sebelum dihapus; password, metadata akun, dokumen, versi dan audit dipertahankan. Di Sampah, pilihan manual/halaman/semua dibatasi 20 agar sesuai batas hapus permanen.

Source lokal perubahan dan tests tersedia. Sebanyak 68 test lokal serta TypeScript/detector pernah lulus pada tahap sebelumnya, tetapi penambahan tes integrasi/UI dan perbaikan SELECT id,name untuk validasi role belum melewati seluruh pengujian ulang. Build percobaan tag edms-ups:2.1.1 sebelumnya belum memuat semua perubahan terakhir; jangan deploy image itu sebagai rilis final. Scripts role-migration.mjs dan role-rehearsal.mjs tersedia, serta verify-nas-backup.ps1 kini menerima -RehearseRoles. Rehearsal role/rollback belum dijalankan. Docker Desktop dicoba dinyalakan pada 28 Oktober, tetapi API Linux masih tidak tersedia pada pemeriksaan terakhir.

Saat melanjutkan: selesaikan build/test Linux dan browser terbaru di laptop; inventaris NAS read-only; siapkan tool backup/update baru untuk produksi yang sudah berisi dokumen; backup DB+file konsisten dan restore/rehearsal role/rollback pada salinan lokal; baru migrasikan role dan ganti service lama, smoke dummy dengan cleanup selektif serta verifikasi seluruh data tetap ada. Jangan gunakan helper pengosongan register atau checkpoint transisi rilis pertama. Tool backup/update lanjutan belum selesai disiapkan.

## Deployment NAS lulus — 23 Oktober 2026, LAN internal

EDMS v2.1.0 berjalan pada http://10.10.200.166:3000. Pengguna mengonfirmasi hanya akses internal seperti v1; tidak menggunakan domain publik. NAS mencetak `NAS_DEPLOY_PASS /share/Container/edms-backups/cutover-20261023T070635Z-12981`. Pemeriksaan independen dari laptop: halaman HTTP 200, health `{ok:true,version:"2.1.0",database:true}`. Inspect akhir: image `edms-ups:2.1.0`, running/healthy, OOMKilled=false; mount `/share/Container/edms-app:/app` dan `/share/Container/edms-app/storage:/app/storage` tetap. Hanya service `edms-app` dalam project/container lama yang direkreasi. Tunnel tetap stopped setelah maintenance, sesuai penggunaan LAN tanpa domain publik; service lain tidak direkreasi.

Register kosong sesuai keputusan pengguna. Manifest 87ea2acb5037933c3a54615d70c76374223abca8cd8e5833731daffee68fee65 menghapus 93 record dokumen/versi/file, 185 import item, 5 job, 5 upload dan 17 part. Lima belas tabel terlindungi terverifikasi; enam akun aktif, roles, master serta audit lama dipertahankan. File original pemulihan tetap disimpan; tidak menghapus folder sumber Dokumen Final, logo, source, backup, seluruh DB atau volume. Tidak ada impor asli pada deployment ini.

Rehearsal paket terakhir `nas-cutover-825e7356` lulus `DUMMY-RESTORE-0203d30deb13`: runtime, smoke, restart serta restore DB dan 93 original pada salinan laptop. Smoke NAS aktual lulus upload/finalisasi idempoten/download/hash, PDF-ke-DOCX, DOCX/XLSX-ke-PDF, acknowledgement converted Word, update/konflik, ZIP partial, metadata/versi, sampah/pulihkan, bulk/filter/duplikat, ZIP original, kelola akun/RBAC, lease ekspor dan hapus permanen dummy. Seluruh record/file/job dummy dibersihkan selektif; salinan pemulihan permanent-delete dummy juga dibersihkan melalui test_tag dan manifest. Direktori recovery dummy akhir kosong. Bukti `smoke-verified.json` mengonfirmasi protectedDataVerified/registerEmpty=true, rehearsal=false.

Restart akhir memakai `docker restart edms-ups-app`. Health diperiksa dari dalam container yang sama; tiga preflight berturut-turut lulus setelah restart dan tiga lagi setelah publikasi port LAN. Seluruhnya database/storage/secret/Python/LibreOffice=true, linux/x64, productionReady=true. File bukti: `stable-final-restart-preflight-*.json`, `stable-final-published-preflight-*.json`, `final-app-state.json`, `deployment-result.txt` pada checkpoint di atas.

Pengukuran sembilan sampel selama smoke: puncak teramati 416,4 MiB dan CPU 93,54%; sampel setelah publikasi 92,43 MiB/CPU 0%. Ini sampel smoke sintetis, bukan jaminan beban semua dokumen atau pengguna bersamaan. Log mentah `resume-backup-directory-resource-during-smoke.jsonl` dan rangkuman `resource-summary.json` disimpan pada checkpoint.

Koreksi operasional yang diperlukan: origin awal mengasumsikan HTTPS publik, lalu dibatasi agar menerima tepat origin LAN yang dikonfirmasi; helper smoke kini memisahkan alamat koneksi container dari Origin browser. Folder storage `backups/permanent-delete` disiapkan dengan UID 1000 dan izin terbatas, setelah smoke mengungkap runtime tidak dapat membuatnya pada root storage. Prosedur Compose stop/start tidak menyalakan container kembali pada uji NAS; restart langsung terbukti berhasil. Beberapa preflight setelah helper health eksternal mengalami ETIMEDOUT; akar intermitennya belum dibuktikan. Pemeriksaan langsung dalam container dan tiga preflight berturut-turut lulus pada finalisasi. Tidak ada perubahan mapping DB/port, reset akun atau pelemahan CSRF untuk mengatasi hasil tes ini.

Rollback otomatis pada percobaan sebelumnya benar-benar memulihkan DB dan 93 original; checkpoint runtime lama berisi Chromium disimpan sebagai image/tar sekitar 3,1 GB. Ketika hasil rollback menetapkan user root pada Compose, konfigurasi pra-cutover dipulihkan dari `compose-before.yml`, dan konfigurasi hasil rollback disimpan terpisah. Semua checkpoint kegagalan tetap tersedia. Backup pra-transisi tetap `/share/Container/edms-backups/edms-pre-v2-20261023T030626Z-25519`.

Helper `nas-resume-verified-cutover.sh` dan `nas-finish-verified-cutover.sh` hanya untuk checkpoint di atas; receipt dan marker menolak pemakaian ulang. Jangan menjalankan manifest transisi awal atau mengembalikan backup lama pada produksi aktif. Update selanjutnya memerlukan backup DB+file baru dan prosedur yang mempertahankan dokumen baru. Pemulihan setelah publikasi harus menghentikan penulisan dan menjaga data baru sebelum memilih restore konsisten. Catatan di bawah adalah riwayat sebelum deployment ini.

## NAS storage readiness lulus; tooling cutover disiapkan

23 Oktober 2026. Pengguna melaporkan NAS_TRANSITION_CHECK_PASS: snapshot DB masih cocok dengan manifest 87ea2acb5037933c3a54615d70c76374223abca8cd8e5833731daffee68fee65, backup/checkpoint 93 original dan merged Compose tervalidasi. Hambatan awal EACCES berasal dari akses /app pada UID 1000. Empat direktori v2 baru dibuat dengan owner 1000:1000/mode 750; ACL r-x untuk UID 1000 ditambahkan hanya pada /share/Container/edms-app dan storage. ACL sebelumnya tersimpan di /share/Container/edms-backups/storage-access-before-v2-20261023T055923Z-27138.acl. Probe tulis/hapus unik DUMMY pada originals/derived/staging/work semuanya lulus. Bukti NAS_CHECK_READY: /share/Container/edms-backups/transition-check-20261023T055929Z-32662. Database belum dikosongkan dan runtime lama masih stopped.

Tool baru: prepare-nas-cutover.mjs, verify-nas-cutover.ps1, nas-cutover.sh, nas-cutover.mjs dan nas-cutover-lib.mjs. Paket lokal yang disiapkan: release/nas-cutover-00b2a18e (sekitar 58 KB, hanya helper/test/fixture dummy; memakai transition-package 453aaecb yang sudah berada di NAS). Verifier memulihkan backup yang sudah lulus dari laptop ke DB internal Docker tanpa published port, membuat akun runtime MariaDB baru dengan DML terbatas pada tabel aplikasi/SELECT referensi, merender konfigurasi Compose, menjalankan transaksi manifest yang sama, runtime Linux, smoke dummy lengkap, restart, restore DB baseline dan pemulihan 93 original dari checkpoint ke volume uji berdasarkan hash tanpa overwrite. Hanya bila semuanya lulus verifier menulis rehearsal-pass.json terikat SHA-256 kode/fixture paket. Ini rehearsal baru untuk prosedur cutover/runtime-account/rollback, bukan pengulangan gate backup yang sudah lulus.

Wrapper NAS menolak paket tanpa bukti rehearsal yang sesuai. Sebelum pembersihan, wrapper mengulang check yang sudah lulus, menyimpan source Compose dan checkpoint original terpisah dari storage aktif, serta commit/save filesystem container lama. Checkpoint terakhir ini diperlukan karena Chromium dipasang pada writable layer container lama, tidak terdapat dalam save image base node:20-alpine. Rollback memakai image checkpoint tersebut, command lama dan mount aktual /share/Container/edms-app/storage (bukan edms-data yang masih tertulis pada base Compose lama).

Runtime v2 disiapkan melalui service/project/container yang sama; base Compose disimpan sebagai JSON valid YAML agar Container Station berikutnya juga memakai image baru, sementara resource-file dan service lain tidak diedit. Secret lama tetap sama, DB runtime memakai akun baru terbatas, dollar literal dalam secret/command di-escape untuk Compose. APP_ORIGIN publik dibaca dari konfigurasi HTTPS yang ada atau route Cloudflare untuk service EDMS; jika ambigu/tidak ditemukan, berhenti sebelum cleanup dan minta EDMS_PUBLIC_ORIGIN yang konkret. Tunnel EDMS dihentikan selama smoke; port app dibatasi ke loopback sampai dummy smoke dan restart lulus. Sesudah itu port lama dan status tunnel dipulihkan. Resource CPU/memori app selama smoke direkam di checkpoint.

Jika gagal sesudah cleanup tetapi sebelum akses dibuka, wrapper menghentikan EDMS, memastikan tidak ada client DB lain, memulihkan SQL baseline, memverifikasi snapshot dan memulihkan original yang hilang dari checkpoint secara eksklusif/hash, kemudian menjalankan runtime lama; tunnel tetap stopped untuk inspeksi. Sesudah tahap publikasi dimulai, kegagalan menahan app dan mempertahankan DB agar tidak menimpa kemungkinan tulisan baru dengan backup lama. Tidak ada DROP DATABASE/reset akun, upload dokumen asli sebagai smoke, sinkronisasi storage laptop ke NAS, atau recreation service lain.

Tujuh test cutover baru lulus: retensi konfigurasi service/secret dan staging loopback; escaping CNF; pemilihan origin dari route tunnel dan penolakan ambigu; retensi akun/master/audit setelah smoke; restore original tanpa overwrite; guard entry point/host uji; pemilihan role read-only yang sudah ada tanpa seed/perubahan roles. Snapshot NAS memiliki Tim Mutu dan tidak memiliki Viewer; smoke memakai Tim Mutu untuk uji read-only (fixture edms_dummy tetap bisa memakai Viewer). Dua puluh satu test tools transisi/backup sebelumnya juga sudah lulus. Sintaks JavaScript dan parser PowerShell lulus; sh -n dan integrasi Docker cutover akan diperiksa oleh verifier di PowerShell pengguna. Docker API dari sesi agen masih permission denied; rehearsal cutover dan deployment NAS belum diklaim lulus.

## Rehearsal register kosong lulus d1d626a66e24

23 Oktober 2026. Pengguna memberikan hasil EMPTY_REGISTER_REHEARSAL_PASS dan NAS_BACKUP_RESTORE_PASS; receipt lokal juga diperiksa. Manifest transisi 87ea2acb5037933c3a54615d70c76374223abca8cd8e5833731daffee68fee65, terikat backup A246FD1A266B1292541893CF4E45E8371EC54C998E1BC41CCA44DFFB4D9C0B58. Salinan restore berhasil dikosongkan: 93 dokumen/versi/file, 185 import item, 5 job, 5 upload dan 17 part. Lima belas tabel terlindungi dipertahankan, tidak menghapus file fisik, manifest usang ditolak. Produksi tidak disentuh.

Tool prepare-nas-transition.mjs menyiapkan paket manifest/receipt/tool pemeriksaan serta checkpoint tambahan 93 original dari storage laptop. Hash sumber dan salinan diverifikasi; tidak mengubah original atau menimpa NAS. Checkpoint terpisah ini menutup kekurangan original v2 yang tidak ada di arsip storage NAS. Paket belum dipindahkan ke NAS oleh agen.

nas-transition-check.sh/mjs memeriksa image amd64 yang disetujui, container lama tetap stopped, service/project/mount yang sama, checksum backup, checkpoint original, hasil merge Compose dan konfigurasi rahasia tanpa mencetaknya. Koneksi DB menjalankan transaksi READ ONLY dan mengharuskan snapshot sama dengan manifest rehearsal serta tidak ada client lain yang terhubung ke edms_ups. Sesudah pemeriksaan DB, probe DUMMY ber-UUID ditulis/dihapus sebagai UID 1000 pada empat direktori storage v2 (direktori dibuat bila belum ada); akun/data dokumen/Compose/runtime tidak diubah. Pemeriksaan NAS aktual dan cutover masih menunggu eksekusi SSH pengguna. Dua puluh satu test/subtest lokal lulus, termasuk checkpoint tidak menimpa file, hash/path guard dan penolakan invocation langsung. Image aplikasi tidak perlu dibuild ulang.

## Keputusan register kosong, 23 Oktober 2026

Pengguna memilih "kosong aja": register v2 yang berisi 93 dokumen pada snapshot NAS akan dikosongkan saat transisi. Ini memperbarui batas sebelumnya yang belum mengizinkan penghapusan register v2. Akun, roles, reference/master, konfigurasi, seluruh audit lama, source, Dokumen Final, logo dan backup tetap dipertahankan. Tidak ada penghapusan original di laptop atau filesystem NAS oleh tooling tahap ini. Sebelum apply produksi, file original yang hanya ada di laptop perlu checkpoint tambahan untuk pemulihan relasi backup DB; jangan menimpa storage NAS dengan storage laptop.

`scripts/empty-register-core.mjs` membuat manifest ID untuk tujuh tabel dokumen/impor v2, terikat SHA-256 manifest backup serta hash snapshot seluruh data. Apply memakai advisory lock sampai commit/rollback, transaksi SERIALIZABLE, pemeriksaan snapshot terkunci, DELETE per primary key, pemeriksaan seluruh tabel terlindungi dan satu audit transisi. Tabel tak dikenal, trigger, legacy document/export yang tidak kosong, relasi di luar manifest, perubahan sejak snapshot atau kegagalan DELETE memblokir atau rollback. Tidak memakai DROP/TRUNCATE, menonaktifkan FK, menghapus audit atau melakukan DDL.

`verify-nas-backup.ps1 -RehearseEmptyRegister` memulihkan ulang backup ke database Docker laptop tanpa published port, memverifikasi backup, lalu menjalankan transaksi tersebut hanya pada salinan restore. Entry point menolak host selain identitas container DUMMY-RESTORE. Bukti berupa empty-register-plan.json dan empty-register-result.json; manifest lama dicoba ulang untuk membuktikan penolakan tanpa perubahan. Ini belum merupakan apply/deploy NAS dan tidak menghapus file fisik.

Pengujian lokal `node --test tests/empty-register.test.mjs tests/backup-tools.test.mjs`: 18 test/subtest lulus. Cakupan baru mencakup retensi akun/master/audit, rollback setelah sebagian DELETE, efek samping terhadap akun, manifest usang/retry, tabel tak dikenal, lineage asing, export aktif dan penolakan host produksi. Parser PowerShell lulus. Rehearsal MariaDB belum dijalankan: akses Docker API dari sesi agen ditolak permission denied; pengguna perlu menjalankan perintah pada PowerShell biasa. NAS tetap maintenance dan belum diubah oleh pekerjaan ini.

## Restore lulus ef1d0a13764a; ditemukan referensi storage v2 di laptop

23 Oktober 2026. Result DUMMY-RESTORE-ef1d0a13764a diperiksa: passed/backupChecksums/databaseRestoreVerified/storageBackupVerified/composeRestoreVerified/restoreVerified=true. Manifest SHA-256 A246FD1A266B1292541893CF4E45E8371EC54C998E1BC41CCA44DFFB4D9C0B58. Seluruh 22 tabel/objek dan hash file arsip dipulihkan pada laptop. NAS masih maintenance, runtime belum diganti.

Audit salinan backup menemukan documents lama berjumlah 0 (sections/versions/approvals/relasi juga 0); audit_logs 802 tetap harus dijaga. v2_documents/v2_versions/v2_files masing-masing 93, semuanya tanpa test_tag; 6 akun, 5 role, 14 reference independen dan 9 master tersedia. Ini data v2 yang sudah ada, bukan sasaran otomatis legacy-cleanup. Jangan menghapus register v2 atau audit hanya karena deploy.

Pencocokan v2_files dari dump terhadap app-files.sha256 menunjukkan semua 93 disk_path original tidak ada dalam storage NAS yang dibackup. File yang sama ditemukan pada edms-v2/storage di laptop; seluruh 93 SHA-256 cocok dengan DB. Kelulusan restore sebelumnya memverifikasi isi arsip dan DB, belum membuktikan setiap referensi DB memiliki file di NAS. Ada 5 job impor (4 done, 1 partial) yang konteks staging/work dan payload path-nya juga perlu dipetakan bila data v2 dipertahankan. Jangan menyalin seluruh storage laptop atau menimpa NAS; pemulihan harus berbasis manifest file/referensi yang dipilih dan hash.

Audit Compose: docker-compose.yml cadangan masih menuliskan /share/Container/edms-data:/app/storage, berbeda dari inspect container aktif /share/Container/edms-app/storage:/app/storage. compose.override.yml source sekarang secara eksplisit mempertahankan kedua mount aktif untuk mencegah perpindahan ke storage yang salah ketika service dibuat ulang. Konfigurasi NAS belum diubah. Data v2 existing dan penempatan original perlu dipastikan sebelum cutover.

## Restore laptop ee963e4f8e9d tertahan; readiness autentikasi diperbaiki

23 Oktober 2026. Backup checksum lulus dengan manifest SHA-256 A246FD1A266B1292541893CF4E45E8371EC54C998E1BC41CCA44DFFB4D9C0B58. Restore sementara DUMMY-RESTORE-ee963e4f8e9d gagal sebelum SQL dipulihkan: ERROR 1045 root@localhost. Tidak ada akses tulis ke DB NAS. Backup sumber edms-pre-v2-20261023T030626Z-25519 tetap tersedia dan aplikasi NAS masih maintenance.

Pemeriksaan readiness lama memakai mariadb-admin ping, yang bisa mengembalikan exit 0 meskipun login ditolak dan dapat menjangkau server socket sementara selama initialization. Skrip kini memakai restore-test-db.ps1: identitas container DUMMY-RESTORE wajib cocok, server harus tetap berjalan, login TCP 127.0.0.1:3306 ke database restore harus menjalankan SELECT 1 dengan exit 0 dan jawaban 1. Import SQL menggunakan endpoint TCP yang sama. Ini memperbaiki kondisi tunggu; keberhasilan autentikasi/restore aktual masih perlu dibuktikan dengan run berikutnya.

Log dan state DB test disimpan sebelum cleanup. Container helper yang belum dibuat tidak lagi dilaporkan sebagai masalah cleanup. Tidak mereset password produksi atau mengubah konfigurasi MariaDB NAS. Sebelas test alat backup/restore termasuk simulasi readiness autentikasi dan penolakan identitas container produksi lulus; sintaks PowerShell lulus. Tidak perlu membuat ulang backup NAS atau rebuild image untuk perbaikan skrip laptop ini.

## Backup NAS selesai; maintenance aktif - edms-pre-v2-20261023T030626Z-25519

Pengguna melaporkan BACKUP_READY_FOR_RESTORE /share/Container/edms-backups/edms-pre-v2-20261023T030626Z-25519. Semua checksum lulus: database.sql, app.tar.gz, app-files.sha256, table-names.txt, table-counts.tsv, db-objects.tsv, old-runtime-image.tar, old-container.inspect.json, compose-project.tar, db-version.txt, dump-version.txt, event-policy.txt. Ini bukti backup konsisten dibuat oleh skrip, belum bukti restore berhasil.

edms-ups-app kini STOPPED untuk maintenance sesuai output skrip. Tunnel dan service lain tidak diubah. Belum ada penghapusan data, migrasi produksi atau penggantian runtime. Langkah berikutnya verify-nas-backup.ps1 dari laptop dengan -Backup \\10.10.200.166\Container\edms-backups\edms-pre-v2-20261023T030626Z-25519. Bila maintenance dibatalkan sebelum transisi, docker start edms-ups-app menjalankan runtime lama; backup baru diperlukan jika ada penulisan setelahnya sebelum cutover.

## Pemeriksaan event MariaDB dikoreksi sebelum maintenance - 23 Oktober 2026

Setelah perbaikan credential privat, akses native DB berhasil. Run pengguna berhenti saat SELECT information_schema.EVENTS memberi error 1577 karena scheduler dinonaktifkan; pesan lama Active DB events terlalu umum, bukan bukti event aktif. Belum mencapai docker stop atau dump.

Probe event kini membaca status scheduler dan metadata melalui koneksi read-only. Definisi yang dapat dibaca tetap diikutkan (--events). Hanya jika error tepat 1577, scheduler OFF/DISABLED, dan mysql.event memastikan nol record untuk edms_ups, dump menggunakan --skip-events; objek lain tetap dicadangkan. Definisi yang ada tetapi tidak dapat diekspor, akses sistem ditolak, atau metadata tidak diketahui membuat backup ditolak. Tidak menjalankan SET GLOBAL, repair, restart MariaDB atau mengaktifkan scheduler. event-policy.txt masuk checksum dan jumlah event diverifikasi kembali saat restore. Backup aktual masih menunggu upload ulang script NAS; image aplikasi tidak perlu rebuild.

Enam skenario dummy probe diuji: scheduler disabled dengan nol event, event yang tidak dapat dibaca tetapi ada, penolakan baca mysql.event, scheduler ON dengan metadata gagal, definisi tetap dicadangkan saat scheduler OFF, dan event aktif saat scheduler ON. Seluruh test alat backup/restore lulus (10 test termasuk subtest); sintaks Node/PowerShell juga diperiksa. Tidak ada klaim backup/restore/cutover NAS berhasil.

## Backup NAS pertama tertahan sebelum maintenance - 23 Oktober 2026

Run edms-pre-v2-20261023T025913Z-12729 berhenti pada validasi native DB. MariaDB mengabaikan db-client.cnf pada shared folder karena mode world-writable, sehingga opsi TCP/port tidak dibaca dan client mencoba socket /tmp/mysql.sock. Belum mencapai docker stop, dump atau perubahan runtime; ini bukan bukti password salah. Backup tersebut tidak lengkap dan tidak boleh dipakai untuk restore/cutover.

nas-backup.sh diperbaiki: credential sementara berada di direktori mktemp privat /tmp, chmod/stat memverifikasi direktori 700 dan file 600; cleanup hanya file/direktori sementara milik run sendiri. TCP 127.0.0.1:3307 kini eksplisit pada client/dump agar tidak fallback socket. Error autentikasi dipisahkan dari salah database. Perbaikan masih memerlukan upload ulang script dan eksekusi NAS; belum ada klaim backup/restore berhasil.

## Identitas image NAS sesuai; alat backup/restore disiapkan - 23 Oktober 2026

Inspect NAS menampilkan sha256:e7b383b2f9faa5fe7b1b12324c354adf968d602f9fb8a0cf02c1d070d125823a linux/amd64. Pemeriksaan byte arsip lokal membuktikan ini config digest dari manifest linux/amd64 sha256:43c4a8d610c9cde89760cd9fe3552ac748c7a542b7acd1500702d065b2a0a12a, yang berada di OCI index sha256:3c028487b4bc794fd7a4502391ede6af0e5be8f3bc4e86cecaafa5138085c4ba yang diuji. Jadi perbedaan ID inspect laptop/NAS bukan image yang berbeda. SHA arsip tetap BCE963E57E3A47209E587204449D399F74C749314D1E2A998CF32E814E181DB8.

Inventaris pengguna: aplikasi 1.4G, DB host.docker.internal:3307 database edms_ups dengan user/password/JWT tersedia (nilai rahasia tidak dicetak). Native dump tersedia pada /share/CACHEDEV1_DATA/.qpkg/MariaDB10/bin/mariadb-dump. Binary client mariadb/mysql masih dicek otomatis oleh skrip.

scripts/nas-backup.sh menyiapkan backup berversi di /share/Container/edms-backups, menyimpan image lama/inspect/Compose, menghentikan hanya edms-ups-app, lalu dump DB, jumlah baris/objek, arsip lengkap app+storage dan checksum file. Konfigurasi client sementara berizin privat dihapus setelah selesai; password tidak dimasukkan argv. Non-InnoDB, event DB aktif, DB yang tidak cocok atau sesi DB lain membuat skrip menolak; kegagalan setelah stop mencoba memulai aplikasi lama kembali. Sukses membuat aplikasi tetap STOPPED untuk restore verification. Laptop/dev writer harus dihentikan lebih dulu. Skrip tidak menjalankan migrasi, cleanup atau penggantian container; sh -n di NAS wajib lulus sebelum menjalankannya.

scripts/verify-nas-backup.ps1 menerima -Backup (path backup yang dapat dibaca laptop), menyalin dan memverifikasi checksum, lalu restore SQL dalam MariaDB sementara di laptop pada network internal tanpa published port. verify-restored-db.mjs menolak host selain container DUMMY-RESTORE sendiri, tidak memuat env produksi, dan memeriksa semua tabel/count, akun serta objek DB. Arsip app/storage dipulihkan ke volume test Linux, semua hash file dan file Compose diperiksa. Cleanup container/network/volume hanya untuk label run yang cocok; NAS tidak disentuh. Receipt restoreVerified hanya dihasilkan setelah pemeriksaan DB dan file berhasil.

Tiga test lokal lulus: escaping secret client config, penolakan host NAS sebelum koneksi restore, serta penolakan checksum korup/manifest tidak lengkap sebelum resource Docker dibuat. Sintaks Node dan PowerShell lulus. Eksekusi shell/Git Bash diblokir sesi agen, jadi sintaks shell dan backup/restore aktual belum diklaim lulus. Tidak ada maintenance/backup/restore/purge/deploy produksi yang dijalankan dari sesi ini. Alat baru adalah skrip operasional di luar image; tidak memerlukan rebuild image aplikasi teruji.

## Image rilis dimuat di NAS - 23 Oktober 2026

Pengguna menjalankan docker load -i /share/Container/edms-release/edms-ups-2.1.0.tar; output berakhir Loaded image: edms-ups:2.1.0. Ini bukti import image, belum bukti penggantian container atau runtime v2 di NAS. Image ID di NAS masih perlu dicocokkan dengan image teruji sha256:3c028487b4bc794fd7a4502391ede6af0e5be8f3bc4e86cecaafa5138085c4ba. Backup DB+file konsisten, restore, manifest transisi dan smoke NAS belum diklaim lulus. Jangan menjalankan cleanup/deploy lama yang menyalin payload Windows ke NAS.

## Inventaris NAS dari terminal pengguna - 23 Oktober 2026

Pemeriksaan lanjutan: uname=x86_64 (sesuai linux/amd64), volume /dev/mapper/cachedev1 memiliki 237.9G tersedia dari 1.6T, pemakaian 86%. Container lama working_dir=/app, User kosong (default image), restart=always. Compose project edms-mutu-system, service edms-app, versi Compose pembuat container 2.29.1. ConfigFiles: /share/CACHEDEV1_DATA/.qpkg/container-station/data/application/edms-mutu-system/docker-compose.yml dan docker-compose.resource.yml. Network edms-mutu-system_default, alias edms-ups-app/edms-app, gateway 172.29.8.1. Simpan kedua konfigurasi Compose dalam backup sebelum mutasi; jangan mencetak isi env/secret atau mengganti service lain. Belum ada bukti backup/restore, import image ataupun cutover.

docker ps menunjukkan edms-ups-app berjalan dengan image node:20-alpine dan port host 3000 ke container 3000; edms-cloudflare-tunnel memakai cloudflare/cloudflared:latest. Ada service lain ups-earsip-gateway-v3 (18080) dan monitoring-kebersihan-gateway (18081) yang tidak termasuk sasaran update.

docker inspect edms-ups-app membuktikan bind mount read-write /share/Container/edms-app ke /app serta /share/Container/edms-app/storage ke /app/storage. Karena rilis v2 menetapkan STORAGE_ROOT=/app/storage, file akan persisten pada direktori storage NAS tersebut apabila mount ini dipertahankan saat penggantian image. Izin tulis UID runtime baru masih perlu diuji. Jangan menyalin storage laptop ke mount ini. Konfigurasi Compose/launch, ruang disk, backup/restore dan transisi belum diperiksa; runtime NAS belum diganti.

## Rilis terbaru lulus lokal - DUMMY-8528b15de030

23 Oktober 2026. result.json terbaru diperiksa: passed=true, coreTests=true, linuxRuntime=true, integration=true, browserUi=true, productionTouched=false. Image teruji sha256:3c028487b4bc794fd7a4502391ede6af0e5be8f3bc4e86cecaafa5138085c4ba. Platform linux/amd64. SHA-256 tar rilis BCE963E57E3A47209E587204449D399F74C749314D1E2A998CF32E814E181DB8 cocok dengan release/SHA256.txt. Verifikasi mencakup suite UI, layout dan UX yang sebelumnya terhenti.

Percobaan akses sesudah kelulusan masih ditolak: Docker API named pipe permission denied, SSH 10.10.200.166:22 permission denied. Tidak ada perubahan NAS. Mount aktual, backup DB+file konsisten, restore backup, manifest transisi dan smoke NAS belum diverifikasi. Kelulusan laptop bukan bukti deployment atau kesiapan runtime NAS.

## Verifikasi DUMMY-3ceb5e4a5b6d: layout lulus, penantian tes pairing dikoreksi

23 Oktober 2026. Linux preflight, integrasi database/pengelolaan dan UI utama lulus. Sidebar/layout lulus pada 1440x900, 1024x500, 820x700 dan 390x700: top=0 setelah scroll 700 px, logout terlihat, tidak ada overflow; menu desktop pendek dapat scroll sendiri.

Tes UX mencapai pemilihan pasangan, kemudian timeout pada kondisi global tidak ada button[disabled]. Pada Upload & Impor, tombol Upload memang tetap disabled ketika tidak ada file dipilih setelah pembatalan; kondisi global itu tidak dapat dipenuhi walaupun penyimpanan pasangan berhasil. Penantian diperbaiki agar memeriksa respons POST resolve berstatus 200 dan tombol Simpan dan proses ulang kembali aktif. Assertion itemId, mode attach, documentId, expectedVersion, expectedLockVersion dan revisi memastikan permintaan pasangan benar. Ditambah penanda tahap dan screenshot/diagnostik alert serta tombol disabled bila gagal, tanpa mengubah UI runtime atau melewati test.

Sintaks ux.mjs lulus. Verifikasi UX penuh belum diklaim lulus dari sesi agen; ulang verify-release.ps1 dengan image yang sama, tanpa rebuild. NAS belum berubah.

## Verifikasi DUMMY-771642edeaa1: UI lulus, selector tes layout dikoreksi

23 Oktober 2026. Hasil pengguna dan log lokal membuktikan integrasi Linux/database tetap lulus dan tests/ui.mjs kini mencetak UI_PASS, termasuk overflow responsive setelah koreksi tableScroll. Tahap berikutnya timeout pada tests/layout.mjs: klik Histori Aktivitas, bukan assertion posisi sidebar.

Source Puppeteer yang terpasang menunjukkan NodeLocator menunggu elemen pertama dari selector; filter memeriksa elemen tersebut, bukan mencari semua kandidat. Karena nav button pertama adalah Ringkasan, filter textContent Histori Aktivitas tidak pernah terpenuhi. Tes layout diganti ke selector accessible name/role yang langsung menargetkan tombol Histori Aktivitas, ditambah assertion menu aktif dan penanda tiap viewport. Kasus serupa pada tests/ux.mjs (pemilihan tombol job Impor dokumen) diganti dengan pencarian seluruh tombol sebelum klik biasa. Assertion sidebar, scroll, overflow, detail histori, proteksi revisi dan pairing tidak dilewati.

Hanya skrip test lokal/dokumentasi berubah, tidak ada perubahan runtime image. Sintaks kedua skrip lulus; kelulusan layout/UX penuh masih menunggu verify-release.ps1 melalui PowerShell pengguna karena browser Puppeteer sesi agen tidak dapat diluncurkan. Tidak perlu rebuild untuk koreksi test ini; gunakan image yang baru saja lulus UI. NAS belum diubah.

## Verifikasi DUMMY-7da5cfad9cdd dan koreksi overflow mobile - 23 Oktober 2026

Hasil rilis terbaru membuktikan coreTests, linuxRuntime dan integrasi database/file lulus, termasuk upload/finalize/download, PDF-ke-DOCX, DOCX/XLSX-ke-PDF, warning, revisi/konflik dan ZIP partial. Browser UI berhenti pada register mobile: viewport 390 px tetapi documentWidth 583 px. Rilis belum lulus keseluruhan dan NAS belum berubah.

Penyebab direproduksi terpisah dengan markup dummy dan CSS source: span srOnly pada heading Tindakan berposisi absolute tanpa containing block di area scroll tabel. Label di kolom kanan lolos dari clipping tabel dan menambah lebar root. Menambahkan position:relative pada tableScroll menambatkan label ke area scroll tanpa menyembunyikannya dari pembaca layar. Ini bukan perubahan limit overflow pada test.

Reproduksi browser sintetis sebelum perbaikan: lebar root 569 px pada iframe 390 px. Dengan CSS yang diperbaiki, lebar root sama dengan viewport pada 1440/1024/820/390 px. Pada 390 px, fokus tombol Buka menggeser tabel sendiri (scrollLeft sekitar 259 px), tombol dapat dijangkau dan root tetap 390 px. Ini bukti isolasi layout, bukan kelulusan seluruh interaksi aplikasi. Halaman probe sementara dihapus sesudah pemeriksaan.

Regresi tests/ui.mjs ditambah untuk containing block heading aksesibilitas dan akses tombol terakhir melalui fokus pada mobile. Semua 38 test lokal, TypeScript dan sintaks test UI lulus; detector desain tidak menemukan masalah pada CSS yang diubah. Puppeteer sesi agen masih gagal diluncurkan (code 3221225506), sehingga suite UI penuh pada image baru tetap harus dijalankan melalui build-release.ps1 -Verify di PowerShell pengguna. Rebuild wajib karena CSS runtime berubah. Backup/restore dan smoke NAS tetap wajib sebelum cutover.

## Percobaan deployment 23 Oktober 2026

Pengguna meminta deployment ke NAS setelah perbaikan UX. Tidak ada perubahan runtime/data NAS yang berhasil dilakukan. Pemeriksaan read-only dari sesi agen: Docker Desktop Linux menolak akses API named pipe (`permission denied`); koneksi TCP ke NAS 10.10.200.166 port 22, 445, 3307 dan 8080 ditolak `EACCES`. Ini batas akses sesi, bukan bukti NAS mati atau password salah. Tidak meminta reset akses/akun dan tidak mengubah service lama.

Konfigurasi Dockerfile dan compose.override.yml menetapkan `STORAGE_ROOT=/app/storage`; originals/derived/staging berada di bawahnya. File akan persisten di NAS apabila `/app/storage` terhubung ke bind mount/volume NAS lama. Mount aktual dan izin tulis UID 1000 belum dapat diinspeksi; jangan mengklaim storage produksi telah terverifikasi. Metadata/versi/audit tetap menggunakan MariaDB `edms_ups`. Folder sumber Dokumen Final tidak dipindah/dihapus otomatis.

Image tar lokal bertanggal 22 Oktober belum mencakup perubahan UX 23 Oktober. Bukti lama `DUMMY-d986acc327c6` menunjukkan rilis sebelumnya lulus Linux/integrasi/browser, bukan bukti rilis UX terbaru. Wajib rebuild Linux di laptop lalu verifikasi ulang. `verify-release.ps1` kini turut menjalankan regresi resource, sidebar/layout dan UX (proteksi revisi, upload lintas menu dan pemilihan pasangan), selain integrasi dummy yang sudah ada. Sintaks PowerShell dan JavaScript diperiksa. Jangan memakai `-SkipBrowser` sebagai kelulusan UI untuk cutover.

Langkah di PowerShell laptop yang memiliki akses Docker: dari `edms-v2`, `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-release.ps1 -Verify`. Ini build/test lokal, bukan deploy. Sesudah rilis terbaru lulus, masih wajib inspeksi mount/runtime NAS, maintenance, backup DB+file konsisten, restore teruji, manifest transisi dan rollback sebelum mengganti service lama. Tidak ada backup/restore baru, cleanup data lama atau deployment yang diklaim selesai pada percobaan ini.

Pembaruan pengelolaan 22 Oktober 2026: lihat [FITUR_PENGELOLAAN_V2.md](FITUR_PENGELOLAAN_V2.md). Rilis sebelumnya lulus DUMMY-d986acc327c6. Fitur baru lulus 17 test lokal dan TypeScript, belum verifikasi Docker/browser. Catatan berikut juga memuat riwayat blocker sebelumnya.

22 Oktober 2026. Source tersedia di edms-v2. Belum dideploy ke NAS, belum dinyatakan siap produksi, dan data dokumen lama belum dihapus. Tidak ada dokumen asli yang diunggah.

## Yang sudah ditulis

- Next.js/TypeScript/CSS Modules dengan tema biru muda/kuning, logo Danantara/PLN lokal dan font lokal. Skill impeccable dibaca dan digunakan untuk struktur Operate, state, fokus dan responsive. Source UI belum dapat diverifikasi visual melalui browser pada sesi ini.
- Login memakai tabel users/roles lama, JWT audience v2, RBAC server-side, origin/CSRF check dan rate limit.
- Schema v2_ pada database edms_ups yang sama; helper pool/withTransaction; schema tidak dibuat otomatis saat startup.
- Upload individual/multiple dan ZIP, chunk 4 MB/resume/idempotent finalize, staging, antrean background dan lease/heartbeat.
- Ekstraksi ZIP streaming ke disk via Python dengan log per entri, batas ukuran/rasio, path/symlink checks, partial failure, retry dan CSV.
- Register/detail/pencarian/filter/pagination, download original, preview PDF, update langsung aktif, snapshot histori dan konflik versi.
- Pasangan format yang bentrok ditandai untuk diperiksa; tersedia alur perbaikan identitas/pairing secara manual.
- PDF-ke-DOCX lokal: PDF teks menjadi paragraf editable, halaman tanpa teks menjadi gambar DOCX tanpa OCR. Popup Batal/Lanjutkan dan ticket pengguna/file 2 menit diwajibkan server untuk download Word converted.
- Office-ke-PDF melalui LibreOffice dalam image Linux; job terbatas satu per waktu, timeout dan error/retry. Runtime Office belum tersedia di laptop sesi ini sehingga arah konversi ini belum diuji.
- Dockerfile linux/amd64 dan build-release.ps1 untuk build laptop, runtime di /opt/edms; override service lama tetap memakai mount /app dan /app/storage serta konfigurasi DB/Tunnel lama.
- Tool backup DB dan cleanup legacy terarah, mode default plan-only; apply membutuhkan bukti backup/restore, manifest file khusus dokumen serta maintenance. Tool ini belum dijalankan ke NAS.

## Konfigurasi

.env.local disalin dari edms-app ke edms-v2 dan diabaikan Git/Docker context. Kunci DB/session tersedia, pemeriksaan panjang JWT secret lulus. Nilai rahasia tidak dicetak. Akses DB belum berhasil, sehingga kecocokan koneksi tidak boleh dianggap terverifikasi. Runtime produksi tetap mewarisi environment lama; APP_ORIGIN harus cocok dengan origin publik yang sebenarnya dan STORAGE_ROOT=/app/storage.

## Bukti verifikasi

| Pemeriksaan | Hasil |
|---|---|
| TypeScript tsc --noEmit | Lulus |
| Kompilasi Next.js dan static page generation | Lulus sebelum tahap packaging |
| Packaging standalone Windows | Lulus dari PowerShell pengguna; BUILD_ID 179xhPmfCQ3rc5ZHFFWE3, server.js ditemukan dan aset/worker dilengkapi oleh prepare-standalone.mjs. Runtime Linux belum diverifikasi |
| 9 test inti dengan fixture sintetis | Lulus: path/RBAC/validasi/hash/ZIP rusak-partial/PDF-DOCX/ticket/scan/rasio Office |
| PDF-ke-Word teks dummy | DOCX nyata tervalidasi, teks termasuk pengesahan dummy tetap ada |
| PDF scan simulasi dummy | DOCX berisi image halaman dan catatan tanpa OCR |
| Dependency lock | npm ci dan build Linux berhasil melalui Docker di laptop pengguna; pengujian runtime/integrasi image masih menunggu |
| Detector UI impeccable | Satu warning font Inter lokal; dipertahankan karena aset tersedia dan tidak memerlukan fetch font |
| Browser/UI interactions | Belum lulus: browser process diblokir, tab browser localhost timeout |
| Upload DB/resume/revisi/konflik sebenarnya | Belum diuji; tests/integration.mjs disiapkan, DB ditolak EACCES |
| Browser test tests/ui.mjs | Disiapkan dengan API mock; tidak berhasil dijalankan dan bukan bukti upload DB |
| NAS/share/SSH | Tidak dapat diakses dari sesi ini; share false dan koneksi ditolak |
| Docker Linux | Build oleh pengguna berhasil. Image linux/amd64 diekspor 396.563.456 byte; akses Docker dari sesi agen tetap permission denied |
| Preflight runtime | Storage/Python/secret lulus; DB EACCES, LibreOffice tidak tersedia, runtime masih Windows |

Semua fixture ada di tests/output dan diabaikan Git. Tidak mengunggah file nyata dari Dokumen Final. Inventaris sumber read-only tetap 351 file, 194.708.120 byte pada pemeriksaan dokumentasi terakhir.

## Pekerjaan yang masih wajib sebelum produksi

1. Lingkungan yang mengizinkan Docker Linux, akses jaringan NAS/DB dan browser lokal.
2. Build image linux/amd64 di laptop telah berhasil; dependency native/runtime dalam image masih perlu diuji.
3. Jalankan schema dan dummy DB integration pada lingkungan uji/backup, termasuk restart/retry/concurrency dan semua izin. Jangan menjalankan integration bersamaan dengan job produksi; cleanup hanya dummy tag sendiri.
4. Verifikasi visual desktop/tablet/mobile, semua tombol dan dialog warning, termasuk pembatalan tanpa download.
5. Uji LibreOffice DOCX/XLSX-ke-PDF dengan dummy representatif serta ukur resource pada NAS 4 GB.
6. Hentikan penulisan sebelum backup DB+storage; verifikasi restore, manifest kepemilikan file legacy dan cleanup relasi. Jangan menghapus akun/config/master independen atau seluruh volume.
7. Update runtime service/container lama dengan mount/secret/jaringan yang sama, smoke dummy, bersihkan dummy dan baru buka akses. Impor asli dari Dokumen Final menunggu kesiapan; bukan test upload.

Build standalone Windows kini berhasil dari terminal pengguna. Payload dilengkapi public/.next/static/scripts/sql/src-lib dan manifest tanpa secret. Jangan menganggap dependency native Windows otomatis kompatibel dengan Linux atau memakai script deploy source lama sebagai pengganti rilis Linux teruji. Tidak ada klaim deployment atau semua fitur bebas bug sampai gate di atas lulus.

## Image Linux berhasil diekspor

Pengguna berhasil menjalankan build-release.ps1. Artefak release/edms-ups-2.1.0.tar berukuran 396.563.456 byte, platform linux/amd64. SHA-256 E076C92588C29FD69666005923E0BCBC859AAF7ACE85139DBD1BA27115DEA2CF cocok dengan file pada pemeriksaan agen. Ini bukti build/export, belum bukti runtime/produksi.

Skrip scripts/verify-release.ps1 disiapkan untuk PowerShell pengguna. Skrip menjalankan image rilis dengan MariaDB sementara di laptop, database edms_dummy, network/container berlabel run ID acak, binding port hanya loopback dan storage tmpfs. Uji mencakup dummy ZIP/file, update/konflik, download/acknowledgement, PDF-ke-Word, Word/Excel-ke-PDF dan UI mock pada image sebenarnya. Seluruh environment test dipulihkan dan container test dibersihkan. Skrip tidak membaca/mengubah dokumen NAS dan tidak memuat .env.local untuk seeding test. Database/container produksi tetap sama saat deployment nanti; container test hanya di laptop.

Sintaks PowerShell/JavaScript dan checksum artefak telah diperiksa. Eksekusi Docker/integrasi dari sesi agen tetap ditolak, sehingga hasil verifikasi skrip belum diklaim lulus. Jalankan dari PowerShell biasa: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1. Image yang sudah dibuild dapat digunakan langsung; perubahan saat ini hanya tooling/test, bukan runtime image.

## Perbaikan startup setelah verifikasi DUMMY-590efbd99203

Verifikasi berhenti pada startup aplikasi sebelum endpoint health siap. Log container tidak tersedia karena container aplikasi memakai --rm dan terhapus saat keluar; penggabungan stderr Docker ke pipeline juga dapat menghentikan pengambilan log pada Windows PowerShell 5.1.

Pemeriksaan isi tar rilis lama membuktikan /opt/edms/node_modules/jose/package.json tidak ada, sedangkan worker mengimpor jose melalui security.mjs. Pemeriksaan lokal check-runtime.mjs mereproduksi kegagalan payload lama: dependency jose hanya ditemukan di node_modules milik source di luar payload. Pemeriksaan pada source lengkap lulus. Ini cacat packaging, bukan bukti password database salah.

Perbaikan: jose menjadi serverExternalPackages dan disertakan eksplisit pada file tracing. Dockerfile menjalankan check-runtime.mjs sebagai user runtime agar dependency worker dan native canvas diuji sebelum image dinyatakan berhasil. prepare-standalone menolak dependency yang terselesaikan dari luar payload. verify-release mempertahankan container sampai log/state diambil, memisahkan stdout/stderr, mendeteksi proses yang keluar lebih awal, dan membersihkan container/volume hanya setelah label test cocok.

Build-release menerima -Verify agar rebuild image dan test dummy dapat dijalankan satu perintah. Sintaks JS/PowerShell dan dependency checker lokal sudah diperiksa; image perbaikan belum dibuild dari sesi agen karena akses Docker masih ditolak. Pengujian NAS/cutover tetap menunggu verifikasi rilis lulus. Tidak ada perubahan database/container produksi.

## Verifikasi DUMMY-52b7378b77a6

Build/startup image perbaikan lulus. linux-preflight.log menunjukkan database/storage/secret/Python/LibreOffice semuanya true, linux/x64 dan productionReady=true. Verifikasi terhenti pada Node integration; pesan error asli terpotong oleh pipeline stderr Windows PowerShell 5.1 sehingga hanya node:internal/modules/run_main:123 yang tercatat. Log aplikasi tidak memuat error server pada percobaan tersebut; penyebab kegagalan fitur belum dapat disimpulkan dari satu baris itu.

Perbaikan hanya pada tooling pengujian: Invoke-LoggedNode menjalankan Node dengan stdout/stderr terpisah dan menampilkan seluruh pesan setelah proses selesai. Semua langkah Node (core/seed/migrate/integration/UI) memakai helper tersebut. Integration memberi penanda tahap dan mencetak error primer sebelum cleanup supaya error cleanup tidak menyembunyikan penyebab awal. Uji lokal dengan exception dummy membuktikan stack trace lengkap tersimpan dan exit bukan nol tetap diteruskan.

Image tidak perlu dibuild ulang untuk perubahan tooling ini. Jalankan verify-release.ps1 langsung dengan image yang sudah lulus startup. NAS tetap belum berubah. Eksekusi integrasi masih memerlukan PowerShell pengguna karena akses Docker sesi agen ditolak.

## Koreksi status impor — DUMMY-24beb0e63d59

Error lengkap menunjukkan satu file DUMMY-prosedur.pdf berstatus success dan memiliki documentId, tetapi job impor berstatus partial. Penyebab pada worker: SUM(...) dari MariaDB dipetakan mysql2 menjadi string DECIMAL, sehingga string "0" dianggap truthy oleh count.failed ? 'partial' : 'done'. Ini bug perhitungan status, bukan kegagalan upload, format dummy, atau koneksi database.

Worker kini memakai importCompletion yang menormalisasi jumlah total/gagal menjadi angka, memvalidasi rentangnya dan hanya memilih partial bila jumlah gagal lebih besar dari nol. Angka audit memakai hasil normalisasi yang sama. Ditambah regresi untuk string "0", ZIP campuran, SUM null dan aggregate invalid; semua 13 pengujian lokal serta TypeScript lulus. Skrip verifikasi ikut menjalankan regresi baru. Perubahan worker perlu rebuild image dan verifikasi ulang; integrasi Linux setelah perbaikan belum diklaim lulus. Tidak ada pengujian dokumen asli atau perubahan NAS.
