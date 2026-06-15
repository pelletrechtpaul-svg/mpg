const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// Féminin → Masculin (accord unique : masculin)
const NORM = {
  'Algérienne': 'Algérien',
  'Allemande': 'Allemand',
  'Américaine': 'Américain',
  'Anglaise': 'Anglais',
  'Angolaise': 'Angolais',
  'Argentine': 'Argentin',
  'Brésilienne': 'Brésilien',
  'Colombienne': 'Colombien',
  'Congolaise': 'Congolais',
  'Espagnole': 'Espagnol',
  'Française': 'Français',
  'Galloise': 'Gallois',
  'Ghanéenne': 'Ghanéen',
  'Grecque': 'Grec',
  'Guinéenne': 'Guinéen',
  'Islandaise': 'Islandais',
  'Ivoirienne': 'Ivoirien',
  'Japonaise': 'Japonais',
  'Malienne': 'Malien',
  'Marocaine': 'Marocain',
  'Néerlandaise': 'Néerlandais',
  'Nigériane': 'Nigérian',
  'Norvégienne': 'Norvégien',
  'Paraguayenne': 'Paraguayen',
  'Polonaise': 'Polonais',
  'Portugaise': 'Portugais',
  'Roumaine': 'Roumain',
  'Sénégalaise': 'Sénégalais',
  'Suédoise': 'Suédois',
  'Tchèque': 'Tchèque', // invariable
  'Turque': 'Turc',
  'Ukrainienne': 'Ukrainien',
  'Uruguayenne': 'Uruguayen',
  'Zimbabwéenne': 'Zimbabwéen',
  'Écossaise': 'Écossais',
  'Égyptienne': 'Égyptien',
  'Équatorienne': 'Équatorien',
};

db.collection('mercato').get().then(async snap => {
  const toFix = [];
  snap.docs.forEach(doc => {
    const d = doc.data();
    const norm = NORM[d.nationalite];
    if (norm) toFix.push({ id: doc.id, old: d.nationalite, new: norm });
  });

  console.log('À normaliser:', toFix.length);
  const byNat = {};
  toFix.forEach(f => { byNat[f.old] = (byNat[f.old]||0)+1; });
  Object.entries(byNat).sort().forEach(([k,v]) => console.log(' ', v+'x', k, '→', NORM[k]));

  const chunks = [];
  for (let i = 0; i < toFix.length; i += 499) chunks.push(toFix.slice(i, i+499));
  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach(f => batch.update(db.collection('mercato').doc(f.id), { nationalite: f.new }));
    await batch.commit();
  }
  console.log('\n✅', toFix.length, 'nationalités normalisées (→ masculin).');
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
