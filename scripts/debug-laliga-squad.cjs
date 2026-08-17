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
      console.log('STATUS:', res.statusCode, 'for', url);
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        console.log('REDIRECT TO:', res.headers.location);
        return fetchHtml(res.headers.location).then(resolve);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', e => { console.log('ERROR:', e.message); resolve(''); });
    req.on('timeout', () => { console.log('TIMEOUT'); req.destroy(); resolve(''); });
  });
}

// Clubs à couvrir pour les 20 joueurs manquants
const CLUB_SLUGS = {
  'Atlético': 'atletico-de-madrid',
  'Real Sociedad': 'real-sociedad',
  'La Corogne': 'deportivo-de-la-coruna',
  'Osasuna': 'osasuna',
  'Barcelona': 'fc-barcelona',
  'Betis': 'real-betis',
  'Athletic': 'athletic-club',
  'Real Madrid': 'real-madrid',
  'Málaga': 'malaga-cf',
  'Espanyol': 'espanyol',
};

async function main() {
  for (const [club, slug] of Object.entries(CLUB_SLUGS)) {
    const html = await fetchHtml(`https://www.laliga.com/en-GB/clubs/${slug}/squad`);
    console.log(`=== ${club} (${slug}) LENGTH:`, html.length);
    // Cherche les URLs d'images joueurs du CDN assets.laliga.com/squad/...
    const urls = [...html.matchAll(/https?:\/\/assets\.laliga\.com\/squad\/[^"'\s\\]+\.(?:png|jpg|jpeg)/gi)].map(m => m[0]);
    const unique = [...new Set(urls)];
    console.log(`  ${unique.length} URLs joueurs trouvées`);
    console.log(unique.slice(0, 5));
    // Cherche aussi les noms proches (JSON embarqué next.js)
    const nameMatches = [...html.matchAll(/"name"\s*:\s*"([^"]+)"[^}]{0,200}?"id"\s*:\s*"?(\d+)"?/gi)].slice(0, 5);
    console.log('  sample name/id pairs:', nameMatches.map(m => [m[1], m[2]]));
    await new Promise(r => setTimeout(r, 500));
  }
}
main();
