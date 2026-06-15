const https = require('https');
const fs = require('fs');
const path = require('path');

const registryPath = path.join(__dirname, 'players-registry.json');
const photosPath = path.join(__dirname, '../public/players-photos.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

function fetchPhoto(playerName) {
  return new Promise(resolve => {
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(playerName)}`;
    const req = https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const p = json.player?.[0];
          resolve(p?.strThumb || p?.strCutout || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(6000, () => { req.destroy(); resolve(null); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const entries = Object.entries(registry);
  let found = 0, missing = 0;

  for (let i = 0; i < entries.length; i++) {
    const [key, val] = entries[i];
    if (val.photo) { found++; continue; }

    const name = val.prenom
      ? `${val.prenom} ${key.split('|')[0]}`
      : key.split('|')[0];

    process.stdout.write(`[${i+1}/${entries.length}] ${name} ... `);
    const photo = await fetchPhoto(name);
    if (photo) {
      registry[key].photo = photo;
      found++;
      console.log('✅');
    } else {
      missing++;
      console.log('❌');
    }
    await sleep(300); // respect rate limit
  }

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  const photos = {};
  Object.entries(registry).forEach(([k, v]) => { if (v.photo) photos[k] = v.photo; });
  fs.writeFileSync(photosPath, JSON.stringify(photos, null, 2));

  console.log(`\n✅ ${found} photos trouvées, ${missing} non trouvées.`);
  console.log(`public/players-photos.json mis à jour (${Object.keys(photos).length} entrées).`);
}

main().catch(console.error);
