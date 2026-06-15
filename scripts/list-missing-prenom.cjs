const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

db.collection('mercato').get().then(snap => {
  const missing = [];
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (!d.prenom) missing.push({ id: doc.id, joueur: d.joueur, poste: d.poste, ligue: d.ligue, saison: d.saison, acheteur: d.acheteur, nationalite: d.nationalite });
  });
  missing.sort((a,b) => (a.ligue+a.joueur).localeCompare(b.ligue+b.joueur));
  console.log(JSON.stringify(missing, null, 2));
  console.log('\nTotal manquants:', missing.length);
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
