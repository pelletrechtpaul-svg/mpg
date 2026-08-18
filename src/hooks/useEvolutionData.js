import { useMemo } from 'react';
import { calculatePlayerStats, groupMatchesByChampionship } from '../shared.jsx';

export const useEvolutionData = (filteredData, joueurs, selectedLigue, selectedChampionnat, ligueMetadata) => {
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
  }, [filteredData, selectedLigue, selectedChampionnat, joueurs, ligueMetadata]);

  return { matchesListForChampionnat, historicalEvolution };
};
