import { useMemo } from 'react';
import { MANUAL_CHAMPIONSHIPS } from '../shared.jsx';

export const useSeasonData = (matchData, selectedSeason) => {
  const filteredData = useMemo(() => {
    if (selectedSeason === 'All-Time') return matchData;
    return matchData.filter(d => d.saison === selectedSeason);
  }, [matchData, selectedSeason]);

  const joueurs = useMemo(() => {
    const unique = new Set();
    filteredData.forEach(m => { unique.add(m.joueur1); unique.add(m.joueur2); });
    return unique.size > 0 ? Array.from(unique) : ['Paul', 'Adrien', 'Tiago', 'Roman'];
  }, [filteredData]);

  const ligues = useMemo(() => {
    const unique = new Set(matchData.map(d => d.ligue));
    MANUAL_CHAMPIONSHIPS.forEach(mc => unique.add(mc.ligue));
    const result = [...unique];
    return result.length > 0 ? result : ['Ligue 1', 'Premier League', 'Liga', 'Serie A', 'Ligue des Champions'];
  }, [matchData]);

  const championnatsByLigue = useMemo(() => {
    const map = {};
    const filteredSeasons = new Set(filteredData.map(m => m.saison));
    ligues.forEach(ligue => {
      const championnats = new Set(filteredData.filter(d => d.ligue === ligue).map(d => d.championnat));
      MANUAL_CHAMPIONSHIPS.forEach(mc => {
        if (mc.ligue === ligue && (selectedSeason === 'All-Time' || filteredSeasons.has(mc.saison))) {
          championnats.add(mc.championnat);
        }
      });
      map[ligue] = [...championnats].sort();
    });
    return map;
  }, [filteredData, ligues, selectedSeason]);

  return { filteredData, joueurs, ligues, championnatsByLigue };
};
