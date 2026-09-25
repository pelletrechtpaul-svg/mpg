/**
 * Exporte toutes les collections Firestore en JSON dans backup/ (un fichier
 * par collection + _meta.json), restaurables avec restore-firestore.cjs.
 *
 * config/adminRoles est exclu : il ne contient que les emails des admins,
 * rien qu'on ait besoin de restaurer depuis une sauvegarde.
 *
 * Usage : node scripts/backup-firestore.cjs
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const OUT_DIR = path.join(__dirname, '../backup');
const EXCLUDED_DOCS = new Set(['config/adminRoles']);

// Les Timestamp Firestore ne survivent pas à JSON.stringify : on les marque
// pour que la restauration les recrée à l'identique.
function serialize(value) {
  if (value instanceof admin.firestore.Timestamp) return { __timestamp: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const collections = await db.listCollections();
  const counts = {};

  for (const col of collections) {
    const snap = await col.get();
    const docs = snap.docs
      .filter(d => !EXCLUDED_DOCS.has(`${col.id}/${d.id}`))
      .map(d => ({ id: d.id, data: serialize(d.data()) }));
    fs.writeFileSync(path.join(OUT_DIR, `${col.id}.json`), JSON.stringify(docs, null, 1));
    counts[col.id] = docs.length;
    console.log(`${col.id} : ${docs.length} documents`);
  }

  fs.writeFileSync(path.join(OUT_DIR, '_meta.json'), JSON.stringify({ exportedAt: new Date().toISOString(), counts }, null, 2));
  console.log(`\nSauvegarde écrite dans backup/ (${Object.values(counts).reduce((a, b) => a + b, 0)} documents).`);
}

main().then(() => process.exit(0)).catch(e => { console.error('Erreur :', e.message); process.exit(1); });
