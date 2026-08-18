import { useMemo } from 'react';
import { calculatePlayerStats, groupMatchesByChampionship } from '../shared.jsx';

export const usePlayerStats = (filteredData, joueurs, selectedStatsLigue, selectedLigue, selectedChampionnat, ligueMetadata) => {
  const statsDetaillees = useMemo(() => {
    const matches = selectedStatsLigue === 'all' ? filteredData : filteredData.filter(d => d.ligue === selectedStatsLigue);
    return calculatePlayerStats(matches, joueurs);
  }, [selectedStatsLigue, filteredData, joueurs]);

  const cleanSheetsStats = useMemo(() => {
    const matches = selectedStatsLigue === 'all' ? filteredData : filteredData.filter(d => d.ligue === selectedStatsLigue);
    const stats = {};
    joueurs.forEach(j => { stats[j] = { cleanSheets: 0, pannesOffensives: 0, matchs: 0 }; });
    matches.forEach(m => {
      if (stats[m.joueur1] !== undefined) { stats[m.joueur1].matchs++; if (m.buts_j2 === 0) stats[m.joueur1].cleanSheets++; if (m.buts_j1 === 0) stats[m.joueur1].pannesOffensives++; }
      if (stats[m.joueur2] !== undefined) { stats[m.joueur2].matchs++; if (m.buts_j1 === 0) stats[m.joueur2].cleanSheets++; if (m.buts_j2 === 0) stats[m.joueur2].pannesOffensives++; }
    });
    return Object.entries(stats).map(([joueur, data]) => ({ joueur, ...data }));
  }, [selectedStatsLigue, filteredData, joueurs]);

  const heureDeGloire = useMemo(() => {
    const result = {};
    joueurs.forEach(j => {
      const champMap = groupMatchesByChampionship(filteredData.filter(m => m.joueur1 === j || m.joueur2 === j));
      let best = null;
      Object.entries(champMap).forEach(([key, matches]) => {
        const meta = ligueMetadata[key];
        if (!meta || meta.matchsEntered < meta.matchsTotal) return;
        let pts = 0, matchCount = 0;
        matches.forEach(m => { if (m.joueur1 === j) { pts += m.points_j1; matchCount++; } else if (m.joueur2 === j) { pts += m.points_j2; matchCount++; } });
        if (matchCount === 0) return;
        const avg = pts / matchCount;
        if (!best || avg > best.avg || (avg === best.avg && pts > best.pts)) best = { ligue: matches[0].ligue, championnat: matches[0].championnat, saison: matches[0].saison, avg: parseFloat(avg.toFixed(2)), pts, matchCount };
      });
      result[j] = best;
    });
    return result;
  }, [filteredData, joueurs, ligueMetadata]);

  const valiseStats = useMemo(() => {
    if (selectedLigue !== 'general' && selectedChampionnat !== 'total') return null;
    const matchesToAnalyze = selectedLigue === 'general' ? filteredData : filteredData.filter(m => m.ligue === selectedLigue);
    const stats = {};
    joueurs.forEach(j => { stats[j] = { utilisees: 0, recues: 0, efficaces: 0, efficacesRecues: 0 }; });
    matchesToAnalyze.forEach(match => {
      if (match.valise_j1) {
        stats[match.joueur1].utilisees++; stats[match.joueur2].recues++;
        const diff = Math.abs(match.buts_j1 - match.buts_j2);
        const isEfficace = diff === 0 || (match.resultat === 'victoire_j1' && diff === 1);
        if (isEfficace) { stats[match.joueur1].efficaces++; stats[match.joueur2].efficacesRecues++; }
      }
      if (match.valise_j2) {
        stats[match.joueur2].utilisees++; stats[match.joueur1].recues++;
        const diff = Math.abs(match.buts_j1 - match.buts_j2);
        const isEfficace = diff === 0 || (match.resultat === 'victoire_j2' && diff === 1);
        if (isEfficace) { stats[match.joueur2].efficaces++; stats[match.joueur1].efficacesRecues++; }
      }
    });
    return stats;
  }, [filteredData, selectedLigue, selectedChampionnat, joueurs]);

  return { statsDetaillees, cleanSheetsStats, heureDeGloire, valiseStats };
};
