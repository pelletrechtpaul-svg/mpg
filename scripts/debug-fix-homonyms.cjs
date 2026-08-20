const https = require('https');

function fetchJson(url) {
  return new Promise(resolve => {
    https.get(url, { timeout: 6000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', () => resolve(null)).on('timeout', () => resolve(null));
  });
}

async function search(name) {
  const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`;
  const json = await fetchJson(url);
  const players = json?.player || [];
  return players.slice(0, 3).map(p => ({ name: p.strPlayer, nat: p.strNationality, team: p.strTeam, photo: p.strThumb || p.strCutout || null }));
}

async function main() {
  for (const q of ['Ousmane Dembélé', 'Ansu Fati', 'Moses Simon', 'Simon Moses', 'Ferran Torres']) {
    const results = await search(q);
    console.log(`\n"${q}":`);
    results.forEach(r => console.log(`  - ${r.name} (${r.nat}, ${r.team}) photo=${r.photo}`));
    await new Promise(r => setTimeout(r, 2500));
  }
}
main();
