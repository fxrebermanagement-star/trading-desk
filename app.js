/* Trading Cockpit — info-only PWA.
 * Symbol swaps after a local TradingView embed check (no invented prices):
 *   FOREXCOM:DEU40 -> FOREXCOM:GER40 (DEU40 embed: invalid symbol; GER40 loads Germany 40 CFD)
 *   TVC:NATURALGAS -> FOREXCOM:NATURALGAS (TVC symbol does not exist; FOREX.com gas CFD loads)
 * FOREXCOM:SPXUSD, FOREXCOM:NSXUSD and TVC:USOIL rendered and stayed.
 * No orders, no entries, no stops, no long/short calls.
 */
(function () {
  "use strict";

  const TZ = "Europe/Zurich";
  const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
  const CACHE_KEY = "trading-cockpit-ff-cache-v1";
  const MARKET_KEY = "cockpit-market-v8";
  const TV_EVENTS_URL = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
  const TV_QUOTE_URL = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js";
  const TV_TAPE_URL = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
  const TV_NEWS_URL = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
  const SCAN_URL = "https://scanner.tradingview.com/global/scan";
  const CURRENCIES = new Set(["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "NZD"]);

  const MARKETS = [
    { id: "eurusd", group: "Devisen", name: "EUR/USD", key: "EUR", kind: "Devisenpaar", symbol: "FX:EURUSD", exchange: "FX", tvName: "EURUSD", newsMarket: "forex" },
    { id: "us500", group: "Indizes", name: "US 500", key: "US500", kind: "Index", symbol: "FOREXCOM:SPXUSD", exchange: "FOREXCOM", tvName: "SPXUSD", newsMarket: "index" },
    { id: "us100", group: "Indizes", name: "US 100", key: "US100", kind: "Index", symbol: "FOREXCOM:NSXUSD", exchange: "FOREXCOM", tvName: "NSXUSD", newsMarket: "index" },
    { id: "dax", group: "Indizes", name: "DAX", key: "DAX", kind: "Index", symbol: "FOREXCOM:GER40", exchange: "FOREXCOM", tvName: "GER40", newsMarket: "index" },
    { id: "oil", group: "Rohstoffe", name: "WTI Öl", key: "Öl", kind: "Öl", symbol: "TVC:USOIL", exchange: "TVC", tvName: "USOIL", newsMarket: "futures" },
    { id: "gas", group: "Rohstoffe", name: "Gas", key: "Gas", kind: "Gas", symbol: "FOREXCOM:NATURALGAS", exchange: "FOREXCOM", tvName: "NATURALGAS", newsMarket: "futures" },
    { id: "gold", group: "Rohstoffe", name: "Gold", key: "Gold", kind: "Gold", symbol: "TVC:GOLD", exchange: "TVC", tvName: "GOLD", newsMarket: "futures" },
    { id: "silver", group: "Rohstoffe", name: "Silber", key: "Silber", kind: "Silber", symbol: "TVC:SILVER", exchange: "TVC", tvName: "SILVER", newsMarket: "futures" },
    { id: "btc", group: "Krypto", name: "Bitcoin", key: "BTC", kind: "Krypto", symbol: "BITSTAMP:BTCUSD", exchange: "BITSTAMP", tvName: "BTCUSD", newsMarket: "crypto" },
    { id: "eth", group: "Krypto", name: "Ether", key: "ETH", kind: "Krypto", symbol: "BITSTAMP:ETHUSD", exchange: "BITSTAMP", tvName: "ETHUSD", newsMarket: "crypto" },
    { id: "sol", group: "Krypto", name: "Solana", key: "SOL", kind: "Krypto", symbol: "COINBASE:SOLUSD", exchange: "COINBASE", tvName: "SOLUSD", newsMarket: "crypto" },
    { id: "xrp", group: "Krypto", name: "XRP", key: "XRP", kind: "Krypto", symbol: "BITSTAMP:XRPUSD", exchange: "BITSTAMP", tvName: "XRPUSD", newsMarket: "crypto" },
  ];

  let selectedId = "eurusd";
  let calendar = { events: [], fetchedAt: null, fromCache: false, error: null };
  let quoteFor = null;
  let quoteWidgetMounted = false;
  let tapeMounted = false;
  let newsWidgetMounted = false;
  let newsFor = null;
  let newsFeed = "symbol";
  let calendarWidgetMounted = false;
  let calImportance = "high";
  let chartInterval = "10";
  let chartFor = null;
  let chartLoadTimer = null;
  const moves = Object.create(null);
  const VIEWS = ["desk", "chart", "kalender", "news"];

  function marketById(id) {
    return MARKETS.find((m) => m.id === id) || MARKETS[0];
  }

  function selected() {
    return marketById(selectedId);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function symbolHref(m) {
    return "https://www.tradingview.com/symbols/" + encodeURIComponent(m.tvName) + "/?exchange=" + encodeURIComponent(m.exchange);
  }

  function loadStoredMarket() {
    try {
      const id = localStorage.getItem(MARKET_KEY);
      if (id && MARKETS.some((m) => m.id === id)) selectedId = id;
    } catch (e) { /* ignore */ }
  }

  function storeMarket() {
    try { localStorage.setItem(MARKET_KEY, selectedId); } catch (e) { /* ignore */ }
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
    if (location.hash !== "#" + name) {
      try { history.replaceState(null, "", "#" + name); } catch (e) { /* ignore */ }
    }
    if (name === "desk") {
      mountTape();
      mountQuote();
    }
    if (name === "chart") mountChart();
    if (name === "kalender") mountEconomicCalendar();
    if (name === "news") mountNews();
  }

  document.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", () => showView(el.dataset.goto));
  });

  function viewFromHash() {
    const h = (location.hash || "").replace("#", "").toLowerCase();
    return VIEWS.indexOf(h) >= 0 ? h : null;
  }

  window.addEventListener("hashchange", () => {
    const v = viewFromHash();
    if (v) showView(v);
  });

  /* —— Time (Europe/Zurich) —— */
  function formatZurichDate(d) {
    return new Intl.DateTimeFormat("de-CH", {
      timeZone: TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  }

  function zurichParts(d) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    const pick = (type) => {
      const v = parts.find((p) => p.type === type);
      return v ? v.value : "00";
    };
    let h = pick("hour");
    if (h === "24") h = "00";
    return { h, m: pick("minute"), s: pick("second") };
  }

  function zurichMinutes(d) {
    const p = zurichParts(d);
    return Number(p.h) * 60 + Number(p.m);
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

  function zurichWeekday(d) {
    return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(d);
  }

  function sessionState(now) {
    const day = zurichWeekday(now);
    // London / NY / Overlap are weekday cash sessions. Sat and Sun stay dark.
    if (day === "Sat" || day === "Sun") return { london: false, ny: false, overlap: false };
    const mins = zurichMinutes(now);
    const london = mins >= 9 * 60 && mins < 17 * 60 + 30;
    const ny = mins >= 14 * 60 + 30 && mins < 21 * 60;
    const overlap = london && ny;
    return { london, ny, overlap };
  }

  function sessionPhrase(st) {
    if (st.overlap) return "Overlap läuft";
    if (st.london) return "London offen";
    if (st.ny) return "New York offen";
    return "Ruhig";
  }

  function radarSentence(st, now) {
    if (st.overlap) return "Overlap: London und New York sind offen. Europe/Zurich.";
    if (st.london) return "London ist offen. New York ist zu. Europe/Zurich.";
    if (st.ny) return "New York ist offen. London ist zu. Europe/Zurich.";
    const day = zurichWeekday(now);
    if (day === "Sat" || day === "Sun") return "Ruhig: Wochenende. London und New York sind zu. Europe/Zurich.";
    return "Ruhig: London und New York sind zu. Europe/Zurich.";
  }

  /* —— Clock, lamps, Feld —— */
  const deskDate = document.getElementById("desk-date");
  const clockHm = document.getElementById("clock-hm");
  const clockColon = document.getElementById("clock-colon");
  const clockSec = document.getElementById("clock-sec");

  function tickClockFace(p) {
    if (clockHm) clockHm.textContent = p.h + ":" + p.m;
    if (clockSec) {
      clockSec.textContent = p.s;
      clockSec.classList.remove("tick");
      void clockSec.offsetWidth;
      clockSec.classList.add("tick");
    }
    if (clockColon) {
      clockColon.classList.remove("dim");
      void clockColon.offsetWidth;
      clockColon.classList.add("dim");
    }
  }

  function updateLamps(st, now) {
    document.querySelectorAll(".lamp-unit").forEach((unit) => {
      const s = unit.dataset.session;
      const on = (s === "london" && st.london) || (s === "ny" && st.ny) || (s === "overlap" && st.overlap);
      unit.classList.toggle("on", on);
    });
    const radar = document.getElementById("radar-session");
    if (radar) radar.textContent = radarSentence(st, now);
  }

  function nextHighEvent(now) {
    const list = calendar.events || [];
    const cutoff = now.getTime() - 15 * 60000;
    for (let i = 0; i < list.length; i++) {
      if (list[i].at.getTime() >= cutoff) return list[i];
    }
    return null;
  }

  function countdownPhrase(ms) {
    if (ms <= 0) return "jetzt";
    const min = Math.floor(ms / 60000);
    if (min < 1) return "gleich";
    if (min < 60) return "in " + min + " Min";
    const h = Math.floor(min / 60);
    const rem = min % 60;
    if (h < 48) {
      if (rem === 0) return "in " + h + " Std";
      return "in " + h + " Std " + rem + " Min";
    }
    const days = Math.floor(min / 1440);
    if (days <= 1) return "in 1 Tag";
    return "in " + days + " Tagen";
  }

  function clipTitle(title) {
    const s = String(title || "").trim();
    if (s.length <= 36) return s;
    return s.slice(0, 35) + "…";
  }

  function movePhrase(m) {
    const ch = moves[m.symbol];
    if (typeof ch !== "number" || !Number.isFinite(ch)) return "";
    if (ch > 0) return m.name + " heute grün";
    if (ch < 0) return m.name + " heute rot";
    return m.name + " heute unverändert";
  }

  function renderFeld(now) {
    const line = document.getElementById("feld-line");
    if (!line) return;
    const st = sessionState(now);
    const bits = [sessionPhrase(st)];
    const ev = nextHighEvent(now);
    if (ev) {
      const left = ev.at.getTime() - now.getTime();
      bits.push(clipTitle(ev.title) + " " + countdownPhrase(left));
    }
    const move = movePhrase(selected());
    if (move) bits.push(move);
    line.textContent = bits.join(" · ");
  }

  function updateDeskClock() {
    const now = new Date();
    if (deskDate) deskDate.textContent = formatZurichDate(now);
    tickClockFace(zurichParts(now));
    const st = sessionState(now);
    updateLamps(st, now);
    renderFeld(now);
  }

  /* —— Ring of market keys —— */
  function edgeClass(symbol) {
    const ch = moves[symbol];
    if (typeof ch !== "number" || !Number.isFinite(ch) || ch === 0) return "";
    return ch > 0 ? "edge-up" : "edge-down";
  }

  function layoutOrbit() {
    const orbit = document.getElementById("orbit");
    if (!orbit) return;
    const buttons = Array.from(orbit.querySelectorAll(".mkey"));
    const others = buttons.filter((b) => b.dataset.id !== selectedId);
    const n = others.length || 1;
    others.forEach((btn, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = 50 + Math.cos(ang) * 40;
      const y = 50 + Math.sin(ang) * 40;
      btn.style.left = x + "%";
      btn.style.top = y + "%";
      btn.classList.remove("is-center");
      btn.setAttribute("aria-pressed", "false");
      const market = marketById(btn.dataset.id);
      const name = btn.querySelector(".mkey-name");
      if (name) name.textContent = market.key;
      btn.classList.remove("edge-up", "edge-down");
      const edge = edgeClass(market.symbol);
      if (edge) btn.classList.add(edge);
    });
    const center = buttons.find((b) => b.dataset.id === selectedId);
    if (center) {
      center.style.left = "50%";
      center.style.top = "50%";
      center.classList.add("is-center");
      center.setAttribute("aria-pressed", "true");
      const market = selected();
      const name = center.querySelector(".mkey-name");
      const kind = center.querySelector(".mkey-kind");
      if (name) name.textContent = market.name;
      if (kind) kind.textContent = market.kind;
      center.classList.remove("edge-up", "edge-down");
      const edge = edgeClass(market.symbol);
      if (edge) center.classList.add(edge);
    }
  }

  function applyMarketChrome() {
    const m = selected();
    const quoteTitle = document.getElementById("quote-title");
    if (quoteTitle) quoteTitle.textContent = m.name;
    const chartTitle = document.getElementById("chart-title");
    if (chartTitle) chartTitle.textContent = m.name;
    const chartKind = document.getElementById("chart-kind");
    if (chartKind) chartKind.textContent = m.kind + " · nur Anzeige · TradingView · keine Signale, keine Orders";
    const iframe = document.getElementById("tv-chart");
    if (iframe) iframe.title = m.name + " Chart TradingView";
    const badge = document.getElementById("news-badge");
    if (badge) badge.textContent = m.tvName;
    const quoteCredit = document.getElementById("quote-credit");
    const quoteCreditName = document.getElementById("quote-credit-name");
    if (quoteCredit) quoteCredit.href = symbolHref(m);
    if (quoteCreditName) quoteCreditName.textContent = m.tvName;
    const newsCredit = document.getElementById("news-credit");
    const newsCreditName = document.getElementById("news-credit-name");
    if (newsCredit) newsCredit.href = symbolHref(m);
    if (newsCreditName) newsCreditName.textContent = m.name;
    layoutOrbit();
    renderFeld(new Date());
  }

  function selectMarket(id) {
    if (!MARKETS.some((m) => m.id === id)) return;
    if (id === selectedId) return;
    selectedId = id;
    newsFeed = "symbol";
    storeMarket();
    applyMarketChrome();
    const desk = document.getElementById("view-desk");
    if (desk && !desk.hidden) mountQuote(true);
    const chart = document.getElementById("view-chart");
    if (chart && !chart.hidden) mountChart();
    const news = document.getElementById("view-news");
    if (news && !news.hidden) mountNews(true);
    else newsWidgetMounted = false;
  }

  function buildOrbit() {
    const orbit = document.getElementById("orbit");
    if (!orbit) return;
    orbit.innerHTML = "";
    MARKETS.forEach((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mkey";
      btn.dataset.id = m.id;
      btn.setAttribute("aria-label", m.name + ", " + m.kind);
      btn.innerHTML = '<span class="pulse" aria-hidden="true"></span><span class="mkey-name"></span><span class="mkey-kind"></span>';
      btn.addEventListener("click", () => selectMarket(m.id));
      orbit.appendChild(btn);
    });
    applyMarketChrome();
  }

  /* —— Widgets —— */
  function resetWidgetHost(host) {
    host.querySelectorAll("script, iframe, style").forEach((n) => n.remove());
    let w = host.querySelector(".tradingview-widget-container__widget");
    if (!w) {
      w = document.createElement("div");
      w.className = "tradingview-widget-container__widget";
    }
    w.innerHTML = "";
    host.insertBefore(w, host.firstChild);
  }

  function setQuoteOffline(offline) {
    const wrap = document.getElementById("quote-widget-wrap");
    const fallback = document.getElementById("quote-fallback");
    const host = document.getElementById("tv-quote");
    if (!wrap || !fallback || !host) return;
    wrap.classList.toggle("is-offline", offline);
    fallback.hidden = !offline;
    host.hidden = offline;
  }

  function setQuoteStatus(online) {
    const el = document.getElementById("quote-updated");
    if (!el) return;
    const m = selected();
    el.textContent = online
      ? m.name + " · Live via TradingView · Tagesbereich in der Kennzahlenzeile"
      : "Kurs offline · Anzeige kehrt mit Verbindung zurück";
  }

  function mountTape() {
    const host = document.getElementById("tv-tape");
    if (!host || tapeMounted) return;
    if (!navigator.onLine) return;
    resetWidgetHost(host);
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = TV_TAPE_URL;
    script.async = true;
    script.textContent = JSON.stringify({
      symbols: MARKETS.map((m) => ({ proName: m.symbol, title: m.key })),
      showSymbolLogo: true,
      colorTheme: "dark",
      isTransparent: true,
      displayMode: "adaptive",
      locale: "de",
    });
    script.addEventListener("error", () => { tapeMounted = false; });
    tapeMounted = true;
    host.appendChild(script);
  }

  function mountQuote(force) {
    const host = document.getElementById("tv-quote");
    if (!host) return;
    const m = selected();
    if (!navigator.onLine) {
      setQuoteOffline(true);
      setQuoteStatus(false);
      return;
    }
    setQuoteOffline(false);
    setQuoteStatus(true);
    mountTape();
    if (quoteWidgetMounted && quoteFor === m.symbol && !force) return;
    resetWidgetHost(host);
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = TV_QUOTE_URL;
    script.async = true;
    script.textContent = JSON.stringify({
      symbol: m.symbol,
      width: "100%",
      locale: "de_DE",
      colorTheme: "dark",
      isTransparent: true,
    });
    script.addEventListener("error", () => {
      quoteWidgetMounted = false;
      quoteFor = null;
      setQuoteOffline(true);
      setQuoteStatus(false);
    });
    quoteWidgetMounted = true;
    quoteFor = m.symbol;
    host.appendChild(script);
  }

  /* —— Day move (only when TradingView returns a number for that exact symbol) —— */
  function paintMoves() {
    layoutOrbit();
    renderFeld(new Date());
  }

  async function fetchMoves() {
    if (!navigator.onLine) return;
    try {
      const res = await fetch(SCAN_URL, {
        method: "POST",
        cache: "no-store",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: { tickers: MARKETS.map((m) => m.symbol) },
          columns: ["change"],
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const rows = (data && data.data) || [];
      rows.forEach((row) => {
        const ch = row && row.d && row.d[0];
        if (row && row.s && typeof ch === "number" && Number.isFinite(ch)) moves[row.s] = ch;
      });
      paintMoves();
    } catch (e) { /* leave the fact out */ }
  }

  /* —— Optional high-impact preview —— */
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
        id: at.toISOString() + "-" + country + "-" + row.title,
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
    } catch (e) {
      return null;
    }
  }

  function saveCache(rows) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: new Date().toISOString(), rows }));
    } catch (e) { /* quota */ }
  }

  function applyEvents(events, meta) {
    calendar = {
      events,
      fetchedAt: meta.fetchedAt || null,
      fromCache: !!meta.fromCache,
      error: meta.error || null,
    };
    renderDeskEvents();
    renderFeld(new Date());
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
      const res = await fetch(FF_URL, { cache: "no-cache", mode: "cors", credentials: "omit" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rows = await res.json();
      const events = parseFeed(rows);
      saveCache(rows);
      applyEvents(events, { fetchedAt: new Date().toISOString(), fromCache: false });
      setDeskSource("Optionaler FF-Feed · aktualisiert " + formatEventWhen(new Date()) + " (Europe/Zurich). Für Details: Kalender.");
    } catch (e) {
      const cached = loadCache();
      if (cached && Array.isArray(cached.rows)) {
        applyEvents(parseFeed(cached.rows), { fetchedAt: cached.fetchedAt, fromCache: true, error: "feed" });
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
      "<li" + cls + ">" +
      '<span class="impact">High</span>' +
      '<span class="ccy">' + escapeHtml(e.currency) + "</span>" +
      badge +
      escapeHtml(e.title) +
      '<span class="event-meta">' + escapeHtml(formatEventWhen(e.at)) + " · Europe/Zurich</span>" +
      "</li>"
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
      list.innerHTML = "<li>Keine anstehenden High-Impact-Termine aus dem optionalen Feed.</li>";
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

  /* —— News —— */
  function setNewsOffline(offline) {
    const wrap = document.getElementById("news-widget-wrap");
    const fallback = document.getElementById("news-fallback");
    const host = document.getElementById("tv-news");
    if (!wrap || !fallback || !host) return;
    wrap.classList.toggle("is-offline", offline);
    fallback.hidden = !offline;
    host.hidden = offline;
  }

  function newsConfig(feed, market) {
    const base = {
      colorTheme: "dark",
      isTransparent: true,
      displayMode: "regular",
      width: "100%",
      height: "100%",
      locale: "de_DE",
    };
    if (feed === "market") return Object.assign({ feedMode: "market", market: market.newsMarket }, base);
    return Object.assign({ feedMode: "symbol", symbol: market.symbol }, base);
  }

  function syncNewsButtons() {
    document.querySelectorAll(".news-feed-btn").forEach((btn) => {
      const on = btn.dataset.feed === newsFeed;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const note = document.getElementById("news-fallback-note");
    if (!note) return;
    if (newsFeed === "market") {
      note.textContent = "Markt-Feed (" + selected().newsMarket + ") als Ausweich. Symbol zeigt nur Meldungen zu " + selected().name + ".";
    } else {
      note.textContent = "Symbol-Feed zu " + selected().name + ". Wenn die Liste leer bleibt: Markt.";
    }
  }

  function mountNews(force) {
    const host = document.getElementById("tv-news");
    if (!host) return;
    syncNewsButtons();
    const m = selected();
    if (!navigator.onLine) {
      setNewsOffline(true);
      return;
    }
    setNewsOffline(false);
    if (newsWidgetMounted && !force && newsFor === m.symbol + ":" + newsFeed) return;
    resetWidgetHost(host);
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = TV_NEWS_URL;
    script.async = true;
    script.textContent = JSON.stringify(newsConfig(newsFeed, m));
    script.addEventListener("error", () => {
      newsWidgetMounted = false;
      newsFor = null;
      setNewsOffline(true);
    });
    newsWidgetMounted = true;
    newsFor = m.symbol + ":" + newsFeed;
    host.appendChild(script);
  }

  document.querySelectorAll(".news-feed-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.feed === "market" ? "market" : "symbol";
      if (next === newsFeed && newsWidgetMounted) return;
      newsFeed = next;
      mountNews(true);
    });
  });

  /* —— Chart —— */
  function buildTvSrc(interval, market) {
    const params = new URLSearchParams({
      frameElementId: "tv-chart",
      symbol: market.symbol,
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
    document.querySelectorAll(".tf-btn[data-tf]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tf === chartInterval);
    });
    const m = selected();
    if (!navigator.onLine) {
      setChartOffline(true);
      return;
    }
    setChartOffline(false);
    const next = buildTvSrc(chartInterval, m);
    if (iframe.getAttribute("src") !== next) iframe.setAttribute("src", next);
    chartFor = m.symbol + ":" + chartInterval;
    if (chartLoadTimer) clearTimeout(chartLoadTimer);
    chartLoadTimer = setTimeout(() => {
      if (!navigator.onLine) setChartOffline(true);
    }, 12000);
  }

  document.querySelectorAll(".tf-btn[data-tf]").forEach((btn) => {
    btn.addEventListener("click", () => {
      chartInterval = btn.dataset.tf || "10";
      mountChart();
    });
  });

  /* —— Kalender —— */
  function setCalendarOffline(offline) {
    const wrap = document.getElementById("calendar-widget-wrap");
    const fallback = document.getElementById("calendar-fallback");
    const host = document.getElementById("tv-economic-calendar");
    if (!wrap || !fallback || !host) return;
    wrap.classList.toggle("is-offline", offline);
    fallback.hidden = !offline;
    host.hidden = offline;
  }

  function syncImpButtons() {
    document.querySelectorAll(".imp-btn").forEach((btn) => {
      const on = btn.dataset.imp === calImportance;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function mountEconomicCalendar(force) {
    const host = document.getElementById("tv-economic-calendar");
    if (!host) return;
    syncImpButtons();
    if (!navigator.onLine) {
      setCalendarOffline(true);
      return;
    }
    setCalendarOffline(false);
    if (calendarWidgetMounted && !force) return;
    resetWidgetHost(host);
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
      currencyFilter: "USD,EUR,GBP,JPY,CAD,AUD,CHF,CNY",
      importanceFilter: calImportance === "all" ? "-1,0,1" : "1",
    });
    script.addEventListener("error", () => {
      calendarWidgetMounted = false;
      setCalendarOffline(true);
    });
    calendarWidgetMounted = true;
    host.appendChild(script);
  }

  document.querySelectorAll(".imp-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.imp === "all" ? "all" : "high";
      if (next === calImportance && calendarWidgetMounted) return;
      calImportance = next;
      mountEconomicCalendar(true);
    });
  });

  window.addEventListener("online", () => {
    const deskView = document.getElementById("view-desk");
    if (deskView && !deskView.hidden) {
      mountTape();
      mountQuote();
    }
    const chartView = document.getElementById("view-chart");
    if (chartView && !chartView.hidden) mountChart();
    const calendarView = document.getElementById("view-kalender");
    if (calendarView && !calendarView.hidden) mountEconomicCalendar();
    const newsView = document.getElementById("view-news");
    if (newsView && !newsView.hidden) mountNews();
    fetchCalendar();
    fetchMoves();
  });

  window.addEventListener("offline", () => {
    quoteWidgetMounted = false;
    quoteFor = null;
    newsWidgetMounted = false;
    newsFor = null;
    tapeMounted = false;
    const deskView = document.getElementById("view-desk");
    if (deskView && !deskView.hidden) {
      setQuoteOffline(true);
      setQuoteStatus(false);
    }
    const chartView = document.getElementById("view-chart");
    if (chartView && !chartView.hidden) setChartOffline(true);
    const calendarView = document.getElementById("view-kalender");
    if (calendarView && !calendarView.hidden) setCalendarOffline(true);
    const newsView = document.getElementById("view-news");
    if (newsView && !newsView.hidden) setNewsOffline(true);
  });

  /* —— Init —— */
  loadStoredMarket();
  buildOrbit();
  updateDeskClock();
  setInterval(updateDeskClock, 1000);
  renderDeskEvents();
  fetchCalendar();
  fetchMoves();
  setInterval(fetchMoves, 60000);
  const initialView = viewFromHash();
  if (initialView && initialView !== "desk") showView(initialView);
  else {
    mountTape();
    mountQuote();
  }
  setInterval(renderDeskEvents, 60000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => {});
  }
})();
