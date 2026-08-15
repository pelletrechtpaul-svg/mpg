const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  const snap = await db.collection('config').doc('saisons').get();
  console.log('exists:', snap.exists);
  console.log('data:', JSON.stringify(snap.data(), null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
