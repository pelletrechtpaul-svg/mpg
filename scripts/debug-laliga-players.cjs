const https = require('https');

function fetchHtml(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', () => resolve({ status: 0, body: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
  });
}

// name -> liste de slugs candidats à tester
const CANDIDATES = {
  'Lookman': ['ademola-lookman'],
  'Jon Martín': ['jon-martin'],
  'Aubameyang': ['pierre-emerick-aubameyang'],
  'Simeone': ['giuliano-simeone'],
  'Herrera': ['ruben-garcia', 'herrera'],
  'Cubarsí': ['pau-cubarsi'],
  'Isco': ['isco'],
  'Oyarzabal': ['mikel-oyarzabal'],
  'Hjulmand': ['morten-hjulmand'],
  'Hernández': ['juanmi-hernandez', 'aitor-ruibal-hernandez'],
  'Kubo': ['takefusa-kubo'],
  'Raphinha': ['raphinha', 'raphael-dias-belloli'],
  'Baena': ['alex-baena'],
  'Nico Williams': ['nico-williams'],
  'Dumfries': ['denzel-dumfries'],
  'Cucurella': ['marc-cucurella'],
  'Barrenetxea': ['jon-barrenetxea', 'ander-barrenetxea'],
  'Padilla': ['imanol-garcia-de-albeniz', 'padilla'],
  'Chupe': ['chupe'],
  'Gabriel Moscardo': ['gabriel-moscardo'],
};

function extractPhoto(html) {
  const urls = [...html.matchAll(/https?:\/\/assets\.laliga\.com\/squad\/[^"'\s\\]+_0_001_000\.(?:png|jpg)/gi)].map(m => m[0]);
  // Prefer a mid-size version if multiple resolutions found
  const mid = urls.find(u => /\/512x/.test(u)) || urls[0];
  return mid || null;
}

async function main() {
  const results = {};
  for (const [name, slugs] of Object.entries(CANDIDATES)) {
    results[name] = null;
    for (const slug of slugs) {
      const url = `https://www.laliga.com/en-GB/player/${slug}`;
      const { status, body } = await fetchHtml(url);
      console.log(`${name} -> ${slug}: STATUS ${status}, len ${body.length}`);
      if (status === 200) {
        const photo = extractPhoto(body);
        if (photo) {
          console.log(`  PHOTO: ${photo}`);
          results[name] = { slug, photo };
          break;
        } else {
          console.log('  no photo pattern found');
        }
      }
      await new Promise(r => setTimeout(r, 400));
    }
  }
  console.log('=== RESULTS JSON ===');
  console.log(JSON.stringify(results, null, 2));
}
main();
