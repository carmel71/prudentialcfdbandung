/* =========================================================
   KONFIGURASI CAMPAIGN — ubah di sini, tidak perlu sentuh kode lain
   ========================================================= */
window.CK_CONFIG = {
  igHandle: "@prudentialsyariah",          // TODO: konfirmasi akun final
  hashtag: "#LanjutTanpaJeda",
  caption: "Ini cerita versi aku! Kamu pilih yang mana? #LanjutTanpaJeda #CeritaKita @prudentialsyariah",
  eventName: "CFD Bandung",

  // Durasi video final = opening + 5 × question + closing = 37 detik
  timeline: { openingMs: 3000, questionMs: 6000, closingMs: 4000 },

  video: {
    width: 720, height: 1280,   // 9:16
    fps: 30,
    videoBitsPerSecond: 4000000,
    mirror: true                // selfie terasa natural seperti filter IG/TikTok
  },

  sfx: { enabled: true, volume: 0.55 },

  // Cara menjawab
  //  "head"  = miringkan kepala ke kiri/kanan untuk memilih, lalu cerita alasannya pakai suara
  //  "voice" = hanya suara; dua pilihan menyala bergantian otomatis (sesuai brief awal)
  // Kalau pelacak wajah gagal dimuat, peserta menjawab dengan ketuk kartu kiri/kanan.
  //  tiltDeg    = miring minimal untuk memilih (derajat)
  //  neutralDeg = kepala dianggap tegak di bawah ini; harus tegak dulu sebelum bisa memilih
  //  holdMs     = lama menahan miring sebelum jawaban terkunci
  //  Kalau deteksi kepala tidak tersedia, peserta bisa ketuk kartu kiri/kanan di layar.
  answer: { mode: "head", tiltDeg: 13, neutralDeg: 7, holdMs: 700 },

  faceTracking: {
    // Dicoba berurutan. File lokal (self-host) dulu, lalu server resmi Google.
    modelUrls: [
      "vendor/mediapipe/face_landmarker.task",
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    ],
    // Cadangan library kalau salinan lokal di vendor/mediapipe/ gagal dimuat
    libCdn: ["https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/"]
  },

  // Pertanyaan: prompt tampil di kartu atas, a/b tampil di dua pilihan bawah
  questions: [
    { prompt: "Gaji besar atau waktu lebih banyak buat keluarga?", a: { emoji: "💰", label: "Gaji Besar" },           b: { emoji: "❤️", label: "Waktu Buat Keluarga" } },
    { prompt: "Kerja sesuai passion atau penghasilan stabil?",      a: { emoji: "🔥", label: "Kerja Sesuai Passion" }, b: { emoji: "💵", label: "Penghasilan Stabil" } },
    { prompt: "Nikmati hidup sekarang atau nabung buat masa depan?", a: { emoji: "🏖️", label: "Nikmati Sekarang" },    b: { emoji: "💰", label: "Nabung Masa Depan" } },
    { prompt: "Apa yang lagi kamu perjuangkan sekarang?",           a: { emoji: "💼", label: "Perjuangin Karier" },    b: { emoji: "🫶", label: "Perjuangin Keluarga" } },
    { prompt: "Satu hal yang nggak boleh berhenti dalam hidupmu?",  a: { emoji: "✨", label: "Terus Bermimpi" },       b: { emoji: "💪", label: "Terus Berjuang" } }
  ],

  // Aset asli. Ganti file di folder assets/ dengan nama yang sama.
  assets: {
    logoPSLA: "assets/logo-psla.png",
    logoPRUCare: "assets/logo-prucare360-syariah.png",
    artworkLockup: "assets/artwork-cerita-kita.png",        // "Cerita Kita, #LanjutTanpaJeda" (background putih)
    artworkHashtag: "assets/artwork-lanjut-tanpa-jeda.png"  // "#LanjutTanpaJeda" (transparan)
  },

  // Backend: kosong = mode demo (data hanya di browser ini). Isi URL API saat backend siap.
  api: { baseUrl: "" }
};

// Parameter tes: ?speed=4 mempercepat timeline 4× (khusus QA, jangan dipakai di event)
(function () {
  const sp = parseFloat(new URLSearchParams(location.search).get("speed"));
  if (sp > 0 && sp <= 20) {
    const t = window.CK_CONFIG.timeline;
    Object.keys(t).forEach(k => (t[k] = Math.round(t[k] / sp)));
  }
})();
