const https = require('https');

const SOFA = 'https://img.sofascore.com/api/v1/player/894863/image';

function get(url, headers = {}) {
  return new Promise(resolve => {
    https.get(url, { timeout: 15000, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        contentType: res.headers['content-type'],
        location: res.headers.location,
        bytes: Buffer.concat(chunks).length,
        body: (res.headers['content-type'] || '').includes('json') ? Buffer.concat(chunks).toString().slice(0, 300) : undefined,
      }));
    }).on('error', e => resolve({ error: e.message })).on('timeout', () => resolve({ error: 'timeout' }));
  });
}

async function main() {
  // 1. Message d'erreur exact de wsrv avec les params de l'app
  const full = `https://wsrv.nl/?url=${encodeURIComponent(SOFA)}&cx=0&cy=0&cw=100%25&ch=65%25&w=112&h=112&fit=cover&a=top&output=webp&q=80`;
  console.log('1. WSRV full params:', JSON.stringify(await get(full)));

  // 2. wsrv sans aucun paramètre de crop
  console.log('2. WSRV bare:', JSON.stringify(await get(`https://wsrv.nl/?url=${encodeURIComponent(SOFA)}`)));

  // 3. wsrv avec l'url NON encodée (wsrv accepte aussi ce format)
  console.log('3. WSRV raw url:', JSON.stringify(await get(`https://wsrv.nl/?url=img.sofascore.com/api/v1/player/894863/image`)));

  // 4. Sofascore en direct, sans Referer (comme un <img> cross-origin)
  console.log('4. Direct no-referer:', JSON.stringify(await get(SOFA)));

  // 5. Sofascore en direct avec un Referer de navigateur
  console.log('5. Direct with referer:', JSON.stringify(await get(SOFA, {
    Referer: 'https://mespetitsbavons.vercel.app/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
  })));
}
main();
