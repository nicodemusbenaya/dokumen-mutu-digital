# Analisis UX EDMS v2

23 Oktober 2026. Lingkup: pembacaan source aktif `edms-v2`, bukan source historis `edms-app`. Temuan berasal dari source; belum merupakan hasil UAT atau audit kepatuhan aksesibilitas lengkap.

## Perubahan yang diterapkan

- `src/app/globals.css`: overflow horizontal root memakai `clip` agar tidak menciptakan scroll container yang mengganggu sticky sidebar.
- `src/app/workspace.module.css`: sidebar sejajar awal grid dan menempel pada viewport. Menu dapat menyusut dan digulir sendiri pada desktop pendek; logo dan area akun tidak menyusut. Pada ponsel navigasi tetap sticky, tab tidak menyusut, dan tombol Keluar tetap tampil dengan target 44px.
- Identitas dokumen tidak lagi disembunyikan pada lebar <=1200px. Informasi ID/revisi tetap dapat diakses untuk pairing.
- Tabel kecil dapat digulir horizontal; tidak lagi menyembunyikan kolom keempat/kelima secara umum. Aturan lama juga menyembunyikan rincian audit, bukan hanya tanggal/tombol register.
- `src/app/page.tsx`: penanda `aria-current` cocok dengan navigasi aktif saat detail terbuka. Dialog peringatan konversi memiliki nama/deskripsi terhubung ke teks yang terlihat.

## Temuan audit awal

Empat temuan pertama pada tabel berikut telah ditangani dalam source pada 23 Oktober 2026, sesuai permintaan lanjutan pengguna. Rincian implementasi dan batas verifikasinya ada di bawah. Temuan lain tetap berupa rekomendasi.

| Prioritas | Temuan dan bukti source | Dampak dan rekomendasi |
|---|---|---|
| P1 | `page.tsx`: `loadView` dan `loadDoc` menulis state setelah fetch tanpa penjaga urutan respons. `navigate` ke detail tidak mengosongkan dokumen sebelumnya. | Respons pencarian lama dapat menimpa hasil terbaru; detail sebelumnya dapat tampil sementara saat membuka dokumen lain. Gunakan cancellation/generation dan state detail loading yang terikat ID. `DocumentManager` sudah memiliki pola generation yang bisa dijadikan acuan. |
| P1 | `page.tsx`: navigasi tetap tersedia selama upload, sedangkan progres dan pembatalan hanya berada di form upload yang sedang tampil. `revisionMode` direset oleh navigasi. | Pengguna kehilangan konteks proses yang berjalan atau isian revisi. Sediakan status upload persisten lintas halaman dan proteksi keluar dari form yang belum disimpan, termasuk Back browser. |
| P2 | `page.tsx`: dashboard/register/audit tidak memiliki state loading fetch terpisah; fetch dibuka dengan debounce 250ms. `UserManager` juga langsung menampilkan state kosong sebelum fetch selesai. | Data yang belum selesai dimuat terlihat seperti data kosong, atau hasil lama terlihat sebagai hasil filter baru. Bedakan loading/error/empty dan sediakan retry setempat; jangan tampilkan ajakan upload pertama sebelum data terkonfirmasi kosong. |
| P2 | `page.tsx`: perbaikan pasangan meminta pengguna menyalin ID dokumen dari halaman lain dan mengetiknya di form. | Beban kerja tinggi dan rawan salah pasangan. Ganti dengan pencarian kode/judul dan pemilihan dokumen yang menampilkan revisi/format sebelum konfirmasi. |
| P2 | `page.tsx` / `Management.tsx`: Daftar Dokumen dan Kelola Dokumen menyediakan register/filter berbeda untuk pekerjaan yang berdekatan. | Pengguna harus memilih menu sebelum tahu fitur yang tersedia. Pertimbangkan satu register dengan filter aktif/arsip/sampah dan toolbar pengelolaan berdasarkan izin. Ini rekomendasi arsitektur navigasi, belum perubahan menu. |
| P2 | `Management.tsx`: hasil aksi massal menampilkan UUID; `page.tsx`: audit menampilkan nama aksi teknis dan JSON context. | Pengguna sulit mengaitkan hasil dengan dokumen atau memahami kegagalan. Tampilkan kode/judul, label aktivitas Bahasa Indonesia, alasan dan langkah pemulihan; simpan JSON sebagai rincian teknis opsional. |
| P2 | `page.tsx`: Back/Forward hanya mereset sebagian state; navigasi antarmenu tidak mengatur fokus atau scroll konten secara eksplisit. | Halaman tujuan dapat terbuka pada posisi scroll lama dan pengguna keyboard tidak mendapat konteks baru. Tetapkan kebijakan fokus heading/scroll per navigasi serta pemulihan posisi register ketika kembali dari detail. |

## Hal yang sudah baik

CSS Modules dan token brand konsisten; font/logo lokal; fokus keyboard terlihat; label form umumnya eksplisit; reduced motion tersedia; pembatalan dialog konversi terpisah dari permintaan ticket download; aksi destruktif menjelaskan Sampah dan alasan wajib; register pengelolaan sudah menangani respons terlambat dengan generation.

## Bukti dan keterbatasan

- TypeScript `node node_modules/typescript/bin/tsc --noEmit`: lulus.
- Pemeriksaan sintaks `node --check tests/layout.mjs`: lulus.
- Detector impeccable: satu warning font Inter. Dipertahankan karena sesuai identitas dan aset lokal yang ada; tidak menambah dependency/font jarak jauh.
- `tests/layout.mjs` disiapkan untuk lebar 1440, 1024 (tinggi 500), 820 dan 390: scroll nyata, posisi sidebar, akses Keluar, scroll menu desktop pendek, overflow viewport, rincian audit, identitas dokumen dan penanda navigasi aktif. Semua API diintersep dengan data sintetis DUMMY; tidak menulis DB atau melakukan upload.
- Eksekusi browser terhenti saat launch Chromium, exit code 3221225506. Tidak ada screenshot atau hasil browser lulus yang diklaim. Jalankan `node tests/layout.mjs` dari `edms-v2` saat dev server aktif di port 3100; `TEST_BASE_URL` dapat mengganti alamat.
- Server dev port 3100 sudah berjalan; percobaan server tambahan dihentikan oleh Next.js. Proses server pengguna tidak dihentikan. Tidak ada deploy, migrasi, impor asli atau penghapusan data.

Verifikasi lanjutan: desktop/tablet/ponsel, zoom 200%, keyboard sampai menu terakhir pada layar pendek, serta posisi fokus setelah navigasi. Penilaian numerik aksesibilitas/kontras/performa ditunda sampai pemeriksaan runtime dapat dilakukan.

## Implementasi empat peningkatan UX

- `src/components/useResource.ts`: hasil fetch terikat path, AbortController, generation, debounce, serta cleanup saat pindah halaman/unmount. Hasil path sebelumnya langsung tidak ditampilkan pada render path baru. Data dibersihkan ketika resource dinonaktifkan, termasuk logout. Dipakai pada dashboard, register aktif, detail, audit, pekerjaan, duplikat, pengguna dan pencarian/detail pasangan.
- Progres upload dan tombol pembatalan berada di shell, sehingga tersedia lintas menu. Status dibuat sejak awal permintaan dan direset per file; job yang sudah dikirim tetap tercatat walaupun file berikutnya gagal atau dibatalkan. Pembatalan menunggu request bagian yang sedang berjalan selesai, lalu menghapus sesi upload yang belum difinalisasi. Logout ditahan selama upload; beforeunload memperingatkan saat upload berjalan.
- Form revisi menandai perubahan dan meminta konfirmasi sebelum navigasi menu, Back/Forward, keluar akun atau membatalkan form. Pembatalan konfirmasi mempertahankan isian dan file. Refresh/tutup tab memakai peringatan native browser. Form ini tidak menyimpan file atau draft di server. Snapshot expectedVersion/lockVersion ditahan dari saat form dibuka agar konflik tetap terdeteksi. Form dibekukan selama upload; progres/pembatalan tetap tersedia di luar form.
- Loading/error/empty dibedakan. Register tetap menyediakan input pencarian selama loading agar fokus mengetik tidak terputus; hasil kosong hanya muncul setelah request sukses. Kegagalan mempunyai tombol retry setempat. Dashboard tidak menampilkan ajakan upload pertama sebelum data terkonfirmasi kosong. State serupa diterapkan pada pekerjaan/audit/pengguna/duplikat/register pengelolaan.
- `src/components/PairPicker.tsx`: pencarian kode/judul minimal dua karakter, debounce, pagination, penanda pilihan, rincian revisi dan format asli/konversi, pembatalan dan retry. Dokumen tanpa hak edit tidak bisa dipilih. Sebelum resolve, detail dimuat ulang untuk memeriksa izin, status aktif, activeVersion dan lockVersion terhadap pilihan pengguna; server tetap melakukan validasi mutasi. Tidak memerlukan pengetikan UUID. Jalur kode dokumen baru tetap tersedia untuk dokumen berbeda.

Verifikasi tambahan: TypeScript lulus; 17 pengujian lama dan 5 pengujian hook resource lulus (22 total). Pengujian hook menjalankan kode produksi dengan scheduler hook, clock dan fetch sintetis yang sengaja mengabaikan abort untuk memeriksa generation/path guard; ini bukan pengujian DOM/browser. `tests/ux.mjs` menyiapkan pengujian browser dengan seluruh API diintersep: pembatalan navigasi revisi, error/retry/empty, pembatalan upload dari halaman lain dan payload pairing. Pemeriksaan sintaks skrip lulus, tetapi eksekusi kembali terhenti saat Chromium launch dengan kode 3221225506, sebelum interaksi dijalankan. Pemeriksaan HTTP localhost dari sesi ini juga gagal; kompilasi browser/visual belum diklaim lulus. Tidak ada upload DB, deploy atau perubahan data produksi.

Untuk menjalankan pemeriksaan browser saat runtime tersedia: dari `edms-v2`, jalankan `node tests/ux.mjs` dengan dev server di port 3100, atau atur `TEST_BASE_URL`. Semua file uji berlabel DUMMY; seluruh API diintersep sehingga tidak ada mutasi database.
