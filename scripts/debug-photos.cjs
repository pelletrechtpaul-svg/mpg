const https = require('https');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'photo-preview');
// fotmob 1021382 = João Pedro, 24 ans, attaquant brésilien de Chelsea (n°20,
// ex-Brighton). À ne pas confondre avec 1637671 (milieu de Vasco da Gama).
const JP = 'https://images.fotmob.com/image_resources/playerimages/1021382.png';

function download(url, dest) {
  return new Promise(resolve => {
    https.get(url, { timeout: 20000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return resolve(`HTTP ${res.statusCode}`); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { fs.writeFileSync(dest, Buffer.concat(chunks)); resolve('ok'); });
    }).on('error', e => resolve(e.message)).on('timeout', () => resolve('timeout'));
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log('joaopedro 1021382 via wsrv :', await download(
    `https://wsrv.nl/?url=${encodeURIComponent(JP)}&w=160&h=160&fit=cover&a=attention&output=png`,
    path.join(OUT, 'zz_joaopedro_1021382.png')));
}
main();
