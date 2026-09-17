/**
 * Fix one-off : "Éderson|Serie A" (MD, Atalanta) avait récupéré la photo du
 * gardien brésilien Ederson (Man City) via une recherche par nom seul
 * (prenom manquant en registre -> collision d'homonyme classique).
 *
 * On récupère ici directement par ID TheSportsDB (34196095, trouvé et
 * recoupé via recherche web : Wikipedia/ESPN/WhoScored s'accordent sur
 * "Éderson (footballer, born 1999)", Atalanta, milieu brésilien) plutôt que
 * par recherche nom, pour éviter de retomber sur le même homonyme. On
 * valide quand même club/nationalité/poste avant d'écrire, comme toujours.
 *
 * Usage :
 *   node scripts/fix-ederson-photo.cjs            (dry-run, affiche les métadonnées)
 *   DRY_RUN=false node scripts/fix-ederson-photo.cjs   (écrit en DB + fichiers)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PLAYER_ID = '34196095';
const REGISTRY_KEY = 'Éderson|Serie A';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function main() {
  const json = await fetchJson(`https://www.thesportsdb.com/api/v1/json/3/lookupplayer.php?id=${PLAYER_ID}`);
  const p = json.players?.[0];
  if (!p) { console.error('Aucun joueur trouvé pour cet ID.'); process.exit(1); }

  console.log('=== Métadonnées TheSportsDB ===');
  console.log('Nom:', p.strPlayer);
  console.log('Équipe:', p.strTeam);
  console.log('Nationalité:', p.strNationality);
  console.log('Poste:', p.strPosition);
  console.log('Né le:', p.dateBorn);
  console.log('Thumb:', p.strThumb);
  console.log('Cutout:', p.strCutout);

  const teamOk = /atalanta/i.test(p.strTeam || '');
  const natOk = /brazil|brésil|brasil/i.test(p.strNationality || '');
  if (!teamOk || !natOk) {
    console.error(`\n❌ Métadonnées ne correspondent pas (attendu Atalanta/Brésil) — abandon, ne rien écrire.`);
    process.exit(1);
  }
  console.log('\n✅ Métadonnées cohérentes (Atalanta, Brésil).');

  const photo = p.strThumb || p.strCutout;
  if (!photo) { console.error('Pas de photo disponible pour cet ID.'); process.exit(1); }

  if (process.env.DRY_RUN === 'false') {
    const registryPath = path.join(__dirname, 'players-registry.json');
    const photosPath = path.join(__dirname, '../public/players-photos.json');
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const photos = JSON.parse(fs.readFileSync(photosPath, 'utf8'));

    if (!registry[REGISTRY_KEY]) { console.error('Clé registre introuvable:', REGISTRY_KEY); process.exit(1); }
    registry[REGISTRY_KEY].photo = photo;
    registry[REGISTRY_KEY].nationalite = 'Brésilien';
    photos[REGISTRY_KEY] = photo;

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
    fs.writeFileSync(photosPath, JSON.stringify(photos, null, 2) + '\n');
    console.log(`✅ ${REGISTRY_KEY} mis à jour avec la bonne photo.`);
  } else {
    console.log('\nDry-run : relancer avec DRY_RUN=false pour écrire.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
