const https = require('https');
const fs = require('fs');
const path = require('path');

const registryPath = path.join(__dirname, 'players-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchPhotoOnce(name) {
  return new Promise(resolve => {
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`;
    https.get(url, { timeout: 6000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const p = json.player?.[0];
          resolve(p?.strThumb || p?.strCutout || null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null)).on('timeout', () => resolve(null));
  });
}

async function fetchPhoto(name) {
  const first = await fetchPhotoOnce(name);
  if (first) return first;
  await sleep(8000);
  return fetchPhotoOnce(name);
}

async function main() {
  const changes = {};
  const keys = Object.keys(registry).filter(k => k.endsWith('|Premier League') && !registry[k].photo);

  for (const key of keys) {
    const surname = key.split('|')[0];
    const prenom = registry[key].prenom;
    const searchName = prenom ? `${prenom} ${surname}` : surname;
    process.stdout.write(`[${surname}] "${searchName}" ... `);
    const photo = await fetchPhoto(searchName);
    if (photo) {
      changes[key] = { photo };
      console.log('OK');
    } else {
      console.log('non trouvé');
    }
    await sleep(2500);
  }

  console.log('\n=== CHANGES_JSON_START ===');
  console.log(JSON.stringify(changes));
  console.log('=== CHANGES_JSON_END ===');
}
main();
