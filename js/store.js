/* =========================================================
   STORE — lapisan data peserta.
   Mode sekarang: DEMO LOKAL (localStorage di browser ini saja).
   Saat backend siap, ganti isi fungsi di bawah dengan panggilan API
   (lihat README bagian "Backend"). Antarmuka fungsi dibuat sama
   supaya app.js / crew.js / admin.js tidak perlu diubah.
   ========================================================= */
(function () {
  const KEY = "ck.demo.participants.v1";
  const SEEDED = "ck.demo.seeded.v1";
  const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // tanpa O/0/I/1/L biar gampang dibaca crew

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { return false; }
    try { window.dispatchEvent(new CustomEvent("ck:store")); } catch (e) {}
    return true;
  }
  function newId(list) {
    let id;
    do {
      id = "CK-" + Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
    } while (list.some(p => p.id === id));
    return id;
  }
  function normWA(v) {
    let d = String(v || "").replace(/\D/g, "");
    if (d.startsWith("62")) d = "0" + d.slice(2);
    else if (d.startsWith("8")) d = "0" + d;
    return d;
  }
  function maskWA(wa) {
    if (!wa) return "";
    return wa.slice(0, 4) + "•••" + wa.slice(-4);
  }
  function maskEmail(e) {
    if (!e || !e.includes("@")) return e || "";
    const [u, d] = e.split("@");
    return u.slice(0, 2) + "•••@" + d;
  }

  const Store = {
    mode: "demo-local",
    normWA, maskWA, maskEmail,

    list() { return read().sort((a, b) => b.createdAt - a.createdAt); },
    get(id) { return read().find(p => p.id === id) || null; },

    /** Registrasi. Nomor WA yang sama mengembalikan peserta lama (cegah daftar dobel). */
    register({ name, wa, email, consentParticipation, consentMarketing }) {
      const list = read();
      const waN = normWA(wa);
      const existing = list.find(p => p.wa === waN);
      if (existing) {
        existing.name = name.trim();
        existing.email = email.trim();
        existing.consentMarketing = existing.consentMarketing || !!consentMarketing;
        write(list);
        return { participant: existing, returning: true };
      }
      const p = {
        id: newId(list),
        name: name.trim(),
        wa: waN,
        email: email.trim().toLowerCase(),
        consentParticipation: !!consentParticipation,
        consentMarketing: !!consentMarketing,
        createdAt: Date.now(),
        videoCount: 0, videoDoneAt: null,
        verifiedAt: null, igHandle: "",
        redeemedAt: null, redeemedBy: "",
        source: "demo"
      };
      list.push(p);
      write(list);
      return { participant: p, returning: false };
    },

    markVideoDone(id, picks) {
      const list = read();
      const p = list.find(x => x.id === id);
      if (!p) return null;
      if (Array.isArray(picks)) p.answers = picks.map(v => v == null ? null : v === 0 ? "a" : "b");
      p.videoCount = (p.videoCount || 0) + 1;
      p.videoDoneAt = p.videoDoneAt || Date.now();
      write(list);
      return p;
    },

    /** Cari berdasarkan Participant ID, nomor WA, atau nama. */
    search(q) {
      const raw = String(q || "").trim();
      if (!raw) return [];
      const up = raw.toUpperCase().replace(/\s/g, "");
      const digits = raw.replace(/\D/g, "");
      const idQ = up.startsWith("CK") ? up.replace(/^CK-?/, "CK-") : "CK-" + up;
      const waQ = digits.length >= 4 ? normWA(digits) : "";
      const nameQ = raw.toLowerCase();
      return this.list().filter(p =>
        p.id.startsWith(idQ) ||
        (waQ && (p.wa.includes(waQ) || p.wa.includes(digits))) ||
        (raw.length >= 3 && p.name.toLowerCase().includes(nameQ))
      ).slice(0, 8);
    },

    /** Verifikasi postingan + redeem kopi. Menolak redeem kedua. */
    verifyAndRedeem(id, { crew, igHandle }) {
      const list = read();
      const p = list.find(x => x.id === id);
      if (!p) return { ok: false, reason: "not_found" };
      if (p.redeemedAt) return { ok: false, reason: "already_redeemed", participant: p };
      const now = Date.now();
      p.verifiedAt = p.verifiedAt || now;
      p.igHandle = (igHandle || "").trim();
      p.redeemedAt = now;
      p.redeemedBy = crew || "Crew";
      write(list);
      return { ok: true, participant: p };
    },

    status(p) {
      if (p.redeemedAt) return "redeemed";
      if (p.verifiedAt) return "verified";
      if (p.videoDoneAt) return "video";
      return "registered";
    },

    stats() {
      const list = read();
      return {
        total: list.length,
        marketing: list.filter(p => p.consentMarketing).length,
        video: list.filter(p => p.videoDoneAt).length,
        verified: list.filter(p => p.verifiedAt).length,
        redeemed: list.filter(p => p.redeemedAt).length
      };
    },

    /** Data simulasi untuk demo dashboard. Ditandai source:"sim". */
    seed(n = 64) {
      const first = ["Rizky","Nadia","Fajar","Salsa","Dimas","Aulia","Bagas","Putri","Rangga","Intan","Yoga","Citra","Ilham","Dewi","Raka","Nisa","Teguh","Ayu","Farhan","Laras","Gilang","Mega","Hendra","Tiara","Arif","Sinta","Bayu","Wulan","Reza","Anisa"];
      const last = ["Pratama","Lestari","Nugraha","Saputra","Permata","Hidayat","Kusuma","Ramadhan","Maharani","Setiawan","Wibowo","Anggraini","Firmansyah","Utami","Gunawan"];
      const list = read().filter(p => p.source !== "sim");
      const base = new Date(); base.setHours(6, 0, 0, 0);
      const span = 3.5 * 3600 * 1000; // 06:00–09:30
      let rnd = 7;
      const r = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < n; i++) {
        const fn = first[Math.floor(r() * first.length)], ln = last[Math.floor(r() * last.length)];
        const t = base.getTime() + Math.pow(r(), 0.8) * span;
        const video = r() < 0.86;
        const verified = video && r() < 0.68;
        const p = {
          id: newId(list),
          name: fn + " " + ln,
          wa: "08" + String(1 + Math.floor(r() * 9)) + String(Math.floor(r() * 1e9)).padStart(9, "0").slice(0, 8),
          email: (fn + "." + ln).toLowerCase() + "@contoh.id",
          consentParticipation: true,
          consentMarketing: r() < 0.62,
          createdAt: Math.round(t),
          videoCount: video ? 1 + (r() < 0.2 ? 1 : 0) : 0,
          videoDoneAt: video ? Math.round(t + 90e3 + r() * 120e3) : null,
          verifiedAt: verified ? Math.round(t + 300e3 + r() * 900e3) : null,
          igHandle: verified ? "@" + fn.toLowerCase() + (r() < 0.5 ? "." + ln.toLowerCase() : Math.floor(r() * 99)) : "",
          redeemedAt: null, redeemedBy: "",
          source: "sim"
        };
        if (video) { const biasB = [0.68, 0.44, 0.58, 0.55, 0.4]; p.answers = biasB.map(b => r() < 0.1 ? null : r() < b ? "b" : "a"); }
        if (verified) { p.redeemedAt = p.verifiedAt + 20e3; p.redeemedBy = ["Crew 1", "Crew 2", "Crew 3"][Math.floor(r() * 3)]; }
        list.push(p);
      }
      write(list);
      try { localStorage.setItem(SEEDED, "1"); } catch (e) {}
    },
    seedOnce() { let s = null; try { s = localStorage.getItem(SEEDED); } catch (e) {} if (!s) this.seed(); },
    clearSimulated() { write(read().filter(p => p.source !== "sim")); },
    clearAll() { write([]); try { localStorage.removeItem(SEEDED); } catch (e) {} },

    toCSV() {
      const cols = ["id","name","wa","email","consentParticipation","consentMarketing","createdAt","videoDoneAt","verifiedAt","igHandle","redeemedAt","redeemedBy","answers","source"];
      const fmt = v => (typeof v === "number" && v > 1e12) ? new Date(v).toISOString() : Array.isArray(v) ? v.map(x => x || "-").join("") : (v == null ? "" : String(v));
      const esc = s => /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      return [cols.join(","), ...this.list().map(p => cols.map(c => esc(fmt(p[c]))).join(","))].join("\n");
    },

    /** Dengarkan perubahan data (tab lain / halaman lain di browser yang sama). */
    onChange(cb) {
      window.addEventListener("storage", e => { if (e.key === KEY) cb(); });
      window.addEventListener("ck:store", cb);
    }
  };

  window.CKStore = Store;
})();
