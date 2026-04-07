#!/usr/bin/env node
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function dedupMercato() {
  const snapshot = await db.collection('mercato').get();
  const seen = {};
  const toDelete = [];

  for (const doc of snapshot.docs) {
    const d = doc.data();
    // Use joueur+prenom+ligue+championnat+tour as unique key
    const key = `${d.joueur}_${d.prenom}_${d.ligue}_${d.championnat}_${d.tour}`;
    if (seen[key]) {
      toDelete.push(doc.id);
    } else {
      seen[key] = doc.id;
    }
  }

  console.log(`Doublons à supprimer : ${toDelete.length}`);
  if (toDelete.length === 0) { process.exit(0); }

  // Delete in batches of 500
  const chunks = [];
  for (let i = 0; i < toDelete.length; i += 500) chunks.push(toDelete.slice(i, i + 500));
  for (const chunk of chunks) {
    const batch = db.batch();
    for (const id of chunk) batch.delete(db.collection('mercato').doc(id));
    await batch.commit();
  }

  console.log(`✅ ${toDelete.length} doublons supprimés`);
  process.exit(0);
}

dedupMercato().catch(err => { console.error('❌', err.message); process.exit(1); });
