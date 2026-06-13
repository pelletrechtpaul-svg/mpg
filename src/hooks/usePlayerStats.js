import { useMemo } from 'react';
import { calculatePlayerStats, groupMatchesByChampionship } from '../shared.jsx';

export const usePlayerStats = (filteredData, joueurs, selectedStatsLigue, selectedLigue, selectedChampionnat, ligueMetadata, selectedVersusPlayer1, selectedVersusPlayer2, selectedVersusLigue) => {
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

  const scoreDistribution = useMemo(() => {
    const matches = selectedStatsLigue === 'all' ? filteredData : filteredData.filter(d => d.ligue === selectedStatsLigue);
    const scoreCounts = {};
    matches.forEach(m => { const [hi, lo] = m.buts_j1 >= m.buts_j2 ? [m.buts_j1, m.buts_j2] : [m.buts_j2, m.buts_j1]; const key = `${hi}-${lo}`; scoreCounts[key] = (scoreCounts[key] || 0) + 1; });
    return Object.entries(scoreCounts).map(([score, count]) => ({ score, count })).sort((a, b) => b.count - a.count).slice(0, 15);
  }, [selectedStatsLigue, filteredData]);

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

  const versusStats = useMemo(() => {
    let matches = filteredData.filter(m => (m.joueur1 === selectedVersusPlayer1 && m.joueur2 === selectedVersusPlayer2) || (m.joueur1 === selectedVersusPlayer2 && m.joueur2 === selectedVersusPlayer1));
    if (selectedVersusLigue !== 'all') matches = matches.filter(m => m.ligue === selectedVersusLigue);
    const stats = { matchs: matches.length, victoires_j1: 0, victoires_j2: 0, nuls: 0, buts_j1: 0, buts_j2: 0, points_j1: 0, points_j2: 0 };
    matches.forEach(match => {
      if (match.joueur1 === selectedVersusPlayer1) {
        stats.buts_j1 += match.buts_j1; stats.buts_j2 += match.buts_j2; stats.points_j1 += match.points_j1; stats.points_j2 += match.points_j2;
        if (match.buts_j1 > match.buts_j2) stats.victoires_j1++; else if (match.buts_j1 === match.buts_j2) stats.nuls++; else stats.victoires_j2++;
      } else {
        stats.buts_j1 += match.buts_j2; stats.buts_j2 += match.buts_j1; stats.points_j1 += match.points_j2; stats.points_j2 += match.points_j1;
        if (match.buts_j2 > match.buts_j1) stats.victoires_j1++; else if (match.buts_j1 === match.buts_j2) stats.nuls++; else stats.victoires_j2++;
      }
    });
    stats.ga_j1 = stats.buts_j1 - stats.buts_j2; stats.ga_j2 = stats.buts_j2 - stats.buts_j1;
    stats.valises_j1 = 0; stats.valises_j1_efficaces = 0; stats.valises_j2 = 0; stats.valises_j2_efficaces = 0;
    matches.forEach(match => {
      const j1IsP1 = match.joueur1 === selectedVersusPlayer1;
      const valP1 = j1IsP1 ? match.valise_j1 : match.valise_j2;
      const valP2 = j1IsP1 ? match.valise_j2 : match.valise_j1;
      const diff = Math.abs(match.buts_j1 - match.buts_j2);
      if (valP1) { stats.valises_j1++; const won = j1IsP1 ? match.resultat === 'victoire_j1' : match.resultat === 'victoire_j2'; if (diff === 0 || (won && diff === 1)) stats.valises_j1_efficaces++; }
      if (valP2) { stats.valises_j2++; const won = j1IsP1 ? match.resultat === 'victoire_j2' : match.resultat === 'victoire_j1'; if (diff === 0 || (won && diff === 1)) stats.valises_j2_efficaces++; }
    });
    return stats;
  }, [filteredData, selectedVersusPlayer1, selectedVersusPlayer2, selectedVersusLigue]);

  const versusMatchHistory = useMemo(() => {
    let matches = filteredData.filter(m => (m.joueur1 === selectedVersusPlayer1 && m.joueur2 === selectedVersusPlayer2) || (m.joueur1 === selectedVersusPlayer2 && m.joueur2 === selectedVersusPlayer1));
    if (selectedVersusLigue !== 'all') matches = matches.filter(m => m.ligue === selectedVersusLigue);
    return [...matches].sort((a, b) => new Date(a.dateMatch) - new Date(b.dateMatch)).map(m => {
      const j1IsPlayer1 = m.joueur1 === selectedVersusPlayer1;
      const butsJ1 = j1IsPlayer1 ? m.buts_j1 : m.buts_j2;
      const butsJ2 = j1IsPlayer1 ? m.buts_j2 : m.buts_j1;
      return { result: butsJ1 > butsJ2 ? 'W' : butsJ1 < butsJ2 ? 'L' : 'D', butsJ1, butsJ2, date: new Date(m.dateMatch).toLocaleDateString('fr-FR'), ligue: m.ligue, championnat: m.championnat, saison: m.saison };
    });
  }, [filteredData, selectedVersusPlayer1, selectedVersusPlayer2, selectedVersusLigue]);

  return { statsDetaillees, cleanSheetsStats, scoreDistribution, heureDeGloire, valiseStats, versusStats, versusMatchHistory };
};
