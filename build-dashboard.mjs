import fs from 'fs';

// Read players data
let players = JSON.parse(fs.readFileSync('data/players.json', 'utf-8'));

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
      white-space: nowrap;
      touch-action: manipulation;
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
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .tab-button {
        min-width: 100px;
        padding: 14px 16px;
        height: 50px;
        font-size: 0.85em;
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
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Comunio-Scout</h1>
      <p>Daten: stats.comunio.de</p>
    </header>

    <div class="search-section">
      <input type="text" id="playerSearch" placeholder="Spieler suchen …">
    </div>

    <div class="controls">
      <div class="filter-group">
        <label for="budgetFilter">Max. Marktwert (Mio):</label>
        <input type="number" id="budgetFilter" placeholder="Leer = kein Limit" min="0" step="0.5">
      </div>
    </div>

    <div id="searchResultsArea" class="search-results">
      <div id="searchResultsGrid" class="cards-grid"></div>
    </div>

    <div id="tabsArea">
      <div class="tabs">
      <button class="tab-button active" data-tab="geheimtipps">GEHEIMTIPPS</button>
      <button class="tab-button" data-tab="momentum">MOMENTUM</button>
      <button class="tab-button" data-tab="value-picks">VALUE-PICKS</button>
    </div>

    <div id="geheimtipps" class="tab-content active">
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

    <div id="momentum" class="tab-content">
      <div class="momentum-controls">
        <label for="periodSelector">Zeitraum:</label>
        <select id="periodSelector">
          <option value="vortag">Zum Vortag</option>
          <option value="vorwoche">Zur Vorwoche</option>
          <option value="vormonat">Zum Vormonat</option>
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
    </div>
  </div>

  <script>
    window.PLAYERS = ` + JSON.stringify(players) + `;
    window.CLUB_SHORT_CODES = ` + JSON.stringify(CLUB_SHORT_CODES) + `;
  </script>

  <script>
    let currentSortColumn = null;
    let currentSortAsc = true;
    let currentTab = 'geheimtipps';
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('DOMContentLoaded', function() {
      setupTabs();
      setupFilters();
      setupSwipeGestures();
      setupTooltips();
      renderGeheimtippsTable();
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
          currentTab = e.target.getAttribute('data-tab');
          e.target.classList.add('active');
          document.getElementById(currentTab).classList.add('active');
          currentSortColumn = null;
          if (currentTab === 'geheimtipps') {
            renderGeheimtippsTable();
          } else if (currentTab === 'momentum') {
            renderMomentumTable();
          } else {
            renderValueTable();
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
        } else {
          renderValueTable();
        }
      });
      document.getElementById('periodSelector').addEventListener('change', renderMomentumTable);
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

      var results = window.PLAYERS.filter(function(p) {
        return p.spieler.toLowerCase().indexOf(query) !== -1;
      });

      renderDetailCards(results);
      searchArea.classList.add('active');
      tabsArea.style.display = 'none';
    }

    function renderDetailCards(players) {
      var grid = document.getElementById('searchResultsGrid');
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
        var club = document.createElement('div');
        club.className = 'card-club';
        club.textContent = p.club;
        header.appendChild(name);
        header.appendChild(club);
        card.appendChild(header);

        var fields = document.createElement('div');
        fields.className = 'card-fields';

        fields.appendChild(createCardField('Marktwert', formatMarktwert(p.marktwert)));
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

        card.appendChild(fields);

        if (p.geheimtippScore !== null) {
          var scoreBar = document.createElement('div');
          scoreBar.className = 'card-score-bar ' + getScoreBarClass(p.geheimtippScore);
          scoreBar.textContent = 'Score ' + p.geheimtippScore.toFixed(1);
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
      var val = document.getElementById('budgetFilter').value;
      return val ? parseFloat(val) * 1000000 : null;
    }

    function getPeriod() {
      return document.getElementById('periodSelector').value;
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

      var googleNewsQuery = encodeURIComponent(lastName + ' ' + club + ' Transfer');
      var tmQuery = encodeURIComponent(lastName + ':' + clubShort);
      var kickerQuery = encodeURIComponent(lastName + ' ' + club + ' site:kicker.de spieler');
      var liQuery = encodeURIComponent(lastName + ' ' + club + ' site:ligainsider.de');

      var html = '<div class="research-buttons">';
      html += '<a href="https://news.google.com/search?q=' + googleNewsQuery + '" target="_blank" class="research-btn">News</a>';
      html += '<a href="https://www.transfermarkt.de/schnellsuche/ergebnis/schnellsuche?query=' + tmQuery + '" target="_blank" class="research-btn">TM</a>';
      html += '<a href="https://www.google.com/search?q=' + kickerQuery + '" target="_blank" class="research-btn">Kicker</a>';
      html += '<a href="https://www.google.com/search?q=' + liQuery + '" target="_blank" class="research-btn">LI</a>';
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
        return;
      }
      filtered.forEach(function(p) {
        var tr = document.createElement('tr');
        var td1 = document.createElement('td');
        td1.textContent = p.spieler;
        tr.appendChild(td1);
        var td2 = document.createElement('td');
        td2.textContent = p.club;
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

      if (players.length === 0) return;

      var grid = document.createElement('div');
      grid.className = 'mobile-cards';

      players.forEach(function(p) {
        var card = document.createElement('div');
        card.className = 'mobile-card';

        var header = document.createElement('div');
        header.className = 'mobile-card-header';
        var name = document.createElement('div');
        name.className = 'mobile-card-name';
        name.textContent = p.spieler;
        var club = document.createElement('div');
        club.className = 'mobile-card-club';
        club.textContent = p.club;
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
        }

        card.appendChild(fields);

        if (p.geheimtippScore !== null && viewType === 'geheimtipps') {
          var scoreBar = document.createElement('div');
          scoreBar.className = 'mobile-score-bar ' + getScoreBarClass(p.geheimtippScore);
          scoreBar.textContent = p.geheimtippScore.toFixed(1);
          card.appendChild(scoreBar);
        }

        var buttons = document.createElement('div');
        buttons.className = 'mobile-card-buttons';
        var researchHTML = createResearchButtons(p.spieler, p.club);
        buttons.innerHTML = researchHTML.replace('research-buttons', 'mobile-card-buttons').replace(/research-btn/g, 'mobile-card-btn');
        card.appendChild(buttons);

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

    function renderMomentumTable() {
      var period = getPeriod();
      var budgetLimit = getBudgetLimit();
      var filtered = window.PLAYERS.filter(function(p) {
        if (!filterByBudget(p, budgetLimit)) return false;
        return p.veraenderung && p.veraenderung[period];
      });
      filtered.sort(function(a, b) {
        return (b.veraenderung[period].abs || 0) - (a.veraenderung[period].abs || 0);
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
        return;
      }
      filtered.forEach(function(p) {
        var change = p.veraenderung[period];
        var isPositive = change.abs > 0;
        var changeClass = isPositive ? 'positive' : (change.abs < 0 ? 'negative' : 'neutral');
        var tr = document.createElement('tr');
        var td1 = document.createElement('td');
        td1.textContent = p.spieler;
        tr.appendChild(td1);
        var td2 = document.createElement('td');
        td2.textContent = p.club;
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
        return;
      }
      filtered.forEach(function(p) {
        var tr = document.createElement('tr');
        var td1 = document.createElement('td');
        td1.textContent = p.spieler;
        tr.appendChild(td1);
        var td2 = document.createElement('td');
        td2.textContent = p.club;
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
        tr.appendChild(td8);
        tbody.appendChild(tr);
      });
      renderMobileCards('value-picks', filtered);
      setupTableSorting('valueTable', renderValueTable);
      var totalWithPoints = window.PLAYERS.filter(function(p) { return p.punkte; }).length;
      document.getElementById('valueStats').textContent = 'Zeige ' + filtered.length + ' von ' + totalWithPoints + ' Spielern mit Punkten';
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
console.log(`✓ Features: Sticky headers, tooltips (hover+tap), 4 research links, numeric right-aligned`);
