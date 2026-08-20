/**
 * Script d'import mercato pour une nouvelle saison.
 *
 * Usage:
 *   node scripts/import-mercato.cjs <fichier.json>
 *   DRY_RUN=false node scripts/import-mercato.cjs <fichier.json>   ← écrit en DB
 *
 * Format du fichier d'entrée (généré par Claude depuis un screen) :
 * {
 *   "ligue": "Liga",
 *   "championnat": "next",   // ou numéro explicite
 *   "tour": 1,
 *   "saison": "2026/2027",
 *   "joueurs": [
 *     {
 *       "joueur": "Yamal",
 *       "poste": "A",
 *       "club": "Barcelona",
 *       "prix": 45,
 *       "acheteur": "Paul",
 *       "equipe_acheteur": "Tout en Miam",
 *       "encheres_perdues": [{ "equipe": "Les ananas", "prix": 40 }]
 *     }
 *   ]
 * }
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const https = require('https');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const NAT_NORM = {
  'Algérienne':'Algérien','Allemande':'Allemand','Américaine':'Américain',
  'Anglaise':'Anglais','Angolaise':'Angolais','Argentine':'Argentin',
  'Brésilienne':'Brésilien','Colombienne':'Colombien','Congolaise':'Congolais',
  'Espagnole':'Espagnol','Française':'Français','Galloise':'Gallois',
  'Ghanéenne':'Ghanéen','Grecque':'Grec','Guinéenne':'Guinéen',
  'Islandaise':'Islandais','Ivoirienne':'Ivoirien','Japonaise':'Japonais',
  'Malienne':'Malien','Marocaine':'Marocain','Néerlandaise':'Néerlandais',
  'Nigériane':'Nigérian','Norvégienne':'Norvégien','Paraguayenne':'Paraguayen',
  'Polonaise':'Polonais','Portugaise':'Portugais','Roumaine':'Roumain',
  'Sénégalaise':'Sénégalais','Suédoise':'Suédois','Turque':'Turc',
  'Ukrainienne':'Ukrainien','Uruguayenne':'Uruguayen','Zimbabwéenne':'Zimbabwéen',
  'Écossaise':'Écossais','Égyptienne':'Égyptien','Équatorienne':'Équatorien',
};

const registryPath = path.join(__dirname, 'players-registry.json');
const photosPublicPath = path.join(__dirname, '../public/players-photos.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

function fetchPhotoFromSportsDB(playerName) {
  return new Promise(resolve => {
    const query = encodeURIComponent(playerName);
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${query}`;
    https.get(url, { timeout: 5000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const player = json.player?.[0];
          resolve(player?.strThumb || player?.strCutout || null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null)).on('timeout', () => resolve(null));
  });
}

// Source unique : TheSportsDB (95% de couverture mesurée par audit, meilleure
// que Wikipedia en repli qui n'apportait aucune récupération réelle en plus
// et renvoyait parfois carrément la mauvaise personne).
async function fetchPlayerPhoto(searchName) {
  const photo = await fetchPhotoFromSportsDB(searchName);
  return photo ? { photo, source: 'TheSportsDB' } : null;
}

// Détecte les noms de joueurs proches d'une fiche déjà existante dans le
// registre (autre clé) — évite de créer une fiche en double pour le même
// joueur réel suite à une variante d'orthographe ou de prénom.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function findSimilarRegistryKeys(joueur, ligue, registry) {
  const target = joueur.toLowerCase();
  const exactKey = joueur + '|' + ligue;
  return Object.keys(registry).filter(key => {
    if (key === exactKey) return false;
    const [name, keyLigue] = key.split('|');
    if (keyLigue !== ligue) return false;
    const dist = levenshtein(target, name.toLowerCase());
    return dist > 0 && dist <= 2;
  });
}

function writePhotosPublic() {
  const photos = {};
  Object.entries(registry).forEach(([key, val]) => {
    if (val.photo) photos[key] = val.photo;
  });
  fs.writeFileSync(photosPublicPath, JSON.stringify(photos, null, 2));
}

async function getNextChampionnat(ligue) {
  const snap = await db.collection('mercato').where('ligue', '==', ligue).get();
  let max = 0;
  snap.docs.forEach(d => { if (d.data().championnat > max) max = d.data().championnat; });
  return max + 1;
}

async function checkDuplicate(joueur, ligue, championnat, tour) {
  const snap = await db.collection('mercato')
    .where('joueur', '==', joueur)
    .where('ligue', '==', ligue)
    .where('championnat', '==', championnat)
    .where('tour', '==', tour)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) { console.error('Usage: node import-mercato.cjs <fichier.json>'); process.exit(1); }

  const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const { ligue, tour, saison, joueurs } = input;
  const championnat = input.championnat === 'next'
    ? await getNextChampionnat(ligue)
    : Number(input.championnat);

  console.log(`\n=== IMPORT MERCATO ===`);
  console.log(`Ligue: ${ligue} | Championnat: ${championnat} | Tour: ${tour} | Saison: ${saison}`);
  console.log(`Joueurs: ${joueurs.length}\n`);

  const toWrite = [];
  const warnings = [];

  for (const j of joueurs) {
    const regKey = j.joueur + '|' + ligue;
    const known = registry[regKey];

    const nat = j.nationalite || known?.nationalite || null;
    const entry = {
      joueur: j.joueur,
      ligue,
      championnat,
      tour,
      saison,
      poste: j.poste || known?.poste || null,
      club: j.club || known?.clubs?.[0] || null,
      prix: j.prix,
      acheteur: j.acheteur,
      equipe_acheteur: j.equipe_acheteur || null,
      encheres_perdues: j.encheres_perdues || [],
      nationalite: NAT_NORM[nat] || nat,
    };

    const prenom = j.prenom || known?.prenom || null;
    if (prenom && !entry.joueur.startsWith(prenom)) entry.prenom = prenom;

    // Photo auto pour les nouveaux joueurs (TheSportsDB, source unique)
    if (!known || !known.photo) {
      const searchName = entry.prenom ? `${entry.prenom} ${j.joueur}` : j.joueur;
      const result = await fetchPlayerPhoto(searchName);
      const regKey2 = j.joueur + '|' + ligue;
      if (!registry[regKey2]) registry[regKey2] = { prenom: entry.prenom || null, nationalite: entry.nationalite, poste: entry.poste, clubs: entry.club ? [entry.club] : [], photo: null };
      if (result) { registry[regKey2].photo = result.photo; console.log(`  📸 Photo trouvée (${result.source}): ${searchName}`); }
    }

    const dupes = await checkDuplicate(j.joueur, ligue, championnat, tour);
    if (dupes.length > 0) warnings.push(`⚠️  DOUBLON: ${j.joueur} déjà en DB (id: ${dupes[0].id})`);
    if (!known) {
      warnings.push(`❓ INCONNU: ${j.joueur} — vérifier prenom/nationalite`);
      const similar = findSimilarRegistryKeys(j.joueur, ligue, registry);
      if (similar.length) {
        warnings.push(`🔎 NOM PROCHE: "${j.joueur}" ressemble à ${similar.map(k => `"${k.split('|')[0]}"`).join(', ')} déjà en registre — vérifier qu'il ne s'agit pas du même joueur avant d'importer (sinon fiche dupliquée).`);
      }
    }

    toWrite.push(entry);
    const prenomDisplay = entry.prenom ? entry.prenom + ' ' : '';
    console.log(`${known ? '✅' : '❓'} ${prenomDisplay}${j.joueur} | ${entry.poste} | ${entry.nationalite || '?'} | ${entry.club || '?'} → ${j.acheteur} ${j.prix}M`);
  }

  if (warnings.length) {
    console.log('\n=== AVERTISSEMENTS ===');
    warnings.forEach(w => console.log(w));
  }

  if (warnings.some(w => w.startsWith('⚠️'))) {
    console.log('\n❌ Doublons détectés — corrige le fichier et relance.');
    process.exit(1);
  }

  console.log(`\n→ ${toWrite.length} entrées prêtes.`);

  if (process.env.DRY_RUN === 'false') {
    const chunks = [];
    for (let i = 0; i < toWrite.length; i += 499) chunks.push(toWrite.slice(i, i+499));
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach(e => batch.set(db.collection('mercato').doc(), e));
      await batch.commit();
    }
    console.log(`✅ ${toWrite.length} joueurs importés.`);

    // Mise à jour du registre
    toWrite.forEach(e => {
      const key = e.joueur + '|' + e.ligue;
      if (!registry[key]) {
        registry[key] = { prenom: e.prenom || null, nationalite: e.nationalite, poste: e.poste, clubs: e.club ? [e.club] : [] };
      } else {
        if (e.club && !registry[key].clubs.includes(e.club)) registry[key].clubs.push(e.club);
        if (e.prenom && !registry[key].prenom) registry[key].prenom = e.prenom;
      }
    });
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    writePhotosPublic();
    console.log('✅ Registre et photos mis à jour.');
  } else {
    console.log('  → Dry run. Passe DRY_RUN=false pour écrire en DB.');
  }

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
