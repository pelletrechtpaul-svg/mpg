const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

db.collection('mercato').get().then(snap => {
  const players = {};
  snap.docs.forEach(doc => {
    const d = doc.data();
    const key = d.joueur+'_'+d.ligue+'_'+d.championnat+'_'+d.tour;
    if (!players[key]) players[key] = [];
    players[key].push({ id: doc.id, acheteur: d.acheteur, prix: d.prix, poste: d.poste, prenom: d.prenom||'-', nationalite: d.nationalite||'-' });
  });

  console.log('=== DOUBLONS ===');
  let nbDoublons = 0;
  Object.entries(players).forEach(([key, entries]) => {
    if (entries.length > 1) {
      nbDoublons++;
      console.log('DOUBLON:', key);
      entries.forEach((e,i) => console.log('  ['+i+'] id:'+e.id+' acheteur:'+e.acheteur+' prix:'+e.prix+' poste:'+e.poste+' prenom:'+e.prenom+' nat:'+e.nationalite));
    }
  });
  if (!nbDoublons) console.log('Aucun doublon.');

  console.log('\n=== CHAMPS MANQUANTS ===');
  let missingPrenom=0, missingNat=0, missingPoste=0, missingAcheteur=0, prixZero=0;
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (!d.prenom) missingPrenom++;
    if (!d.nationalite) missingNat++;
    if (!d.poste) missingPoste++;
    if (!d.acheteur) missingAcheteur++;
    if (!d.prix || d.prix === 0) prixZero++;
  });
  console.log('Sans prenom:', missingPrenom, '| Sans nationalite:', missingNat, '| Sans poste:', missingPoste, '| Sans acheteur:', missingAcheteur, '| Prix=0:', prixZero);

  console.log('\n=== TOP 30 NOMS DE JOUEURS (fréquence) ===');
  const nomCount = {};
  snap.docs.forEach(doc => {
    const n = (doc.data().joueur || '(vide)').trim();
    nomCount[n] = (nomCount[n]||0)+1;
  });
  Object.entries(nomCount).sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([n,c]) => console.log(' ',c+'x', n));

  console.log('\n=== QUASI-DOUBLONS (noms similaires) ===');
  const noms = Object.keys(nomCount);
  const leven = (a,b) => {
    const m=a.length, n=b.length;
    const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===0?j:j===0?i:0));
    for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
    return dp[m][n];
  };
  const seen = new Set();
  noms.forEach((a,i) => noms.slice(i+1).forEach(b => {
    const key = [a,b].sort().join('|');
    if (!seen.has(key) && leven(a.toLowerCase(),b.toLowerCase())<=2 && a!==b) {
      seen.add(key);
      console.log(' SIMILAIRE:', JSON.stringify(a), '<=>', JSON.stringify(b));
    }
  }));

  console.log('\nTotal:', snap.size, 'entrées');
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
