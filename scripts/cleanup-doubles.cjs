const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

db.collection('mercato').get().then(async snap => {
  const clearPrenom = [];   // joueur contains prenom already
  const toDelete = [];      // Zaid Romero (low value, wrong position)

  snap.docs.forEach(doc => {
    const d = doc.data();

    // Zaid Romero: DC argentin, valeur ~€2M — pas MPG-relevant
    if (d.joueur === 'Romero' && d.nationalite === 'Argentine' && d.poste === 'DC') {
      toDelete.push({ id: doc.id, joueur: d.joueur, nationalite: d.nationalite, poste: d.poste, ligue: d.ligue });
      return;
    }

    // Prenom doublon: joueur commence par prenom
    if (d.prenom && (d.joueur === d.prenom || d.joueur.startsWith(d.prenom + ' '))) {
      clearPrenom.push({ id: doc.id, joueur: d.joueur, prenom: d.prenom });
    }
  });

  console.log('=== SUPPRESSION PRÉNOMS REDONDANTS ===');
  console.log('Entrées à nettoyer:', clearPrenom.length);
  clearPrenom.forEach(e => console.log(' ', e.joueur, '(prenom:', e.prenom + ')'));

  console.log('\n=== SUPPRESSION ZAID ROMERO ===');
  toDelete.forEach(e => console.log(' ', e.id, e.joueur, e.nationalite, e.poste, e.ligue));

  // Clear prenom redondant (batch)
  const chunks = [];
  for (let i = 0; i < clearPrenom.length; i += 499) chunks.push(clearPrenom.slice(i, i + 499));
  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach(e => batch.update(db.collection('mercato').doc(e.id), { prenom: admin.firestore.FieldValue.delete() }));
    await batch.commit();
  }
  console.log('\n✅', clearPrenom.length, 'prénoms redondants supprimés.');

  // Delete Zaid Romero entries
  for (const e of toDelete) {
    await db.collection('mercato').doc(e.id).delete();
  }
  if (toDelete.length) console.log('✅', toDelete.length, 'entrée(s) Zaid Romero supprimée(s).');

  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
