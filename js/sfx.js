/* =========================================================
   SFX — efek suara ringan, disintesis dengan Web Audio
   (tanpa file audio, tanpa lisensi musik).
   Saat merekam, suara juga dialirkan ke track audio video,
   jadi efeknya ikut tertanam di hasil akhir.
   ========================================================= */
(function () {
  const CFG = window.CK_CONFIG;
  const Sfx = {
    ctx: null, bus: null, recDest: null,

    /** Wajib dipanggil dari tap/klik pertama (aturan autoplay iOS/Android). */
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.bus = this.ctx.createGain();
        this.bus.gain.value = CFG.sfx.volume;
        this.bus.connect(this.ctx.destination);
      }
      // iOS punya state "interrupted" (mis. setelah kamera/mic dibuka). Selain "running", resume.
      if (this.ctx.state !== "running" && this.ctx.state !== "closed") this.ctx.resume().catch(() => {});
      return this.ctx;
    },
    get running() { return !!this.ctx && this.ctx.state === "running"; },
    routeTo(dest) { if (this.bus && dest) { this.bus.connect(dest); this.recDest = dest; } },
    unroute() { if (this.bus && this.recDest) { try { this.bus.disconnect(this.recDest); } catch (e) {} } this.recDest = null; },

    tone(freq, dur, o = {}) {
      if (!CFG.sfx.enabled || !this.ctx) return;
      const c = this.ctx, t = c.currentTime + (o.at || 0);
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || "sine";
      osc.frequency.setValueAtTime(freq, t);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur * 0.8);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.gain || 0.3, t + (o.attack || 0.008));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(this.bus);
      osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(dur, o = {}) {
      if (!CFG.sfx.enabled || !this.ctx) return;
      const c = this.ctx, t = c.currentTime + (o.at || 0);
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2;
      f.frequency.setValueAtTime(o.from || 400, t);
      f.frequency.exponentialRampToValueAtTime(o.to || 2400, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.bus);
      src.start(t); src.stop(t + dur + 0.05);
    },

    countdown(n) { this.tone(n > 1 ? 660 : 990, n > 1 ? 0.16 : 0.3, { gain: 0.32, type: "triangle" }); },
    sparkle() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, { at: i * 0.07, gain: 0.16, type: "triangle" })); },
    whoosh() { this.noise(0.3, { gain: 0.16, from: 300, to: 2600 }); },
    pop() { this.tone(480, 0.14, { slideTo: 1020, gain: 0.3, type: "triangle", at: 0.12 }); },
    tick(hi) { this.tone(hi ? 1320 : 1100, 0.05, { gain: 0.05 }); },
    pick() { this.tone(660, 0.1, { slideTo: 1320, gain: 0.32, type: "triangle" }); [1047, 1568].forEach((f, i) => this.tone(f, 0.22, { at: 0.08 + i * 0.07, gain: 0.16, type: "triangle" })); },
    chime() { [659, 988, 1319].forEach((f, i) => this.tone(f, 0.6, { at: i * 0.13, gain: 0.16, type: "sine" })); }
  };
  window.CKSfx = Sfx;
})();
