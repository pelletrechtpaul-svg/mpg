import { useMemo } from 'react';
import { calculatePlayerStats, groupMatchesByChampionship } from '../shared.jsx';

export const useEvolutionData = (filteredData, joueurs, selectedLigue, selectedChampionnat, championnatsByLigue, ligueMetadata, matchData, selectedSeason) => {
  const evolutionData = useMemo(() => {
    if (selectedChampionnat !== 'total') return [];
    let championnats, dataToUse;
    if (selectedLigue === 'general') { championnats = [...new Set(filteredData.map(d => d.championnat))].sort(); dataToUse = filteredData; }
    else { championnats = championnatsByLigue[selectedLigue] || []; dataToUse = filteredData.filter(d => d.ligue === selectedLigue); }
    return championnats.map(championnat => {
      const dataPoint = { championnat };
      const championnatsUpToNow = championnats.slice(0, championnats.indexOf(championnat) + 1);
      const matchesUpToNow = dataToUse.filter(m => championnatsUpToNow.includes(m.championnat));
      const stats = calculatePlayerStats(matchesUpToNow, joueurs);
      const victoires = {};
      joueurs.forEach(j => { victoires[j] = 0; });
      championnatsUpToNow.forEach(ch => {
        const ranking = Object.entries(calculatePlayerStats(dataToUse.filter(m => m.championnat === ch), joueurs)).map(([joueur, data]) => ({ joueur, ...data })).sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
        if (ranking.length > 0 && ranking[0].points > 0) victoires[ranking[0].joueur]++;
      });
      joueurs.forEach(joueur => { dataPoint[joueur] = stats[joueur].points + (victoires[joueur] * 3); });
      return dataPoint;
    });
  }, [filteredData, joueurs, selectedLigue, selectedChampionnat, championnatsByLigue]);

  const matchesListForChampionnat = useMemo(() => {
    if (selectedLigue === 'general') return [];
    let matches = filteredData.filter(d => d.ligue === selectedLigue);
    if (selectedChampionnat !== 'total') matches = matches.filter(d => d.championnat === selectedChampionnat);
    return matches.sort((a, b) => new Date(b.dateMatch) - new Date(a.dateMatch));
  }, [filteredData, selectedLigue, selectedChampionnat]);

  const historicalEvolution = useMemo(() => {
    let matchesToUse = filteredData;
    if (selectedLigue !== 'general') {
      matchesToUse = matchesToUse.filter(m => m.ligue === selectedLigue);
      if (selectedChampionnat !== 'total') matchesToUse = matchesToUse.filter(m => m.championnat === selectedChampionnat);
    }
    const sortedMatches = [...matchesToUse].sort((a, b) => new Date(a.dateMatch) - new Date(b.dateMatch));
    const championshipBonuses = new Map();
    const appliedBonuses = new Set();
    if (selectedLigue === 'general') {
      Object.entries(groupMatchesByChampionship(matchesToUse)).forEach(([key, matches]) => {
        const metadata = ligueMetadata[key];
        if (!metadata || metadata.matchsEntered < metadata.matchsTotal) return;
        const lastMatch = matches.reduce((latest, m) => new Date(m.dateMatch) > new Date(latest.dateMatch) ? m : latest);
        const ranking = Object.entries(calculatePlayerStats(matches, joueurs)).map(([joueur, data]) => ({ joueur, ...data })).sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
        if (ranking.length > 0 && ranking[0].points > 0) {
          championshipBonuses.set(key, { endDate: new Date(lastMatch.dateMatch), winner: ranking[0].joueur, points: metadata.matchsTotal >= 6 ? 3 : 2 });
        }
      });
    }
    const evolution = [];
    const playerPoints = {}, playerBonusPoints = {};
    joueurs.forEach(j => { playerPoints[j] = 0; playerBonusPoints[j] = 0; });
    sortedMatches.forEach((match, index) => {
      if (match.joueur1) playerPoints[match.joueur1] = (playerPoints[match.joueur1] || 0) + (match.points_j1 || 0);
      if (match.joueur2) playerPoints[match.joueur2] = (playerPoints[match.joueur2] || 0) + (match.points_j2 || 0);
      if (match.joueur3) playerPoints[match.joueur3] = (playerPoints[match.joueur3] || 0) + (match.points_j3 || 0);
      if (match.joueur4) playerPoints[match.joueur4] = (playerPoints[match.joueur4] || 0) + (match.points_j4 || 0);
      if (selectedLigue === 'general') {
        const matchDate = new Date(match.dateMatch);
        championshipBonuses.forEach((bonus, champKey) => {
          if (!appliedBonuses.has(champKey) && Math.abs(bonus.endDate - matchDate) < 1000 * 60 * 60 * 24) {
            playerBonusPoints[bonus.winner] = (playerBonusPoints[bonus.winner] || 0) + bonus.points;
            appliedBonuses.add(champKey);
          }
        });
      }
      if (index % Math.max(1, Math.floor(sortedMatches.length / 30)) === 0 || index === sortedMatches.length - 1) {
        const dataPoint = { date: new Date(match.dateMatch).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }), matchNumber: index + 1 };
        joueurs.forEach(j => { dataPoint[j] = (playerPoints[j] || 0) + (playerBonusPoints[j] || 0); });
        evolution.push(dataPoint);
      }
    });
    return evolution;
  }, [filteredData, selectedLigue, selectedChampionnat, joueurs, ligueMetadata, selectedSeason]);

  const { buteursEvolution, loosersEvolution } = useMemo(() => {
    const sortedMatches = [...matchData.filter(m => selectedSeason === 'All-Time' || m.saison === selectedSeason)].sort((a, b) => new Date(a.dateMatch) - new Date(b.dateMatch));
    const goalsEvolution = [], concededEvolution = [];
    const playerGoals = {}, playerConceded = {};
    joueurs.forEach(j => { playerGoals[j] = 0; playerConceded[j] = 0; });
    sortedMatches.forEach((match, index) => {
      const scored = { [match.joueur1]: match.buts_j1 || 0, [match.joueur2]: match.buts_j2 || 0, [match.joueur3]: match.buts_j3 || 0, [match.joueur4]: match.buts_j4 || 0 };
      const conceded = { [match.joueur1]: (match.buts_j2||0)+(match.buts_j3||0)+(match.buts_j4||0), [match.joueur2]: (match.buts_j1||0)+(match.buts_j3||0)+(match.buts_j4||0), [match.joueur3]: (match.buts_j1||0)+(match.buts_j2||0)+(match.buts_j4||0), [match.joueur4]: (match.buts_j1||0)+(match.buts_j2||0)+(match.buts_j3||0) };
      Object.entries(scored).forEach(([j, g]) => { if (j && j !== 'undefined') playerGoals[j] = (playerGoals[j] || 0) + g; });
      Object.entries(conceded).forEach(([j, g]) => { if (j && j !== 'undefined') playerConceded[j] = (playerConceded[j] || 0) + g; });
      if (index % Math.max(1, Math.floor(sortedMatches.length / 30)) === 0 || index === sortedMatches.length - 1) {
        const date = new Date(match.dateMatch).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const goalsPt = { date, matchNumber: index + 1 }, concPt = { date, matchNumber: index + 1 };
        joueurs.forEach(j => { goalsPt[j] = playerGoals[j] || 0; concPt[j] = playerConceded[j] || 0; });
        goalsEvolution.push(goalsPt); concededEvolution.push(concPt);
      }
    });
    return { buteursEvolution: goalsEvolution, loosersEvolution: concededEvolution };
  }, [matchData, selectedSeason, joueurs]);

  return { evolutionData, matchesListForChampionnat, historicalEvolution, buteursEvolution, loosersEvolution };
};
