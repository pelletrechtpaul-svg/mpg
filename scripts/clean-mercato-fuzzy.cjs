#!/usr/bin/env node
/**
 * Détecte et supprime les doublons "fuzzy" dans la collection mercato.
 *
 * Un doublon fuzzy = même joueur dans le même tour/ligue/championnat,
 * même si le nom est inversé, réparti différemment entre joueur/prenom,
 * ou avec des variations mineures (accents, casse).
 *
 * Usage :
 *   node scripts/clean-mercato-fuzzy.cjs           → dry-run (affiche, ne supprime pas)
 *   node scripts/clean-mercato-fuzzy.cjs --fix     → supprime réellement
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DRY_RUN = !process.argv.includes('--fix');

// Normalise un nom : minuscules, sans accents, mots triés alphabétiquement
function normalize(joueur = '', prenom = '') {
  const full = `${joueur} ${prenom}`;
  return full
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // retire accents
    .replace(/[^a-z\s-]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

async function run() {
  const snapshot = await db.collection('mercato').get();
  console.log(`📦 ${snapshot.size} entrées chargées\n`);

  // Groupe par (ligue, championnat, tour) puis par nom normalisé
  const groups = {};
  for (const doc of snapshot.docs) {
    const d = doc.data();
    const context = `${d.ligue}__${d.championnat}__${d.tour}`;
    const key = `${context}::${normalize(d.joueur, d.prenom)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ id: doc.id, data: d });
  }

  // Trouve les groupes avec plus d'1 entrée = doublons
  const dupes = Object.entries(groups).filter(([, docs]) => docs.length > 1);

  if (dupes.length === 0) {
    console.log('✅ Aucun doublon fuzzy détecté.');
    process.exit(0);
  }

  console.log(`⚠️  ${dupes.length} groupe(s) de doublons détectés :\n`);

  const toDelete = [];

  for (const [key, docs] of dupes) {
    const [context] = key.split('::');
    const [ligue, championnat, tour] = context.split('__');
    console.log(`  [${ligue} / champ ${championnat} / tour ${tour}]`);

    // Garde le doc avec le prenom le plus rempli (ou le premier sinon)
    const sorted = [...docs].sort((a, b) => {
      const aScore = (a.data.prenom ? 1 : 0) + (a.data.joueur ? 1 : 0);
      const bScore = (b.data.prenom ? 1 : 0) + (b.data.joueur ? 1 : 0);
      return bScore - aScore;
    });

    const keeper = sorted[0];
    const losers = sorted.slice(1);

    console.log(`    ✔ GARDER  [${keeper.id}] joueur="${keeper.data.joueur}" prenom="${keeper.data.prenom || ''}"`);
    for (const l of losers) {
      console.log(`    ✗ SUPPR.  [${l.id}] joueur="${l.data.joueur}" prenom="${l.data.prenom || ''}"`);
      toDelete.push(l.id);
    }
    console.log('');
  }

  console.log(`→ ${toDelete.length} doc(s) à supprimer`);

  if (DRY_RUN) {
    console.log('\n🔍 Mode dry-run — rien n\'a été modifié.');
    console.log('   Relancer avec --fix pour appliquer les suppressions.\n');
    process.exit(0);
  }

  // Suppression par batch de 500
  const chunks = [];
  for (let i = 0; i < toDelete.length; i += 500) chunks.push(toDelete.slice(i, i + 500));
  for (const chunk of chunks) {
    const batch = db.batch();
    for (const id of chunk) batch.delete(db.collection('mercato').doc(id));
    await batch.commit();
  }

  console.log(`\n✅ ${toDelete.length} doublons supprimés.`);
  process.exit(0);
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
