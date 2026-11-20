# Cerita Kita, #LanjutTanpaJeda — Microsite Prototype (MVP)

Prototype fungsional untuk aktivasi **PRUCare360 Syariah** di **CFD Bandung**.
Peserta scan QR → isi data → rekam video *This or That* 37 detik di browser HP sendiri (pilih jawaban dengan **miringkan kepala**, lalu cerita alasannya) → simpan & upload ke Instagram → tunjukkan ke crew → klaim kopi.

- `index.html` — microsite peserta (Screen A–D)
- `crew.html` — Crew Dashboard (cari peserta, verifikasi, redeem)
- `admin.html` — Admin Dashboard (monitoring)

---

## 1. Cara menjalankan

### Di laptop (paling cepat, untuk demo pitching)
```bash
cd cerita-kita-microsite
python3 -m http.server 8080        # atau: npx serve -l 8080 .
```
Buka di Chrome / Safari / Edge:

| Halaman | URL |
|---|---|
| Microsite peserta | http://localhost:8080/ |
| Crew dashboard | http://localhost:8080/crew.html |
| Admin dashboard | http://localhost:8080/admin.html |

`localhost` dianggap aman oleh browser, jadi kamera langsung jalan. Di layar lebar microsite tampil dalam bingkai HP + panel alur A–D (bisa diklik untuk lompat antar-screen saat presentasi). Buka ketiga halaman di browser yang sama: registrasi di microsite langsung muncul di Crew & Admin.

> **Jangan double-click `index.html` (file://).** Kamera mungkin jalan, tapi browser melarang logo/artwork masuk ke video dari file lokal, jadi video akan tanpa logo.

### Di HP (wajib HTTPS)
Kamera HP hanya bisa dipakai di halaman `https://`. Pilih salah satu:

1. **Netlify Drop** — buka https://app.netlify.com/drop, drag folder `cerita-kita-microsite`, dapat link `https://…netlify.app`. Buka di HP atau jadikan QR.
2. **Cloudflare Tunnel** (dari laptop yang menjalankan server di atas): `cloudflared tunnel --url http://localhost:8080`
3. **ngrok**: `ngrok http 8080`

Buka link dari kamera bawaan HP / Safari / Chrome, **bukan** dari browser di dalam Instagram/TikTok (kamera sering diblokir di sana).

### Model deteksi kepala (sekali saja, untuk self-host)
Microsite memakai **MediaPipe Face Landmarker** (Google, Apache-2.0). Library-nya sudah ada di `vendor/mediapipe/`. File modelnya (3,7 MB) diambil dari server resmi Google saat halaman dibuka. Supaya tidak bergantung ke server luar saat event, unduh sekali dan taruh di folder proyek:
```bash
curl -L -o vendor/mediapipe/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
```
Microsite otomatis memakai file lokal kalau ada. **Sangat disarankan**: tanpa file ini HP peserta harus mengunduh model dari server Google, dan di sinyal CFD yang padat itu bisa lambat atau gagal.

### Diagnosa deteksi kepala di HP (`?debug=1`)
Buka `https://…/?debug=1` di HP. Pojok kiri atas akan menampilkan: status (memuat/siap/gagal + persen unduhan), GPU/CPU, wajah terdeteksi atau tidak, sudut `roll`, `tilt` relatif, ambang, dan pesan error. Pakai ini untuk mengecek kenapa HP tertentu gagal dan untuk menyetel `tiltDeg`.

### Presentasi di laptop
Di bingkai HP (layar lebar), tahan tombol **←** atau **→** untuk simulasi miring kepala, berguna kalau demo pakai mode tanpa kamera atau tidak mau gerak-gerak di depan klien.

### Parameter QA
`?speed=4` mempercepat timeline video 4× untuk tes cepat. Jangan dipakai saat event.

---

## 2. Arsitektur

```
HP PESERTA (index.html) — semua proses video di perangkat, tanpa upload ke server

  getUserMedia ──► <video> kamera depan ─┬──► HEADTRACK (MediaPipe, ~16×/dtk)
                                         │     sudut miring kepala → pilih kiri/kanan
                                         ▼
                         COMPOSER (canvas 720×1280, 30 fps)
                         kamera + logo + artwork + animasi This or That
                                         │ canvas.captureStream()
  mic ──┐                                ▼
  SFX ──┴─► Web Audio (mixer) ──► MediaRecorder ──► Blob MP4 (H.264)
                                         │
                       Preview ◄─────────┴────► Simpan (share sheet / download)

  Registrasi ─► STORE ─────────────────────────► CREW & ADMIN DASHBOARD
               (sekarang: localStorage, demo)    (baca/tulis lewat Store yang sama)
               (nanti: API + database)
```

### Struktur proyek
```
cerita-kita-microsite/
├── index.html            Microsite peserta: A Registrasi, B Pre-recording, C Countdown & recording, D Preview
├── crew.html             Crew dashboard (mobile-first, dipakai di HP crew)
├── admin.html            Admin dashboard (desktop)
├── css/
│   ├── tokens.css        Warna, font, tombol, field (dipakai semua halaman)
│   ├── app.css           UI microsite + bingkai presentasi
│   └── dashboard.css     UI crew & admin
├── js/
│   ├── config.js         ← SEMUA yang sering diubah: pertanyaan, durasi, akun IG, caption, path aset
│   ├── store.js          Lapisan data peserta (demo: localStorage). Ganti di sini saat backend siap
│   ├── recorder.js       Kamera, mic, pemilihan format, MediaRecorder, mixing audio
│   ├── composer.js       Gambar tiap frame video: opening, 5 pertanyaan, closing
│   ├── headtrack.js      Deteksi miring kepala (MediaPipe Face Landmarker) + simulasi tombol ← →
│   ├── sfx.js            Efek suara ringan (disintesis Web Audio, tanpa file musik)
│   ├── app.js            Alur layar peserta + penanganan error kamera
│   ├── crew.js           Logika crew dashboard
│   └── admin.js          KPI, grafik, tabel admin
├── vendor/mediapipe/     Library MediaPipe Tasks Vision 1.2.3 (resmi, Apache-2.0) + tempat model face_landmarker.task
├── assets/               Aset asli dari NEO DRE (lihat bagian 5)
└── fonts/                FS Albert, Chewy, Poppins (self-hosted, tidak butuh internet)
```

### Timeline video final (37 detik, 9:16)
| Waktu | Isi |
|---|---|
| 0–3 dtk | Opening: artwork *Cerita Kita, #LanjutTanpaJeda* + "versi {nama peserta}" |
| 3–33 dtk | 5 pertanyaan × 6 dtk. Kartu pertanyaan + progress 1/5–5/5 + timer. Peserta miringkan kepala: kiri = opsi kiri, kanan = opsi kanan. Pilihan terkunci dengan animasi + bunyi, sisa waktu dipakai cerita alasannya |
| 33–37 dtk | Closing: wajah peserta dalam lingkaran, artwork, akun IG, logo PSLA + PRUCare360 Syariah |

Durasi tiap pertanyaan tetap 6 detik walaupun peserta sudah memilih, supaya video selalu 37 detik.

Countdown 3-2-1 tampil sebelum rekaman dan **tidak** ikut terekam. Logo ada di pill kecil di atas, jadi wajah peserta tidak tertutup.

---

## 3. Status fitur

### Sudah berfungsi (nyata, di perangkat)
- **Registrasi**: nama, WhatsApp (format 08…/+62…), email, validasi dengan pesan jelas. Consent partisipasi (wajib) dan consent marketing (opsional) terpisah. CTA **Mulai Cerita** langsung ke kamera, tanpa welcome screen.
- **Nomor WA yang sama** mengembalikan Participant ID lama (cegah daftar dobel).
- **Kamera & mikrofon**: izin, preview selfie, pesan error spesifik (izin ditolak, bukan HTTPS, browser in-app, kamera dipakai aplikasi lain, tanpa kamera) + langkah perbaikan iPhone/Android. Ada **mode demo** tanpa kamera untuk presentasi.
- **Countdown 3-2-1** di atas preview kamera: judul "Siap-siap!" bergoyang, cincin kuning terisi tiap detik, angka pop, dengan bunyi dan getar (Android).
- **Rekaman otomatis 37 detik** setelah satu tap **Mulai Rekam**. Tidak ada tombol Next, tidak perlu tap untuk menjawab.
- **Pilih dengan miringkan kepala** (`answer.mode: "head"`):
  - Deteksi wajah berjalan di HP peserta (MediaPipe, GPU dengan cadangan CPU), tidak ada data wajah yang disimpan atau dikirim.
  - Posisi netral dikalibrasi otomatis saat opening, jadi HP yang dipegang agak miring tidak bikin salah pilih.
  - Kepala harus **tegak dulu** di tiap pertanyaan (di bawah ±7°), baru bisa memilih, supaya miring dari soal sebelumnya tidak terbawa. Kalau belum tegak, bar bawah menampilkan "Tegakkan kepala dulu".
  - Miring ±13° dan **ditahan 0,7 detik** → terkunci. Selama menahan, kartu terisi dari bawah. Setelah terkunci muncul centang, kilau, bunyi, dan getar.
  - **Cadangan ketuk**: ketuk sisi kiri/kanan video untuk memilih. Kalau deteksi kepala gagal dimuat, petunjuk berubah jadi "Ketuk pilihanmu".
  - Petunjuk "Miringkan kepala" bergoyang di video sampai peserta memilih.
  - Layar pre-recording jadi tempat latihan: "Wajah terdeteksi", "Miring kiri, mantap!", atau "Wajahmu belum kelihatan".
  - Model diunduh di latar belakang selama peserta isi form. Kalau belum siap atau gagal dimuat, peserta tetap bisa menjawab dengan ketuk; begitu model siap di tengah rekaman, miring kepala langsung aktif. Library dicoba dari folder lokal dulu, lalu CDN jsDelivr.
  - Jawaban disimpan per peserta dan tampil di Admin (persentase tiap pilihan).
- **Branding & animasi tertanam di video**: logo, artwork asli, hashtag, kartu pertanyaan, pilihan bergantian, progress, timer.
- **Efek suara** (whoosh, pop, tick, chime) ikut masuk ke audio video bersama suara peserta.
- **Preview otomatis** (mulai tanpa suara karena aturan browser, ada tombol *Nyalakan suara*), **Rekam Ulang**, **Simpan Video**:
  - HP: membuka share sheet → *Simpan Video* ke galeri (iPhone) atau langsung pilih Instagram.
  - Laptop: unduh file MP4.
- **Instruksi upload/tag IG**, tombol **Salin caption**, Participant ID besar untuk disebut ke crew.
- **Rekaman dibatalkan dengan jelas** kalau peserta keluar aplikasi/mengunci layar saat merekam (browser menghentikan frame).
- **Crew dashboard**: cari ID / WA / nama, timeline status, checklist verifikasi IG (tayang, tag, hashtag), **Verify & Redeem Coffee** dengan konfirmasi, **redeem kedua ditolak**, log redeem terakhir.
- **Admin dashboard**: total registrasi, persetujuan marketing, video selesai, postingan terverifikasi, kopi diredeem, alur peserta, registrasi per waktu, **hasil jawaban This or That**, tabel status + filter + pencarian, export CSV. Update langsung antar-tab.

**Sudah diuji**: Chrome 153 desktop dengan kamera simulasi → MP4 H.264 720×1280, durasi 37,0 detik, audio ada. Alur crew (redeem + tolak redeem ganda) dan admin diuji otomatis. Deteksi kepala: library + model berhasil dimuat (GPU), logika pilih/kunci diuji lewat simulasi tombol (hasil `[kiri, kanan, –, kiri, kanan]` sesuai), dan cadangan ke mode suara saat model gagal dimuat juga sudah dicek.

**Belum diuji**: miring kepala dengan wajah asli. Kamera simulasi di lingkungan uji tidak menampilkan wajah, jadi ambang 13° dan arah kiri/kanan **wajib dicoba di HP nyata** dengan beberapa orang.

### Masih simulasi
- **Penyimpanan data** = localStorage di browser yang sama. Registrasi dari HP peserta **tidak** sampai ke HP crew. Untuk demo, jalankan semua halaman di satu laptop.
- **Data dashboard**: 64 peserta simulasi (bertanda `sim` di tabel). Bisa diisi ulang/dihapus dari Admin.
- **Status "video selesai"** dicatat di perangkat peserta saja.
- **Verifikasi Instagram** dilakukan manual oleh crew (sesuai brief). Tidak ada pengecekan otomatis ke Instagram.
- **Teks ketentuan program** masih draft, perlu teks resmi dari legal.

### Perlu implementasi berikutnya
1. **Backend + database** (mis. Supabase / Firebase / Node + Postgres). Ganti isi `js/store.js` dengan panggilan API, antarmuka fungsinya sudah disiapkan:
   - `POST /participants` (registrasi, unik per nomor WA)
   - `POST /participants/:id/video-complete`
   - `GET /participants?q=` (pencarian crew)
   - `POST /participants/:id/redeem` — **atomik** di server (unique constraint / transaksi) supaya anti redeem ganda berlaku untuk semua HP crew
   - `GET /stats` (admin)
2. **Login crew & admin** (PIN atau akun), audit log siapa me-redeem kapan.
3. **Privasi & keamanan**: kebijakan privasi, ketentuan final, log consent (waktu + versi teks), retensi & penghapusan data, HTTPS + hosting di region yang sesuai regulasi PDP.
4. **Kalibrasi deteksi kepala dengan orang sungguhan**: arah kiri/kanan, ambang `tiltDeg`, peserta berkacamata/berhijab/bertopi, cahaya terik CFD, dua orang dalam satu frame.
5. **Uji perangkat nyata** (wajib sebelum event): iPhone Safari iOS 16/17/18, Android Chrome HP low/mid/high. Cek format file, sinkron audio, fps, panas, proses simpan, upload ke IG Story & Reels.
6. **Fallback konversi WebM → MP4** kalau ternyata ada HP target yang hanya bisa merekam WebM (ffmpeg.wasm di perangkat atau konversi di server).
7. **Analytics**: buka halaman, izin kamera diterima/ditolak, rekam selesai, simpan/share, redeem.
8. **Hosting produksi**, domain, QR final, rencana cadangan koneksi di lokasi CFD.
9. **Anti-kecurangan tambahan** (mis. orang yang sama daftar dengan nomor WA lain): verifikasi akun IG unik di dashboard crew.

---

## 4. Catatan kompatibilitas

| | iPhone (Safari) | Android (Chrome) |
|---|---|---|
| Rekam video | iOS 14.3+ (disarankan iOS 16+) | Chrome versi baru |
| Format hasil | MP4 H.264 + AAC | MP4 H.264; audio AAC kalau encoder tersedia, kalau tidak Opus-in-MP4. Chrome lama: WebM (ada peringatan di layar preview) |
| Simpan video | Share sheet → *Simpan Video* ke Foto | Share sheet atau Download |
| Catatan | Mode Hemat Daya bisa menurunkan fps. Ganti app/kunci layar = rekaman dibatalkan | Beberapa HP low-end bisa patah-patah di 30 fps; turunkan `video.fps` ke 24 di `config.js` bila perlu |

- **HTTPS wajib** di HP.
- **Deteksi kepala** butuh unduhan ±15 MB sekali (library 14,6 MB + model 3,7 MB; di Netlify dikirim terkompresi, jauh lebih kecil). Diunduh di latar saat peserta isi form. HP low-end mungkin turun fps karena deteksi dan perekaman jalan bersamaan. Kalau terasa berat, ganti `answer.mode` ke `"voice"`.
- **Browser in-app** (Instagram, TikTok, Facebook) sering memblokir kamera. Microsite mendeteksi ini dan menyuruh peserta membuka di Safari/Chrome.
- **Autoplay**: browser tidak mengizinkan preview langsung bersuara, jadi preview mulai mute + tombol *Nyalakan suara*.
- Uji otomatis kami berjalan di Chrome Linux, yang tidak punya encoder AAC, jadi audio hasil uji adalah Opus. Di iPhone hasilnya AAC.

---

## 5. Aset & font

| File | Keterangan |
|---|---|
| `assets/logo-psla.png` | Logo Prudential Syariah (PSLA), PNG transparan asli |
| `assets/logo-prucare360-syariah.png` | Logo Asuransi Jiwa PRUCare360 Syariah, PNG transparan asli |
| `assets/artwork-cerita-kita.png` | Artwork *Cerita Kita, #LanjutTanpaJeda*. File asli berlatar putih (JPG), hanya dipangkas margin putihnya. Dipakai di atas kartu/panel putih, tidak diubah. Kalau ada versi PNG transparan, cukup timpa file ini |
| `assets/artwork-lanjut-tanpa-jeda.png` | Artwork *#LanjutTanpaJeda* (transparan), dipakai di pill bawah video |
| `fonts/fs-albert-*.woff2` | FS Albert Pro (Light/Regular/Bold/ExtraBold), dikonversi dari OTF. **Pastikan lisensi FS Albert mencakup pemakaian webfont** sebelum go-live |
| `fonts/chewy-regular.woff2` | Chewy (Google Fonts, lisensi OFL) — pertanyaan, pilihan, headline playful |
| `fonts/poppins-*.woff2` | Poppins 600/700/800 (OFL) — judul, angka, Participant ID |

Logo tidak digambar ulang. Kalau file logo hilang, microsite menampilkan teks nama brand biasa sebagai pengganti sementara.

**Font pertanyaan**: memakai Chewy sesuai aset yang dikirim. Kalau mau kembali ke Poppins seperti di brief, ubah `--font-play` di `css/tokens.css` dan `F_PLAY` di `js/composer.js`.

## 6. Mengubah konten
Semua di `js/config.js`:
- `answer.mode`: `"head"` (miringkan kepala) atau `"voice"` (hanya suara, sesuai brief awal). `tiltDeg` = seberapa miring, `holdMs` = berapa lama ditahan.
- Lainnya: teks 5 pertanyaan & pilihan + emoji, durasi tiap bagian, akun IG (**konfirmasi akun final, sekarang @prudentialsyariah**), hashtag, caption, path aset, resolusi/bitrate video.

## 7. Catatan privasi deteksi kepala
Kamera dipakai untuk membaca posisi kepala secara real-time di HP peserta. Yang dipakai hanya sudut kemiringan. Titik wajah tidak disimpan, tidak dikirim, dan tidak dipakai untuk mengenali orang. Draft ketentuan sudah menyebut ini, tapi tetap minta legal Prudential Syariah mengecek terhadap UU PDP sebelum go-live.

Catatan: brief awal menyebut tanpa gesture. Mode kepala ditambahkan atas permintaan NEO DRE dan bisa dimatikan dengan satu baris (`answer.mode: "voice"`).
