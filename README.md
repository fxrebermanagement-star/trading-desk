# Trading Cockpit

Persönliches **Info-only**-Desk für **Devisen, Indizes, Rohstoffe und Krypto** (RöffÄää). Statische PWA ohne Broker, ohne Orders und ohne Kauf- oder Verkaufstipps.

Anzeige, keine Finanzberatung.

## Lokal öffnen

```bash
cd trading-cockpit/app
python3 -m http.server 8080
```

Dann: <http://127.0.0.1:8080/>

Im GitHub-Repo liegen die Dateien im Root (Pages-Root), nicht in einem `app/`-Ordner.

## Navigation

| Tab | Inhalt |
|-----|--------|
| **Desk** | Uhr Europe/Zurich mit leisem Tick, Session-Lampen (leuchten nur an Werktagen, wenn London, NY oder Overlap offen ist; Samstag und Sonntag bleiben dunkel), Feld-Zeile, Marktring, Live-Kurs, Radar |
| **Chart** | TradingView-Embed des gewählten Markts, TF: M10 / H1 / H4 / D1 — Default **M10** |
| **Kalender** | TradingView Economic Calendar, dark, Deutsch. Währungen USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY. Umschalter **Hoch** (Default) / **Alle** |
| **News** | TradingView Timeline zum gewählten Symbol. Schalter **Markt** ist der Ausweich, wenn der Symbol-Feed leer bleibt |

## Märkte

| Block | Zeile | Symbol | Art |
|-------|-------|--------|-----|
| Währungen | EUR/USD | `FX:EURUSD` | Devisenpaar |
| Währungen | EUR/CHF | `FX:EURCHF` | Devisenpaar |
| Währungen | USD/CHF | `FX:USDCHF` | Devisenpaar |
| Indizes | Japan 225 | `TVC:NI225` | Index |
| Indizes | SMI | `SIX:SMI` | Index |
| Indizes | DAX | `FOREXCOM:GER40` | Index |
| Indizes | Wall Street | `FOREXCOM:US30` | Index |
| Indizes | S&P 500 | `FOREXCOM:SPXUSD` | Index |
| Rohstoffe | Gold | `TVC:GOLD` | Gold |
| Rohstoffe | Silber | `TVC:SILVER` | Silber |
| Rohstoffe | Öl | `TVC:USOIL` | Öl |
| Zinsen | Bund-Future | `EUREX:FGBL1!` | Euro-Bund-Future |
| Zinsen | US-Treasury-Future | `CBOT:ZN1!` | US-Treasury-Future, 10 Jahre |
| Krypto | Bitcoin | `BITSTAMP:BTCUSD` | Krypto |
| Krypto | XRP | `BITSTAMP:XRPUSD` | Krypto |

Die Watchlist hat nur diese Zeilen, mit einer dezenten Überschrift je Block. Bund-Future und US-Treasury-Future sind die Futures: der Scanner hat für `EUREX:FGBL1!` und `CBOT:ZN1!` Zahlen geliefert. Die Rendite wird nicht gezeigt.

### Symbol-Tausch nach lokalem Widget-Check

Die Embeds wurden headless gegen `widgetembed` geprüft. Getauscht wurde nur, wo das angeforderte Symbol nicht lud:

- `FOREXCOM:DEU40` zeigte «Invalid symbol». Nächster freier FOREX.com-DAX, der Kerzen lud: **`FOREXCOM:GER40`** (Germany 40 CFD).
- `TVC:NATURALGAS` existiert im Widget nicht («symbol doesn't exist»). Nächster freier Gas-CFD, der lud: **`FOREXCOM:NATURALGAS`**.

Unverändert, weil der Chart lud: `FX:EURUSD`, `FOREXCOM:SPXUSD`, `FOREXCOM:NSXUSD` (US 100), `TVC:USOIL`, `TVC:GOLD`, `TVC:SILVER`, `BITSTAMP:BTCUSD`, `BITSTAMP:ETHUSD`, `COINBASE:SOLUSD`, `BITSTAMP:XRPUSD`.

Kurse kommen nur aus TradingView-Widgets. Die Tagesrichtung im Feld («heute grün/rot») erscheint nur, wenn der TradingView-Scanner für **genau dieses** Symbol eine Zahl liefert. Sonst fällt der Satzteil weg. Es werden keine Preise erfunden.

## Feld und Radar

Das **Feld** unter der Uhr ist eine Zeile aus bis zu drei Tatsachen: Session (London offen, New York offen, Overlap läuft oder Ruhig), nächster High-Impact-Termin mit Countdown aus dem optionalen Feed, und die Tagesrichtung des gewählten Markts falls vorhanden. Fehlende Tatsachen werden weggelassen.

Das **Radar** wiederholt den Session-Status in Europe/Zurich und die nächsten High-Impact-Termine. Beschriftung: «Hinweise, keine Order, keine Empfehlung.» Keine Einstiege, keine Stops, kein Long/Short.

## Kalender und News

- Kalender: `embed-widget-events.js`, `colorTheme: dark`, `locale: de`, `currencyFilter: USD,EUR,GBP,JPY,CAD,AUD,CHF,CNY`, `importanceFilter: 1` oder bei **Alle** `-1,0,1`.
- News: `embed-widget-timeline.js`, `feedMode: symbol` zum gewählten Symbol, `locale: de_DE`. **Markt** schaltet auf `feedMode: market` (forex, index, futures oder crypto). Die Headline-Schnittstelle setzt kein CORS für die Pages-Domain, deshalb schaltet die App nicht still um, sondern lässt den Ausweich sichtbar.
- Der FF-Wochenfeed bleibt optional für Feld und Radar. Bei Fehler gilt der lokale Cache. Der Kalender hängt nicht davon ab.

## Service Worker

Cache `trading-cockpit-v10`: nur eigene App-Dateien (network-first, Cache-Fallback offline). TradingView und Forex Factory werden nicht abgefangen und nie gecacht.

## Bewusst nicht enthalten

Broker, Orders, Journal, Signale, Einstiege, Stops, Long/Short-Aufrufe, Playbook.

## GitHub Pages

Repo: `fxrebermanagement-star/trading-desk`. Pages-Root ist der Repo-Root (Inhalt der lokalen `app/`).

Live: <https://fxrebermanagement-star.github.io/trading-desk/>

## Hinweise

- UI auf Deutsch, ohne Genderstern. Zeitangaben in Europe/Zurich.
- Kurs, Chart, Kalender und News sind Drittanbieter-Anzeigen von TradingView.
- Keine Finanzberatung, keine Handelsempfehlung.
