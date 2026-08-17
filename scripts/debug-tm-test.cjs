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
      console.log('STATUS:', res.statusCode, 'headers:', JSON.stringify(res.headers));
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', e => { console.log('ERROR:', e.message); resolve({ status: 0, body: '' }); });
    req.on('timeout', () => { console.log('TIMEOUT'); req.destroy(); resolve({ status: 0, body: '' }); });
  });
}

async function main() {
  const { status, body } = await fetchHtml('https://www.transfermarkt.com/takefusa-kubo/profil/spieler/405398');
  console.log('LENGTH:', body.length);
  const ogImage = body.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  console.log('OG:IMAGE:', ogImage?.[1] || 'none');
}
main();
