import { useState, useMemo, useRef } from 'react';

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function ScorerSection({ matchKey, joueur1, joueur2, saison, ligue, buteurs, setButeurs, mercatoData }) {
  const [search, setSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const inputRef = useRef(null);

  // Tous les joueurs de la ligue/saison (pas seulement ceux des 2 coachs)
  const allPlayers = useMemo(() => {
    if (!saison || !ligue) return [];
    const seen = new Set();
    return mercatoData
      .filter(p => p.saison === saison && p.ligue === ligue)
      .filter(p => { if (seen.has(p.joueur)) return false; seen.add(p.joueur); return true; })
      .map(p => ({
        joueur: p.joueur,
        displayName: p.prenom && !p.joueur.startsWith(p.prenom) ? `${p.prenom} ${p.joueur}` : p.joueur,
        acheteur: p.acheteur,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [saison, ligue, mercatoData]);

  const filtered = useMemo(() => {
    if (!search) return [];
    const q = normalize(search);
    return allPlayers.filter(p => normalize(p.displayName).includes(q)).slice(0, 10);
  }, [search, allPlayers]);

  const current = buteurs[matchKey] || [];

  const addScorer = (player) => {
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
    setShowDrop(false);
    inputRef.current?.focus();
  };

  const removeScorer = (i) => setButeurs(prev => ({ ...prev, [matchKey]: prev[matchKey].filter((_, idx) => idx !== i) }));
  const updateButs = (i, val) => setButeurs(prev => ({ ...prev, [matchKey]: prev[matchKey].map((s, idx) => idx === i ? { ...s, buts: Math.max(1, parseInt(val) || 1) } : s) }));
  const toggleCsc = (i) => setButeurs(prev => ({ ...prev, [matchKey]: prev[matchKey].map((s, idx) => idx === i ? { ...s, csc: !s.csc } : s) }));

  if (allPlayers.length === 0) return null;

  // Grouper les buteurs par coach
  const scorersJ1 = current.map((s, i) => ({ ...s, idx: i })).filter(s => s.acheteur === joueur1);
  const scorersJ2 = current.map((s, i) => ({ ...s, idx: i })).filter(s => s.acheteur === joueur2);
  const scorersOther = current.map((s, i) => ({ ...s, idx: i })).filter(s => s.acheteur !== joueur1 && s.acheteur !== joueur2);

  const ScorerLine = ({ s }) => (
    <div className="flex items-center gap-2 py-1">
      <span className="text-sm text-slate-800 dark:text-slate-200 flex-1 min-w-0 truncate">{s.displayName}</span>
      <input type="number" value={s.buts} min="1" max="10" onChange={e => updateButs(s.idx, e.target.value)}
        className="w-8 text-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-xs font-bold py-0.5" />
      <label className="flex items-center gap-0.5 cursor-pointer select-none">
        <input type="checkbox" checked={s.csc} onChange={() => toggleCsc(s.idx)} className="w-3 h-3 accent-orange-500" />
        <span className={`text-[10px] font-bold ${s.csc ? 'text-orange-600 dark:text-orange-400' : 'text-slate-300 dark:text-slate-500'}`}>CSC</span>
      </label>
      <button type="button" onClick={() => removeScorer(s.idx)} className="text-slate-300 hover:text-red-500 leading-none text-sm">×</button>
    </div>
  );

  const CoachGroup = ({ label, scorers, color }) => {
    if (scorers.length === 0) return null;
    return (
      <div className="mb-2">
        <div className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${color}`}>{label}</div>
        {scorers.map(s => <ScorerLine key={s.idx} s={s} />)}
      </div>
    );
  };

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Buteurs</p>

      {current.length > 0 && (
        <div className="bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 mb-2">
          <CoachGroup label={joueur1} scorers={scorersJ1} color="text-blue-600 dark:text-blue-400" />
          <CoachGroup label={joueur2} scorers={scorersJ2} color="text-emerald-600 dark:text-emerald-400" />
          <CoachGroup label="Autre" scorers={scorersOther} color="text-slate-500 dark:text-slate-400" />
        </div>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
          onFocus={() => setShowDrop(true)}
          onBlur={() => setTimeout(() => setShowDrop(false), 150)}
          placeholder="Ajouter un buteur…"
          className="w-full text-sm px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-400"
        />
        {showDrop && filtered.length > 0 && (
          <div className="absolute z-20 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg mt-1 overflow-hidden max-h-48 overflow-y-auto">
            {filtered.map((p, i) => (
              <button key={i} type="button" onMouseDown={() => addScorer(p)}
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
