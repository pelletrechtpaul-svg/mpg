#!/usr/bin/env node
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function checkMercato() {
  const snapshot = await db.collection('mercato').get();
  const counts = {};
  const players = {};

  for (const doc of snapshot.docs) {
    const d = doc.data();
    const key = `${d.saison} | ${d.ligue} #${d.championnat} | Tour ${d.tour}`;
    counts[key] = (counts[key] || 0) + 1;

    // Check duplicates by joueur+ligue+championnat+tour
    const dupKey = `${d.joueur}_${d.ligue}_${d.championnat}_${d.tour}`;
    if (!players[dupKey]) players[dupKey] = [];
    players[dupKey].push(doc.id);
  }

  console.log('\n=== Entrées par tour ===');
  for (const [key, count] of Object.entries(counts).sort()) {
    console.log(`  ${key} : ${count} joueurs`);
  }

  console.log('\n=== Doublons détectés ===');
  let found = false;
  for (const [key, ids] of Object.entries(players)) {
    if (ids.length > 1) {
      console.log(`  DOUBLON: ${key} (${ids.length}x)`);
      found = true;
    }
  }
  if (!found) console.log('  Aucun doublon.');

  console.log(`\nTotal: ${snapshot.size} entrées`);
  process.exit(0);
}

checkMercato().catch(err => { console.error('❌', err.message); process.exit(1); });
