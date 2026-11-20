/* =========================================================
   COMPOSER — menggambar setiap frame video 9:16 di canvas:
   kamera selfie + branding + animasi This or That.
   Canvas inilah yang direkam, jadi yang dilihat peserta = hasil video.

   Timeline (default 37 dtk):
   0–3s  opening "Cerita Kita"  →  5 × 6s pertanyaan  →  4s closing branding
   ========================================================= */
(function () {
  const CFG = window.CK_CONFIG;
  const Sfx = window.CKSfx;
  const W = 720, H = 1280; // koordinat layout (canvas selalu 720×1280)

  const C = { red: "#EC1B2E", teal: "#2AB9B3", tealText: "#0F7E79", mint: "#DFF5F3", mint2: "#BFEAE6", ink: "#2B3133", grey: "#58595B", sun: "#FFC21A" };
  const F_PLAY = '"Chewy", "Poppins", system-ui, sans-serif';
  const F_TITLE = '"Poppins", system-ui, sans-serif';
  const F_UI = '"FS Albert", system-ui, sans-serif';
  const F_EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  // ---------- helpers ----------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, start, dur) => clamp((t - start) / dur);
  const outCubic = t => 1 - Math.pow(1 - t, 3);
  const inCubic = t => t * t * t;
  const outBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const rad = d => d * Math.PI / 180;

  function mk(w, h) { const c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  function rr(x, px, py, w, h, r) {
    x.beginPath();
    r = Math.min(r, w / 2, h / 2);
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
  }
  function wrap(x, text, maxW) {
    const words = text.split(" "), lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (x.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  function sparks(x, cx, cy, len, angle, color = C.sun, width = 8) {
    // tiga garis "spark" khas KV
    x.save(); x.translate(cx, cy); x.rotate(rad(angle));
    x.strokeStyle = color; x.lineWidth = width; x.lineCap = "round";
    [[-38, 0.85], [0, 1], [38, 0.85]].forEach(([a, k]) => {
      x.save(); x.rotate(rad(a)); x.beginPath(); x.moveTo(0, -14); x.lineTo(0, -14 - len * k); x.stroke(); x.restore();
    });
    x.restore();
  }
  function drawCover(x, src, sw, sh, dx, dy, dw, dh, mirror) {
    const r = Math.max(dw / sw, dh / sh), w = sw * r, h = sh * r;
    x.save();
    x.beginPath(); x.rect(dx, dy, dw, dh); x.clip();
    if (mirror) { x.translate(dx + dw / 2, 0); x.scale(-1, 1); x.translate(-(dx + dw / 2), 0); }
    x.drawImage(src, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
    x.restore();
  }
  function loadImage(src) {
    return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }
  function canvasSafe(im) {
    // Gambar dari file:// membuat canvas "tainted" sehingga tidak bisa direkam.
    try { const c = mk(2, 2), x = c.getContext("2d"); x.drawImage(im, 0, 0, 2, 2); x.getImageData(0, 0, 1, 1); return true; } catch (e) { return false; }
  }

  // ---------- cached layers (dibuat sekali, supaya ringan di HP) ----------
  function buildBrandPill(img, s = 1) {
    const h = 76 * s, pad = 26 * s, gap = 22 * s, m = 18 * s;
    const parts = [
      { im: img.psla, h: 50 * s, text: "Prudential Syariah", color: C.red },
      { im: img.care, h: 40 * s, text: "PRUCare360 Syariah", color: C.tealText }
    ];
    const t = mk(4, 4).getContext("2d"); t.font = `700 ${22 * s}px ${F_UI}`;
    parts.forEach(p => { p.w = p.im ? p.im.naturalWidth / p.im.naturalHeight * p.h : t.measureText(p.text).width; });
    const w = pad * 2 + parts[0].w + gap * 2 + 2 * s + parts[1].w;
    const c = mk(w + m * 2, h + m * 2), x = c.getContext("2d");
    x.shadowColor = "rgba(0,0,0,.18)"; x.shadowBlur = 14 * s; x.shadowOffsetY = 3 * s;
    x.fillStyle = "#fff"; rr(x, m, m, w, h, h / 2); x.fill();
    x.shadowColor = "transparent";
    let cx = m + pad;
    parts.forEach((p, i) => {
      if (p.im) x.drawImage(p.im, cx, m + (h - p.h) / 2, p.w, p.h);
      else { x.font = `700 ${22 * s}px ${F_UI}`; x.fillStyle = p.color; x.textBaseline = "middle"; x.fillText(p.text, cx, m + h / 2); }
      cx += p.w;
      if (i === 0) { cx += gap; x.fillStyle = "#D5E0DF"; x.fillRect(cx, m + h * 0.22, 2 * s, h * 0.56); cx += 2 * s + gap; }
    });
    return c;
  }

  function buildLogoRow(img) {
    const parts = [
      { im: img.psla, h: 104, text: "Prudential Syariah", color: C.red },
      { im: img.care, h: 80, text: "PRUCare360 Syariah", color: C.tealText }
    ];
    const t = mk(4, 4).getContext("2d"); t.font = `700 34px ${F_UI}`;
    parts.forEach(p => { p.w = p.im ? p.im.naturalWidth / p.im.naturalHeight * p.h : t.measureText(p.text).width; });
    const gap = 34, w = parts[0].w + gap * 2 + 3 + parts[1].w, h = 110;
    const c = mk(w, h), x = c.getContext("2d");
    let cx = 0;
    parts.forEach((p, i) => {
      if (p.im) x.drawImage(p.im, cx, (h - p.h) / 2, p.w, p.h);
      else { x.font = `700 34px ${F_UI}`; x.fillStyle = p.color; x.textBaseline = "middle"; x.fillText(p.text, cx, h / 2); }
      cx += p.w;
      if (i === 0) { cx += gap; x.fillStyle = "#CFDCDB"; x.fillRect(cx, 14, 3, h - 28); cx += 3 + gap; }
    });
    return c;
  }

  function buildQuestionCard(q, i, n) {
    const w = 624, padTop = 58, lineH = 60, padBot = 52, m = 44;
    const t = mk(4, 4).getContext("2d"); t.font = `54px ${F_PLAY}`;
    const lines = wrap(t, q.prompt, 548);
    const h = padTop + lines.length * lineH + padBot;
    const c = mk(w + m * 2, h + m * 2), x = c.getContext("2d");
    const ox = m, oy = m;
    x.shadowColor = "rgba(0,0,0,.22)"; x.shadowBlur = 22; x.shadowOffsetY = 6;
    x.fillStyle = "#fff"; rr(x, ox, oy, w, h, 40); x.fill();
    x.shadowColor = "transparent";
    // teks pertanyaan
    x.font = `54px ${F_PLAY}`; x.fillStyle = C.ink; x.textAlign = "center"; x.textBaseline = "middle";
    lines.forEach((ln, k) => x.fillText(ln, ox + w / 2, oy + padTop + lineH * k + lineH / 2 - 4));
    // bubble progress "1/5"
    const bw = 116, bh = 52, bx = ox + w / 2 - bw / 2, by = oy - bh / 2;
    x.fillStyle = C.teal; rr(x, bx, by, bw, bh, bh / 2); x.fill();
    x.strokeStyle = "#fff"; x.lineWidth = 5; rr(x, bx, by, bw, bh, bh / 2); x.stroke();
    x.font = `700 28px ${F_TITLE}`; x.fillStyle = "#fff"; x.fillText(`${i + 1}/${n}`, ox + w / 2, by + bh / 2 + 2);
    sparks(x, ox + 18, oy + 22, 26, -45, C.sun, 7);
    c.meta = { ox, oy, w, h };
    return c;
  }

  function buildTile(opt, color) {
    const w = 300, h = 214, m = 30;
    const c = mk(w + m * 2, h + m * 2), x = c.getContext("2d");
    x.shadowColor = "rgba(0,0,0,.25)"; x.shadowBlur = 20; x.shadowOffsetY = 6;
    x.fillStyle = color; rr(x, m, m, w, h, 38); x.fill();
    x.shadowColor = "transparent";
    const g = x.createLinearGradient(0, m, 0, m + h * 0.6);
    g.addColorStop(0, "rgba(255,255,255,.22)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; rr(x, m, m, w, h, 38); x.fill();
    x.textAlign = "center"; x.textBaseline = "middle";
    x.font = `80px ${F_EMOJI}`; x.fillText(opt.emoji, m + w / 2, m + 70);
    x.font = `40px ${F_PLAY}`;
    const lines = wrap(x, opt.label, 262);
    const lh = 42, top = m + 158 - (lines.length - 1) * lh / 2;
    x.fillStyle = "rgba(0,0,0,.14)";
    lines.forEach((ln, k) => x.fillText(ln, m + w / 2, top + k * lh + 3));
    x.fillStyle = "#fff";
    lines.forEach((ln, k) => x.fillText(ln, m + w / 2, top + k * lh));
    return c;
  }

  function buildOrBadge() {
    const r = 44, m = 20, c = mk((r + m) * 2, (r + m) * 2), x = c.getContext("2d");
    x.shadowColor = "rgba(0,0,0,.25)"; x.shadowBlur = 14; x.shadowOffsetY = 4;
    x.fillStyle = "#fff"; x.beginPath(); x.arc(r + m, r + m, r, 0, Math.PI * 2); x.fill();
    x.shadowColor = "transparent";
    x.font = `34px ${F_PLAY}`; x.fillStyle = C.red; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("atau", r + m, r + m + 1);
    return c;
  }

  function buildLockupSticker(img) {
    const iw = 560, pad = 28, m = 30;
    const ih = img.lockup ? iw * img.lockup.naturalHeight / img.lockup.naturalWidth : 200;
    const w = iw + pad * 2, h = ih + pad * 2;
    const c = mk(w + m * 2, h + m * 2), x = c.getContext("2d");
    x.shadowColor = "rgba(0,0,0,.25)"; x.shadowBlur = 24; x.shadowOffsetY = 8;
    x.fillStyle = "#fff"; rr(x, m, m, w, h, 40); x.fill();
    x.shadowColor = "transparent";
    if (img.lockup) x.drawImage(img.lockup, m + pad, m + pad, iw, ih);
    else {
      x.textAlign = "center"; x.textBaseline = "middle";
      x.font = `96px ${F_PLAY}`; x.fillStyle = C.red; x.fillText("Cerita Kita,", m + w / 2, m + h * 0.36);
      x.font = `70px ${F_PLAY}`; x.fillStyle = C.teal; x.fillText("#LanjutTanpaJeda", m + w / 2, m + h * 0.72);
    }
    return c;
  }

  function buildHashtagPill(img) {
    const w = 396, h = 92, m = 16;
    const c = mk(w + m * 2, h + m * 2), x = c.getContext("2d");
    x.shadowColor = "rgba(0,0,0,.18)"; x.shadowBlur = 12; x.shadowOffsetY = 3;
    x.fillStyle = "#fff"; rr(x, m, m, w, h, h / 2); x.fill();
    x.shadowColor = "transparent";
    if (img.hashtag) {
      const iw = 330, ih = iw * img.hashtag.naturalHeight / img.hashtag.naturalWidth;
      x.drawImage(img.hashtag, m + (w - iw) / 2, m + (h - ih) / 2, iw, ih);
    } else {
      x.font = `44px ${F_PLAY}`; x.fillStyle = C.teal; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(CFG.hashtag, m + w / 2, m + h / 2);
    }
    return c;
  }

  function buildPill(text, { font, color = "#fff", bg = C.teal, padX = 34, h = 76, stroke = null }) {
    const t = mk(4, 4).getContext("2d"); t.font = font;
    const w = t.measureText(text).width + padX * 2, m = 16;
    const c = mk(w + m * 2, h + m * 2), x = c.getContext("2d");
    x.shadowColor = "rgba(0,0,0,.18)"; x.shadowBlur = 12; x.shadowOffsetY = 3;
    x.fillStyle = bg; rr(x, m, m, w, h, h / 2); x.fill();
    x.shadowColor = "transparent";
    if (stroke) { x.strokeStyle = stroke; x.lineWidth = 5; rr(x, m, m, w, h, h / 2); x.stroke(); }
    x.font = font; x.fillStyle = color; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(text, m + w / 2, m + h / 2 + 2);
    return c;
  }

  function buildHint(text = "Miringkan kepala") {
    const font = `700 30px ${F_UI}`;
    const t = mk(4, 4).getContext("2d"); t.font = font;
    const tw = t.measureText(text).width, h = 64, arrow = 30, padX = 24, gap = 14, m = 16;
    const w = padX * 2 + arrow * 2 + gap * 2 + tw;
    const c = mk(w + m * 2, h + m * 2), x = c.getContext("2d");
    x.shadowColor = "rgba(0,0,0,.2)"; x.shadowBlur = 12; x.shadowOffsetY = 3;
    x.fillStyle = "rgba(255,255,255,.95)"; rr(x, m, m, w, h, h / 2); x.fill();
    x.shadowColor = "transparent";
    const cy = m + h / 2;
    const chev = (cx, dir) => {
      x.strokeStyle = dir < 0 ? "#179C96" : C.red; x.lineWidth = 7; x.lineCap = "round"; x.lineJoin = "round";
      x.beginPath(); x.moveTo(cx - 6 * dir, cy - 12); x.lineTo(cx + 6 * dir, cy); x.lineTo(cx - 6 * dir, cy + 12); x.stroke();
    };
    chev(m + padX + arrow / 2, -1);
    chev(m + w - padX - arrow / 2, 1);
    x.font = font; x.fillStyle = C.ink; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(text, m + w / 2, cy + 1);
    return c;
  }
  function buildCheck(color) {
    const r = 28, m = 10, c = mk((r + m) * 2, (r + m) * 2), x = c.getContext("2d");
    x.shadowColor = "rgba(0,0,0,.25)"; x.shadowBlur = 8; x.shadowOffsetY = 2;
    x.fillStyle = "#fff"; x.beginPath(); x.arc(r + m, r + m, r, 0, Math.PI * 2); x.fill();
    x.shadowColor = "transparent";
    x.strokeStyle = color; x.lineWidth = 7; x.lineCap = "round"; x.lineJoin = "round";
    x.beginPath(); x.moveTo(r + m - 12, r + m + 1); x.lineTo(r + m - 3, r + m + 10); x.lineTo(r + m + 13, r + m - 9); x.stroke();
    return c;
  }

  // ---------- Composer ----------
  const Composer = {
    canvas: null, ctx: null, video: null, img: {}, cache: {}, ready: false,
    mode: "preview", t0: 0, running: false, raf: 0, fired: new Set(),
    onTick: null, onDone: null, assetIssue: "",

    get total() { const t = CFG.timeline; return t.openingMs + CFG.questions.length * t.questionMs + t.closingMs; },

    async init(canvas, video) {
      this.canvas = canvas; this.video = video;
      canvas.width = W; canvas.height = H;
      this.ctx = canvas.getContext("2d");
      const A = CFG.assets;
      const raw = await Promise.all([A.logoPSLA, A.logoPRUCare, A.artworkLockup, A.artworkHashtag].map(loadImage));
      const ok = raw.map(im => !!im && canvasSafe(im));
      this.assetIssue = raw.some(im => !im) ? "missing" : ok.some(v => !v) ? "tainted" : "";
      const [psla, care, lockup, hashtag] = raw.map((im, i) => (ok[i] ? im : null));
      this.img = { psla, care, lockup, hashtag };
      try {
        await Promise.all(['54px "Chewy"', '700 28px "Poppins"', '400 26px "FS Albert"', '700 26px "FS Albert"'].map(f => document.fonts.load(f)));
      } catch (e) {}
      this.buildStatic();
      this.ready = true;
    },

    buildStatic() {
      const img = this.img, n = CFG.questions.length;
      this.cache = {
        brand: buildBrandPill(img, 1),
        logoRow: buildLogoRow(img),
        cards: CFG.questions.map((q, i) => buildQuestionCard(q, i, n)),
        tiles: CFG.questions.map(q => [buildTile(q.a, "#22B2AC"), buildTile(q.b, C.red)]),
        or: buildOrBadge(),
        sticker: buildLockupSticker(img),
        hashtag: buildHashtagPill(img),
        sub: buildPill("5 pertanyaan, jawab spontan!", { font: `700 30px ${F_UI}`, bg: "rgba(43,49,51,.55)", h: 64, padX: 28 }),
        handle: buildPill(CFG.igHandle, { font: `700 32px ${F_UI}`, color: C.tealText, bg: C.mint, h: 66, padX: 30 }),
        hint: buildHint(),
        hintTap: buildHint("Ketuk pilihanmu"),
        check: [buildCheck("#179C96"), buildCheck(C.red)]
      };
      const g = this.ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#CFEFEC"); g.addColorStop(1, "#5CCAC4");
      this.demoGrad = g;
      const top = this.ctx.createLinearGradient(0, 0, 0, 320);
      top.addColorStop(0, "rgba(0,0,0,.30)"); top.addColorStop(1, "rgba(0,0,0,0)");
      const bot = this.ctx.createLinearGradient(0, 820, 0, H);
      bot.addColorStop(0, "rgba(0,0,0,0)"); bot.addColorStop(1, "rgba(0,0,0,.38)");
      this.scrimTop = top; this.scrimBot = bot;
    },

    setName(name) {
      const first = (name || "Kamu").trim().split(/\s+/)[0].slice(0, 14) || "Kamu";
      this.cache.name = buildPill("versi " + first, { font: `48px ${F_PLAY}`, bg: C.teal, h: 82, padX: 36, stroke: "#fff" });
    },

    // --- loop ---
    startLoop() {
      if (this.running) return;
      this.running = true;
      const step = now => { if (!this.running) return; this.raf = requestAnimationFrame(step); this.frame(now); };
      this.raf = requestAnimationFrame(step);
    },
    stopLoop() { this.running = false; cancelAnimationFrame(this.raf); },
    preview() { this.mode = "preview"; this.startLoop(); },
    /** Pelacak kepala siap dipakai (atau simulasi tombol ← → sedang aktif). */
    trackerLive() { const tr = this.tracker; return !!tr && (tr.status === "ready" || !!tr.sim || (!!this.video && !this.video.videoWidth)); },
    /** Cadangan: ketuk sisi kiri (0) / kanan (1) layar untuk menjawab. */
    tap(side) { if (this.mode === "show" && this.head) this.tapSide = side; },
    tracker: null, head: false, armed: [], tapSide: null, holdP: 0, needNeutral: false, picks: [], pickAt: [], holdSide: -1, holdStart: 0, onPick: null,

    play(name, opts = {}) {
      this.setName(name);
      this.head = !!opts.head;
      this.armed = new Array(CFG.questions.length).fill(false);
      this.tapSide = null; this.holdP = 0;
      this.picks = new Array(CFG.questions.length).fill(null);
      this.pickAt = []; this.holdSide = -1;
      if (this.head && this.tracker) this.tracker.calibrateStart();
      this.fired = new Set();
      this.mode = "show";
      this.t0 = performance.now();
      this.startLoop();
    },
    once(key, fn) { if (!this.fired.has(key)) { this.fired.add(key); fn(); } },

    frame(now) {
      if (!this.ready) return;
      const x = this.ctx;
      if (this.tracker) this.tracker.update(this.video, now);
      this.drawSource(x, now, 0, 0, W, H);
      if (this.mode === "preview") {
        x.fillStyle = this.scrimTop; x.fillRect(0, 0, W, 320);
        this.drawBrand(x, 0);
        return;
      }
      const T = CFG.timeline, n = CFG.questions.length;
      const t = now - this.t0;
      const qStart = T.openingMs, cStart = qStart + n * T.questionMs, end = cStart + T.closingMs;
      let info;
      if (t < qStart) { this.drawOpening(x, t, now); info = { phase: "opening" }; }
      else if (t < cStart) {
        const k = Math.floor((t - qStart) / T.questionMs);
        this.drawQuestion(x, k, t - qStart - k * T.questionMs, now);
        info = { phase: "question", q: k };
      } else { this.drawClosing(x, Math.min(t - cStart, T.closingMs), now); info = { phase: "closing" }; }
      info.elapsed = Math.min(t, end); info.total = end;
      const trLive = this.trackerLive();
      info.faceLost = this.head && trLive && !this.tracker.hasFace(now);
      info.tapOnly = this.head && !trLive;
      info.needNeutral = this.head && info.phase === "question" && this.needNeutral;
      if (this.onTick) this.onTick(info);
      if (t >= end && this.mode === "show") { this.mode = "done"; if (this.onDone) this.onDone(); }
    },

    drawSource(x, now, dx, dy, dw, dh) {
      const v = this.video;
      if (v && v.readyState >= 2 && v.videoWidth) {
        drawCover(x, v, v.videoWidth, v.videoHeight, dx, dy, dw, dh, CFG.video.mirror);
      } else {
        // Mode demo: tanpa kamera (mis. laptop tanpa webcam / izin ditolak)
        x.save(); x.beginPath(); x.rect(dx, dy, dw, dh); x.clip();
        x.fillStyle = this.demoGrad; x.fillRect(dx, dy, dw, dh);
        const k = dw / W, cx = dx + dw / 2, bob = Math.sin(now / 650) * 8 * k;
        x.fillStyle = "rgba(255,255,255,.45)";
        x.beginPath(); x.arc(cx, dy + 560 * k + bob, 128 * k, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.ellipse(cx, dy + 1010 * k + bob, 290 * k, 230 * k, 0, 0, Math.PI * 2); x.fill();
        if (dw === W) {
          x.font = `700 26px ${F_UI}`; x.fillStyle = "rgba(15,126,121,.85)"; x.textAlign = "center"; x.textBaseline = "middle";
          x.fillText("Mode demo, kamera tidak aktif", cx, 772);
        }
        x.restore();
      }
    },

    drawBrand(x, yOff, alpha = 1) {
      const b = this.cache.brand;
      x.globalAlpha = alpha;
      x.drawImage(b, (W - b.width) / 2, 30 - 18 + yOff);
      x.globalAlpha = 1;
    },

    drawCentered(x, c, cx, cy, scale = 1, rot = 0, alpha = 1) {
      if (alpha <= 0.001 || scale <= 0.001) return;
      x.save(); x.globalAlpha = alpha; x.translate(cx, cy); if (rot) x.rotate(rad(rot)); x.scale(scale, scale);
      x.drawImage(c, -c.width / 2, -c.height / 2);
      x.restore();
    },

    // ---------- OPENING (3 dtk) ----------
    drawOpening(x, t, now) {
      const T = CFG.timeline.openingMs;
      x.fillStyle = this.scrimTop; x.fillRect(0, 0, W, 320);
      x.fillStyle = this.scrimBot; x.fillRect(0, 820, W, H - 820);
      this.drawBrand(x, lerp(-130, 0, outCubic(prog(t, 0, 450))));
      this.once("open", () => Sfx.sparkle());
      if (this.head && this.tracker && t > 500) this.tracker.calibrateSample();

      const exit = prog(t, T - 380, 380), ex = inCubic(exit);
      const pS = prog(t, 120, 560);
      const sS = (pS < 1 ? outBack(pS) : 1) * (1 - ex * 0.35);
      const wob = Math.sin(t / 240) * 1.2;
      this.drawCentered(x, this.cache.sticker, W / 2, 850 - ex * 30, lerp(0.3, 1, sS), -3 + wob, clamp(pS * 3) * (1 - exit));

      const pk = outCubic(prog(t, 380, 320)) * (1 - exit);
      if (pk > 0) {
        const st = this.cache.sticker;
        sparks(x, W / 2 - st.width / 2 + 40, 850 - st.height / 2 + 30, 34 * pk, -50);
        sparks(x, W / 2 + st.width / 2 - 40, 850 + st.height / 2 - 30, 34 * pk, 130);
      }
      const pN = prog(t, 650, 380);
      this.drawCentered(x, this.cache.name, W / 2, 1040, lerp(0.4, 1, outBack(pN)), 2, clamp(pN * 3) * (1 - exit));
      const pC = prog(t, 980, 320);
      this.drawCentered(x, this.cache.sub, W / 2, 1140 + (1 - outCubic(pC)) * 30, 1, 0, pC * (1 - exit));
    },

    // ---------- PERTANYAAN (5 × 6 dtk) ----------
    drawQuestion(x, k, qt, now) {
      const Q = CFG.timeline.questionMs, n = CFG.questions.length;
      x.fillStyle = this.scrimTop; x.fillRect(0, 0, W, 320);
      x.fillStyle = this.scrimBot; x.fillRect(0, 820, W, H - 820);

      // story-style progress di paling atas
      const segW = (W - 48 - 8 * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const sx = 24 + i * (segW + 8);
        x.fillStyle = "rgba(255,255,255,.42)"; rr(x, sx, 14, segW, 7, 3.5); x.fill();
        const f = i < k ? 1 : i === k ? clamp(qt / Q) : 0;
        if (f > 0) { x.fillStyle = "#fff"; rr(x, sx, 14, Math.max(7, segW * f), 7, 3.5); x.fill(); }
      }
      this.drawBrand(x, 0);

      this.once("q" + k, () => { Sfx.whoosh(); Sfx.pop(); });

      const out = prog(qt, Q - 360, 360), eo = inCubic(out);

      // kartu pertanyaan
      const card = this.cache.cards[k], m = card.meta;
      const pin = prog(qt, 0, 440);
      const sc = lerp(0.55, 1, outBack(pin)) * (1 - 0.12 * eo);
      const rot = lerp(-7, 0, outCubic(pin));
      const cx = W / 2, cy = 150 + m.h / 2 - eo * 50;
      x.save();
      x.globalAlpha = clamp(pin * 2.5) * (1 - out);
      x.translate(cx, cy); x.rotate(rad(rot)); x.scale(sc, sc);
      x.drawImage(card, -m.ox - m.w / 2, -m.oy - m.h / 2);
      // timer per pertanyaan
      const bw = 470, bx = -bw / 2, by = m.h / 2 - 32;
      x.fillStyle = C.mint; rr(x, bx, by, bw, 10, 5); x.fill();
      x.fillStyle = C.teal; rr(x, bx, by, Math.max(10, bw * (1 - clamp(qt / Q))), 10, 5); x.fill();
      x.restore();

      const tiles = this.cache.tiles[k];
      let wA = 0.5, picked = null, pAt = 0;
      if (this.head) {
        // MODE KEPALA: miring kiri = opsi kiri, miring kanan = opsi kanan. Pilihan terkunci.
        // Aturan (sama seperti prototype index.html):
        //  1. kepala harus TEGAK dulu (|tilt| < neutralDeg) sebelum bisa memilih,
        //     supaya miring dari soal sebelumnya tidak langsung terbawa;
        //  2. miring ≥ tiltDeg dan DITAHAN holdMs → terkunci (kartu terisi selama menahan);
        //  3. cadangan: ketuk sisi kiri/kanan layar.
        this.once("calib", () => this.tracker && this.tracker.calibrateEnd());
        const A = CFG.answer, W0 = 500, W1 = Q - 500, th = A.tiltDeg, nd = A.neutralDeg || 7, tr = this.tracker;
        const live = this.trackerLive();
        const face = live && tr.hasFace(now);
        picked = this.picks[k];
        const lock = side => {
          picked = this.picks[k] = side; this.pickAt[k] = now; this.holdSide = -1;
          Sfx.pick();
          if (this.onPick) this.onPick(k, side);
        };
        if (this.tapSide != null) { if (picked == null && qt >= 300 && qt <= W1) lock(this.tapSide); this.tapSide = null; }
        // mode demo tanpa kamera: tidak ada "kepala tegak" yang bisa dibaca, anggap siap
        if (live && !face && !tr.sim && this.video && !this.video.videoWidth) this.armed[k] = true;
        this.needNeutral = false;
        if (picked == null && qt >= W0 && qt <= W1 && face) {
          const tilt = tr.tilt;
          if (!this.armed[k]) {
            if (Math.abs(tilt) < nd) this.armed[k] = true;
            else if (qt > 600 + W0) this.needNeutral = true;
            this.holdSide = -1;
          } else {
            // hysteresis: setelah mulai condong, cukup bertahan di 70% ambang
            const hold = th * 0.7;
            const side = tilt <= -(this.holdSide === 0 ? hold : th) ? 0 : tilt >= (this.holdSide === 1 ? hold : th) ? 1 : -1;
            if (side < 0) this.holdSide = -1;
            else if (this.holdSide !== side) { this.holdSide = side; this.holdStart = now; }
            else if (now - this.holdStart >= A.holdMs) lock(side);
          }
        } else if (picked == null && !face) this.holdSide = -1;
        this.holdP = picked == null && this.holdSide >= 0 ? clamp((now - this.holdStart) / A.holdMs) : 0;
        pAt = this.pickAt[k] || 0;
        if (picked != null) wA = picked === 0 ? 1 : 0;
        else if (qt >= W0 && face && this.armed[k]) wA = 0.5 - clamp(tr.tilt / th, -1, 1) * 0.5;   // condong mengikuti kepala
        else wA = 0.5 + Math.sin(now / 320) * 0.05;
      } else {
        // MODE SUARA: pilihan menyala bergantian otomatis (tanpa tap)
        const ALT = 640, aStart = 820, aEnd = Q - 420;
        if (qt >= aStart) {
          const p = (Math.min(qt, aEnd) - aStart) / ALT, idx = Math.floor(p), local = p - idx;
          const target = idx % 2 === 0 ? 1 : 0, from = idx === 0 ? 0.5 : 1 - target;
          wA = lerp(from, target, outCubic(clamp(local * 3.2)));
          if (qt < aEnd) this.once(`t${k}-${idx}`, () => Sfx.tick(target === 1));
        }
      }
      [[0, 192, wA, 160, -1], [1, 528, 1 - wA, 240, 1]].forEach(([i, tx, emph, delay, dir]) => {
        const pi = prog(qt, delay, 460);
        const e = outCubic(pi);
        const isPick = this.head && picked === i, isOther = this.head && picked != null && picked !== i;
        const bump = isPick ? Math.sin(Math.PI * clamp((now - pAt) / 420)) * 0.12 : 0;
        const s = ((0.94 + 0.13 * emph) * lerp(0.7, 1, outBack(pi)) + bump) * (isOther ? 0.9 : 1);
        const a = clamp(pi * 2) * (isOther ? 0.5 : clamp(0.8 + 0.4 * emph)) * (1 - out);
        const ox = (1 - e) * 420 * dir;
        const ty = 1037 + eo * 90;
        const ringOn = this.head ? isPick : emph > 0.6;
        const ga = this.head ? 1 : (emph - 0.6) / 0.4;
        const wig = ringOn && !this.head ? Math.sin(now / 90) * 1.4 * ga : 0;
        x.save(); x.globalAlpha = a; x.translate(tx + ox, ty); x.rotate(rad(wig + (i === 0 ? -1.5 : 1.5))); x.scale(s, s);
        if (ringOn) {
          x.fillStyle = `rgba(255,255,255,${0.28 * ga})`; rr(x, -150 - 18, -107 - 18, 336, 250, 52); x.fill();
          x.strokeStyle = `rgba(255,255,255,${ga})`; x.lineWidth = 8; rr(x, -150 - 6, -107 - 6, 312, 226, 42); x.stroke();
        }
        x.drawImage(tiles[i], -tiles[i].width / 2, -tiles[i].height / 2);
        // isi progres dari bawah selama kepala ditahan miring ke kartu ini
        if (this.head && picked == null && this.holdSide === i && this.holdP > 0) {
          x.save(); rr(x, -150, -107, 300, 214, 38); x.clip();
          x.fillStyle = "rgba(255,255,255,.34)";
          x.fillRect(-150, 107 - 214 * this.holdP, 300, 214 * this.holdP);
          x.restore();
        }
        if (isPick) { const cb = this.cache.check[i]; x.drawImage(cb, 150 - cb.width / 2 - 10, -107 - cb.height / 2 + 10); }
        x.restore();
        if (out === 0) {
          if (isPick) {
            const sp = outCubic(clamp((now - pAt) / 500));
            x.globalAlpha = 1 - clamp((now - pAt - 700) / 400);
            sparks(x, tx + (i === 0 ? -150 : 150), ty - 112, 20 + 22 * sp, i === 0 ? -40 : 40, C.sun, 8);
            sparks(x, tx + (i === 0 ? 150 : -150), ty + 112, 16 + 18 * sp, i === 0 ? 140 : -140, "#fff", 7);
            x.globalAlpha = 1;
          } else if (!this.head && emph > 0.75) {
            x.globalAlpha = (emph - 0.75) / 0.25;
            sparks(x, tx + (i === 0 ? -150 : 150) + ox, ty - 112, 24, i === 0 ? -40 : 40, C.sun, 7);
            x.globalAlpha = 1;
          }
        }
      });
      // petunjuk "miringkan kepala" sampai peserta memilih
      if (this.head && picked == null) {
        const ph = prog(qt, 500, 300) * (1 - prog(qt, Q - 700, 250));
        // (wajah 🙂 dan label "miring kiri/kanan" dihapus sesuai permintaan; tinggal pill petunjuk)
        const live = this.trackerLive();
        this.drawCentered(x, live ? this.cache.hint : this.cache.hintTap, W / 2, 876, 1, Math.sin(now / 360) * 6, ph);
      }
      const po = prog(qt, 560, 320);
      const pulse = 1 + Math.sin(now / 160) * 0.04;
      this.drawCentered(x, this.cache.or, W / 2, 1037 + eo * 90, lerp(0.2, 1, outBack(po)) * pulse, 0, clamp(po * 3) * (1 - out));

      this.drawCentered(x, this.cache.hashtag, W / 2, 1210, 1, -2, 1);
    },

    // ---------- CLOSING (4 dtk) ----------
    drawClosing(x, ct, now) {
      this.once("close", () => Sfx.chime());
      // panel putih naik dengan tepi bergelombang
      const p = outCubic(prog(ct, 0, 560));
      const top = H - (H + 140) * p;
      const wave = (yy, amp, col) => {
        x.fillStyle = col; x.beginPath(); x.moveTo(0, yy + amp);
        x.bezierCurveTo(W * 0.3, yy - amp, W * 0.62, yy + amp * 1.6, W, yy - amp * 0.4);
        x.lineTo(W, H); x.lineTo(0, H); x.closePath(); x.fill();
      };
      wave(top - 34, 46, C.teal);
      wave(top, 46, "#fff");
      if (p < 0.98) return;

      // dekor bawah (mint & merah tipis)
      x.fillStyle = C.mint; x.beginPath(); x.moveTo(0, 1150);
      x.bezierCurveTo(220, 1100, 470, 1215, W, 1140); x.lineTo(W, H); x.lineTo(0, H); x.closePath(); x.fill();
      x.fillStyle = C.teal; x.beginPath(); x.moveTo(0, 1215);
      x.bezierCurveTo(260, 1170, 500, 1260, W, 1200); x.lineTo(W, H); x.lineTo(0, H); x.closePath(); x.fill();

      // wajah peserta di lingkaran
      const pf = prog(ct, 240, 480), sf = outBack(pf);
      if (pf > 0) {
        const r = 150 * sf, cx = W / 2, cy = 300;
        x.save(); x.beginPath(); x.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2); x.clip();
        this.drawSource(x, now, cx - 150, cy - 150, 300, 300);
        x.restore();
        x.strokeStyle = C.teal; x.lineWidth = 10; x.beginPath(); x.arc(cx, cy, r + 5, 0, Math.PI * 2); x.stroke();
        sparks(x, cx - r * 0.78, cy - r * 0.78, 30 * sf, -45);
        sparks(x, cx + r * 0.78, cy + r * 0.78, 30 * sf, 135, C.red);
      }
      // lockup campaign (artwork asli, background putih menyatu dengan panel)
      const pl = prog(ct, 420, 460);
      if (this.img.lockup) {
        const lw = 600, lh = lw * this.img.lockup.naturalHeight / this.img.lockup.naturalWidth;
        x.save(); x.globalAlpha = pl; x.translate(W / 2, 640); x.scale(lerp(0.85, 1, outBack(pl)), lerp(0.85, 1, outBack(pl)));
        x.drawImage(this.img.lockup, -lw / 2, -lh / 2, lw, lh); x.restore();
      } else {
        x.globalAlpha = pl; x.textAlign = "center"; x.textBaseline = "middle";
        x.font = `100px ${F_PLAY}`; x.fillStyle = C.red; x.fillText("Cerita Kita,", W / 2, 590);
        x.font = `74px ${F_PLAY}`; x.fillStyle = C.teal; x.fillText(CFG.hashtag, W / 2, 690); x.globalAlpha = 1;
      }
      const ph = prog(ct, 700, 400);
      this.drawCentered(x, this.cache.handle, W / 2, 820 + (1 - outCubic(ph)) * 24, 1, 0, ph);
      const pg = prog(ct, 900, 450);
      const lr = this.cache.logoRow;
      x.globalAlpha = pg; x.drawImage(lr, (W - lr.width) / 2, 960 + (1 - outCubic(pg)) * 24); x.globalAlpha = 1;
    }
  };

  window.CKComposer = Composer;
})();
