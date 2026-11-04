# Menu Form ↔ Zoho Forms (panduan pengelola)

Menu **Form** di EDMS hanya untuk **melihat data**. Form dibuat, diubah, dan diisi di **Zoho Forms**. Setiap kali ada yang submit di Zoho, Zoho mengirim isinya ke EDMS lewat **webhook**, dan entri tampil di EDMS dalam hitungan detik. Halaman entri memuat ulang otomatis tiap 10 detik. Data tetap tersimpan juga di Zoho (menu All Entries).

| Hal | Nilai |
|---|---|
| Akun Zoho | akunsuportups@gmail.com (portal `plnups`, region zoho.com, paket Basic) |
| Alamat publik webhook | `https://nasups01.tail10ea24.ts.net/api/v2/zoho-webhook/<kode-form>?key=<kunci>` |
| Jalur ke internet | Tailscale Funnel (container `edms-tailscale` di NAS). **Hanya** jalur `/api/v2/zoho-webhook` yang terbuka; halaman EDMS lain tetap khusus jaringan kantor. |
| Siapa yang bisa melihat entri | Super user dan Editor (menu Form) |
| Siapa yang bisa menambah/menghapus form, membuat/ganti kunci, impor, dan hapus entri | Super user |

| Kode form (`<kode-form>`) | Form di Zoho | Webhook |
|---|---|---|
| `ceklis-pengawasan` | FR.UPS.2026.BST.01.01-00 Ceklis Pengawasan Pelaksanaan Uji Kompetensi | aktif sejak 4 Nov 2026 |
| `berita-acara-kecurangan` | FR.UPS.2026.BST.01.02-00 Berita Acara Kejadian/Dugaan Kecurangan | aktif sejak 4 Nov 2026 |
| `matriks-potensi-kecurangan` | FR.UPS.2026.BST.01.03-00 Matriks Potensi Kecurangan dan Pengendaliannya | aktif sejak 4 Nov 2026 |
| `kode-etik-deklarasi` | Kode Etik & Deklarasi Ketidakberpihakan | aktif sejak 4 Nov 2026 |

## A. Ambil URL webhook dari EDMS

1. Buka EDMS (`http://10.10.200.166:3000`) dan login sebagai **Super user**.
2. Menu **Form**, gulir ke panel **Kelola form & webhook Zoho**.
3. Pada form yang ingin disambungkan, klik **Buat kunci**. URL webhook publik langsung muncul.
4. Klik **Salin**.

URL itu bersifat rahasia, karena siapa pun yang memegangnya bisa mengirim jawaban palsu (tetapi tidak bisa membaca data). Simpan hanya di pengaturan Zoho; jangan kirim lewat chat atau email. Kalau URL bocor, klik **Ganti kunci** lalu perbarui URL di Zoho. URL lama langsung tidak berlaku.

## B. Pasang webhook di Zoho Forms (ulangi untuk setiap form)

1. Login https://forms.zoho.com dengan akun di atas.
2. Di **My Forms**, arahkan kursor ke form, klik **Edit**, tunggu builder tampil.
3. Menu kiri **INTEGRATIONS**. Ketik `webhook` di kotak Search, klik kartu **Webhooks**, lalu **Configure Webhook**.
4. Isi:
   - **Webhook URL**: tempel URL dari langkah A.
   - **Content Type**: `application/json` (bawaan).
   - **Payload Parameters → Form Fields**: klik **Auto-Map Fields** → **Okay, proceed**. Semua field terpetakan dengan nama `Field_1`, `Field_2`, dan seterusnya.
   - **Ganti setiap nama parameter `Field_N` dengan label field-nya** (teks yang tampil di kolom kanan, misalnya `Nama`, `Jabatan`, `Added Time`). Nama parameter menjadi **judul kolom** di EDMS dan Excel, dan harus sama dengan judul kolom CSV export Zoho agar jawaban impor dan jawaban webhook sejajar.
   - Kalau form punya **Subform Fields**, klik **Auto-Map Fields** pada bagian itu juga, lalu ganti nama subform dan field-nya dengan labelnya.
5. **Save**. Status *Webhooks Status* harus menyala.
6. **Jangan klik *Test Webhook*** pada form yang sudah final: tombol itu mengirim data contoh ke EDMS. Sambungan teruji otomatis saat jawaban asli pertama masuk.

## C. Impor jawaban lama (sekali per form)

Webhook hanya mengirim jawaban **baru**. Jawaban yang sudah ada di Zoho sebelum webhook dipasang diambil sekali lewat file Export:

1. Pasang webhook dulu (langkah A dan B), supaya tidak ada jawaban yang terlewat.
2. Di Zoho: **All Entries** form tersebut → ikon **Export** (di sebelah ikon filter) → **Export as CSV** → **Done**. Biarkan *Matrix Choice Format* = *Combine answers in a cell*.
3. Di EDMS (Super user): menu **Form** → **Lihat entri** pada form **yang sama** → **Impor entri lama (CSV Zoho)** → pilih file CSV.
4. EDMS menampilkan jumlah jawaban yang masuk dan yang dilewati. Impor ulang file yang sama tidak menggandakan jawaban.
5. Hapus file CSV dari laptop setelah diimpor (berisi data pribadi).

Perhatikan:
- Satu file CSV untuk satu form. Jangan impor file form A ke form B.
- Header dua baris dari Zoho didukung: pertanyaan matriks menjadi kolom per pertanyaan, dan isi subform yang lebih dari satu baris digabung ke jawaban induknya.
- Jawaban yang masuk di antara pemasangan webhook dan export bisa tercatat dua kali (sekali dari webhook, sekali dari impor). Sumber tiap jawaban terlihat di detail entri dan kolom **Sumber** di Excel; hapus salah satunya bila perlu.
- Batas: 20 MB atau 20.000 jawaban per file.

## D. Menghapus data (form yang periodenya selesai)

Semua penghapusan bersifat **permanen di EDMS**, khusus **Super user**, dan tercatat di **Histori Aktivitas**. Data di Zoho tidak ikut terhapus.

| Yang dihapus | Caranya |
|---|---|
| Satu entri | **Lihat entri** → **Lihat** pada baris → **Hapus entri** → konfirmasi. |
| Entri per periode | **Lihat entri** → panel **Hapus entri per periode** → isi tanggal dari–sampai (kosongkan keduanya untuk semua entri) → **Cek jumlah** → ketik `HAPUS` → **Hapus permanen**. |
| Form beserta semua entrinya | Panel **Kelola form & webhook Zoho** → **Hapus form** → ketik `HAPUS`. Setelah itu **matikan atau hapus webhook form itu di Zoho** (Integrations → Webhooks → *Remove Configuration*), supaya kiriman berikutnya tidak ditolak terus-menerus. |

Kiriman tanpa kunci atau dengan kunci salah **tidak pernah disimpan**, jadi tidak menimbulkan sampah. Sebelum menghapus periode yang panjang, unduh dulu **Download Excel** sebagai arsip bila diperlukan.

## Menambah form Zoho baru

Form baru di Zoho **tidak otomatis** muncul di EDMS:

1. Buat dan publish form di Zoho. Salin link form dari Zoho (misalnya `https://forms.zoho.com/plnups/form/NamaForm`).
2. Di EDMS (Super user): panel **Kelola form & webhook Zoho** → isi **Judul form** dan **Link form Zoho** → **Tambah form**. Kunci dan URL webhook langsung dibuat.
3. **Salin** URL-nya, lalu kerjakan langkah **B** untuk form tersebut.

## Tailscale Funnel (jalur internet untuk webhook)

- Akun Tailscale gratis (paket Personal) milik pengguna, login dengan GitHub ber-2FA. Perangkat NAS bernama `nasups01`.
- Container `edms-tailscale` (image `tailscale/tailscale:v1.104.1`, data di `/share/Container/edms-tailscale`) berjalan dengan `--restart unless-stopped`.
- Cek status (terminal NAS): `docker exec edms-tailscale tailscale funnel status` harus menampilkan `/api/v2/zoho-webhook proxy http://10.10.200.166:3000/api/v2/zoho-webhook`.
- Mematikan jalur internet: `docker exec edms-tailscale tailscale funnel --https=443 off`. Menyalakan lagi: `docker exec edms-tailscale tailscale funnel --bg --set-path /api/v2/zoho-webhook http://10.10.200.166:3000/api/v2/zoho-webhook`.
- Kalau nama host `nasups01.tail10ea24.ts.net` berubah (misalnya perangkat Tailscale dibuat ulang), ganti konstanta `PUBLIC_WEBHOOK_ORIGIN` di `edms-v2/src/components/FormsWorkspace.tsx`, rilis ulang, lalu perbarui URL di keempat webhook Zoho.

## Kalau entri tidak masuk

| Gejala | Penyebab dan solusi |
|---|---|
| Di EDMS tertulis "Webhook belum aktif" | Kunci belum dibuat. Lakukan langkah A. |
| Entri ada di Zoho tetapi tidak di EDMS | Cek URL di Zoho: alamat `nasups01.tail10ea24.ts.net`, kode form, dan `key=` lengkap 64 karakter. Pastikan aplikasi NAS dan container `edms-tailscale` berjalan, dan Funnel aktif. |
| Zoho mencatat error 401 | Kunci salah, sudah diganti, atau form sudah dihapus dari EDMS. Salin ulang URL dari EDMS (atau hapus webhook di Zoho bila formnya memang sudah dihapus). |
| Zoho mencatat error 404 | Funnel mati atau alamatnya salah. |
| Zoho mencatat error 429 | Lebih dari 600 kiriman per 10 menit. Tunggu, lalu kirim ulang. |
| Jawaban saat NAS mati tidak masuk | Ambil dari Zoho (Export CSV) lalu impor (langkah C). Impor tidak menggandakan jawaban yang sama persis. |
| Judul kolom berupa `Field_1` dst. | Nama parameter webhook belum diganti ke label field (langkah B.4). |

Kuota webhook Zoho mengikuti paket. Paket Basic punya batas pemakaian webhook; add-on "Pengisian Webhook" tersedia di halaman Subscription bila kuota habis.

## Catatan teknis

- Endpoint publik: `POST /api/v2/zoho-webhook/<slug>`. Kunci dari `?key=` atau header `x-edms-key`, dibandingkan timing-safe. Tanpa sesi login dan tanpa pemeriksaan Origin. Batas 1 MB, rate limit 600 per 10 menit.
- Isi kiriman disimpan utuh sebagai JSON di `v2_zoho_entries.payload_json` dengan kolom `source` (`webhook`/`import`). JSON, form-urlencoded, multipart dan teks mentah didukung.
- Kiriman ulang yang identik tidak menggandakan entri (unique key per form + hash SHA-256 isi).
- File unggahan atau tanda tangan **tidak** diunduh ke NAS; yang tersimpan hanya nilai yang dikirim Zoho.
- Kode: `edms-v2/src/lib/zoho.mjs`, UI `edms-v2/src/components/FormsWorkspace.tsx`, skema `edms-v2/sql/010_zoho_forms.sql`.
