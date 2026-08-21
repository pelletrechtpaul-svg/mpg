const https = require('https');

const urls = {
  'Ganiou': 'https://img.sofascore.com/api/v1/player/1408080/image',
  'Abner_a': 'https://img.sofascore.com/api/v1/player/973838/image',
  'Abner_b': 'https://img.sofascore.com/api/v1/player/1462712/image',
  'Zabarnyi': 'https://img.sofascore.com/api/v1/player/1023567/image',
  'JoaoPedro_a': 'https://img.sofascore.com/api/v1/player/975079/image',
  'JoaoPedro_b': 'https://img.sofascore.com/api/v1/player/351734/image',
  'Kadioglu': 'https://img.sofascore.com/api/v1/player/825844/image',
  'AlyssonEdward': 'https://img.sofascore.com/api/v1/player/1631879/image',
  'Wesley': 'https://img.sofascore.com/api/v1/player/1134200/image',
  'AlissonSantos': 'https://img.sofascore.com/api/v1/player/1122835/image',
  'Yildiz': 'https://img.sofascore.com/api/v1/player/1149011/image',
  'Rrahmani': 'https://img.sofascore.com/api/v1/player/1124624/image',
  'CarlosAugusto': 'https://img.sofascore.com/api/v1/player/929199/image',
  'Douvikas': 'https://img.sofascore.com/api/v1/player/894863/image',
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
