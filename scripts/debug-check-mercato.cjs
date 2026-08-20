const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  const saisonsDoc = await db.collection('config').doc('saisons').get();
  console.log('config/saisons:', JSON.stringify(saisonsDoc.data()));

  const snap = await db.collection('mercato').where('ligue', '==', 'Ligue 1').get();
  console.log('Total docs mercato ligue=Ligue 1:', snap.size);
  const bySaison = {};
  const byChamp = {};
  snap.docs.forEach(d => {
    const v = d.data();
    bySaison[v.saison] = (bySaison[v.saison] || 0) + 1;
    const key = `${v.saison}|champ${v.championnat}|tour${v.tour}`;
    byChamp[key] = (byChamp[key] || 0) + 1;
  });
  console.log('Par saison:', JSON.stringify(bySaison, null, 1));
  console.log('Par saison/championnat/tour:', JSON.stringify(byChamp, null, 1));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
