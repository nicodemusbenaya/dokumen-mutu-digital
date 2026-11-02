# Pembaruan NAS 29 Oktober 2026

Status akhir: NAS_UPDATE_PASS. Versi 2.1.1 telah dipublikasikan di LAN; health dari laptop ok=true/database=true. Smoke dummy, retensi dan restart lulus. Sebanyak 108 dokumen, 109 file beserta hash, 6 akun dan histori existing dipertahankan. Receipt akhir berada di backup baru yang dicatat di bawah. Paket penerapan final adalah nas-update-c25f4f49; paket dc5dd89e dipertahankan sebagai checkpoint persiapan backup. Rehearsal final DUMMY-RESTORE-ba5d004ed3e8 lulus.

Backup baru yang selesai dan teruji: `/share/Container/edms-backups/edms-update-20261029T041103Z-23507`. EDMS telah dihentikan untuk snapshot; baseline berhasil memverifikasi 108 dokumen, 109 file dan 6 akun, hash snapshot `890ea6996be63f243307a4b4122cec386461d31f9e48673c094b38464fdc1b3a0`. Jangan menerapkan migrasi sebelum backup-state/manifest dan receipt restore/rehearsal baru benar-benar lulus.

## Rilis yang diuji

- Target aplikasi 2.1.1; upload tanpa deduplikasi, folder/subfolder ZIP otomatis, model role Super user/Editor/Viewer dan pilihan maksimal 20 dokumen di Sampah.
- Next.js dipatch dari 16.3.5 ke 16.4.3 beserta perbaikan transitif sharp/source-map-js. Audit runtime `npm audit --omit=dev` menghasilkan nol temuan. Empat temuan development pada graph Puppeteer tetap di luar runtime: pemeriksaan image memastikan puppeteer dan puppeteer-core tidak terkemas.
- Gate laptop lulus: `release/verification/DUMMY-9039dcc27a56/result.json` (`passed`, `coreTests`, `linuxRuntime`, `integration`, `browserUi` semuanya true). Browser UI, layout empat viewport, dan UX semuanya mencetak PASS.
- Image `edms-ups:2.1.1`, Linux amd64, identity lokal `sha256:c34408880a7a8229374a2ee9d415945389962cf49b8d426d6dac250ab88623dd`; identitas NAS diperiksa melalui arsitektur serta seluruh RootFS layer karena format ID Docker dapat berbeda antara index dan config.
- Paket `edms-v2/release/nas-update-dc5dd89e`, tar 397.151.744 byte, SHA-256 `bc1b82c48831fbadb1e469daa200dcf118bb7553c6738037816e23dbd102c266`. Lokasi NAS `/share/Container/edms-release/nas-update-dc5dd89e`. SHA256SUMS berformat LF telah lulus di Linux dan NAS.

Regresi awal menemukan import `validateFile` worker terhapus meskipun konversi masih memakainya. Import dipulihkan; image dibangun ulang dan kedua arah konversi lulus. Tes browser tambahan role sebelumnya memilih status Sampah pada halaman Deteksi Duplikat dan memakai `$eval` untuk menghitung kumpulan checkbox; navigasi dan penghitung diperbaiki tanpa melewati assertion. Ulang suite pada image final menghasilkan gate PASS di atas.

## Retensi dan prosedur update

Inventaris read-only NAS sebelum maintenance: 108 dokumen, 109 file, 6 akun, tanpa job/upload aktif; schema 001/002/003 dan role lama masih berlaku. Jumlah tersebut adalah inventaris sebelum backup, bukan asumsi untuk snapshot berikutnya. Seluruh data existing harus dipertahankan.

Helper baru `nas-update-backup.sh` membuat snapshot DB+seluruh app/storage, hash file, image lama dan konfigurasi Compose baru ke direktori `edms-update-*`. Kredensial administratif dibaca hanya dari file inspect checkpoint terlindungi lama karena `.env` administratif tidak berada pada source NAS. Kredensial tersebut sudah diverifikasi dengan SELECT 1. Ini tidak menggunakan SQL/data/manifest transisi lama untuk restore atau cleanup; seluruh operasi pemulihan update memakai backup baru.

Baseline seluruh record dan hash semua file dibuat setelah EDMS berhenti dan tidak ada klien DB lain. Hanya service/container `edms-app`/`edms-ups-app` pada project `edms-mutu-system`, network `edms-mutu-system_default`, mount dan port lama yang ditangani. Service lain dan source/storage laptop tidak disinkronkan ke produksi.

`verify-nas-backup.ps1 -RehearseUpdate -UpdatePackage <paket>` memulihkan backup baru pada MariaDB laptop dalam network internal, memverifikasi hash app/storage/Compose, menjalankan migrasi 004 role dan 005 upload pada salinan, memeriksa retensi serta retry, lalu memulihkan ulang SQL dan memeriksa snapshot rollback sama dengan baseline. Receipt terikat SHA paket, backup dan baseline; tidak dapat digunakan untuk paket/backup berbeda.

`nas-update-apply.sh --deploy <backup-baru>` menolak gate yang belum lulus, mengganti image pada service sama dengan staging port loopback, menjalankan smoke DUMMY, memeriksa retensi record/hash file, menguji restart dan tiga preflight, baru mempublikasikan port LAN lama dan mengulang tiga preflight. Resource selama smoke dicatat pada JSONL. Setelah publikasi dimulai, kegagalan menahan app dan data terkini; tidak otomatis menimpa kemungkinan tulisan pengguna dengan backup sebelumnya.

Sebelum publikasi, rollback hanya boleh dilakukan bila dokumen/file/versi baseline tetap utuh dan tidak ada dokumen baru non-DUMMY. State gagal serta manifest dummy disimpan; file/staging/work dummy baru dibersihkan selektif, SQL backup baru dipulihkan dan konfigurasi/runtime lama dikembalikan. Backup, audit baseline, seluruh original existing dan source pengguna dipertahankan. Tidak ada pengosongan register atau impor Dokumen Final sebagai test.
