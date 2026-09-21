import { useMemo } from 'react';
import { calculatePlayerStats, groupMatchesByChampionship, calculateLongestStreak, isCompte, rotaldosFor, hasDetailedData } from '../shared.jsx';

const computeLigueStats = (matches, minMatchs = 3) => {
  if (!matches || matches.length === 0) return null;
  const ligueStats = {};
  matches.forEach(match => {
    const ligue = match.ligue;
    if (!ligue) return;
    if (!ligueStats[ligue]) ligueStats[ligue] = { matchs: 0, totalGoals: 0, draws: 0, cleanSheets: 0, totalMargin: 0 };
    const s = ligueStats[ligue];
    s.matchs++; s.totalGoals += (match.buts_j1 || 0) + (match.buts_j2 || 0); s.totalMargin += Math.abs((match.buts_j1 || 0) - (match.buts_j2 || 0));
    if (match.buts_j1 === match.buts_j2) s.draws++;
    if (match.buts_j1 === 0 || match.buts_j2 === 0) s.cleanSheets++;
  });
  const ligues = Object.entries(ligueStats).filter(([, s]) => s.matchs >= minMatchs).map(([ligue, s]) => ({ ligue, matchs: s.matchs, avgGoals: s.totalGoals / s.matchs, totalGoals: s.totalGoals, drawRate: s.draws / s.matchs, drawCount: s.draws, cleanSheetRate: s.cleanSheets / s.matchs, cleanSheetCount: s.cleanSheets, avgMargin: s.totalMargin / s.matchs })).sort((a, b) => b.avgGoals - a.avgGoals);
  if (ligues.length === 0) return null;
  return { ligues };
};

const saisonTs = s => { const m = s?.match(/(\d{4})/); return m ? parseInt(m[1]) : 0; };
const dateTs = d => d ? new Date(d).getTime() : 0;

// Returns strictly top n entries; ties broken by tiebreakerFn (descending)
const topN = (arr, scoreFn, tiebreakerFn = null, n = 3) => {
  if (!arr.length) return [];
  return [...arr].sort((a, b) => {
    const diff = scoreFn(b) - scoreFn(a);
    if (diff !== 0) return diff;
    return tiebreakerFn ? tiebreakerFn(b) - tiebreakerFn(a) : 0;
  }).slice(0, n);
};

// Comme topN, mais à score EXACTEMENT égal, priorise la diversité des
// entraîneurs avant d'autoriser une 2e entrée du même entraîneur - sinon
// "3 fidélités à 2 chez le même coach" peut masquer un autre coach à la
// même égalité.
const topNDiverseCoach = (arr, scoreFn, coachFn, tiebreakerFn = null, n = 3) => {
  if (!arr.length) return [];
  const sorted = [...arr].sort((a, b) => {
    const diff = scoreFn(b) - scoreFn(a);
    if (diff !== 0) return diff;
    return tiebreakerFn ? tiebreakerFn(b) - tiebreakerFn(a) : 0;
  });
  const groups = new Map();
  sorted.forEach(item => {
    const score = scoreFn(item);
    if (!groups.has(score)) groups.set(score, []);
    groups.get(score).push(item);
  });
  const ordered = [];
  [...groups.keys()].sort((a, b) => b - a).forEach(score => {
    const seen = new Set(), first = [], rest = [];
    groups.get(score).forEach(item => {
      const coach = coachFn(item);
      if (!seen.has(coach)) { seen.add(coach); first.push(item); } else rest.push(item);
    });
    ordered.push(...first, ...rest);
  });
  return ordered.slice(0, n);
};

// Regroupement en 4 grandes familles de postes (noms au pluriel pour
// l'affichage - distinct du POSTE_GROUP de FormationPitch.jsx qui sert à
// l'agencement du terrain, pas seulement à l'affichage).
const POSTE_GROUP = {
  G: 'Gardiens',
  DC: 'Défenseurs', DL: 'Défenseurs', DG: 'Défenseurs', DD: 'Défenseurs', D: 'Défenseurs',
  MC: 'Milieux', MO: 'Milieux', MD: 'Milieux', M: 'Milieux',
  A: 'Attaquants',
};

const computeMercatoRecords = (mercato, matches) => {
  if (!mercato || mercato.length === 0) return null;

  // Buts/CSC/matchs joués par joueur mercato (clé joueur|ligue), à partir
  // des buteurs et notes des matchs.
  const goalMap = {};
  (matches || []).forEach(m => {
    (m.buteurs || []).filter(isCompte).forEach(b => {
      if (!b.joueur) return;
      const key = `${b.joueur}|${m.ligue}`;
      if (!goalMap[key]) goalMap[key] = { buts: 0, csc: 0 };
      if (b.csc) goalMap[key].csc += (b.buts || 1);
      else goalMap[key].buts += (b.buts || 1);
    });
  });
  const matchesPlayedMap = {};
  (matches || []).forEach(m => {
    (m.notes || []).filter(isCompte).forEach(n => {
      if (!n.joueur) return;
      const key = `${n.joueur}|${m.ligue}`;
      matchesPlayedMap[key] = (matchesPlayedMap[key] || 0) + 1;
    });
  });

  // Nombre cumulé (brut, pas ramené à une moyenne) de "gros transferts" par
  // ligue, pour plusieurs seuils au choix (budget fixe de 500M pour tout le
  // monde => le prix MOYEN par joueur est peu discriminant, mais le nombre
  // de très grosses enchères l'est). Toutes les ligues connues du mercato
  // apparaissent, même à 0.
  const ligueSet = [...new Set(mercato.map(m => m.ligue).filter(Boolean))];
  const BIG_TRANSFER_THRESHOLDS = [40, 80, 120];
  const bigTransfersByLigue = {};
  BIG_TRANSFER_THRESHOLDS.forEach(threshold => {
    const counts = {};
    ligueSet.forEach(l => { counts[l] = 0; });
    mercato.forEach(m => { if (m.ligue && (m.prix || 0) >= threshold) counts[m.ligue]++; });
    bigTransfersByLigue[threshold] = ligueSet
      .map(ligue => ({ ligue, count: counts[ligue] }))
      .sort((a, b) => b.count - a.count);
  });

  // Nombre cumulé de batailles d'enchères (au moins une offre perdante),
  // par ligue.
  const bidWarsCounts = {};
  ligueSet.forEach(l => { bidWarsCounts[l] = 0; });
  mercato.forEach(m => { if (m.ligue && (m.encheres_perdues || []).length > 0) bidWarsCounts[m.ligue]++; });
  const bidWarsByLigue = ligueSet
    .map(ligue => ({ ligue, count: bidWarsCounts[ligue] }))
    .sort((a, b) => b.count - a.count);

  // Plus grosses enchères
  const biggestBids = topN(mercato, m => m.prix || 0, m => saisonTs(m.saison) * 1000 + (m.championnat || 0));

  // Record du prix le plus élevé par grande famille de poste (Attaquants/
  // Milieux/Défenseurs/Gardiens) — le spread de `best` doit passer APRÈS
  // `poste` sinon le poste précis du joueur (ex. "MO") écrase le nom du
  // groupe qu'on veut afficher.
  const byPoste = {};
  mercato.forEach(m => {
    const grp = POSTE_GROUP[m.poste] || 'Autre';
    if (!byPoste[grp]) byPoste[grp] = [];
    byPoste[grp].push(m);
  });
  const recordParPoste = Object.entries(byPoste)
    .map(([poste, arr]) => { const best = topN(arr, m => m.prix || 0, m => saisonTs(m.saison) * 1000 + (m.championnat || 0), 1)[0]; return best ? { ...best, poste } : null; })
    .filter(Boolean)
    .sort((a, b) => (b.prix || 0) - (a.prix || 0));

  // Plus grosse mise cumulée sur un même joueur, tous mercatos confondus -
  // y compris s'il a été recruté dans plusieurs ligues différentes (on
  // cumule par nom de joueur seul, pas par clé joueur|ligue).
  const cumulByPlayer = {};
  mercato.forEach(m => {
    if (!m.joueur) return;
    cumulByPlayer[m.joueur] = (cumulByPlayer[m.joueur] || 0) + (m.prix || 0);
  });
  const biggestCumulativeSpend = Object.entries(cumulByPlayer)
    .map(([joueur, total]) => ({ joueur, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  // Même record, décliné par grande famille de poste (réutilise le
  // regroupement byPoste ci-dessus).
  const cumulativeSpendParPoste = Object.entries(byPoste)
    .map(([poste, arr]) => {
      const sums = {};
      arr.forEach(m => { if (!m.joueur) return; sums[m.joueur] = (sums[m.joueur] || 0) + (m.prix || 0); });
      const [joueur, total] = Object.entries(sums).sort((a, b) => b[1] - a[1])[0] || [];
      return joueur ? { joueur, total, poste } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total);

  // Plus gros flops : joueurs les plus chers n'ayant inscrit aucun but,
  // à partir de 3 matchs joués (sinon un seul match sans but suffirait à
  // qualifier n'importe quelle recrue tout juste arrivée)
  const flopCandidates = mercato.filter(m =>
    (m.prix || 0) > 0 &&
    (goalMap[`${m.joueur}|${m.ligue}`]?.buts || 0) === 0 &&
    (matchesPlayedMap[`${m.joueur}|${m.ligue}`] || 0) >= 3);
  const biggestFlops = topN(flopCandidates, m => m.prix || 0, m => saisonTs(m.saison) * 1000 + (m.championnat || 0));

  // Meilleur rapport qualité/prix : buts marqués / prix payé (seuil 2 buts pour éviter le bruit)
  const ratioCandidates = mercato
    .filter(m => (m.prix || 0) > 0)
    .map(m => { const g = goalMap[`${m.joueur}|${m.ligue}`] || { buts: 0 }; return { ...m, buts: g.buts, ratio: g.buts / m.prix }; })
    .filter(m => m.buts >= 2);
  const bestValueForMoney = topN(ratioCandidates, m => m.ratio, m => m.buts);

  // --- Records "cumul des mandats" : mêmes métriques que ci-dessus mais
  // agrégées sur toutes les enchères remportées d'un même joueur réel
  // (toutes ligues/championnats/tours confondus), plutôt que sur une seule
  // enchère isolée.
  const totalGoalsByPlayer = {};
  Object.entries(goalMap).forEach(([key, g]) => {
    const joueur = key.split('|')[0];
    totalGoalsByPlayer[joueur] = (totalGoalsByPlayer[joueur] || 0) + g.buts;
  });
  const totalMatchesByPlayer = {};
  Object.entries(matchesPlayedMap).forEach(([key, count]) => {
    const joueur = key.split('|')[0];
    totalMatchesByPlayer[joueur] = (totalMatchesByPlayer[joueur] || 0) + count;
  });

  const bestValueForMoneyCumule = Object.entries(cumulByPlayer)
    .filter(([, total]) => total > 0)
    .map(([joueur, total]) => ({ joueur, total, buts: totalGoalsByPlayer[joueur] || 0, ratio: (totalGoalsByPlayer[joueur] || 0) / total }))
    .filter(m => m.buts >= 2)
    .sort((a, b) => b.ratio - a.ratio || b.buts - a.buts)
    .slice(0, 3);

  const biggestFlopsCumule = Object.entries(cumulByPlayer)
    .filter(([joueur, total]) => total > 0 && !(totalGoalsByPlayer[joueur] > 0) && (totalMatchesByPlayer[joueur] || 0) >= 3)
    .map(([joueur, total]) => ({ joueur, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  // Plus grand nombre de mises cumulées sur un même joueur (toutes ligues/
  // championnats/tours confondus) — total des enchères reçues, gagnantes ET
  // perdantes (ex. 3 coachs enchérissent sur Mbappé en Liga + 3 en Ligue des
  // Champions = 6, même s'il n'a été remporté que 2 fois sur les 2 enchères
  // gagnantes).
  const totalBidsByPlayer = {};
  mercato.forEach(m => {
    if (!m.joueur) return;
    const bids = 1 + (m.encheres_perdues || []).length;
    totalBidsByPlayer[m.joueur] = (totalBidsByPlayer[m.joueur] || 0) + bids;
  });
  const mostBidsCumulees = Object.entries(totalBidsByPlayer)
    .map(([joueur, count]) => ({ joueur, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // --- Records "divers" : statistiques mercato par entraîneur.
  const distinctPlayersByCoach = {}, bidWarsWonByCoach = {}, bidsByCoach = {};
  mercato.forEach(m => {
    if (!m.acheteur) return;
    if (!distinctPlayersByCoach[m.acheteur]) distinctPlayersByCoach[m.acheteur] = new Set();
    if (m.joueur) distinctPlayersByCoach[m.acheteur].add(m.joueur);
    if ((m.encheres_perdues || []).length > 0) bidWarsWonByCoach[m.acheteur] = (bidWarsWonByCoach[m.acheteur] || 0) + 1;
    if (!bidsByCoach[m.acheteur]) bidsByCoach[m.acheteur] = [];
    bidsByCoach[m.acheteur].push(m.prix || 0);
  });
  const median = arr => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const recruitsCountByCoach = Object.entries(distinctPlayersByCoach)
    .map(([joueur, set]) => ({ joueur, count: set.size }))
    .sort((a, b) => b.count - a.count);
  const bidWarsWonCoach = Object.entries(bidWarsWonByCoach)
    .map(([joueur, count]) => ({ joueur, count }))
    .sort((a, b) => b.count - a.count);
  const medianBidCoach = Object.entries(bidsByCoach)
    .map(([joueur, prix]) => { const med = median(prix); return { joueur, median: med, medianLabel: `${med}M` }; })
    .sort((a, b) => b.median - a.median);

  // Longévité mercato : plus longue série de championnats consécutifs (même joueur, même ligue, même coach)
  const longeviteGroups = {};
  mercato.forEach(m => {
    const key = `${m.joueur}|${m.ligue}|${m.acheteur}`;
    if (!longeviteGroups[key]) longeviteGroups[key] = { joueur: m.joueur, ligue: m.ligue, acheteur: m.acheteur, championnats: new Set(), saisons: new Set() };
    longeviteGroups[key].championnats.add(m.championnat);
    longeviteGroups[key].saisons.add(m.saison);
  });
  const longeviteCandidates = Object.values(longeviteGroups).map(g => {
    const sorted = [...g.championnats].sort((a, b) => a - b);
    let best = 1, cur = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) { cur++; best = Math.max(best, cur); }
      else cur = 1;
    }
    return { joueur: g.joueur, ligue: g.ligue, acheteur: g.acheteur, streak: sorted.length ? best : 0, saisons: [...g.saisons] };
  }).filter(g => g.streak > 1);
  const longevite = topNDiverseCoach(longeviteCandidates, g => g.streak, g => g.acheteur, g => Math.max(...g.saisons.map(saisonTs)));

  return {
    // One shots (une seule enchère/championnat)
    biggestBids, recordParPoste, bestValueForMoney, biggestFlops,
    // Cumul des mandats (agrégé sur toutes les enchères d'un même joueur)
    biggestCumulativeSpend, cumulativeSpendParPoste, bestValueForMoneyCumule, biggestFlopsCumule, mostBidsCumulees,
    // Divers
    longevite, recruitsCountByCoach, bidWarsWonCoach, medianBidCoach,
    // Par ligue
    bigTransfersByLigue, BIG_TRANSFER_THRESHOLDS, bidWarsByLigue,
  };
};

export const useRecords = (filteredData, joueurs, ligueMetadata, matchData, selectedSeason, mercatoData, filteredMercatoData) => {
  const seasonRecords = useMemo(() => {
    if (filteredData.length === 0) return null;

    // Raw arrays for top-3 records
    const rawMostGoalsInMatch = [], rawBiggestWinMargin = [];
    const rawMostProlificMatch = [], rawMostProlificDraw = [];
    const rawMostGoalsInChamp = [], rawMostConcededInChamp = [];
    const rawBestGA = [], rawWorstGA = [];
    const rawTightest = [];

    // Streak records: per-player dict
    const longestWinStreak = {}, longestUnbeatenStreak = {}, longestLossStreak = {};
    const longestDrawStreak = {}, longestGoalDrought = {}, longestCleanSheetStreak = {};

    // Count-based records: all players
    const closeWinsCounts = {}, berserkCounts = {}, clutchCounts = {};
    joueurs.forEach(j => { closeWinsCounts[j] = 0; berserkCounts[j] = 0; clutchCounts[j] = 0; });

    // Bilan banc/rotaldos/CSC : all players
    const rotaldoCounts = {}, benchGoalsCounts = {}, cscCounts = {};
    const benchNoteSums = {}, benchNoteCounts = {}, compteNoteSums = {}, compteNoteCounts = {};
    joueurs.forEach(j => { rotaldoCounts[j] = 0; benchGoalsCounts[j] = 0; cscCounts[j] = 0; benchNoteSums[j] = 0; benchNoteCounts[j] = 0; compteNoteSums[j] = 0; compteNoteCounts[j] = 0; });

    // Per-player best H2H streak
    const bestH2HStreak = {};
    joueurs.forEach(j => { bestH2HStreak[j] = null; });

    // Regularity: all players
    const allPlayerStdDevs = [];

    const perfectSeason = [], unbeatenChampion = [];

    // Per-match records
    filteredData.forEach(match => {
      [{ joueur: match.joueur1, buts: match.buts_j1, adversaire: match.joueur2, butsAdv: match.buts_j2 },
       { joueur: match.joueur2, buts: match.buts_j2, adversaire: match.joueur1, butsAdv: match.buts_j1 }].forEach(perf => {
        rawMostGoalsInMatch.push({ joueur: perf.joueur, buts: perf.buts, adversaire: perf.adversaire, butsAdv: perf.butsAdv, date: match.dateMatch, ligue: match.ligue, championnat: match.championnat });
      });
      const diff1 = match.buts_j1 - match.buts_j2, diff2 = match.buts_j2 - match.buts_j1;
      if (diff1 > 0) rawBiggestWinMargin.push({ joueur: match.joueur1, adversaire: match.joueur2, score: `${match.buts_j1}-${match.buts_j2}`, margin: diff1, date: match.dateMatch, ligue: match.ligue, championnat: match.championnat });
      if (diff2 > 0) rawBiggestWinMargin.push({ joueur: match.joueur2, adversaire: match.joueur1, score: `${match.buts_j2}-${match.buts_j1}`, margin: diff2, date: match.dateMatch, ligue: match.ligue, championnat: match.championnat });
      const totalGoals = match.buts_j1 + match.buts_j2;
      rawMostProlificMatch.push({ joueur1: match.joueur1, joueur2: match.joueur2, score: `${match.buts_j1}-${match.buts_j2}`, totalGoals, date: match.dateMatch, ligue: match.ligue, championnat: match.championnat });
      if (match.resultat === 'nul') rawMostProlificDraw.push({ joueur1: match.joueur1, joueur2: match.joueur2, score: `${match.buts_j1}-${match.buts_j2}`, totalGoals, date: match.dateMatch, ligue: match.ligue, championnat: match.championnat });

      const margin = Math.abs(match.buts_j1 - match.buts_j2);
      const winner = match.resultat === 'victoire_j1' ? match.joueur1 : match.resultat === 'victoire_j2' ? match.joueur2 : null;
      if (winner && closeWinsCounts[winner] !== undefined) {
        if (margin === 1) closeWinsCounts[winner]++;
        if (margin >= 5) berserkCounts[winner]++;
      }

      // Rotaldos subis
      if (match.joueur1 && rotaldoCounts[match.joueur1] !== undefined) rotaldoCounts[match.joueur1] += rotaldosFor(match.notes, match.joueur1);
      if (match.joueur2 && rotaldoCounts[match.joueur2] !== undefined) rotaldoCounts[match.joueur2] += rotaldosFor(match.notes, match.joueur2);

      // Buts gâchés sur le banc (un joueur "banc" a marqué mais ça ne compte
      // pas) + CSC (uniquement ceux d'un joueur qui comptait, comme dans
      // l'étude de banc par ligue de ClassementsTab)
      (match.buteurs || []).forEach(b => {
        if (!b.acheteur) return;
        if (b.csc) { if (isCompte(b) && cscCounts[b.acheteur] !== undefined) cscCounts[b.acheteur] += b.buts || 1; return; }
        if (b.statut === 'banc' && benchGoalsCounts[b.acheteur] !== undefined) benchGoalsCounts[b.acheteur] += b.buts || 1;
      });

      // Moyenne banc vs compte : compare la performance des joueurs restés
      // sur le banc (quand notés) à celle des joueurs qui ont compté
      (match.notes || []).forEach(n => {
        if (!n.acheteur || n.note == null || benchNoteSums[n.acheteur] === undefined) return;
        if (n.statut === 'banc') { benchNoteSums[n.acheteur] += n.note; benchNoteCounts[n.acheteur]++; }
        else { compteNoteSums[n.acheteur] += n.note; compteNoteCounts[n.acheteur]++; }
      });
    });

    const sortedMatches = [...filteredData].sort((a, b) => new Date(a.dateMatch) - new Date(b.dateMatch));

    // Per-player streaks and regularity
    joueurs.forEach(joueur => {
      const playerMatches = sortedMatches.filter(m => m.joueur1 === joueur || m.joueur2 === joueur).map(m => {
        const isJ1 = m.joueur1 === joueur;
        return { date: m.dateMatch, buts: isJ1 ? m.buts_j1 : m.buts_j2, butsAdv: isJ1 ? m.buts_j2 : m.buts_j1, result: m.resultat === (isJ1 ? 'victoire_j1' : 'victoire_j2') ? 'W' : m.resultat === 'nul' ? 'D' : 'L', ligue: m.ligue, championnat: m.championnat };
      });

      const streakDefs = [
        ['longestWinStreak', longestWinStreak, m => m.result === 'W'],
        ['longestUnbeatenStreak', longestUnbeatenStreak, m => m.result !== 'L'],
        ['longestLossStreak', longestLossStreak, m => m.result === 'L'],
        ['longestDrawStreak', longestDrawStreak, m => m.result === 'D'],
        ['longestGoalDrought', longestGoalDrought, m => m.buts === 0],
        ['longestCleanSheetStreak', longestCleanSheetStreak, m => m.butsAdv === 0],
      ];
      streakDefs.forEach(([, dict, fn]) => {
        const streak = calculateLongestStreak(playerMatches, fn);
        dict[joueur] = streak || { length: 0, startDate: null, endDate: null };
      });

      if (playerMatches.length > 2) {
        const goalDiffs = playerMatches.map(m => m.buts - m.butsAdv);
        const mean = goalDiffs.reduce((a, b) => a + b, 0) / goalDiffs.length;
        const stdDev = Math.sqrt(goalDiffs.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / goalDiffs.length);
        allPlayerStdDevs.push({ joueur, stdDev, matchs: playerMatches.length });
      }
    });
    allPlayerStdDevs.sort((a, b) => a.stdDev - b.stdDev); // most regular first

    // H2H streaks: per-player best
    joueurs.forEach(j1 => {
      joueurs.forEach(j2 => {
        if (j1 >= j2) return;
        const h2hMatches = sortedMatches.filter(m => (m.joueur1 === j1 && m.joueur2 === j2) || (m.joueur1 === j2 && m.joueur2 === j1));
        if (h2hMatches.length < 3) return;
        const h2hMapped = h2hMatches.map(m => {
          const isJ1 = m.joueur1 === j1;
          const bJ1 = isJ1 ? m.buts_j1 : m.buts_j2, bJ2 = isJ1 ? m.buts_j2 : m.buts_j1;
          return { date: m.dateMatch, resultForJ1: bJ1 > bJ2 ? 'W' : bJ1 < bJ2 ? 'L' : 'D' };
        });
        [{ player: j1, winKey: 'W', opponent: j2 }, { player: j2, winKey: 'L', opponent: j1 }].forEach(({ player, winKey, opponent }) => {
          const streak = calculateLongestStreak(h2hMapped, m => m.resultForJ1 === winKey);
          if (!streak) return;
          if (!bestH2HStreak[player] || streak.length > bestH2HStreak[player].length) {
            bestH2HStreak[player] = { length: streak.length, adversaire: opponent, startDate: streak.startDate, endDate: streak.endDate };
          }
        });
      });
    });

    // Championship records
    const championshipsMap = groupMatchesByChampionship(filteredData);
    Object.entries(championshipsMap).forEach(([key, matches]) => {
      const champMeta = ligueMetadata[key];
      if (!champMeta || champMeta.matchsTotal !== 6 || champMeta.matchsEntered < champMeta.matchsTotal) return;
      const championshipStats = {};
      joueurs.forEach(j => { championshipStats[j] = { goalsScored: 0, goalsConceded: 0 }; });
      matches.forEach(match => {
        if (match.joueur1) { championshipStats[match.joueur1].goalsScored += match.buts_j1 || 0; championshipStats[match.joueur1].goalsConceded += match.buts_j2 || 0; }
        if (match.joueur2) { championshipStats[match.joueur2].goalsScored += match.buts_j2 || 0; championshipStats[match.joueur2].goalsConceded += match.buts_j1 || 0; }
        if (match.joueur3) { championshipStats[match.joueur3].goalsScored += match.buts_j3 || 0; championshipStats[match.joueur3].goalsConceded += match.buts_j4 || 0; }
        if (match.joueur4) { championshipStats[match.joueur4].goalsScored += match.buts_j4 || 0; championshipStats[match.joueur4].goalsConceded += match.buts_j3 || 0; }
      });
      Object.entries(championshipStats).forEach(([joueur, s]) => {
        rawMostGoalsInChamp.push({ joueur, goals: s.goalsScored, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
        rawMostConcededInChamp.push({ joueur, goals: s.goalsConceded, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
      });

      const ranking = Object.entries(calculatePlayerStats(matches, joueurs)).map(([joueur, data]) => ({ joueur, ...data })).filter(p => p.matchs > 0).sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
      if (ranking.length < 2) return;
      const champion = ranking[0];
      if (champion.victoires === 6) perfectSeason.push({ joueur: champion.joueur, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
      if (champion.defaites === 0) unbeatenChampion.push({ joueur: champion.joueur, victoires: champion.victoires, nuls: champion.nuls, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
      ranking.forEach(p => {
        rawBestGA.push({ joueur: p.joueur, ga: p.ga, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
        rawWorstGA.push({ joueur: p.joueur, ga: p.ga, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
      });
      const pointsValues = ranking.map(p => p.points);
      const meanPoints = pointsValues.reduce((a, b) => a + b, 0) / pointsValues.length;
      const sigmaRounded = parseFloat(Math.sqrt(pointsValues.reduce((sum, p) => sum + Math.pow(p - meanPoints, 2), 0) / pointsValues.length).toFixed(2));
      rawTightest.push({ sigma: sigmaRounded, ranking: ranking.map(p => ({ joueur: p.joueur, points: p.points })), championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
    });

    // Clutch: all championships (including incomplete)
    Object.entries(championshipsMap).forEach(([key, matches]) => {
      const meta = ligueMetadata[key];
      if (!meta || meta.matchsEntered < meta.matchsTotal) return;
      const ranking = Object.entries(calculatePlayerStats(matches, joueurs)).filter(([, s]) => s.matchs > 0).sort((a, b) => b[1].points - a[1].points || b[1].ga - a[1].ga);
      if (ranking.length >= 2 && ranking[0][1].points - ranking[1][1].points === 1) clutchCounts[ranking[0][0]]++;
    });

    return {
      // Match records — tiebreaker: date la plus récente
      mostGoalsInMatch: topN(rawMostGoalsInMatch, v => v.buts, v => dateTs(v.date)),
      biggestWinMargin: topN(rawBiggestWinMargin, v => v.margin, v => dateTs(v.date)),
      mostProlificMatch: topN(rawMostProlificMatch, v => v.totalGoals, v => dateTs(v.date)),
      mostProlificDraw: topN(rawMostProlificDraw, v => v.totalGoals, v => dateTs(v.date)),
      // Championship records — tiebreaker: saison la plus récente, puis numéro de championnat
      mostGoalsInChampionship: topN(rawMostGoalsInChamp, v => v.goals, v => saisonTs(v.saison) * 1000 + (v.championnat || 0)),
      mostConcededInChampionship: topN(rawMostConcededInChamp, v => v.goals, v => saisonTs(v.saison) * 1000 + (v.championnat || 0)),
      bestGAChampionship: topN(rawBestGA, v => v.ga, v => saisonTs(v.saison) * 1000 + (v.championnat || 0)),
      worstGAChampionship: topN(rawWorstGA, v => -v.ga, v => saisonTs(v.saison) * 1000 + (v.championnat || 0)),
      tightestChampionship: topN(rawTightest, v => -v.sigma, v => saisonTs(v.saison) * 1000 + (v.championnat || 0)),
      closeWinsKing: Object.entries(closeWinsCounts).map(([j, c]) => ({ joueur: j, count: c })).sort((a, b) => b.count - a.count),
      berserkKing: Object.entries(berserkCounts).map(([j, c]) => ({ joueur: j, count: c })).sort((a, b) => b.count - a.count),
      clutchChampion: Object.entries(clutchCounts).map(([j, c]) => ({ joueur: j, count: c })).sort((a, b) => b.count - a.count),
      rotaldoKing: Object.entries(rotaldoCounts).map(([j, c]) => ({ joueur: j, count: c })).sort((a, b) => b.count - a.count),
      benchGoalsKing: Object.entries(benchGoalsCounts).map(([j, c]) => ({ joueur: j, count: c })).sort((a, b) => b.count - a.count),
      cscKing: Object.entries(cscCounts).map(([j, c]) => ({ joueur: j, count: c })).sort((a, b) => b.count - a.count),
      // Seuil de 3 notes banc pour éviter le bruit d'un coach avec 1 seul cas.
      // diff = titulaire - banc (positif = titulaires meilleurs, l'attendu ;
      // négatif = le banc a fait mieux, la surprise) - tri du plus surprenant
      // (banc au-dessus) au moins surprenant.
      benchVsCompteAvg: joueurs
        .filter(j => benchNoteCounts[j] >= 3 && compteNoteCounts[j] > 0)
        .map(j => {
          const compteAvg = compteNoteSums[j] / compteNoteCounts[j];
          const bancAvg = benchNoteSums[j] / benchNoteCounts[j];
          return { joueur: j, compteAvg, bancAvg, diff: compteAvg - bancAvg, bancCount: benchNoteCounts[j] };
        })
        .sort((a, b) => a.diff - b.diff),
      longestWinStreak, longestUnbeatenStreak, longestLossStreak,
      longestDrawStreak, longestGoalDrought, longestCleanSheetStreak,
      bestH2HStreak,
      allPlayerStdDevs,
      perfectSeason,
      unbeatenChampion,
    };
  }, [filteredData, joueurs, ligueMetadata]);

  const ligueRecordsAllTime = useMemo(() => computeLigueStats(matchData, 5), [matchData]);
  const ligueRecordsSeason = useMemo(() => {
    if (selectedSeason === 'All-Time') return null;
    return computeLigueStats(filteredData, 3);
  }, [filteredData, selectedSeason]);

  // Records mercato : jamais dispo tant qu'une saison sans mercato importé
  // (2024/2025, 2025/2026) fait partie de la période affichée — y compris
  // All-Time, qui les inclut toujours.
  const mercatoRecordsSeason = useMemo(() => {
    if (!hasDetailedData(selectedSeason)) return null;
    return computeMercatoRecords(filteredMercatoData, filteredData);
  }, [filteredMercatoData, filteredData, selectedSeason]);

  return { seasonRecords, ligueRecordsAllTime, ligueRecordsSeason, mercatoRecordsSeason };
};
