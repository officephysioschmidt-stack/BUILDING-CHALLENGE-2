import fs from 'fs';

// Read players data
const players = JSON.parse(fs.readFileSync('data/players.json', 'utf-8'));

// HTML/CSS/JS template - NO nested template literals
// Build as string concatenation instead
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

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
      padding: 20px;
      color: #333;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .filter-group {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      align-items: center;
    }

    label {
      font-weight: 500;
      color: #555;
    }

    input[type="number"],
    input[type="text"],
    select {
      padding: 10px 15px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.95em;
      font-family: inherit;
    }

    input[type="number"]:focus,
    input[type="text"]:focus,
    select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .tabs {
      display: flex;
      border-bottom: 1px solid #e0e0e0;
      background: #fafafa;
    }

    .tab-button {
      flex: 1;
      padding: 15px 20px;
      background: none;
      border: none;
      font-size: 0.95em;
      font-weight: 600;
      cursor: pointer;
      color: #666;
      border-bottom: 3px solid transparent;
      transition: all 0.3s ease;
    }

    .tab-button.active {
      color: #667eea;
      border-bottom-color: #667eea;
      background: white;
    }

    .tab-button:hover {
      background: white;
      color: #667eea;
    }

    .tab-content {
      display: none;
      padding: 20px;
    }

    .tab-content.active {
      display: block;
    }

    .momentum-controls {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .value-controls {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
      align-items: center;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95em;
    }

    thead {
      background: #f0f2f5;
    }

    th {
      padding: 12px 15px;
      text-align: left;
      font-weight: 600;
      color: #333;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      border-bottom: 2px solid #ddd;
    }

    th:hover {
      background: #e8eaed;
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
      border-bottom: 1px solid #f0f0f0;
    }

    tbody tr:nth-child(odd) {
      background: #fafafa;
    }

    tbody tr:hover {
      background: #f0f7ff;
    }

    td {
      padding: 12px 15px;
      vertical-align: middle;
    }

    .positive {
      color: #27ae60;
      font-weight: 600;
    }

    .negative {
      color: #e74c3c;
      font-weight: 600;
    }

    .neutral {
      color: #7f8c8d;
    }

    .tendenz {
      font-size: 0.85em;
      background: #fff3cd;
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
    }

    .news-link {
      display: inline-block;
      width: 24px;
      height: 24px;
      line-height: 24px;
      text-align: center;
      text-decoration: none;
      color: #667eea;
      font-weight: bold;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .news-link:hover {
      background: #e8eaed;
      color: #764ba2;
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #999;
    }

    .stats-summary {
      padding: 15px 20px;
      background: #f8f9fa;
      border-top: 1px solid #e0e0e0;
      font-size: 0.9em;
      color: #666;
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
      <button class="tab-button active" data-tab="momentum">MOMENTUM</button>
      <button class="tab-button" data-tab="value-picks">VALUE-PICKS</button>
    </div>

    <div id="momentum" class="tab-content active">
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
    let currentTab = 'momentum';

    document.addEventListener('DOMContentLoaded', function() {
      setupTabs();
      setupFilters();
      renderMomentumTable();
    });

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
          if (currentTab === 'momentum') {
            renderMomentumTable();
          } else {
            renderValueTable();
          }
        });
      });
    }

    function setupFilters() {
      document.getElementById('budgetFilter').addEventListener('input', function() {
        if (currentTab === 'momentum') {
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

    function encodeNewsSearch(spieler, club) {
      var query = spieler + ' ' + club + ' Transfer';
      return encodeURIComponent(query);
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
        var link = document.createElement('a');
        link.href = 'https://news.google.com/search?q=' + encodeNewsSearch(p.spieler, p.club);
        link.target = '_blank';
        link.className = 'news-link';
        link.textContent = '🔗';
        td7.appendChild(link);
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
        var link = document.createElement('a');
        link.href = 'https://news.google.com/search?q=' + encodeNewsSearch(p.spieler, p.club);
        link.target = '_blank';
        link.className = 'news-link';
        link.textContent = '🔗';
        td8.appendChild(link);
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
