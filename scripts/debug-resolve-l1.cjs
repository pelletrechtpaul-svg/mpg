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

const prenoms = {
  'Lepaul': 'Esteban', 'Balogun': 'Folarin', 'Doué': 'Désiré', 'Thauvin': 'Florian',
  'Akliouche': 'Maghnes', 'Tolisso': 'Corentin', 'Openda': 'Loïs', 'Zaïre-Emery': 'Warren',
  'Gboho': 'Yann', 'Godts': 'Mika', 'Kebbal': 'Ilan', 'Godo': 'Martial', 'Nanasi': 'Sebastian',
  'Blas': 'Ludovic', 'Cuisance': 'Michaël', 'Ganiou': 'Ismaëlo', 'Safonov': 'Matvey',
  'Niakhaté': 'Moussa', 'Haraldsson': 'Hákon Arnar', 'Risser': 'Robin', 'Reyna': 'Giovanni',
  'Teze': 'Jordan', 'Thomasson': 'Adrien', 'Kouassi': 'Arsène', 'Cresswell': 'Charlie',
  'Trapp': 'Kevin', 'Zabarnyi': 'Illya', 'Clauss': 'Jonathan', 'Ngoy': 'Nathan',
  'Maitland-Niles': 'Ainsley', 'Bombito': 'Moïse', 'Raolisoa': 'Lilian', 'Coulibaly': 'Mamadou',
  'Mayulu': 'Senny', 'Lloris': 'Gautier', 'Matondo': 'Rudy', 'Sima': 'Abdallah',
  'Diomandé': 'Sinaly', 'Nuamah': 'Ernest', 'Kluivert': 'Ruben', 'Chevalier': 'Lucas',
  'Nkambadio': 'Obed', 'Mosengo': 'Daren', 'Harit': 'Amine', 'Belazzoug': 'Kilian',
  'Kvaratskhelia': 'Khvicha', 'Del Castillo': 'Romain', 'Ndiaye': 'Rassoul', 'Gouiri': 'Amine',
  'Ajorque': 'Ludovic', 'Pagis': 'Pablo', 'Udol': 'Matthieu', 'Rongier': 'Valentin',
  'Embolo': 'Breel', 'Ruiz': 'Fabián', 'Samba': 'Brice', 'Digne': 'Lucas', 'Biereth': 'Mika',
  'Önal': 'Başar', 'Lemaître': 'Nicolas',
};

// Déjà corrigés manuellement (photo confirmée exacte), à ne pas retoucher
const ALREADY_FIXED = new Set(['Dembélé', 'Fati', 'Simon', 'Torres', 'Sulc']);

async function main() {
  const changes = {};
  const l1Keys = Object.keys(registry).filter(k => k.endsWith('|Ligue 1'));

  for (const key of l1Keys) {
    const surname = key.split('|')[0];
    if (ALREADY_FIXED.has(surname)) continue;

    const prenom = prenoms[surname];
    if (prenom) registry[key].prenom = prenom;

    const searchName = prenom ? `${prenom} ${surname}` : surname;
    process.stdout.write(`[${surname}] recherche "${searchName}" ... `);
    const photo = await fetchPhoto(searchName);
    if (photo) {
      registry[key].photo = photo;
      changes[key] = { prenom: registry[key].prenom || null, photo };
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
