/**
 * Restaure dans Firestore une sauvegarde produite par backup-firestore.cjs
 * (dossier backup/). Chaque document est réécrit à l'identique avec son id
 * d'origine. Les documents créés APRÈS la sauvegarde ne sont pas supprimés :
 * ils sont seulement listés, pour décision manuelle.
 *
 * Usage :
 *   node scripts/restore-firestore.cjs                      ← dry-run : résumé seulement
 *   DRY_RUN=false node scripts/restore-firestore.cjs         ← restaure tout
 *   COLLECTIONS=matches,mercato DRY_RUN=false node scripts/… ← restaure seulement ces collections
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN !== 'false';
const BACKUP_DIR = path.join(__dirname, '../backup');
const ONLY = (process.env.COLLECTIONS || '').split(',').map(s => s.trim()).filter(Boolean);
const BATCH_SIZE = 400;

function deserialize(value) {
  if (Array.isArray(value)) return value.map(deserialize);
  if (value && typeof value === 'object') {
    if (Object.keys(value).length === 1 && typeof value.__timestamp === 'string') {
      return admin.firestore.Timestamp.fromDate(new Date(value.__timestamp));
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deserialize(v)]));
  }
  return value;
}

async function main() {
  const meta = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, '_meta.json'), 'utf8'));
  console.log(`Sauvegarde du ${meta.exportedAt}${DRY_RUN ? ' — DRY-RUN, rien ne sera écrit' : ''}\n`);

  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json') && f !== '_meta.json');
  for (const file of files) {
    const colName = file.replace(/\.json$/, '');
    if (ONLY.length && !ONLY.includes(colName)) continue;

    const docs = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, file), 'utf8'));
    const backupIds = new Set(docs.map(d => d.id));
    const current = await db.collection(colName).get();
    const addedSince = current.docs.filter(d => !backupIds.has(d.id)).map(d => d.id);

    console.log(`${colName} : ${docs.length} documents à restaurer (${current.size} en base actuellement)`);
    if (addedSince.length) {
      console.log(`  ${addedSince.length} document(s) créés depuis la sauvegarde, conservés tels quels : ${addedSince.slice(0, 20).join(', ')}${addedSince.length > 20 ? '…' : ''}`);
    }
    if (DRY_RUN) continue;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      docs.slice(i, i + BATCH_SIZE).forEach(d => batch.set(db.collection(colName).doc(d.id), deserialize(d.data)));
      await batch.commit();
    }
    console.log(`  ✓ restauré`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error('Erreur :', e.message); process.exit(1); });
