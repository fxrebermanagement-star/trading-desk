/* Trading Cockpit — local-first PWA */
(function () {
  "use strict";

  const STORAGE_KEY = "trading-desk-v1";
  const TZ = "Europe/Zurich";

  const defaultState = () => ({ journal: [], customEvents: [], newsNotes: "", wochenplan: "", noTradeDays: [] });

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return { ...defaultState(), ...JSON.parse(raw) };
    } catch { return defaultState(); }
  }

  function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  let state = loadState();

  function startOfWeek(d) {
    const x = new Date(d); const day = (x.getDay() + 6) % 7;
    x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - day); return x;
  }
  function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function buildSampleEvents() {
    const mon = startOfWeek(new Date());
    const day = (offset, time, title, currency) => { const d = new Date(mon); d.setDate(mon.getDate() + offset); return { id: `sample-${offset}-${time}`, date: ymd(d), time, title, currency, impact: "High", sample: true }; };
    return [
      day(1, "10:00", "EZB Rede / Notenbanker", "EUR"),
      day(2, "14:30", "US CPI (Verbraucherpreise)", "USD"),
      day(3, "14:15", "EZB Zinentscheid (Beispiel)", "EUR"),
      day(3, "20:00", "FOMC Statement (Beispiel)", "USD"),
      day(4, "14:30", "US Erstanträge Arbeitslosenhilfe", "USD"),
      day(4, "16:00", "US ISM / PMI (Beispiel)", "USD"),
    ];
  }
  const sampleEvents = buildSampleEvents();

  function showView(name) {
    document.querySelectorAll(".view").forEach((v) => { const on = v.dataset.view === name; v.classList.toggle("active", on); v.hidden = !on; });
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.goto === name));
    window.scrollTo(0, 0); if (name === "chart") mountChart();
  }
  document.querySelectorAll("[data-goto]").forEach((el) => el.addEventListener("click", () => showView(el.dataset.goto)));

  const deskDate = document.getElementById("desk-date");
  const deskClock = document.getElementById("desk-clock");
  function formatZurichDate(d) { return new Intl.DateTimeFormat("de-CH", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d); }
  function formatZurichTime(d) { return new Intl.DateTimeFormat("de-CH", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d); }
  function zurichMinutes(d) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
    const h = Number(parts.find((p) => p.type === "hour").value); const m = Number(parts.find((p) => p.type === "minute").value); return h * 60 + m;
  }
  function updateDeskClock() {
    const now = new Date(); deskDate.textContent = formatZurichDate(now); deskClock.textContent = formatZurichTime(now) + " · Europe/Zurich";
    const mins = zurichMinutes(now); const inLondon = mins >= 540 && mins < 1050; const inNy = mins >= 870 && mins < 1260; const inOverlap = mins >= 870 && mins < 1050;
    document.querySelectorAll(".chip").forEach((chip) => { const s = chip.dataset.session; chip.classList.toggle("active", (s === "london" && inLondon) || (s === "ny" && inNy) || (s === "overlap" && inOverlap)); });
  }
  function renderDeskEvents() {
    const list = document.getElementById("desk-events"); const today = ymd(new Date());
    const upcoming = [...sampleEvents, ...state.customEvents].filter((e) => e.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 3);
    list.innerHTML = upcoming.length ? upcoming.map((e) => `<li><span class="impact">${e.impact || "Manuell"}</span>${escapeHtml(e.title)}<span class="event-meta">${e.date} · ${e.time} · ${escapeHtml(e.currency || "")}${e.sample ? " · Beispiel" : ""}</span></li>`).join("") : "<li>Keine anstehenden Events in der Beispiel-Woche.</li>";
  }

  function renderKalender() {
    document.getElementById("kalender-list").innerHTML = sampleEvents.map((e) => `<li><span class="impact">High</span>${escapeHtml(e.title)}<span class="event-meta">${e.date} · ${e.time} MEZ · ${e.currency} · Beispiel</span></li>`).join("");
    const custom = document.getElementById("custom-events");
    if (!state.customEvents.length) { custom.innerHTML = ""; return; }
    custom.innerHTML = "<li style=\"border:none;padding-top:0\"><strong style=\"color:var(--accent);font-size:0.75rem\">Eigene Events</strong></li>" + state.customEvents.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((e) => `<li>${escapeHtml(e.title)}<span class="event-meta">${e.date} · ${e.time} · ${escapeHtml(e.currency)} <button type="button" class="btn danger-ghost" data-del-event="${e.id}">Löschen</button></span></li>`).join("");
    custom.querySelectorAll("[data-del-event]").forEach((btn) => btn.addEventListener("click", () => { state.customEvents = state.customEvents.filter((x) => x.id !== btn.dataset.delEvent); saveState(state); renderKalender(); renderDeskEvents(); }));
  }
  document.getElementById("form-event").addEventListener("submit", (ev) => {
    ev.preventDefault(); const fd = new FormData(ev.target);
    state.customEvents.push({ id: "ev-" + Date.now(), date: fd.get("date"), time: fd.get("time"), title: String(fd.get("title")).trim(), currency: fd.get("currency"), impact: "Manuell", sample: false });
    saveState(state); ev.target.reset(); ev.target.time.value = "14:30"; renderKalender(); renderDeskEvents();
  });

  const newsPlaceholders = [
    { tag: "Zentralbank", title: "EZB-Aussagen im Blick", body: "Platzhalter — Live-Feed folgt." },
    { tag: "Inflation", title: "US-Inflationsdaten", body: "Platzhalter — nur EUR/USD-relevant filtern." },
    { tag: "Daten", title: "Arbeitsmarkt USA", body: "Platzhalter — NFP-Woche markieren." },
    { tag: "Geopolitik", title: "Risiko-Events", body: "Platzhalter — kein Signal-Kanal." },
  ];
  function renderNews() {
    document.getElementById("news-cards").innerHTML = newsPlaceholders.map((n) => `<div class="card"><span class="news-tag">${n.tag}</span><p style="margin:4px 0 0;font-weight:600">${n.title}</p><p class="hint" style="margin-top:4px">${n.body}</p></div>`).join("");
    document.getElementById("news-notes").value = state.newsNotes || "";
  }
  document.getElementById("btn-save-news").addEventListener("click", () => { state.newsNotes = document.getElementById("news-notes").value; saveState(state); const h = document.getElementById("news-saved"); h.hidden = false; setTimeout(() => (h.hidden = true), 1500); });

  function renderJournal() {
    const list = document.getElementById("journal-list"); const empty = document.getElementById("journal-empty"); const entries = (state.journal || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    if (!entries.length) { list.innerHTML = ""; empty.hidden = false; return; }
    empty.hidden = true;
    list.innerHTML = entries.map((e) => {
      const bits = [e.session, e.setup, e.richtung !== "—" ? e.richtung : null, e.groesse ? "Größe " + e.groesse : null, e.risiko ? "Risiko " + e.risiko + "%" : null, e.ergebnis ? "R " + e.ergebnis : null].filter(Boolean).join(" · ");
      return `<li><div class="journal-item-head"><div><div class="journal-item-title">${escapeHtml(e.date)} · ${escapeHtml(e.session || "")}</div><div class="journal-item-body">${escapeHtml(bits)}</div>${e.notiz ? `<div class="journal-item-body">${escapeHtml(e.notiz)}</div>` : ""}</div><button type="button" class="btn danger-ghost" data-del-journal="${e.id}">Löschen</button></div></li>`;
    }).join("");
    list.querySelectorAll("[data-del-journal]").forEach((btn) => btn.addEventListener("click", () => { state.journal = state.journal.filter((x) => x.id !== btn.dataset.delJournal); saveState(state); renderJournal(); }));
  }
  const formJournal = document.getElementById("form-journal"); formJournal.date.value = ymd(new Date());
  formJournal.addEventListener("submit", (ev) => {
    ev.preventDefault(); const fd = new FormData(ev.target);
    state.journal.push({ id: "j-" + Date.now(), date: fd.get("date"), session: fd.get("session"), setup: String(fd.get("setup") || "").trim(), richtung: fd.get("richtung"), groesse: String(fd.get("groesse") || "").trim(), risiko: String(fd.get("risiko") || "").trim(), ergebnis: String(fd.get("ergebnis") || "").trim(), notiz: String(fd.get("notiz") || "").trim() });
    saveState(state); const keepDate = fd.get("date"); ev.target.reset(); ev.target.date.value = keepDate || ymd(new Date()); renderJournal();
  });

  function renderWoche() {
    document.getElementById("wochenplan").value = state.wochenplan || "";
    document.querySelectorAll("#notrade-days input").forEach((cb) => { cb.checked = (state.noTradeDays || []).includes(cb.value); });
  }
  document.getElementById("btn-save-woche").addEventListener("click", () => { state.wochenplan = document.getElementById("wochenplan").value; state.noTradeDays = [...document.querySelectorAll("#notrade-days input:checked")].map((cb) => cb.value); saveState(state); const h = document.getElementById("woche-saved"); h.hidden = false; setTimeout(() => (h.hidden = true), 1500); });
  document.getElementById("notrade-days").addEventListener("change", () => { state.noTradeDays = [...document.querySelectorAll("#notrade-days input:checked")].map((cb) => cb.value); saveState(state); });
  function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  let chartInterval = "10"; let chartLoadTimer = null;
  function buildTvSrc(interval) {
    const params = new URLSearchParams({ frameElementId: "tv-chart", symbol: "FX:EURUSD", interval: String(interval), hidesidetoolbar: "1", hidetoptoolbar: "0", symboledit: "0", saveimage: "0", toolbarbg: "1c1916", studies: "[]", hideideas: "1", theme: "dark", style: "1", timezone: "Europe/Zurich", withdateranges: "1", locale: "de", enablepolling: "true" });
    return "https://s.tradingview.com/widgetembed/?" + params.toString();
  }
  function setChartOffline(offline) {
    const wrap = document.getElementById("chart-wrap"); const fallback = document.getElementById("chart-fallback"); const iframe = document.getElementById("tv-chart");
    if (!wrap || !fallback || !iframe) return; wrap.classList.toggle("is-offline", offline); fallback.hidden = !offline; if (offline) iframe.removeAttribute("src");
  }
  function mountChart() {
    const iframe = document.getElementById("tv-chart"); if (!iframe) return;
    document.querySelectorAll(".tf-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.tf === chartInterval));
    if (!navigator.onLine) { setChartOffline(true); return; }
    setChartOffline(false); const next = buildTvSrc(chartInterval); if (iframe.getAttribute("src") !== next) iframe.setAttribute("src", next);
    if (chartLoadTimer) clearTimeout(chartLoadTimer); chartLoadTimer = setTimeout(() => { if (!navigator.onLine) setChartOffline(true); }, 12000);
  }
  document.querySelectorAll(".tf-btn").forEach((btn) => btn.addEventListener("click", () => { chartInterval = btn.dataset.tf || "10"; document.querySelectorAll(".tf-btn").forEach((b) => b.classList.toggle("active", b === btn)); mountChart(); }));
  window.addEventListener("online", () => { const chartView = document.getElementById("view-chart"); if (chartView && !chartView.hidden) mountChart(); });
  window.addEventListener("offline", () => { const chartView = document.getElementById("view-chart"); if (chartView && !chartView.hidden) setChartOffline(true); });

  updateDeskClock(); setInterval(updateDeskClock, 1000); renderDeskEvents(); renderKalender(); renderNews(); renderJournal(); renderWoche();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
})();
