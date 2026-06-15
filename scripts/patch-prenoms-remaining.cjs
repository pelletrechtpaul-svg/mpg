const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// Patches pour les 8 entrées non trouvées au premier passage
const PRENOMS = {
  'Éder Militão|Liga': 'Éder',
  'Militão|Liga': 'Éder',
  'Rüdiger|Liga': 'Antonio',
  'Mandi|Ligue 1': 'Aïssa',
  'Enciso|Ligue 1': 'Julio',
  'Romero|Liga': 'Carlos',         // DL Espagnole → Carlos Romero (Espanyol)
  'Rosier|Liga': 'Valentin',
  'Satriano|Liga': 'Martín',
  'Kluivert|Ligue 1': 'Ruben',    // Ruben Kluivert (OL)
};

db.collection('mercato').get().then(async snap => {
  const toFix = [];
  const skipped = [];

  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.prenom) return;
    const key = d.joueur + '|' + d.ligue;
    const prenom = PRENOMS[key];
    if (prenom) {
      toFix.push({ id: doc.id, joueur: d.joueur, prenom, ligue: d.ligue });
    } else {
      skipped.push({ id: doc.id, joueur: d.joueur, ligue: d.ligue, poste: d.poste, nationalite: d.nationalite });
    }
  });

  console.log('À patcher:', toFix.length);
  toFix.forEach(f => console.log(' ', f.joueur, f.ligue, '->', f.prenom));

  console.log('\nEncore manquants:', skipped.length);
  skipped.forEach(f => console.log(' ', f.joueur, f.ligue, f.poste, f.nationalite));

  if (toFix.length > 0) {
    const batch = db.batch();
    toFix.forEach(f => batch.update(db.collection('mercato').doc(f.id), { prenom: f.prenom }));
    await batch.commit();
    console.log('\n✅', toFix.length, 'prénoms patchés.');
  }

  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
