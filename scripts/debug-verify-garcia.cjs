const https = require('https');

function get(url) {
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', e => resolve({ error: e.message }));
  });
}

async function main() {
  const r = await get('https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=Gonzalo%20Garcia');
  console.log('--- TheSportsDB searchplayers ---');
  console.log(r.status, r.data);
}

main();
