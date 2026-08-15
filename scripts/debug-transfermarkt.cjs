const https = require('https');

function fetchHtml(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 8000,
    }, res => {
      console.log('STATUS:', res.statusCode);
      console.log('HEADERS:', JSON.stringify(res.headers, null, 2));
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', e => { console.log('ERROR:', e.message); resolve(''); });
    req.on('timeout', () => { console.log('TIMEOUT'); req.destroy(); resolve(''); });
  });
}

async function main() {
  const html = await fetchHtml('https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=Kylian%20Mbapp%C3%A9');
  console.log('LENGTH:', html.length);
  console.log('FIRST 1000 CHARS:');
  console.log(html.slice(0, 1000));
  console.log('---');
  console.log('CONTAINS bilderrahmen:', html.includes('bilderrahmen'));
  console.log('CONTAINS captcha:', html.toLowerCase().includes('captcha'));
  console.log('CONTAINS cloudflare:', html.toLowerCase().includes('cloudflare') || html.toLowerCase().includes('cf-'));
  console.log('CONTAINS access denied:', html.toLowerCase().includes('access denied') || html.toLowerCase().includes('forbidden'));
}
main();
