import fs from 'fs';

// Read players data
let players = JSON.parse(fs.readFileSync('data/players.json', 'utf-8'));

// Guard for the unattended daily cron: never deploy a near-empty dashboard.
// A failed build keeps yesterday's deploy live and makes the Actions run red.
if (!Array.isArray(players) || players.length < 50) {
  console.error(`✗ players.json has only ${Array.isArray(players) ? players.length : 0} entries (expected ~150+) — aborting build to protect the live dashboard`);
  process.exit(1);
}

// Read kader (squad) data
let kader = {};
try {
  kader = JSON.parse(fs.readFileSync('data/kader.json', 'utf-8'));
  if (!kader.spieler) kader.spieler = [];
} catch (e) {
  kader = { spieler: [] };
}

// Read transfers data
let transfers = {};
try {
  transfers = JSON.parse(fs.readFileSync('data/transfers.json', 'utf-8'));
} catch (e) {
  transfers = { stand: new Date().toISOString(), zugaenge: [], abgaenge: [] };
}

// Read transfer news markers (optional — dashboard works without them)
let newsData = {};
try {
  newsData = JSON.parse(fs.readFileSync('data/news.json', 'utf-8'));
  if (!newsData.news) newsData.news = {};
} catch (e) {
  newsData = { news: {} };
}

// Read market-value history snapshots (history/YYYY-MM-DD.json, committed daily).
// Build a per-player time series: "spieler|club" -> [{d, v}, ...] sorted by date.
// Keep only the last 60 days to bound embed size.
let history = {};
try {
  const files = fs.readdirSync('history')
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(-60);
  const series = {};
  for (const f of files) {
    const date = f.slice(0, 10);
    let snap;
    try {
      snap = JSON.parse(fs.readFileSync('history/' + f, 'utf-8'));
    } catch (e) {
      continue;
    }
    for (const key in snap) {
      if (!series[key]) series[key] = [];
      series[key].push({ d: date, v: snap[key] });
    }
  }
  history = series;
  console.log(`✓ History: ${files.length} snapshots, ${Object.keys(series).length} players`);
} catch (e) {
  history = {};
}

// Read Wikidata full names + kicker slugs (optional).
let fullnames = {};
try {
  const fnData = JSON.parse(fs.readFileSync('data/fullnames.json', 'utf-8'));
  fullnames = fnData.map || {};
} catch (e) {
  fullnames = {};
}

// Club name to short code mapping for Transfermarkt precision links
const CLUB_SHORT_CODES = {
  '1. FC Heidenheim': 'Heidenheim',
  '1. FC Köln': 'Köln',
  '1. FC Union Berlin': 'Union',
  '1. FSV Mainz 05': 'Mainz',
  'Bayer 04 Leverkusen': 'Leverkusen',
  'Borussia Dortmund': 'Dortmund',
  'Borussia M\'gladbach': 'Gladbach',
  'Eintracht Frankfurt': 'Frankfurt',
  'FC Augsburg': 'Augsburg',
  'FC Bayern München': 'Bayern',
  'FC Schalke 04': 'Schalke',
  'FC St. Pauli': 'Pauli',
  'Hamburger SV': 'Hamburg',
  'RB Leipzig': 'Leipzig',
  'SC Paderborn': 'Paderborn',
  'SV Elversberg': 'Elversberg',
  'SV Werder Bremen': 'Bremen',
  'Sport-Club Freiburg': 'Freiburg',
  'TSG Hoffenheim': 'Hoffenheim',
  'VfB Stuttgart': 'Stuttgart',
  'VfL Wolfsburg': 'Wolfsburg',
};

// Club badge: Kürzel + Vereinsfarben (rechtlich sauber statt markengeschützter Wappen)
const CLUB_BADGES = {
  '1. FC Heidenheim': { kurz: 'HDH', bg: '#E2001A', fg: '#FFFFFF' },
  '1. FC Köln': { kurz: 'KOE', bg: '#FFFFFF', fg: '#ED1C24' },
  '1. FC Union Berlin': { kurz: 'FCU', bg: '#EB1923', fg: '#FFFFFF' },
  '1. FSV Mainz 05': { kurz: 'M05', bg: '#C3141E', fg: '#FFFFFF' },
  'Bayer 04 Leverkusen': { kurz: 'B04', bg: '#E32221', fg: '#000000' },
  'Borussia Dortmund': { kurz: 'BVB', bg: '#FDE100', fg: '#000000' },
  'Borussia M\'gladbach': { kurz: 'BMG', bg: '#000000', fg: '#FFFFFF' },
  'Eintracht Frankfurt': { kurz: 'SGE', bg: '#000000', fg: '#E1000F' },
  'FC Augsburg': { kurz: 'FCA', bg: '#BA3733', fg: '#FFFFFF' },
  'FC Bayern München': { kurz: 'FCB', bg: '#DC052D', fg: '#FFFFFF' },
  'FC Schalke 04': { kurz: 'S04', bg: '#004D9D', fg: '#FFFFFF' },
  'FC St. Pauli': { kurz: 'STP', bg: '#6F4A2D', fg: '#FFFFFF' },
  'Hamburger SV': { kurz: 'HSV', bg: '#0A3F86', fg: '#FFFFFF' },
  'RB Leipzig': { kurz: 'RBL', bg: '#DD1740', fg: '#FFFFFF' },
  'SC Paderborn': { kurz: 'SCP', bg: '#005CA9', fg: '#FFFFFF' },
  'SV Elversberg': { kurz: 'SVE', bg: '#0E4C92', fg: '#FFFFFF' },
  'SV Werder Bremen': { kurz: 'SVW', bg: '#1D9053', fg: '#FFFFFF' },
  'Sport-Club Freiburg': { kurz: 'SCF', bg: '#C8102E', fg: '#FFFFFF' },
  'TSG Hoffenheim': { kurz: 'TSG', bg: '#1961B5', fg: '#FFFFFF' },
  'VfB Stuttgart': { kurz: 'VfB', bg: '#FFFFFF', fg: '#DF1119' },
  'VfL Wolfsburg': { kurz: 'WOB', bg: '#65B32E', fg: '#FFFFFF' },
};

// Calculate total unique players from PLAYERS + KADER
function calculateTotalPlayersCount() {
  const playerNames = new Set();
  players.forEach(p => {
    playerNames.add(p.spieler.toLowerCase());
  });
  kader.spieler.forEach(p => {
    playerNames.add(p.spieler.toLowerCase());
  });
  return playerNames.size;
}

const totalPlayersEstimate = calculateTotalPlayersCount();

// Calculate Geheimtipp-Score
function calculateGeheimtippScore(playersData) {
  const qualifying = playersData.filter(p => {
    if (p.punkteProMio === null || p.istTorhueter) return false;
    const weekTrend = p.veraenderung && p.veraenderung.vorwoche ? p.veraenderung.vorwoche.prozent : null;
    const dayTrend = p.veraenderung && p.veraenderung.vortag ? p.veraenderung.vortag.prozent : null;
    const momentumWert = weekTrend !== null ? weekTrend : dayTrend;
    return momentumWert && momentumWert > 0;
  });

  if (qualifying.length === 0) {
    playersData.forEach(p => { p.geheimtippScore = null; });
    return;
  }

  const ppmValues = qualifying.map(p => p.punkteProMio);
  const momentumValues = qualifying.map(p => {
    const weekTrend = p.veraenderung && p.veraenderung.vorwoche ? p.veraenderung.vorwoche.prozent : null;
    const dayTrend = p.veraenderung && p.veraenderung.vortag ? p.veraenderung.vortag.prozent : null;
    return weekTrend !== null ? weekTrend : dayTrend;
  });

  const minPPM = Math.min(...ppmValues);
  const maxPPM = Math.max(...ppmValues);
  const minMom = Math.min(...momentumValues);
  const maxMom = Math.max(...momentumValues);

  playersData.forEach(p => {
    const weekTrend = p.veraenderung && p.veraenderung.vorwoche ? p.veraenderung.vorwoche.prozent : null;
    const dayTrend = p.veraenderung && p.veraenderung.vortag ? p.veraenderung.vortag.prozent : null;
    const momentumWert = weekTrend !== null ? weekTrend : dayTrend;

    if (p.punkteProMio === null || p.istTorhueter || !momentumWert || momentumWert <= 0) {
      p.geheimtippScore = null;
      p.usedTrend = null;
    } else {
      const valueNorm = maxPPM - minPPM === 0 ? 0.5 : (p.punkteProMio - minPPM) / (maxPPM - minPPM);
      const momNorm = maxMom - minMom === 0 ? 0.5 : (momentumWert - minMom) / (maxMom - minMom);
      const rawScore = 0.5 * valueNorm + 0.5 * momNorm;
      p.geheimtippScore = Math.round(rawScore * 100 * 10) / 10;
      p.usedTrend = weekTrend !== null ? 'vorwoche' : 'vortag';
    }
  });
}

calculateGeheimtippScore(players);

// PART A: Subdued emerald dark palette as CSS variables
// PART B: Modernized layout, typography, sticky headers
// PART C: Info tooltips with desktop hover & mobile tap
// PART D: Four research link sources (News, TM, Kicker, Ligainsider)
const htmlContent = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comunio-Scout</title>
  <style>
    :root {
      --bg-page: #0B0E0D;
      --bg-panel: #141A18;
      --bg-row: #141A18;
      --bg-row-alt: #191F1C;
      --bg-row-hover: #1E2521;
      --border: #232A26;
      --text-primary: #E8ECE9;
      --text-secondary: #8C978F;
      --accent: #3E9C76;
      --positive: #4CAF7D;
      --negative: #E0665F;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      height: 100%;
      overflow-x: hidden;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg-page);
      min-height: 100vh;
      padding: 20px;
      color: var(--text-primary);
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: var(--bg-panel);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    header {
      background: linear-gradient(135deg, var(--accent) 0%, var(--positive) 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
    }

    header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    header p {
      font-size: 0.95em;
      opacity: 0.9;
    }

    .controls {
      padding: 20px;
      background: var(--bg-row-alt);
      border-bottom: 1px solid var(--border);
    }

    .search-section {
      padding: 20px;
      background: var(--bg-row-alt);
      border-bottom: 1px solid var(--border);
    }

    #playerSearch {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 1em;
      font-family: inherit;
      background: var(--bg-row);
      color: var(--text-primary);
    }

    #playerSearch:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(62, 156, 118, 0.15);
    }

    .search-results {
      display: none;
      padding: 20px;
    }

    .search-results.active {
      display: block;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }

    .card {
      background: var(--bg-row);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .card-header {
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
    }

    .card-name {
      font-weight: 700;
      font-size: 1.1em;
      color: var(--text-primary);
    }

    .card-club {
      font-size: 0.9em;
      color: var(--text-secondary);
    }

    .card-fields {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      font-size: 0.9em;
    }

    .card-field {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .card-field-label {
      color: var(--text-secondary);
      font-size: 0.8em;
      font-weight: 500;
    }

    .card-field-value {
      color: var(--text-primary);
      font-weight: 500;
    }

    .card-field-value.numeric {
      font-family: 'Courier New', monospace;
    }

    .card-field-value.positive {
      color: var(--positive);
    }

    .card-field-value.negative {
      color: var(--negative);
    }

    .card-score-bar {
      width: 100%;
      height: 32px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 0.95em;
    }

    .card-research-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .card-research-btn {
      flex: 1;
      min-width: 70px;
      padding: 8px 12px;
      border-radius: 4px;
      text-decoration: none;
      color: white;
      font-weight: 600;
      font-size: 0.8em;
      transition: all 0.2s;
      border: 1px solid var(--accent);
      background: rgba(62, 156, 118, 0.2);
      cursor: pointer;
      text-align: center;
    }

    .card-research-btn:hover {
      background: var(--accent);
      border-color: var(--positive);
    }

    .filter-group {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      align-items: center;
    }

    label {
      font-weight: 500;
      color: var(--text-secondary);
      font-size: 0.95em;
    }

    input[type="number"],
    input[type="text"],
    select {
      padding: 10px 15px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.95em;
      font-family: inherit;
      background: var(--bg-row);
      color: var(--text-primary);
    }

    input[type="number"]:focus,
    input[type="text"]:focus,
    select:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(62, 156, 118, 0.15);
    }

    .tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      background: var(--bg-row-alt);
      overflow-x: auto;
    }

    .tab-button {
      flex: 1;
      min-width: 120px;
      padding: 16px 20px;
      background: none;
      border: none;
      font-size: 0.95em;
      font-weight: 600;
      cursor: pointer;
      color: var(--text-secondary);
      border-bottom: 3px solid transparent;
      transition: all 0.3s ease;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      white-space: nowrap;
      touch-action: manipulation;
    }

    .tab-word {
      text-transform: uppercase;
    }

    .tab-icon {
      font-size: 1.5em;
    }

    .tw-short {
      display: none;
    }

    .news-marker {
      cursor: help;
      font-size: 0.85em;
    }

    .sparkline {
      display: block;
      margin-top: 2px;
    }

    .tab-button:active {
      background: rgba(62, 156, 118, 0.08);
    }

    .tab-button.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
      background: transparent;
    }

    .tab-button:hover {
      background: rgba(62, 156, 118, 0.05);
      color: var(--accent);
    }

    .tab-content {
      display: none;
      padding: 20px;
    }

    .tab-content.active {
      display: block;
    }

    .momentum-controls,
    .value-controls,
    .geheimtipps-controls {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95em;
    }

    thead {
      background: var(--bg-row-alt);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    th {
      padding: 12px 15px;
      text-align: left;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      border-bottom: 1px solid var(--border);
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      position: relative;
    }

    th.numeric {
      text-align: right;
    }

    th:hover {
      background: var(--bg-row-hover);
    }

    th.sortable::after {
      content: ' ↕';
      font-size: 0.8em;
      opacity: 0.5;
      margin-left: 4px;
    }

    th.sort-asc::after {
      content: ' ↑';
      opacity: 1;
    }

    th.sort-desc::after {
      content: ' ↓';
      opacity: 1;
    }

    .info-icon {
      display: inline-block;
      width: 18px;
      height: 18px;
      margin-left: 4px;
      background: var(--text-secondary);
      color: var(--bg-page);
      border-radius: 50%;
      font-size: 0.7em;
      font-weight: 700;
      text-align: center;
      line-height: 18px;
      cursor: help;
      position: relative;
      min-width: 24px;
      min-height: 24px;
    }

    .tooltip {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-row);
      color: var(--text-primary);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.75em;
      white-space: normal;
      width: 200px;
      text-align: left;
      display: none;
      z-index: 1000;
      border: 1px solid var(--border);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      text-transform: none;
      letter-spacing: 0;
      font-weight: 400;
      margin-bottom: 6px;
    }

    .tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 4px solid transparent;
      border-top-color: var(--border);
    }

    .info-icon:hover .tooltip,
    .info-icon.active .tooltip {
      display: block;
    }

    tbody tr {
      border-bottom: 1px solid var(--border);
      height: 44px;
    }

    tbody tr:nth-child(odd) {
      background: var(--bg-row);
    }

    tbody tr:nth-child(even) {
      background: var(--bg-row-alt);
    }

    tbody tr:hover {
      background: var(--bg-row-hover);
    }

    td {
      padding: 12px 15px;
      vertical-align: middle;
    }

    td.numeric {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-family: 'Courier New', monospace;
    }

    .positive {
      color: var(--positive);
      font-weight: 600;
    }

    .negative {
      color: var(--negative);
      font-weight: 600;
    }

    .neutral {
      color: var(--text-secondary);
    }

    .tendenz {
      font-size: 0.85em;
      background: rgba(62, 156, 118, 0.15);
      color: var(--positive);
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
    }

    .score-cell {
      font-weight: 700;
      text-align: center;
    }

    .score-bar {
      display: inline-block;
      height: 24px;
      border-radius: 4px;
      min-width: 60px;
      text-align: center;
      color: white;
      font-weight: 600;
      font-size: 0.85em;
      line-height: 24px;
    }

    .score-80-100 { background: linear-gradient(90deg, var(--accent) 0%, var(--positive) 100%); }
    .score-60-80 { background: linear-gradient(90deg, var(--accent) 20%, var(--positive) 100%); }
    .score-40-60 { background: linear-gradient(90deg, var(--accent) 50%, var(--positive) 100%); }
    .score-0-40 { background: linear-gradient(90deg, var(--text-secondary) 0%, var(--accent) 100%); }

    .research-buttons {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .research-btn {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 4px;
      text-decoration: none;
      color: white;
      font-weight: 600;
      font-size: 0.75em;
      transition: all 0.2s;
      border: 1px solid var(--accent);
      background: rgba(62, 156, 118, 0.2);
      cursor: pointer;
    }

    .research-btn:hover {
      background: var(--accent);
      border-color: var(--positive);
    }

    .research-btn:active {
      background: var(--positive);
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-secondary);
    }

    .stats-summary {
      padding: 15px 20px;
      background: var(--bg-row-alt);
      border-top: 1px solid var(--border);
      font-size: 0.9em;
      color: var(--text-secondary);
    }

    @media (max-width: 640px) {
      table {
        display: none;
      }

      .mobile-cards {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .mobile-card {
        background: var(--bg-row);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .mobile-card-header {
        display: flex;
        flex-direction: column;
        gap: 2px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 8px;
      }

      .mobile-card-name {
        font-weight: 700;
        font-size: 1em;
        color: var(--text-primary);
      }

      .mobile-card-club {
        font-size: 0.85em;
        color: var(--text-secondary);
      }

      .mobile-card-fields {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        font-size: 0.85em;
      }

      .mobile-card-field {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .mobile-card-label {
        color: var(--text-secondary);
        font-size: 0.75em;
        font-weight: 500;
      }

      .mobile-card-value {
        color: var(--text-primary);
        font-weight: 500;
        font-family: 'Courier New', monospace;
      }

      .mobile-card-value.positive {
        color: var(--positive);
      }

      .mobile-card-value.negative {
        color: var(--negative);
      }

      .mobile-score-bar {
        width: 100%;
        height: 28px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 0.85em;
      }

      .mobile-card-buttons {
        display: flex;
        gap: 6px;
      }

      .mobile-card-btn {
        flex: 1;
        min-width: 60px;
        padding: 6px 8px;
        border-radius: 3px;
        text-decoration: none;
        color: white;
        font-weight: 600;
        font-size: 0.7em;
        transition: all 0.2s;
        border: 1px solid var(--accent);
        background: rgba(62, 156, 118, 0.2);
        cursor: pointer;
        text-align: center;
      }

      .mobile-card-btn:active {
        background: var(--accent);
      }
    }

    @media (max-width: 768px) {
      header h1 {
        font-size: 1.8em;
      }

      .filter-group {
        flex-direction: column;
      }

      input[type="number"],
      input[type="text"],
      select {
        width: 100%;
      }

      table {
        font-size: 0.85em;
      }

      td, th {
        padding: 8px 10px;
      }

      tbody tr {
        height: 40px;
      }

      .tabs {
        overflow-x: hidden;
      }

      .tab-button {
        min-width: 0;
        flex: 1 1 0;
        flex-direction: column;
        gap: 3px;
        padding: 8px 2px 10px;
        height: auto;
        font-size: 0.62em;
        letter-spacing: 0.02em;
      }

      .tab-icon {
        font-size: 2em;
      }

      /* Mobile: nur Icons (+ Zähler) — Wörter komplett aus, Platz fürs Wesentliche */
      .tw-long,
      .tw-short {
        display: none;
      }

      .research-buttons {
        flex-direction: column;
        gap: 4px;
      }

      .research-btn {
        width: 100%;
        text-align: center;
        padding: 8px 6px;
      }

      .score-bar {
        font-size: 0.75em;
        height: 20px;
        line-height: 20px;
      }

      .tooltip {
        width: 160px;
        font-size: 0.7em;
      }

      th {
        font-size: 0.75em;
      }
    }

    @media (max-width: 480px) {
      body {
        padding: 10px;
      }

      header {
        padding: 30px 15px;
      }

      header h1 {
        font-size: 1.5em;
      }

      .controls {
        padding: 15px;
      }

      .search-section {
        padding: 15px;
      }

      .tab-content {
        padding: 15px;
      }

      table {
        font-size: 0.75em;
      }

      td, th {
        padding: 6px 8px;
      }

      tbody tr {
        height: 36px;
      }

      .cards-grid {
        grid-template-columns: 1fr;
      }

      .mobile-card-fields {
        grid-template-columns: 1fr;
      }
    }

    /* Mein Kader (Watchlist) */
    #kaderCount {
      pointer-events: none;
      opacity: 0.85;
      font-weight: 400;
    }

    .kader-toggle {
      align-self: flex-start;
      background: transparent;
      color: var(--accent);
      border: 1px solid var(--accent);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 0.85em;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }

    .kader-toggle:hover {
      background: rgba(62, 156, 118, 0.12);
    }

    .kader-toggle.active {
      background: var(--accent);
      color: #fff;
    }

    .kader-toggle-compact {
      padding: 4px 9px;
      font-size: 1.05em;
      line-height: 1;
      margin-right: 6px;
    }

    .kader-signal {
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 0.9em;
      font-weight: 600;
      text-align: center;
    }

    .kader-signal.positive {
      background: rgba(76, 175, 125, 0.15);
      color: var(--positive);
    }

    .kader-signal.negative {
      background: rgba(224, 102, 95, 0.15);
      color: var(--negative);
    }

    .kader-signal.neutral {
      background: var(--bg-row-alt);
      color: var(--text-secondary);
    }

    .kader-empty {
      display: none;
      padding: 40px 20px;
      text-align: center;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    /* Legende / Kennzahl-Erklärungen (funktioniert auf Desktop + Handy) */
    .legend {
      margin: 0 20px 16px;
      background: var(--bg-row-alt);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    .legend > summary {
      padding: 12px 16px;
      cursor: pointer;
      font-weight: 600;
      color: var(--accent);
      list-style: none;
      user-select: none;
    }
    .legend > summary::-webkit-details-marker { display: none; }
    .legend[open] > summary { border-bottom: 1px solid var(--border); }
    .legend-body {
      padding: 12px 16px;
      font-size: 0.9em;
      line-height: 1.5;
      color: var(--text-secondary);
    }
    .legend-body p { margin-bottom: 8px; }
    .legend-body p:last-child { margin-bottom: 0; }
    .legend-body strong { color: var(--text-primary); }
    .legend-body .pos { color: var(--positive); }
    .legend-body .neg { color: var(--negative); }

    /* Vereins-Badges (Kürzel in Vereinsfarben) */
    .club-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 34px;
      height: 20px;
      padding: 0 5px;
      margin-right: 7px;
      border-radius: 5px;
      font-size: 0.72em;
      font-weight: 800;
      letter-spacing: 0.4px;
      vertical-align: middle;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Comunio-Scout</h1>
      <p>Daten: stats.comunio.de</p>
    </header>

    <div class="search-section">
      <input type="text" id="playerSearch" placeholder="Spieler suchen (alle ~` + totalPlayersEstimate + `) …">
    </div>

    <div class="controls">
      <div class="filter-group">
        <label for="budgetFilter">Max. Marktwert (Mio):</label>
        <input type="text" inputmode="decimal" id="budgetFilter" placeholder="Leer = kein Limit">
      </div>
    </div>

    <details class="legend">
      <summary>ℹ️ Was bedeuten die Werte?</summary>
      <div class="legend-body">
        <p><strong>Geheimtipp-Score (0–100)</strong> — Mischung aus „Punkte pro Mio" und Marktwert-Momentum, je zur Hälfte. Höher = besserer Kauftipp. Relativ skaliert: der aktuell beste Kandidat hat 100.</p>
        <p><strong>⚠️ Wichtig:</strong> Der Score kennt keine Transfer-News. Ein Marktwert kann auch <em>wegen</em> Wechselgerüchten steigen — verlässt der Spieler die Liga, ist er weg. Vor dem Kauf kurz den <strong>News</strong>-Button prüfen.</p>
        <p><strong>Marktwert</strong> — aktueller Comunio-Wert des Spielers.</p>
        <p><strong>Punkte/Mio</strong> — Comunio-Punkte je Mio Marktwert. Hoch = viel Leistung fürs Geld.</p>
        <p><strong>Punkte · Punkte/Spiel · Einsätze</strong> — Saison-Ausbeute (Tab Schnäppchen).</p>
        <p><strong>🚀 Momentum · Veränderung</strong> — Marktwert-Trend im gewählten Zeitraum (Tab 🚀). <span class="pos">Grün = steigt</span>, <span class="neg">Rot = fällt</span>.</p>
        <p><strong>📰 News-Marker</strong> — mindestens 3 Transfer-Schlagzeilen zu diesem Spieler in den letzten 3 Tagen (Google News). Marktwert-Sprünge haben oft hier ihre Ursache — Finger drauf/Maus drüber zeigt die neueste Schlagzeile.</p>
        <p><strong>Verlauf (Sparkline)</strong> — Marktwert-Kurve der letzten Tage aus dem täglichen Snapshot (erscheint auf der Detailkarte, sobald mindestens 2 Tage vorliegen). <span class="pos">Grün = insgesamt gestiegen</span>, <span class="neg">Rot = gefallen</span>.</p>
        <p><strong>⭐ Mein Kader</strong> — Spieler merken; im Tab „Mein Kader" siehst du gebündelt ihren Marktwert-Trend.</p>
        <p><strong>Suche</strong> — Die Suche kennt den kompletten Liga-Kader (auch Spieler ohne Top-Listen-Platz — dort fehlen dann Trend-Daten).</p>
        <p><strong>Recherche-Buttons</strong> — <strong>News</strong> (Google News, letzte 24 h), <strong>kicker</strong> (direkte Spielerseite, wo der Name bekannt ist) und <strong>TM</strong> (Transfermarkt-Schnellsuche).</p>
        <p><strong>Neuzugänge</strong> — Spieler, die Comunio neu in die Liga aufgenommen hat — oft noch günstig, früh beobachten. Abgänge sind aus der Liga entfernt.</p>
      </div>
    </details>

    <div id="searchResultsArea" class="search-results">
      <div id="searchResultsGrid" class="cards-grid"></div>
    </div>

    <div id="tabsArea">
      <div class="tabs">
      <button class="tab-button active" data-tab="momentum" title="Momentum" aria-label="Momentum"><span class="tab-icon">🚀</span><span class="tab-word"><span class="tw-long">Momentum</span><span class="tw-short">Trend</span></span></button>
      <button class="tab-button" data-tab="geheimtipps" title="Geheimtipps" aria-label="Geheimtipps"><span class="tab-icon">💎</span><span class="tab-word"><span class="tw-long">Geheimtipps</span><span class="tw-short">Tipps</span></span></button>
      <button class="tab-button" data-tab="value-picks" title="Schnäppchen" aria-label="Schnäppchen"><span class="tab-icon">💰</span><span class="tab-word"><span class="tw-long">Schnäppchen</span><span class="tw-short">Schnäpp.</span></span></button>
      <button class="tab-button" data-tab="mein-kader" title="Mein Kader" aria-label="Mein Kader"><span class="tab-icon">⭐</span><span class="tab-word"><span class="tw-long">Mein Kader</span><span class="tw-short">Kader</span> <span id="kaderCount">(0)</span></span></button>
      <button class="tab-button" data-tab="neuzugaenge" title="Neuzugänge" aria-label="Neuzugänge"><span class="tab-icon">🆕</span><span class="tab-word"><span class="tw-long">Neuzugänge</span><span class="tw-short">Neu</span> <span id="neuCount">(` + transfers.zugaenge.length + `)</span></span></button>
    </div>

    <div id="geheimtipps" class="tab-content">
      <table id="geheimtippsTable">
        <thead>
          <tr>
            <th class="sortable">Spieler</th>
            <th class="sortable">Verein</th>
            <th class="sortable numeric">Marktwert<span class="info-icon">i<span class="tooltip">Aktueller Comunio-Marktwert.</span></span></th>
            <th class="sortable numeric">Punkte/Mio<span class="info-icon">i<span class="tooltip">Comunio-Punkte pro Mio Marktwert — Leistung fürs Geld. Hoch = günstig-stark.</span></span></th>
            <th class="sortable numeric">Trend %<span class="info-icon">i<span class="tooltip">Marktwert-Veränderung im gewählten Zeitraum. Grün steigt, Rot fällt.</span></span></th>
            <th class="sortable numeric">Score<span class="info-icon">i<span class="tooltip">Geheimtipp-Score 0-100: kombiniert Marktwert-Momentum und Punkte-pro-Mio. Höher = besserer Kauftipp.</span></span></th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <div id="geheimtippsMobileCards"></div>
      <div class="stats-summary" id="geheimtippsStats"></div>
    </div>

    <div id="momentum" class="tab-content active">
      <div class="momentum-controls">
        <label for="periodSelector">Zeitraum:</label>
        <select id="periodSelector">
          <option value="vortag">Zum Vortag</option>
          <option value="vorwoche">Zur Vorwoche</option>
          <option value="vormonat">Zum Vormonat</option>
        </select>
        <label for="directionSelector">Zeigen:</label>
        <select id="directionSelector">
          <option value="alle">Alle</option>
          <option value="steiger">Nur Steiger</option>
          <option value="faller">Nur Faller</option>
        </select>
      </div>
      <table id="momentumTable">
        <thead>
          <tr>
            <th class="sortable">Spieler</th>
            <th class="sortable">Verein</th>
            <th class="sortable numeric">Marktwert<span class="info-icon">i<span class="tooltip">Aktueller Comunio-Marktwert.</span></span></th>
            <th class="sortable numeric">Veränderung (abs)<span class="info-icon">i<span class="tooltip">Marktwert-Veränderung im gewählten Zeitraum. Grün steigt, Rot fällt.</span></span></th>
            <th class="sortable numeric">Veränderung (%)<span class="info-icon">i<span class="tooltip">Prozentuale Marktwert-Veränderung.</span></span></th>
            <th>Tendenz</th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <div id="momentumMobileCards"></div>
      <div class="stats-summary" id="momentumStats"></div>
    </div>

    <div id="value-picks" class="tab-content">
      <div class="value-controls">
        <label>
          <input type="checkbox" id="keeperToggle"> Torhüter ausblenden
        </label>
      </div>
      <table id="valueTable">
        <thead>
          <tr>
            <th class="sortable">Spieler</th>
            <th class="sortable">Verein</th>
            <th class="sortable numeric">Marktwert<span class="info-icon">i<span class="tooltip">Aktueller Comunio-Marktwert.</span></span></th>
            <th class="sortable numeric">Punkte<span class="info-icon">i<span class="tooltip">Gesammelte Comunio-Punkte diese Saison.</span></span></th>
            <th class="sortable numeric">Einsätze<span class="info-icon">i<span class="tooltip">Spiele mit Einsatz diese Saison.</span></span></th>
            <th class="sortable numeric">Punkte/Spiel<span class="info-icon">i<span class="tooltip">Durchschnittliche Punkte pro Einsatz — fairer als Gesamtpunkte bei wenigen Spielen.</span></span></th>
            <th class="sortable numeric">Punkte/Mio<span class="info-icon">i<span class="tooltip">Comunio-Punkte pro Mio Marktwert — Leistung fürs Geld. Hoch = günstig-stark.</span></span></th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <div id="value-picksMobileCards"></div>
      <div class="stats-summary" id="valueStats"></div>
    </div>

    <div id="mein-kader" class="tab-content">
      <div id="meinKaderEmpty" class="kader-empty">
        Noch keine Spieler im Kader.<br>
        Such oben einen Spieler und tippe auf „☆ Zum Kader", um ihn hier zu sammeln.
      </div>
      <div id="meinKaderGrid" class="cards-grid"></div>
      <div class="stats-summary" id="meinKaderStats"></div>
    </div>

    <div id="neuzugaenge" class="tab-content">
      <p style="margin: 0 0 14px 0; font-size: 0.9em;">Ganze Liga im Blick: <a href="https://www.kicker.de/fussball/transfermarkt" target="_blank" rel="noopener" style="color: var(--accent);">kicker Transfer-Ticker ↗</a> · <a href="https://www.transfermarkt.de/1-bundesliga/transfers/wettbewerb/L1" target="_blank" rel="noopener" style="color: var(--accent);">Transfermarkt Bundesliga ↗</a> — alle aktuellen Wechsel und Gerüchte.</p>
      <h3 style="padding: 0 0 16px 0; border-bottom: 1px solid var(--border); color: var(--accent); margin-bottom: 20px;">Zugänge — neu in der Liga</h3>
      <table id="transfersZugaengeTable">
        <thead>
          <tr>
            <th class="sortable">Datum</th>
            <th class="sortable">Spieler</th>
            <th class="sortable">Pos.</th>
            <th class="sortable">Club</th>
            <th class="sortable numeric">Marktwert</th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <div id="transfers-zugaengeMobileCards"></div>
      <div class="stats-summary" id="transfersZugaengeStats"></div>

      <h3 style="padding: 20px 0 16px 0; border-bottom: 1px solid var(--border); color: var(--accent); margin-bottom: 20px; margin-top: 20px;">Abgänge — nicht mehr in der Liga</h3>
      <table id="transfersAbgaengeTable">
        <thead>
          <tr>
            <th class="sortable">Datum</th>
            <th class="sortable">Spieler</th>
            <th class="sortable">Pos.</th>
            <th class="sortable">Club</th>
            <th class="sortable numeric">Marktwert</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <div id="transfers-abgaengeMobileCards"></div>
      <div class="stats-summary" id="transfersAbgaengeStats"></div>
    </div>
    </div>
  </div>

  <script>
    window.PLAYERS = ` + JSON.stringify(players).replace(/</g, '\\u003c') + `;
    window.KADER = ` + JSON.stringify(kader).replace(/</g, '\\u003c') + `;
    window.NEWS = ` + JSON.stringify(newsData.news).replace(/</g, '\\u003c') + `;
    window.HISTORY = ` + JSON.stringify(history).replace(/</g, '\\u003c') + `;
    window.FULLNAMES = ` + JSON.stringify(fullnames).replace(/</g, '\\u003c') + `;
    window.CLUB_SHORT_CODES = ` + JSON.stringify(CLUB_SHORT_CODES).replace(/</g, '\\u003c') + `;
    window.CLUB_BADGES = ` + JSON.stringify(CLUB_BADGES).replace(/</g, '\\u003c') + `;
    window.TRANSFERS = ` + JSON.stringify(transfers).replace(/</g, '\\u003c') + `;
  </script>

  <script>
    let currentSortColumn = null;
    let currentSortAsc = true;
    let currentTab = 'momentum';
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('DOMContentLoaded', function() {
      setupTabs();
      setupFilters();
      setupSwipeGestures();
      setupTooltips();
      renderMomentumTable();
      updateKaderCount();
    });

    function setupTooltips() {
      var infoIcons = document.querySelectorAll('.info-icon');
      infoIcons.forEach(function(icon) {
        icon.addEventListener('click', function(e) {
          e.stopPropagation();
          infoIcons.forEach(function(i) { i.classList.remove('active'); });
          icon.classList.add('active');
        });
      });
      document.addEventListener('click', function() {
        infoIcons.forEach(function(i) { i.classList.remove('active'); });
      });
    }

    function setupSwipeGestures() {
      var tabs = document.querySelectorAll('.tabs');
      tabs.forEach(function(tab) {
        tab.addEventListener('touchstart', function(e) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }, false);

        tab.addEventListener('touchend', function(e) {
          var touchEndX = e.changedTouches[0].clientX;
          var touchEndY = e.changedTouches[0].clientY;
          var diffX = touchStartX - touchEndX;
          var diffY = Math.abs(touchStartY - touchEndY);

          if (Math.abs(diffX) > 50 && Math.abs(diffX) > diffY) {
            var tabButtons = document.querySelectorAll('.tab-button');
            var currentIdx = -1;
            tabButtons.forEach(function(btn, idx) {
              if (btn.classList.contains('active')) {
                currentIdx = idx;
              }
            });

            if (diffX > 0 && currentIdx < tabButtons.length - 1) {
              tabButtons[currentIdx + 1].click();
            } else if (diffX < 0 && currentIdx > 0) {
              tabButtons[currentIdx - 1].click();
            }
          }
        }, false);
      });
    }

    function setupTabs() {
      var buttons = document.querySelectorAll('.tab-button');
      buttons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          var allButtons = document.querySelectorAll('.tab-button');
          allButtons.forEach(function(b) { b.classList.remove('active'); });
          var allContents = document.querySelectorAll('.tab-content');
          allContents.forEach(function(c) { c.classList.remove('active'); });
          currentTab = btn.getAttribute('data-tab');
          btn.classList.add('active');
          document.getElementById(currentTab).classList.add('active');
          currentSortColumn = null;
          if (currentTab === 'geheimtipps') {
            renderGeheimtippsTable();
          } else if (currentTab === 'momentum') {
            renderMomentumTable();
          } else if (currentTab === 'value-picks') {
            renderValueTable();
          } else if (currentTab === 'mein-kader') {
            renderMeinKaderTable();
          } else if (currentTab === 'neuzugaenge') {
            renderTransfersTable();
          }
        });
      });
    }

    function setupFilters() {
      document.getElementById('budgetFilter').addEventListener('input', function() {
        if (currentTab === 'geheimtipps') {
          renderGeheimtippsTable();
        } else if (currentTab === 'momentum') {
          renderMomentumTable();
        } else if (currentTab === 'value-picks') {
          renderValueTable();
        } else if (currentTab === 'mein-kader') {
          renderMeinKaderTable();
        } else if (currentTab === 'neuzugaenge') {
          renderTransfersTable();
        }
      });
      document.getElementById('periodSelector').addEventListener('change', renderMomentumTable);
      document.getElementById('directionSelector').addEventListener('change', renderMomentumTable);
      document.getElementById('keeperToggle').addEventListener('change', renderValueTable);
      document.getElementById('playerSearch').addEventListener('input', handleSearch);
    }

    function handleSearch() {
      var query = document.getElementById('playerSearch').value.toLowerCase().trim();
      var searchArea = document.getElementById('searchResultsArea');
      var tabsArea = document.getElementById('tabsArea');

      if (query.length === 0) {
        searchArea.classList.remove('active');
        tabsArea.style.display = 'block';
        return;
      }

      // STEP 1: Get PLAYERS results (top lists)
      var playersResults = window.PLAYERS.filter(function(p) {
        return p.spieler.toLowerCase().indexOf(query) !== -1;
      });

      // Track unique players by name+club (lowercase) — name alone would
      // merge namesakes playing for different clubs.
      var dedupKey = function(p) {
        return p.spieler.toLowerCase() + '|' + (p.club || '').toLowerCase();
      };
      var allResultsByName = {};
      playersResults.forEach(function(p) {
        allResultsByName[dedupKey(p)] = p;
      });

      // STEP 2: Get KADER results not in PLAYERS
      var kaderResults = (window.KADER && window.KADER.spieler || []).filter(function(k) {
        return k.spieler && k.spieler.toLowerCase().indexOf(query) !== -1;
      }).filter(function(k) {
        return !allResultsByName[dedupKey(k)]; // Not in PLAYERS
      }).map(function(k) {
        var result = normalizeKaderPlayer(k);
        allResultsByName[dedupKey(k)] = result;
        return result;
      });

      // STEP 3: Get TRANSFERS Zugänge not in PLAYERS or KADER
      var transfersZugaenge = ((window.TRANSFERS && window.TRANSFERS.zugaenge) || []).filter(function(t) {
        return t.spieler && t.spieler.toLowerCase().indexOf(query) !== -1;
      });

      var transfersResults = transfersZugaenge.filter(function(t) {
        return !allResultsByName[dedupKey(t)]; // Not in PLAYERS or KADER
      }).map(function(t) {
        return {
          spieler: t.spieler,
          club: t.club || 'N/A',
          marktwert: t.marktwert,
          punkte: null,
          einsaetze: null,
          punkteProSpiel: null,
          punkteProMio: null,
          veraenderung: null,
          geheimtippScore: null,
          istTorhueter: t.position === 'Torwart',
          istNeuzugang: true,
          position: t.position,
          datum: t.datum
        };
      });

      // STEP 4: Check if any KADER-Treffer is also in TRANSFERS.zugaenge
      transfersZugaenge.forEach(function(t) {
        var key = dedupKey(t);
        if (allResultsByName[key] && allResultsByName[key].position && !allResultsByName[key].istNeuzugang) {
          // This is a KADER player who is also a transfer
          allResultsByName[key].istNeuzugang = true;
          allResultsByName[key].datum = t.datum;
        }
      });

      // Combine all results
      var allResults = playersResults.concat(kaderResults).concat(transfersResults);

      renderDetailCards(allResults);
      searchArea.classList.add('active');
      tabsArea.style.display = 'none';
    }

    function normalizeKaderPlayer(k) {
      var result = {
        spieler: k.spieler,
        club: k.club,
        marktwert: k.marktwert || null,
        punkte: k.punkte !== undefined ? k.punkte : null,
        einsaetze: k.einsaetze !== undefined ? k.einsaetze : null,
        punkteProSpiel: k.punkteProSpiel !== undefined ? k.punkteProSpiel : null,
        punkteProMio: null,
        veraenderung: null,
        geheimtippScore: null,
        istTorhueter: k.position === 'Torwart',
        position: k.position || null,
        datum: null
      };
      if (result.punkte !== null && result.marktwert !== null && result.marktwert > 0) {
        var mio = result.marktwert / 1000000;
        result.punkteProMio = Math.round((result.punkte / mio) * 10) / 10;
      }
      return result;
    }

    function makeNewsMarker(p) {
      var n = window.NEWS && window.NEWS[p.spieler + '|' + p.club];
      if (!n || n.count < 3) return null;
      var marker = document.createElement('span');
      marker.textContent = ' 📰';
      marker.className = 'news-marker';
      marker.title = n.count + ' Transfer-News in 3 Tagen — neueste: ' + n.latestTitle + (n.latestSource ? ' (' + n.latestSource + ')' : '');
      return marker;
    }

    // Inline SVG sparkline of a player's market value over the last snapshots.
    // Built via createElementNS (no innerHTML) so it stays XSS-safe.
    function makeSparkline(p) {
      var s = window.HISTORY && window.HISTORY[p.spieler + '|' + p.club];
      if (!s || s.length < 2) return null;

      var vals = s.map(function(pt) { return pt.v; });
      var min = Math.min.apply(null, vals);
      var max = Math.max.apply(null, vals);
      var W = 150, H = 34, PAD = 3;
      var span = (max - min) || 1;
      var n = vals.length;
      var pts = vals.map(function(v, i) {
        var x = PAD + (i / (n - 1)) * (W - 2 * PAD);
        var y = H - PAD - ((v - min) / span) * (H - 2 * PAD);
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');

      var up = vals[n - 1] >= vals[0];
      var color = up ? 'var(--positive)' : 'var(--negative)';
      var NS = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      svg.setAttribute('class', 'sparkline');
      var poly = document.createElementNS(NS, 'polyline');
      poly.setAttribute('points', pts);
      poly.setAttribute('fill', 'none');
      poly.setAttribute('stroke', color);
      poly.setAttribute('stroke-width', '1.5');
      poly.setAttribute('stroke-linejoin', 'round');
      poly.setAttribute('stroke-linecap', 'round');
      svg.appendChild(poly);
      var last = document.createElementNS(NS, 'circle');
      var lastPt = pts.split(' ').pop().split(',');
      last.setAttribute('cx', lastPt[0]);
      last.setAttribute('cy', lastPt[1]);
      last.setAttribute('r', '2');
      last.setAttribute('fill', color);
      svg.appendChild(last);

      var wrap = document.createElement('div');
      wrap.className = 'card-field';
      var label = document.createElement('div');
      label.className = 'card-field-label';
      label.textContent = 'Verlauf (' + n + ' Tage)';
      wrap.appendChild(label);
      wrap.appendChild(svg);
      return wrap;
    }

    function renderDetailCards(players, gridId, showSignal) {
      var grid = document.getElementById(gridId || 'searchResultsGrid');
      grid.innerHTML = '';

      if (players.length === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.textContent = 'Keine Spieler gefunden';
        emptyDiv.style.gridColumn = '1 / -1';
        emptyDiv.style.padding = '40px 20px';
        grid.appendChild(emptyDiv);
        return;
      }

      players.forEach(function(p) {
        var card = document.createElement('div');
        card.className = 'card';

        var header = document.createElement('div');
        header.className = 'card-header';
        var name = document.createElement('div');
        name.className = 'card-name';
        name.textContent = p.spieler;
        var cardNews = makeNewsMarker(p);
        if (cardNews) name.appendChild(cardNews);
        var club = document.createElement('div');
        club.className = 'card-club';
        club.appendChild(makeClubBadge(p.club));
        club.appendChild(document.createTextNode(p.club));
        header.appendChild(name);
        header.appendChild(club);
        card.appendChild(header);

        card.appendChild(makeKaderToggle(p, false));

        if (p.istNeuzugang) {
          var neuBadge = document.createElement('div');
          neuBadge.textContent = 'NEUZUGANG' + (p.datum ? ' · seit ' + p.datum : '');
          neuBadge.style.color = 'var(--positive)';
          neuBadge.style.fontSize = '11px';
          neuBadge.style.fontWeight = '700';
          neuBadge.style.letterSpacing = '0.08em';
          neuBadge.style.margin = '6px 0';
          card.appendChild(neuBadge);
        }

        if (showSignal) {
          var signal = getKaderSignal(p);
          var signalEl = document.createElement('div');
          signalEl.className = 'kader-signal ' + signal.className;
          signalEl.textContent = signal.text;
          card.appendChild(signalEl);
        }

        var fields = document.createElement('div');
        fields.className = 'card-fields';

        fields.appendChild(createCardField('Marktwert', formatMarktwert(p.marktwert)));
        if (p.position) {
          fields.appendChild(createCardField('Position', p.position));
        }
        fields.appendChild(createCardField('Punkte', String(p.punkte !== undefined && p.punkte !== null ? p.punkte : 'N/A')));
        fields.appendChild(createCardField('Einsätze', String(p.einsaetze || 'N/A')));
        fields.appendChild(createCardField('Punkte/Spiel', p.punkteProSpiel !== null ? p.punkteProSpiel.toFixed(2).replace('.', ',') : 'N/A'));
        fields.appendChild(createCardField('Punkte/Mio', p.punkteProMio !== null ? p.punkteProMio.toFixed(1).replace('.', ',') : 'N/A'));

        if (p.veraenderung) {
          var vortag = p.veraenderung.vortag;
          var vorwoche = p.veraenderung.vorwoche;
          var vormonat = p.veraenderung.vormonat;
          if (vortag) {
            var vtagVal = createTrendDisplay(vortag.prozent);
            fields.appendChild(createCardField('Trend Vortag', vtagVal.text, vtagVal.className));
          }
          if (vorwoche) {
            var vwoVal = createTrendDisplay(vorwoche.prozent);
            fields.appendChild(createCardField('Trend Vorwoche', vwoVal.text, vwoVal.className));
          }
          if (vormonat) {
            var vmoVal = createTrendDisplay(vormonat.prozent);
            fields.appendChild(createCardField('Trend Vormonat', vmoVal.text, vmoVal.className));
          }
        }

        if (p.geheimtippScore !== null) {
          fields.appendChild(createCardField('Score', String(p.geheimtippScore.toFixed(1))));
        }

        fields.appendChild(createCardField('Torhüter', String(p.istTorhueter ? 'Ja' : 'Nein')));

        var spark = makeSparkline(p);
        if (spark) fields.appendChild(spark);

        card.appendChild(fields);

        if (p.geheimtippScore !== null) {
          var scoreBar = document.createElement('div');
          scoreBar.className = 'card-score-bar ' + getScoreBarClass(p.geheimtippScore);
          scoreBar.textContent = 'Geheimtipp-Score ' + p.geheimtippScore.toFixed(1);
          card.appendChild(scoreBar);
        }

        var buttons = document.createElement('div');
        buttons.className = 'card-research-buttons';
        buttons.innerHTML = createResearchButtons(p.spieler, p.club);
        card.appendChild(buttons);

        grid.appendChild(card);
      });
    }

    function createCardField(label, value, className) {
      var div = document.createElement('div');
      div.className = 'card-field';
      var labelEl = document.createElement('div');
      labelEl.className = 'card-field-label';
      labelEl.textContent = label;
      var valueEl = document.createElement('div');
      valueEl.className = 'card-field-value';
      if (className) valueEl.classList.add(className);
      if (typeof value === 'string') {
        valueEl.textContent = value;
      } else {
        valueEl.appendChild(value);
      }
      div.appendChild(labelEl);
      div.appendChild(valueEl);
      return div;
    }

    function createTrendDisplay(percent) {
      if (percent === null) return { text: 'N/A', className: 'neutral' };
      var sign = percent >= 0 ? '+' : '';
      var className = percent > 0 ? 'positive' : (percent < 0 ? 'negative' : 'neutral');
      return { text: sign + percent + '%', className: className };
    }

    function getBudgetLimit() {
      var raw = document.getElementById('budgetFilter').value.replace(',', '.').trim();
      var num = parseFloat(raw);
      return isNaN(num) ? null : num * 1000000;
    }

    function getPeriod() {
      return document.getElementById('periodSelector').value;
    }

    function getDirection() {
      var el = document.getElementById('directionSelector');
      return el ? el.value : 'alle';
    }

    function makeClubBadge(club) {
      var b = window.CLUB_BADGES[club];
      var span = document.createElement('span');
      span.className = 'club-badge';
      if (b) {
        span.textContent = b.kurz;
        span.style.background = b.bg;
        span.style.color = b.fg;
      } else {
        span.textContent = club.slice(0, 3).toUpperCase();
        span.style.background = 'var(--bg-row-alt)';
        span.style.color = 'var(--text-secondary)';
      }
      span.title = club;
      return span;
    }

    function fillClubCell(td, club) {
      td.appendChild(makeClubBadge(club));
      td.appendChild(document.createTextNode(club));
    }

    function hideKeepers() {
      return document.getElementById('keeperToggle').checked;
    }

    function filterByBudget(player, limit) {
      if (!limit) return true;
      return player.marktwert !== null && player.marktwert <= limit;
    }

    function formatMarktwert(mw) {
      if (mw === null) return 'N/A';
      return (mw / 1000000).toFixed(2).replace('.', ',') + ' M';
    }

    function formatChange(abs, pct) {
      if (abs === null) return 'N/A';
      var sign = abs >= 0 ? '+' : '';
      var pctStr = pct !== null ? ' (' + (pct >= 0 ? '+' : '') + pct + '%)' : '';
      return sign + (abs / 1000000).toFixed(2).replace('.', ',') + ' M' + pctStr;
    }

    function getLastNameFromFull(fullName) {
      var parts = fullName.trim().split(' ');
      return parts[parts.length - 1];
    }

    function createResearchButtons(spieler, club) {
      var lastName = getLastNameFromFull(spieler);
      var clubShort = window.CLUB_SHORT_CODES[club] || club;

      // Full name from Wikidata (if known) sharpens the news query and unlocks
      // a direct kicker player page. slug is pre-validated ASCII at build time.
      var fn = window.FULLNAMES && window.FULLNAMES[spieler + '|' + club];
      var newsTerm = (fn && fn.full) ? fn.full : (lastName + ' ' + club);

      var newsQuery = encodeURIComponent(newsTerm);
      var tmQuery = encodeURIComponent(lastName + ':' + clubShort);

      var html = '<div class="research-buttons">';
      html += '<a href="https://www.google.com/search?q=' + newsQuery + '&tbm=nws&tbs=qdr:d" target="_blank" rel="noopener" class="research-btn">News</a>';
      if (fn && fn.slug) {
        html += '<a href="https://www.kicker.de/' + fn.slug + '/spieler-news" target="_blank" rel="noopener" class="research-btn">kicker</a>';
      }
      html += '<a href="https://www.transfermarkt.de/schnellsuche/ergebnis/schnellsuche?query=' + tmQuery + '" target="_blank" rel="noopener" class="research-btn">TM</a>';
      html += '</div>';
      return html;
    }

    function getScoreBarClass(score) {
      if (score >= 80) return 'score-80-100';
      if (score >= 60) return 'score-60-80';
      if (score >= 40) return 'score-40-60';
      return 'score-0-40';
    }

    function setupTableSorting(tableId, renderFunc) {
      var table = document.getElementById(tableId);
      if (table.dataset.sortingSetup) return;
      table.dataset.sortingSetup = '1';
      var headers = table.querySelectorAll('th.sortable');
      headers.forEach(function(th, idx) {
        th.addEventListener('click', function() {
          if (currentSortColumn === idx) {
            currentSortAsc = !currentSortAsc;
          } else {
            currentSortColumn = idx;
            currentSortAsc = false;
          }
          var allHeaders = table.querySelectorAll('th');
          allHeaders.forEach(function(h) {
            h.classList.remove('sort-asc', 'sort-desc');
          });
          if (currentSortAsc) {
            th.classList.add('sort-asc');
          } else {
            th.classList.add('sort-desc');
          }
          renderFunc();
        });
      });
    }

    function renderGeheimtippsTable() {
      var budgetLimit = getBudgetLimit();
      var filtered = window.PLAYERS.filter(function(p) {
        if (!filterByBudget(p, budgetLimit)) return false;
        return p.geheimtippScore !== null;
      });
      filtered.sort(function(a, b) {
        return (b.geheimtippScore || 0) - (a.geheimtippScore || 0);
      });
      if (currentSortColumn !== null) {
        filtered.sort(function(a, b) {
          var aVal, bVal;
          if (currentSortColumn === 0) {
            aVal = a.spieler;
            bVal = b.spieler;
          } else if (currentSortColumn === 1) {
            aVal = a.club;
            bVal = b.club;
          } else if (currentSortColumn === 2) {
            aVal = a.marktwert || 0;
            bVal = b.marktwert || 0;
          } else if (currentSortColumn === 3) {
            aVal = a.punkteProMio || 0;
            bVal = b.punkteProMio || 0;
          } else if (currentSortColumn === 4) {
            var aTrend = a.usedTrend === 'vorwoche' ? (a.veraenderung.vorwoche ? a.veraenderung.vorwoche.prozent : 0) : (a.veraenderung.vortag ? a.veraenderung.vortag.prozent : 0);
            var bTrend = b.usedTrend === 'vorwoche' ? (b.veraenderung.vorwoche ? b.veraenderung.vorwoche.prozent : 0) : (b.veraenderung.vortag ? b.veraenderung.vortag.prozent : 0);
            aVal = aTrend;
            bVal = bTrend;
          } else if (currentSortColumn === 5) {
            aVal = a.geheimtippScore || 0;
            bVal = b.geheimtippScore || 0;
          } else {
            aVal = 0;
            bVal = 0;
          }
          if (typeof aVal === 'string') {
            return currentSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
          } else {
            return currentSortAsc ? (aVal - bVal) : (bVal - aVal);
          }
        });
      }
      var tbody = document.getElementById('geheimtippsTable').querySelector('tbody');
      tbody.innerHTML = '';
      if (filtered.length === 0) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.colSpan = '7';
        td.className = 'empty-state';
        td.textContent = 'Keine Spieler gefunden';
        tr.appendChild(td);
        tbody.appendChild(tr);
        document.getElementById('geheimtippsStats').textContent = '';
        renderMobileCards('geheimtipps', filtered);
        return;
      }
      filtered.forEach(function(p) {
        var tr = document.createElement('tr');
        var td1 = document.createElement('td');
        td1.textContent = p.spieler;
        var td1News = makeNewsMarker(p);
        if (td1News) td1.appendChild(td1News);
        tr.appendChild(td1);
        var td2 = document.createElement('td');
        fillClubCell(td2, p.club);
        tr.appendChild(td2);
        var td3 = document.createElement('td');
        td3.className = 'numeric';
        td3.textContent = formatMarktwert(p.marktwert);
        tr.appendChild(td3);
        var td4 = document.createElement('td');
        td4.className = 'numeric';
        td4.textContent = p.punkteProMio !== null ? p.punkteProMio.toFixed(1).replace('.', ',') : 'N/A';
        tr.appendChild(td4);
        var td5 = document.createElement('td');
        td5.className = 'numeric';
        var trend = p.usedTrend === 'vorwoche' ? (p.veraenderung.vorwoche ? p.veraenderung.vorwoche.prozent : 0) : (p.veraenderung.vortag ? p.veraenderung.vortag.prozent : 0);
        td5.textContent = trend >= 0 ? '+' + trend + '%' : trend + '%';
        td5.className = 'numeric ' + (trend > 0 ? 'positive' : 'neutral');
        tr.appendChild(td5);
        var td6 = document.createElement('td');
        td6.className = 'score-cell';
        var scoreBar = document.createElement('div');
        scoreBar.className = 'score-bar ' + getScoreBarClass(p.geheimtippScore);
        scoreBar.textContent = p.geheimtippScore.toFixed(1);
        td6.appendChild(scoreBar);
        tr.appendChild(td6);
        var td7 = document.createElement('td');
        var researchHTML = createResearchButtons(p.spieler, p.club);
        td7.innerHTML = researchHTML;
        td7.insertBefore(makeKaderToggle(p, true), td7.firstChild);
        tr.appendChild(td7);
        tbody.appendChild(tr);
      });
      renderMobileCards('geheimtipps', filtered);
      setupTableSorting('geheimtippsTable', renderGeheimtippsTable);
      var total = window.PLAYERS.filter(function(p) { return p.geheimtippScore !== null; }).length;
      document.getElementById('geheimtippsStats').textContent = 'Zeige ' + filtered.length + ' von ' + total + ' Geheimtipps';
    }

    function renderMobileCards(viewType, players) {
      var mobileContainer = document.getElementById(viewType + 'MobileCards');
      if (!mobileContainer) return;
      mobileContainer.innerHTML = '';

      if (players.length === 0) {
        var none = document.createElement('div');
        none.className = 'empty-state';
        none.style.padding = '24px 12px';
        none.textContent = 'Keine Spieler im aktuellen Filter.';
        mobileContainer.appendChild(none);
        return;
      }

      var grid = document.createElement('div');
      grid.className = 'mobile-cards';

      players.forEach(function(p) {
        var card = document.createElement('div');
        card.className = 'mobile-card';

        var header = document.createElement('div');
        header.className = 'mobile-card-header';
        var name = document.createElement('div');
        name.className = 'mobile-card-name';
        if (viewType.indexOf('transfers') === 0) {
          var nameText = p.spieler;
          if (viewType === 'transfers-zugaenge' && p.tendenz === 'Aufsteigend') {
            nameText += ' ▲';
          }
          name.textContent = nameText;
        } else {
          name.textContent = p.spieler;
        }
        var mobileNews = makeNewsMarker(p);
        if (mobileNews) name.appendChild(mobileNews);
        var club = document.createElement('div');
        club.className = 'mobile-card-club';
        club.appendChild(makeClubBadge(p.club || 'N/A'));
        club.appendChild(document.createTextNode(p.club || 'N/A'));
        header.appendChild(name);
        header.appendChild(club);
        card.appendChild(header);

        var fields = document.createElement('div');
        fields.className = 'mobile-card-fields';

        if (viewType === 'geheimtipps') {
          addMobileField(fields, 'Score', p.geheimtippScore.toFixed(1), 'numeric');
          addMobileField(fields, 'Marktwert', formatMarktwert(p.marktwert), 'numeric');
          addMobileField(fields, 'Punkte/Mio', p.punkteProMio !== null ? p.punkteProMio.toFixed(1).replace('.', ',') : 'N/A', 'numeric');
          var trend = p.usedTrend === 'vorwoche' ? (p.veraenderung.vorwoche ? p.veraenderung.vorwoche.prozent : 0) : (p.veraenderung.vortag ? p.veraenderung.vortag.prozent : 0);
          var trendClass = trend > 0 ? 'positive' : 'neutral';
          addMobileField(fields, 'Woche %', trend >= 0 ? '+' + trend + '%' : trend + '%', trendClass);
        } else if (viewType === 'momentum') {
          var period = getPeriod();
          var change = p.veraenderung[period];
          addMobileField(fields, 'Marktwert', formatMarktwert(p.marktwert), 'numeric');
          var changeClass = change.abs > 0 ? 'positive' : (change.abs < 0 ? 'negative' : 'neutral');
          addMobileField(fields, 'Veränderung (abs)', formatChange(change.abs, null), changeClass);
          addMobileField(fields, 'Veränderung (%)', change.prozent !== null ? (change.prozent >= 0 ? '+' : '') + change.prozent + '%' : 'N/A', changeClass);
        } else if (viewType === 'value-picks') {
          addMobileField(fields, 'Marktwert', formatMarktwert(p.marktwert), 'numeric');
          addMobileField(fields, 'Punkte/Mio', p.punkteProMio !== null ? p.punkteProMio.toFixed(1).replace('.', ',') : 'N/A', 'numeric');
          addMobileField(fields, 'Punkte/Spiel', p.punkteProSpiel !== null ? p.punkteProSpiel.toFixed(2).replace('.', ',') : 'N/A', 'numeric');
          addMobileField(fields, 'Punkte', p.punkte, 'numeric');
        } else if (viewType === 'transfers-zugaenge' || viewType === 'transfers-abgaenge') {
          addMobileField(fields, 'Datum', p.datum, '');
          addMobileField(fields, 'Pos.', getPositionLabel(p.position), '');
          addMobileField(fields, 'Marktwert', formatMarktwert(p.marktwert), 'numeric');
        }

        card.appendChild(fields);

        if (p.geheimtippScore !== null && viewType === 'geheimtipps') {
          var scoreBar = document.createElement('div');
          scoreBar.className = 'mobile-score-bar ' + getScoreBarClass(p.geheimtippScore);
          scoreBar.textContent = 'Geheimtipp-Score ' + p.geheimtippScore.toFixed(1);
          card.appendChild(scoreBar);
        }

        var buttons = document.createElement('div');
        buttons.className = 'mobile-card-buttons';
        if (viewType === 'transfers-zugaenge') {
          var researchHTML = createResearchButtons(p.spieler, p.club || 'N/A');
          buttons.innerHTML = researchHTML.replace('research-buttons', 'mobile-card-buttons').replace(/research-btn/g, 'mobile-card-btn');
        } else if (viewType !== 'transfers-abgaenge') {
          var researchHTML = createResearchButtons(p.spieler, p.club);
          buttons.innerHTML = researchHTML.replace('research-buttons', 'mobile-card-buttons').replace(/research-btn/g, 'mobile-card-btn');
          buttons.insertBefore(makeKaderToggle(p, true), buttons.firstChild);
        }
        if (buttons.innerHTML) {
          card.appendChild(buttons);
        }

        grid.appendChild(card);
      });

      mobileContainer.appendChild(grid);
    }

    function addMobileField(container, label, value, className) {
      var field = document.createElement('div');
      field.className = 'mobile-card-field';
      var labelEl = document.createElement('div');
      labelEl.className = 'mobile-card-label';
      labelEl.textContent = label;
      var valueEl = document.createElement('div');
      valueEl.className = 'mobile-card-value';
      if (className) valueEl.classList.add(className);
      valueEl.textContent = value;
      field.appendChild(labelEl);
      field.appendChild(valueEl);
      container.appendChild(field);
    }

    function getPositionLabel(position) {
      if (!position) return '—';
      var map = {
        'Torwart': 'TW',
        'Abwehr': 'ABW',
        'Mittelfeld': 'MF',
        'Sturm': 'ST'
      };
      return map[position] || '—';
    }

    function parseDatumDe(datumStr) {
      if (!datumStr) return new Date(0);
      var parts = datumStr.split('.');
      if (parts.length !== 3) return new Date(0);
      return new Date(parts[2] + '-' + parts[1] + '-' + parts[0]);
    }

    function renderTransfersTable() {
      var budgetLimit = getBudgetLimit();
      var zugaenge = (window.TRANSFERS.zugaenge || []).filter(function(t) {
        if (!budgetLimit) return true;
        return t.marktwert !== null && t.marktwert <= budgetLimit;
      });
      zugaenge.sort(function(a, b) {
        var dateA = parseDatumDe(a.datum);
        var dateB = parseDatumDe(b.datum);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateB.getTime() - dateA.getTime();
        }
        return (b.marktwert || 0) - (a.marktwert || 0);
      });

      var abgaenge = (window.TRANSFERS.abgaenge || []);
      abgaenge.sort(function(a, b) {
        var dateA = parseDatumDe(a.datum);
        var dateB = parseDatumDe(b.datum);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateB.getTime() - dateA.getTime();
        }
        return (b.marktwert || 0) - (a.marktwert || 0);
      });

      function applyColumnSort(list) {
        if (currentSortColumn === null) return;
        list.sort(function(a, b) {
          var aVal, bVal;
          if (currentSortColumn === 0) {
            aVal = parseDatumDe(a.datum).getTime();
            bVal = parseDatumDe(b.datum).getTime();
          } else if (currentSortColumn === 1) {
            aVal = a.spieler || '';
            bVal = b.spieler || '';
          } else if (currentSortColumn === 2) {
            aVal = a.position || '';
            bVal = b.position || '';
          } else if (currentSortColumn === 3) {
            aVal = a.club || '';
            bVal = b.club || '';
          } else if (currentSortColumn === 4) {
            aVal = a.marktwert || 0;
            bVal = b.marktwert || 0;
          } else {
            return 0;
          }
          if (typeof aVal === 'string') {
            return currentSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
          }
          return currentSortAsc ? (aVal - bVal) : (bVal - aVal);
        });
      }
      applyColumnSort(zugaenge);
      applyColumnSort(abgaenge);

      // Render Zugänge table
      var tBodyZ = document.getElementById('transfersZugaengeTable').querySelector('tbody');
      tBodyZ.innerHTML = '';
      if (zugaenge.length === 0) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.colSpan = '6';
        td.className = 'empty-state';
        td.textContent = 'Keine Zugänge im aktuellen Filter.';
        tr.appendChild(td);
        tBodyZ.appendChild(tr);
        document.getElementById('transfersZugaengeStats').textContent = '';
        renderMobileCards('transfers-zugaenge', zugaenge);
      } else {
        zugaenge.forEach(function(t) {
          var tr = document.createElement('tr');

          var td1 = document.createElement('td');
          td1.textContent = t.datum;
          tr.appendChild(td1);

          var td2 = document.createElement('td');
          var nameSpan = document.createElement('span');
          nameSpan.textContent = t.spieler;
          td2.appendChild(nameSpan);
          if (t.tendenz === 'Aufsteigend') {
            var trendSpan = document.createElement('span');
            trendSpan.textContent = ' ▲';
            trendSpan.title = 'Comunio-Tendenz: Aufsteigend';
            trendSpan.style.color = 'var(--positive)';
            trendSpan.style.marginLeft = '4px';
            td2.appendChild(trendSpan);
          }
          tr.appendChild(td2);

          var td3 = document.createElement('td');
          td3.textContent = getPositionLabel(t.position);
          td3.title = t.position || 'Unbekannt';
          tr.appendChild(td3);

          var td4 = document.createElement('td');
          fillClubCell(td4, t.club || 'N/A');
          tr.appendChild(td4);

          var td5 = document.createElement('td');
          td5.className = 'numeric';
          td5.textContent = formatMarktwert(t.marktwert);
          tr.appendChild(td5);

          var td6 = document.createElement('td');
          td6.innerHTML = createResearchButtons(t.spieler, t.club || 'N/A');
          tr.appendChild(td6);

          tBodyZ.appendChild(tr);
        });
        renderMobileCards('transfers-zugaenge', zugaenge);
        setupTableSorting('transfersZugaengeTable', renderTransfersTable);
        document.getElementById('transfersZugaengeStats').textContent = 'Zeige ' + zugaenge.length + ' Zugänge' + (budgetLimit ? ' (gefiltert)' : '');
      }

      // Render Abgänge table
      var tBodyA = document.getElementById('transfersAbgaengeTable').querySelector('tbody');
      tBodyA.innerHTML = '';
      if (abgaenge.length === 0) {
        var tr2 = document.createElement('tr');
        var td2 = document.createElement('td');
        td2.colSpan = '5';
        td2.className = 'empty-state';
        td2.textContent = 'Keine Abgänge.';
        tr2.appendChild(td2);
        tBodyA.appendChild(tr2);
        document.getElementById('transfersAbgaengeStats').textContent = '';
        renderMobileCards('transfers-abgaenge', abgaenge);
      } else {
        abgaenge.forEach(function(t) {
          var tr = document.createElement('tr');

          var td1 = document.createElement('td');
          td1.textContent = t.datum;
          tr.appendChild(td1);

          var td2 = document.createElement('td');
          td2.textContent = t.spieler;
          tr.appendChild(td2);

          var td3 = document.createElement('td');
          td3.textContent = getPositionLabel(t.position);
          td3.title = t.position || 'Unbekannt';
          tr.appendChild(td3);

          var td4 = document.createElement('td');
          fillClubCell(td4, t.club || 'N/A');
          tr.appendChild(td4);

          var td5 = document.createElement('td');
          td5.className = 'numeric';
          td5.textContent = formatMarktwert(t.marktwert);
          tr.appendChild(td5);

          tBodyA.appendChild(tr);
        });
        renderMobileCards('transfers-abgaenge', abgaenge);
        setupTableSorting('transfersAbgaengeTable', renderTransfersTable);
        document.getElementById('transfersAbgaengeStats').textContent = 'Zeige ' + abgaenge.length + ' Abgänge';
      }
    }

    function renderMomentumTable() {
      var period = getPeriod();
      var direction = getDirection();
      var budgetLimit = getBudgetLimit();
      var filtered = window.PLAYERS.filter(function(p) {
        if (!filterByBudget(p, budgetLimit)) return false;
        if (!(p.veraenderung && p.veraenderung[period])) return false;
        var abs = p.veraenderung[period].abs;
        if (direction === 'steiger' && !(abs > 0)) return false;
        if (direction === 'faller' && !(abs < 0)) return false;
        return true;
      });
      filtered.sort(function(a, b) {
        var aAbs = a.veraenderung[period].abs || 0;
        var bAbs = b.veraenderung[period].abs || 0;
        return direction === 'faller' ? (aAbs - bAbs) : (bAbs - aAbs);
      });
      if (currentSortColumn !== null) {
        filtered.sort(function(a, b) {
          var aVal, bVal;
          if (currentSortColumn === 0) {
            aVal = a.spieler;
            bVal = b.spieler;
          } else if (currentSortColumn === 1) {
            aVal = a.club;
            bVal = b.club;
          } else if (currentSortColumn === 2) {
            aVal = a.marktwert || 0;
            bVal = b.marktwert || 0;
          } else if (currentSortColumn === 3) {
            aVal = a.veraenderung[period].abs || 0;
            bVal = b.veraenderung[period].abs || 0;
          } else if (currentSortColumn === 4) {
            aVal = a.veraenderung[period].prozent || 0;
            bVal = b.veraenderung[period].prozent || 0;
          } else {
            aVal = 0;
            bVal = 0;
          }
          if (typeof aVal === 'string') {
            return currentSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
          } else {
            return currentSortAsc ? (aVal - bVal) : (bVal - aVal);
          }
        });
      }
      var tbody = document.getElementById('momentumTable').querySelector('tbody');
      tbody.innerHTML = '';
      if (filtered.length === 0) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.colSpan = '7';
        td.className = 'empty-state';
        td.textContent = 'Keine Spieler gefunden';
        tr.appendChild(td);
        tbody.appendChild(tr);
        document.getElementById('momentumStats').textContent = '';
        renderMobileCards('momentum', filtered);
        return;
      }
      filtered.forEach(function(p) {
        var change = p.veraenderung[period];
        var isPositive = change.abs > 0;
        var changeClass = isPositive ? 'positive' : (change.abs < 0 ? 'negative' : 'neutral');
        var tr = document.createElement('tr');
        var td1 = document.createElement('td');
        td1.textContent = p.spieler;
        var td1News = makeNewsMarker(p);
        if (td1News) td1.appendChild(td1News);
        tr.appendChild(td1);
        var td2 = document.createElement('td');
        fillClubCell(td2, p.club);
        tr.appendChild(td2);
        var td3 = document.createElement('td');
        td3.className = 'numeric';
        td3.textContent = formatMarktwert(p.marktwert);
        tr.appendChild(td3);
        var td4 = document.createElement('td');
        td4.className = 'numeric ' + changeClass;
        td4.textContent = formatChange(change.abs, null);
        tr.appendChild(td4);
        var td5 = document.createElement('td');
        td5.className = 'numeric ' + changeClass;
        td5.textContent = change.prozent !== null ? (change.prozent >= 0 ? '+' : '') + change.prozent + '%' : 'N/A';
        tr.appendChild(td5);
        var td6 = document.createElement('td');
        if (p.tendenz) {
          var span = document.createElement('span');
          span.className = 'tendenz';
          span.textContent = p.tendenz;
          td6.appendChild(span);
        }
        tr.appendChild(td6);
        var td7 = document.createElement('td');
        var researchHTML = createResearchButtons(p.spieler, p.club);
        td7.innerHTML = researchHTML;
        td7.insertBefore(makeKaderToggle(p, true), td7.firstChild);
        tr.appendChild(td7);
        tbody.appendChild(tr);
      });
      renderMobileCards('momentum', filtered);
      setupTableSorting('momentumTable', renderMomentumTable);
      var totalWithPeriod = window.PLAYERS.filter(function(p) { return p.veraenderung && p.veraenderung[period]; }).length;
      document.getElementById('momentumStats').textContent = 'Zeige ' + filtered.length + ' von ' + totalWithPeriod + ' Spielern mit Daten für ' + period;
    }

    function renderValueTable() {
      var budgetLimit = getBudgetLimit();
      var hideKepers = hideKeepers();
      var filtered = window.PLAYERS.filter(function(p) {
        if (!filterByBudget(p, budgetLimit)) return false;
        if (!p.punkte) return false;
        if (hideKepers && p.istTorhueter) return false;
        return true;
      });
      filtered.sort(function(a, b) {
        return (b.punkteProMio || 0) - (a.punkteProMio || 0);
      });
      if (currentSortColumn !== null) {
        filtered.sort(function(a, b) {
          var aVal, bVal;
          if (currentSortColumn === 0) {
            aVal = a.spieler;
            bVal = b.spieler;
          } else if (currentSortColumn === 1) {
            aVal = a.club;
            bVal = b.club;
          } else if (currentSortColumn === 2) {
            aVal = a.marktwert || 0;
            bVal = b.marktwert || 0;
          } else if (currentSortColumn === 3) {
            aVal = a.punkte || 0;
            bVal = b.punkte || 0;
          } else if (currentSortColumn === 4) {
            aVal = a.einsaetze || 0;
            bVal = b.einsaetze || 0;
          } else if (currentSortColumn === 5) {
            aVal = a.punkteProSpiel || 0;
            bVal = b.punkteProSpiel || 0;
          } else if (currentSortColumn === 6) {
            aVal = a.punkteProMio || 0;
            bVal = b.punkteProMio || 0;
          } else {
            aVal = 0;
            bVal = 0;
          }
          if (typeof aVal === 'string') {
            return currentSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
          } else {
            return currentSortAsc ? (aVal - bVal) : (bVal - aVal);
          }
        });
      }
      var tbody = document.getElementById('valueTable').querySelector('tbody');
      tbody.innerHTML = '';
      if (filtered.length === 0) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.colSpan = '8';
        td.className = 'empty-state';
        td.textContent = 'Keine Spieler gefunden';
        tr.appendChild(td);
        tbody.appendChild(tr);
        document.getElementById('valueStats').textContent = '';
        renderMobileCards('value-picks', filtered);
        return;
      }
      filtered.forEach(function(p) {
        var tr = document.createElement('tr');
        var td1 = document.createElement('td');
        td1.textContent = p.spieler;
        var td1News = makeNewsMarker(p);
        if (td1News) td1.appendChild(td1News);
        tr.appendChild(td1);
        var td2 = document.createElement('td');
        fillClubCell(td2, p.club);
        tr.appendChild(td2);
        var td3 = document.createElement('td');
        td3.className = 'numeric';
        td3.textContent = formatMarktwert(p.marktwert);
        tr.appendChild(td3);
        var td4 = document.createElement('td');
        td4.className = 'numeric';
        td4.textContent = p.punkte;
        tr.appendChild(td4);
        var td5 = document.createElement('td');
        td5.className = 'numeric';
        td5.textContent = p.einsaetze || 'N/A';
        tr.appendChild(td5);
        var td6 = document.createElement('td');
        td6.className = 'numeric';
        td6.textContent = p.punkteProSpiel !== null ? p.punkteProSpiel.toFixed(2).replace('.', ',') : 'N/A';
        tr.appendChild(td6);
        var td7 = document.createElement('td');
        td7.className = 'numeric';
        td7.textContent = p.punkteProMio !== null ? p.punkteProMio.toFixed(1).replace('.', ',') : 'N/A';
        tr.appendChild(td7);
        var td8 = document.createElement('td');
        var researchHTML = createResearchButtons(p.spieler, p.club);
        td8.innerHTML = researchHTML;
        td8.insertBefore(makeKaderToggle(p, true), td8.firstChild);
        tr.appendChild(td8);
        tbody.appendChild(tr);
      });
      renderMobileCards('value-picks', filtered);
      setupTableSorting('valueTable', renderValueTable);
      var totalWithPoints = window.PLAYERS.filter(function(p) { return p.punkte; }).length;
      document.getElementById('valueStats').textContent = 'Zeige ' + filtered.length + ' von ' + totalWithPoints + ' Spielern mit Punkten';
    }

    /* ===== Mein Kader (Watchlist, localStorage) ===== */
    var KADER_STORAGE_KEY = 'comunioMeinKader';

    function kaderKey(p) {
      return p.spieler + '|' + p.club;
    }

    function getKader() {
      try {
        var raw = window.localStorage.getItem(KADER_STORAGE_KEY);
        var arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) {
        return [];
      }
    }

    function saveKader(arr) {
      try {
        window.localStorage.setItem(KADER_STORAGE_KEY, JSON.stringify(arr));
      } catch (e) { /* localStorage nicht verfügbar – Kader bleibt für diese Sitzung leer */ }
    }

    function isInKader(p) {
      return getKader().indexOf(kaderKey(p)) !== -1;
    }

    function toggleKader(p) {
      var arr = getKader();
      var key = kaderKey(p);
      var idx = arr.indexOf(key);
      if (idx === -1) {
        arr.push(key);
      } else {
        arr.splice(idx, 1);
      }
      saveKader(arr);
    }

    // Starred players matched against PLAYERS first (full trend data),
    // then against the full KADER so squad-only players work too.
    function getKaderMatches() {
      var kader = getKader();
      var matched = window.PLAYERS.filter(function(p) {
        return kader.indexOf(kaderKey(p)) !== -1;
      });
      var matchedKeys = {};
      matched.forEach(function(p) { matchedKeys[kaderKey(p)] = true; });
      (window.KADER && window.KADER.spieler || []).forEach(function(k) {
        var key = kaderKey(k);
        if (kader.indexOf(key) !== -1 && !matchedKeys[key]) {
          matched.push(normalizeKaderPlayer(k));
          matchedKeys[key] = true;
        }
      });
      return matched;
    }

    function updateKaderCount() {
      var el = document.getElementById('kaderCount');
      if (!el) return;
      var kader = getKader();
      var visible = getKaderMatches().length;
      el.textContent = (kader.length === visible) ? '(' + visible + ')' : '(' + visible + '/' + kader.length + ')';
    }

    function makeKaderToggle(p, compact) {
      var btn = document.createElement('button');
      function apply() {
        var active = isInKader(p);
        btn.className = 'kader-toggle' + (compact ? ' kader-toggle-compact' : '') + (active ? ' active' : '');
        btn.textContent = compact ? (active ? '★' : '☆') : (active ? '★ Im Kader' : '☆ Zum Kader');
        btn.title = active ? 'Aus meinem Kader entfernen' : 'Zu meinem Kader hinzufügen';
      }
      apply();
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleKader(p);
        apply();
        updateKaderCount();
        if (currentTab === 'mein-kader') renderMeinKaderTable();
      });
      return btn;
    }

    function getKaderSignal(p) {
      var wk = (p.veraenderung && p.veraenderung.vorwoche) ? p.veraenderung.vorwoche.prozent : null;
      var dy = (p.veraenderung && p.veraenderung.vortag) ? p.veraenderung.vortag.prozent : null;
      var isWeek = wk !== null;
      var trend = isWeek ? wk : dy;
      var periode = isWeek ? 'Woche' : 'Tag';
      if (trend === null) {
        return { text: '– keine Trenddaten', className: 'neutral' };
      }
      // Wochentrend akkumuliert über 7 Tage, Tagestrend ist volatiler -> engere Schwellen
      var strong = isWeek ? 10 : 4;
      var mild = isWeek ? 3 : 1.5;
      var pct = '(' + (trend >= 0 ? '+' : '') + trend + '% / ' + periode + ')';
      if (trend >= strong) { return { text: '▲▲  stark steigend  ' + pct, className: 'positive' }; }
      if (trend >= mild)   { return { text: '▲  steigend  ' + pct, className: 'positive' }; }
      if (trend <= -strong){ return { text: '▼▼  stark fallend  ' + pct, className: 'negative' }; }
      if (trend <= -mild)  { return { text: '▼  fallend  ' + pct, className: 'negative' }; }
      return { text: '■  stabil  ' + pct, className: 'neutral' };
    }

    function renderMeinKaderTable() {
      var kader = getKader();
      var grid = document.getElementById('meinKaderGrid');
      var empty = document.getElementById('meinKaderEmpty');
      var stats = document.getElementById('meinKaderStats');

      var kaderPlayers = getKaderMatches();
      var missing = kader.length - kaderPlayers.length;

      if (kaderPlayers.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        empty.innerHTML = (kader.length === 0)
          ? 'Noch keine Spieler im Kader.<br>Such oben einen Spieler und tippe auf „☆ Zum Kader", um ihn hier zu sammeln.'
          : 'Deine ' + kader.length + ' markierten Spieler sind aktuell weder in den Listen noch im Liga-Kader — z. B. Verein gewechselt oder Liga verlassen.';
        stats.textContent = '';
      } else {
        empty.style.display = 'none';
        renderDetailCards(kaderPlayers, 'meinKaderGrid', true);
        var steigt = kaderPlayers.filter(function(p) { return getKaderSignal(p).className === 'positive'; }).length;
        var faellt = kaderPlayers.filter(function(p) { return getKaderSignal(p).className === 'negative'; }).length;
        var txt = kaderPlayers.length + ' Spieler im Kader · ' + steigt + ' steigen · ' + faellt + ' fallen';
        if (missing > 0) txt += ' · ' + missing + ' aktuell nicht in den Listen';
        stats.textContent = txt;
      }
      updateKaderCount();
    }
  </script>
</body>
</html>`;

// Write to file
if (!fs.existsSync('dashboard')) {
  fs.mkdirSync('dashboard');
}

fs.writeFileSync('dashboard/index.html', htmlContent);
console.log('✓ Dashboard generated: dashboard/index.html');
console.log(`✓ File size: ${(fs.statSync('dashboard/index.html').size / 1024).toFixed(1)} KB`);
console.log(`✓ Embedded players: ${players.length}`);
console.log(`✓ Qualifying Geheimtipps: ${players.filter(p => p.geheimtippScore !== null).length}`);
console.log(`✓ Theme: Subdued Emerald Dark with CSS variables`);
console.log(`✓ Features: Sticky headers, tooltips (hover+tap), 2 research links (News 24h + TM), Mein Kader, numeric right-aligned`);
