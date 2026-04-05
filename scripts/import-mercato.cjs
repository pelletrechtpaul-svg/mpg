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
  { joueur: "Barcola",         club: "Paris",      poste: "A",  prix: 93, acheteur: "roman",  equipe_acheteur: "Le Champion",    encheres_perdues: [],                                                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Lepaul",          club: "Rennes",     poste: "A",  prix: 75, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [{ equipe: "Caen Tâte", prix: 48 }],                                  saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Panichelli",      club: "Strasbourg", poste: "A",  prix: 74, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [{ equipe: "Le Champion", prix: 68 }, { equipe: "Caen Tâte", prix: 48 }], saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Endrick",         club: "Lyon",       poste: "A",  prix: 67, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC", encheres_perdues: [],                                                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Doué",            club: "Paris",      poste: "MO", prix: 66, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC", encheres_perdues: [{ equipe: "Les ananas", prix: 31 }],                                  saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Balogun",         club: "Monaco",     poste: "A",  prix: 64, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [],                                                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Vitinha",         club: "Paris",      poste: "MD", prix: 58, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC", encheres_perdues: [],                                                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Thauvin",         club: "Lens",       poste: "MO", prix: 53, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",      encheres_perdues: [{ equipe: "Les ananas", prix: 49 }, { equipe: "Le Champion", prix: 26 }], saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Tolisso",         club: "Lyon",       poste: "MD", prix: 53, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",      encheres_perdues: [{ equipe: "Le Champion", prix: 44 }, { equipe: "Les ananas", prix: 35 }], saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Kamory Doumbia",  club: "Brest",      poste: "MD", prix: 44, acheteur: "roman",  equipe_acheteur: "Le Champion",    encheres_perdues: [{ equipe: "Caen Tâte", prix: 37 }],                                  saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Pagis",           club: "Lorient",    poste: "A",  prix: 43, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",      encheres_perdues: [{ equipe: "Le Champion", prix: 24 }],                                 saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Ajorque",         club: "Brest",      poste: "A",  prix: 40, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC", encheres_perdues: [],                                                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Makengo",         club: "Lorient",    poste: "MD", prix: 36, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",      encheres_perdues: [{ equipe: "Le Champion", prix: 32 }],                                 saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Del Castillo",    club: "Brest",      poste: "A",  prix: 34, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",      encheres_perdues: [],                                                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Dieng",           club: "Lorient",    poste: "A",  prix: 33, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC", encheres_perdues: [{ equipe: "Le Champion", prix: 18 }],                                saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Gboho",           club: "Toulouse",   poste: "MO", prix: 33, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC", encheres_perdues: [],                                                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Nuno Mendes",     club: "Paris",      poste: "DL", prix: 31, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC", encheres_perdues: [{ equipe: "Les ananas", prix: 25 }],                                  saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Kebbal",          club: "Paris FC",   poste: "MO", prix: 28, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC", encheres_perdues: [],                                                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Zaïre-Emery",    club: "Paris",      poste: "MD", prix: 26, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",      encheres_perdues: [],                                                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Moreira",         club: "Strasbourg", poste: "DL", prix: 26, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",      encheres_perdues: [{ equipe: "Stade Khéné FC", prix: 26 }, { equipe: "Le Champion", prix: 23 }], saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
];

importMercato(DATA).catch(err => { console.error('❌', err.message); process.exit(1); });
