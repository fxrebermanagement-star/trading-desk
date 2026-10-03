      });
      quotes = next;
      quoteLive = true;
      quoteStamp = new Date().toISOString();
      storeQuoteCache();
      paintWatch();
      renderFeld(new Date());
    } catch (e) {
      quoteLive = false;
      paintQuoteStatus();
    }
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
    renderWeekEvents();
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
      } else {
        applyEvents([], { error: "offline" });
        setDeskSource("Kalender nicht erreichbar.");
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
        setDeskSource("Kalender nicht erreichbar.");
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

  function renderWeekEvents() {
    const list = document.getElementById("week-events");
    const src = document.getElementById("week-events-source");
    if (!list) return;
    const hasEvents = calendar.events && calendar.events.length;
    if (calendar.error && !hasEvents) {
      list.innerHTML = "<li>Kalender nicht erreichbar.</li>";
      if (src) src.textContent = "Kalender nicht erreichbar.";
      return;
    }
    if (!calendar.fetchedAt && !hasEvents) {
      list.innerHTML = "<li>Kalender wird geladen…</li>";
      if (src) src.textContent = "Kalender wird geladen…";
      return;
    }
    const bounds = weekBounds(new Date());
    const week = (calendar.events || []).filter((e) => {
      const ymd = zurichYMD(e.at);
      return ymd >= bounds.start && ymd <= bounds.end;
    });
    if (!week.length) {
      list.innerHTML = "<li>Keine Termine mit hoher Wichtigkeit in dieser Woche.</li>";
    } else {
      list.innerHTML = week.map((e) => (
        "<li>" +
        '<span class="ccy">' + escapeHtml(e.currency) + "</span>" +
        escapeHtml(e.title) +
        '<span class="event-meta">' + escapeHtml(formatEventWhen(e.at)) + " · Europe/Zurich</span>" +
        "</li>"
      )).join("");
    }
    if (!src) return;
    if (calendar.fromCache) {
      const t = calendar.fetchedAt ? formatEventWhen(new Date(calendar.fetchedAt)) : "—";
      src.textContent = "Letzte gecachte Woche · Stand " + t + " · Europe/Zurich.";
    } else {
      src.textContent = "Forex-Factory-Woche · nur hohe Wichtigkeit · Europe/Zurich.";
    }
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
    const row = document.getElementById("news-provider-row");
    if (row) row.hidden = newsFeed !== "top";
    document.querySelectorAll(".news-provider-btn").forEach((btn) => {
      const on = btn.dataset.provider === topProvider;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const note = document.getElementById("news-fallback-note");
    const disclaimer = document.getElementById("news-disclaimer");
    if (disclaimer) {
      disclaimer.textContent = newsFeed === "top"
        ? "Top-Provider auf Deutsch · nur Information, keine Kauf- oder Verkaufstipps."
        : "Timeline zum gewählten Markt · nur Information, keine Kauf- oder Verkaufstipps.";
    }
    if (!note) return;
    if (newsFeed === "top") {
      note.textContent = "Reuters steht zuerst. Symbol und Markt bleiben über die anderen Schalter. Zeit in Europe/Zurich.";
    } else if (newsFeed === "market") {
      note.textContent = "Markt-Feed (" + selected().newsMarket + ") als Ausweich. Symbol zeigt nur Meldungen zu " + selected().name + ".";
    } else {
      note.textContent = "Symbol-Feed zu " + selected().name + ". Wenn die Liste leer bleibt: Markt.";
    }
  }

  function zurichStamp(ms) {
    return new Intl.DateTimeFormat("de-CH", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ms)) + " Europe/Zurich";
  }

  function zurichMonth(ms) {
    return new Intl.DateTimeFormat("de-CH", {
      timeZone: TZ,
      month: "short",
      year: "numeric",
    }).format(new Date(ms));
  }

  function topNewsHref(item) {
    const path = item && typeof item.storyPath === "string" ? item.storyPath : "";
    if (path.charAt(0) === "/") return "https://de.tradingview.com" + path;
    if (typeof item.link === "string" && item.link.indexOf("https://") === 0) return item.link;
    return "";
  }

  function setTopStatus(text) {
    const status = document.getElementById("top-provider-status");
    const list = document.getElementById("top-provider-list");
    if (list) list.replaceChildren();
    if (!status) return;
    status.hidden = !text;
    status.textContent = text || "";
  }

  async function loadTopProvider() {
    const list = document.getElementById("top-provider-list");
    const status = document.getElementById("top-provider-status");
    if (!list || !status) return;
    const provider = TOP_PROVIDERS.indexOf(topProvider) >= 0 ? topProvider : "reuters";
    topProvider = provider;
    if (topAbort) topAbort.abort();
    if (!navigator.onLine) {
      setTopStatus("Top-Provider nicht erreichbar");
      return;
    }
    list.replaceChildren();
    status.hidden = false;
    status.textContent = "Lade Schlagzeilen…";
    const ac = new AbortController();
    topAbort = ac;
    const url = TOP_NEWS_URL
      + "?filter=" + encodeURIComponent("lang:de")
      + "&filter=" + encodeURIComponent("provider:" + provider)
      + "&client=landing&streaming=false";
    try {
      const res = await fetch(url, {
        cache: "no-store",
        credentials: "omit",
        mode: "cors",
        signal: ac.signal,
      });
      if (!res.ok) throw new Error("status");
      const data = await res.json();
      if (ac.signal.aborted || provider !== topProvider || newsFeed !== "top") return;
      const raw = data && Array.isArray(data.items) ? data.items : [];
      const rows = [];
      raw.forEach((it) => {
        if (rows.length >= 20 || !it) return;
        if (typeof it.title !== "string" || !it.title.trim()) return;
        if (!it.provider || it.provider.id !== provider || typeof it.provider.name !== "string" || !it.provider.name) return;
        if (typeof it.published !== "number" || !isFinite(it.published)) return;
        rows.push(it);
      });
      if (!rows.length) {
        setTopStatus("Top-Provider nicht erreichbar");
        return;
      }
      status.hidden = true;
      status.textContent = "";
      rows.forEach((it) => {
        const href = topNewsHref(it);
        const node = document.createElement(href ? "a" : "div");
        node.className = "tp-item";
        if (href) {
          node.href = href;
          node.target = "_blank";
          node.rel = "noopener nofollow";
        }
        const meta = document.createElement("div");
        meta.className = "tp-meta";
        meta.textContent = it.provider.name + " · " + zurichStamp(it.published * 1000);
        const title = document.createElement("p");
        title.className = "tp-title";
        title.textContent = it.title.trim();
        node.appendChild(meta);
        node.appendChild(title);
        list.appendChild(node);
