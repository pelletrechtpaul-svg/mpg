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
  { joueur: "Dembélé",        club: "Paris",      poste: "A",  prix: 94, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",      encheres_perdues: [{ equipe: "Le Champion", prix: 93 }], nationalite: "Français",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Aubameyang",     club: "Marseille",  poste: "A",  prix: 44, acheteur: "roman",  equipe_acheteur: "Le Champion",    encheres_perdues: [],                                    nationalite: "Gabonais",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Saïd",           club: "Lens",       poste: "A",  prix: 44, acheteur: "roman",  equipe_acheteur: "Le Champion",    encheres_perdues: [],                                    nationalite: "Français",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Sulc",           club: "Lyon",       poste: "MO", prix: 24, acheteur: "Adrien", equipe_acheteur: "Les ananas",     encheres_perdues: [],                                    nationalite: "Tchèque",     saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Udol",           club: "Lens",       poste: "DL", prix: 20, acheteur: "Adrien", equipe_acheteur: "Les ananas",     encheres_perdues: [],                                    nationalite: "Français",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Baidoo",         club: "Lens",       poste: "DC", prix: 19, acheteur: "Adrien", equipe_acheteur: "Les ananas",     encheres_perdues: [],                                    nationalite: "Autrichien",  saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Haraldsson",     club: "Lille",      poste: "MO", prix: 18, acheteur: "Adrien", equipe_acheteur: "Les ananas",     encheres_perdues: [],                                    nationalite: "Islandais",   saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Mayulu",         club: "Paris",      poste: "MO", prix: 17, acheteur: "Adrien", equipe_acheteur: "Les ananas",     encheres_perdues: [],                                    nationalite: "Français",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Ndiaye",         club: "Le Havre",   poste: "MD", prix: 17, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",      encheres_perdues: [],                                    nationalite: "Sénégalais",  saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Kvaratskhelia",  club: "Paris",      poste: "A",  prix: 17, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",      encheres_perdues: [],                                    nationalite: "Géorgien",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Lamine Camara",  club: "Monaco",     poste: "MD", prix: 16, acheteur: "Adrien", equipe_acheteur: "Les ananas",     encheres_perdues: [],                                    nationalite: "Sénégalais",  saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Ousmane Camara", club: "Angers",     poste: "DC", prix: 15, acheteur: "Paul",   equipe_acheteur: "Caen Tâte",      encheres_perdues: [],                                    nationalite: "Malien",      saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Coudert",        club: "Brest",      poste: "G",  prix: 15, acheteur: "roman",  equipe_acheteur: "Le Champion",    encheres_perdues: [],                                    nationalite: "Français",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Coulibaly",      club: "Monaco",     poste: "MD", prix: 14, acheteur: "Adrien", equipe_acheteur: "Les ananas",     encheres_perdues: [],                                    nationalite: "Français",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Perrin",         club: "Lille",      poste: "MO", prix: 14, acheteur: "roman",  equipe_acheteur: "Le Champion",    encheres_perdues: [],                                    nationalite: "Français",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Raolisoa",       club: "Angers",     poste: "DL", prix: 13, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC", encheres_perdues: [],                                    nationalite: "Français",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Golovin",        club: "Monaco",     poste: "MO", prix: 13, acheteur: "roman",  equipe_acheteur: "Le Champion",    encheres_perdues: [],                                    nationalite: "Russe",       saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Félix Correia",  club: "Lille",      poste: "MO", prix: 12, acheteur: "Adrien", equipe_acheteur: "Les ananas",     encheres_perdues: [],                                    nationalite: "Portugais",   saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Munetsi",        club: "Paris FC",   poste: "MD", prix: 10, acheteur: "roman",  equipe_acheteur: "Le Champion",    encheres_perdues: [],                                    nationalite: "Zimbabwéen",  saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Szymanski",      club: "Rennes",     poste: "MO", prix: 10, acheteur: "roman",  equipe_acheteur: "Le Champion",    encheres_perdues: [],                                    nationalite: "Polonais",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Brassier",       club: "Rennes",     poste: "DC", prix:  9, acheteur: "roman",  equipe_acheteur: "Le Champion",    encheres_perdues: [],                                    nationalite: "Français",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Kehrer",         club: "Monaco",     poste: "DC", prix:  9, acheteur: "roman",  equipe_acheteur: "Le Champion",    encheres_perdues: [],                                    nationalite: "Allemand",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Immobile",       club: "Paris FC",   poste: "A",  prix:  8, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC", encheres_perdues: [],                                    nationalite: "Italien",     saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Majecki",        club: "Brest",      poste: "G",  prix:  7, acheteur: "roman",  equipe_acheteur: "Le Champion",    encheres_perdues: [],                                    nationalite: "Polonais",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
  { joueur: "Himbert",        club: "Lyon",       poste: "MO", prix:  5, acheteur: "Tiago",  equipe_acheteur: "Stade Khéné FC", encheres_perdues: [],                                    nationalite: "Français",    saison: "2025/2026", ligue: "Ligue 1", championnat: 5, tour: 2 },
];

importMercato(DATA).catch(err => { console.error('❌', err.message); process.exit(1); });
