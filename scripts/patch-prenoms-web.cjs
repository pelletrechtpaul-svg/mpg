const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// Prénoms trouvés via recherches web, indexés par joueur|ligue
// Certains matchés aussi par poste/nationalite pour lever les ambiguïtés
const PRENOMS = {
  // Ligue 1
  'Rulli|Ligue 1': 'Gerónimo',
  'Fofana|Ligue 1': 'Rayan',           // Rayan Fofana (Lens/attaquant) vs Malick (OL) - à vérifier par poste
  'Aït Boudlal|Ligue 1': 'Abdelhamid',
  'Beraldo|Ligue 1': 'Lucas',
  'Sinayoko|Ligue 1': 'Lassine',
  'Gurtner|Ligue 1': 'Régis',
  'Coppola|Ligue 1': 'Diego',
  'Emegha|Ligue 1': 'Emanuel',
  'de Lange|Ligue 1': 'Jeffrey',
  'Katseris|Ligue 1': 'Panos',
  'Mostafa Mohamed|Ligue 1': 'Mostafa',
  'Abner Vinícius|Ligue 1': 'Abner',
  'Matondo|Ligue 1': 'Rudy',
  'Masuaku|Ligue 1': 'Arthur',
  'Ikoné|Ligue 1': 'Jonathan',
  'Thomasson|Ligue 1': 'Adrien',
  'Ruiz|Ligue 1': 'Fabián',
  'Fernandez-Pardo|Ligue 1': 'Matias',
  'Rosier|Ligue 1': 'Valentin',
  'Satriano|Ligue 1': 'Martín',
  'Faivre|Ligue 1': 'Romain',
  'Rongier|Ligue 1': 'Valentin',
  'Cadiou|Ligue 1': 'Noah',
  'Silistre|Ligue 1': 'Mathys',
  'Ganiou|Ligue 1': 'Ismaëlo',
  'Okoh|Ligue 1': 'Bryan',
  'Greif|Ligue 1': 'Dominik',
  'Bodart|Ligue 1': 'Arnaud',
  'Özer|Ligue 1': 'Berke',
  'Camara|Ligue 1': 'Issiaga',         // MD Guinéenne → Issiaga Camara (Nice)
  // Liga
  'Mojica|Liga': 'Johan',
  'Lemar|Liga': 'Thomas',
  'Fort|Liga': 'Hector',
  'Kubo|Liga': 'Takefusa',
  'Calvo|Liga': 'Dani',
  'Mingueza|Liga': 'Óscar',
  'Lo Celso|Liga': 'Giovani',
  'Padilla|Liga': 'Álex',
  'Berenguer|Liga': 'Álex',
  'Escandell|Liga': 'Aarón',
  'Enciso|Liga': 'Julio',
  'Tsygankov|Liga': 'Viktor',
  'Maffeo|Liga': 'Pablo',
  'Letácek|Liga': 'Jiří',
  'Cömert|Liga': 'Eray',
  'Mendy|Liga': 'Ferland',             // DL Française → Ferland Mendy (Real Madrid)
  'Tchouaméni|Liga': 'Aurélien',
  'Kluivert|Liga': 'Justin',           // Justin Kluivert (Villarreal prêt)
  'Alexander-Arnold|Liga': 'Trent',
  'Araujo|Liga': 'Ronald',
  'Militão|Liga': 'Éder',
  'Nico Williams|Liga': 'Nico',
  'Iñaki Williams|Liga': 'Iñaki',
  'ter Stegen|Liga': 'Marc-André',
  'Fidalgo|Liga': 'Álvaro',
  'Flores|Liga': 'Alberto',            // G Espagnole → Alberto Flores (Séville)
  'López|Liga': 'Fermín',              // MO → Fermín López (Barcelone)
  'Rubén García|Liga': 'Rubén',
};

// Cas spéciaux: disambiguation par poste ou nationalite
const PRENOMS_FOFANA = {
  'A': 'Rayan',    // attaquant → Rayan Fofana (Lens)
  'MO': 'Malick',  // milieu → Malick Fofana (OL)
  'MD': 'Malick',
};

db.collection('mercato').get().then(async snap => {
  const toFix = [];
  const skipped = [];

  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.prenom) return; // déjà renseigné

    // Cas spécial Fofana
    if (d.joueur === 'Fofana' && d.ligue === 'Ligue 1') {
      const prenom = PRENOMS_FOFANA[d.poste];
      if (prenom) {
        toFix.push({ id: doc.id, joueur: d.joueur, prenom, note: 'via poste' });
      } else {
        skipped.push({ id: doc.id, joueur: d.joueur, ligue: d.ligue, poste: d.poste, reason: 'Fofana ambiguïté non résolue' });
      }
      return;
    }

    const key = d.joueur + '|' + d.ligue;
    const prenom = PRENOMS[key];
    if (prenom) {
      toFix.push({ id: doc.id, joueur: d.joueur, prenom });
    } else {
      skipped.push({ id: doc.id, joueur: d.joueur, ligue: d.ligue, poste: d.poste, nationalite: d.nationalite, reason: 'non trouvé' });
    }
  });

  console.log('\n=== PATCH PRÉNOMS WEB ===');
  console.log('À patcher:', toFix.length);
  toFix.forEach(f => console.log(' ', f.joueur, '->', f.prenom, f.note || ''));

  console.log('\nSkip/ambiguïté:', skipped.length);
  skipped.forEach(f => console.log(' ', f.joueur, f.ligue, f.poste, f.nationalite, '-', f.reason));

  if (toFix.length > 0) {
    // Batch updates (max 500 par batch Firestore)
    const chunks = [];
    for (let i = 0; i < toFix.length; i += 499) chunks.push(toFix.slice(i, i + 499));
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach(f => batch.update(db.collection('mercato').doc(f.id), { prenom: f.prenom }));
      await batch.commit();
    }
    console.log('\n✅', toFix.length, 'prénoms patchés.');
  }

  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
