# Trading Cockpit

Ruhiges **Info-only**-Desk für **EUR/USD** (RöffÄää). Statische PWA ohne Broker, Signale, Orders oder Handlungsanweisungen: Live-Kurs, Sessions, nächste Events, Chart, Kalender und News.

## Lokal öffnen

```bash
cd trading-cockpit/app
python3 -m http.server 8080
```

Dann: <http://127.0.0.1:8080/>

## Navigation

| Tab | Inhalt |
|-----|--------|
| **Desk** | Datum/Uhrzeit Europe/Zurich, EUR/USD Live-Kurs (TradingView Symbol Info: Kurs, Tagesveränderung, Tagesbereich), Session-Chips London/NY/Overlap und nächste 3 High-Impact EUR/USD Events |
| **Chart** | TradingView-Embed EUR/USD (Anzeige only), TF: M10 / H1 / H4 / D1 — Default **M10** |
| **Kalender** | Primär TradingView Economic Calendar Widget, dark, Deutsch, EUR/USD, High-Importance |
| **News** | TradingView Timeline: EUR/USD-Feed (`FX:EURUSD`) oder Forex-Markt, umschaltbar, dark, Deutsch |

## Kalender

Der Kalender-Tab lädt unabhängig vom optionalen Feed das TradingView Embed `embed-widget-events.js` mit:

- `colorTheme: dark`
- `locale: de`
- `currencyFilter: EUR,USD`
- `importanceFilter: 1` (High, damit der Kalender ruhig und relevant bleibt)

Offline erscheint eine ruhige deutsche Meldung wie beim Chart. Der FF-Wochenfeed `https://nfs.faireconomy.media/ff_calendar_thisweek.json` wird nur optional für die kompakte **Nächste 3 Events**-Vorschau auf dem Desk versucht. Bei 429, CORS oder Netzfehler bleibt die letzte lokale Cache-Woche sichtbar; der Kalender selbst ist davon nicht abhängig.

## Kurs & News

- Desk: `embed-widget-symbol-info.js`, `symbol: FX:EURUSD`, `colorTheme: dark`, `locale: de_DE`. Auf schmalen Displays ist die Kennzahlenzeile (Vortag, Eröffnung, Tagesbereich) seitlich wischbar.
- News: `embed-widget-timeline.js`, `feedMode: symbol` (`FX:EURUSD`) bzw. `feedMode: market` (`forex`), `locale: de_DE`.
- Offline zeigen beide Karten eine ruhige deutsche Meldung.
- Direktlinks: `#desk`, `#chart`, `#kalender`, `#news`.

## Service Worker

Cache `trading-cockpit-v7`: nur eigene App-Dateien (network-first, Cache-Fallback offline). Drittanbieter-Anfragen (TradingView, Forex Factory) werden nicht abgefangen und nie gecacht.

## Bewusst entfernt

Ampel, Journal, Wochenplan, No-Trade-Checklisten, Playbook, Trade-Entry-Formulare, Risk-Sheets und manuelle Event-Eingabe sind bewusst nicht enthalten.

## GitHub Pages

Repo: `fxrebermanagement-star/trading-desk` — der Inhalt von `app/` ist als Pages-Root vorbereitet. Relative Pfade (`./`) funktionieren auch unter dem Projektpfad.

## Hinweise

- UI auf Deutsch; Zeitangaben in Europe/Zurich.
- Kurs, Chart, Kalender und News sind reine Drittanbieter-Anzeigen von TradingView.
- Keine Finanzberatung, keine Handelsempfehlung.
