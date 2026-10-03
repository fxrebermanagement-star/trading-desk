      });
    } catch (e) {
      if (e && e.name === "AbortError") return;
      if (provider !== topProvider || newsFeed !== "top") return;
      setTopStatus("Top-Provider nicht erreichbar");
    }
  }

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

  function mountNews(force) {
    const host = document.getElementById("tv-news");
    if (!host) return;
    syncNewsButtons();
    const panel = document.getElementById("top-provider-panel");
    const wrap = document.getElementById("news-widget-wrap");
    const top = newsFeed === "top";
    if (panel) panel.hidden = !top;
    if (wrap) wrap.hidden = top;
    if (top) {
      loadTopProvider();
      return;
    }
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
      const raw = btn.dataset.feed;
      const next = raw === "market" || raw === "top" ? raw : "symbol";
      if (next === newsFeed && next !== "top" && newsWidgetMounted) return;
      newsFeed = next;
      mountNews(true);
    });
  });

  document.querySelectorAll(".news-provider-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = TOP_PROVIDERS.indexOf(btn.dataset.provider) >= 0 ? btn.dataset.provider : "reuters";
      topProvider = next;
      newsFeed = "top";
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
    const chartView = document.getElementById("view-chart");
    if (chartView && !chartView.hidden) mountChart();
    const calendarView = document.getElementById("view-kalender");
    if (calendarView && !calendarView.hidden) {
      mountEconomicCalendar();
      mountInflation();
    }
    const newsView = document.getElementById("view-news");
    if (newsView && !newsView.hidden) mountNews();
    fetchCalendar();
    fetchQuotes();
  });

  window.addEventListener("offline", () => {
    newsWidgetMounted = false;
    newsFor = null;
    quoteLive = false;
    paintQuoteStatus();
    const chartView = document.getElementById("view-chart");
    if (chartView && !chartView.hidden) setChartOffline(true);
    const calendarView = document.getElementById("view-kalender");
    if (calendarView && !calendarView.hidden) setCalendarOffline(true);
    const newsView = document.getElementById("view-news");
    if (newsView && !newsView.hidden) {
      if (newsFeed === "top") setTopStatus("Top-Provider nicht erreichbar");
      else setNewsOffline(true);
    }
  });


  /* —— Globale Inflation (öffentliches Widget + Länderdateien) —— */
  function mountInflationMap() {
    const host = document.getElementById("inflation-map");
    const fallback = document.getElementById("inflation-map-fallback");
    if (!host || host.querySelector("tv-economic-map")) return;
    if (!navigator.onLine) {
      if (fallback) fallback.hidden = false;
      return;
    }
    if (fallback) fallback.hidden = true;
    if (!document.querySelector("script[data-econ-map]")) {
      const script = document.createElement("script");
      script.type = "module";
      script.src = TV_ECON_MAP_URL;
      script.dataset.econMap = "1";
      script.addEventListener("error", () => {
        if (fallback) fallback.hidden = false;
      });
      document.head.appendChild(script);
    }
    const el = document.createElement("tv-economic-map");
    el.setAttribute("metric", "iryy");
    el.setAttribute("region", "global");
    el.setAttribute("theme", "dark");
    host.insertBefore(el, fallback || null);
  }

  async function loadInflationList() {
    const list = document.getElementById("inflation-list");
    const status = document.getElementById("inflation-status");
    if (!list || !status) return;
    if (!navigator.onLine) {
      list.replaceChildren();
      status.hidden = false;
      status.textContent = "Inflation nicht erreichbar";
      return;
    }
    const jobs = G20_IRYY.map(async (pair) => {
      const code = pair[0];
      const name = pair[1];
      const res = await fetch(IRYY_BASE + code.toLowerCase() + "/iryy.json", {
        cache: "no-store",
        credentials: "omit",
        mode: "cors",
      });
      if (!res.ok) throw new Error("status");
      const data = await res.json();
      const lp = data && data.quoteSnapshot && data.quoteSnapshot.lp;
      const bars = data && data.bars && data.bars.historical && data.bars.historical["1M"] && data.bars.historical["1M"].bars;
      const last = Array.isArray(bars) && bars.length ? bars[bars.length - 1] : null;
      const when = last && typeof last[0] === "number" ? last[0] : null;
      if (typeof lp !== "number" || !isFinite(lp) || when == null) throw new Error("shape");
      return { name: name, lp: lp, when: when };
    });
    const settled = await Promise.allSettled(jobs);
    const rows = [];
    settled.forEach((r) => {
      if (r.status === "fulfilled") rows.push(r.value);
    });
    rows.sort((a, b) => b.lp - a.lp);
    list.replaceChildren();
    if (!rows.length) {
      status.hidden = false;
      status.textContent = "Inflation nicht erreichbar";
      return;
    }
    status.hidden = true;
    status.textContent = "";
    const fmt = new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    rows.forEach((row) => {
      const li = document.createElement("li");
      li.className = "inflation-row";
      const name = document.createElement("span");
      name.className = "inflation-name";
      name.textContent = row.name;
      const when = document.createElement("span");
      when.className = "inflation-when";
      when.textContent = zurichMonth(row.when);
      const left = document.createElement("span");
      left.appendChild(name);
      left.appendChild(when);
      const rate = document.createElement("span");
      rate.className = "inflation-rate";
      rate.textContent = fmt.format(row.lp) + " %";
      li.appendChild(left);
      li.appendChild(rate);
      list.appendChild(li);
    });
  }

  function mountInflation() {
    mountInflationMap();
    const status = document.getElementById("inflation-status");
    const failed = status && !status.hidden && status.textContent === "Inflation nicht erreichbar";
    if (inflationStarted && !failed) return;
    inflationStarted = true;
    loadInflationList();
  }

  /* —— Init —— */
  loadStoredMarket();
  loadMarks();
  loadQuoteCache();
  buildWatchlist();
  updateDeskClock();
  setInterval(updateDeskClock, 1000);
  renderDeskEvents();
  renderWeekEvents();
  fetchCalendar();
  fetchQuotes();
  setInterval(fetchQuotes, 60000);
  const initialView = viewFromHash();
  if (initialView && initialView !== "desk") showView(initialView);
  setInterval(renderDeskEvents, 60000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => {});
  }
})();
