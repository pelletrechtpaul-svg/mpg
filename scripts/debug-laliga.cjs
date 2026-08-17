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

async function main() {
  // Essai 1: page joueur LaLiga (Mbappé)
  const html = await fetchHtml('https://www.laliga.com/en-GB/player/kylian-mbappe-lottin');
  console.log('LENGTH:', html.length);

  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  console.log('OG:IMAGE:', ogImage?.[1] || 'none');

  const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
  console.log('IMG TAGS FOUND:', imgMatches.length);
  console.log(imgMatches.filter(u => /player|mbapp|headshot|profile/i.test(u)).slice(0, 10));

  // Cherche toute URL d'image dans le HTML/JSON embarqué (SPA type Next.js)
  const anyImgUrl = [...html.matchAll(/https?:\/\/[^"'\s\\]+\.(?:png|jpg|jpeg|webp)/gi)].map(m => m[0]);
  const uniqueImgUrls = [...new Set(anyImgUrl)];
  console.log('ALL IMAGE URLS IN PAGE (', uniqueImgUrls.length, '):');
  console.log(uniqueImgUrls.filter(u => /player|mbapp|33812|headshot/i.test(u)).slice(0, 10));
  console.log('--- sample ---');
  console.log(uniqueImgUrls.slice(0, 20));
}
main();
