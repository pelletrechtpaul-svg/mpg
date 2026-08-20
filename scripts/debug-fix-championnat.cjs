const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  const snap = await db.collection('mercato')
    .where('ligue', '==', 'Ligue 1')
    .where('saison', '==', '2026/2027')
    .where('championnat', '==', 2)
    .where('tour', '==', 2)
    .get();
  console.log(`Trouvé ${snap.size} docs à corriger (championnat 2 -> 1)`);
  const batch = db.batch();
  snap.docs.forEach(d => batch.update(d.ref, { championnat: 1 }));
  await batch.commit();
  console.log('OK, corrigé.');
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
