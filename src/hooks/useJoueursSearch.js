import { useMemo } from 'react';

export function useJoueursSearch(mercatoData) {
  const playerIndex = useMemo(() => {
    if (!mercatoData?.length) return {};
    const index = {};
    mercatoData.forEach(d => {
      if (!d.joueur) return;
      const key = d.joueur + '|||' + d.ligue;
      if (!index[key]) {
        index[key] = {
          key,
          joueur: d.joueur,
          ligue: d.ligue,
          prenom: d.prenom || null,
          poste: d.poste,
          nationalite: d.nationalite,
          displayName: d.prenom && !d.joueur.startsWith(d.prenom)
            ? `${d.prenom} ${d.joueur}`
            : d.joueur,
          entries: [],
          acheteurs: new Set(),
        };
      }
      if (!index[key].prenom && d.prenom) index[key].prenom = d.prenom;
      index[key].entries.push(d);
      if (d.acheteur) index[key].acheteurs.add(d.acheteur);
    });
    Object.values(index).forEach(p => {
      p.entries.sort((a, b) => {
        if (a.saison !== b.saison) return a.saison.localeCompare(b.saison);
        if (a.championnat !== b.championnat) return a.championnat - b.championnat;
        return a.tour - b.tour;
      });
      p.prixMax = Math.max(...p.entries.map(e => e.prix || 0));
      p.nbAchats = p.entries.length;
      // Acheteur le plus fréquent
      const freq = {};
      p.entries.forEach(e => { if (e.acheteur) freq[e.acheteur] = (freq[e.acheteur] || 0) + 1; });
      p.acheteurPrincipal = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    });
    return index;
  }, [mercatoData]);

  const allPlayers = useMemo(() =>
    Object.values(playerIndex).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [playerIndex]
  );

  function normalize(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function getSuggestions(query) {
    if (!query || query.length < 2) return [];
    const q = normalize(query);
    return allPlayers.filter(p => normalize(p.displayName).includes(q));
  }

  function getPlayerHistory(key) {
    return playerIndex[key] || null;
  }

  return { getSuggestions, getPlayerHistory, allPlayers };
}
