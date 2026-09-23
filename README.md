# Trading Cockpit

Ruhiges Tages- und Wochen-Cockpit für **EUR/USD** (RöffÄää).  
Statische PWA: kein Broker, keine Signale/Orders — Desk, Chart (TradingView EURUSD), Kalender, News-Platzhalter, Journal und Wochenplan. Daten liegen in `localStorage` unter dem Schlüssel `trading-desk-v1`.

## Lokal öffnen

App-Ordner:

```text
trading-cockpit/app/
```

**Einfach (ohne Offline-SW):** Datei `app/index.html` im Browser öffnen (Doppelklick oder «Open File»). Journal und localStorage funktionieren so.

**Empfohlen (PWA / Service Worker):** über einen lokalen HTTP-Server, damit Offline-Cache und Manifest greifen:

```bash
cd trading-cockpit/app
python3 -m http.server 8080
```

Dann im Browser: [http://127.0.0.1:8080/](http://127.0.0.1:8080/)

Optional «Zum Home-Bildschirm» / Installieren — Manifest und Icons liegen bereit.

## Navigation

| Tab | Inhalt |
|-----|--------|
| **Desk** | Datum/Uhrzeit Europe/Zurich, Session-Chips London/NY/Overlap, Ampel-Platzhalter, nächste Events |
| **Chart** | TradingView-Embed EUR/USD (Anzeige only), TF: M10 / H1 / H4 / D1 — braucht Netz; offline ruhige Meldung |
| **Kalender** | Beispiel High-Impact EUR/USD der aktuellen Woche + eigene Events |
| **News** | Platzhalter-Karten + lokale Notizen |
| **Journal** | Formular + Liste (localStorage) |
| **Woche** | Wochenplan-Text + No-Trade-Tage |

## Live

https://fxrebermanagement-star.github.io/trading-desk/

`start_url` und relative Pfade in Manifest/SW sind schon relativ (`./`), damit Pages unter Unterpfad funktioniert, wenn die App im Repo-Root der Pages-Site liegt.

## Hinweise

- Kalender-Events mit Label **Beispiel** sind fest im Code; eigene Events und Journal persistieren lokal.
- Ampel steht bewusst auf **frei** (Platzhalter).
- Kein Gendersprache; UI auf Deutsch.
- `file://` blockiert oft den Service Worker — für Offline bitte lokalen Server nutzen.
- Chart: freies TradingView-Widget (`FX:EURUSD`, Theme dark, Locale `de`, Zeitzone Europe/Zurich). Default-Intervall **M10**. Offline: Fallback-Text, kein Cache der TV-Assets.

## Skizze

Siehe [COCKPIT-SKIZZE.md](./COCKPIT-SKIZZE.md) für die MVP-Ideen (Risk-Blatt, Live-Feeds usw. später).
