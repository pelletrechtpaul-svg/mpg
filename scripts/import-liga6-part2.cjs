const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyBJkp3_boAeDIoZ1XWKhJ1MohdL4JenwWU",
  authDomain: "mpg-fantasy.firebaseapp.com",
  projectId: "mpg-fantasy",
  storageBucket: "mpg-fantasy.firebasestorage.app",
  messagingSenderId: "416520898480",
  appId: "1:416520898480:web:ec6786166f4d10f0917875"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const DATA = [
  { joueur: 'Éder Militão', prenom: '', club: 'Real Madrid', poste: 'DC', prix: 18, acheteur: 'roman', equipe_acheteur: 'El Campeon', encheres_perdues: [{ equipe: 'Real Bêtise Balompié', prix: 9 }], nationalite: 'Brésilienne', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Escandell', prenom: '', club: 'Real Oviedo', poste: 'G', prix: 18, acheteur: 'Paul', equipe_acheteur: 'Machines Alavès', encheres_perdues: [], nationalite: 'Espagnole', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Griezmann', prenom: '', club: 'Atlético', poste: 'A', prix: 17, acheteur: 'Adrien', equipe_acheteur: 'Manzanas', encheres_perdues: [], nationalite: 'Française', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Güler', prenom: '', club: 'Real Madrid', poste: 'MO', prix: 17, acheteur: 'Adrien', equipe_acheteur: 'Manzanas', encheres_perdues: [{ equipe: 'Real Bêtise Balompié', prix: 17 }], nationalite: 'Turque', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Ezzalzouli', prenom: '', club: 'Betis', poste: 'A', prix: 16, acheteur: 'roman', equipe_acheteur: 'El Campeon', encheres_perdues: [], nationalite: 'Marocaine', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Darder', prenom: '', club: 'Mallorca', poste: 'MO', prix: 16, acheteur: 'Paul', equipe_acheteur: 'Machines Alavès', encheres_perdues: [], nationalite: 'Espagnole', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Simeone', prenom: '', club: 'Atlético', poste: 'A', prix: 15, acheteur: 'Adrien', equipe_acheteur: 'Manzanas', encheres_perdues: [], nationalite: 'Argentine', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Tchouaméni', prenom: '', club: 'Real Madrid', poste: 'MD', prix: 15, acheteur: 'Adrien', equipe_acheteur: 'Manzanas', encheres_perdues: [], nationalite: 'Française', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Simón', prenom: '', club: 'Athletic', poste: 'G', prix: 15, acheteur: 'Adrien', equipe_acheteur: 'Manzanas', encheres_perdues: [], nationalite: 'Espagnole', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Tsygankov', prenom: '', club: 'Girona', poste: 'MO', prix: 15, acheteur: 'roman', equipe_acheteur: 'El Campeon', encheres_perdues: [], nationalite: 'Ukrainienne', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Lemar', prenom: '', club: 'Girona', poste: 'MO', prix: 15, acheteur: 'Adrien', equipe_acheteur: 'Manzanas', encheres_perdues: [], nationalite: 'Française', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Lejeune', prenom: '', club: 'Rayo Vallecano', poste: 'DC', prix: 14, acheteur: 'Adrien', equipe_acheteur: 'Manzanas', encheres_perdues: [], nationalite: 'Française', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Martínez', prenom: '', club: 'Girona', poste: 'DL', prix: 14, acheteur: 'roman', equipe_acheteur: 'El Campeon', encheres_perdues: [], nationalite: 'Espagnole', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Ounahi', prenom: '', club: 'Girona', poste: 'MD', prix: 14, acheteur: 'Paul', equipe_acheteur: 'Machines Alavès', encheres_perdues: [{ equipe: 'El Campeon', prix: 13 }], nationalite: 'Marocaine', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Koundé', prenom: '', club: 'Barcelona', poste: 'DC', prix: 14, acheteur: 'Tiago', equipe_acheteur: 'Real Bêtise Balompié', encheres_perdues: [], nationalite: 'Française', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Rubén García', prenom: '', club: 'Osasuna', poste: 'MO', prix: 14, acheteur: 'Paul', equipe_acheteur: 'Machines Alavès', encheres_perdues: [], nationalite: 'Espagnole', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Llorente', prenom: '', club: 'Betis', poste: 'DC', prix: 13, acheteur: 'Paul', equipe_acheteur: 'Machines Alavès', encheres_perdues: [], nationalite: 'Espagnole', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Rosier', prenom: '', club: 'Osasuna', poste: 'DL', prix: 12, acheteur: 'Paul', equipe_acheteur: 'Machines Alavès', encheres_perdues: [], nationalite: 'Française', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Maffeo', prenom: '', club: 'Mallorca', poste: 'DL', prix: 12, acheteur: 'Paul', equipe_acheteur: 'Machines Alavès', encheres_perdues: [], nationalite: 'Espagnole', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Asencio', prenom: '', club: 'Real Madrid', poste: 'DC', prix: 11, acheteur: 'Adrien', equipe_acheteur: 'Manzanas', encheres_perdues: [], nationalite: 'Espagnole', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Araujo', prenom: '', club: 'Barcelona', poste: 'DC', prix: 11, acheteur: 'Adrien', equipe_acheteur: 'Manzanas', encheres_perdues: [], nationalite: 'Uruguayenne', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Bellingham', prenom: '', club: 'Real Madrid', poste: 'MO', prix: 11, acheteur: 'roman', equipe_acheteur: 'El Campeon', encheres_perdues: [], nationalite: 'Anglaise', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Berenguer', prenom: '', club: 'Athletic', poste: 'MO', prix: 10, acheteur: 'Adrien', equipe_acheteur: 'Manzanas', encheres_perdues: [], nationalite: 'Espagnole', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Calvo', prenom: '', club: 'Real Oviedo', poste: 'DC', prix: 10, acheteur: 'Paul', equipe_acheteur: 'Machines Alavès', encheres_perdues: [], nationalite: 'Espagnole', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Amrabat', prenom: '', club: 'Betis', poste: 'MD', prix: 10, acheteur: 'Paul', equipe_acheteur: 'Machines Alavès', encheres_perdues: [{ equipe: 'Real Bêtise Balompié', prix: 6 }], nationalite: 'Marocaine', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Mojica', prenom: '', club: 'Mallorca', poste: 'DL', prix: 10, acheteur: 'Adrien', equipe_acheteur: 'Manzanas', encheres_perdues: [], nationalite: 'Colombienne', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Laporte', prenom: '', club: 'Athletic', poste: 'DC', prix: 10, acheteur: 'Paul', equipe_acheteur: 'Machines Alavès', encheres_perdues: [{ equipe: 'Manzanas', prix: 9 }], nationalite: 'Française', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Almada', prenom: '', club: 'Atlético', poste: 'MO', prix: 9, acheteur: 'Tiago', equipe_acheteur: 'Real Bêtise Balompié', encheres_perdues: [], nationalite: 'Argentine', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Alexander-Arnold', prenom: '', club: 'Real Madrid', poste: 'DL', prix: 9, acheteur: 'Tiago', equipe_acheteur: 'Real Bêtise Balompié', encheres_perdues: [], nationalite: 'Anglaise', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Natan', prenom: '', club: 'Betis', poste: 'DC', prix: 8, acheteur: 'Tiago', equipe_acheteur: 'Real Bêtise Balompié', encheres_perdues: [], nationalite: 'Brésilienne', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Padilla', prenom: '', club: 'Athletic', poste: 'G', prix: 7, acheteur: 'Adrien', equipe_acheteur: 'Manzanas', encheres_perdues: [], nationalite: 'Espagnole', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Letácek', prenom: '', club: 'Getafe', poste: 'G', prix: 7, acheteur: 'roman', equipe_acheteur: 'El Campeon', encheres_perdues: [], nationalite: 'Tchèque', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Kubo', prenom: '', club: 'Real Sociedad', poste: 'MO', prix: 7, acheteur: 'roman', equipe_acheteur: 'El Campeon', encheres_perdues: [], nationalite: 'Japonaise', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Mendy', prenom: '', club: 'Real Madrid', poste: 'DL', prix: 5, acheteur: 'roman', equipe_acheteur: 'El Campeon', encheres_perdues: [{ equipe: 'Manzanas', prix: 5 }, { equipe: 'Real Bêtise Balompié', prix: 5 }], nationalite: 'Française', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Lo Celso', prenom: '', club: 'Betis', poste: 'MO', prix: 5, acheteur: 'Tiago', equipe_acheteur: 'Real Bêtise Balompié', encheres_perdues: [], nationalite: 'Argentine', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'ter Stegen', prenom: '', club: 'Girona', poste: 'G', prix: 3, acheteur: 'Tiago', equipe_acheteur: 'Real Bêtise Balompié', encheres_perdues: [], nationalite: 'Allemande', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
  { joueur: 'Isco', prenom: '', club: 'Betis', poste: 'MO', prix: 1, acheteur: 'Tiago', equipe_acheteur: 'Real Bêtise Balompié', encheres_perdues: [], nationalite: 'Espagnole', saison: '2025/2026', ligue: 'Liga', championnat: 6, tour: 1 },
];

async function main() {
  console.log(`Signing in...`);
  await signInWithEmailAndPassword(auth, 'admin@mpg-fantasy.app', 'adminmpg2025');
  console.log(`Authenticated. Importing ${DATA.length} entries...`);
  for (const entry of DATA) {
    const docRef = await addDoc(collection(db, 'mercato'), entry);
    console.log(`✓ ${entry.joueur} (${entry.prix}M → ${entry.acheteur}) → ${docRef.id}`);
  }
  console.log('Done!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
