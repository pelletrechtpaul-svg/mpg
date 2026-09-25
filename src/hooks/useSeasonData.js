import { useMemo } from 'react';

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
    const result = [...unique];
    return result.length > 0 ? result : ['Ligue 1', 'Premier League', 'Liga', 'Serie A', 'Ligue des Champions'];
  }, [matchData]);

  const championnatsByLigue = useMemo(() => {
    const map = {};
    ligues.forEach(ligue => {
      const championnats = new Set(filteredData.filter(d => d.ligue === ligue).map(d => d.championnat));
      // Tri numérique sur "#N" (pas un tri lexical : "#10" < "#2" en lexical)
      map[ligue] = [...championnats].sort((a, b) => (parseInt(String(a).replace('#', ''), 10) || 0) - (parseInt(String(b).replace('#', ''), 10) || 0));
    });
    return map;
  }, [filteredData, ligues]);

  return { filteredData, joueurs, ligues, championnatsByLigue };
};
