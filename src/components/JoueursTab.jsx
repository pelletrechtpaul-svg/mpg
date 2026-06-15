import { useState, useRef, useEffect } from 'react';
import { useJoueursSearch } from '../hooks/useJoueursSearch';
import { POSTE_LABEL } from '../shared';

const COACH_COLORS = {
  Paul:   { bg: 'bg-blue-600',   text: 'text-blue-600 dark:text-blue-400',   dot: 'bg-blue-600' },
  Adrien: { bg: 'bg-green-600',  text: 'text-green-600 dark:text-green-400', dot: 'bg-green-600' },
  Tiago:  { bg: 'bg-purple-600', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-600' },
  Roman:  { bg: 'bg-orange-600', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-600' },
};

const LIGUE_SHORT = {
  'Ligue 1': 'L1', 'Liga': 'Liga', 'Premier League': 'PL', 'Serie A': 'SA', 'Champions League': 'UCL',
};

function InitialsAvatar({ displayName, size = 'lg' }) {
  const words = displayName.trim().split(' ');
  const initials = words.length >= 2
    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
    : displayName.slice(0, 2).toUpperCase();
  const sizeClass = size === 'lg' ? 'w-16 h-16 text-xl' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sizeClass} rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-bold text-slate-600 dark:text-slate-200 flex-shrink-0`}>
      {initials}
    </div>
  );
}

function PlayerPhoto({ player, size = 'lg' }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const searchName = encodeURIComponent(player.displayName);
    fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${searchName}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        const p = data?.player?.[0];
        const url = p?.strThumb || p?.strCutout || null;
        if (url) setPhotoUrl(url);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [player.displayName]);

  if (!photoUrl || failed) return <InitialsAvatar displayName={player.displayName} size={size} />;

  const sizeClass = size === 'lg' ? 'w-16 h-16' : 'w-10 h-10';
  return (
    <img
      src={photoUrl}
      alt={player.displayName}
      className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      onError={() => setFailed(true)}
    />
  );
}

function PosteBadge({ poste }) {
  const colors = {
    G: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    DC: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    DL: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    MD: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    MO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    A: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[poste] || 'bg-slate-100 text-slate-700'}`}>
      {poste}
    </span>
  );
}

function PlayerCard({ player, onClose }) {
  const { entries, displayName, poste, nationalite } = player;

  // Group entries by saison + championnat
  const byChamp = {};
  entries.forEach(e => {
    const k = `${e.saison}|${e.ligue}|${e.championnat}`;
    if (!byChamp[k]) byChamp[k] = { saison: e.saison, ligue: e.ligue, championnat: e.championnat, tours: [] };
    byChamp[k].tours.push(e);
  });
  const champList = Object.values(byChamp).sort((a, b) => {
    if (a.saison !== b.saison) return a.saison.localeCompare(b.saison);
    return a.championnat - b.championnat;
  });

  const totalSpent = entries.reduce((s, e) => s + (e.prix || 0), 0);
  const timesAcquired = entries.length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-start gap-4">
          <PlayerPhoto player={player} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{displayName}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {poste && <PosteBadge poste={poste} />}
                  {nationalite && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">{nationalite}</span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none flex-shrink-0 p-1"
              >✕</button>
            </div>
            <div className="flex gap-4 mt-3 text-sm text-slate-500 dark:text-slate-400">
              <span><span className="font-semibold text-slate-800 dark:text-slate-200">{timesAcquired}</span> achat{timesAcquired > 1 ? 's' : ''}</span>
              <span><span className="font-semibold text-slate-800 dark:text-slate-200">{totalSpent}M</span> total misé</span>
            </div>
          </div>
        </div>
      </div>

      {/* Historique */}
      <div className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Historique des transferts</h3>
        <div className="space-y-4">
          {champList.map(({ saison, ligue, championnat, tours }) => (
            <div key={`${saison}|${ligue}|${championnat}`} className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-600">
              {/* Championnat header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="absolute -left-[9px] w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-500 border-2 border-white dark:border-slate-800"></span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {LIGUE_SHORT[ligue] || ligue} · Champ. {championnat} · {saison}
                </span>
              </div>

              {/* Tours */}
              <div className="space-y-2 ml-1">
                {tours.map((e, i) => {
                  const colors = COACH_COLORS[e.acheteur] || { bg: 'bg-slate-500', text: 'text-slate-600', dot: 'bg-slate-500' };
                  return (
                    <div key={i} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                      {/* Acheteur + prix */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`}></span>
                          <span className={`text-sm font-semibold ${colors.text}`}>{e.acheteur}</span>
                          {e.equipe_acheteur && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{e.equipe_acheteur}</span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{e.prix}M</span>
                      </div>
                      {/* Tour + club */}
                      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mb-1">
                        <span>Tour {e.tour}</span>
                        {e.club && <><span>·</span><span>{e.club}</span></>}
                      </div>
                      {/* Enchères perdues */}
                      {e.encheres_perdues?.length > 0 && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-600">
                          <div className="text-xs text-slate-400 dark:text-slate-500 mb-1">Enchères perdues :</div>
                          <div className="flex flex-wrap gap-1.5">
                            {e.encheres_perdues.map((ep, j) => {
                              const epColors = COACH_COLORS[ep.equipe] || { dot: 'bg-slate-400', text: 'text-slate-500' };
                              return (
                                <span key={j} className="inline-flex items-center gap-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${epColors.dot}`}></span>
                                  <span className="text-slate-600 dark:text-slate-300">{ep.equipe}</span>
                                  <span className="text-slate-400">{ep.prix}M</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function JoueursTab({ mercatoData }) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const inputRef = useRef(null);
  const { getSuggestions, getPlayerHistory } = useJoueursSearch(mercatoData);

  const suggestions = getSuggestions(query);

  function selectPlayer(suggestion) {
    const player = getPlayerHistory(suggestion.key);
    setSelectedPlayer(player);
    setQuery(suggestion.displayName);
    setShowSuggestions(false);
  }

  function handleClear() {
    setSelectedPlayer(null);
    setQuery('');
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowSuggestions(true); setSelectedPlayer(null); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Rechercher un joueur…"
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base shadow-sm"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >✕</button>
          )}
        </div>

        {/* Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {suggestions.map(s => (
              <button
                key={s.key}
                onMouseDown={() => selectPlayer(s)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <InitialsAvatar displayName={s.displayName} size="sm" />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">{s.displayName}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">{s.ligue}</div>
                  </div>
                </div>
                {s.poste && <PosteBadge poste={s.poste} />}
              </button>
            ))}
          </div>
        )}

        {showSuggestions && query.length >= 2 && suggestions.length === 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-400 dark:text-slate-500">
            Aucun joueur trouvé
          </div>
        )}
      </div>

      {/* Player card */}
      {selectedPlayer && (
        <PlayerCard player={selectedPlayer} onClose={handleClear} />
      )}

      {/* Empty state */}
      {!selectedPlayer && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <div className="text-5xl mb-3">⚽</div>
          <p className="text-base">Recherche un joueur pour voir son historique</p>
        </div>
      )}
    </div>
  );
}
