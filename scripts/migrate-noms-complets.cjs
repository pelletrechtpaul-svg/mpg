/**
 * Migration one-off : le champ `joueur` passe du nom de famille seul
 * ("Valverde") au nom complet ("Federico Valverde"), pour que deux
 * footballeurs de même nom de famille ne fusionnent plus en une seule fiche.
 * Les joueurs connus sous un seul nom (Pedri, Raphinha…) ne changent pas.
 *
 * Source du prénom : scripts/players-registry.json (clé "joueur|ligue").
 * Renomme `joueur` dans mercato et dans matches (buteurs[] et notes[]).
 *
 * Usage :
 *   node scripts/migrate-noms-complets.cjs                 simulation (liste des renommages)
 *   DRY_RUN=false node scripts/migrate-noms-complets.cjs   écrit en DB
 *   REGISTRY_ONLY=true node scripts/migrate-noms-complets.cjs
 *     renomme les clés de players-registry.json et public/players-photos.json
 *     (à lancer et committer juste après l'écriture en DB, sans accès DB).
 */
const fs = require('fs');
const path = require('path');

const registryPath = path.join(__dirname, 'players-registry.json');
const photosPath = path.join(__dirname, '../public/players-photos.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const fullName = (nom, prenom) => (prenom && !nom.startsWith(prenom) ? `${prenom} ${nom}` : nom);

// "ligue|ancien nom" -> nouveau nom, pour les seuls joueurs qui changent.
const renames = new Map();
Object.entries(registry).forEach(([key, v]) => {
  const [nom, ligue] = key.split('|');
  const nouveau = fullName(nom, v.prenom);
  if (nouveau !== nom) renames.set(`${ligue}|${nom}`, nouveau);
});

function checkRegistry() {
  const problems = [];
  const byNewName = {};
  Object.entries(registry).forEach(([key, v]) => {
    const [nom, ligue] = key.split('|');
    const nouveau = fullName(nom, v.prenom);
    (byNewName[nouveau] = byNewName[nouveau] || []).push({ key, ligue, clubs: v.clubs || [] });
  });
  Object.entries(byNewName).forEach(([nouveau, entries]) => {
    const ligues = entries.map(e => e.ligue);
    if (new Set(ligues).size !== ligues.length) {
      problems.push(`COLLISION dans une même ligue : ${entries.map(e => e.key).join(', ')} -> "${nouveau}"`);
    }
    // Même nom complet dans deux ligues : même personne attendue, donc au
    // moins un club en commun ; sinon c'est peut-être un homonyme complet.
    if (entries.length > 1) {
      const clubs = entries.map(e => new Set(e.clubs));
      const commun = [...clubs[0]].some(c => clubs.slice(1).every(s => s.has(c)));
      if (!commun) problems.push(`À VÉRIFIER : "${nouveau}" dans ${entries.map(e => `${e.ligue} (${e.clubs.join('/') || '?'})`).join(' et ')} sans club commun`);
    }
  });
  return problems;
}

function renameRegistry() {
  const photos = JSON.parse(fs.readFileSync(photosPath, 'utf8'));
  const newRegistry = {};
  const newPhotos = {};
  Object.entries(registry).forEach(([key, v]) => {
    const [nom, ligue] = key.split('|');
    const newKey = `${fullName(nom, v.prenom)}|${ligue}`;
    newRegistry[newKey] = v;
    if (photos[key]) newPhotos[newKey] = photos[key];
  });
  // Photos sans entrée au registre : clé conservée telle quelle.
  Object.entries(photos).forEach(([key, url]) => { if (!registry[key]) newPhotos[key] = url; });
  fs.writeFileSync(registryPath, JSON.stringify(newRegistry, null, 2));
  fs.writeFileSync(photosPath, JSON.stringify(newPhotos, null, 2));
  console.log(`Registre : ${renames.size} clés renommées sur ${Object.keys(registry).length}.`);
}

async function migrateDb() {
  const admin = require('firebase-admin');
  const sa = require('../serviceAccountKey.json');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();
  const dryRun = process.env.DRY_RUN !== 'false';

  const inconnus = new Set();
  const rename = (ligue, nom) => {
    if (!nom) return nom;
    const nouveau = renames.get(`${ligue}|${nom}`);
    if (nouveau) return nouveau;
    if (!registry[`${nom}|${ligue}`]) inconnus.add(`${nom} (${ligue})`);
    return nom;
  };

  const updates = [];
  const vus = new Map(); // "ligue|ancien -> nouveau" -> nombre de docs

  const mercato = await db.collection('mercato').get();
  mercato.docs.forEach(d => {
    const { joueur, ligue } = d.data();
    const nouveau = rename(ligue, joueur);
    if (nouveau === joueur) return;
    updates.push({ ref: d.ref, data: { joueur: nouveau } });
    const k = `${ligue} | ${joueur} -> ${nouveau}`;
    vus.set(k, (vus.get(k) || 0) + 1);
  });
  const nbMercato = updates.length;

  const matches = await db.collection('matches').get();
  let entreesMatchs = 0;
  matches.docs.forEach(d => {
    const data = d.data();
    let changed = false;
    const fix = arr => (arr || []).map(e => {
      const nouveau = rename(data.ligue, e.joueur);
      if (nouveau === e.joueur) return e;
      changed = true;
      entreesMatchs++;
      return { ...e, joueur: nouveau };
    });
    const buteurs = fix(data.buteurs);
    const notes = fix(data.notes);
    if (changed) updates.push({ ref: d.ref, data: { buteurs, notes } });
  });

  console.log('=== RENOMMAGES (ligue | ancien -> nouveau : docs mercato) ===');
  [...vus.entries()].sort().forEach(([k, n]) => console.log(`${k} : ${n}`));
  console.log(`\nMercato : ${nbMercato} docs sur ${mercato.size}`);
  console.log(`Matchs : ${updates.length - nbMercato} docs sur ${matches.size} (${entreesMatchs} entrées buteurs/notes)`);
  if (inconnus.size) {
    console.log(`\n=== ABSENTS DU REGISTRE, laissés tels quels (${inconnus.size}) ===`);
    [...inconnus].sort().forEach(n => console.log(n));
  }

  if (dryRun) { console.log('\nSimulation : rien n\'a été écrit.'); return; }
  for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch();
    updates.slice(i, i + 400).forEach(u => batch.update(u.ref, u.data));
    await batch.commit();
  }
  console.log(`\n✅ ${updates.length} documents mis à jour.`);
}

async function main() {
  const problems = checkRegistry();
  if (problems.length) {
    console.log('=== PROBLÈMES DANS LE REGISTRE ===');
    problems.forEach(p => console.log(p));
    if (problems.some(p => p.startsWith('COLLISION'))) {
      console.log('\n❌ Collision : corriger le registre avant de migrer.');
      process.exit(1);
    }
    console.log('');
  }
  if (process.env.REGISTRY_ONLY === 'true') return renameRegistry();
  await migrateDb();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
