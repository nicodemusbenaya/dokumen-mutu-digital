# EDMS Dokumen Mutu Digital — PLN UP Sertifikasi

Status 23 Oktober 2026: EDMS v2.1.0 sudah berjalan di NAS, akses internal [http://10.10.200.166:3000](http://10.10.200.166:3000). Smoke dummy, restart, health dan proteksi akun/master/audit lulus. Register mulai kosong; impor Dokumen Final terpisah. Lihat [bukti deployment](docs/IMPLEMENTASI_V2.md).

Arah baru: file PDF/DOCX/XLSX asli utuh; download, edit lokal lalu upload revisi. Upload/update pengguna berizin langsung aktif setelah validasi, tanpa approval bertingkat. Histori revisi aplikasi baru tetap tersimpan. PDF-only menyediakan konversi Word dengan popup peringatan sebelum download.

## Dokumentasi aktif

| Dokumen | Isi |
|---|---|
| [plan.md](plan.md) | Keputusan, tahapan, dummy-only test dan transisi |
| [Spesifikasi v2.1](Spesifikasi_EDMS_Dokumen_Mutu_UPS.md) | Kebutuhan target |
| [AGENTS.md](AGENTS.md) | Aturan implementasi/data/UI |
| [Deployment](QNAP_DEPLOYMENT_GUIDE.md) | Build laptop, NAS/infrastruktur sama |
| [Update dokumen](PANDUAN_UPDATE_DOKUMEN.md) | Alur upload revisi langsung |
| [Laporan penataan](docs/CLEANUP_2026-10-22.md) | Catatan perubahan dan koreksi keputusan |
| [Arsip](docs/archive/README.md) | Riwayat desain lama, bukan aturan aktif |

## Sumber dan infrastruktur

Mulai hanya dari Dokumen Final; inventaris awal 351 file (153 DOCX/195 PDF/3 XLSX). Register telah dikosongkan melalui manifest teruji setelah backup/restore, sementara akun/roles/bidang, master, konfigurasi, audit dan checkpoint original dipertahankan. Folder sumber, database dan volume tidak dihapus. Dokumen Final belum diimpor.

Target tetap container/service lama, database edms_ups dan storage NAS yang sama. NAS Celeron J3455, RAM 4 GB; build Linux amd64 di laptop, NAS menjalankan standalone siap pakai. Satu job konversi berjalan dalam container yang sama.

edms-app adalah source lama/perubahan lokal yang dijaga; edms-v2 dapat menjadi direktori kerja pengganti, bukan stack baru. [README source lama](edms-app/README.md) menjelaskan batas penggunaannya. Paket runtime lama lokal di archive/legacy-deployment dan dokumentasi/prototipe historis di docs/archive/2026-10-22.

## UI dan pengujian

Tema biru muda/kuning PLN, logo Danantara dan PLN dari Folder Logo, desktop/tablet responsive dan accessible. Periksa/gunakan skill UI terpasang yang relevan pada tahap UI.

Seluruh upload/import/update/download/konversi selama development/UAT/smoke menggunakan dummy sintetis PDF/DOCX/XLSX/ZIP berlabel DUMMY/TEST, bukan dokumen asli. Uji normal/gagal/retry/konflik/warning lalu bersihkan dummy selektif. Impor Dokumen Final nyata dilakukan setelah aplikasi siap sebagai pekerjaan operasional, bukan test sekarang.
