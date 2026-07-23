# Comunio-Scout

Ein Agent, der öffentliche Comunio-Statistiken ausliest und daraus ein Dashboard mit
Kauf- und Verkaufs-Kandidaten baut — sortiert nach Wert, Momentum und Budget.

## Das Problem

Als Comunio-Spieler (Bundesliga-Managerspiel) muss man in der Anfangsphase sein
Startbudget von ~40–50 Mio durch clevere Transfers vergrößern: Spieler kaufen, deren
Marktwert steigt, und teurer wieder verkaufen. Herauszufinden, welche Spieler gerade im
Wert anziehen, kostet manuell viel Zeit — man vergleicht Marktwerte, Trends und
Tendenzen mühsam über mehrere Seiten.

## Was der Agent macht

Der Agent liest automatisch die öffentlichen Comunio-Statistiken aus (Marktwerte,
Punkte, Marktwert-Tendenzen). Er erkennt, welche Spieler im Wert steigen oder fallen und
welche viel Punkte pro Mio Marktwert bringen. Das Ergebnis ist ein sortierbares
Dashboard mit Kauf- und Verkaufs-Kandidaten, gefiltert nach meinem Budget.

## Stack

- [x] Claude Code (Agent / Skills)
- [ ] n8n
- [x] Sonstiges: Node.js + cheerio (Scraping), Vanilla HTML/JS (self-contained Dashboard), Cloudflare Pages (Hosting)

## Setup

Vollständige, an Claude Code adressierte Schritt-für-Schritt-Anleitung: **[INSTALL.md](INSTALL.md)**.

Kurzfassung (drei Befehle, Node 18+):

```bash
npm install          # cheerio installieren
node scrape.mjs      # frische Daten von stats.comunio.de holen → data/players.json
node build-dashboard.mjs   # self-contained Dashboard bauen → dashboard/index.html
```

`dashboard/index.html` ist danach eine einzelne, in sich geschlossene Datei (alle Daten
eingebettet, keine externen Requests) und kann direkt geöffnet oder nach Cloudflare Pages
deployed werden. `data/` und `dashboard/index.html` liegen bewusst in `.gitignore` — sie
werden bei jedem Lauf frisch erzeugt.

## Was während der Challenge entstanden ist

**Vorher:** nur die Idee und das eigene Comunio-Problem — kein Code, kein Datensatz.
Alles unten ist an einem Bautag (22.07.2026) neu entstanden.

- **Scraper** (`scrape.mjs`): liest drei öffentliche Comunio-Statistikseiten aus
  (Gewinner/Verlierer über Tag/Woche/Monat, Punkte-Top-100, Torhüter-Top-25),
  parst deutsche Zahlenformate und konsolidiert alles über einen Namens-/Vereins-Key
  zu einem Datensatz (`data/players.json`, ~158 Spieler).
- **Dashboard** (`build-dashboard.mjs`): baut daraus eine einzelne, self-contained
  HTML-Datei — vier Tabs (drei Rankings + eigene „Mein Kader"-Merkliste),
  Budget-Filter, Spielersuche, Mobile-Karten, Tooltips und Deep-Links zu
  Transfermarkt/Recherche.
- **„Mein Kader"**: eigene Merkliste im Browser (localStorage) — Spieler per ⭐
  markieren und im Kader-Tab mit einem Halten-/Verkaufen-Hinweis aus dem
  Marktwert-Trend bündeln.
- **Geheimtipp-Score**: eigene Kennzahl aus *Punkte pro Mio Marktwert* × *Momentum*
  (Trend der Vorwoche/Vortag), die günstige, im Wert steigende Spieler hervorhebt.

## Learnings

- **Self-contained schlägt Backend.** Daten direkt ins HTML einbetten heißt: kein
  Server, keine API, keine Datenbank — die fertige Datei läuft überall und ist in
  Sekunden auf Cloudflare Pages deploybar. Für ein Tool, das einmal am Tag frische
  Daten braucht, ist das die einfachste tragfähige Architektur.
- **Der Join ist der schwierige Teil, nicht das Scraping.** Spieler über verschiedene
  Statistikseiten zusammenzuführen scheitert an uneinheitlichen Namen (Kürzel, Umlaute,
  Vereinsschreibweisen). Nur ~44 der 100 Punkte-Einträge matchen sauber auf die
  Marktwert-Liste — sichtbar gemacht durch bewusstes Zählen der „unmatched" statt
  stillem Verschlucken.
- **Deutsche Zahlen brauchen eine eigene Parse-Funktion.** `1.860.000` ist eine Million,
  `11,0` ist elf — Punkt und Komma sind vertauscht gegenüber JavaScript. Ohne
  `parseGermanNumber` wären alle Marktwerte falsch gewesen.

---

**Demo-Video:** [Link zu Loom oder YouTube unlisted — EIN Durchlauf, ungeschnitten]

*SKAILE Academy Building Challenge — Juli 2026*
