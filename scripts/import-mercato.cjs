#!/usr/bin/env node
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function importMercato(data) {
  const batch = db.batch();
  for (const entry of data) {
    const ref = db.collection('mercato').doc();
    batch.set(ref, entry);
  }
  await batch.commit();
  console.log(`✅ ${data.length} entrées importées dans 'mercato'`);
  process.exit(0);
}

const DATA = [
  { joueur: "João Neves",  prenom: "João",         club: "Paris",     poste: "MD", prix: 21, acheteur: "roman", equipe_acheteur: "Le Champion", encheres_perdues: [], nationalite: "Portugais",   saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 3 },
  { joueur: "Højbjerg",    prenom: "Pierre-Emile", club: "Marseille", poste: "MD", prix: 18, acheteur: "roman", equipe_acheteur: "Le Champion", encheres_perdues: [], nationalite: "Danois",      saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 3 },
  { joueur: "Igor Paixão", prenom: "Igor",         club: "Marseille", poste: "A",  prix: 17, acheteur: "roman", equipe_acheteur: "Le Champion", encheres_perdues: [], nationalite: "Brésilien",   saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 3 },
  { joueur: "Niakhaté",    prenom: "Moussa",       club: "Lyon",      poste: "DC", prix: 16, acheteur: "roman", equipe_acheteur: "Le Champion", encheres_perdues: [], nationalite: "Sénégalais",  saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 3 },
  { joueur: "Adingra",     prenom: "Simon",        club: "Monaco",    poste: "A",  prix:  8, acheteur: "roman", equipe_acheteur: "Le Champion", encheres_perdues: [], nationalite: "Ivoirien",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 3 },
  { joueur: "Nordin",      prenom: "Arnaud",       club: "Rennes",    poste: "A",  prix:  8, acheteur: "roman", equipe_acheteur: "Le Champion", encheres_perdues: [], nationalite: "Français",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 3 },
];

importMercato(DATA).catch(err => { console.error('❌', err.message); process.exit(1); });
