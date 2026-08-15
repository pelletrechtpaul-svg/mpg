/**
 * Récupère la photo de chaque joueur du registre depuis Wikipedia
 * (très bonne couverture pour les footballeurs pro, API publique sans blocage).
 *
 * Usage: node scripts/backfill-photos-wikipedia.cjs
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const registryPath = path.join(__dirname, 'players-registry.json');
const photosPath = path.join(__dirname, '../public/players-photos.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

function getJson(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'MesPetitsBavons/1.0 (private fantasy football app; contact: n/a)',
        'Accept': 'application/json',
      },
      timeout: 8000,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function searchWikipediaTitle(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`;
  const json = await getJson(url);
  return json?.query?.search?.[0]?.title || null;
}

async function fetchSummaryPhoto(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const json = await getJson(url);
  if (!json) return null;
  // Évite les pages de désambiguïsation / non-personnes
  if (json.type === 'disambiguation') return null;
  return json.originalimage?.source || json.thumbnail?.source || null;
}

async function fetchWikipediaPhoto(name, club) {
  const queries = [
    `${name} footballer ${club || ''}`.trim(),
    `${name} footballer`,
    name,
    `${name} (footballer)`,
  ];
  const triedTitles = new Set();
  for (const q of queries) {
    const title = await searchWikipediaTitle(q);
    if (!title || triedTitles.has(title)) continue;
    triedTitles.add(title);
    const photo = await fetchSummaryPhoto(title);
    if (photo) return photo;
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const entries = Object.entries(registry);
  let found = 0, missing = 0, skipped = 0;

  for (let i = 0; i < entries.length; i++) {
    const [key, val] = entries[i];
    if (val.photo) { skipped++; continue; }

    const surname = key.split('|')[0];
    const name = val.prenom && !surname.startsWith(val.prenom) ? `${val.prenom} ${surname}` : surname;
    const club = val.clubs?.[0] || '';

    process.stdout.write(`[${i + 1}/${entries.length}] ${name} ... `);
    const photo = await fetchWikipediaPhoto(name, club);
    if (photo) {
      registry[key].photo = photo;
      found++;
      console.log('✅');
    } else {
      missing++;
      console.log('❌');
    }
    await sleep(250);
  }

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  const photos = {};
  Object.entries(registry).forEach(([k, v]) => { if (v.photo) photos[k] = v.photo; });
  fs.writeFileSync(photosPath, JSON.stringify(photos, null, 2));

  console.log(`\n✅ ${found} nouvelles photos, ⏭️  ${skipped} déjà connues, ❌ ${missing} introuvables.`);
  console.log(`public/players-photos.json: ${Object.keys(photos).length} entrées au total.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
