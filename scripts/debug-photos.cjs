const https = require('https');

function get(url, headers = {}) {
  return new Promise(resolve => {
    https.get(url, { timeout: 15000, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || '';
        resolve({
          status: res.statusCode,
          contentType: ct,
          bytes: buf.length,
          body: ct.includes('json') ? buf.toString().slice(0, 400) : undefined,
        });
      });
    }).on('error', e => resolve({ error: e.message })).on('timeout', () => resolve({ error: 'timeout' }));
  });
}

// --- 1. Sources candidates pour João Pedro (Chelsea) ---
const joaoPedro = {
  'fotmob_1637671': 'https://images.fotmob.com/image_resources/playerimages/1637671.png',
  'sofascore_975079_chelsea': 'https://img.sofascore.com/api/v1/player/975079/image',
};

// --- 2. Recadrage : comparer le crop actuel (top 65%) et le smart crop ---
const sample = 'https://r2.thesportsdb.com/images/media/player/thumb/okvymp1625573781.jpg'; // Thauvin
const currentCrop = `https://wsrv.nl/?url=${encodeURIComponent(sample)}&cx=0&cy=0&cw=100%25&ch=65%25&w=112&h=112&fit=cover&a=top&output=webp&q=80`;
const attentionCrop = `https://wsrv.nl/?url=${encodeURIComponent(sample)}&w=112&h=112&fit=cover&a=attention&output=webp&q=80`;
const entropyCrop = `https://wsrv.nl/?url=${encodeURIComponent(sample)}&w=112&h=112&fit=cover&a=entropy&output=webp&q=80`;

// --- 3. Le smart crop marche-t-il aussi sur une photo d'action large (Getty) ? ---
const gettyWide = 'https://media.gettyimages.com/id/2171889129/fr/photo/lens-abner-vinicius-of-olympique-lyonnais-during-the-french-ligue-1-match-between-rc-lens-and.jpg?s=612x612&w=0&k=20&c=JdwDLrKRrsPodpfaGVCnP1CS704DxLlp26U7dJCvac8=';
const gettyAttention = `https://wsrv.nl/?url=${encodeURIComponent(gettyWide)}&w=112&h=112&fit=cover&a=attention&output=webp&q=80`;

async function main() {
  console.log('=== JOAO PEDRO ===');
  for (const [name, url] of Object.entries(joaoPedro)) {
    console.log(name, JSON.stringify(await get(url)));
  }

  console.log('\n=== CROP MODES (Thauvin, thesportsdb) ===');
  console.log('current(top65%)', JSON.stringify(await get(currentCrop)));
  console.log('attention      ', JSON.stringify(await get(attentionCrop)));
  console.log('entropy        ', JSON.stringify(await get(entropyCrop)));

  console.log('\n=== SMART CROP SUR PHOTO GETTY LARGE (Abner) ===');
  console.log('attention', JSON.stringify(await get(gettyAttention)));
}
main();
