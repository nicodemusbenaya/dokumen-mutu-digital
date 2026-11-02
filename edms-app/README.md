# Source Lama EDMS

Keputusan 22 Oktober 2026 versi 2.1: source lama/perubahan lokal dipertahankan sebagai referensi; source pengganti ada di edms-v2, belum deploy NAS; lihat ../docs/IMPLEMENTASI_V2.md. Baca [plan](../plan.md), [spesifikasi](../Spesifikasi_EDMS_Dokumen_Mutu_UPS.md) dan [AGENTS](../AGENTS.md).

Target tetap container/service lama, DB edms_ups dan mount storage yang sama. Build di laptop untuk NAS J3455/RAM 4 GB, linux/amd64; tanpa build/install di NAS. Source baru boleh disusun di edms-v2 sebagai direktori kerja saja.

Dokumen aplikasi lama dan histori terkait akan dibersihkan saat transisi setelah backup, tidak dimigrasikan. Akun/config/master independen dan source dipertahankan. Sumber awal hanya Dokumen Final. Jangan menjalankan purge/seed/reset/deploy lama untuk tugas penyelarasan; SQL/Compose/script saat ini belum paket v2 dan bukan prosedur cleanup baru yang terverifikasi.

Rilis baru tanpa approval bertingkat; upload/update langsung aktif setelah validasi. PDF-ke-Word termasuk rilis pertama dengan popup wajib. Histori versi baru tetap disimpan. UI biru muda/kuning, logo Danantara/PLN, gunakan skill UI terpasang yang relevan saat implementasi.

Semua pengujian upload ZIP/PDF/DOCX/XLSX, update dan konversi memakai dummy sintetis saja. Jangan menggunakan dokumen asli untuk test/smoke. Tidak ada operasi NAS/data pada tugas dokumentasi ini.

Untuk referensi lokal, gunakan runtime yang kompatibel package/lock, credential lokal melalui environment dan npm ci di laptop bila perlu, lalu npm run dev. Jangan menguji mutasi terhadap NAS tanpa prosedur tahap terkait. Cache node_modules/.next, source, backup, environment dan dokumen asli tidak dibersihkan oleh tugas penyelarasan ini.
