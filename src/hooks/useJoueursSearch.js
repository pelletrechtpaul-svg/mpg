import { useMemo } from 'react';

/**
 * Builds a searchable index of players from mercatoData.
 * Returns:
 *   - suggestions(query): list of { key, displayName, joueur, ligue } for autocomplete
 *   - getPlayerHistory(key): full transfer history for a player
 */
export function useJoueursSearch(mercatoData) {
  // Deduplicated player index keyed by "joueur|||ligue"
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
        };
      }
      // Keep most recent prenom if missing
      if (!index[key].prenom && d.prenom) index[key].prenom = d.prenom;
      index[key].entries.push(d);
    });
    // Sort each player's entries chronologically
    Object.values(index).forEach(p => {
      p.entries.sort((a, b) => {
        if (a.saison !== b.saison) return a.saison.localeCompare(b.saison);
        if (a.championnat !== b.championnat) return a.championnat - b.championnat;
        return a.tour - b.tour;
      });
    });
    return index;
  }, [mercatoData]);

  // Sorted list for autocomplete
  const allPlayers = useMemo(() =>
    Object.values(playerIndex).sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    ),
    [playerIndex]
  );

  function getSuggestions(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return allPlayers.filter(p => {
      const name = p.displayName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return name.includes(q);
    }).slice(0, 8);
  }

  function getPlayerHistory(key) {
    return playerIndex[key] || null;
  }

  return { getSuggestions, getPlayerHistory, allPlayers };
}
