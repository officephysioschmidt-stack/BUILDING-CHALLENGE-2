import fs from 'fs';
import { load } from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Parse German number format to JavaScript number.
 * Examples: "1.860.000" → 1860000, "11,0" → 11.0
 */
function parseGermanNumber(str) {
  if (!str) return null;
  let clean = str.trim();
  clean = clean.replace('%', '').trim();

  const isNegative = clean.startsWith('-');
  const sign = isNegative ? -1 : 1;
  clean = clean.replace(/^[+-\s]+/, '').trim();

  const withDecimal = clean.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(withDecimal);
  return isNaN(num) ? null : num * sign;
}

/**
 * Normalize player key for joining: lowercase name + club
 */
function normalizeKey(playerName, club) {
  const nameParts = playerName.toLowerCase().split(' ');
  const lastName = nameParts[nameParts.length - 1];
  return `${lastName}|${club.toLowerCase()}`;
}

/**
 * Delay for friendly scraping
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Scrape Goalkeeper points list (Top 25)
 */
async function scrapeGoalkeepers() {
  const url = 'https://stats.comunio.de/toplist/pts_gk_25-Top25_Punkte_Torhueter';
  console.log(`📥 Fetching ${url}...`);

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  console.log('✓ Page loaded\n');

  const $ = load(html);
  const goalkeepers = new Set();

  const table = $('table.playersTable').first();
  if (!table.length) {
    console.log('⚠ Goalkeeper table not found, continuing without GK flag');
    return goalkeepers;
  }

  let headerRow = true;
  let count = 0;

  table.find('tr').each((rowIdx, row) => {
    if (headerRow) {
      headerRow = false;
      return;
    }

    const $row = $(row);
    const tds = $row.find('td');
    if (tds.length < 4) return;

    // Same structure as points page: Rang | Icon | Player | Club | ...
    const playerName = $(tds.eq(2)).find('a.playerName').text().trim();
    const clubImg = $(tds.eq(3)).find('img');
    const club = clubImg.attr('alt') || '';

    if (!playerName || !club) return;

    const key = normalizeKey(playerName, club);
    goalkeepers.add(key);
    count++;
  });

  console.log(`✓ Goalkeepers: ${count} entries scraped\n`);
  return goalkeepers;
}

/**
 * Scrape Gewinner/Verlierer page (all time periods in single HTML)
 */
async function scrapeWinnerLoser() {
  const url = 'https://stats.comunio.de/toplist/pt-Gewinner_Verlierer';
  console.log(`📥 Fetching ${url}...`);

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  console.log('✓ Page loaded\n');

  const $ = load(html);
  const players = {};
  const stats = { total: 0, matched: 0, unmatched: [] };

  // Find all tables
  const tables = $('table.playersTable');
  console.log(`Found ${tables.length} tables (expecting 6: 2 categories × 3 periods)\n`);

  // Map: table index → [category, period]
  // Tables 0,2,4 = Winners (Vortag, Vorwoche, Vormonat)
  // Tables 1,3,5 = Losers (Vortag, Vorwoche, Vormonat)
  const tableMeta = [
    { category: 'gewinner', period: 'vortag' },
    { category: 'verlierer', period: 'vortag' },
    { category: 'gewinner', period: 'vorwoche' },
    { category: 'verlierer', period: 'vorwoche' },
    { category: 'gewinner', period: 'vormonat' },
    { category: 'verlierer', period: 'vormonat' },
  ];

  tables.each((tableIdx, tableElem) => {
    const meta = tableMeta[tableIdx];
    if (!meta) return;

    const $table = $(tableElem);
    let headerRow = true;

    $table.find('tr').each((rowIdx, row) => {
      if (headerRow) {
        headerRow = false;
        return; // Skip header
      }

      const $row = $(row);
      const tds = $row.find('td');
      if (tds.length < 5) return; // Need: Player, Club, Marktwert, Change Abs, Change %

      // Extract data
      const playerName = $(tds.eq(0)).find('a.playerName').text().trim();
      const clubImg = $(tds.eq(1)).find('img');
      const club = clubImg.attr('alt') || '';
      const marketValueStr = $(tds.eq(2)).find('span > span').text().trim();
      const changeAbsStr = $(tds.eq(3)).text().trim();
      const changePercentStr = $(tds.eq(4)).text().trim();

      if (!playerName || !club) return;

      const marketValue = parseGermanNumber(marketValueStr);
      const changeAbsolute = parseGermanNumber(changeAbsStr);
      const changePercent = parseGermanNumber(changePercentStr);

      // Extract trend/tendenz icon
      const trendImg = $(tds.eq(0)).find('img[alt*="steigend"], img[alt*="fallend"], img[alt*="aufsteigend"], img[alt*="absteigend"], img[alt*="trend"]');
      const tendenz = trendImg.attr('alt') || null;

      // Create or update player record
      const key = normalizeKey(playerName, club);
      if (!players[key]) {
        players[key] = {
          spieler: playerName,
          club: club,
          marktwert: marketValue,
          punkte: null,
          veraenderung: {},
          tendenz: tendenz,
        };
      }

      // Add change data for this period
      if (!players[key].veraenderung[meta.period]) {
        players[key].veraenderung[meta.period] = {};
      }
      players[key].veraenderung[meta.period].abs = changeAbsolute;
      players[key].veraenderung[meta.period].prozent = changePercent;

      // Update tendenz if found
      if (tendenz && !players[key].tendenz) {
        players[key].tendenz = tendenz;
      }

      stats.total++;
    });

    console.log(`✓ Table ${tableIdx} (${meta.category} ${meta.period}): processed`);
  });

  console.log(`\n✓ Gewinner/Verlierer: ${stats.total} entries scraped`);
  return players;
}

/**
 * Scrape Points Top 100 page
 */
async function scrapePointsTop100() {
  const url = 'https://stats.comunio.de/toplist/pts_ovr_100-Top100_Punkte_Spieler';
  console.log(`\n📥 Fetching ${url}...`);

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  console.log('✓ Page loaded\n');

  const $ = load(html);
  const pointsData = {};

  const table = $('table.playersTable').first();
  if (!table.length) {
    throw new Error('Points table not found');
  }

  let headerRow = true;
  let count = 0;

  table.find('tr').each((rowIdx, row) => {
    if (headerRow) {
      headerRow = false;
      return;
    }

    const $row = $(row);
    const tds = $row.find('td');
    if (tds.length < 9) return;

    // Table structure: Rang | Icon | Player | Club | Marktwert | Einsätze(bewertet) | Tore | Punkte | Punkte pro Spiel
    const playerName = $(tds.eq(2)).find('a.playerName').text().trim();
    const clubImg = $(tds.eq(3)).find('img');
    const club = clubImg.attr('alt') || '';
    const marktwertStr = $(tds.eq(4)).find('span > span').text().trim();
    const einsaetzeStr = $(tds.eq(5)).text().trim();
    const toreStr = $(tds.eq(6)).text().trim();
    const punkteStr = $(tds.eq(7)).text().trim();
    const punkteProSpielStr = $(tds.eq(8)).text().trim();

    if (!playerName || !club || !punkteStr) return;

    const marktwert = parseGermanNumber(marktwertStr);
    const punkte = parseGermanNumber(punkteStr);
    const punkteProSpiel = parseGermanNumber(punkteProSpielStr);

    if (punkte === null) return;

    // Extract numeric values from "31 (31)" format
    const einsaetzeMatch = einsaetzeStr.match(/(\d+)/);
    const einsaetze = einsaetzeMatch ? parseInt(einsaetzeMatch[1]) : null;

    const toreMatch = toreStr.match(/(\d+)/);
    const tore = toreMatch ? parseInt(toreMatch[1]) : null;

    const key = normalizeKey(playerName, club);
    pointsData[key] = {
      spieler: playerName,
      club: club,
      marktwert: marktwert,
      punkte: punkte,
      einsaetze: einsaetze,
      tore: tore,
      punkteProSpiel: punkteProSpiel,
    };

    count++;
  });

  console.log(`✓ Points Top 100: ${count} entries scraped\n`);
  return pointsData;
}

/**
 * Consolidate player data
 */
function consolidatePlayers(winnerLoserData, pointsData, goalkeepers) {
  const consolidated = { ...winnerLoserData };
  let pointsMatched = 0;
  const unmatchedPoints = [];

  // Initialize all players with points-related fields (null by default)
  for (const player of Object.values(consolidated)) {
    player.punkte = null;
    player.einsaetze = null;
    player.tore = null;
    player.punkteProSpiel = null;
    player.istTorhueter = false; // Will be set to true if in goalkeeper list
  }

  // Merge points data
  for (const [key, pointsEntry] of Object.entries(pointsData)) {
    if (consolidated[key]) {
      // Player exists in Winner/Loser data, merge points info
      consolidated[key].punkte = pointsEntry.punkte;
      consolidated[key].einsaetze = pointsEntry.einsaetze;
      consolidated[key].tore = pointsEntry.tore;
      consolidated[key].punkteProSpiel = pointsEntry.punkteProSpiel;
      pointsMatched++;
    } else {
      // New player from Points list only
      consolidated[key] = {
        spieler: pointsEntry.spieler,
        club: pointsEntry.club,
        marktwert: pointsEntry.marktwert,
        punkte: pointsEntry.punkte,
        einsaetze: pointsEntry.einsaetze,
        tore: pointsEntry.tore,
        punkteProSpiel: pointsEntry.punkteProSpiel,
        veraenderung: {},
        tendenz: null,
      };
      unmatchedPoints.push(key);
    }
  }

  // Calculate punkteProMio for all players with both values
  for (const player of Object.values(consolidated)) {
    if (player.punkte !== null && player.marktwert !== null && player.marktwert > 0) {
      const mio = player.marktwert / 1_000_000;
      player.punkteProMio = Math.round((player.punkte / mio) * 10) / 10;
    } else {
      player.punkteProMio = null;
    }
  }

  // Mark goalkeepers
  let gkCount = 0;
  for (const [key, player] of Object.entries(consolidated)) {
    if (goalkeepers.has(key)) {
      player.istTorhueter = true;
      gkCount++;
    }
  }

  return {
    players: consolidated,
    stats: {
      totalWinnerLoser: Object.keys(winnerLoserData).length,
      totalPoints: Object.keys(pointsData).length,
      totalGoalkeepers: goalkeepers.size,
      goalkeeperMatches: gkCount,
      pointsMatched,
      pointsUnmatched: unmatchedPoints,
      consolidated: Object.keys(consolidated).length,
    },
  };
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting Comunio Scraper\n');
    console.log('=' .repeat(80) + '\n');

    // Scrape all sources
    const winnerLoserData = await scrapeWinnerLoser();
    await delay(800); // Friendly delay

    const pointsData = await scrapePointsTop100();
    await delay(800);

    const goalkeepers = await scrapeGoalkeepers();
    await delay(800);

    // Consolidate
    const { players, stats } = consolidatePlayers(winnerLoserData, pointsData, goalkeepers);

    // Create data directory if needed
    if (!fs.existsSync('data')) {
      fs.mkdirSync('data');
    }

    // Save consolidated data
    fs.writeFileSync(
      'data/players.json',
      JSON.stringify(Object.values(players), null, 2)
    );

    console.log('\n' + '='.repeat(80));
    console.log('✓ Consolidation Complete\n');
    console.log('📊 Statistics:');
    console.log(`  Winner/Loser entries: ${stats.totalWinnerLoser}`);
    console.log(`  Points entries: ${stats.totalPoints}`);
    console.log(`  Goalkeeper entries: ${stats.totalGoalkeepers}`);
    console.log(`  Goalkeepers matched: ${stats.goalkeeperMatches}`);
    console.log(`  Points matched to Winner/Loser: ${stats.pointsMatched}`);
    console.log(`  Points unmatched: ${stats.pointsUnmatched.length}`);
    console.log(`  Total consolidated records: ${stats.consolidated}`);

    if (stats.pointsUnmatched.length > 0) {
      console.log(`\n  ⚠ Unmatched Points entries (first 5):`);
      stats.pointsUnmatched.slice(0, 5).forEach(key => {
        const p = pointsData[key];
        console.log(`    - ${p.spieler} (${p.club})`);
      });
    }

    // Show sample output
    console.log('\n📋 Sample Output (first 5 records):\n');
    const samplePlayers = Object.values(players).slice(0, 5);
    samplePlayers.forEach((p, i) => {
      console.log(`${i + 1}. ${p.spieler.padEnd(20)} | ${p.club.padEnd(25)} | MW: ${p.marktwert?.toLocaleString('de-DE') || 'N/A'}`);
      if (p.punkte !== null) {
        console.log(`   Punkte: ${p.punkte}, PpM: ${p.punkteProMio}, Tendenz: ${p.tendenz || 'keine'}`);
      }
      console.log();
    });

    console.log(`✓ Saved to data/players.json`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
