/* =========================================================
   APP — state machine microsite peserta
   A. Registrasi → B. Pre-recording → C. Countdown + Recording → D. Preview
   ========================================================= */
(function () {
  const CFG = window.CK_CONFIG, Store = window.CKStore, Sfx = window.CKSfx;
  const Rec = window.CKRecorder, Comp = window.CKComposer, Head = window.CKHead;
  const HEAD_MODE = CFG.answer.mode === "head";
  const $ = s => document.querySelector(s);

  const el = {
    slot: $("#deviceSlot"), device: $("#device"),
    scr: { reg: $("#scrReg"), cam: $("#scrCam"), prev: $("#scrPrev") },
    form: $("#regForm"), btnStart: $("#btnStart"),
    camWrap: $("#camWrap"), canvas: $("#cv"), camVideo: $("#camVideo"),
    countdown: $("#countdown"), cdNum: $("#cdNum"), saving: $("#saving"),
    recBar: $("#recBar"), recTime: $("#recTime"), recStep: $("#recStep"), btnCancel: $("#btnCancel"),
    sheet: $("#preSheet"), preOk: $("#preOk"), preErr: $("#preErr"),
    errTitle: $("#errTitle"), errBody: $("#errBody"), errSteps: $("#errSteps"),
    btnRecord: $("#btnRecord"), btnRetryCam: $("#btnRetryCam"), btnDemo: $("#btnDemo"),
    prevOk: $("#prevOk"), prevEmpty: $("#prevEmpty"), resVideo: $("#resVideo"), btnUnmute: $("#btnUnmute"),
    btnSave: $("#btnSave"), btnRetake: $("#btnRetake"), pid: $("#pidText"), btnCaption: $("#btnCaption"), fmtNote: $("#fmtNote"),
    terms: $("#termsModal"), toast: $("#toast"), sr: $("#srLive"), env: $("#envNote"),
    track: $("#trackStatus"), howtoHead: $("#howtoHead"), howtoVoice: $("#howtoVoice"), cdHint: $("#cdHint")
  };

  const S = {
    screen: "reg", cam: "pre",       // cam: pre | countdown | rec | saving
    participant: null, result: null,
    demo: false, recOk: false, recording: false, run: 0, lastStep: ""
  };

  // ---------------- Layout: bingkai HP (laptop) vs layar HP asli ----------------
  function layout() {
    const w = innerWidth, h = innerHeight;
    const phone = w < 720 || (matchMedia("(pointer:coarse)").matches && w < 1024);
    document.body.classList.toggle("bare", phone);
    const rail = !phone && w >= 1040;
    document.body.classList.toggle("norail", !rail);
    if (!phone) {
      const railW = rail ? 380 + 56 : 0;
      const s = Math.min(1, (h - 40) / 868, (w - 40 - railW) / 414);
      el.slot.style.width = 414 * s + "px";
      el.slot.style.height = 868 * s + "px";
      el.device.style.transform = `scale(${s})`;
    } else {
      el.slot.style.width = el.slot.style.height = "";
      el.device.style.transform = "";
    }
    fitCam();
  }
  function fitCam() {
    const area = el.scr.cam;
    const aw = area.clientWidth, ah = area.clientHeight;
    if (!aw || !ah) return;
    const w = Math.min(aw, (ah - 72) * 9 / 16), h = w * 16 / 9;
    el.camWrap.style.width = w + "px";
    el.camWrap.style.height = h + "px";
    el.recBar.style.top = h + "px";
    el.camWrap.style.borderRadius = w < aw - 2 ? "0 0 22px 22px" : "0 0 26px 26px";
  }

  // ---------------- Navigasi ----------------
  function go(name) {
    if (S.screen === "cam" && name !== "cam") leaveCamera();
    Object.entries(el.scr).forEach(([k, node]) => node.classList.toggle("on", k === name));
    S.screen = name;
    el.scr[name].scrollTop = 0;
    if (name === "cam") requestAnimationFrame(fitCam);
    updateRail();
  }
  function setCam(state) {
    S.cam = state;
    el.sheet.classList.toggle("away", state !== "pre");
    el.recBar.hidden = !(state === "rec" || state === "saving" || state === "countdown");
    el.btnCancel.hidden = state === "saving";
    el.countdown.hidden = state !== "countdown";
    el.saving.hidden = state !== "saving";
    if (state === "countdown") { el.recTime.textContent = "00:00"; el.recStep.textContent = "Siap-siap"; }
    updateRail();
  }
  function leaveCamera() {
    cancelRecording(true);
    Comp.stopLoop();
    Rec.closeCamera();
  }

  // ---------------- A. Registrasi ----------------
  function readForm() {
    const f = new FormData(el.form);
    return {
      name: (f.get("name") || "").toString(),
      wa: (f.get("wa") || "").toString(),
      email: (f.get("email") || "").toString(),
      consentParticipation: f.get("consentParticipation") === "on",
      consentMarketing: f.get("consentMarketing") === "on"
    };
  }
  function validate(d) {
    const e = {};
    if (d.name.trim().length < 2) e.name = "Tulis nama lengkapmu.";
    if (!/^08\d{8,11}$/.test(Store.normWA(d.wa))) e.wa = "Nomor WhatsApp diawali 08 atau +62, 10–13 digit.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = "Format email belum benar, contoh: nama@email.com";
    if (!d.consentParticipation) e.consentParticipation = "Centang persetujuan ini dulu supaya bisa ikut.";
    return e;
  }
  function showErrors(errs) {
    el.form.querySelectorAll("[data-f]").forEach(node => {
      const k = node.dataset.f, msg = errs[k] || "";
      node.classList.toggle("invalid", !!msg);
      const out = node.querySelector(".field-error");
      if (out) out.textContent = msg;
    });
    $("#errConsent").textContent = errs.consentParticipation || "";
  }
  el.form.addEventListener("submit", async e => {
    e.preventDefault();
    const d = readForm(), errs = validate(d);
    showErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) { const inp = el.form.querySelector(`[name="${first}"]`); if (inp) inp.focus(); return; }
    Sfx.unlock(); // tap ini membuka izin audio di iOS
    const { participant, returning } = Store.register(d);
    S.participant = participant;
    if (returning) toast(`Nomor ini sudah terdaftar. ID kamu ${participant.id}.`);
    enterPre();
  });
  el.form.addEventListener("input", e => {
    const node = e.target.closest("[data-f]");
    if (node && node.classList.contains("invalid")) { node.classList.remove("invalid"); const o = node.querySelector(".field-error"); if (o) o.textContent = ""; if (node.dataset.f === "consentParticipation") $("#errConsent").textContent = ""; }
  });
  $("#openTerms").addEventListener("click", () => { el.terms.hidden = false; $("#closeTerms").focus(); });
  $("#closeTerms").addEventListener("click", () => { el.terms.hidden = true; });
  el.terms.addEventListener("click", e => { if (e.target === el.terms) el.terms.hidden = true; });

  // ---------------- B. Pre-recording ----------------
  async function enterPre() {
    go("cam");
    setCam("pre");
    showSheet("ok");
    Comp.preview();
    if (S.demo) return;
    el.btnRecord.disabled = true;
    el.btnRecord.textContent = "Menyalakan kamera…";
    try {
      await Rec.openCamera(el.camVideo);
      if (!Rec.hasAudio) toast("Mikrofon tidak aktif. Video tetap jalan, tapi tanpa suaramu.");
    } catch (err) {
      showCamError(err.code || "blocked");
    } finally {
      el.btnRecord.disabled = false;
      el.btnRecord.textContent = "Mulai Rekam";
    }
  }
  function showSheet(which) { el.preOk.hidden = which !== "ok"; el.preErr.hidden = which !== "err"; }

  // Status deteksi kepala di layar pre-recording (juga jadi tempat latihan miring kepala)
  function applyAnswerMode() {
    const headOn = HEAD_MODE && Head.status !== "failed";
    el.howtoHead.hidden = !headOn;
    el.howtoVoice.innerHTML = !HEAD_MODE ? "<b>Jawab pakai suara</b> dan ekspresi paling natural"
      : headOn ? "<b>Ceritain alasannya</b> pakai suara dan ekspresi"
      : "<b>Ketuk pilihan kiri/kanan</b>, lalu ceritain alasannya";
    el.cdHint.textContent = !HEAD_MODE ? "Jawab pakai suara, nggak perlu tap"
      : headOn ? "Tegakkan kepala, lalu miringkan ke pilihanmu"
      : "Ketuk pilihan kiri/kanan, lalu ceritain alasannya";
  }
  function trackStatus() {
    if (!HEAD_MODE) { el.track.hidden = true; return; }
    const now = performance.now(), th = CFG.answer.tiltDeg;
    let cls = "", txt = "";
    if (Head.status === "loading" || Head.status === "idle") {
      cls = "loading";
      txt = Head.phase === "model" && Head.progress > 0 && Head.progress < 1
        ? `Menyiapkan deteksi kepala… ${Math.round(Head.progress * 100)}%` : "Menyiapkan deteksi kepala…";
    }
    else if (Head.status === "failed") { cls = "warn"; txt = "Deteksi kepala tidak tersedia di HP ini. Jawab dengan ketuk pilihan kiri/kanan."; }
    else if (Head.switching) { cls = "loading"; txt = "Menyesuaikan deteksi kepala…"; }
    else if (S.demo) { cls = "ok"; txt = Head.sim ? (Head.sim < 0 ? "Miring kiri, mantap!" : "Miring kanan, mantap!") : "Mode demo: tahan tombol ← atau → untuk simulasi"; }
    else if (!Rec.stream) { cls = "loading"; txt = "Menunggu kamera…"; }
    else if (Head.hasFace(now)) {
      const t = Head.roll;
      cls = "ok"; txt = t <= -th ? "Miring kiri, mantap!" : t >= th ? "Miring kanan, mantap!" : "Wajah terdeteksi. Coba miringkan kepala!";
    } else { cls = "warn"; txt = "Wajahmu belum kelihatan. Posisikan di tengah kamera."; }
    el.track.hidden = false;
    el.track.className = "track " + cls;
    if (el.track.textContent !== txt) el.track.textContent = txt;
  }
  setInterval(() => { if (S.screen === "cam" && S.cam === "pre") trackStatus(); }, 250);

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const inApp = /Instagram|FBAN|FBAV|Line\/|TikTok|musical_ly/i.test(ua);
  function showCamError(code) {
    const permSteps = isIOS
      ? ["Ketuk ikon aA di kolom alamat Safari, lalu Pengaturan Situs Web.", "Ubah Kamera dan Mikrofon menjadi Izinkan.", "Kembali ke sini, ketuk Coba lagi."]
      : isAndroid
        ? ["Ketuk ikon pengaturan di sebelah alamat web.", "Buka Izin, aktifkan Kamera dan Mikrofon.", "Kembali ke sini, ketuk Coba lagi."]
        : ["Klik ikon kamera di kolom alamat browser.", "Pilih Izinkan untuk kamera dan mikrofon.", "Klik Coba lagi."];
    const inAppStep = "Buka link ini di Safari (iPhone) atau Chrome (Android), bukan di browser dalam aplikasi Instagram/TikTok.";
    const M = {
      denied: ["Izin kamera ditolak", "Microsite butuh kamera depan dan mikrofon untuk merekam ceritamu.", permSteps],
      insecure: ["Kamera butuh halaman HTTPS", "Browser hanya mengizinkan kamera di halaman https:// atau localhost.", ["Buka microsite lewat link https:// dari QR code.", "Untuk tes di laptop, jalankan lewat localhost (lihat README)."]],
      notfound: ["Kamera tidak ditemukan", "Perangkat ini tidak punya kamera yang bisa dipakai.", ["Coba pakai HP dengan kamera depan.", "Atau lanjut pakai mode demo untuk melihat alurnya."]],
      busy: ["Kamera sedang dipakai aplikasi lain", "Kamera tidak bisa dibuka karena sedang dipakai.", ["Tutup aplikasi lain yang memakai kamera, seperti video call.", "Kembali ke sini, ketuk Coba lagi."]],
      unsupported: ["Browser ini belum bisa membuka kamera", "Fitur kamera web tidak tersedia di browser ini.", [inAppStep, "Pastikan Safari/Chrome sudah versi terbaru."]],
      blocked: ["Kamera diblokir di tampilan ini", "Halaman ini dibuka di tempat yang tidak mengizinkan kamera.", inApp ? [inAppStep] : [inAppStep, ...permSteps.slice(0, 2)]]
    };
    const [title, body, steps] = M[code] || M.blocked;
    el.errTitle.textContent = title;
    el.errBody.textContent = body;
    el.errSteps.innerHTML = "";
    (inApp && code !== "insecure" && !steps.includes(inAppStep) ? [inAppStep, ...steps] : steps).forEach(s => { const li = document.createElement("li"); li.textContent = s; el.errSteps.appendChild(li); });
    showSheet("err");
  }
  el.btnRetryCam.addEventListener("click", () => { Sfx.unlock(); enterPre(); });
  el.btnDemo.addEventListener("click", () => { Sfx.unlock(); S.demo = true; Rec.closeCamera(); showSheet("ok"); trackStatus(); toast("Mode demo: rekaman pakai latar animasi, tanpa kamera."); });

  // ---------------- C. Countdown + Recording ----------------
  el.btnRecord.addEventListener("click", async () => {
    Sfx.unlock();
    if (HEAD_MODE && Head.status === "loading" && !S.demo) {
      // tunggu kalau model deteksi kepala masih diunduh (maks 15 detik, dengan progres).
      // Kalau tetap belum siap, rekaman jalan dan mode kepala aktif otomatis begitu siap
      // (selama masih di opening).
      el.btnRecord.disabled = true;
      const tick = setInterval(() => {
        const p = Head.phase === "model" && Head.progress < 1 ? ` ${Math.round(Head.progress * 100)}%` : "";
        el.btnRecord.textContent = "Menyiapkan deteksi kepala…" + p;
      }, 200);
      await Promise.race([Head.ready, wait(15000)]);
      clearInterval(tick);
      el.btnRecord.disabled = false;
      el.btnRecord.textContent = "Mulai Rekam";
      if (S.screen !== "cam" || S.cam !== "pre") return;
    }
    startCountdown();
  });

  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function startCountdown() {
    const run = ++S.run;
    setCam("countdown");
    for (const n of [3, 2, 1]) {
      el.cdNum.textContent = n;
      const ring = el.cdNum.parentElement; // .cd-ring: cincin terisi 1 detik + angka pop
      ring.classList.remove("pop"); void ring.offsetWidth; ring.classList.add("pop");
      Sfx.countdown(n);
      if (navigator.vibrate) try { navigator.vibrate(25); } catch (e) {}
      await wait(1000);
      if (run !== S.run) return;
    }
    startRecording(run); // countdown TIDAK ikut terekam
  }
  function startRecording(run) {
    setCam("rec");
    S.lastStep = "";
    Comp.onTick = onTick;
    Comp.onDone = () => finishRecording(run);
    Comp.onPick = (k, side) => {
      if (navigator.vibrate) try { navigator.vibrate(35); } catch (e) {}
      const q = CFG.questions[k];
      el.sr.textContent = "Kamu pilih " + (side === 0 ? q.a.label : q.b.label);
    };
    // Mode kepala selalu aktif. Kalau model belum/tidak siap, jawab dengan ketuk kiri/kanan;
    // begitu model siap di tengah rekaman, miring kepala langsung bisa dipakai.
    S.head = HEAD_MODE;
    if (HEAD_MODE && Head.status !== "ready" && !S.demo) toast("Deteksi kepala belum siap. Ketuk pilihan kiri/kanan untuk menjawab ya!");
    Comp.play(S.participant ? S.participant.name : "Kamu", { head: S.head });
    S.recOk = Rec.start(el.canvas);
    S.recording = true;
    if (!S.recOk) toast("Browser ini belum bisa merekam video. Animasi tetap jalan sebagai demo.");
  }
  function onTick(info) {
    const sec = Math.floor(info.elapsed / 1000);
    const txt = "00:" + String(sec).padStart(2, "0");
    if (el.recTime.textContent !== txt) el.recTime.textContent = txt;
    const step = info.phase === "question"
      ? (info.faceLost ? "Hadap ke kamera ya"
        : info.needNeutral ? "Tegakkan kepala dulu"
        : `Pertanyaan ${info.q + 1}/${CFG.questions.length}`)
      : info.phase === "opening" ? "Opening" : "Closing";
    if (step !== S.lastStep) {
      S.lastStep = step;
      el.recStep.textContent = step;
      if (info.phase === "question") el.sr.textContent = CFG.questions[info.q].prompt;
    }
  }
  async function finishRecording(run) {
    if (run !== S.run) return;
    S.recording = false;
    setCam("saving");
    const res = S.recOk ? await Rec.stop() : null;
    if (run !== S.run) return;
    Comp.stopLoop();
    Rec.closeCamera(); // lampu kamera mati saat preview
    if (res) {
      if (S.result) URL.revokeObjectURL(S.result.url);
      S.result = res;
      if (S.participant && Store.get(S.participant.id)) Store.markVideoDone(S.participant.id, Comp.head ? Comp.picks : null);
    }
    showPreview();
    if (!res) toast("Video tidak tersimpan di browser ini. Coba Chrome (Android) atau Safari (iPhone).");
  }
  function cancelRecording(silent) {
    if (S.cam === "countdown" || S.recording || S.cam === "saving") {
      S.run++;
      Rec.cancel();
      S.recording = false;
      Comp.mode = "preview";
      if (!silent) { setCam("pre"); showSheet("ok"); }
    }
  }
  el.btnCancel.addEventListener("click", () => cancelRecording(false));

  // Cadangan menjawab: ketuk sisi kiri/kanan video saat pertanyaan tampil
  el.canvas.addEventListener("pointerdown", e => {
    if (!S.recording || !S.head) return;
    const r = el.canvas.getBoundingClientRect();
    Comp.tap(e.clientX - r.left < r.width / 2 ? 0 : 1);
  });

  // Tab/aplikasi ditinggal saat merekam → browser menghentikan frame, jadi batalkan dengan jelas.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && (S.recording || S.cam === "countdown")) {
      cancelRecording(false);
      S.interrupted = true;
    } else if (!document.hidden && S.interrupted) {
      S.interrupted = false;
      toast("Rekaman berhenti karena layar ditinggal. Ketuk Mulai Rekam untuk ulang.");
    }
  });

  // ---------------- D. Preview & simpan ----------------
  function showPreview() {
    go("prev");
    const has = !!S.result;
    el.prevOk.hidden = !has;
    el.prevEmpty.hidden = has;
    if (!has) return;
    el.pid.textContent = S.participant ? S.participant.id : "CK-DEMO";
    const v = el.resVideo;
    v.src = S.result.url;
    v.muted = true;
    el.btnUnmute.hidden = false;
    v.play().catch(() => {});
    // WebM dari MediaRecorder tidak punya durasi: paksa browser menghitungnya
    v.onloadedmetadata = () => {
      if (v.duration === Infinity || isNaN(v.duration)) {
        v.currentTime = 1e7;
        v.ontimeupdate = () => { v.ontimeupdate = null; v.currentTime = 0; v.play().catch(() => {}); };
      }
    };
    el.fmtNote.textContent = S.result.ext === "webm"
      ? "Format video: WebM. Sebagian HP dan Instagram belum bisa membaca format ini. Pakai Chrome versi terbaru atau Safari."
      : "";
  }
  el.btnUnmute.addEventListener("click", () => { el.resVideo.muted = false; el.resVideo.currentTime = 0; el.resVideo.play().catch(() => {}); el.btnUnmute.hidden = true; });
  el.resVideo.addEventListener("volumechange", () => { if (!el.resVideo.muted) el.btnUnmute.hidden = true; });

  function fileName() { return `CeritaKita-${S.participant ? S.participant.id : "demo"}.${S.result.ext}`; }
  function download(url, name) {
    const a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  }
  el.btnSave.addEventListener("click", () => {
    if (!S.result) return;
    const name = fileName();
    const coarse = matchMedia("(pointer:coarse)").matches;
    let file = null;
    try { file = new File([S.result.blob], name, { type: S.result.mime }); } catch (e) {}
    // HP: share sheet → "Simpan Video" ke galeri (iPhone) / pilih Instagram langsung
    if (coarse && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] })
        .then(() => toast("Mantap! Lanjut upload ke Instagram ya."))
        .catch(err => { if (err && err.name !== "AbortError") { download(S.result.url, name); toast("Video diunduh. Cek folder Download."); } });
    } else {
      download(S.result.url, name);
      toast(isIOS ? "Pilih Unduh, lalu buka dari app Files untuk simpan ke Foto." : "Video diunduh. Cek folder Download.");
    }
  });
  el.btnRetake.addEventListener("click", async () => {
    Sfx.unlock();
    go("cam");
    setCam("pre");
    showSheet("ok");
    Comp.preview();
    try {
      if (!S.demo) await Rec.openCamera(el.camVideo);
      startCountdown();
    } catch (err) { showCamError(err.code || "blocked"); }
  });
  $("#btnGoRecord").addEventListener("click", () => jump("pre"));

  el.btnCaption.addEventListener("click", async () => {
    const text = CFG.caption;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); try { ok = document.execCommand("copy"); } catch (e2) {} ta.remove();
    }
    toast(ok ? "Caption disalin. Tempel di Instagram ya!" : text);
  });

  // ---------------- Panel presentasi (laptop) ----------------
  function ensureParticipant() {
    if (!S.participant) S.participant = { id: "CK-DEMO", name: "Peserta Demo", demoOnly: true };
  }
  async function jump(target) {
    if (target === "reg") { go("reg"); return; }
    if (target === "prev") { if (S.screen === "cam") leaveCamera(); showPreview(); return; }
    ensureParticipant();
    Sfx.unlock();
    if (target === "pre") { if (S.screen === "cam") cancelRecording(true); enterPre(); return; }
    if (target === "rec") {
      if (S.screen === "cam") cancelRecording(true);
      go("cam"); setCam("pre"); showSheet("ok"); Comp.preview();
      try { if (!S.demo) await Rec.openCamera(el.camVideo); startCountdown(); }
      catch (err) { showCamError(err.code || "blocked"); }
    }
  }
  document.querySelectorAll("[data-jump]").forEach(b => b.addEventListener("click", () => jump(b.dataset.jump)));
  function updateRail() {
    const key = S.screen === "reg" ? "reg" : S.screen === "prev" ? "prev" : S.cam === "pre" ? "pre" : "rec";
    document.querySelectorAll("[data-jump]").forEach(b => b.classList.toggle("on", b.dataset.jump === key));
  }
  $("#btnFill").addEventListener("click", () => {
    const f = el.form;
    f.name.value = "Rani Lestari";
    f.wa.value = "0812 3456 7890";
    f.email.value = "rani.lestari@contoh.id";
    f.consentParticipation.checked = true;
    showErrors({});
    go("reg");
  });
  $("#btnReset").addEventListener("click", () => {
    if (S.screen === "cam") leaveCamera();
    if (S.result) URL.revokeObjectURL(S.result.url);
    S.result = null; S.participant = null; S.demo = false;
    el.resVideo.removeAttribute("src"); el.resVideo.load();
    el.form.reset(); showErrors({});
    go("reg");
  });

  // ---------------- util ----------------
  let toastT = 0;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => el.toast.classList.remove("show"), 3200);
  }
  function envNote() {
    const s = Rec.supportInfo();
    const fmt = !s.recorder ? '<span class="warn">Browser ini tidak mendukung perekaman video.</span>'
      : s.mime.startsWith("video/mp4") ? "Format rekaman di browser ini: <b>MP4 (H.264)</b>."
      : `Format rekaman di browser ini: <b>${s.mime || "default"}</b>. Untuk MP4, pakai Chrome terbaru atau Safari.`;
    const sec = s.secure ? "" : '<br><span class="warn">Halaman tidak aman (bukan HTTPS/localhost): kamera akan diblokir.</span>';
    const asset = Comp.assetIssue === "tainted" ? '<br><span class="warn">Dibuka sebagai file://, logo tidak bisa masuk video. Jalankan lewat server lokal (lihat README).</span>'
      : Comp.assetIssue === "missing" ? '<br><span class="warn">Ada file aset yang belum ditemukan di folder assets/.</span>' : "";
    const head = !HEAD_MODE ? "<br>Mode jawaban: <b>suara</b>."
      : Head.status === "ready" ? `<br>Deteksi kepala: <b>siap</b> (${Head.delegate}). Di laptop bisa simulasi dengan tahan tombol ← / →.`
      : Head.status === "failed" ? `<br><span class="warn">Deteksi kepala gagal dimuat, peserta menjawab dengan ketuk kiri/kanan.</span><br><small>${String(Head.error).replace(/[<>&]/g, "").slice(0, 160)}</small>`
      : "<br>Deteksi kepala: memuat…";
    el.env.innerHTML = fmt + head + sec + asset;
  }
  document.querySelectorAll(".js-ig").forEach(n => (n.textContent = CFG.igHandle));
  document.querySelectorAll(".js-tag").forEach(n => (n.textContent = CFG.hashtag));

  // ---------------- init ----------------
  Comp.tracker = HEAD_MODE ? Head : null;
  applyAnswerMode();
  if (HEAD_MODE) setTimeout(() => Head.load().then(() => { applyAnswerMode(); envNote(); }), 300); // unduh di latar saat peserta isi form
  layout();
  addEventListener("resize", layout);
  addEventListener("orientationchange", () => setTimeout(layout, 300));
  Comp.init(el.canvas, el.camVideo).then(() => { envNote(); if (S.screen === "cam") Comp.preview(); });
  envNote();
  window.CKApp = { S, go, jump }; // untuk debugging/QA
})();
