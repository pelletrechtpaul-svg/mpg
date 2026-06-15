const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

db.collection('mercato').get().then(async snap => {
  // Index: nom → prénoms connus dans la DB
  const prenomIndex = {};
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.prenom && d.joueur) {
      if (!prenomIndex[d.joueur]) prenomIndex[d.joueur] = {};
      // clé = prenom+ligue pour distinguer homonymes
      const k = d.prenom + '|' + d.ligue;
      prenomIndex[d.joueur][k] = (prenomIndex[d.joueur][k] || 0) + 1;
    }
  });

  const missing = snap.docs.filter(doc => !doc.data().prenom);
  console.log('Manquants:', missing.length);

  const toFix = [], stillMissing = [];

  missing.forEach(doc => {
    const d = doc.data();
    const candidates = prenomIndex[d.joueur];
    if (!candidates) { stillMissing.push({ id: doc.id, joueur: d.joueur, ligue: d.ligue, poste: d.poste, nationalite: d.nationalite }); return; }

    // Filtre par ligue d'abord
    const ligueMatch = Object.entries(candidates).filter(([k]) => k.endsWith('|' + d.ligue));
    const pool = ligueMatch.length > 0 ? ligueMatch : Object.entries(candidates);

    if (pool.length === 1) {
      const prenom = pool[0][0].split('|')[0];
      toFix.push({ id: doc.id, joueur: d.joueur, prenom });
    } else {
      // Plusieurs prénoms possibles → ambiguité
      stillMissing.push({ id: doc.id, joueur: d.joueur, ligue: d.ligue, poste: d.poste, candidates: pool.map(([k]) => k.split('|')[0]) });
    }
  });

  console.log('\nAuto-corrigibles depuis la DB:', toFix.length);
  toFix.forEach(f => console.log(' ', f.joueur, '->', f.prenom));

  console.log('\nEncore manquants après cross-ref:', stillMissing.length);
  stillMissing.forEach(f => {
    const cands = f.candidates ? ' (ambiguité: ' + f.candidates.join('/') + ')' : '';
    console.log(' ', f.joueur, f.ligue, f.poste, f.nationalite + cands);
  });

  // Patch les auto-corrigibles
  if (toFix.length > 0) {
    const batch = db.batch();
    toFix.forEach(f => batch.update(db.collection('mercato').doc(f.id), { prenom: f.prenom }));
    await batch.commit();
    console.log('\n✅', toFix.length, 'prénoms patchés automatiquement.');
  }

  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
