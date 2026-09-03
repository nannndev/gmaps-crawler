# Maps Directory Crawler

Chrome Extension (Manifest V3) untuk memanen daftar tempat dari hasil pencarian Google Maps.

## Pasang

1. Buka `chrome://extensions`
2. Aktifkan **Developer mode** (kanan atas)
3. **Load unpacked** → pilih folder `gmaps-crawler`

## Pakai

1. Buka Google Maps, cari sesuatu (mis. `kafe di Bandung`) sampai daftar hasil muncul di panel kiri.
2. Klik ikon extension.
3. Atur **Maks. tempat** dan **Jeda detail**, lalu klik **Mulai**.
4. Klik **Lihat Dashboard →** untuk melihat hasil dalam tabel.

> Biarkan tab Maps tetap terbuka selama crawl — extension mengendalikan tab itu untuk membuka tiap tempat. Popup boleh ditutup; crawl jalan terus di background.

## Dashboard

Tombol **Lihat Dashboard →** di popup membuka tab berisi seluruh data tersimpan:

- **Dua tampilan** — **Tabel** (padat, untuk memindai banyak baris) dan **Kartu** (lapang, enak dibaca satu per satu). Pilihan tersimpan.
- **Radar Peluang Lead (Lead Opportunity Scoring)** — Analisis otomatis profil prospek untuk mengidentifikasi peluang bisnis:
  - 🌐 **Butuh Website (Web Pitch)**: Bisnis aktif / rating bagus tapi belum punya website (target agensi web / digital).
  - 🛡️ **Perlu Reputasi (Rep Fix)**: Rating < 4,0 dengan ulasan aktif (target konsultan kepuasan pelanggan / review management).
  - ⭐ **High Value Lead**: Rating ≥ 4,5 dan ulasan ≥ 50 (bisnis mapan, potensi budget besar).
  - ⚡ **Kontak Siap (Outreach Ready)**: Nomor telepon dan email terverifikasi, siap dihubungi secara omnichannel.
  - 📈 **Lead Score (0–100)**: Skor potensi bisnis berdasarkan kelengkapan kontak, kredibilitas rating, dan jumlah ulasan.
- **Import & Backup/Restore (CSV/JSON)** — Unggah kembali file CSV atau JSON:
  - **Smart Merge**: Menggabungkan data tempat tanpa menimpa catatan atau status CRM yang sudah ada.
  - **Restore Database**: Memulihkan database lengkap dari file cadangan JSON (`.json`).
  - **Backup Database**: Mengunduh seluruh basis data dan riwayat sesi dalam satu klik.
- **Analitik Visual (📊 Analitik)** — 5 grafik visual: Radar Peluang Lead, Funnel CRM status, Top Kategori, Kelengkapan Kontak, dan Distribusi Rating.
- **Multi-select & Batch Actions** — Pilih beberapa baris (checkbox) untuk ubah status massal, hapus massal, atau export terpilih.
- **Quick Detail Drawer** — Klik nama tempat untuk membuka panel slide-over dengan tombol cepat WhatsApp, Telepon, Google Maps, editor Catatan & Tag kustom, serta ringkasan Skor Peluang.
- **Modern UI & Toast Notifications** — Antarmuka berkelas dengan efek glassmorphism, badge peluang dinamis, animasi halus, dan notifikasi toast non-intrusif.
- **Ekstraksi Media Sosial** — Otomatis memanen akun **Instagram, WhatsApp (`wa.me`), Facebook, LinkedIn, TikTok, X** saat pencarian email.
- **Pembersih Duplikat (Deduplicate)** — Menggabungkan otomatis tempat yang memiliki nomor telepon sama.
- **Pagination & Sorting Header** — 25 / 50 / 100 / 250 baris per halaman. Klik header kolom (Peluang, Nama, Rating, Kategori, Status) atau urutkan berdasarkan Skor Peluang Tertinggi.
- **Statistik & Filter Lengkap** — Total tempat, peluang butuh website, kontak siap, telepon, website, email, sosial, rating, status CRM.
- **Export Serbaguna** — Export ke **CSV, Excel (.xls), JSON, TSV**, mencakup kolom `opportunity` dan `leadScore`, serta tombol khusus **Salin Semua Email** & **Salin Semua Telepon**.

### Realtime

Saat crawl berjalan, dashboard menampilkan barisnya **sambil** proses berlangsung — tidak perlu menunggu selesai:

- Badge **live** berkedip di samping status
- Progress bar: indeterminate saat fase kumpul (total belum diketahui), persentase saat fase detail
- Baris yang **sedang diproses** disorot dengan garis biru
- Baris baru muncul dengan animasi masuk

Halaman yang sedang Anda buka **tidak akan lompat** saat data baru masuk — baris baru ditambahkan di akhir, jadi posisi baca Anda aman. Dashboard juga hanya merender ulang saat ada perubahan nyata, supaya tidak berkedip dan fokus ketikan di kotak cari tidak hilang.

Saat pertama dibuka, tabel menampilkan skeleton loading sampai data siap.

### Cari email & sosial media

Tombol **Cari email & sosial (N)** membuka website tiap tempat di tab tersembunyi, lalu mencari alamat email serta akun media sosial di halaman depan dan `/contact`, `/kontak`, `/about`. Berhenti begitu ketemu.

Penyaringannya: alamat vendor dan placeholder (`sentry.io`, `example.com`, `noreply@`, `wixpress`) dibuang, dan email yang **berdomain sama dengan websitenya** diprioritaskan — `info@toko.id` menang atas `pemilik@gmail.com`. Akun sosial media yang ditemukan (Instagram, WhatsApp, Facebook, LinkedIn, TikTok, X) akan muncul sebagai badge berwarna interaktif yang langsung dapat diklik.

Ini butuh izin akses ke semua website, yang diminta saat Anda klik tombolnya — bukan saat pasang. Tempat yang sudah dicek tapi tidak punya email/sosial ditandai `tidak ada` dan tidak akan dicek ulang.

### Status kontak & Tag Kustom

Tiap baris punya dropdown status, tag kustom, dan kolom catatan. Semuanya **tidak akan tertimpa** saat crawl atau enrich ulang — anotasi manual selalu menang atas data crawl. Ikut terekspor ke CSV/Excel/JSON sebagai kolom `status`, `note`, dan `tags`.

Filter **Status** dan **Sosial** memudahkan memilah prospek yang paling relevan.

### Penanda website

| Tampilan | Arti |
|---|---|
| nama domain | Ada website |
| `belum ada` (oranye) | Kosong dan **belum pernah** dicek detailnya — klik *Lengkapi kontak* |
| `tidak punya` (abu) | Sudah dicek, tempatnya memang tidak mencantumkan website |

Baris tanpa website juga diberi garis oranye di tepi kiri. Kolom `hasWebsite` (`ya`/`tidak`) ikut terekspor ke CSV/JSON.

## Penyimpanan & sesi

Data disimpan di `chrome.storage.local` dan **tidak dihapus** saat crawl baru dijalankan — hasil baru digabung ke data lama.

Aturannya: **satu tempat = satu baris**, tapi tiap baris mencatat sesi mana saja yang menemukannya. Crawl "kafe Bandung" lalu "coffee shop Bandung" tidak menghasilkan duplikat, dan Anda tetap bisa memfilter per sesi lewat dropdown. Sesi diberi label otomatis dari kata kunci pencarian.

Saat menggabungkan, nilai yang sudah terisi **tidak pernah** ditimpa oleh nilai kosong — jadi telepon hasil enrich tidak hilang saat crawl ulang.

Data hanya hilang kalau Anda klik **Hapus semua**, hapus baris satu per satu, atau uninstall extension.

## Kolom hasil

`name`, `category`, `rating`, `reviews`, `address`, `phone`, `website`, `hasWebsite`, `email`, `emailsAll`, `socials`, `hours`, `plusCode`, `lat`, `lng`, `status`, `note`, `tags`, `opportunity`, `leadScore`, `url`

Tanpa opsi *Ambil kontak*, hanya kolom dari list view yang terisi (`name`, `category`, `rating`, `reviews`, `address`, `lat`, `lng`, `url`) — jauh lebih cepat karena tidak membuka tiap tempat.

## Arsitektur

| File | Peran |
|---|---|
| `manifest.json` | MV3, host permission dibatasi ke domain Google Maps |
| `content.js` | Baca DOM: scroll feed (`COLLECT`) + baca panel detail (`SCRAPE_DETAIL`). Stateless. |
| `background.js` | Service worker: state machine crawl, navigasi tab, simpan hasil, webhook, deduplikasi, import/restore |
| `opportunity.js` | Mesin Lead Opportunity Scoring (Radar Peluang: Web Pitch, Rep Fix, High Value, Outreach Ready, Standard) & skor (0–100) |
| `import.js` | Parser RFC 4180 CSV, parser JSON database backup, validasi schema & normalisasi |
| `popup.html/css/js` | Kontrol + progress + export |
| `dashboard.html/css/js` | Tabel/kartu, pagination, filter peluang, visual analytics 5-chart, batch bar, detail drawer, modal import, toast |
| `email.js` | Pencari email & sosial — disuntikkan ke website tempat, bukan ke Maps |
| `export.js` | Helper CSV/TSV/Excel/JSON & Backup database dipakai bersama popup & dashboard |
| `test/` | Uji logika murni tanpa browser — `./test/run.sh` |

State disimpan di `chrome.storage.local`, bukan di memori, supaya crawl selamat saat service worker di-suspend Chrome (jamak pada crawl panjang). Hasil ditulis ke storage **tiap baris** — kalau berhenti di tengah, data sejauh itu tetap ada.

## Test

```sh
./test/run.sh
```

118 test: Lead Opportunity Scoring & Lead Score, RFC 4180 CSV parser & formula injection safety, backup JSON parsing & schema normalization, parsing angka (id-ID & en-US), ekstraksi koordinat, kunci dedup, merge lintas sesi, ekstraksi sosial media, helper copy massal email/telepon, format export Excel, escaping CSV, aritmetika pagination, serta kekekalan anotasi manual saat crawl ulang.


Scraping DOM tidak tercakup — itu hanya bisa diuji di browser sungguhan.

## Catatan penting

**Selector rapuh secara struktural.** Google Maps tidak punya API DOM publik dan nama class-nya di-obfuscate serta berubah tanpa pemberitahuan. Kode ini memakai atribut yang relatif stabil (`role="feed"`, `data-item-id="address"`, `aria-label`) dengan fallback parsing teks, tapi tetap akan rusak suatu saat. Kalau hasil tiba-tiba kosong, yang perlu diperbarui ada di `parseCard()` dan `readDetail()` di `content.js`.

**Locale.** Angka format Indonesia (`4,5` / `1.234`) dan Inggris (`4.5` / `1,234`) sama-sama ditangani, begitu juga label `Buka`/`Open` dan `ulasan`/`review`.

**Transfer data dilewati saat tidak berubah.** Baris hanya dikirim ke dashboard kalau versinya berubah. Tanpa ini, polling 700 ms akan menyerialisasi seluruh dataset belasan kali per detik — tidak terasa di 200 baris, tapi menyendat di beberapa ribu.

**Fase kumpul mengirim data bertahap.** Content script mengirim baris tiap putaran scroll, dan background menyimpannya lewat merge yang idempoten. Jadi kalau crawl mati di tengah fase kumpul, baris yang sudah ter-scroll tetap tersimpan.

**Rate limit.** Jeda antar-detail diacak (`detailDelayMs` + 0–700 ms). Menurunkan jeda di bawah ~800 ms memperbesar peluang Maps menyajikan halaman kosong atau captcha. Kalau banyak baris masuk daftar kendala, naikkan jedanya.

**CSV.** Diekspor dengan BOM UTF-8 (Excel membaca karakter non-ASCII dengan benar) dan nilai berawalan `=`, `+`, `-`, `@` diberi prefix `'` untuk mencegah formula injection saat file dibuka di spreadsheet.

**Webhook.** Wajib HTTPS. Izin domain diminta saat klik **Kirim** (bukan saat pasang), lalu POST `{ source, count, rows }`.

## Legal

Scraping Google Maps melanggar Terms of Service Google, dan data tempat dapat dilindungi hak basis data. Alat ini untuk pemakaian pribadi berskala kecil dan riset. Untuk penggunaan komersial atau volume besar, pakai [Places API](https://developers.google.com/maps/documentation/places/web-service) resmi. Data kontak yang dipanen tunduk pada UU PDP / GDPR bila dipakai untuk menghubungi orang.
