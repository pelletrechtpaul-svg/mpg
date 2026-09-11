/**
 * Migration one-off : renomme le champ `ligue` des documents mercato
 * "Champions League" (nom erroné utilisé du 2026-09-08 au 2026-09-11,
 * voir CLAUDE.md) en "Ligue des Champions" (nom canonique utilisé partout
 * ailleurs dans l'app : AdminAddMatchForm.jsx, AdminEditPanel.jsx,
 * constants.js, useSeasonData.js).
 *
 * Usage :
 *   node scripts/migrate-ligue-name.cjs            (dry-run, liste les docs)
 *   DRY_RUN=false node scripts/migrate-ligue-name.cjs   (écrit en DB)
 */

const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const FROM = 'Champions League';
const TO = 'Ligue des Champions';

async function main() {
  const snap = await db.collection('mercato').where('ligue', '==', FROM).get();
  console.log(`${snap.size} documents mercato trouvés avec ligue="${FROM}"`);

  if (snap.size === 0) return;

  if (process.env.DRY_RUN === 'false') {
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 499) {
      const batch = db.batch();
      docs.slice(i, i + 499).forEach(d => batch.update(d.ref, { ligue: TO }));
      await batch.commit();
    }
    console.log(`✅ ${snap.size} documents migrés vers ligue="${TO}"`);
  } else {
    console.log('Dry-run : relancer avec DRY_RUN=false pour écrire.');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
