import { useMemo } from 'react';

export const useAdvancedStats = (matchData, joueurs, selectedSeason) => useMemo(() => {
  const stats = {};
  const sortedMatches = [...matchData].filter(m => selectedSeason === 'All-Time' || m.saison === selectedSeason).sort((a, b) => new Date(b.dateMatch) - new Date(a.dateMatch));

  joueurs.forEach(joueur => {
    const playerMatches = [];
    sortedMatches.forEach(match => {
      if (match.joueur1 === joueur) playerMatches.push({ date: match.dateMatch, opponent: match.joueur2, butsFor: match.buts_j1, butsAgainst: match.buts_j2, result: match.buts_j1 > match.buts_j2 ? 'W' : match.buts_j1 < match.buts_j2 ? 'L' : 'D', championnat: match.championnat, ligue: match.ligue });
      else if (match.joueur2 === joueur) playerMatches.push({ date: match.dateMatch, opponent: match.joueur1, butsFor: match.buts_j2, butsAgainst: match.buts_j1, result: match.buts_j2 > match.buts_j1 ? 'W' : match.buts_j2 < match.buts_j1 ? 'L' : 'D', championnat: match.championnat, ligue: match.ligue });
    });
    const recentForm = playerMatches.slice(0, 10).reverse();
    let currentStreak = { type: null, count: 0 }, maxWinStreak = 0, maxUnbeatenStreak = 0, currentWinStreak = 0, currentUnbeatenStreak = 0;
    playerMatches.forEach((match, index) => {
      if (index === 0) { currentStreak.type = match.result; currentStreak.count = 1; }
      else if (currentStreak.count > 0 && match.result === currentStreak.type) currentStreak.count++;
      if (match.result === 'W') { currentWinStreak++; maxWinStreak = Math.max(maxWinStreak, currentWinStreak); } else currentWinStreak = 0;
      if (match.result === 'W' || match.result === 'D') { currentUnbeatenStreak++; maxUnbeatenStreak = Math.max(maxUnbeatenStreak, currentUnbeatenStreak); } else currentUnbeatenStreak = 0;
    });
    stats[joueur] = { recentForm, currentStreak, maxWinStreak, maxUnbeatenStreak, totalMatches: playerMatches.length };
  });

  return stats;
}, [matchData, joueurs, selectedSeason]);
