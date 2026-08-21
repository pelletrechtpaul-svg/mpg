const https = require('https');

// Reproduit exactement l'URL construite par resizedPhoto() dans PlayerAvatar.jsx
function resized(url, px = 112) {
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&cx=0&cy=0&cw=100%25&ch=65%25&w=${px}&h=${px}&fit=cover&a=top&output=webp&q=80`;
}

const sources = {
  'Belazzoug': 'https://img.sofascore.com/api/v1/player/2334320/image',
  'Ndiaye': 'https://img.sofascore.com/api/v1/player/992026/image',
  'JoaoPedro': 'https://img.sofascore.com/api/v1/player/351734/image',
  'AlissonSantos': 'https://img.sofascore.com/api/v1/player/1122835/image',
  'Rrahmani': 'https://img.sofascore.com/api/v1/player/1124624/image',
  'Douvikas': 'https://img.sofascore.com/api/v1/player/894863/image',
  // Témoin : une photo TheSportsDB qui s'affiche bien dans l'app
  'CONTROL_thesportsdb': 'https://r2.thesportsdb.com/images/media/player/thumb/qar3ii1522247043.jpg',
};

function check(url) {
  return new Promise(resolve => {
    https.get(url, { timeout: 15000 }, res => {
      let len = 0;
      res.on('data', c => len += c.length);
      res.on('end', () => resolve({ status: res.statusCode, contentType: res.headers['content-type'], bytes: len }));
    }).on('error', e => resolve({ error: e.message })).on('timeout', () => resolve({ error: 'timeout' }));
  });
}

async function main() {
  for (const [name, src] of Object.entries(sources)) {
    const r = await check(resized(src));
    console.log('WSRV', name, JSON.stringify(r));
    await new Promise(r => setTimeout(r, 800));
  }
}
main();
