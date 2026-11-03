# Menu Form ↔ Zoho Forms (panduan pengelola)

Mulai 2.1.9 menu **Form** di EDMS hanya untuk **melihat data**. Form dibuat, diubah, dan diisi di **Zoho Forms**. Setiap kali ada yang submit di Zoho, Zoho mengirim isinya ke EDMS lewat **webhook**, dan entri tampil di EDMS dalam hitungan detik. Halaman entri memuat ulang otomatis tiap 10 detik. Data tetap tersimpan juga di Zoho (menu All Entries).

| Hal | Nilai |
|---|---|
| Akun Zoho | akunsuportups@gmail.com (portal `plnups`, region zoho.com, paket Basic) |
| Form yang disambungkan | 4 form di tabel bawah |
| Alamat penerima di EDMS | `https://<domain-publik-EDMS>/api/v2/zoho-webhook/<kode-form>?key=<kunci>` |
| Siapa yang bisa melihat entri | Super user dan Editor (menu Form) |
| Siapa yang bisa menambah form dan membuat/ganti kunci webhook | Super user |

| Kode form (`<kode-form>`) | Form di Zoho |
|---|---|
| `ceklis-pengawasan` | FR.UPS.2026.BST.01.01-00 Ceklis Pengawasan Pelaksanaan Uji Kompetensi |
| `berita-acara-kecurangan` | FR.UPS.2026.BST.01.02-00 Berita Acara Kejadian/Dugaan Kecurangan |
| `matriks-potensi-kecurangan` | FR.UPS.2026.BST.01.03-00 Matriks Potensi Kecurangan dan Pengendaliannya |
| `kode-etik-deklarasi` | Kode Etik & Deklarasi Ketidakberpihakan |

## Syarat

1. EDMS 2.1.9 sudah terpasang di NAS (lihat [UPDATE_NAS_2_1_9.md](UPDATE_NAS_2_1_9.md)).
2. EDMS dapat dibuka dari internet lewat **domain HTTPS Cloudflare Tunnel** (bukan `http://10.10.200.166:3000`, karena server Zoho tidak bisa menjangkau IP lokal kantor).
3. Login EDMS sebagai **Super user**.

## A. Ambil URL webhook dari EDMS

1. Buka EDMS lewat domain publik, lalu login sebagai Super user.
2. Menu **Form**, gulir ke panel **Kelola form & webhook Zoho**.
3. Pada form yang ingin disambungkan, klik **Buat kunci**. URL webhook muncul.
4. Klik **Salin**. Pastikan alamat depannya domain publik (`https://…`). Kalau EDMS dibuka lewat IP lokal, ganti bagian depan URL itu dengan domain publik.

URL itu bersifat rahasia, karena siapa pun yang memegangnya bisa mengirim data palsu. Jangan kirim lewat grup chat. Kalau URL bocor, klik **Ganti kunci** lalu perbarui URL di Zoho. URL lama langsung tidak berlaku.

## B. Pasang webhook di Zoho Forms (ulangi untuk setiap form)

1. Login https://forms.zoho.com dengan akun di atas.
2. Di **My Forms**, arahkan kursor ke form, lalu klik **Edit**. Tunggu builder tampil.
3. Menu kiri **INTEGRATIONS**, lalu **Webhooks** (kalau ada tombol **Configure Webhook**, klik itu).
4. Isi:
   - **URL**: tempel URL dari langkah A.
   - **Method**: `POST`.
   - **Payload / Content type**: pilih **JSON** jika tersedia. Bentuk key-value (form data) juga diterima.
   - **Parameter / field yang dikirim**: pilih **semua field form**. Tambahkan juga field sistem bila tersedia (misalnya *Added Time* atau *Entry ID*), supaya dua entri yang isinya kebetulan sama tetap tercatat terpisah.
   - Nama parameter yang dipilih di sini menjadi **judul kolom** di EDMS dan Excel. **Samakan dengan label field di Zoho**, supaya kolomnya cocok dengan jawaban hasil impor CSV (langkah C).
5. **Save**.
6. Uji: isi form tersebut sekali di Zoho dengan data berlabel **TEST**, lalu buka EDMS → Form → **Lihat entri**. Entri harus muncul dalam ±10 detik. Hapus entri TEST di Zoho bila perlu. Di EDMS, entri TEST tetap tercatat; minta Super user menghapusnya dari database bila mengganggu.

## C. Impor jawaban lama (sekali per form)

Webhook hanya mengirim jawaban **baru**. Jawaban yang sudah ada di Zoho sebelum webhook dipasang diambil sekali lewat file Export:

1. Pasang webhook dulu (langkah A dan B), supaya tidak ada jawaban yang terlewat.
2. Di Zoho: buka form → **All Entries** → **Export** → format **CSV**. Ikutkan kolom **Added Time**, supaya waktu asli jawaban ikut tersimpan.
3. Di EDMS (Super user): menu **Form** → **Lihat entri** pada form **yang sama** → **Impor entri lama (CSV Zoho)** → pilih file CSV.
4. EDMS menampilkan jumlah jawaban yang masuk dan yang dilewati. Impor ulang file yang sama tidak menggandakan jawaban.

Perhatikan:
- Satu file CSV untuk satu form. Jangan impor file form A ke form B.
- Kolom hasil impor memakai **label field** dari Zoho. Supaya kolom jawaban impor dan jawaban webhook sama, isi **nama parameter webhook sama persis dengan label field** di Zoho (langkah B).
- Jawaban yang masuk di antara pemasangan webhook dan export bisa tercatat dua kali (sekali dari webhook, sekali dari impor), karena bentuk datanya berbeda. Sumber tiap jawaban terlihat di detail entri dan kolom **Sumber** di Excel.
- Batas: 20 MB atau 20.000 jawaban per file.

## Menambah form Zoho baru

Form baru yang dibuat di Zoho **tidak otomatis** muncul di EDMS. Form itu perlu didaftarkan sekali, lalu webhook-nya dipasang:

1. Buat dan publish form di Zoho seperti biasa. Salin link form dari Zoho (misalnya `https://forms.zoho.com/plnups/form/NamaForm`).
2. Di EDMS (Super user): menu **Form**, panel **Kelola form & webhook Zoho**. Isi **Judul form** dan **Link form Zoho**, lalu klik **Tambah form**. EDMS langsung membuat kode form dan URL webhook.
3. Klik **Salin** pada baris form baru, lalu kerjakan langkah **B** di atas untuk form tersebut.
4. Uji dengan satu jawaban TEST.

Form yang sudah ditambahkan tidak bisa dihapus dari menu, supaya entrinya tidak hilang.

## Kalau entri tidak masuk

| Gejala | Penyebab dan solusi |
|---|---|
| Di EDMS tertulis "Webhook belum aktif" | Kunci belum dibuat. Lakukan langkah A. |
| Entri ada di Zoho tetapi tidak di EDMS | Cek URL di Zoho: domain publik, kode form, dan `key=` lengkap 64 karakter. Pastikan Tunnel dan aplikasi NAS berjalan. |
| Zoho mencatat error 401 | Kunci salah atau sudah diganti. Salin ulang URL dari EDMS. |
| Zoho mencatat error 429 | Lebih dari 600 kiriman per 10 menit dari satu alamat. Tunggu, lalu kirim ulang. |
| Entri lama sebelum webhook dipasang tidak ada | Webhook hanya mengirim entri baru. Impor dari CSV Export Zoho (langkah C). |
| Kolom isi kosong atau nama kolom aneh | Atur ulang daftar field atau nama parameter di pengaturan webhook Zoho. |

Kuota webhook Zoho mengikuti paket. Paket Basic punya batas pemakaian webhook; add-on "Pengisian Webhook" bisa dibeli di halaman Subscription bila kuota habis.

## Catatan teknis

- Endpoint: `POST /api/v2/zoho-webhook/<slug>`. Kunci diambil dari `?key=` atau header `x-edms-key`, dibandingkan secara timing-safe. Endpoint ini tidak butuh sesi login dan tidak memeriksa Origin. Batas ukuran 1 MB, rate limit 600 per 10 menit.
- Isi kiriman disimpan utuh sebagai JSON di `v2_zoho_entries.payload_json`. Format JSON, form-urlencoded, multipart dan teks mentah didukung.
- Kiriman ulang yang identik dari Zoho tidak menggandakan entri, karena tabel memakai unique key per form + hash SHA-256 isi kiriman.
- File unggahan atau tanda tangan **tidak** diunduh ke NAS. Yang tersimpan hanya nilai yang dikirim Zoho (biasanya nama atau link file Zoho).
- Kode: `edms-v2/src/lib/zoho.mjs`, UI `edms-v2/src/components/FormsWorkspace.tsx`, skema `edms-v2/sql/010_zoho_forms.sql`.
