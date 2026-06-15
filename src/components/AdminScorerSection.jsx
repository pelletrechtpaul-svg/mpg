import { useState, useMemo, useRef } from 'react';

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function ScorerSection({ matchKey, joueur1, joueur2, saison, ligue, buteurs, setButeurs, mercatoData }) {
  const [search, setSearch] = useState('');
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
    if (!search) return [];
    const q = normalize(search);
    return allPlayers.filter(p => normalize(p.displayName).includes(q)).slice(0, 8);
  }, [search, allPlayers]);

  const current = buteurs[matchKey] || [];

  const addScorer = (player) => {
    if (current.find(s => s.joueur === player.joueur)) return;
    setButeurs(prev => ({ ...prev, [matchKey]: [...prev[matchKey], { joueur: player.joueur, displayName: player.displayName, buts: 1, acheteur: player.acheteur, csc: false }] }));
    setSearch('');
    inputRef.current?.focus();
  };

  const removeScorer = (i) => setButeurs(prev => ({ ...prev, [matchKey]: prev[matchKey].filter((_, idx) => idx !== i) }));
  const updateButs = (i, val) => setButeurs(prev => ({ ...prev, [matchKey]: prev[matchKey].map((s, idx) => idx === i ? { ...s, buts: Math.max(1, parseInt(val) || 1) } : s) }));
  const toggleCsc = (i) => setButeurs(prev => ({ ...prev, [matchKey]: prev[matchKey].map((s, idx) => idx === i ? { ...s, csc: !s.csc } : s) }));

  if (allPlayers.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Buteurs</p>
      {current.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {current.map((s, i) => (
            <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${s.csc ? 'bg-orange-100 text-orange-800' : s.acheteur === joueur1 ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {s.displayName}
              <span className="opacity-30 mx-0.5">·</span>
              <input type="number" value={s.buts} min="1" max="10" onChange={e => updateButs(i, e.target.value)}
                className="w-6 text-center bg-transparent border-none outline-none text-xs font-bold" />
              <button type="button" onClick={() => toggleCsc(i)}
                title="But contre son camp"
                className={`text-[10px] px-1 py-0.5 rounded font-bold transition-colors ${s.csc ? 'bg-orange-400 text-white' : 'text-slate-300 hover:text-orange-400'}`}>
                CSC
              </button>
              <button type="button" onClick={() => removeScorer(i)} className="opacity-50 hover:opacity-100 leading-none ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Ajouter un buteur..."
          className="w-full text-sm px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-400"
        />
        {filtered.length > 0 && (
          <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 overflow-hidden">
            {filtered.map((p, i) => (
              <button key={i} type="button" onClick={() => addScorer(p)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex justify-between items-center">
                <span>{p.displayName}</span>
                <span className="text-xs text-slate-400">{p.acheteur}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
