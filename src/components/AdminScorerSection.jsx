import { useState, useMemo, useRef } from 'react';

function normalize(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Le championnat des matchs est stocké "#1", celui du mercato est un nombre (1).
function champNum(championnat) {
  const n = parseInt(String(championnat).replace('#', ''), 10);
  return isNaN(n) ? null : n;
}

/**
 * Barre de recherche restreinte aux joueurs recrutés par `coach` lors du
 * mercato de ce championnat précis (saison + ligue + championnat + acheteur).
 */
export default function CoachPlayerSearch({ coach, saison, ligue, championnat, mercatoData, onSelect, placeholder }) {
  const [search, setSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const inputRef = useRef(null);

  const cNum = champNum(championnat);

  const pool = useMemo(() => {
    if (!coach || !saison || !ligue || cNum == null) return [];
    const seen = new Set();
    return mercatoData
      .filter(p => p.saison === saison && p.ligue === ligue && p.championnat === cNum && p.acheteur === coach)
      .filter(p => { if (seen.has(p.joueur)) return false; seen.add(p.joueur); return true; })
      .map(p => ({
        joueur: p.joueur,
        displayName: p.prenom && !p.joueur.startsWith(p.prenom) ? `${p.prenom} ${p.joueur}` : p.joueur,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [coach, saison, ligue, cNum, mercatoData]);

  const filtered = useMemo(() => {
    if (!search) return [];
    const q = normalize(search);
    return pool.filter(p => normalize(p.displayName).includes(q)).slice(0, 10);
  }, [search, pool]);

  if (pool.length === 0) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500 italic">
        Aucun joueur recruté par {coach} sur ce championnat.
      </p>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
        onFocus={() => setShowDrop(true)}
        onBlur={() => setTimeout(() => setShowDrop(false), 150)}
        placeholder={placeholder}
        className="w-full text-sm px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-400"
      />
      {showDrop && filtered.length > 0 && (
        <div className="absolute z-20 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg mt-1 overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map((p, i) => (
            <button key={i} type="button" onMouseDown={() => { onSelect(p); setSearch(''); setShowDrop(false); inputRef.current?.focus(); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-100">
              {p.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
