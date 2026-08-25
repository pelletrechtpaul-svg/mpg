export const getPosteGroupe = (poste) => {
  if (poste === 'A') return 'A';
  if (['MD', 'MO', 'MC', 'M'].includes(poste)) return 'M';
  if (['DC', 'DL', 'DG', 'DD', 'D'].includes(poste)) return 'D';
  if (poste === 'G') return 'G';
  return null;
};

// Une entrée buteurs/notes d'un match porte un `statut` ('compte' ou 'banc')
// depuis la refonte de la saisie (triage titulaire-remplaçant-entré vs
// remplaçant resté sur le banc) : seules les entrées "compte" alimentent les
// stats officielles (classements, moyennes) - le "banc" sert uniquement aux
// stats fun (ex: but marqué en restant sur le banc), jamais aux classements.
// Une entrée sans `statut` (matchs saisis avant cette refonte) est traitée
// comme "compte" pour ne pas changer les stats déjà affichées.
export const isCompte = (entry) => entry.statut !== 'banc';

export const medianFn = (arr) => {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

export const encodeFirestoreKey = (key) => key.replace(/\//g, '_');
export const decodeFirestoreKey = (key) => key.replace(/_/g, '/');

export const groupMatchesByChampionship = (matches) => {
  const map = {};
  matches.forEach(match => {
    const key = `${match.saison}-${match.ligue}-${match.championnat}`;
    if (!map[key]) map[key] = [];
    map[key].push(match);
  });
  return map;
};

export const calculateLongestStreak = (playerMatches, conditionFn) => {
  let current = 0, max = 0, maxEnd = null;
  playerMatches.forEach((match, idx) => {
    if (conditionFn(match)) {
      current++;
      if (current > max) { max = current; maxEnd = idx; }
    } else {
      current = 0;
    }
  });
  if (max === 0) return null;
  const startDate = playerMatches[maxEnd - max + 1]?.date;
  const endDate = playerMatches[maxEnd]?.date;
  return { length: max, startDate, endDate };
};

export const calculatePlayerStats = (matches, joueursList) => {
  const stats = {};
  joueursList.forEach(joueur => {
    stats[joueur] = { points: 0, matchs: 0, victoires: 0, nuls: 0, defaites: 0, buts_pour: 0, buts_contre: 0, ga: 0 };
  });
  matches.forEach(match => {
    const { joueur1, joueur2, buts_j1, buts_j2, points_j1, points_j2 } = match;
    if (stats[joueur1]) {
      stats[joueur1].points += points_j1; stats[joueur1].matchs++;
      stats[joueur1].buts_pour += buts_j1; stats[joueur1].buts_contre += buts_j2;
      if (buts_j1 > buts_j2) stats[joueur1].victoires++;
      else if (buts_j1 === buts_j2) stats[joueur1].nuls++;
      else stats[joueur1].defaites++;
    }
    if (stats[joueur2]) {
      stats[joueur2].points += points_j2; stats[joueur2].matchs++;
      stats[joueur2].buts_pour += buts_j2; stats[joueur2].buts_contre += buts_j1;
      if (buts_j2 > buts_j1) stats[joueur2].victoires++;
      else if (buts_j1 === buts_j2) stats[joueur2].nuls++;
      else stats[joueur2].defaites++;
    }
  });
  Object.keys(stats).forEach(j => { stats[j].ga = stats[j].buts_pour - stats[j].buts_contre; });
  return stats;
};
