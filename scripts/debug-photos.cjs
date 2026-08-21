const https = require('https');
const fs = require('fs');
const path = require('path');

const registry = JSON.parse(fs.readFileSync(path.join(__dirname, 'players-registry.json'), 'utf8'));

// Échantillon représentatif : sources et cadrages variés.
const SAMPLE = [
  'Mbeumo|Premier League',
  'Keane|Premier League',
  'Lacroix|Premier League',
  'Gibbs-White|Premier League',
  'Donnarumma|Premier League',
  'Kadioglu|Premier League',   // Getty (photo d'action large)
  'Wesley|Serie A',            // Getty (photo d'action large)
  'Yildiz|Serie A',            // Getty
  'Douvikas|Serie A',          // Sofascore (servi sans proxy)
  'Thauvin|Ligue 1',
  'Chevalier|Ligue 1',
  'Openda|Ligue 1',
];

const OUT = path.join(__dirname, '..', 'photo-preview');

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

// Cadrage actuel : pré-crop sur les 65% du haut, puis carré ancré en haut.
const cropTop = (url, px) =>
  `https://wsrv.nl/?url=${encodeURIComponent(url)}&cx=0&cy=0&cw=100%25&ch=65%25&w=${px}&h=${px}&fit=cover&a=top&output=png`;
// Cadrage intelligent libvips (saillance + tons chair).
const cropAttention = (url, px) =>
  `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${px}&h=${px}&fit=cover&a=attention&output=png`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const key of SAMPLE) {
    const entry = registry[key];
    if (!entry?.photo) { console.log('SKIP (pas de photo)', key); continue; }
    const slug = key.replace(/[^A-Za-z0-9]+/g, '_');
    console.log(key,
      'top:', await download(cropTop(entry.photo, 160), path.join(OUT, `${slug}__1_top.png`)),
      '| attention:', await download(cropAttention(entry.photo, 160), path.join(OUT, `${slug}__2_attention.png`)));
    await new Promise(r => setTimeout(r, 400));
  }
  console.log('\nFichiers écrits :', fs.readdirSync(OUT).length);
}
main();
