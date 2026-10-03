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
    const q = quotes[m.quote];
    const ch = q && q.change;
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
    updateWorldClocks(now);
    const st = sessionState(now);
    updateLamps(st, now);
    renderFeld(now);
  }

  /* —— Watchlist —— */
  function digitsFor(scale) {
    const ps = Number(scale);
    if (!Number.isFinite(ps) || ps < 1) return null;
    const d = Math.round(Math.log10(ps));
    if (d < 0 || d > 8) return null;
    return d;
  }

  function formatNum(n, scale) {
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    const digits = digitsFor(scale);
    const opts = digits == null
      ? { maximumFractionDigits: 8 }
      : { minimumFractionDigits: digits, maximumFractionDigits: digits };
    return n.toLocaleString("de-CH", opts);
  }

  function formatPct(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    const body = Math.abs(n).toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (n > 0) return "+" + body + " %";
    if (n < 0) return "−" + body + " %";
    return body + " %";
  }

  function formatAbs(n, scale) {
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    const body = formatNum(Math.abs(n), scale);
    if (body == null) return null;
    if (n > 0) return "+" + body;
    if (n < 0) return "−" + body;
    return body;
  }

  function dirOf(n) {
    if (typeof n !== "number" || !Number.isFinite(n) || n === 0) return "";
    return n > 0 ? "up" : "down";
  }

  /* Position of the last price inside today's high-low. No bar when a number is missing or high equals low. */
  function dayRangeRatio(close, high, low) {
    if (typeof close !== "number" || typeof high !== "number" || typeof low !== "number") return null;
    if (!Number.isFinite(close) || !Number.isFinite(high) || !Number.isFinite(low)) return null;
    if (high === low) return null;
    const ratio = (close - low) / (high - low);
    if (!Number.isFinite(ratio)) return null;
    return ratio;
  }

  /* Own note versus the day's sign. Only a contradiction is a sentence. Not a signal. */
  function markConflictText(mark, change) {
    if (mark !== "up" && mark !== "down") return "";
    if (typeof change !== "number" || !Number.isFinite(change) || change === 0) return "";
    if (mark === "up" && change < 0) return "Du hast steigend markiert, der Tag ist rot.";
    if (mark === "down" && change > 0) return "Du hast sinkend markiert, der Tag ist grün.";
    return "";
  }

  function showOrDash(text) {
    return text == null || text === "" ? "–" : text;
  }

  function paintQuoteStatus() {
    const el = document.getElementById("quote-status");
    if (!el) return;
    if (quoteLive && quoteStamp) {
      el.textContent = "Kurse · TradingView-Scanner · " + formatEventWhen(new Date(quoteStamp)) + " · Europe/Zurich";
      return;
    }
    if (quoteStamp) {
      el.textContent = "Kurse · letzter Scanner-Stand " + formatEventWhen(new Date(quoteStamp)) + " · Europe/Zurich. Fehlende Zahl: Strich.";
      return;
    }
    el.textContent = "Kurse · TradingView-Scanner. Fehlende Zahl: Strich, kein geschätzter Kurs.";
  }

  function paintWatch() {
    document.querySelectorAll(".wl-row").forEach((row) => {
      const m = marketById(row.dataset.id);
      const q = quotes[m.quote] || null;
      const on = m.id === selectedId;
      row.classList.toggle("is-on", on);
      row.setAttribute("aria-selected", on ? "true" : "false");
      const chg = row.querySelector(".wl-chg");
      const px = row.querySelector(".wl-px");
      const hi = row.querySelector(".hl-h");
      const lo = row.querySelector(".hl-l");
      const change = q ? q.change : null;
      const dir = dirOf(change);
      if (chg) {
        const pct = formatPct(change);
        const abs = formatAbs(q ? q.changeAbs : null, q ? q.pricescale : null);
        chg.textContent = showOrDash(pct) + "   " + showOrDash(abs);
        chg.classList.remove("up", "down");
        if (dir) chg.classList.add(dir);
      }
      if (px) {
        px.textContent = showOrDash(formatNum(q ? q.close : null, q ? q.pricescale : null));
        px.classList.remove("up", "down");
        if (dir) px.classList.add(dir);
      }
      if (hi) hi.textContent = showOrDash(formatNum(q ? q.high : null, q ? q.pricescale : null));
      if (lo) lo.textContent = showOrDash(formatNum(q ? q.low : null, q ? q.pricescale : null));
      const range = row.querySelector(".wl-range");
      const marker = row.querySelector(".wl-range-mark");
      if (range && marker) {
        const ratio = dayRangeRatio(q ? q.close : null, q ? q.high : null, q ? q.low : null);
        if (ratio == null) {
          range.hidden = true;
          marker.style.left = "";
          marker.classList.remove("up", "down");
        } else {
          const pct = Math.min(100, Math.max(0, ratio * 100));
          range.hidden = false;
          marker.style.left = pct.toFixed(2) + "%";
          marker.classList.remove("up", "down");
          if (dir) marker.classList.add(dir);
        }
      }
      const note = marks[m.id] || "";
      row.querySelectorAll(".mark-btn").forEach((btn) => {
        const active = btn.dataset.mark === note;
        btn.classList.toggle("on", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
      const abgleich = row.querySelector(".wl-abgleich");
      if (abgleich) {
        const conflict = markConflictText(note, change);
        abgleich.textContent = conflict;
        abgleich.hidden = !conflict;
      }
    });
    paintQuoteStatus();
  }

  function toggleMark(id, dir) {
    if (!MARKETS.some((m) => m.id === id)) return;
    if (dir !== "up" && dir !== "down") return;
    if (marks[id] === dir) delete marks[id];
    else marks[id] = dir;
    storeMarks();
    paintWatch();
  }

  function applyMarketChrome() {
    const m = selected();
    const chartTitle = document.getElementById("chart-title");
    if (chartTitle) chartTitle.textContent = m.name;
    const chartKind = document.getElementById("chart-kind");
    if (chartKind) chartKind.textContent = m.kind + " · nur Anzeige · TradingView · keine Signale, keine Orders";
    const iframe = document.getElementById("tv-chart");
    if (iframe) iframe.title = m.name + " Chart TradingView";
    const badge = document.getElementById("news-badge");
    if (badge) badge.textContent = m.tvName;
    const newsCredit = document.getElementById("news-credit");
    const newsCreditName = document.getElementById("news-credit-name");
    if (newsCredit) newsCredit.href = symbolHref(m);
    if (newsCreditName) newsCreditName.textContent = m.name;
    paintWatch();
    renderFeld(new Date());
  }

  function selectMarket(id) {
    if (!MARKETS.some((m) => m.id === id)) return;
    if (id === selectedId) return;
    selectedId = id;
    newsFeed = "symbol";
    storeMarket();
    applyMarketChrome();
    const chart = document.getElementById("view-chart");
    if (chart && !chart.hidden) mountChart();
    const news = document.getElementById("view-news");
    if (news && !news.hidden) mountNews(true);
    else newsWidgetMounted = false;
  }

  function buildWatchlist() {
    const host = document.getElementById("watchlist");
    if (!host) return;
    host.innerHTML = "";
    let lastGroup = "";
    MARKETS.forEach((m) => {
      if (m.group !== lastGroup) {
        const head = document.createElement("div");
        head.className = "wl-head wl-head-" + (
          m.group === "Währungen" ? "fx"
          : m.group === "Indizes" ? "idx"
          : m.group === "Rohstoffe" ? "cmd"
          : m.group === "Zinsen" ? "rate"
          : "crypto"
        );
        head.textContent = m.group;
        host.appendChild(head);
        lastGroup = m.group;
      }
      const row = document.createElement("div");
      row.className = "wl-row";
      row.dataset.id = m.id;
      row.setAttribute("role", "option");
      row.tabIndex = 0;
      row.setAttribute("aria-label", m.name);
      row.innerHTML =
        '<div class="wl-main">' +
          '<div class="wl-name"></div>' +
          '<div class="wl-chg">–   –</div>' +
          '<div class="wl-hl"><span class="hl-k" title="Hoch">H</span> <span class="hl-h">–</span>' +
          '<span class="hl-k hl-l-k" title="Tief">T</span> <span class="hl-l">–</span></div>' +
          '<div class="wl-range" hidden aria-hidden="true"><span class="wl-range-mark"></span></div>' +
        "</div>" +
        '<div class="wl-side">' +
          '<div class="wl-px">–</div>' +
          '<div class="wl-marks">' +
            '<button type="button" class="mark-btn up" data-mark="up" aria-pressed="false">steigt</button>' +
            '<button type="button" class="mark-btn down" data-mark="down" aria-pressed="false">sinkt</button>' +
          "</div>" +
          '<p class="wl-abgleich" hidden></p>' +
        "</div>";
      row.querySelector(".wl-name").textContent = m.name;
      row.addEventListener("click", () => selectMarket(m.id));
      row.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          selectMarket(m.id);
        }
      });
      row.querySelectorAll(".mark-btn").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          toggleMark(m.id, btn.dataset.mark);
        });
      });
      host.appendChild(row);
    });
    applyMarketChrome();
  }

  function quoteFromRow(row) {
    const d = (row && row.d) || [];
    return {
      close: numOrNull(d[0]),
      change: numOrNull(d[1]),
      changeAbs: numOrNull(d[2]),
      high: numOrNull(d[3]),
      low: numOrNull(d[4]),
      pricescale: numOrNull(d[5]),
    };
  }

  async function fetchQuotes() {
    if (!navigator.onLine) {
      quoteLive = false;
      paintQuoteStatus();
      return;
    }
    const tickers = [];
    MARKETS.forEach((m) => {
      if (tickers.indexOf(m.quote) < 0) tickers.push(m.quote);
    });
    try {
      const res = await fetch(SCAN_URL, {
        method: "POST",
        cache: "no-store",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: { tickers }, columns: SCAN_COLS }),
      });
      if (!res.ok) {
        quoteLive = false;
        paintQuoteStatus();
        return;
      }
      const data = await res.json();
      const rows = (data && data.data) || [];
      const next = Object.create(null);
      rows.forEach((row) => {
        if (row && row.s) next[row.s] = quoteFromRow(row);
