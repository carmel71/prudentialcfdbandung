/* =========================================================
   ADMIN DASHBOARD — monitoring (data simulasi + registrasi demo)
   ========================================================= */
(function () {
  const Store = window.CKStore, CFG = window.CK_CONFIG;
  const $ = s => document.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const STATUS = { registered: "Baru daftar", video: "Video selesai", verified: "Terverifikasi", redeemed: "Kopi diredeem" };
  const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":") : "–";
  const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "0%";
  let filter = "all";

  function kpis(s) {
    $("#kTotal").textContent = s.total;
    $("#kTotalSub").textContent = "peserta unik (per nomor WA)";
    $("#kMkt").textContent = s.marketing;
    $("#kMktSub").textContent = pct(s.marketing, s.total) + " dari registrasi";
    $("#kVid").textContent = s.video;
    $("#kVidSub").textContent = pct(s.video, s.total) + " dari registrasi";
    $("#kVer").textContent = s.verified;
    $("#kVerSub").textContent = pct(s.verified, s.video) + " dari video selesai";
    $("#kRed").textContent = s.redeemed;
    $("#kRedSub").textContent = "1 kopi per peserta";
  }

  function funnel(s) {
    const rows = [["Registrasi", s.total], ["Video selesai", s.video], ["Terverifikasi", s.verified], ["Kopi diredeem", s.redeemed]];
    const box = $("#funnel"); box.innerHTML = "";
    rows.forEach(([name, v]) => {
      const r = document.createElement("div"); r.className = "f-row"; r.tabIndex = 0;
      r.setAttribute("aria-label", `${name}: ${v} (${pct(v, s.total)})`);
      const n = document.createElement("span"); n.className = "name"; n.textContent = name;
      const tr = document.createElement("div"); tr.className = "f-track";
      const w = s.total ? v / s.total : 0;
      const f = document.createElement("div"); f.className = "f-fill"; f.style.width = (w * 78).toFixed(2) + "%";
      const lab = document.createElement("span"); lab.className = "f-val"; lab.style.left = `calc(${(w * 78).toFixed(2)}% + 8px)`;
      lab.textContent = v; const sm = document.createElement("small"); sm.textContent = pct(v, s.total); lab.appendChild(sm);
      tr.append(f, lab); r.append(n, tr); box.appendChild(r);
    });
  }

  function columns(list) {
    const host = $("#colchart"), tip = $("#tip");
    host.querySelectorAll("svg").forEach(n => n.remove());
    if (!list.length) { $("#binNote").textContent = "Belum ada data"; return; }
    const times = list.map(p => p.createdAt);
    const min = Math.min(...times), max = Math.max(...times);
    const span = max - min;
    const bin = span <= 4.5 * 3600e3 ? 15 * 60e3 : span <= 9 * 3600e3 ? 30 * 60e3 : 60 * 60e3;
    const start = Math.floor(min / bin) * bin, end = Math.max(start + bin, Math.ceil((max + 1) / bin) * bin);
    const n = Math.min(48, Math.round((end - start) / bin));
    const counts = new Array(n).fill(0);
    times.forEach(t => { const i = Math.min(n - 1, Math.floor((t - start) / bin)); counts[i]++; });
    $("#binNote").textContent = `per ${bin / 60e3} menit`;

    const W = host.clientWidth || 600, H = 230, L = 30, R = 6, T = 10, B = 26;
    const iw = W - L - R, ih = H - T - B;
    const top = Math.max(4, Math.ceil(Math.max(...counts) / 4) * 4);
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Registrasi per ${bin / 60e3} menit, puncak ${Math.max(...counts)} peserta`);
    const g = document.createElementNS(NS, "g"); g.setAttribute("class", "grid");
    const ax = document.createElementNS(NS, "g"); ax.setAttribute("class", "axis");
    for (let k = 0; k <= 4; k++) {
      const v = top * k / 4, y = T + ih - ih * v / top;
      const ln = document.createElementNS(NS, "line"); ln.setAttribute("x1", L); ln.setAttribute("x2", W - R); ln.setAttribute("y1", y); ln.setAttribute("y2", y); g.appendChild(ln);
      const tx = document.createElementNS(NS, "text"); tx.setAttribute("x", L - 6); tx.setAttribute("y", y + 4); tx.setAttribute("text-anchor", "end"); tx.textContent = v; ax.appendChild(tx);
    }
    svg.append(g, ax);
    const slot = iw / n, bw = Math.max(2, slot - 2);
    const labelEvery = Math.max(1, Math.round((60 * 60e3) / bin)) * (n > 24 ? 2 : 1);
    counts.forEach((c, i) => {
      const x = L + i * slot + 1, hgt = ih * c / top, y = T + ih - hgt;
      const t0 = start + i * bin;
      if (c > 0) {
        const r = Math.min(4, bw / 2, hgt);
        const p = document.createElementNS(NS, "path");
        // ujung data membulat 4px, menempel di baseline
        p.setAttribute("d", `M${x},${T + ih} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${T + ih} Z`);
        p.setAttribute("class", "col"); p.setAttribute("fill", "#179C96"); p.dataset.i = i;
        svg.appendChild(p);
      }
      const hit = document.createElementNS(NS, "rect");
      hit.setAttribute("x", L + i * slot); hit.setAttribute("y", T); hit.setAttribute("width", slot); hit.setAttribute("height", ih);
      hit.setAttribute("class", "hit"); hit.setAttribute("tabindex", "0");
      hit.setAttribute("aria-label", `${fmtTime(t0)}–${fmtTime(t0 + bin)}: ${c} registrasi`);
      const show = () => {
        svg.querySelectorAll("path.col").forEach(pp => pp.setAttribute("fill", pp.dataset.i == i ? "#128580" : "#179C96"));
        tip.hidden = false; tip.innerHTML = "";
        const b = document.createElement("b"); b.textContent = c + " registrasi";
        const s = document.createElement("span"); s.textContent = `${fmtTime(t0)}–${fmtTime(t0 + bin)}`;
        tip.append(b, s);
        const scale = host.clientWidth / W;
        tip.style.left = (L + i * slot + slot / 2) * scale + "px";
        tip.style.top = Math.max(0, (y - 8) * scale) + "px";
      };
      const hide = () => { tip.hidden = true; svg.querySelectorAll("path.col").forEach(pp => pp.setAttribute("fill", "#179C96")); };
      hit.addEventListener("pointerenter", show); hit.addEventListener("focus", show);
      hit.addEventListener("pointerleave", hide); hit.addEventListener("blur", hide);
      svg.appendChild(hit);
      if (i % labelEvery === 0) {
        const tx = document.createElementNS(NS, "text"); tx.setAttribute("x", L + i * slot); tx.setAttribute("y", H - 6); tx.textContent = fmtTime(t0);
        ax.appendChild(tx);
      }
    });
    host.appendChild(svg);
  }

  function answers(list) {
    const box = $("#answers"); box.innerHTML = "";
    const withAns = list.filter(p => Array.isArray(p.answers));
    $("#ansNote").textContent = `${withAns.length} peserta memilih lewat gerakan kepala`;
    CFG.questions.forEach((q, i) => {
      let a = 0, b = 0;
      withAns.forEach(p => { if (p.answers[i] === "a") a++; else if (p.answers[i] === "b") b++; });
      const tot = a + b, pa = tot ? Math.round(a / tot * 100) : 0, pb = tot ? 100 - pa : 0;
      const row = document.createElement("div");
      const qq = document.createElement("p"); qq.className = "ans-q"; qq.textContent = `${i + 1}. ${q.prompt}`;
      const bar = document.createElement("div"); bar.className = "ans-bar";
      [["a", a, pa, q.a.label], ["b", b, pb, q.b.label]].forEach(([k, n, pc, label]) => {
        const seg = document.createElement("span"); seg.className = k; seg.tabIndex = 0;
        seg.style.flex = tot ? String(Math.max(n, 0.001)) : "1";
        seg.title = `${label}: ${n} peserta (${pc}%)`; seg.setAttribute("aria-label", seg.title);
        bar.appendChild(seg);
      });
      const labs = document.createElement("div"); labs.className = "ans-labels";
      [[q.a, a, pa], [q.b, b, pb]].forEach(([o, n, pc]) => {
        const sp = document.createElement("span");
        const bb = document.createElement("b"); bb.textContent = `${pc}% `;
        sp.append(bb, document.createTextNode(`${o.emoji} ${o.label} (${n})`));
        labs.appendChild(sp);
      });
      row.append(qq, bar, labs); box.appendChild(row);
    });
  }

  function table(list) {
    const q = $("#tq").value.trim().toLowerCase();
    const rows = list.filter(p => {
      const st = Store.status(p);
      if (filter === "registered" && st !== "registered") return false;
      if (filter === "video" && !p.videoDoneAt) return false;
      if (filter === "redeemed" && !p.redeemedAt) return false;
      if (q && !(p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.wa.includes(q.replace(/\D/g, "") || "§"))) return false;
      return true;
    });
    const tb = $("#tbody"); tb.innerHTML = "";
    rows.slice(0, 300).forEach(p => {
      const tr = document.createElement("tr");
      const cell = (text, cls) => { const td = document.createElement("td"); if (cls) td.className = cls; td.textContent = text; tr.appendChild(td); return td; };
      const idTd = cell(""); const id = document.createElement("span"); id.className = "id"; id.textContent = p.id; idTd.appendChild(id);
      if (p.source === "sim") { const s = document.createElement("span"); s.className = "sim-tag"; s.textContent = "sim"; idTd.appendChild(s); }
      cell(p.name);
      cell(Store.maskWA(p.wa), "num");
      cell(fmtTime(p.createdAt), "num");
      cell(p.consentMarketing ? "Ya" : "Tidak");
      cell(p.videoDoneAt ? (p.videoCount > 1 ? `Ya (${p.videoCount}×)` : "Ya") : "–");
      cell(p.igHandle || "–");
      const st = Store.status(p); const td = cell(""); const c = document.createElement("span"); c.className = "chip " + st; c.textContent = STATUS[st]; td.appendChild(c);
      tb.appendChild(tr);
    });
    $("#tfoot").textContent = `${rows.length} peserta ditampilkan${rows.length > 300 ? " (300 pertama)" : ""}.`;
  }

  function render() {
    const list = Store.list(), s = Store.stats();
    kpis(s); funnel(s); columns(list); answers(list); table(list);
  }

  $("#filters").addEventListener("click", e => {
    const b = e.target.closest("button[data-f]"); if (!b) return;
    filter = b.dataset.f;
    document.querySelectorAll("#filters button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    table(Store.list());
  });
  $("#tq").addEventListener("input", () => table(Store.list()));
  $("#btnCsv").addEventListener("click", () => {
    const blob = new Blob(["﻿" + Store.toCSV()], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "cerita-kita-peserta.csv";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $("#btnReseed").addEventListener("click", () => { Store.seed(); toast("Data simulasi diisi ulang."); });
  let armed = false;
  $("#btnClear").addEventListener("click", e => {
    if (!armed) { armed = true; e.currentTarget.textContent = "Klik lagi untuk hapus"; setTimeout(() => { armed = false; $("#btnClear").textContent = "Hapus semua"; }, 3000); return; }
    armed = false; e.currentTarget.textContent = "Hapus semua"; Store.clearAll(); toast("Semua data demo dihapus.");
  });
  let tT = 0;
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(tT); tT = setTimeout(() => t.classList.remove("show"), 2400); }

  Store.seedOnce();
  Store.onChange(render);
  addEventListener("resize", () => columns(Store.list()));
  render();
})();
