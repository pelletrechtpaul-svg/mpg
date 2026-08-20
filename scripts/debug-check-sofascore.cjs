const https = require('https');

const urls = {
  'Ganiou': 'https://img.sofascore.com/api/v1/player/1408080/image',
  'Abner': 'https://img.sofascore.com/api/v1/player/973838/image',
  'Zabarnyi': 'https://img.sofascore.com/api/v1/player/1023567/image',
  'Belazzoug': 'https://img.sofascore.com/api/v1/player/2334320/image',
  'Ndiaye': 'https://img.sofascore.com/api/v1/player/992026/image',
};

function check(url) {
  return new Promise(resolve => {
    https.get(url, { timeout: 8000 }, res => {
      let len = 0;
      res.on('data', c => len += c.length);
      res.on('end', () => resolve({ status: res.statusCode, contentType: res.headers['content-type'], bytes: len }));
    }).on('error', e => resolve({ error: e.message })).on('timeout', () => resolve({ error: 'timeout' }));
  });
}

async function main() {
  for (const [name, url] of Object.entries(urls)) {
    const r = await check(url);
    console.log(name, url, JSON.stringify(r));
  }
}
main();
