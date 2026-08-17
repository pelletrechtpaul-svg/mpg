/**
 * Provisionne le système de rôles admin :
 *  - crée/marque l'admin principal comme "full" dans config/adminRoles
 *  - crée le compte Firebase Auth du 2e admin (rôle "matches") s'il n'existe pas
 *
 * Ne jamais logger de mot de passe. Exécuté une seule fois localement,
 * jamais via un secret GitHub Actions (le mot de passe ne doit pas
 * transiter par un log ou un historique git).
 *
 * Usage: node scripts/setup-admin-roles.cjs
 * (les identifiants sont lus depuis ADMIN_SETUP_CONFIG, injecté par le
 * script appelant, jamais écrit sur disque en clair)
 */
const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const config = JSON.parse(process.env.ADMIN_SETUP_CONFIG);
const { primaryEmail, secondEmail, secondPassword } = config;

async function main() {
  // 1. Rôles
  const rolesRef = db.collection('config').doc('adminRoles');
  const snap = await rolesRef.get();
  const roles = snap.exists ? snap.data() : {};
  roles[primaryEmail.toLowerCase()] = 'full';
  roles[secondEmail.toLowerCase()] = 'matches';
  await rolesRef.set(roles);
  console.log('✅ config/adminRoles mis à jour:', Object.keys(roles).map(k => `${k} → ${roles[k]}`).join(', '));

  // 2. Compte Firebase Auth du 2e admin
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(secondEmail);
    await admin.auth().updateUser(userRecord.uid, { password: secondPassword });
    console.log(`✅ Compte existant mis à jour: ${secondEmail} (uid: ${userRecord.uid})`);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      userRecord = await admin.auth().createUser({ email: secondEmail, password: secondPassword });
      console.log(`✅ Compte créé: ${secondEmail} (uid: ${userRecord.uid})`);
    } else {
      throw e;
    }
  }

  process.exit(0);
}

main().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
