/* Trading Cockpit — info-only PWA (Desk / Chart / Kalender / News) */
(function () {
  "use strict";

  const TZ = "Europe/Zurich";
  const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
  const CACHE_KEY = "trading-cockpit-ff-cache-v1";
  const TV_EVENTS_URL = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
  const CURRENCIES = new Set(["EUR", "USD"]);

  // FF is deliberately optional: it only supplies the small Desk preview.
  let calendar = { events: [], fetchedAt: null, fromCache: false, error: null };
  let calendarWidgetMounted = false;
  let calendarWidgetScript = null;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* —— Navigation —— */
  function showView(name) {
    document.querySelectorAll(".view").forEach((v) => {
      const on = v.dataset.view === name;
      v.classList.toggle("active", on);
      v.hidden = !on;
    });
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.goto === name);
    });
    window.scrollTo(0, 0);
    if (name === "chart") mountChart();
    if (name === "kalender") mountEconomicCalendar();
  }

  document.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", () => showView(el.dataset.goto));
  });

  /* —— Time helpers (Europe/Zurich) —— */
  function formatZurichDate(d) {
    return new Intl.DateTimeFormat("de-CH", {
      timeZone: TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  }

  function formatZurichTime(d) {
    return new Intl.DateTimeFormat("de-CH", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
  }

  function formatEventWhen(d) {
    return new Intl.DateTimeFormat("de-CH", {
      timeZone: TZ,
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  function zurichMinutes(d) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const h = Number(parts.find((p) => p.type === "hour").value);
    const m = Number(parts.find((p) => p.type === "minute").value);
    return h * 60 + m;
  }

  /* —— Desk: clock + sessions —— */
  const deskDate = document.getElementById("desk-date");
  const deskClock = document.getElementById("desk-clock");

  function updateDeskClock() {
    const now = new Date();
    deskDate.textContent = formatZurichDate(now);
    deskClock.textContent = formatZurichTime(now) + " · Europe/Zurich";

    const mins = zurichMinutes(now);
    const inLondon = mins >= 9 * 60 && mins < 17 * 60 + 30;
    const inNy = mins >= 14 * 60 + 30 && mins < 21 * 60;
    const inOverlap = mins >= 14 * 60 + 30 && mins < 17 * 60 + 30;

    document.querySelectorAll(".chip").forEach((chip) => {
      const s = chip.dataset.session;
      let on = false;
      if (s === "london") on = inLondon;
      if (s === "ny") on = inNy;
      if (s === "overlap") on = inOverlap;
      chip.classList.toggle("active", on);
    });
  }

  /* —— Optional Desk preview (Forex Factory weekly JSON + cache) —— */
  function normalizeImpact(raw) {
    const s = String(raw || "").trim().toLowerCase();
    if (s === "high" || s === "red") return "High";
    return raw;
  }

  function isHighImpact(raw) {
    const s = String(raw || "").trim().toLowerCase();
    return s === "high" || s === "red";
  }

  function parseFeed(rawList) {
    if (!Array.isArray(rawList)) return [];
    const out = [];
    for (const row of rawList) {
      const country = String(row.country || row.currency || "").toUpperCase();
      if (!CURRENCIES.has(country) || !isHighImpact(row.impact)) continue;
      const at = new Date(row.date);
      if (Number.isNaN(at.getTime())) continue;
      out.push({
        id: `${at.toISOString()}-${country}-${row.title}`,
        title: String(row.title || "Event").trim(),
        currency: country,
        impact: normalizeImpact(row.impact),
        at,
      });
    }
    out.sort((a, b) => a.at - b.at);
    return out;
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.rows)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function saveCache(rows) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ fetchedAt: new Date().toISOString(), rows })
      );
    } catch {
      /* quota / private mode */
    }
  }

  function applyEvents(events, meta) {
    calendar = {
      events,
      fetchedAt: meta.fetchedAt || null,
      fromCache: !!meta.fromCache,
      error: meta.error || null,
    };
    renderDeskEvents();
  }

  function setDeskSource(text) {
    const el = document.getElementById("desk-events-source");
    if (el) el.textContent = text;
  }

  async function fetchCalendar() {
    if (!navigator.onLine) {
      const cached = loadCache();
      if (cached) {
        applyEvents(parseFeed(cached.rows), { fetchedAt: cached.fetchedAt, fromCache: true });
        setDeskSource("Optionaler Feed · Offline: lokale Cache-Daten.");
      }
      return;
    }

    try {
      const res = await fetch(FF_URL, {
        cache: "no-cache",
        mode: "cors",
        credentials: "omit",
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rows = await res.json();
      const events = parseFeed(rows);
      saveCache(rows);
      applyEvents(events, { fetchedAt: new Date().toISOString(), fromCache: false });
      setDeskSource("Optionaler FF-Feed · aktualisiert " + formatEventWhen(new Date()) + " (Europe/Zurich). Für Details: Kalender.");
    } catch {
      const cached = loadCache();
      if (cached && Array.isArray(cached.rows)) {
        const events = parseFeed(cached.rows);
        applyEvents(events, { fetchedAt: cached.fetchedAt, fromCache: true, error: "feed" });
        const t = cached.fetchedAt ? formatEventWhen(new Date(cached.fetchedAt)) : "—";
        setDeskSource("Optionaler Feed · Cache-Fallback, Stand " + t + " (Europe/Zurich).");
      } else {
        applyEvents([], { error: "feed" });
        setDeskSource("Optionaler Feed derzeit nicht verfügbar · Kalender läuft unabhängig über TradingView.");
      }
    }
  }

  function markKind(e, now) {
    const diff = e.at.getTime() - now.getTime();
    if (diff >= -15 * 60000 && diff <= 0) return "now";
    if (diff > 0) return "upcoming";
    return "past";
  }

  function eventLi(e, kind) {
    const badge =
      kind === "now"
        ? '<span class="mark now">Jetzt</span>'
        : kind === "next"
          ? '<span class="mark next">Als Nächstes</span>'
          : "";
    const cls = kind === "now" || kind === "next" ? ' class="highlight"' : "";
    return (
      `<li${cls}>` +
      `<span class="impact">High</span>` +
      `<span class="ccy">${escapeHtml(e.currency)}</span>` +
      badge +
      escapeHtml(e.title) +
      `<span class="event-meta">${escapeHtml(formatEventWhen(e.at))} · Europe/Zurich</span>` +
      `</li>`
    );
  }

  function renderDeskEvents() {
    const list = document.getElementById("desk-events");
    if (!list) return;
    const now = new Date();
    const upcoming = (calendar.events || [])
      .filter((e) => e.at.getTime() >= now.getTime() - 15 * 60000)
      .slice(0, 3);

    if (!upcoming.length) {
      list.innerHTML = "<li>Keine anstehenden High-Impact EUR/USD Events aus dem optionalen Feed.</li>";
      return;
    }

    list.innerHTML = upcoming
      .map((e, i) => {
        const base = markKind(e, now);
        const kind = i === 0 && base === "upcoming" ? "next" : base;
        return eventLi(e, kind);
      })
      .join("");
  }

  /* —— News (light placeholder) —— */
  const newsPlaceholders = [
    { tag: "Zentralbank", title: "EZB / Fed im Blick", body: "Platzhalter — Live-Feed folgt." },
    { tag: "Inflation", title: "US-Inflationsdaten", body: "Platzhalter — nur EUR/USD-relevant." },
    { tag: "Daten", title: "Arbeitsmarkt USA", body: "Platzhalter — NFP-Woche im Kalender." },
    { tag: "Hinweis", title: "Info only", body: "Keine Signale, keine Orders, keine Empfehlungen." },
  ];

  function renderNews() {
    const el = document.getElementById("news-cards");
    if (!el) return;
    el.innerHTML = newsPlaceholders
      .map(
        (n) =>
          `<div class="card"><span class="news-tag">${n.tag}</span>` +
          `<p class="news-title">${n.title}</p>` +
          `<p class="hint" style="margin-top:4px">${n.body}</p></div>`
      )
      .join("");
  }

  /* —— Chart (TradingView embed, display only) —— */
  let chartInterval = "10";
  let chartLoadTimer = null;

  function buildTvSrc(interval) {
    const params = new URLSearchParams({
      frameElementId: "tv-chart",
      symbol: "FX:EURUSD",
      interval: String(interval),
      hidesidetoolbar: "1",
      hidetoptoolbar: "0",
      symboledit: "0",
      saveimage: "0",
      toolbarbg: "1c1916",
      studies: "[]",
      hideideas: "1",
      theme: "dark",
      style: "1",
      timezone: "Europe/Zurich",
      withdateranges: "1",
      locale: "de",
      enablepolling: "true",
    });
    return "https://s.tradingview.com/widgetembed/?" + params.toString();
  }

  function setChartOffline(offline) {
    const wrap = document.getElementById("chart-wrap");
    const fallback = document.getElementById("chart-fallback");
    const iframe = document.getElementById("tv-chart");
    if (!wrap || !fallback || !iframe) return;
    wrap.classList.toggle("is-offline", offline);
    fallback.hidden = !offline;
    if (offline) iframe.removeAttribute("src");
  }

  function mountChart() {
    const iframe = document.getElementById("tv-chart");
    if (!iframe) return;
    document.querySelectorAll(".tf-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tf === chartInterval);
    });
    if (!navigator.onLine) {
      setChartOffline(true);
      return;
    }
    setChartOffline(false);
    const next = buildTvSrc(chartInterval);
    if (iframe.getAttribute("src") !== next) iframe.setAttribute("src", next);
    if (chartLoadTimer) clearTimeout(chartLoadTimer);
    chartLoadTimer = setTimeout(() => {
      if (!navigator.onLine) setChartOffline(true);
    }, 12000);
  }

  document.querySelectorAll(".tf-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      chartInterval = btn.dataset.tf || "10";
      mountChart();
    });
  });

  /* —— Kalender (TradingView Economic Calendar embed) —— */
  function setCalendarOffline(offline) {
    const wrap = document.getElementById("calendar-widget-wrap");
    const fallback = document.getElementById("calendar-fallback");
    const host = document.getElementById("tv-economic-calendar");
    if (!wrap || !fallback || !host) return;
    wrap.classList.toggle("is-offline", offline);
    fallback.hidden = !offline;
    host.hidden = offline;
  }

  function mountEconomicCalendar() {
    const host = document.getElementById("tv-economic-calendar");
    if (!host) return;
    if (!navigator.onLine) {
      setCalendarOffline(true);
      return;
    }
    setCalendarOffline(false);
    if (calendarWidgetMounted) return;

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = TV_EVENTS_URL;
    script.async = true;
    script.textContent = JSON.stringify({
      colorTheme: "dark",
      isTransparent: false,
      width: "100%",
      height: "100%",
      locale: "de",
      currencyFilter: "EUR,USD",
      // TradingView uses 1 for high importance; keeping this strict avoids noise.
      importanceFilter: "1",
    });
    script.addEventListener("error", () => {
      calendarWidgetMounted = false;
      calendarWidgetScript = null;
      setCalendarOffline(true);
    });
    calendarWidgetMounted = true;
    calendarWidgetScript = script;
    host.appendChild(script);
  }

  window.addEventListener("online", () => {
    const chartView = document.getElementById("view-chart");
    if (chartView && !chartView.hidden) mountChart();
    const calendarView = document.getElementById("view-kalender");
    if (calendarView && !calendarView.hidden) mountEconomicCalendar();
    fetchCalendar();
  });

  window.addEventListener("offline", () => {
    const chartView = document.getElementById("view-chart");
    if (chartView && !chartView.hidden) setChartOffline(true);
    const calendarView = document.getElementById("view-kalender");
    if (calendarView && !calendarView.hidden) setCalendarOffline(true);
  });

  /* —— Init —— */
  updateDeskClock();
  setInterval(updateDeskClock, 1000);
  renderNews();
  renderDeskEvents();
  fetchCalendar();

  setInterval(() => renderDeskEvents(), 60000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
