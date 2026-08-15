/**
 * Nettoie la collection `mercato` : ne garde que les entrées d'une saison+ligue
 * données (par défaut celles tout juste importées), supprime tout le reste,
 * puis reconstruit players-registry.json et public/players-photos.json
 * à partir des seules entrées restantes.
 *
 * Usage:
 *   node scripts/reset-mercato.cjs                  ← dry-run, affiche le résumé
 *   DRY_RUN=false node scripts/reset-mercato.cjs     ← supprime pour de vrai
 *
 * Filtre "à garder" configurable via env KEEP_SAISON / KEEP_LIGUE.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const KEEP_SAISON = process.env.KEEP_SAISON || '2026/2027';
const KEEP_LIGUE = process.env.KEEP_LIGUE || 'Liga';

const registryPath = path.join(__dirname, 'players-registry.json');
const photosPublicPath = path.join(__dirname, '../public/players-photos.json');

async function main() {
  console.log(`\n=== RESET MERCATO ===`);
  console.log(`Conservé : saison="${KEEP_SAISON}" ligue="${KEEP_LIGUE}"\n`);

  const snap = await db.collection('mercato').get();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const groups = {};
  all.forEach(d => {
    const key = `${d.saison} | ${d.ligue} | championnat ${d.championnat}`;
    groups[key] = (groups[key] || 0) + 1;
  });

  console.log(`Total en base: ${all.length} entrées mercato\n`);
  console.log('Détail par saison/ligue/championnat :');
  Object.entries(groups).sort().forEach(([k, n]) => console.log(`  ${n === all.length ? '' : ''}${n.toString().padStart(4)}  ${k}`));

  const toKeep = all.filter(d => d.saison === KEEP_SAISON && d.ligue === KEEP_LIGUE);
  const toDelete = all.filter(d => !(d.saison === KEEP_SAISON && d.ligue === KEEP_LIGUE));

  console.log(`\n→ À conserver : ${toKeep.length}`);
  console.log(`→ À supprimer : ${toDelete.length}\n`);

  if (process.env.DRY_RUN === 'false') {
    // Suppression par lots de 499
    for (let i = 0; i < toDelete.length; i += 499) {
      const batch = db.batch();
      toDelete.slice(i, i + 499).forEach(d => batch.delete(db.collection('mercato').doc(d.id)));
      await batch.commit();
    }
    console.log(`✅ ${toDelete.length} entrées supprimées.`);

    // Reconstruction du registre à partir des seules entrées restantes
    const newRegistry = {};
    toKeep.forEach(e => {
      const key = e.joueur + '|' + e.ligue;
      if (!newRegistry[key]) {
        newRegistry[key] = { prenom: e.prenom || null, nationalite: e.nationalite || null, poste: e.poste || null, clubs: e.club ? [e.club] : [] };
      } else {
        if (e.club && !newRegistry[key].clubs.includes(e.club)) newRegistry[key].clubs.push(e.club);
        if (e.prenom && !newRegistry[key].prenom) newRegistry[key].prenom = e.prenom;
      }
    });

    // Conserve les photos déjà connues pour les joueurs qui survivent
    const oldRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    Object.keys(newRegistry).forEach(key => {
      if (oldRegistry[key]?.photo) newRegistry[key].photo = oldRegistry[key].photo;
    });

    fs.writeFileSync(registryPath, JSON.stringify(newRegistry, null, 2));

    const photos = {};
    Object.entries(newRegistry).forEach(([key, val]) => { if (val.photo) photos[key] = val.photo; });
    fs.writeFileSync(photosPublicPath, JSON.stringify(photos, null, 2));

    console.log(`✅ Registre reconstruit : ${Object.keys(newRegistry).length} joueurs.`);
  } else {
    console.log('→ Dry run. Passe DRY_RUN=false pour supprimer pour de vrai.');
  }

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
