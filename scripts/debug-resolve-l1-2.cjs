const https = require('https');

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
          resolve(p ? { name: p.strPlayer, nat: p.strNationality, team: p.strTeam, photo: p.strThumb || p.strCutout || null } : null);
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

const queries = {
  'Ganiou|Ligue 1': ['Ismaëlo Ganiou', 'Pierre-Ismaëlo Ganiou', 'Ganiou'],
  'Abner Vinícius|Ligue 1': ['Abner', 'Abner Vinicius', 'Abner Vinícius'],
  'Zabarnyi|Ligue 1': ['Illia Zabarnyi', 'Ilya Zabarnyi', 'Zabarnyi'],
  'Belazzoug|Ligue 1': ['Kilian Belazzoug', 'Belazzoug'],
  'Ndiaye|Ligue 1': ['Rassoul Ndiaye', 'Ndiaye Le Havre'],
  'Lemaître|Ligue 1': ['Nicolas Lemaître', 'Nicolas Lemaitre', 'Lemaître'],
};

async function main() {
  const changes = {};
  for (const [key, names] of Object.entries(queries)) {
    let found = null;
    for (const n of names) {
      process.stdout.write(`[${key}] "${n}" ... `);
      found = await fetchPhoto(n);
      console.log(found ? `OK -> ${found.name} (${found.nat}, ${found.team})` : 'non trouvé');
      await sleep(2500);
      if (found) break;
    }
    if (found) changes[key] = found;
  }
  console.log('\n=== CHANGES_JSON_START ===');
  console.log(JSON.stringify(changes));
  console.log('=== CHANGES_JSON_END ===');
}
main();
