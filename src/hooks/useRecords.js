import { useMemo } from 'react';
import { calculatePlayerStats, groupMatchesByChampionship, calculateLongestStreak } from '../shared.jsx';

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

const updateRecord = (records, key, value, compareFn) => {
  if (records[key].length === 0 || compareFn(value, records[key][0]) > 0) records[key] = [value];
  else if (compareFn(value, records[key][0]) === 0) records[key].push(value);
};

export const useRecords = (filteredData, joueurs, ligueMetadata, matchData, selectedSeason) => {
  const seasonRecords = useMemo(() => {
    if (filteredData.length === 0) return null;

    const records = { mostGoalsInMatch: [], biggestWinMargin: [], mostProlificMatch: [], longestWinStreak: {}, longestUnbeatenStreak: {}, longestLossStreak: {}, longestDrawStreak: {}, longestGoalDrought: {}, longestCleanSheetStreak: {}, mostRegular: [], mostUnpredictable: [], bestWinRatioPeak: [], bestCurrentWinRatio: [], bestHeadToHead: [], bestH2HStreak: [], mostGoalsInChampionship: [], mostConcededInChampionship: [], mostProlificDraw: [], clutchChampion: [], closeWinsKing: [], berserkKing: [], drawSpecialist: [], perfectSeason: [], unbeatenChampion: [], bestGAChampionship: [], worstGAChampionship: [], tightestChampionship: [], mostExplosive: [], leastExplosive: [], mostDrawsChampionship: [], biggestDomination: [], remontada: [] };

    filteredData.forEach(match => {
      [{ joueur: match.joueur1, buts: match.buts_j1, adversaire: match.joueur2, butsAdv: match.buts_j2 }, { joueur: match.joueur2, buts: match.buts_j2, adversaire: match.joueur1, butsAdv: match.buts_j1 }].forEach(perf => {
        updateRecord(records, 'mostGoalsInMatch', { joueur: perf.joueur, buts: perf.buts, adversaire: perf.adversaire, butsAdv: perf.butsAdv, date: match.dateMatch, ligue: match.ligue, championnat: match.championnat }, (a, b) => a.buts - b.buts);
      });
      const diff1 = match.buts_j1 - match.buts_j2, diff2 = match.buts_j2 - match.buts_j1;
      if (diff1 > 0) updateRecord(records, 'biggestWinMargin', { joueur: match.joueur1, adversaire: match.joueur2, score: `${match.buts_j1}-${match.buts_j2}`, margin: diff1, date: match.dateMatch, ligue: match.ligue, championnat: match.championnat }, (a, b) => a.margin - b.margin);
      if (diff2 > 0) updateRecord(records, 'biggestWinMargin', { joueur: match.joueur2, adversaire: match.joueur1, score: `${match.buts_j2}-${match.buts_j1}`, margin: diff2, date: match.dateMatch, ligue: match.ligue, championnat: match.championnat }, (a, b) => a.margin - b.margin);
      const totalGoals = match.buts_j1 + match.buts_j2;
      updateRecord(records, 'mostProlificMatch', { joueur1: match.joueur1, joueur2: match.joueur2, score: `${match.buts_j1}-${match.buts_j2}`, totalGoals, date: match.dateMatch, ligue: match.ligue, championnat: match.championnat }, (a, b) => a.totalGoals - b.totalGoals);
      if (match.resultat === 'nul') updateRecord(records, 'mostProlificDraw', { joueur1: match.joueur1, joueur2: match.joueur2, score: `${match.buts_j1}-${match.buts_j2}`, totalGoals, date: match.dateMatch, ligue: match.ligue, championnat: match.championnat }, (a, b) => a.totalGoals - b.totalGoals);
    });

    const closeWinsCounts = {}, berserkCounts = {};
    joueurs.forEach(j => { closeWinsCounts[j] = 0; berserkCounts[j] = 0; });
    filteredData.forEach(match => {
      const margin = Math.abs(match.buts_j1 - match.buts_j2);
      const winner = match.resultat === 'victoire_j1' ? match.joueur1 : match.resultat === 'victoire_j2' ? match.joueur2 : null;
      if (winner && closeWinsCounts[winner] !== undefined) { if (margin === 1) closeWinsCounts[winner]++; if (margin >= 5) berserkCounts[winner]++; }
    });
    const maxClose = Math.max(...Object.values(closeWinsCounts).filter(v => v > 0), 0);
    if (maxClose > 0) records.closeWinsKing = Object.entries(closeWinsCounts).filter(([, v]) => v === maxClose).map(([joueur]) => ({ joueur, count: maxClose }));
    const maxBerserk = Math.max(...Object.values(berserkCounts).filter(v => v > 0), 0);
    if (maxBerserk > 0) records.berserkKing = Object.entries(berserkCounts).filter(([, v]) => v === maxBerserk).map(([joueur]) => ({ joueur, count: maxBerserk }));

    const drawCounts = {};
    joueurs.forEach(j => { drawCounts[j] = { draws: 0, total: 0 }; });
    filteredData.forEach(m => {
      const isDraw = m.buts_j1 === m.buts_j2;
      if (drawCounts[m.joueur1]) { drawCounts[m.joueur1].total++; if (isDraw) drawCounts[m.joueur1].draws++; }
      if (drawCounts[m.joueur2]) { drawCounts[m.joueur2].total++; if (isDraw) drawCounts[m.joueur2].draws++; }
    });
    const drawSpecialistCandidates = Object.entries(drawCounts).filter(([, s]) => s.total >= 10).map(([joueur, s]) => ({ joueur, draws: s.draws, total: s.total, ratio: s.draws / s.total })).sort((a, b) => b.ratio - a.ratio);
    if (drawSpecialistCandidates.length > 0) { const maxRatio = drawSpecialistCandidates[0].ratio; records.drawSpecialist = drawSpecialistCandidates.filter(e => e.ratio === maxRatio); }

    const sortedMatches = [...filteredData].sort((a, b) => new Date(a.dateMatch) - new Date(b.dateMatch));

    joueurs.forEach(joueur => {
      const playerMatches = sortedMatches.filter(m => m.joueur1 === joueur || m.joueur2 === joueur).map(m => {
        const isJ1 = m.joueur1 === joueur;
        return { date: m.dateMatch, buts: isJ1 ? m.buts_j1 : m.buts_j2, butsAdv: isJ1 ? m.buts_j2 : m.buts_j1, result: m.resultat === (isJ1 ? 'victoire_j1' : 'victoire_j2') ? 'W' : m.resultat === 'nul' ? 'D' : 'L', ligue: m.ligue, championnat: m.championnat };
      });

      const streakKeys = [['longestWinStreak', m => m.result === 'W'], ['longestUnbeatenStreak', m => m.result !== 'L'], ['longestLossStreak', m => m.result === 'L'], ['longestDrawStreak', m => m.result === 'D'], ['longestGoalDrought', m => m.buts === 0], ['longestCleanSheetStreak', m => m.butsAdv === 0]];
      streakKeys.forEach(([key, fn]) => { const streak = calculateLongestStreak(playerMatches, fn); if (streak) records[key][joueur] = streak; });

      if (playerMatches.length > 2) {
        const goalDiffs = playerMatches.map(m => m.buts - m.butsAdv);
        const mean = goalDiffs.reduce((a, b) => a + b, 0) / goalDiffs.length;
        const stdDev = Math.sqrt(goalDiffs.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / goalDiffs.length);
        updateRecord(records, 'mostRegular', { joueur, stdDev, matchs: playerMatches.length }, (a, b) => b.stdDev - a.stdDev);
        updateRecord(records, 'mostUnpredictable', { joueur, stdDev, matchs: playerMatches.length }, (a, b) => a.stdDev - b.stdDev);
      }

      if (playerMatches.length >= 30) {
        let wins = 0, totalMatchesSoFar = 0, bestRatio = 0, bestRatioDate = null, bestRatioWins = 0, bestRatioMatches = 0;
        playerMatches.forEach(match => {
          totalMatchesSoFar++;
          if (match.result === 'W') wins++;
          if (totalMatchesSoFar >= 30) { const ratio = wins / totalMatchesSoFar; if (ratio > bestRatio || (ratio === bestRatio && totalMatchesSoFar > bestRatioMatches)) { bestRatio = ratio; bestRatioDate = match.date; bestRatioWins = wins; bestRatioMatches = totalMatchesSoFar; } }
        });
        if (bestRatio > 0) updateRecord(records, 'bestWinRatioPeak', { joueur, ratio: bestRatio, wins: bestRatioWins, totalMatches: bestRatioMatches, date: bestRatioDate }, (a, b) => a.ratio - b.ratio);
        const totalWins = playerMatches.filter(m => m.result === 'W').length;
        const currentRatio = totalWins / playerMatches.length;
        updateRecord(records, 'bestCurrentWinRatio', { joueur, ratio: currentRatio, wins: totalWins, totalMatches: playerMatches.length }, (a, b) => a.ratio - b.ratio);
      }
    });

    joueurs.forEach(j1 => {
      joueurs.forEach(j2 => {
        if (j1 >= j2) return;
        const h2hMatches = sortedMatches.filter(m => (m.joueur1 === j1 && m.joueur2 === j2) || (m.joueur1 === j2 && m.joueur2 === j1));
        if (h2hMatches.length >= 8) {
          let j1Wins = 0, j1GA = 0, j2Wins = 0, j2GA = 0;
          h2hMatches.forEach(m => { if (m.joueur1 === j1) { j1GA += m.buts_j1 - m.buts_j2; j2GA += m.buts_j2 - m.buts_j1; if (m.buts_j1 > m.buts_j2) j1Wins++; else if (m.buts_j2 > m.buts_j1) j2Wins++; } else { j1GA += m.buts_j2 - m.buts_j1; j2GA += m.buts_j1 - m.buts_j2; if (m.buts_j2 > m.buts_j1) j1Wins++; else if (m.buts_j1 > m.buts_j2) j2Wins++; } });
          let dominant, dominated, dominantWins, dominatedWins, gaAdvantage, winRatio;
          if (j1Wins > j2Wins || (j1Wins === j2Wins && j1GA > j2GA)) { dominant = j1; dominated = j2; dominantWins = j1Wins; dominatedWins = j2Wins; gaAdvantage = j1GA; winRatio = j1Wins / h2hMatches.length; }
          else if (j2Wins > j1Wins || (j2Wins === j1Wins && j2GA > j1GA)) { dominant = j2; dominated = j1; dominantWins = j2Wins; dominatedWins = j1Wins; gaAdvantage = j2GA; winRatio = j2Wins / h2hMatches.length; }
          else return;
          const dominanceScore = winRatio * Math.abs(gaAdvantage);
          updateRecord(records, 'bestHeadToHead', { dominant, dominated, wins: dominantWins, losses: dominatedWins, draws: h2hMatches.length - dominantWins - dominatedWins, totalMatches: h2hMatches.length, gaAdvantage, winRatio, dominanceScore }, (a, b) => a.dominanceScore - b.dominanceScore);
        }
        const h2hMapped = h2hMatches.length >= 3 ? h2hMatches.map(m => { const isJ1 = m.joueur1 === j1; const bJ1 = isJ1 ? m.buts_j1 : m.buts_j2, bJ2 = isJ1 ? m.buts_j2 : m.buts_j1; return { date: m.dateMatch, resultForJ1: bJ1 > bJ2 ? 'W' : bJ1 < bJ2 ? 'L' : 'D' }; }) : null;
        if (h2hMapped) {
          [{ player: j1, winKey: 'W' }, { player: j2, winKey: 'L' }].forEach(({ player, winKey }) => {
            const opponent = player === j1 ? j2 : j1;
            const streak = calculateLongestStreak(h2hMapped, m => m.resultForJ1 === winKey);
            if (!streak) return;
            updateRecord(records, 'bestH2HStreak', { joueur: player, adversaire: opponent, length: streak.length, startDate: streak.startDate, endDate: streak.endDate }, (a, b) => a.length - b.length);
          });
        }
      });
    });

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
        updateRecord(records, 'mostGoalsInChampionship', { joueur, goals: s.goalsScored, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison }, (a, b) => a.goals - b.goals);
        updateRecord(records, 'mostConcededInChampionship', { joueur, goals: s.goalsConceded, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison }, (a, b) => a.goals - b.goals);
      });

      const ranking = Object.entries(calculatePlayerStats(matches, joueurs)).map(([joueur, data]) => ({ joueur, ...data })).filter(p => p.matchs > 0).sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
      if (ranking.length < 2) return;
      const champion = ranking[0];
      if (champion.victoires === 6) records.perfectSeason.push({ joueur: champion.joueur, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
      if (champion.defaites === 0) records.unbeatenChampion.push({ joueur: champion.joueur, victoires: champion.victoires, nuls: champion.nuls, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
      ranking.forEach(p => {
        updateRecord(records, 'bestGAChampionship', { joueur: p.joueur, ga: p.ga, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison }, (a, b) => a.ga - b.ga);
        updateRecord(records, 'worstGAChampionship', { joueur: p.joueur, ga: p.ga, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison }, (a, b) => b.ga - a.ga);
      });
      const pointsValues = ranking.map(p => p.points);
      const meanPoints = pointsValues.reduce((a, b) => a + b, 0) / pointsValues.length;
      const sigmaRounded = parseFloat(Math.sqrt(pointsValues.reduce((sum, p) => sum + Math.pow(p - meanPoints, 2), 0) / pointsValues.length).toFixed(2));
      updateRecord(records, 'tightestChampionship', { sigma: sigmaRounded, ranking: ranking.map(p => ({ joueur: p.joueur, points: p.points })), championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison }, (a, b) => b.sigma - a.sigma);
      const totalGoals = matches.reduce((sum, m) => sum + (m.buts_j1 || 0) + (m.buts_j2 || 0), 0);
      updateRecord(records, 'mostExplosive', { totalGoals, avgGoals: totalGoals / matches.length, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison }, (a, b) => a.totalGoals - b.totalGoals);
      updateRecord(records, 'leastExplosive', { totalGoals, avgGoals: totalGoals / matches.length, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison }, (a, b) => b.totalGoals - a.totalGoals);
      const totalDraws = matches.filter(m => m.buts_j1 === m.buts_j2).length;
      if (totalDraws > 0) updateRecord(records, 'mostDrawsChampionship', { count: totalDraws, total: matches.length, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison }, (a, b) => a.count - b.count);
      const domGap = champion.points - ranking[1].points;
      updateRecord(records, 'biggestDomination', { gap: domGap, champion: champion.joueur, second: ranking[1].joueur, pointsChampion: champion.points, pointsSecond: ranking[1].points, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison }, (a, b) => a.gap - b.gap);
      const halfMatches = [...matches].sort((a, b) => new Date(a.dateMatch) - new Date(b.dateMatch)).slice(0, Math.floor(matches.length / 2));
      if (halfMatches.length > 0) {
        const halfRanking = Object.entries(calculatePlayerStats(halfMatches, joueurs)).map(([joueur, data]) => ({ joueur, ...data })).filter(p => p.matchs > 0).sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
        if (halfRanking.length >= 2) {
          const halfLast = halfRanking[halfRanking.length - 1];
          if (halfLast.joueur === champion.joueur) updateRecord(records, 'remontada', { joueur: champion.joueur, halfPoints: halfLast.points, halfRank: halfRanking.length, finalPoints: champion.points, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison }, (a, b) => b.halfPoints - a.halfPoints);
        }
      }
    });

    const clutchCounts = {};
    joueurs.forEach(j => { clutchCounts[j] = 0; });
    Object.entries(championshipsMap).forEach(([key, matches]) => {
      const meta = ligueMetadata[key];
      if (!meta || meta.matchsEntered < meta.matchsTotal) return;
      const ranking = Object.entries(calculatePlayerStats(matches, joueurs)).filter(([, s]) => s.matchs > 0).sort((a, b) => b[1].points - a[1].points || b[1].ga - a[1].ga);
      if (ranking.length >= 2 && ranking[0][1].points - ranking[1][1].points === 1) clutchCounts[ranking[0][0]]++;
    });
    const maxClutch = Math.max(...Object.values(clutchCounts).filter(v => v > 0), 0);
    if (maxClutch > 0) records.clutchChampion = Object.entries(clutchCounts).filter(([, v]) => v === maxClutch).map(([joueur]) => ({ joueur, count: maxClutch }));

    return records;
  }, [filteredData, joueurs, ligueMetadata]);

  const ligueRecordsAllTime = useMemo(() => computeLigueStats(matchData, 5), [matchData]);
  const ligueRecordsSeason = useMemo(() => {
    if (selectedSeason === 'All-Time') return null;
    return computeLigueStats(filteredData, 3);
  }, [filteredData, selectedSeason]);

  return { seasonRecords, ligueRecordsAllTime, ligueRecordsSeason };
};
