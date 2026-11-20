/* =========================================================
   CREW DASHBOARD — cari peserta, verifikasi postingan IG, redeem kopi
   ========================================================= */
(function () {
  const CFG = window.CK_CONFIG, Store = window.CKStore;
  const $ = s => document.querySelector(s);
  const el = { q: $("#q"), results: $("#results"), detail: $("#detail"), log: $("#log"), crew: $("#crewName"),
    rc: $("#redeemCount"), reg: $("#regCount"), bar: $("#redeemBar"), confirm: $("#confirm"), cBody: $("#cBody"), toast: $("#toast") };
  let selected = null, justRedeemed = null;

  const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg>',
    dot: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>'
  };
  const STATUS = { registered: "Terdaftar", video: "Video selesai", verified: "Terverifikasi", redeemed: "Kopi diredeem" };
  const time = ts => ts ? new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":") : "";
  const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  function chip(p) { const st = Store.status(p); const c = h("span", "chip " + st); c.innerHTML = (st === "redeemed" ? ICON.check : ""); c.appendChild(document.createTextNode(STATUS[st])); return c; }

  try { el.crew.value = localStorage.getItem("ck.crew.name") || "Crew 1"; } catch (e) {}
  el.crew.addEventListener("change", () => { try { localStorage.setItem("ck.crew.name", el.crew.value); } catch (e) {} });

  // ---------- pencarian ----------
  function renderResults(auto) {
    const q = el.q.value;
    el.results.innerHTML = "";
    if (!q.trim()) return;
    const list = Store.search(q);
    if (!list.length) { el.results.appendChild(h("p", "empty-res", "Peserta tidak ditemukan. Cek lagi ID atau nomor WhatsApp-nya.")); return; }
    list.forEach(p => {
      const b = h("button", "result"); b.type = "button";
      b.appendChild(h("b", null, p.name));
      b.appendChild(chip(p));
      b.appendChild(h("small", null, `${p.id}  ·  ${Store.maskWA(p.wa)}`));
      b.addEventListener("click", () => select(p.id));
      el.results.appendChild(b);
    });
    // ID persis → langsung buka
    const exact = list.find(p => p.id === q.trim().toUpperCase());
    if (auto && exact && list.length === 1 && selected !== exact.id) select(exact.id);
  }
  el.q.addEventListener("input", () => renderResults(true));
  el.q.addEventListener("keydown", e => { if (e.key === "Enter") { const first = el.results.querySelector(".result"); if (first) first.click(); } });

  // ---------- detail peserta ----------
  function select(id) { selected = id; justRedeemed = null; renderDetail(); el.detail.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function renderDetail() {
    const p = selected && Store.get(selected);
    el.detail.hidden = !p;
    el.detail.innerHTML = "";
    if (!p) return;

    if (justRedeemed === p.id) {
      const s = h("div", "success");
      const big = h("div", "big"); big.innerHTML = ICON.check; s.appendChild(big);
      s.appendChild(h("h3", null, "Kopi diredeem"));
      s.appendChild(h("p", "muted", `${p.name} (${p.id}), ${time(p.redeemedAt)} oleh ${p.redeemedBy}.`));
      const again = h("button", "btn btn-secondary btn-sm", "Cari peserta lain"); again.type = "button";
      again.addEventListener("click", () => { selected = null; el.q.value = ""; renderResults(); renderDetail(); el.q.focus(); });
      s.appendChild(again);
      el.detail.appendChild(s);
      return;
    }

    const head = h("div", "d-head");
    const left = h("div");
    left.appendChild(h("h2", null, p.name));
    left.appendChild(h("p", "d-meta", `${Store.maskWA(p.wa)}  ·  ${Store.maskEmail(p.email)}`));
    head.appendChild(left);
    head.appendChild(h("div", "d-id", p.id));
    el.detail.appendChild(head);

    const tl = h("ol", "timeline");
    [["Terdaftar", p.createdAt], ["Video challenge selesai", p.videoDoneAt], ["Postingan IG diverifikasi", p.verifiedAt], ["Kopi diredeem", p.redeemedAt]].forEach(([label, ts], i) => {
      const li = h("li", ts ? "done" + (i === 3 ? " final" : "") : "");
      const d = h("span", "dot"); d.innerHTML = ts ? ICON.check : ICON.dot; li.appendChild(d);
      li.appendChild(h("span", null, label));
      li.appendChild(h("time", null, ts ? time(ts) : "–"));
      tl.appendChild(li);
    });
    el.detail.appendChild(tl);

    if (p.redeemedAt) {
      const n = h("div", "notice stop");
      n.appendChild(h("b", null, "Sudah klaim kopi"));
      n.appendChild(document.createTextNode(`Diredeem pukul ${time(p.redeemedAt)} oleh ${p.redeemedBy}${p.igHandle ? " (IG " + p.igHandle + ")" : ""}. Satu peserta hanya bisa redeem satu kali.`));
      el.detail.appendChild(n);
      return;
    }
    if (!p.videoDoneAt) {
      const n = h("div", "notice warn");
      n.textContent = "Video belum tercatat selesai. Tetap boleh diverifikasi kalau postingan Instagram-nya ada.";
      n.style.marginBottom = "12px";
      el.detail.appendChild(n);
    }

    const v = h("div", "verify");
    v.appendChild(h("h3", null, "Cek postingan Instagram peserta"));
    const checks = [
      `Video sudah tayang di Story atau Reels`,
      `Ada tag ${CFG.igHandle}`,
      `Ada hashtag ${CFG.hashtag}`
    ].map(text => {
      const lab = h("label", "check");
      const inp = document.createElement("input"); inp.type = "checkbox";
      lab.appendChild(inp); lab.appendChild(h("span", null, text));
      v.appendChild(lab);
      return inp;
    });
    const ig = document.createElement("input");
    ig.className = "field-input"; ig.placeholder = "Username IG peserta (opsional)"; ig.autocapitalize = "off";
    const igLab = h("label", "field"); igLab.appendChild(h("span", "sr-only", "Username Instagram")); igLab.appendChild(ig);
    v.appendChild(igLab);
    const btn = h("button", "btn btn-primary btn-block", "Verify & Redeem Coffee"); btn.type = "button"; btn.disabled = true;
    const sync = () => { btn.disabled = !checks.every(c => c.checked); };
    checks.forEach(c => c.addEventListener("change", sync));
    btn.addEventListener("click", () => askConfirm(p, ig.value));
    v.appendChild(btn);
    el.detail.appendChild(v);
  }

  // ---------- konfirmasi & redeem ----------
  let pending = null;
  function askConfirm(p, igHandle) {
    pending = { id: p.id, igHandle };
    el.cBody.textContent = `${p.name} (${p.id}) akan ditandai sudah klaim kopi. Tindakan ini tidak bisa dibatalkan.`;
    el.confirm.hidden = false;
    $("#cYes").focus();
  }
  $("#cNo").addEventListener("click", () => { el.confirm.hidden = true; pending = null; });
  el.confirm.addEventListener("click", e => { if (e.target === el.confirm) { el.confirm.hidden = true; pending = null; } });
  $("#cYes").addEventListener("click", () => {
    if (!pending) return;
    const res = Store.verifyAndRedeem(pending.id, { crew: el.crew.value, igHandle: pending.igHandle });
    el.confirm.hidden = true;
    if (res.ok) { justRedeemed = pending.id; toast("Kopi diredeem."); }
    else if (res.reason === "already_redeemed") toast("Peserta ini sudah redeem sebelumnya.");
    else toast("Peserta tidak ditemukan.");
    pending = null;
    renderAll();
  });

  // ---------- ringkasan & log ----------
  function renderSummary() {
    const s = Store.stats();
    el.rc.textContent = s.redeemed; el.reg.textContent = s.total;
    el.bar.style.width = s.total ? (s.redeemed / s.total * 100).toFixed(1) + "%" : "0";
  }
  function renderLog() {
    const list = Store.list().filter(p => p.redeemedAt).sort((a, b) => b.redeemedAt - a.redeemedAt).slice(0, 6);
    el.log.innerHTML = "";
    if (!list.length) { el.log.appendChild(h("li", "muted", "Belum ada redeem.")); return; }
    list.forEach(p => {
      const li = h("li");
      li.appendChild(h("time", null, time(p.redeemedAt)));
      li.appendChild(h("span", null, `${p.name} (${p.id})`));
      li.appendChild(h("span", null, p.redeemedBy));
      el.log.appendChild(li);
    });
  }
  function renderAll() { renderSummary(); renderLog(); renderResults(); renderDetail(); }

  let tT = 0;
  function toast(m) { el.toast.textContent = m; el.toast.classList.add("show"); clearTimeout(tT); tT = setTimeout(() => el.toast.classList.remove("show"), 2600); }

  Store.seedOnce();
  Store.onChange(() => { renderSummary(); renderLog(); if (!el.confirm.hidden) return; renderResults(); if (!justRedeemed) renderDetail(); });
  renderAll();
  const qp = new URLSearchParams(location.search).get("id");
  if (qp) { el.q.value = qp; renderResults(true); }
})();
