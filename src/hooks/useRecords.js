import { useMemo } from 'react';
import { calculatePlayerStats, groupMatchesByChampionship, calculateLongestStreak, isCompte } from '../shared.jsx';

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
  return { ligues, mostProlific: ligues[0], leastProlific: ligues[ligues.length - 1], mostDraws: [...ligues].sort((a, b) => b.drawRate - a.drawRate)[0], mostCleanSheets: [...ligues].sort((a, b) => b.cleanSheetRate - a.cleanSheetRate)[0], tightest: [...ligues].sort((a, b) => a.avgMargin - b.avgMargin)[0] };
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

const POSTE_GROUP = {
  G: 'Gardien',
  DC: 'Défenseur', DL: 'Défenseur', DG: 'Défenseur', DD: 'Défenseur', D: 'Défenseur',
  MC: 'Milieu', MO: 'Milieu', MD: 'Milieu', M: 'Milieu',
  A: 'Attaquant',
};

const computeMercatoRecords = (mercato, matches) => {
  if (!mercato || mercato.length === 0) return null;

  // Buts/CSC par joueur mercato (clé joueur|ligue), à partir des buteurs des matchs
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

  // Plus grosses enchères
  const biggestBids = topN(mercato, m => m.prix || 0, m => saisonTs(m.saison) * 1000 + (m.championnat || 0));

  // Record du prix le plus élevé par poste (regroupé en 4 grandes familles)
  const byPoste = {};
  mercato.forEach(m => {
    const grp = POSTE_GROUP[m.poste] || 'Autre';
    if (!byPoste[grp]) byPoste[grp] = [];
    byPoste[grp].push(m);
  });
  const recordParPoste = Object.entries(byPoste)
    .map(([poste, arr]) => { const best = topN(arr, m => m.prix || 0, m => saisonTs(m.saison) * 1000 + (m.championnat || 0), 1)[0]; return best ? { poste, ...best } : null; })
    .filter(Boolean)
    .sort((a, b) => (b.prix || 0) - (a.prix || 0));

  // Plus gros flops : joueurs les plus chers n'ayant inscrit aucun but
  const flopCandidates = mercato.filter(m => (m.prix || 0) > 0 && (goalMap[`${m.joueur}|${m.ligue}`]?.buts || 0) === 0);
  const biggestFlops = topN(flopCandidates, m => m.prix || 0, m => saisonTs(m.saison) * 1000 + (m.championnat || 0));

  // Meilleur rapport qualité/prix : buts marqués / prix payé (seuil 2 buts pour éviter le bruit)
  const ratioCandidates = mercato
    .filter(m => (m.prix || 0) > 0)
    .map(m => { const g = goalMap[`${m.joueur}|${m.ligue}`] || { buts: 0 }; return { ...m, buts: g.buts, ratio: g.buts / m.prix }; })
    .filter(m => m.buts >= 2);
  const bestValueForMoney = topN(ratioCandidates, m => m.ratio, m => m.buts);

  // CSC le plus cher
  const cscCandidates = mercato
    .filter(m => (m.prix || 0) > 0)
    .map(m => { const g = goalMap[`${m.joueur}|${m.ligue}`] || { csc: 0 }; return { ...m, csc: g.csc }; })
    .filter(m => m.csc > 0);
  const priciestCsc = topN(cscCandidates, m => m.prix || 0, m => m.csc);

  // Longévité mercato : plus longue série de championnats consécutifs (même joueur, même ligue, même coach)
  const longeviteGroups = {};
  mercato.forEach(m => {
    const key = `${m.joueur}|${m.ligue}|${m.acheteur}`;
    if (!longeviteGroups[key]) longeviteGroups[key] = { joueur: m.joueur, ligue: m.ligue, acheteur: m.acheteur, championnats: new Set(), saisons: new Set() };
    longeviteGroups[key].championnats.add(m.championnat);
    longeviteGroups[key].saisons.add(m.saison);
  });
  const longevite = Object.values(longeviteGroups).map(g => {
    const sorted = [...g.championnats].sort((a, b) => a - b);
    let best = 1, cur = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) { cur++; best = Math.max(best, cur); }
      else cur = 1;
    }
    return { joueur: g.joueur, ligue: g.ligue, acheteur: g.acheteur, streak: sorted.length ? best : 0, saisons: [...g.saisons] };
  }).filter(g => g.streak > 1).sort((a, b) => b.streak - a.streak).slice(0, 3);

  return { biggestBids, recordParPoste, biggestFlops, bestValueForMoney, priciestCsc, longevite };
};

export const useRecords = (filteredData, joueurs, ligueMetadata, matchData, selectedSeason, mercatoData, filteredMercatoData) => {
  const seasonRecords = useMemo(() => {
    if (filteredData.length === 0) return null;

    // Raw arrays for top-3 records
    const rawMostGoalsInMatch = [], rawBiggestWinMargin = [];
    const rawMostProlificMatch = [], rawMostProlificDraw = [];
    const rawMostGoalsInChamp = [], rawMostConcededInChamp = [];
    const rawBestGA = [], rawWorstGA = [];
    const rawTightest = [], rawMostExplosive = [], rawLeastExplosive = [], rawMostDrawsChamp = [];

    // Streak records: per-player dict
    const longestWinStreak = {}, longestUnbeatenStreak = {}, longestLossStreak = {};
    const longestDrawStreak = {}, longestGoalDrought = {}, longestCleanSheetStreak = {};

    // Count-based records: all players
    const closeWinsCounts = {}, berserkCounts = {}, clutchCounts = {};
    joueurs.forEach(j => { closeWinsCounts[j] = 0; berserkCounts[j] = 0; clutchCounts[j] = 0; });

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
      const totalGoals = matches.reduce((sum, m) => sum + (m.buts_j1 || 0) + (m.buts_j2 || 0), 0);
      rawMostExplosive.push({ totalGoals, avgGoals: totalGoals / matches.length, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
      rawLeastExplosive.push({ totalGoals, avgGoals: totalGoals / matches.length, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
      const totalDraws = matches.filter(m => m.buts_j1 === m.buts_j2).length;
      if (totalDraws > 0) rawMostDrawsChamp.push({ count: totalDraws, total: matches.length, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
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
      mostExplosive: topN(rawMostExplosive, v => v.totalGoals, v => saisonTs(v.saison) * 1000 + (v.championnat || 0)),
      leastExplosive: topN(rawLeastExplosive, v => -v.totalGoals, v => saisonTs(v.saison) * 1000 + (v.championnat || 0)),
      // Tiebreaker pour nuls : % de nuls (count/total), puis saison récente
      mostDrawsChampionship: topN(rawMostDrawsChamp, v => v.count, v => (v.count / v.total) * 1000 + saisonTs(v.saison) * 0.001),
      closeWinsKing: Object.entries(closeWinsCounts).map(([j, c]) => ({ joueur: j, count: c })).sort((a, b) => b.count - a.count),
      berserkKing: Object.entries(berserkCounts).map(([j, c]) => ({ joueur: j, count: c })).sort((a, b) => b.count - a.count),
      clutchChampion: Object.entries(clutchCounts).map(([j, c]) => ({ joueur: j, count: c })).sort((a, b) => b.count - a.count),
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

  const mercatoRecordsAllTime = useMemo(() => computeMercatoRecords(mercatoData, matchData), [mercatoData, matchData]);
  const mercatoRecordsSeason = useMemo(() => {
    if (selectedSeason === 'All-Time') return null;
    return computeMercatoRecords(filteredMercatoData, filteredData);
  }, [filteredMercatoData, filteredData, selectedSeason]);

  return { seasonRecords, ligueRecordsAllTime, ligueRecordsSeason, mercatoRecordsAllTime, mercatoRecordsSeason };
};
