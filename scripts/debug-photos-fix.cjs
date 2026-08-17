const https = require('https');

function fetchUrl(url) {
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

function extractLaligaPhoto(html) {
  const urls = [...html.matchAll(/https?:\/\/assets\.laliga\.com\/squad\/[^"'\s\\]+_0_001_000\.(?:png|jpg)/gi)].map(m => m[0]);
  return urls.find(u => /\/512x/.test(u)) || urls[0] || null;
}

const LALIGA_SLUGS = {
  'Pedri': 'pedri',
  'Antony': 'antony',
  'Gavi': 'gavi',
  'Padilla': 'alex-padilla',
  'Gabriel Moscardo': 'gabriel-moscardo',
};

async function main() {
  for (const [name, slug] of Object.entries(LALIGA_SLUGS)) {
    const url = `https://www.laliga.com/en-GB/player/${slug}`;
    const { status, body } = await fetchUrl(url);
    console.log(`${name} -> ${slug}: STATUS ${status}, len ${body.length}`);
    if (status === 200) {
      const photo = extractLaligaPhoto(body);
      console.log(photo ? `  PHOTO: ${photo}` : '  no photo pattern found');
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Chupe: club officiel Málaga CF (hors LaLiga top-flight)
  const chupeUrl = 'https://www.malagacf.com/en/players/chupe';
  const chupe = await fetchUrl(chupeUrl);
  console.log(`Chupe -> malagacf.com: STATUS ${chupe.status}, len ${chupe.body.length}`);
  if (chupe.status === 200) {
    const ogImage = chupe.body.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    console.log('  OG:IMAGE:', ogImage?.[1] || 'none');
    const imgUrls = [...chupe.body.matchAll(/https?:\/\/[^"'\s\\]+\.(?:png|jpg|jpeg|webp)/gi)].map(m => m[0]);
    console.log('  sample imgs:', [...new Set(imgUrls)].filter(u => /chupe|player|jugador/i.test(u)).slice(0, 5));
  }

  // TheSportsDB avec nom corrigé (juste "Gavi", "Chupe", "Carlos Ruiz")
  for (const q of ['Gavi', 'Chupe', 'Carlos Ruiz Rubio']) {
    const sdbUrl = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(q)}`;
    const { status, body } = await fetchUrl(sdbUrl);
    console.log(`TheSportsDB "${q}": STATUS ${status}`);
    try {
      const json = JSON.parse(body);
      const players = json.player || [];
      players.slice(0, 3).forEach(p => console.log(`  - ${p.strPlayer} (${p.strNationality}, ${p.strTeam}) photo=${p.strThumb || p.strCutout || 'none'}`));
      if (players.length === 0) console.log('  no results');
    } catch { console.log('  parse error'); }
    await new Promise(r => setTimeout(r, 500));
  }
}
main();
