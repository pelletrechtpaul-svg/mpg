/**
 * Affiche la répartition des entrées mercato par acheteur (+ détection de doublons).
 * Usage: node scripts/mercato-stats.cjs
 */
const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  const snap = await db.collection('mercato').get();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`\nTotal: ${all.length} entrées\n`);

  const byAcheteur = {};
  all.forEach(d => { byAcheteur[d.acheteur] = (byAcheteur[d.acheteur] || 0) + 1; });
  console.log('Par acheteur:');
  Object.entries(byAcheteur).sort((a, b) => b[1] - a[1]).forEach(([a, n]) => console.log(`  ${n}  ${a}`));

  const byTour = {};
  all.forEach(d => { const k = `tour ${d.tour}`; byTour[k] = (byTour[k] || 0) + 1; });
  console.log('\nPar tour:');
  Object.entries(byTour).sort().forEach(([t, n]) => console.log(`  ${n}  ${t}`));

  // Doublons: même joueur, même ligue, même championnat, même tour
  const seen = {};
  const dupes = [];
  all.forEach(d => {
    const key = `${d.joueur}|${d.ligue}|${d.championnat}|${d.tour}`;
    if (seen[key]) dupes.push({ joueur: d.joueur, tour: d.tour, ids: [seen[key], d.id] });
    else seen[key] = d.id;
  });
  if (dupes.length) {
    console.log('\n⚠️  DOUBLONS DÉTECTÉS:');
    dupes.forEach(d => console.log(`  ${d.joueur} (tour ${d.tour}) — ids: ${d.ids.join(', ')}`));
  } else {
    console.log('\n✅ Aucun doublon.');
  }

  console.log('\nListe complète par acheteur:');
  ['Paul', 'Adrien', 'Tiago', 'Roman'].forEach(a => {
    const players = all.filter(d => d.acheteur === a).sort((x, y) => (x.tour - y.tour) || x.joueur.localeCompare(y.joueur));
    console.log(`\n${a} (${players.length}):`);
    players.forEach(p => console.log(`  tour${p.tour} ${p.joueur} ${p.prix}M`));
  });

  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
