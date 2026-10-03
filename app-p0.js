/* Trading Cockpit — info-only PWA. Watchlist, no orders.
 * Chart symbols stay on the desk list. The scanner does not quote every
 * FOREXCOM/TVC CFD, so the row reads a checked alias and shows a dash when
 * that alias has no number. No price is invented.
 *   FOREXCOM:SPXUSD  -> SP:SPX
 *   FOREXCOM:GER40   -> TVC:DEU40
 *   FOREXCOM:US30    -> DJ:DJI
 *   TVC:USOIL        -> FX:USOIL
 * Zinsen are the futures, not the yield. The scanner returned numbers for
 * EUREX:FGBL1! (Euro-Bund) and CBOT:ZN1! (US 10-year T-Note).
 * Yields are not shown. The watchlist is only the rows in MARKETS.
 */
(function () {
  "use strict";

  const TZ = "Europe/Zurich";
  const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
  const CACHE_KEY = "trading-cockpit-ff-cache-v1";
  const MARKET_KEY = "cockpit-market-v9";
  const MARK_KEY = "cockpit-marks-v9";
  const QUOTE_KEY = "cockpit-quotes-v9";
  const TV_EVENTS_URL = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
  const TV_NEWS_URL = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
  const TV_ECON_MAP_URL = "https://widgets.tradingview-widget.com/w/de_DE/tv-economic-map.js";
  const IRYY_BASE = "https://widgets.tradingview-widget.com/data/economic/countries/";
  const G20_IRYY = [
    ["AR", "Argentinien"],
    ["AU", "Australien"],
    ["BR", "Brasilien"],
    ["CA", "Kanada"],
    ["CN", "China"],
    ["DE", "Deutschland"],
    ["FR", "Frankreich"],
    ["GB", "Vereinigtes Königreich"],
    ["ID", "Indonesien"],
    ["IN", "Indien"],
    ["IT", "Italien"],
    ["JP", "Japan"],
    ["KR", "Südkorea"],
    ["MX", "Mexiko"],
    ["RU", "Russland"],
    ["SA", "Saudi-Arabien"],
    ["TR", "Türkei"],
    ["US", "USA"],
    ["ZA", "Südafrika"],
  ];
  const SCAN_URL = "https://scanner.tradingview.com/global/scan";
  const SCAN_COLS = ["close", "change", "change_abs", "high", "low", "pricescale"];
  const CURRENCIES = new Set(["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "NZD"]);

  const MARKETS = [
    { id: "eurusd", group: "Währungen", name: "EUR/USD", key: "EUR", kind: "Devisenpaar", symbol: "FX:EURUSD", quote: "FX:EURUSD", exchange: "FX", tvName: "EURUSD", newsMarket: "forex" },
    { id: "eurchf", group: "Währungen", name: "EUR/CHF", key: "EURCHF", kind: "Devisenpaar", symbol: "FX:EURCHF", quote: "FX:EURCHF", exchange: "FX", tvName: "EURCHF", newsMarket: "forex" },
    { id: "usdchf", group: "Währungen", name: "USD/CHF", key: "USDCHF", kind: "Devisenpaar", symbol: "FX:USDCHF", quote: "FX:USDCHF", exchange: "FX", tvName: "USDCHF", newsMarket: "forex" },
    { id: "jpn", group: "Indizes", name: "Japan 225", key: "JP225", kind: "Index", symbol: "TVC:NI225", quote: "TVC:NI225", exchange: "TVC", tvName: "NI225", newsMarket: "index" },
    { id: "smi", group: "Indizes", name: "SMI", key: "SMI", kind: "Index", symbol: "SIX:SMI", quote: "SIX:SMI", exchange: "SIX", tvName: "SMI", newsMarket: "index" },
    { id: "dax", group: "Indizes", name: "DAX", key: "DAX", kind: "Index", symbol: "FOREXCOM:GER40", quote: "TVC:DEU40", exchange: "FOREXCOM", tvName: "GER40", newsMarket: "index" },
    { id: "us30", group: "Indizes", name: "Wall Street", key: "US30", kind: "Index", symbol: "FOREXCOM:US30", quote: "DJ:DJI", exchange: "FOREXCOM", tvName: "US30", newsMarket: "index" },
    { id: "us500", group: "Indizes", name: "S&P 500", key: "US500", kind: "Index", symbol: "FOREXCOM:SPXUSD", quote: "SP:SPX", exchange: "FOREXCOM", tvName: "SPXUSD", newsMarket: "index" },
    { id: "gold", group: "Rohstoffe", name: "Gold", key: "Gold", kind: "Gold", symbol: "TVC:GOLD", quote: "TVC:GOLD", exchange: "TVC", tvName: "GOLD", newsMarket: "futures" },
    { id: "silver", group: "Rohstoffe", name: "Silber", key: "Silber", kind: "Silber", symbol: "TVC:SILVER", quote: "TVC:SILVER", exchange: "TVC", tvName: "SILVER", newsMarket: "futures" },
    { id: "oil", group: "Rohstoffe", name: "Öl", key: "WTI", kind: "Öl", symbol: "TVC:USOIL", quote: "FX:USOIL", exchange: "TVC", tvName: "USOIL", newsMarket: "futures" },
    { id: "bund", group: "Zinsen", name: "Bund-Future", key: "Bund", kind: "Future", symbol: "EUREX:FGBL1!", quote: "EUREX:FGBL1!", exchange: "EUREX", tvName: "FGBL1!", newsMarket: "futures" },
    { id: "ust", group: "Zinsen", name: "US-Treasury-Future", key: "UST", kind: "Future", symbol: "CBOT:ZN1!", quote: "CBOT:ZN1!", exchange: "CBOT", tvName: "ZN1!", newsMarket: "futures" },
    { id: "btc", group: "Krypto", name: "Bitcoin", key: "BTC", kind: "Krypto", symbol: "BITSTAMP:BTCUSD", quote: "BITSTAMP:BTCUSD", exchange: "BITSTAMP", tvName: "BTCUSD", newsMarket: "crypto" },
    { id: "xrp", group: "Krypto", name: "XRP", key: "XRP", kind: "Krypto", symbol: "BITSTAMP:XRPUSD", quote: "BITSTAMP:XRPUSD", exchange: "BITSTAMP", tvName: "XRPUSD", newsMarket: "crypto" },
  ];

  let selectedId = "eurusd";
  let calendar = { events: [], fetchedAt: null, fromCache: false, error: null };
  let newsWidgetMounted = false;
  let newsFor = null;
  let newsFeed = "symbol";
  let inflationStarted = false;
  let calendarWidgetMounted = false;
  let calImportance = "high";
  let chartInterval = "10";
  let chartLoadTimer = null;
  let quotes = Object.create(null);
  let quoteLive = false;
  let quoteStamp = null;
  const marks = Object.create(null);
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

  function numOrNull(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
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

  function loadMarks() {
    try {
      const raw = JSON.parse(localStorage.getItem(MARK_KEY) || "{}");
      if (!raw || typeof raw !== "object") return;
      MARKETS.forEach((m) => {
        if (raw[m.id] === "up" || raw[m.id] === "down") marks[m.id] = raw[m.id];
      });
    } catch (e) { /* ignore */ }
  }

  function storeMarks() {
    try { localStorage.setItem(MARK_KEY, JSON.stringify(marks)); } catch (e) { /* ignore */ }
  }

  function loadQuoteCache() {
    try {
      const raw = JSON.parse(localStorage.getItem(QUOTE_KEY) || "null");
      if (!raw || !raw.quotes || typeof raw.quotes !== "object") return;
      quotes = Object.create(null);
      Object.keys(raw.quotes).forEach((sym) => {
        const q = raw.quotes[sym];
        if (!q || typeof q !== "object") return;
        quotes[sym] = {
          close: numOrNull(q.close),
          change: numOrNull(q.change),
          changeAbs: numOrNull(q.changeAbs),
          high: numOrNull(q.high),
          low: numOrNull(q.low),
          pricescale: numOrNull(q.pricescale),
        };
      });
      quoteLive = false;
      quoteStamp = raw.at || null;
    } catch (e) { /* ignore */ }
  }

  function storeQuoteCache() {
    try {
      localStorage.setItem(QUOTE_KEY, JSON.stringify({ at: quoteStamp, quotes }));
    } catch (e) { /* ignore */ }
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
    if (name === "chart") mountChart();
    if (name === "kalender") {
      mountEconomicCalendar();
      mountInflation();
    }
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

  /* —— Time (Europe/Zurich plus the world row) —— */
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

  function zurichYMD(d) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  function addDaysYMD(ymd, days) {
    const bits = String(ymd).split("-").map(Number);
    const dt = new Date(Date.UTC(bits[0], bits[1] - 1, bits[2]));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  function weekBounds(now) {
    const ymd = zurichYMD(now);
    const mon0 = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[zurichWeekday(now)];
    const start = addDaysYMD(ymd, -(mon0 == null ? 0 : mon0));
    return { start, end: addDaysYMD(start, 6) };
  }

  function sessionState(now) {
    const day = zurichWeekday(now);
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

  function updateWorldClocks(now) {
    document.querySelectorAll(".world-item").forEach((el) => {
      const zone = el.dataset.zone;
      if (!zone) return;
      let hm = "--:--";
      let date = "";
      try {
        hm = new Intl.DateTimeFormat("de-CH", {
          timeZone: zone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(now);
        date = new Intl.DateTimeFormat("de-CH", {
          timeZone: zone,
          weekday: "short",
          day: "numeric",
          month: "numeric",
        }).format(now);
      } catch (e) {
        hm = "--:--";
        date = "";
      }
      const hmEl = el.querySelector(".world-hm");
      const dateEl = el.querySelector(".world-date");
      if (hmEl) hmEl.textContent = hm;
      if (dateEl) dateEl.textContent = date;
    });
  }

  function updateLamps(st, now) {
    document.querySelectorAll(".lamp-unit").forEach((unit) => {
