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
  { joueur: "Teze",           club: "Monaco",     poste: "DL", prix: 23, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [{ equipe: "Le Champion", prix: 13 }], saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Morton",         club: "Lyon",       poste: "MD", prix: 22, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",       encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Zakaria",        club: "Monaco",     poste: "MD", prix: 22, acheteur: "roman",  equipe_acheteur: "Le Champion",     encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Sarr",           club: "Lens",       poste: "DC", prix: 22, acheteur: "roman",  equipe_acheteur: "Le Champion",     encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Akliouche",      club: "Monaco",     poste: "MO", prix: 20, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC",  encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Risser",         club: "Lens",       poste: "G",  prix: 19, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",       encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Fati",           club: "Monaco",     poste: "A",  prix: 19, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Édouard",        club: "Lens",       poste: "A",  prix: 17, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC",  encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Sangaré",        club: "Lens",       poste: "MD", prix: 16, acheteur: "roman",  equipe_acheteur: "Le Champion",     encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Samba",          club: "Rennes",     poste: "G",  prix: 16, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Clinton Mata",   club: "Lyon",       poste: "DL", prix: 15, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Chardonnet",     club: "Brest",      poste: "DC", prix: 15, acheteur: "roman",  equipe_acheteur: "Le Champion",     encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Pacho",          club: "Paris",      poste: "DC", prix: 14, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC",  encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Lloris",         club: "Le Havre",   poste: "DC", prix: 14, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Anthony Lopes",  club: "Nantes",     poste: "G",  prix: 13, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Lee Kang-In",    club: "Paris",      poste: "MO", prix: 13, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Perraud",        club: "Lille",      poste: "DL", prix: 13, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",       encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Safonov",        club: "Paris",      poste: "G",  prix: 13, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC",  encheres_perdues: [{ equipe: "Le Champion", prix: 10 }], saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Centonze",       club: "Nantes",     poste: "DL", prix: 13, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",       encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Diop",           club: "Toulouse",   poste: "MO", prix: 12, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Godo",           club: "Strasbourg", poste: "A",  prix: 12, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC",  encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Chevalier",      club: "Paris",      poste: "G",  prix: 12, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC",  encheres_perdues: [{ equipe: "Le Champion", prix: 10 }], saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Diaz",           club: "Brest",      poste: "DC", prix: 11, acheteur: "roman",  equipe_acheteur: "Le Champion",     encheres_perdues: [{ equipe: "Caen Tâte", prix: 10 }],   saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Doukouré",       club: "Strasbourg", poste: "DC", prix: 11, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Igor Silva",     club: "Lorient",    poste: "DC", prix: 11, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",       encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Vanderson",      club: "Monaco",     poste: "DL", prix: 10, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Saint-Maximin",  club: "Lens",       poste: "MO", prix: 10, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC",  encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Marquinhos",     club: "Paris",      poste: "DC", prix: 10, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC",  encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Caio Henrique",  club: "Monaco",     poste: "DL", prix:  9, acheteur: "roman",  equipe_acheteur: "Le Champion",     encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Faes",           club: "Monaco",     poste: "DC", prix:  8, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC",  encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Ali Youssif",    club: "Nantes",     poste: "DC", prix:  7, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",       encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Pogba",          club: "Monaco",     poste: "MO", prix:  1, acheteur: "Adrien", equipe_acheteur: "Les ananas",      encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Kamara",         club: "Lyon",       poste: "DC", prix:  1, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC",  encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Jourdren",       club: "Lens",       poste: "G",  prix:  1, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",       encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
  { joueur: "Dro Fernández",  club: "Paris",      poste: "MO", prix:  1, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC",  encheres_perdues: [],                                    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 1 },
];

importMercato(DATA).catch(err => { console.error('❌', err.message); process.exit(1); });
