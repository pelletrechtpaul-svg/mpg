#!/usr/bin/env node
/**
 * Import mercato data into Firestore.
 * Usage: node scripts/import-mercato.js
 * Data is passed as a JSON array via the DATA variable below.
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function importMercato(data) {
  const batch = db.batch();
  let count = 0;

  for (const entry of data) {
    const ref = db.collection('mercato').doc();
    batch.set(ref, entry);
    count++;
  }

  await batch.commit();
  console.log(`✅ ${count} entrées importées dans la collection 'mercato'`);
  process.exit(0);
}

// ── DATA ──────────────────────────────────────────────────────────────────────
const DATA = [];
// ─────────────────────────────────────────────────────────────────────────────

if (DATA.length === 0) {
  console.error('❌ Aucune donnée à importer. Remplis le tableau DATA.');
  process.exit(1);
}

importMercato(DATA).catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
