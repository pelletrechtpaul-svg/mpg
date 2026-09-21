/**
 * Migration one-off : corrige deux collisions d'homonymes découvertes dans
 * players-registry.json après le passage à la fiche joueur unique par nom
 * seul (toutes ligues confondues, voir CLAUDE.md du 2026-09-17).
 *
 * - "Díaz" : Luis Díaz (Bayern, Ligue des Champions) et Mariano Díaz
 *   (Alavés, Liga) sont deux joueurs réels distincts qui partageaient la
 *   même clé "Díaz" et fusionnaient donc silencieusement en une seule
 *   fiche. Mariano Díaz (import le plus récent) est renommé "Mariano Díaz".
 * - "Ndiaye" : Rassoul Ndiaye (Le Havre, Ligue 1, entrée historique depuis
 *   le tout premier import) et Iliman Ndiaye (Man City, Ligue des
 *   Champions) même collision. Iliman Ndiaye est renommé "Iliman Ndiaye".
 *
 * Renomme le champ `joueur` dans les collections mercato ET matches
 * (buteurs[].joueur, notes[].joueur), scoping par ligue pour ne toucher
 * que le bon joueur dans chaque cas.
 *
 * Usage :
 *   node scripts/fix-homonym-collisions.cjs            (dry-run)
 *   DRY_RUN=false node scripts/fix-homonym-collisions.cjs   (écrit en DB)
 */

const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const FIXES = [
  { ligue: 'Liga', from: 'Díaz', to: 'Mariano Díaz' },
  { ligue: 'Ligue des Champions', from: 'Ndiaye', to: 'Iliman Ndiaye' },
];

const dryRun = process.env.DRY_RUN !== 'false';

async function fixMercato({ ligue, from, to }) {
  const snap = await db.collection('mercato')
    .where('ligue', '==', ligue)
    .where('joueur', '==', from)
    .get();
  console.log(`[mercato] ${ligue} / "${from}" -> "${to}" : ${snap.size} document(s)`);
  if (snap.empty || dryRun) return;
  const batch = db.batch();
  snap.docs.forEach(d => batch.update(d.ref, { joueur: to }));
  await batch.commit();
}

async function fixMatches({ ligue, from, to }) {
  const snap = await db.collection('matches').where('ligue', '==', ligue).get();
  let touched = 0;
  const batch = db.batch();
  snap.docs.forEach(d => {
    const data = d.data();
    let changed = false;
    const buteurs = (data.buteurs || []).map(b => {
      if (b.joueur === from) { changed = true; return { ...b, joueur: to }; }
      return b;
    });
    const notes = (data.notes || []).map(n => {
      if (n.joueur === from) { changed = true; return { ...n, joueur: to }; }
      return n;
    });
    if (changed) {
      touched++;
      if (!dryRun) batch.update(d.ref, { buteurs, notes });
    }
  });
  console.log(`[matches] ${ligue} / "${from}" -> "${to}" : ${touched} document(s) avec des entrées buteurs/notes à corriger (sur ${snap.size} matchs de la ligue)`);
  if (touched > 0 && !dryRun) await batch.commit();
}

async function main() {
  for (const fix of FIXES) {
    await fixMercato(fix);
    await fixMatches(fix);
  }
  if (dryRun) console.log('\nDry-run : relancer avec DRY_RUN=false pour écrire.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
