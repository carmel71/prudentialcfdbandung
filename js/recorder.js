/* =========================================================
   RECORDER — kamera, mikrofon, dan perekaman video di HP peserta.
   Video = canvas 9:16 (wajah + overlay branding) + audio (mic + SFX).
   Semua proses di perangkat; tidak ada upload ke server.
   ========================================================= */
(function () {
  const CFG = window.CK_CONFIG;
  const Sfx = window.CKSfx;

  // Urutan preferensi format. MP4 (H.264/AAC) paling aman untuk Instagram & galeri iPhone.
  const MIME_CANDIDATES = [
    'video/mp4;codecs="avc1.42E01F,mp4a.40.2"',
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const Rec = {
    lastError: "",
    stream: null,      // stream kamera + mic
    video: null,       // <video> tersembunyi untuk sumber frame kamera
    hasAudio: false,
    recorder: null, chunks: [], canvasStream: null, micNode: null, mime: "",
    startedAt: 0,

    supportInfo() {
      return {
        secure: window.isSecureContext,
        media: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        recorder: typeof window.MediaRecorder !== "undefined",
        canvasCapture: !!HTMLCanvasElement.prototype.captureStream,
        mime: this.pickMime()
      };
    },

    pickMime() {
      if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
      // Safari/iOS: pakai "video/mp4" polos dan biarkan Safari memilih codec (H.264 + AAC).
      // String codec spesifik bisa lolos isTypeSupported tapi menghasilkan rekaman kosong.
      if (IS_IOS && MediaRecorder.isTypeSupported("video/mp4")) return "video/mp4";
      return MIME_CANDIDATES.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || "";
    },

    /** Buka kamera depan + mic. Melempar error dengan .code yang mudah dijelaskan ke peserta. */
    async openCamera(videoEl) {
      this.video = videoEl;
      if (this.stream && this.stream.getVideoTracks().some(t => t.readyState === "live")) return this.stream;
      const fail = code => { const e = new Error(code); e.code = code; return e; };
      if (!window.isSecureContext) throw fail("insecure");
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw fail("unsupported");

      const video = { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
      const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      } catch (e) {
        if (e.name === "NotAllowedError" || e.name === "SecurityError") {
          // Mungkin hanya mic yang ditolak: coba video saja
          try { stream = await navigator.mediaDevices.getUserMedia({ video, audio: false }); }
          catch (e2) { throw fail(e2.name === "NotAllowedError" ? "denied" : "blocked"); }
        } else if (e.name === "NotFoundError" || e.name === "OverconstrainedError") {
          try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
          catch (e2) { throw fail("notfound"); }
        } else if (e.name === "NotReadableError") {
          throw fail("busy");
        } else {
          throw fail("blocked");
        }
      }
      this.stream = stream;
      this.hasAudio = stream.getAudioTracks().length > 0;
      videoEl.srcObject = stream;
      videoEl.muted = true;
      videoEl.setAttribute("playsinline", "");
      try { await videoEl.play(); } catch (e) {}
      return stream;
    },

    closeCamera() {
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
      if (this.video) this.video.srcObject = null;
    },

    /** Mulai rekam canvas. Audio = mic + SFX dicampur lewat Web Audio. */
    start(canvas) {
      this.chunks = [];
      this.mime = this.pickMime();
      if (!this.mime && typeof MediaRecorder === "undefined") { this.recorder = null; return false; }

      this.canvasStream = canvas.captureStream(CFG.video.fps);
      const tracks = [...this.canvasStream.getVideoTracks()];
      const mic = this.stream ? this.stream.getAudioTracks()[0] : null;
      let audioTrack = null;
      this.lastError = "";
      try {
        const ctx = Sfx.unlock();
        // Mixer Web Audio hanya dipakai kalau AudioContext benar-benar "running".
        // Di iOS, AudioContext yang "suspended"/"interrupted" menghasilkan track audio
        // tanpa sampel → MediaRecorder Safari tidak mengeluarkan data sama sekali (video kosong).
        if (ctx && ctx.createMediaStreamDestination && ctx.state === "running") {
          const dest = ctx.createMediaStreamDestination();
          if (mic) { this.micNode = ctx.createMediaStreamSource(new MediaStream([mic])); this.micNode.connect(dest); }
          Sfx.routeTo(dest);
          audioTrack = dest.stream.getAudioTracks()[0];
        }
      } catch (e) { audioTrack = null; }
      if (!audioTrack && mic) audioTrack = mic;   // fallback: mic langsung, tanpa SFX
      if (audioTrack) tracks.push(audioTrack);

      const opts = { videoBitsPerSecond: CFG.video.videoBitsPerSecond, audioBitsPerSecond: 128000 };
      if (this.mime) opts.mimeType = this.mime;
      try { this.recorder = new MediaRecorder(new MediaStream(tracks), opts); }
      catch (e) { try { this.recorder = new MediaRecorder(new MediaStream(tracks)); } catch (e2) { this.recorder = null; return false; } }

      this.recorder.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.recorder.onerror = e => {
        const er = e && (e.error || e);
        this.lastError = (er && (er.name || er.message)) ? `${er.name || ""} ${er.message || ""}`.trim() : "MediaRecorder error";
        console.warn("[recorder] error:", this.lastError);
      };
      try { this.recorder.start(); } // tanpa timeslice: kontainer MP4 utuh di Safari
      catch (e) { this.lastError = "start: " + ((e && e.message) || e); this.cleanup(); this.recorder = null; return false; }
      this.startedAt = performance.now();
      return true;
    },

    /** Stop dan kembalikan { blob, url, mime, ext, durationMs }. */
    stop() {
      return new Promise(resolve => {
        let done = false;
        const finish = async () => {
          if (done) return; done = true;
          const duration = performance.now() - this.startedAt;
          // Sebagian versi Safari mengirim dataavailable SETELAH event stop. Tunggu sebentar.
          for (let i = 0; i < 20 && !this.chunks.length; i++) await new Promise(r => setTimeout(r, 100));
          this.cleanup();
          if (!this.chunks.length) {
            if (!this.lastError) this.lastError = "data kosong (" + (this.recorder ? this.recorder.mimeType || this.mime : "-") + ")";
            return resolve(null);
          }
          const type = (this.recorder && this.recorder.mimeType) || this.mime || "video/webm";
          const base = type.split(";")[0];
          const blob = new Blob(this.chunks, { type: base });
          resolve({ blob, url: URL.createObjectURL(blob), mime: base, ext: base.includes("mp4") ? "mp4" : "webm", durationMs: duration });
        };
        if (!this.recorder || this.recorder.state === "inactive") return finish();
        this.recorder.onstop = finish;
        // requestData() sebelum stop() dihapus: di Safari bisa memecah MP4 jadi dua bagian.
        try { this.recorder.stop(); } catch (e) { finish(); }
      });
    },

    cancel() {
      if (this.recorder && this.recorder.state !== "inactive") { this.recorder.ondataavailable = null; this.recorder.onstop = null; try { this.recorder.stop(); } catch (e) {} }
      this.chunks = [];
      this.cleanup();
    },

    cleanup() {
      Sfx.unroute();
      if (this.micNode) { try { this.micNode.disconnect(); } catch (e) {} this.micNode = null; }
      if (this.canvasStream) { this.canvasStream.getTracks().forEach(t => t.stop()); this.canvasStream = null; }
    }
  };
  window.CKRecorder = Rec;
})();
