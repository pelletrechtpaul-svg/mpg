const https = require('https');

function getJson(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'Accept': 'application/json',
      },
      timeout: 8000,
    }, res => {
      console.log('STATUS:', res.statusCode);
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('LENGTH:', data.length);
        console.log('FIRST 500:', data.slice(0, 500));
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', e => { console.log('ERROR:', e.message); resolve(null); });
    req.on('timeout', () => { console.log('TIMEOUT'); req.destroy(); resolve(null); });
  });
}

async function main() {
  const json = await getJson('https://www.fotmob.com/api/searchapi/search?term=Isco&userLang=en');
  console.log('---PARSED---');
  console.log(JSON.stringify(json, null, 2)?.slice(0, 2000));
}
main();
