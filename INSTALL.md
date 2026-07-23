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
- Internetzugang (der Scraper lädt drei Seiten von `stats.comunio.de`).
- Es werden **keine** Secrets oder API-Keys benötigt. Es gibt nichts in einer `.env`
  einzutragen.

## Setup in drei Schritten

```bash
npm install                # installiert cheerio (HTML-Parsing)
node scrape.mjs            # holt frische Daten → data/players.json
node build-dashboard.mjs  # baut das Dashboard → dashboard/index.html
```

Danach `dashboard/index.html` im Browser öffnen — fertig. Die Datei enthält alle
Daten eingebettet und funktioniert auch offline.

### Was die Schritte tun

1. **`scrape.mjs`** lädt drei Quellen und schreibt `data/players.json`:
   - Gewinner/Verlierer nach Marktwert (Vortag / Vorwoche / Vormonat)
   - Punkte-Top-100 der Feldspieler
   - Torhüter-Top-25 (nur um Torhüter zu markieren)

   Erwartete Konsolenausgabe am Ende: „✓ Saved to data/players.json" plus eine
   Statistik (rund 150–160 konsolidierte Records). Es ist normal, dass viele
   Punkte-Einträge „unmatched" sind — sie tauchen einfach nicht in den
   Marktwert-Listen auf.

2. **`build-dashboard.mjs`** liest `data/players.json`, berechnet den
   Geheimtipp-Score und schreibt `dashboard/index.html` (~90 KB, alle Daten inline).

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

## Wenn etwas nicht klappt

- **`node scrape.mjs` bricht mit „table not found" ab:** Comunio hat vermutlich sein
  HTML geändert. Die Tabellen-Selektoren (`table.playersTable`) und die Spalten-
  Indizes in `scrape.mjs` müssen dann an die neue Struktur angepasst werden.
- **Alle Marktwerte wirken falsch (z. B. zu klein):** deutsches Zahlenformat prüfen —
  `parseGermanNumber` erwartet `1.860.000` (Punkt = Tausender) und `11,0` (Komma =
  Dezimal). Wenn Comunio das Format ändert, muss diese Funktion angepasst werden.
- **`fetch is not defined`:** Node-Version zu alt. Node 18+ nutzen.
- **Wenige Spieler im Dashboard:** normal — es werden bewusst nur die Top-Listen
  ausgewertet, nicht der gesamte Bundesliga-Kader.

---

*Comunio-Scout — SKAILE Academy Building Challenge, Juli 2026.*
