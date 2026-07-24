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
 * Scrape squad/squad/kader from all 20 clubs
 */
async function scrapeSquads() {
  const url = 'https://stats.comunio.de/squad';
  console.log(`\n📥 Fetching squad overview from ${url}...`);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = load(html);

    // Extract 20 club links from a[href^="/squad/"]
    const clubLinks = new Set();
    $('a[href^="/squad/"]').each((idx, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        clubLinks.add(href);
      }
    });

    const uniqueClubLinks = Array.from(clubLinks).slice(0, 20);
    console.log(`✓ Found ${uniqueClubLinks.length} club links\n`);

    const allPlayers = [];
    // Dead club ids (relegated teams) serve the default squad page again —
    // detect by identical player-name signature and skip the duplicate.
    const seenSignatures = new Set();

    // Scrape each club sequentially with delay
    for (let i = 0; i < uniqueClubLinks.length; i++) {
      const clubLink = uniqueClubLinks[i];
      const clubUrl = 'https://stats.comunio.de' + clubLink;

      console.log(`  [${i + 1}/${uniqueClubLinks.length}] Fetching ${clubUrl}...`);

      try {
        const clubResponse = await fetch(clubUrl, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(10000),
        });

        if (!clubResponse.ok) {
          console.log(`    ⚠ HTTP ${clubResponse.status}, skipping`);
          await delay(800);
          continue;
        }

        const clubHtml = await clubResponse.text();
        const $club = load(clubHtml);

        // Extract club name from URL slug (primary source)
        // Format: /squad/123-Club+Name → extract "Club Name" (after dash)
        let clubName = null;
        const match = clubLink.match(/\/squad\/\d+-(.+)$/);
        if (match) {
          clubName = decodeURIComponent(match[1]).replace(/\+/g, ' ');
        }

        // Fallback: try h1, h2 if slug decode failed
        if (!clubName || clubName.length === 0) {
          const h1 = $club('h1').first().text().trim();
          const h2 = $club('h2').first().text().trim();
          clubName = (h1 || h2 || null);
        }

        if (!clubName) {
          console.log(`    ⚠ Could not extract club name, skipping`);
          await delay(800);
          continue;
        }

        // Find table with header containing both "Spieler" and "Marktwert"
        const tables = $club('table');
        let playersTable = null;

        tables.each((tableIdx, tableElem) => {
          if (playersTable) return; // Already found
          const $table = $club(tableElem);
          const headerRow = $table.find('tr').first();
          const headerText = headerRow.text().toLowerCase();

          if (headerText.includes('spieler') && headerText.includes('marktwert')) {
            playersTable = $table;
          }
        });

        if (!playersTable) {
          console.log(`    ⚠ Player table not found, skipping`);
          await delay(800);
          continue;
        }

        const clubPlayers = [];

        // Fixed columns, verified live 23.07.2026:
        // td0 icon | td1 Spieler | td2 Abzeichen | td3 Pkt. | td4 Einsätze "22 (22)"
        // td5 Punkte pro Spiel | td6 Schüsse | td7 Pass% | td8 Zweikampf% | td9 Marktwert
        playersTable.find('tr').each((rowIdx, row) => {
          if (rowIdx === 0) return; // Skip header

          const $row = $club(row);
          const tds = $row.find('td');
          if (tds.length < 10) return;

          const spielerText = $club(tds.eq(1)).text().trim();
          if (!spielerText) return;

          let position = null;
          const positions = ['Torwart', 'Abwehr', 'Mittelfeld', 'Sturm'];
          $row.find('img').each((imgIdx, imgElem) => {
            const alt = $club(imgElem).attr('alt') || '';
            if (positions.includes(alt)) position = alt;
          });

          const punkteText = $club(tds.eq(3)).text().trim();
          const punkte = punkteText === '-' ? null : parseGermanNumber(punkteText);

          const einsaetzeText = $club(tds.eq(4)).text().trim();
          const einsaetzeMatch = einsaetzeText.match(/^(\d+)/);
          const einsaetze = einsaetzeMatch ? parseInt(einsaetzeMatch[1]) : null;

          const ppsText = $club(tds.eq(5)).text().trim();
          const punkteProSpiel = ppsText === '-' ? null : parseGermanNumber(ppsText);

          const marktwert = parseGermanNumber($club(tds.eq(9)).text().trim());

          clubPlayers.push({
            spieler: spielerText,
            position: position,
            punkte: punkte,
            einsaetze: einsaetze,
            punkteProSpiel: punkteProSpiel,
            marktwert: marktwert,
            club: clubName,
          });
        });

        const signature = clubPlayers.map(p => p.spieler).join('|');
        if (clubPlayers.length > 0 && seenSignatures.has(signature)) {
          console.log(`    ⚠ ${clubName}: identical squad already scraped (dead club id) — skipped`);
          await delay(800);
          continue;
        }
        seenSignatures.add(signature);
        allPlayers.push(...clubPlayers);

        console.log(`    ✓ Extracted ${clubPlayers.length} players from ${clubName}`);
        await delay(800);

      } catch (error) {
        console.log(`    ⚠ Error fetching club: ${error.message}`);
        await delay(800);
      }
    }

    console.log(`\n✓ Squad scrape complete: ${allPlayers.length} total players from ${uniqueClubLinks.length} clubs`);

    // Plausibility check
    const noMarktwert = allPlayers.filter(p => !p.marktwert).length;
    const noPosition = allPlayers.filter(p => !p.position).length;
    console.log(`  Plausibility: ${noMarktwert} without marktwert, ${noPosition} without position\n`);

    return {
      stand: new Date().toISOString(),
      spieler: allPlayers,
    };

  } catch (error) {
    console.log(`⚠ Squad scrape failed: ${error.message}`);
    console.log('  Continuing with empty squad data\n');
    return { stand: new Date().toISOString(), spieler: [] };
  }
}

/**
 * Scrape Transfers page (Zugänge and Abgänge)
 */
async function scrapeTransfers() {
  const url = 'https://stats.comunio.de/transfers';
  console.log(`\n📥 Fetching transfers from ${url}...`);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log('✓ Transfers page loaded\n');

    const $ = load(html);
    const transfers = { stand: new Date().toISOString(), zugaenge: [], abgaenge: [] };

    // Find h4 headers and their following tables
    const h4s = $('h4');
    let zugaengeTableFound = false;
    let abgaengeTableFound = false;

    h4s.each((idx, h4elem) => {
      const $h4 = $(h4elem);
      const text = $h4.text().trim();

      // Look for table following this h4
      const $nextTable = $h4.nextAll('table').first();
      if (!$nextTable.length) return;

      if (text.includes('Zugänge') && !zugaengeTableFound) {
        zugaengeTableFound = true;
        parseTransferTable($nextTable, $, transfers.zugaenge, 'zugaenge');
      } else if (text.includes('Abgänge') && !abgaengeTableFound) {
        abgaengeTableFound = true;
        parseTransferTable($nextTable, $, transfers.abgaenge, 'abgaenge');
      }
    });

    if (!zugaengeTableFound && !abgaengeTableFound) {
      console.log('⚠ Transfers: tables not found (structure may have changed)');
      return transfers;
    }

    console.log(`✓ Transfers scraped: ${transfers.zugaenge.length} new, ${transfers.abgaenge.length} departures\n`);

    // Plausibility check
    const noClub = transfers.zugaenge.filter(t => !t.club).length + transfers.abgaenge.filter(t => !t.club).length;
    const noValue = transfers.zugaenge.filter(t => !t.marktwert).length + transfers.abgaenge.filter(t => !t.marktwert).length;
    console.log(`  Plausibility: ${noClub} entries without club, ${noValue} without market value`);

    return transfers;
  } catch (error) {
    console.log(`⚠ Transfers: ${error.message}`);
    console.log('  Continuing with empty transfers data\n');
    return { stand: new Date().toISOString(), zugaenge: [], abgaenge: [] };
  }
}

/**
 * Parse a transfer table and populate results array
 */
function parseTransferTable($table, $, resultArray, type) {
  let headerRow = true;
  let count = 0;

  $table.find('tr').each((rowIdx, row) => {
    if (headerRow) {
      headerRow = false;
      return;
    }

    const $row = $(row);
    const tds = $row.find('td');
    if (tds.length < 5) return;

    // Extract td texts: Datum | (leer) | Spieler | Club | Marktwert
    const datum = $(tds.eq(0)).text().trim(); // "DD.MM.YYYY"
    const spieler = $(tds.eq(2)).text().trim();
    const marktwertStr = $(tds.eq(4)).text().trim();

    if (!spieler) return;

    // Extract position, club, tendenz from img alts
    const imgs = $row.find('img');
    let position = null;
    let club = null;
    let tendenz = null;
    const positions = ['Torwart', 'Abwehr', 'Mittelfeld', 'Sturm'];
    const tendenzen = ['Aufsteigend', 'Trendend'];

    imgs.each((imgIdx, imgElem) => {
      const alt = $(imgElem).attr('alt') || '';
      if (!alt) return;

      if (positions.includes(alt)) {
        position = alt;
      } else if (tendenzen.includes(alt)) {
        tendenz = alt;
      } else if (alt) {
        // Everything else is club
        if (!club) club = alt;
      }
    });

    const marktwert = parseGermanNumber(marktwertStr);

    if (!datum || !spieler) return;

    resultArray.push({
      datum: datum,
      spieler: spieler,
      position: position,
      club: club,
      tendenz: tendenz,
      marktwert: marktwert,
    });

    count++;
  });

  console.log(`  Table (${type}): ${count} rows`);
}

/**
 * Main function
 */
/**
 * Scrape transfer news counts per player via Google News RSS.
 * Query: "<spieler> <club> Transfer when:3d" (German edition).
 * Returns { "<spieler>|<club>": { count, latestTitle, latestSource } } —
 * only players with at least one hit are included.
 */
async function scrapeNews(playerList) {
  console.log(`\n📥 Fetching transfer news (Google News RSS) for ${playerList.length} players...`);
  const news = {};
  let done = 0;
  let withNews = 0;
  let errors = 0;

  try {
    for (const p of playerList) {
      // Bail out early if the endpoint is blocked (e.g. runner IP) —
      // no point hammering it 150+ times.
      if (done >= 10 && errors === done) {
        console.log('⚠ News: first 10 requests all failed — aborting news scrape');
        return {};
      }

      // intitle: on the surname keeps precision high — the headline itself must
      // name the player (plain queries matched 137/158 players = useless marker).
      const surname = p.spieler.split(' ').pop();
      const q = `intitle:${surname} ${p.club} Transfer when:3d`;
      const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=de&gl=DE&ceid=DE:de';
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const $ = load(await res.text(), { xmlMode: true });
          const items = $('item');
          if (items.length > 0) {
            const first = items.first();
            news[`${p.spieler}|${p.club}`] = {
              count: items.length,
              latestTitle: $(first).find('title').text().slice(0, 140),
              latestSource: $(first).find('source').text(),
            };
            withNews++;
          }
        } else {
          errors++;
        }
      } catch (error) {
        errors++;
      }

      done++;
      if (done % 25 === 0) console.log(`  ${done}/${playerList.length} queried...`);
      await delay(400);
    }

    console.log(`✓ News scrape complete: ${withNews}/${playerList.length} players with recent transfer news (${errors} errors)\n`);
    return news;
  } catch (error) {
    console.log(`⚠ News scrape failed: ${error.message} — continuing without news\n`);
    return {};
  }
}

/**
 * Fetch current Bundesliga player full names from Wikidata (SPARQL), then map
 * them onto our scraped players by surname (+ club preference). Returns
 * { "<spieler>|<club>": { full, slug } } only for UNAMBIGUOUS matches.
 * slug (kicker player page) is set only when the full name is pure ASCII —
 * kicker's umlaut transliteration is unverifiable (bot-blocked), so ä/ö/ü
 * names keep the always-working News/TM links instead of a guessed slug.
 */
async function scrapeFullNames(playerList) {
  console.log(`\n📥 Fetching Bundesliga full names from Wikidata...`);
  const query = `
SELECT DISTINCT ?playerLabel ?clubLabel WHERE {
  ?club wdt:P118 wd:Q82595 .
  ?player p:P54 ?st .
  ?st ps:P54 ?club .
  FILTER NOT EXISTS { ?st pq:P582 ?end }
  ?player wdt:P569 ?dob .
  FILTER(YEAR(?dob) >= 1995)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}`;
  try {
    const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ComunioScout/1.0 (github officephysioschmidt-stack)',
        'Accept': 'application/sparql-results+json',
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.log(`⚠ Wikidata HTTP ${res.status} — continuing without full names\n`);
      return {};
    }
    const rows = (await res.json()).results.bindings.map(r => ({ name: r.playerLabel.value, club: r.clubLabel.value }));

    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const lastOf = (s) => norm(s).split(/[ -]/).pop();
    const clubTokens = (s) => norm(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
      .filter(t => t.length > 2 && !['fc', 'sv', 'vfb', 'vfl', 'tsg', 'borussia'].includes(t));
    const clubMatch = (a, b) => { const ta = clubTokens(a), tb = clubTokens(b); return ta.some(t => tb.includes(t)); };
    const asciiSafe = (name) => !/[äöüßÄÖÜ]/.test(name) && /^[\x00-\x7f]*$/.test(norm(name));
    const toSlug = (name) => norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const wd = {};
    for (const r of rows) { const ln = lastOf(r.name); (wd[ln] = wd[ln] || []).push(r); }

    const map = {};
    let withSlug = 0;
    for (const p of playerList) {
      const ln = lastOf(p.spieler);
      const bucket = wd[ln] || [];
      const clubHits = bucket.filter(c => clubMatch(c.club, p.club));
      const chosen = clubHits.length ? clubHits : bucket;
      const uniqueNames = [...new Set(chosen.map(c => c.name))];
      if (uniqueNames.length === 1) {
        const full = uniqueNames[0];
        const entry = { full: full };
        if (asciiSafe(full)) { entry.slug = toSlug(full); withSlug++; }
        map[`${p.spieler}|${p.club}`] = entry;
      }
    }
    console.log(`✓ Full names: ${Object.keys(map).length} matched (${withSlug} with kicker slug) from ${rows.length} Wikidata rows\n`);
    return map;
  } catch (error) {
    console.log(`⚠ Wikidata full names failed: ${error.message} — continuing without\n`);
    return {};
  }
}

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

    const kader = await scrapeSquads();
    await delay(800);

    const transfers = await scrapeTransfers();
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

    // Save transfers data — keep previous file if today's scrape came back empty
    const transfersEmpty = transfers.zugaenge.length === 0 && transfers.abgaenge.length === 0;
    if (!transfersEmpty || !fs.existsSync('data/transfers.json')) {
      fs.writeFileSync(
        'data/transfers.json',
        JSON.stringify(transfers, null, 2)
      );
    } else {
      console.log('⚠ Transfers empty — keeping previous data/transfers.json');
    }

    // Save kader data — keep previous file if today's scrape came back empty
    const kaderEmpty = kader.spieler.length === 0;
    if (!kaderEmpty || !fs.existsSync('data/kader.json')) {
      fs.writeFileSync(
        'data/kader.json',
        JSON.stringify(kader, null, 2)
      );
    } else {
      console.log('⚠ Kader empty — keeping previous data/kader.json');
    }

    // Daily market value snapshot for trend history.
    // Written to history/ (NOT gitignored) — the daily CI run commits it,
    // building a real per-player market value time series over the season.
    if (!fs.existsSync('history')) {
      fs.mkdirSync('history');
    }
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = {};
    for (const p of kader.spieler) {
      if (p.marktwert !== null) snapshot[`${p.spieler}|${p.club}`] = p.marktwert;
    }
    for (const p of Object.values(players)) {
      if (p.marktwert !== null) snapshot[`${p.spieler}|${p.club}`] = p.marktwert;
    }
    fs.writeFileSync(`history/${today}.json`, JSON.stringify(snapshot));
    console.log(`✓ History snapshot: history/${today}.json (${Object.keys(snapshot).length} players)`);

    // Transfer news markers — keep previous file if scrape came back empty
    const news = await scrapeNews(Object.values(players));
    const newsEmpty = Object.keys(news).length === 0;
    if (!newsEmpty || !fs.existsSync('data/news.json')) {
      fs.writeFileSync(
        'data/news.json',
        JSON.stringify({ stand: new Date().toISOString(), news: news }, null, 2)
      );
    } else {
      console.log('⚠ News empty — keeping previous data/news.json');
    }

    // Wikidata full names + kicker slugs — match against top-list players and
    // the full squad. Keep previous file if the query came back empty.
    await delay(800);
    const fullnamesTargets = Object.values(players).concat(kader.spieler);
    const fullnamesMap = await scrapeFullNames(fullnamesTargets);
    const fullnamesEmpty = Object.keys(fullnamesMap).length === 0;
    if (!fullnamesEmpty || !fs.existsSync('data/fullnames.json')) {
      fs.writeFileSync(
        'data/fullnames.json',
        JSON.stringify({ stand: new Date().toISOString(), map: fullnamesMap }, null, 2)
      );
    } else {
      console.log('⚠ Full names empty — keeping previous data/fullnames.json');
    }

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
    console.log(`  Squad (Kader) players: ${kader.spieler.length}`);
    console.log(`  Transfers - Zugänge: ${transfers.zugaenge.length}`);
    console.log(`  Transfers - Abgänge: ${transfers.abgaenge.length}`);

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
    console.log(`✓ Saved to data/kader.json`);
    console.log(`✓ Saved to data/transfers.json`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
