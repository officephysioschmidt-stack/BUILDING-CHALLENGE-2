import fs from 'fs';

// Read players data
let players = JSON.parse(fs.readFileSync('data/players.json', 'utf-8'));

// Calculate Geheimtipp-Score for each player
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

// PART A: Dark Forest Green Theme + PART B: Mobile Nav + PART C: Two News Sources
const htmlHead = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comunio-Scout</title>
  <style>
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
      background: #0d1f16;
      min-height: 100vh;
      padding: 20px;
      color: #e6efe9;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: #152e21;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
      overflow: hidden;
    }

    header {
      background: linear-gradient(135deg, #2e9d5f 0%, #3aa76a 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
    }

    header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      font-weight: 700;
    }

    header p {
      font-size: 0.95em;
      opacity: 0.9;
    }

    .controls {
      padding: 20px;
      background: #1a3a2a;
      border-bottom: 1px solid #0d1f16;
    }

    .filter-group {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      align-items: center;
    }

    label {
      font-weight: 500;
      color: #9db3a5;
    }

    input[type="number"],
    input[type="text"],
    select {
      padding: 10px 15px;
      border: 1px solid #2e5a47;
      border-radius: 6px;
      font-size: 0.95em;
      font-family: inherit;
      background: #0d1f16;
      color: #e6efe9;
    }

    input[type="number"]:focus,
    input[type="text"]:focus,
    select:focus {
      outline: none;
      border-color: #3aa76a;
      box-shadow: 0 0 0 3px rgba(58, 167, 106, 0.2);
    }

    .tabs {
      display: flex;
      border-bottom: 1px solid #0d1f16;
      background: #1a3a2a;
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
      color: #9db3a5;
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
      background: rgba(58, 167, 106, 0.1);
    }

    .tab-button.active {
      color: #4ade80;
      border-bottom-color: #3aa76a;
      background: transparent;
    }

    .tab-button:hover {
      background: rgba(58, 167, 106, 0.05);
      color: #4ade80;
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
      background: #1a3a2a;
    }

    th {
      padding: 12px 15px;
      text-align: left;
      font-weight: 600;
      color: #4ade80;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      border-bottom: 2px solid #0d1f16;
    }

    th:hover {
      background: rgba(58, 167, 106, 0.1);
    }

    th.sortable::after {
      content: ' ↕';
      font-size: 0.8em;
      opacity: 0.5;
    }

    th.sort-asc::after {
      content: ' ↑';
      opacity: 1;
    }

    th.sort-desc::after {
      content: ' ↓';
      opacity: 1;
    }

    tbody tr {
      border-bottom: 1px solid #0d1f16;
    }

    tbody tr:nth-child(odd) {
      background: #1a3a2a;
    }

    tbody tr:nth-child(even) {
      background: #152e21;
    }

    tbody tr:hover {
      background: rgba(58, 167, 106, 0.1);
    }

    td {
      padding: 12px 15px;
      vertical-align: middle;
    }

    .positive {
      color: #4ade80;
      font-weight: 600;
    }

    .negative {
      color: #f87171;
      font-weight: 600;
    }

    .neutral {
      color: #9db3a5;
    }

    .tendenz {
      font-size: 0.85em;
      background: rgba(58, 167, 106, 0.2);
      color: #4ade80;
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
    }

    .score-cell {
      font-weight: 700;
      position: relative;
    }

    .score-bar {
      display: inline-block;
      height: 22px;
      border-radius: 4px;
      min-width: 60px;
      text-align: center;
      color: white;
      font-weight: 600;
      font-size: 0.85em;
      line-height: 22px;
    }

    .score-80-100 { background: linear-gradient(90deg, #3aa76a 0%, #4ade80 100%); }
    .score-60-80 { background: linear-gradient(90deg, #2e9d5f 0%, #3aa76a 100%); }
    .score-40-60 { background: linear-gradient(90deg, #22c55e 0%, #2e9d5f 100%); }
    .score-0-40 { background: linear-gradient(90deg, #9db3a5 0%, #6b8176 100%); }

    .news-buttons {
      display: flex;
      gap: 6px;
    }

    .news-btn {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 4px;
      text-decoration: none;
      color: white;
      font-weight: 600;
      font-size: 0.8em;
      transition: all 0.2s;
      border: 1px solid #2e9d5f;
      background: rgba(58, 167, 106, 0.2);
    }

    .news-btn:hover {
      background: #3aa76a;
      border-color: #4ade80;
    }

    .news-btn:active {
      background: #2e9d5f;
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #9db3a5;
    }

    .stats-summary {
      padding: 15px 20px;
      background: #1a3a2a;
      border-top: 1px solid #0d1f16;
      font-size: 0.9em;
      color: #9db3a5;
    }

    @media (max-width: 768px) {
      header h1 {
        font-size: 1.8em;
      }

      header p {
        font-size: 0.85em;
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

      .news-buttons {
        flex-direction: column;
        gap: 4px;
      }

      .news-btn {
        width: 100%;
        text-align: center;
        padding: 8px 6px;
      }

      .score-bar {
        font-size: 0.75em;
        height: 20px;
        line-height: 20px;
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

      .tab-content {
        padding: 15px;
      }

      table {
        font-size: 0.75em;
      }

      td, th {
        padding: 6px 8px;
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

    <div class="controls">
      <div class="filter-group">
        <label for="budgetFilter">Max. Marktwert (Mio):</label>
        <input type="number" id="budgetFilter" placeholder="Leer = kein Limit" min="0" step="0.5">
      </div>
    </div>

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
            <th class="sortable">Marktwert</th>
            <th class="sortable">Punkte/Mio</th>
            <th class="sortable">Trend %</th>
            <th class="sortable">Score</th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
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
            <th class="sortable">Marktwert</th>
            <th class="sortable">Veränderung (abs)</th>
            <th class="sortable">Veränderung (%)</th>
            <th>Tendenz</th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
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
            <th class="sortable">Marktwert</th>
            <th class="sortable">Punkte</th>
            <th class="sortable">Einsätze</th>
            <th class="sortable">Punkte/Spiel</th>
            <th class="sortable">Punkte/Mio</th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <div class="stats-summary" id="valueStats"></div>
    </div>
  </div>

  <script>
    window.PLAYERS = ` + JSON.stringify(players) + `;
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
      renderGeheimtippsTable();
    });

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

    function createNewsButtons(spieler, club) {
      var googleQuery = encodeURIComponent(spieler + ' ' + club + ' Transfer');
      var tmQuery = encodeURIComponent(spieler);
      var html = '<div class="news-buttons">';
      html += '<a href="https://news.google.com/search?q=' + googleQuery + '" target="_blank" class="news-btn">News</a>';
      html += '<a href="https://www.transfermarkt.de/schnellsuche/ergebnis/schnellsuche?query=' + tmQuery + '" target="_blank" class="news-btn">TM</a>';
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
        td3.textContent = formatMarktwert(p.marktwert);
        tr.appendChild(td3);
        var td4 = document.createElement('td');
        td4.textContent = p.punkteProMio !== null ? p.punkteProMio.toFixed(1).replace('.', ',') : 'N/A';
        tr.appendChild(td4);
        var td5 = document.createElement('td');
        var trend = p.usedTrend === 'vorwoche' ? (p.veraenderung.vorwoche ? p.veraenderung.vorwoche.prozent : 0) : (p.veraenderung.vortag ? p.veraenderung.vortag.prozent : 0);
        td5.textContent = trend >= 0 ? '+' + trend + '%' : trend + '%';
        td5.className = trend > 0 ? 'positive' : 'neutral';
        tr.appendChild(td5);
        var td6 = document.createElement('td');
        td6.className = 'score-cell';
        var scoreBar = document.createElement('div');
        scoreBar.className = 'score-bar ' + getScoreBarClass(p.geheimtippScore);
        scoreBar.textContent = p.geheimtippScore.toFixed(1);
        td6.appendChild(scoreBar);
        tr.appendChild(td6);
        var td7 = document.createElement('td');
        var newsHTML = createNewsButtons(p.spieler, p.club);
        td7.innerHTML = newsHTML;
        tr.appendChild(td7);
        tbody.appendChild(tr);
      });
      setupTableSorting('geheimtippsTable', renderGeheimtippsTable);
      var total = window.PLAYERS.filter(function(p) { return p.geheimtippScore !== null; }).length;
      document.getElementById('geheimtippsStats').textContent = 'Zeige ' + filtered.length + ' von ' + total + ' Geheimtipps';
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
        td3.textContent = formatMarktwert(p.marktwert);
        tr.appendChild(td3);
        var td4 = document.createElement('td');
        td4.className = changeClass;
        td4.textContent = formatChange(change.abs, null);
        tr.appendChild(td4);
        var td5 = document.createElement('td');
        td5.className = changeClass;
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
        var newsHTML = createNewsButtons(p.spieler, p.club);
        td7.innerHTML = newsHTML;
        tr.appendChild(td7);
        tbody.appendChild(tr);
      });
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
        td3.textContent = formatMarktwert(p.marktwert);
        tr.appendChild(td3);
        var td4 = document.createElement('td');
        td4.textContent = p.punkte;
        tr.appendChild(td4);
        var td5 = document.createElement('td');
        td5.textContent = p.einsaetze || 'N/A';
        tr.appendChild(td5);
        var td6 = document.createElement('td');
        td6.textContent = p.punkteProSpiel !== null ? p.punkteProSpiel.toFixed(2).replace('.', ',') : 'N/A';
        tr.appendChild(td6);
        var td7 = document.createElement('td');
        td7.textContent = p.punkteProMio !== null ? p.punkteProMio.toFixed(1).replace('.', ',') : 'N/A';
        tr.appendChild(td7);
        var td8 = document.createElement('td');
        var newsHTML = createNewsButtons(p.spieler, p.club);
        td8.innerHTML = newsHTML;
        tr.appendChild(td8);
        tbody.appendChild(tr);
      });
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

fs.writeFileSync('dashboard/index.html', htmlHead);
console.log('✓ Dashboard generated: dashboard/index.html');
console.log(`✓ File size: ${(fs.statSync('dashboard/index.html').size / 1024).toFixed(1)} KB`);
console.log(`✓ Embedded players: ${players.length}`);
console.log(`✓ Qualifying Geheimtipps: ${players.filter(p => p.geheimtippScore !== null).length}`);
console.log(`✓ Theme: Dark Forest Green (no purple remaining)`);
