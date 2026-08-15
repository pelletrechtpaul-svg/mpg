/**
 * Récupère la photo de chaque joueur du registre depuis Transfermarkt
 * (remplace/complète les photos TheSportsDB par des photos Transfermarkt,
 * en général mieux référencées pour les joueurs de Liga moins connus).
 *
 * Doit être exécuté avec un accès réseau libre (GitHub Actions), pas
 * depuis un environnement sandboxé dont les requêtes sortantes seraient
 * bloquées silencieusement.
 *
 * Usage: node scripts/backfill-photos-transfermarkt.cjs
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const registryPath = path.join(__dirname, 'players-registry.json');
const photosPath = path.join(__dirname, '../public/players-photos.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

function fetchHtml(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 8000,
    }, res => {
      // Suivre une redirection simple
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchHtml(new URL(res.headers.location, url).toString()).then(resolve);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

async function fetchTransfermarktPhoto(name) {
  const searchUrl = `https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(name)}`;
  const html = await fetchHtml(searchUrl);
  if (!html) return null;
  try {
    const dom = new JSDOM(html);
    const img = dom.window.document.querySelector('table.items img.bilderrahmen-fixed');
    if (!img) return null;
    const src = img.getAttribute('data-src') || img.getAttribute('src');
    if (!src || src.includes('data:image')) return null;
    // Version haute résolution (retire le suffixe de taille réduite si présent)
    return src.replace(/\/(small|head)\//, '/big/');
  } catch {
    return null;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const entries = Object.entries(registry);
  let found = 0, missing = 0;

  for (let i = 0; i < entries.length; i++) {
    const [key, val] = entries[i];
    const surname = key.split('|')[0];
    const name = val.prenom && !surname.startsWith(val.prenom) ? `${val.prenom} ${surname}` : surname;

    process.stdout.write(`[${i + 1}/${entries.length}] ${name} ... `);
    const photo = await fetchTransfermarktPhoto(name);
    if (photo) {
      registry[key].photo = photo;
      found++;
      console.log('✅');
    } else {
      missing++;
      console.log('❌');
    }
    await sleep(400); // respect rate limit
  }

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  const photos = {};
  Object.entries(registry).forEach(([k, v]) => { if (v.photo) photos[k] = v.photo; });
  fs.writeFileSync(photosPath, JSON.stringify(photos, null, 2));

  console.log(`\n✅ ${found} photos trouvées, ❌ ${missing} manquantes.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
