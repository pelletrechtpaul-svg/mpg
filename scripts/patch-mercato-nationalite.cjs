#!/usr/bin/env node
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const NATIONALITES = {
  // Français
  'Barcola': 'Français', 'Lepaul': 'Français', 'Panichelli': 'Français',
  'Doué': 'Français', 'Thauvin': 'Français', 'Tolisso': 'Français',
  'Ajorque': 'Français', 'Del Castillo': 'Français', 'Zaïre-Emery': 'Français',
  'Teze': 'Français', 'Akliouche': 'Français', 'Risser': 'Français',
  'Édouard': 'Français', 'Sarr': 'Français', 'Samba': 'Français',
  'Chardonnet': 'Français', 'Lloris': 'Français', 'Perraud': 'Français',
  'Centonze': 'Français', 'Chevalier': 'Français', 'Diaz': 'Français',
  'Doukouré': 'Français', 'Saint-Maximin': 'Français', 'Pagis': 'Français',
  'Makengo': 'Français', 'Pogba': 'Français', 'Kamara': 'Français',
  'Jourdren': 'Français',
  // Portugais
  'Vitinha': 'Portugais', 'Nuno Mendes': 'Portugais', 'Anthony Lopes': 'Portugais',
  // Brésilien
  'Endrick': 'Brésilien', 'Vanderson': 'Brésilien', 'Marquinhos': 'Brésilien',
  'Caio Henrique': 'Brésilien', 'Igor Silva': 'Brésilien',
  // Ivoirien
  'Gboho': 'Ivoirien', 'Sangaré': 'Ivoirien', 'Godo': 'Ivoirien',
  // Sénégalais
  'Dieng': 'Sénégalais', 'Diop': 'Sénégalais',
  // Autres
  'Zakaria': 'Suisse',
  'Fati': 'Espagnol',
  'Dro Fernández': 'Espagnol',
  'Pacho': 'Équatorien',
  'Lee Kang-In': 'Sud-Coréen',
  'Safonov': 'Russe',
  'Faes': 'Belge',
  'Moreira': 'Belge',
  'Balogun': 'Américain',
  'Kebbal': 'Algérien',
  'Clinton Mata': 'Angolais',
  'Morton': 'Anglais',
  'Kamory Doumbia': 'Guinéen',
  'Ali Youssif': 'Libyen',
};

async function patch() {
  const snapshot = await db.collection('mercato').get();
  const batch = db.batch();
  let updated = 0;
  let missing = [];

  snapshot.docs.forEach(doc => {
    const { joueur } = doc.data();
    const nationalite = NATIONALITES[joueur];
    if (nationalite) {
      batch.update(doc.ref, { nationalite });
      updated++;
    } else {
      missing.push(joueur);
    }
  });

  await batch.commit();
  console.log(`✅ ${updated} docs mis à jour`);
  if (missing.length) console.warn(`⚠️  Nationalité manquante pour : ${[...new Set(missing)].join(', ')}`);
  process.exit(0);
}

patch().catch(err => { console.error('❌', err.message); process.exit(1); });
