import { useState, useMemo, useRef } from 'react';

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function ScorerSection({ matchKey, joueur1, joueur2, saison, ligue, buteurs, setButeurs, mercatoData }) {
  const [search, setSearch] = useState('');
  const [coachFilter, setCoachFilter] = useState(null);
  const inputRef = useRef(null);

  const allPlayers = useMemo(() => {
    if (!joueur1 || !joueur2 || !saison || !ligue) return [];
    const seen = new Set();
    return mercatoData
      .filter(p => (p.acheteur === joueur1 || p.acheteur === joueur2) && p.saison === saison && p.ligue === ligue)
      .filter(p => { if (seen.has(p.joueur)) return false; seen.add(p.joueur); return true; })
      .map(p => ({
        joueur: p.joueur,
        displayName: p.prenom && !p.joueur.startsWith(p.prenom) ? `${p.prenom} ${p.joueur}` : p.joueur,
        acheteur: p.acheteur,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [joueur1, joueur2, saison, ligue, mercatoData]);

  const filtered = useMemo(() => {
    let list = allPlayers;
    if (coachFilter) list = list.filter(p => p.acheteur === coachFilter);
    if (search) {
      const q = normalize(search);
      list = list.filter(p => normalize(p.displayName).includes(q));
    }
    return list.slice(0, 10);
  }, [search, coachFilter, allPlayers]);

  const current = buteurs[matchKey] || [];

  const addScorer = (player) => {
    if (current.find(s => s.joueur === player.joueur && !s.csc)) return;
    setButeurs(prev => ({
      ...prev,
      [matchKey]: [...prev[matchKey], {
        joueur: player.joueur,
        displayName: player.displayName,
        buts: 1,
        acheteur: player.acheteur,
        csc: false,
      }],
    }));
    setSearch('');
    inputRef.current?.focus();
  };

  const removeScorer = (i) => setButeurs(prev => ({ ...prev, [matchKey]: prev[matchKey].filter((_, idx) => idx !== i) }));
  const updateButs = (i, val) => setButeurs(prev => ({ ...prev, [matchKey]: prev[matchKey].map((s, idx) => idx === i ? { ...s, buts: Math.max(1, parseInt(val) || 1) } : s) }));

  const toggleCsc = (i) => {
    setButeurs(prev => ({
      ...prev,
      [matchKey]: prev[matchKey].map((s, idx) => {
        if (idx !== i) return s;
        const newCsc = !s.csc;
        return {
          ...s,
          csc: newCsc,
          // CSC: le but est attribué à l'adversaire
          acheteurEffectif: newCsc
            ? (s.acheteur === joueur1 ? joueur2 : joueur1)
            : s.acheteur,
        };
      }),
    }));
  };

  if (allPlayers.length === 0) return null;

  const showDropdown = search.length > 0 || coachFilter;

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Buteurs</p>

      {/* Tags de buteurs ajoutés */}
      {current.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {current.map((s, i) => {
            const effectiveCoach = s.csc ? (s.acheteur === joueur1 ? joueur2 : joueur1) : s.acheteur;
            return (
              <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                s.csc ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                : effectiveCoach === joueur1 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
              }`}>
                {s.displayName}
                {s.csc && <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">(CSC)</span>}
                <span className="opacity-30 mx-0.5">·</span>
                <input type="number" value={s.buts} min="1" max="10" onChange={e => updateButs(i, e.target.value)}
                  className="w-6 text-center bg-transparent border-none outline-none text-xs font-bold" />
                <button type="button" onClick={() => toggleCsc(i)}
                  title={s.csc ? 'Annuler CSC' : 'But contre son camp'}
                  className={`text-[10px] px-1 py-0.5 rounded font-bold transition-colors ${s.csc ? 'bg-orange-500 text-white' : 'text-slate-300 hover:text-orange-400 hover:bg-orange-50'}`}>
                  CSC
                </button>
                <button type="button" onClick={() => removeScorer(i)} className="opacity-50 hover:opacity-100 leading-none ml-0.5">×</button>
              </span>
            );
          })}
        </div>
      )}

      {/* Filtre par coach */}
      <div className="flex gap-1.5 mb-2">
        <button type="button" onClick={() => setCoachFilter(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${!coachFilter ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
          Tous
        </button>
        {[joueur1, joueur2].map(j => (
          <button key={j} type="button" onClick={() => setCoachFilter(coachFilter === j ? null : j)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${coachFilter === j ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
            {j}
          </button>
        ))}
      </div>

      {/* Champ de recherche */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => { if (!coachFilter && !search) setCoachFilter(null); }}
          placeholder={coachFilter ? `Joueur de ${coachFilter}…` : 'Ajouter un buteur…'}
          className="w-full text-sm px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-400"
        />
        {showDropdown && filtered.length > 0 && (
          <div className="absolute z-20 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg mt-1 overflow-hidden max-h-48 overflow-y-auto">
            {filtered.map((p, i) => (
              <button key={i} type="button" onClick={() => addScorer(p)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex justify-between items-center">
                <span className="dark:text-slate-100">{p.displayName}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{p.acheteur}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
