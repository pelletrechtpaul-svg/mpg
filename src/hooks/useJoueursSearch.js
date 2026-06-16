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
          clubs: new Set(),
          acheteurs: new Set(),
        };
      }
      if (!index[key].prenom && d.prenom) index[key].prenom = d.prenom;
      index[key].entries.push(d);
      if (d.club) index[key].clubs.add(d.club.toLowerCase());
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

  function getSuggestions(query, filters = {}) {
    const { postes = [], acheteurs = [], ligues = [] } = filters;
    const q = normalize(query);
    return allPlayers.filter(p => {
      // Filtres multi-sélection (OR dans un groupe, AND entre groupes)
      if (postes.length && !postes.includes(p.poste)) return false;
      if (ligues.length && !ligues.includes(p.ligue)) return false;
      if (acheteurs.length && ![...p.acheteurs].some(a => acheteurs.includes(a))) return false;
      // Recherche texte multi-critères
      if (q.length >= 2) {
        const nameMatch = normalize(p.displayName).includes(q);
        const clubMatch = [...p.clubs].some(c => c.includes(q));
        const natMatch = normalize(p.nationalite).includes(q);
        const acheteurMatch = [...p.acheteurs].some(a => normalize(a).includes(q));
        if (!nameMatch && !clubMatch && !natMatch && !acheteurMatch) return false;
      }
      return true;
    });
  }

  function getPlayerHistory(key) {
    return playerIndex[key] || null;
  }

  // Listes pour chips
  const allPostes = useMemo(() => {
    const s = new Set(allPlayers.map(p => p.poste).filter(Boolean));
    const order = ['G', 'DC', 'DL', 'DG', 'DD', 'D', 'MD', 'MC', 'MO', 'M', 'A'];
    return order.filter(p => s.has(p));
  }, [allPlayers]);

  const allAcheteurs = useMemo(() => {
    const s = new Set();
    allPlayers.forEach(p => p.acheteurs.forEach(a => s.add(a)));
    return [...s].sort();
  }, [allPlayers]);

  const allLigues = useMemo(() => {
    return [...new Set(allPlayers.map(p => p.ligue).filter(Boolean))].sort();
  }, [allPlayers]);

  return { getSuggestions, getPlayerHistory, allPlayers, allPostes, allAcheteurs, allLigues };
}
