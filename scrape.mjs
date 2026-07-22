import fs from 'fs';
import { load } from 'cheerio';

const URL = 'https://stats.comunio.de/toplist/pt-Gewinner_Verlierer';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Parse German number format to JavaScript number.
 * Examples: "1.860.000" → 1860000, "11,0" → 11.0
 */
function parseGermanNumber(str) {
  if (!str) return null;
  // Remove leading/trailing whitespace and special chars
  let clean = str.trim();

  // Handle percentage sign
  clean = clean.replace('%', '').trim();

  // Handle leading + or -
  const isNegative = clean.startsWith('-');
  const sign = isNegative ? -1 : 1;
  clean = clean.replace(/^[+-\s]+/, '').trim();

  // German format: point = thousands separator, comma = decimal separator
  // Replace points (thousands) with nothing, comma (decimal) with point
  const withDecimal = clean.replace(/\./g, '').replace(',', '.');

  const num = parseFloat(withDecimal);
  return isNaN(num) ? null : num * sign;
}

/**
 * Extract club name from HTML.
 * The club name is in the alt text of the club icon img tag.
 */
function extractClubName(clubTd, $) {
  const img = $(clubTd).find('img');
  const altText = img.attr('alt');
  return altText || '';
}

/**
 * Extract player name from HTML.
 */
function extractPlayerName(playerTd, $) {
  const link = $(playerTd).find('a.playerName');
  return link.text().trim();
}

/**
 * Extract market value from a td containing span.abbr > span.
 */
function extractValue(td, $) {
  const span = $(td).find('span > span');
  return span.text().trim();
}

/**
 * Main scraper function.
 */
async function scrapeWinnerLoser() {
  try {
    console.log(`📥 Fetching ${URL}...`);
    const response = await fetch(URL, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log('✓ Page loaded successfully\n');

    const $ = load(html);

    // Find the main players table with class 'playersTable'
    const playersTable = $('table.playersTable.rangliste').first();
    if (!playersTable.length) {
      throw new Error('Could not find players table on page');
    }

    const players = [];
    let headerRow = true;

    playersTable.find('tr').each((index, row) => {
      if (headerRow) {
        headerRow = false;
        return; // Skip header row
      }

      const tds = $(row).find('td');
      if (tds.length < 5) return; // Skip incomplete rows

      const playerName = extractPlayerName(tds.eq(0), $);
      const club = extractClubName(tds.eq(1), $);
      const marketValueStr = extractValue(tds.eq(2), $);
      const changeAbsStr = extractValue(tds.eq(3), $);
      const changePercentStr = $(tds.eq(4)).text().trim();

      const marketValue = parseGermanNumber(marketValueStr);
      const changeAbsolute = parseGermanNumber(changeAbsStr);
      const changePercent = parseGermanNumber(changePercentStr);

      if (playerName && marketValue !== null) {
        players.push({
          spieler: playerName,
          club: club,
          marktwert: marketValue,
          veraenderungAbsolut: changeAbsolute,
          veraenderungProzent: changePercent,
        });
      }
    });

    if (players.length === 0) {
      throw new Error('No players found in table');
    }

    console.log(`✓ Scraped ${players.length} players\n`);
    console.log('📊 First 10 players:');
    console.log('─'.repeat(120));
    players.slice(0, 10).forEach((p, i) => {
      console.log(
        `${i + 1}. ${p.spieler.padEnd(20)} | ${p.club.padEnd(30)} | ` +
        `Marktwert: ${p.marktwert.toLocaleString('de-DE')} | ` +
        `Änderung: ${p.veraenderungAbsolut !== null ? p.veraenderungAbsolut.toLocaleString('de-DE') : 'N/A'} ` +
        `(${p.veraenderungProzent !== null ? p.veraenderungProzent + '%' : 'N/A'})`
      );
    });
    console.log('─'.repeat(120) + '\n');

    // Create data directory if it doesn't exist
    if (!fs.existsSync('data')) {
      fs.mkdirSync('data');
    }

    // Save to JSON file
    fs.writeFileSync(
      'data/gewinner-verlierer.json',
      JSON.stringify(players, null, 2)
    );
    console.log('💾 Saved to data/gewinner-verlierer.json');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

scrapeWinnerLoser();
