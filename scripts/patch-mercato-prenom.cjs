#!/usr/bin/env node
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const PRENOMS = {
  'Barcola': 'Bradley',
  'Lepaul': 'Arnaud',
  'Panichelli': 'Théo',
  'Endrick': 'Endrick',
  'Doué': 'Désiré',
  'Balogun': 'Folarin',
  'Vitinha': 'Vítor',
  'Thauvin': 'Florian',
  'Tolisso': 'Corentin',
  'Kamory Doumbia': 'Kamory',
  'Pagis': 'Pablo',
  'Ajorque': 'Ludovic',
  'Makengo': 'Aaron',
  'Del Castillo': 'Franck',
  'Dieng': 'Bamba',
  'Gboho': 'Christian',
  'Nuno Mendes': 'Nuno',
  'Kebbal': 'Zinedine',
  'Zaïre-Emery': 'Warren',
  'Moreira': 'Diego',
  'Teze': 'Benjamin',
  'Morton': 'Tyler',
  'Zakaria': 'Denis',
  'Sarr': 'Malang',
  'Akliouche': 'Maghnes',
  'Risser': 'Robin',
  'Fati': 'Ansu',
  'Édouard': 'Odsonne',
  'Sangaré': 'Ibrahim',
  'Samba': 'Brice',
  'Clinton Mata': 'Clinton',
  'Chardonnet': 'Brendan',
  'Pacho': 'Willian',
  'Lloris': 'Hugo',
  'Anthony Lopes': 'Anthony',
  'Lee Kang-In': 'Kang-In',
  'Perraud': 'Romain',
  'Safonov': 'Matvey',
  'Centonze': 'Fabien',
  'Diop': 'Boulaye',
  'Godo': 'Martial',
  'Chevalier': 'Lucas',
  'Diaz': 'Junior',
  'Doukouré': 'Ismaël',
  'Igor Silva': 'Igor',
  'Vanderson': 'Vanderson',
  'Saint-Maximin': 'Allan',
  'Marquinhos': 'Marquinhos',
  'Caio Henrique': 'Caio',
  'Faes': 'Wout',
  'Ali Youssif': 'Ali',
  'Pogba': 'Paul',
  'Kamara': 'Boubacar',
  'Jourdren': 'Steeve',
  'Dro Fernández': 'Pedro',
  'Dembélé': 'Ousmane',
  'Aubameyang': 'Pierre-Emerick',
  'Saïd': 'Wesley',
  'Sulc': 'Pavel',
  'Udol': 'Matthieu',
  'Baidoo': 'Samson',
  'Haraldsson': 'Hákon Arnar',
  'Mayulu': 'Senny',
  'Ndiaye': 'Rassoul',
  'Kvaratskhelia': 'Khvicha',
  'Lamine Camara': 'Lamine',
  'Ousmane Camara': 'Ousmane',
  'Coudert': 'Grégoire',
  'Coulibaly': 'Mamadou',
  'Perrin': 'Gaëtan',
  'Raolisoa': 'Lilian',
  'Golovin': 'Aleksandr',
  'Félix Correia': 'Félix',
  'Munetsi': 'Marshall',
  'Szymanski': 'Sebastian',
  'Brassier': 'Lilian',
  'Kehrer': 'Thilo',
  'Immobile': 'Ciro',
  'Majecki': 'Radosław',
  'Himbert': 'Rémi',
};

async function patch() {
  const snapshot = await db.collection('mercato').get();
  const batch = db.batch();
  let updated = 0;
  let missing = [];

  snapshot.docs.forEach(doc => {
    const { joueur } = doc.data();
    const prenom = PRENOMS[joueur];
    if (prenom) {
      batch.update(doc.ref, { prenom });
      updated++;
    } else {
      missing.push(joueur);
    }
  });

  await batch.commit();
  console.log(`✅ ${updated} docs mis à jour avec prenom`);
  if (missing.length) console.warn(`⚠️  Prénom manquant pour : ${[...new Set(missing)].join(', ')}`);
  process.exit(0);
}

patch().catch(err => { console.error('❌', err.message); process.exit(1); });
