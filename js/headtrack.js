/* =========================================================
   HEADTRACK — deteksi miring kepala (kiri/kanan) di perangkat peserta.
   Memakai MediaPipe Face Landmarker (Google, Apache-2.0).
   Hanya sudut kemiringan yang dipakai; tidak ada data wajah yang disimpan/dikirim.

   tilt < 0  = kepala miring ke KIRI layar  → pilih opsi kiri (A)
   tilt > 0  = kepala miring ke KANAN layar → pilih opsi kanan (B)
   Di laptop: tahan tombol ← / → untuk simulasi.

   Perbaikan v2:
   - Model diunduh SEKALI sebagai buffer (cek ukuran/isi), lalu dipakai untuk GPU/CPU.
     Versi lama mencoba file lokal yang tidak ada → 2× kompilasi WASM sia-sia → sering
     belum siap saat peserta menekan Mulai Rekam, sehingga diam-diam jatuh ke mode suara.
   - Error saat deteksi tidak lagi ditelan diam-diam. GPU yang error / tidak pernah
     menemukan wajah otomatis diganti CPU.
   - Deteksi dijalankan pada frame kecil (480 px) supaya ringan & stabil di HP.
   - Sudut miring memakai garis mata + garis dahi–dagu (lebih stabil), dengan
     smoothing dan hysteresis.
   - ?debug=1 menampilkan panel diagnosa di layar HP.
   ========================================================= */
(function () {
  const CFG = window.CK_CONFIG;
  const DEBUG = /[?&]debug=1/.test(location.search);
  const SRC_W = 480;                 // lebar frame yang dianalisis
  const GPU_GRACE_MS = 2500;         // GPU belum pernah dapat wajah selama ini → coba CPU

  const HT = {
    status: "idle",          // idle | loading | ready | failed
    phase: "",               // keterangan proses muat (untuk UI)
    progress: 0,             // 0..1 unduhan model
    error: "", delegate: "", model: "",
    landmarker: null, ready: null,
    vision: null, fileset: null, modelBuf: null,
    face: false, lastSeen: 0, lastRun: 0, lastTs: 0,
    roll: 0, rawRoll: 0, baseline: 0, samples: [],
    sim: 0,
    errCount: 0, framesRun: 0, everFace: false, liveSince: 0, switching: false,
    detMs: 0, src: null, srcCtx: null,

    load() {
      if (this.ready) return this.ready;
      this.status = "loading";
      this.ready = (async () => {
        try {
          this.phase = "library";
          const [lib, buf] = await Promise.all([this.importLib(), this.fetchModel()]);
          this.vision = lib.vision;
          this.modelBuf = buf;
          this.fileset = {
            wasmLoaderPath: lib.base + "wasm/vision_wasm_internal.js",
            wasmBinaryPath: lib.base + "wasm/vision_wasm_internal.wasm"
          };
          this.phase = "init";
          let lastErr = null;
          for (const delegate of ["GPU", "CPU"]) {
            try { await this.create(delegate); this.status = "ready"; this.phase = ""; return true; }
            catch (e) { lastErr = e; console.warn("[headtrack] " + delegate + " gagal:", e); }
          }
          throw lastErr || new Error("Face Landmarker tidak bisa dibuat");
        } catch (e) {
          this.status = "failed";
          this.error = String((e && e.message) || e);
          console.warn("[headtrack]", this.error);
          return false;
        }
      })();
      return this.ready;
    },

    /** Library MediaPipe: salinan lokal dulu, lalu CDN jsDelivr (versi sama dengan prototype index.html). */
    async importLib() {
      const bases = [new URL("vendor/mediapipe/", location.href).href, ...(CFG.faceTracking.libCdn || [])];
      let lastErr = null;
      for (const base of bases) {
        try { return { base, vision: await import(base + "vision_bundle.mjs") }; }
        catch (e) { lastErr = e; console.warn("[headtrack] library gagal:", base, e); }
      }
      throw lastErr || new Error("library tidak bisa dimuat");
    },

    /** Unduh file model .task: lokal dulu, lalu server Google. Validasi supaya halaman 404 HTML tidak lolos. */
    async fetchModel() {
      const urls = CFG.faceTracking.modelUrls.map(u => new URL(u, location.href).href);
      let lastErr = null;
      for (const url of urls) {
        try {
          this.phase = "model";
          const res = await fetch(url, { cache: "force-cache" });
          if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
          const type = res.headers.get("content-type") || "";
          if (/text\/html/i.test(type)) throw new Error("bukan file model (HTML) " + url);
          const total = +res.headers.get("content-length") || 3758596;
          let buf;
          if (res.body && res.body.getReader) {
            const reader = res.body.getReader(), parts = [];
            let got = 0;
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              parts.push(value); got += value.length;
              this.progress = Math.min(0.99, got / total);
            }
            buf = new Uint8Array(got);
            let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
          } else {
            buf = new Uint8Array(await res.arrayBuffer());
          }
          if (buf.length < 500000) throw new Error(`file model terlalu kecil (${buf.length} B) ${url}`);
          this.progress = 1;
          this.model = url;
          return buf;
        } catch (e) { lastErr = e; console.warn("[headtrack] model:", e.message || e); }
      }
      throw lastErr || new Error("model tidak bisa diunduh");
    },

    async create(delegate) {
      const lm = await this.vision.FaceLandmarker.createFromOptions(this.fileset, {
        baseOptions: { modelAssetBuffer: this.modelBuf, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false
      });
      if (this.landmarker) try { this.landmarker.close(); } catch (e) {}
      this.landmarker = lm;
      this.delegate = delegate;
      this.errCount = 0; this.framesRun = 0; this.everFace = false; this.liveSince = 0;
    },

    /** Ganti ke CPU (dipanggil kalau GPU error atau tidak pernah menemukan wajah). */
    async fallbackCPU(reason) {
      if (this.switching || this.delegate === "CPU") return false;
      this.switching = true;
      console.warn("[headtrack] pindah ke CPU:", reason);
      try { await this.create("CPU"); this.error = ""; return true; }
      catch (e) { this.status = "failed"; this.error = "CPU: " + ((e && e.message) || e); return false; }
      finally { this.switching = false; }
    },

    /** Frame kecil untuk dianalisis (lebih cepat, terutama di CPU). */
    frameFrom(video) {
      const w = SRC_W, h = Math.round(SRC_W * video.videoHeight / video.videoWidth);
      if (!this.src) { this.src = document.createElement("canvas"); this.srcCtx = this.src.getContext("2d", { willReadFrequently: false }); }
      if (this.src.width !== w || this.src.height !== h) { this.src.width = w; this.src.height = h; }
      this.srcCtx.drawImage(video, 0, 0, w, h);
      return this.src;
    },

    /** Dipanggil tiap frame oleh composer; deteksi dibatasi ~15×/detik supaya ringan. */
    update(video, now) {
      if (DEBUG) this.drawDebug(now);
      if (this.status !== "ready" || this.switching || !this.landmarker) return;
      if (!video || video.readyState < 2 || !video.videoWidth || video.paused) { this.liveSince = 0; return; }
      const gap = this.delegate === "CPU" ? 80 : 60;
      if (now - this.lastRun < gap) return;
      this.lastRun = now;
      if (!this.liveSince) this.liveSince = now;
      const ts = Math.max(this.lastTs + 1, Math.round(now));
      this.lastTs = ts;
      let res;
      const t0 = performance.now();
      try {
        res = this.landmarker.detectForVideo(this.frameFrom(video), ts);
        this.errCount = 0;
      } catch (e) {
        this.errCount++;
        this.error = String((e && e.message) || e);
        if (this.errCount >= 3) this.fallbackCPU("error: " + this.error);
        return;
      }
      this.detMs += (performance.now() - t0 - this.detMs) * 0.2;
      this.framesRun++;
      const lm = res && res.faceLandmarks && res.faceLandmarks[0];
      if (!lm) {
        this.face = false;
        // GPU di sebagian HP (terutama iOS) "jalan" tapi tidak pernah menemukan wajah.
        if (!this.everFace && this.delegate === "GPU" && now - this.liveSince > GPU_GRACE_MS && this.framesRun > 20)
          this.fallbackCPU("GPU tidak menemukan wajah");
        return;
      }
      this.face = true; this.everFace = true; this.lastSeen = now;

      // Koordinat layar (cermin seperti selfie). Normalisasi → piksel supaya sudut benar.
      const m = CFG.video.mirror, vw = video.videoWidth, vh = video.videoHeight;
      const P = i => ({ x: (m ? 1 - lm[i].x : lm[i].x) * vw, y: lm[i].y * vh });
      // 1) garis antar sudut luar mata (33 & 263)
      let a = P(33), b = P(263);
      if (a.x > b.x) { const t = a; a = b; b = t; }
      const eyeAng = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      // 2) garis dahi (10) → dagu (152); tegak = 90°
      const top = P(10), chin = P(152);
      const midAng = Math.atan2(chin.y - top.y, chin.x - top.x) * 180 / Math.PI - 90;
      // Kepala miring ke kiri layar: puncak kepala ke kiri, dagu ke kanan → midAng negatif,
      // sama tandanya dengan eyeAng (mata kanan naik, mata kiri turun → negatif).
      const ang = eyeAng * 0.6 + midAng * 0.4;
      this.rawRoll = ang;
      this.roll += (ang - this.roll) * 0.55; // smoothing
    },

    /** Kemiringan relatif terhadap posisi netral peserta (derajat). */
    get tilt() { return this.sim || (this.roll - this.baseline); },
    hasFace(now) { return !!this.sim || this.face || (now - this.lastSeen < 600); },

    // Kalibrasi posisi netral saat opening (HP/kepala peserta mungkin tidak tegak lurus)
    calibrateStart() { this.samples = []; },
    calibrateSample() { if (this.face) this.samples.push(this.roll); },
    calibrateEnd() {
      const s = this.samples.slice().sort((a, b) => a - b);
      const med = s.length >= 3 ? s[Math.floor(s.length / 2)] : 0;
      // Hanya koreksi kemiringan kecil (HP dipegang agak miring). Kalau peserta sudah
      // memiringkan kepala saat opening, jangan jadikan itu "netral".
      this.baseline = Math.max(-7, Math.min(7, med));
    },

    // ---------- panel diagnosa (?debug=1) ----------
    dbgEl: null, dbgAt: 0,
    drawDebug(now) {
      if (now - this.dbgAt < 150) return;
      this.dbgAt = now;
      if (!this.dbgEl) {
        const d = document.createElement("pre");
        d.style.cssText = "position:fixed;left:6px;top:6px;z-index:99999;margin:0;padding:6px 8px;background:rgba(0,0,0,.72);color:#9ff;font:11px/1.35 ui-monospace,monospace;border-radius:8px;pointer-events:none;max-width:70vw;white-space:pre-wrap";
        document.body.appendChild(d); this.dbgEl = d;
      }
      this.dbgEl.textContent =
        `status ${this.status}${this.phase ? " (" + this.phase + " " + Math.round(this.progress * 100) + "%)" : ""}\n` +
        `delegate ${this.delegate || "-"}  det ${this.detMs.toFixed(0)}ms\n` +
        `face ${this.face ? "YA" : "tidak"}  frames ${this.framesRun}\n` +
        `roll ${this.roll.toFixed(1)}°  base ${this.baseline.toFixed(1)}°\n` +
        `tilt ${this.tilt.toFixed(1)}°  ambang ±${CFG.answer.tiltDeg}°\n` +
        (this.error ? "err " + this.error.slice(0, 140) : "");
    }
  };

  // Simulasi untuk presentasi di laptop: tahan ← atau →
  addEventListener("keydown", e => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft") { HT.sim = -30; e.preventDefault(); }
    if (e.key === "ArrowRight") { HT.sim = 30; e.preventDefault(); }
  });
  addEventListener("keyup", e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") HT.sim = 0; });

  window.CKHead = HT;
})();
