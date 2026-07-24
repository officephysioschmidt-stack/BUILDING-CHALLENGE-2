# INSTALL.md — Anleitung für Claude Code

> **An dich, Claude:** Diese Datei ist an dich adressiert. Ein Mensch hat dieses
> Repo frisch geklont und möchte den **Comunio-Scout** zum Laufen bringen. Führe
> ihn durch die Schritte unten. Frag nach, bevor du etwas nach außen deployst.

## Was dieses Projekt ist

Ein Tool für das Bundesliga-Managerspiel *Comunio*. Es liest öffentliche
Statistiken von `stats.comunio.de`, konsolidiert sie zu einem Datensatz und baut
daraus ein einzelnes, in sich geschlossenes HTML-Dashboard mit Kauf-/Verkaufs-
Kandidaten. Kein Backend, keine Datenbank, keine API-Keys.

## Voraussetzungen

- **Node.js 18 oder neuer** (nutzt das eingebaute `fetch`). Prüfen: `node --version`.
- Internetzugang (der Scraper lädt Seiten von `stats.comunio.de` und Google-News-RSS).
- Es werden **keine** Secrets oder API-Keys benötigt. Es gibt nichts in einer `.env`
  einzutragen.

## Setup in drei Schritten

```bash
npm install                # installiert cheerio (HTML-Parsing)
node scrape.mjs            # holt frische Daten → data/*.json (dauert ~5–6 Min, s.u.)
node build-dashboard.mjs  # baut das Dashboard → dashboard/index.html
```

Danach `dashboard/index.html` im Browser öffnen — fertig. Die Datei enthält alle
Daten eingebettet und funktioniert auch offline.

### Was die Schritte tun

1. **`scrape.mjs`** lädt vier Quellgruppen und schreibt vier JSON-Dateien nach `data/`.
   Der Lauf dauert bewusst **~5–6 Minuten**, weil zwischen den Requests Pausen liegen
   (freundliches Scraping) — das ist kein Hänger:
   - `players.json` — Gewinner/Verlierer (Vortag/Vorwoche/Vormonat), Punkte-Top-100,
     Torhüter-Top-25, konsolidiert (~150–160 Records; viele „unmatched" sind normal)
   - `kader.json` — der volle Liga-Kader von den 18 Club-Kaderseiten (~576 Spieler;
     tote Club-IDs von Absteigern werden per Kader-Signatur erkannt und übersprungen)
   - `transfers.json` — Zu- und Abgänge der Liga von `/transfers`
   - `news.json` — Transfer-Schlagzeilen-Zähler pro Top-Listen-Spieler via
     Google-News-RSS (`intitle:<Nachname>`-Query, letzte 3 Tage)
   - `fullnames.json` — Vollnamen aktueller Bundesliga-Spieler aus Wikidata
     (SPARQL), per Nachname+Verein eindeutig zugeordnet — schärft die
     News-Suche und schaltet direkte kicker-Spielerseiten frei
   - zusätzlich: `history/YYYY-MM-DD.json` — täglicher Marktwert-Snapshot
     (nicht in `data/`, sondern in `history/`, weil er versioniert bleibt und
     über die Saison eine echte Trendkurve ergibt)

2. **`build-dashboard.mjs`** liest alle vier Dateien, berechnet den Geheimtipp-Score
   und schreibt `dashboard/index.html` (~220 KB, alle Daten inline). Bricht bewusst
   mit Exit 1 ab, wenn `players.json` unter 50 Einträge hat — Schutz davor, ein fast
   leeres Dashboard über ein gutes zu deployen. `kader.json`/`transfers.json`/
   `news.json` sind optional: fehlen sie, fällt das jeweilige Feature weg, der Build
   läuft trotzdem.

> **Wichtig:** `data/` und `dashboard/index.html` stehen in `.gitignore`. Sie sind
> generierte Artefakte und werden bei jedem Lauf neu erzeugt — nicht ins Repo
> committen, nicht von Hand bearbeiten. Wer die Daten aktualisieren will, lässt
> einfach `scrape.mjs` und dann `build-dashboard.mjs` erneut laufen.

## Deploy nach Cloudflare Pages (optional, erst nach Rückfrage)

Das Dashboard ist eine statische Datei und passt zu Cloudflare Pages. **Vorher den
Menschen fragen** — Deploy hat Außenwirkung.

```bash
# einmalig: wrangler installieren, falls nicht vorhanden
npm install -g wrangler
wrangler login

# das Dashboard-Verzeichnis deployen
wrangler pages deploy dashboard --project-name=comunio-scout
```

Beim ersten Mal legt wrangler das Pages-Projekt an; danach landet jeder Deploy unter
derselben `*.pages.dev`-URL. Auf Windows ist der wrangler-Login gelegentlich zickig —
falls der Browser-Callback hängt, den Login erneut starten.

## Täglicher Ablauf (der eigentliche Nutzen)

Comunio-Marktwerte ändern sich täglich. Der sinnvolle Rhythmus:

```bash
node scrape.mjs && node build-dashboard.mjs
# dann dashboard/index.html öffnen — oder neu deployen
```

**In diesem Repo läuft das bereits automatisch:** `.github/workflows/daily-update.yml`
scrapt, baut und deployt täglich um 05:42 UTC nach Cloudflare Pages Production.
Einzige Voraussetzung ist das Repo-Secret `CLOUDFLARE_API_TOKEN` (scoped Custom
Token, nur Permission „Cloudflare Pages: Edit"). Wer das nachbauen will: Token im
Cloudflare-Dashboard erzeugen, als Actions-Secret hinterlegen, fertig.

## Wenn etwas nicht klappt

- **`node scrape.mjs` bricht mit „table not found" ab:** Comunio hat vermutlich sein
  HTML geändert. Die Tabellen-Selektoren (`table.playersTable`) und die Spalten-
  Indizes in `scrape.mjs` müssen dann an die neue Struktur angepasst werden.
- **Alle Marktwerte wirken falsch (z. B. zu klein):** deutsches Zahlenformat prüfen —
  `parseGermanNumber` erwartet `1.860.000` (Punkt = Tausender) und `11,0` (Komma =
  Dezimal). Wenn Comunio das Format ändert, muss diese Funktion angepasst werden.
- **`fetch is not defined`:** Node-Version zu alt. Node 18+ nutzen.
- **Rankings zeigen nur ~150 Spieler:** normal — die Ranking-Tabs werten bewusst die
  Top-Listen aus (nur dort gibt es Trenddaten). Die **Suche** kennt dagegen den
  kompletten Liga-Kader (~576 Spieler).
- **Keine 📰-Marker im Dashboard:** `news.json` fehlt oder ist leer — z. B. wenn
  Google-News-RSS die IP blockt (der Scraper bricht dann nach 10 Fehlversuchen
  kontrolliert ab). Das Dashboard funktioniert ohne Marker normal weiter.

---

*Comunio-Scout — SKAILE Academy Building Challenge, Juli 2026.*
