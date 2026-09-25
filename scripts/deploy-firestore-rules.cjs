/**
 * Publie firestore.rules comme règles Firestore de production, après avoir
 * affiché la différence avec la version actuellement en ligne.
 *
 * Garde-fou : si la version en ligne ne correspond à AUCUNE version de
 * firestore.rules présente dans l'historique git, c'est qu'elle a été
 * modifiée ailleurs (console Firebase) — on refuse alors d'écraser ces
 * changements, sauf FORCE=true.
 *
 * Usage :
 *   node scripts/deploy-firestore-rules.cjs                ← dry-run : diff seulement
 *   DRY_RUN=false node scripts/deploy-firestore-rules.cjs  ← publie
 *   DRY_RUN=false FORCE=true node scripts/...              ← publie même si modifiées ailleurs
 */
const admin = require('firebase-admin');
const { getSecurityRules } = require('firebase-admin/security-rules');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });

const DRY_RUN = process.env.DRY_RUN !== 'false';
const FORCE = process.env.FORCE === 'true';
const RULES_FILE = 'firestore.rules';
const repoRoot = path.join(__dirname, '..');

const normalize = s => s.replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd()).join('\n').trim();

function committedVersions() {
  const shas = execFileSync('git', ['log', '--format=%H', '--', RULES_FILE], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  return shas.map(sha => {
    try {
      return execFileSync('git', ['show', `${sha}:${RULES_FILE}`], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return null;
    }
  }).filter(Boolean).map(normalize);
}

async function main() {
  const local = fs.readFileSync(path.join(repoRoot, RULES_FILE), 'utf8');
  const rules = getSecurityRules();
  const live = (await rules.getFirestoreRuleset()).source.map(f => f.content).join('\n');

  if (normalize(live) === normalize(local)) {
    console.log('Les règles en ligne sont déjà identiques au fichier : rien à publier.');
    return;
  }

  console.log('=== Différence : version en ligne → firestore.rules ===\n');
  const liveTmp = path.join(os.tmpdir(), 'firestore-live.rules');
  fs.writeFileSync(liveTmp, live);
  try {
    execFileSync('diff', ['-u', '--label', 'en ligne', '--label', RULES_FILE, liveTmp, path.join(repoRoot, RULES_FILE)], { stdio: 'inherit' });
  } catch {
    // diff renvoie 1 quand les fichiers diffèrent : attendu.
  }

  const liveIsKnown = committedVersions().includes(normalize(live));
  console.log(`\nVersion en ligne ${liveIsKnown ? 'connue (déjà présente dans l\'historique git)' : 'INCONNUE : modifiée hors du repo (console Firebase ?)'}.`);

  if (DRY_RUN) {
    console.log('DRY-RUN : rien n\'a été publié.');
    return;
  }
  if (!liveIsKnown && !FORCE) {
    console.error('Publication annulée pour ne pas écraser des changements faits ailleurs. Reporter ces changements dans firestore.rules, ou relancer avec FORCE=true.');
    process.exit(1);
  }

  const released = await rules.releaseFirestoreRulesetFromSource(local);
  console.log(`\nRègles publiées (${released.name}).`);
}

main().catch(e => { console.error('Erreur :', e.message); process.exit(1); });
