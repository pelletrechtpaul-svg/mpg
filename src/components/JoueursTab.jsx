import { useState, useRef, useEffect } from 'react';
import { useJoueursSearch } from '../hooks/useJoueursSearch';

function usePlayerPhotos() {
  const [photos, setPhotos] = useState({});
  useEffect(() => {
    let cancelled = false;
    fetch('/players-photos.json')
      .then(r => r.ok ? r.json() : {})
      .then(data => { if (!cancelled) setPhotos(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return photos;
}

const COACH_COLORS = {
  Paul:   { bg: 'bg-blue-600',   text: 'text-blue-600 dark:text-blue-400',   dot: 'bg-blue-600',   ring: 'ring-blue-400' },
  Adrien: { bg: 'bg-green-600',  text: 'text-green-600 dark:text-green-400', dot: 'bg-green-600',  ring: 'ring-green-400' },
  Tiago:  { bg: 'bg-purple-600', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-600', ring: 'ring-purple-400' },
  Roman:  { bg: 'bg-orange-600', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-600', ring: 'ring-orange-400' },
};

const LIGUE_SHORT = {
  'Ligue 1': 'L1', 'Liga': 'Liga', 'Premier League': 'PL', 'Serie A': 'SA',
  'Champions League': 'UCL', 'Ligue des Champions': 'LDC',
};

const POSTE_COLORS = {
  G:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  DC: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  DL: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  DG: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  DD: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  D:  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  MD: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  MC: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  MO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  M:  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  A:  'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

function PosteBadge({ poste }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${POSTE_COLORS[poste] || 'bg-slate-100 text-slate-700'}`}>
      {poste}
    </span>
  );
}

function InitialsAvatar({ displayName, size = 'lg' }) {
  const words = displayName.trim().split(' ');
  const initials = words.length >= 2
    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
    : displayName.slice(0, 2).toUpperCase();
  const sizeClass = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  return (
    <div className={`${sizeClass} rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-bold text-slate-600 dark:text-slate-200 flex-shrink-0`}>
      {initials}
    </div>
  );
}

function PlayerAvatar({ joueur, ligue, displayName, photos, size = 'lg' }) {
  const [failed, setFailed] = useState(false);
  const photoUrl = photos[`${joueur}|${ligue}`];
  if (!photoUrl || failed) return <InitialsAvatar displayName={displayName} size={size} />;
  const sizeClass = size === 'lg' ? 'w-16 h-16' : size === 'md' ? 'w-10 h-10' : 'w-8 h-8';
  return (
    <img
      src={photoUrl}
      alt={displayName}
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover flex-shrink-0 bg-slate-200 dark:bg-slate-600`}
    />
  );
}

function ChipFilter({ label, active, onClick, color, dot }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
        active
          ? `${color || 'bg-slate-700'} text-white border-transparent shadow-sm`
          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-400'
      }`}
    >
      {dot && <span className={`w-2 h-2 rounded-full ${active ? 'bg-white/80' : dot}`}></span>}
      {label}
    </button>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide w-12 flex-shrink-0">{label}</span>
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function PlayerCard({ player, onClose, photos }) {
  const { entries, displayName, poste, nationalite, joueur, ligue } = player;

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
  const prixMax = player.prixMax;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-start gap-4">
          <PlayerAvatar joueur={joueur} ligue={ligue} displayName={displayName} photos={photos} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{displayName}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {poste && <PosteBadge poste={poste} />}
                  {nationalite && <span className="text-xs text-slate-500 dark:text-slate-400">{nationalite}</span>}
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none flex-shrink-0 p-1">✕</button>
            </div>
            <div className="flex gap-4 mt-3 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
              <span><span className="font-semibold text-slate-800 dark:text-slate-200">{entries.length}</span> achat{entries.length > 1 ? 's' : ''}</span>
              <span><span className="font-semibold text-slate-800 dark:text-slate-200">{totalSpent}M</span> total misé</span>
              <span>max <span className="font-semibold text-slate-800 dark:text-slate-200">{prixMax}M</span></span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Historique des transferts</h3>
        <div className="space-y-4">
          {champList.map(({ saison, ligue, championnat, tours }) => (
            <div key={`${saison}|${ligue}|${championnat}`} className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-600">
              <div className="flex items-center gap-2 mb-2">
                <span className="absolute -left-[9px] w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-500 border-2 border-white dark:border-slate-800"></span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {LIGUE_SHORT[ligue] || ligue} · Champ. {championnat} · {saison}
                </span>
              </div>
              <div className="space-y-2 ml-1">
                {tours.map((e, i) => {
                  const colors = COACH_COLORS[e.acheteur] || { bg: 'bg-slate-500', text: 'text-slate-600', dot: 'bg-slate-500' };
                  return (
                    <div key={i} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`}></span>
                          <span className={`text-sm font-semibold ${colors.text}`}>{e.acheteur}</span>
                          {e.equipe_acheteur && <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{e.equipe_acheteur}</span>}
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{e.prix}M</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mb-1">
                        <span>Tour {e.tour}</span>
                        {e.club && <><span>·</span><span>{e.club}</span></>}
                      </div>
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

const LIGUE_SHORT_LABEL = { 'Ligue 1': 'L1', 'Liga': 'Liga', 'Premier League': 'PL', 'Serie A': 'SA', 'Champions League': 'UCL', 'Ligue des Champions': 'LDC' };

function ResultRow({ s, onClick, photos }) {
  const coachColor = COACH_COLORS[s.acheteurPrincipal];
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <PlayerAvatar joueur={s.joueur} ligue={s.ligue} displayName={s.displayName} photos={photos} size="md" />
        <div className="min-w-0">
          <div className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">{s.displayName}</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            <span>{LIGUE_SHORT_LABEL[s.ligue] || s.ligue}</span>
            {s.nbAchats > 1 && <><span>·</span><span>{s.nbAchats} achats</span></>}
            {s.acheteurPrincipal && coachColor && (<><span>·</span><span className={coachColor.text}>{s.acheteurPrincipal}</span></>)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{s.prixMax}M</span>
        {s.poste && <PosteBadge poste={s.poste} />}
      </div>
    </button>
  );
}

const NO_DATA_JOKES = [
  "Aucune trace de mercato ici. Nos archivistes ont dû le perdre entre deux bières.",
  "Le mercato de cette saison a existé, promis. On l'a juste égaré quelque part entre deux championnats.",
  "Cette saison est mercato-vierge. Comme la cave à trophées de certains coachs.",
  "Rien à afficher ici — cette saison remonte à avant l'ère de la base de données. On appelle ça l'âge de pierre du MPG.",
  "Motus et bouche cousue sur le mercato de cette saison. Les archives ont brûlé (façon de parler).",
];

export default function JoueursTab({ mercatoData }) {
  const [joke] = useState(() => NO_DATA_JOKES[Math.floor(Math.random() * NO_DATA_JOKES.length)]);
  const photos = usePlayerPhotos();
  const [query, setQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [postes, setPostes] = useState([]);
  const [acheteurs, setAcheteurs] = useState([]);
  const [ligues, setLigues] = useState([]);
  const inputRef = useRef(null);

  const { getSuggestions, getPlayerHistory, allPostes, allAcheteurs, allLigues } = useJoueursSearch(mercatoData);

  const results = getSuggestions(query, { postes, acheteurs, ligues });
  const hasFilters = postes.length || acheteurs.length || ligues.length;
  const isSearching = query.length >= 2 || hasFilters;

  // Complétion prédictive (ghost text)
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let ghost = '';
  if (query.length >= 2) {
    const nq = norm(query);
    const match = results.find(r => norm(r.displayName).startsWith(nq) && norm(r.displayName) !== nq);
    if (match) ghost = match.displayName.slice(query.length);
  }

  function handleKeyDown(e) {
    if (ghost && (e.key === 'Tab' || (e.key === 'ArrowRight' && inputRef.current?.selectionStart === query.length))) {
      e.preventDefault();
      setQuery(query + ghost);
    } else if (e.key === 'Enter' && results.length) {
      e.preventDefault();
      selectPlayer(results[0]);
    }
  }

  function toggle(setter, value) {
    setSelectedPlayer(null);
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }

  function selectPlayer(s) {
    setSelectedPlayer(getPlayerHistory(s.key));
  }

  function clearAll() {
    setSelectedPlayer(null);
    setQuery('');
    setPostes([]); setAcheteurs([]); setLigues([]);
    inputRef.current?.focus();
  }

  if (mercatoData.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 dark:text-slate-500">
        <div className="text-5xl mb-3">🕵️‍♂️</div>
        <p className="text-base max-w-sm mx-auto">{joke}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative rounded-xl bg-white dark:bg-slate-800 shadow-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg z-10">🔍</span>
        {/* Ghost text de complétion */}
        {ghost && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center pl-10 pr-10 text-base whitespace-pre overflow-hidden">
            <span className="invisible">{query}</span>
            <span className="text-slate-400 dark:text-slate-500">{ghost}</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedPlayer(null); }}
          onKeyDown={handleKeyDown}
          placeholder="Nom, club, nationalité, coach…"
          className="relative w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base shadow-sm"
        />
        {query && (
          <button onClick={() => { setQuery(''); setSelectedPlayer(null); inputRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
        )}
      </div>

      {/* Filtres chips groupés */}
      <div className="space-y-2 bg-slate-50/60 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
        <FilterGroup label="Coach">
          {allAcheteurs.map(a => (
            <ChipFilter key={a} label={a} active={acheteurs.includes(a)} onClick={() => toggle(setAcheteurs, a)} color={COACH_COLORS[a]?.bg} dot={COACH_COLORS[a]?.dot} />
          ))}
        </FilterGroup>
        <FilterGroup label="Poste">
          {allPostes.map(p => (
            <ChipFilter key={p} label={p} active={postes.includes(p)} onClick={() => toggle(setPostes, p)} color="bg-slate-700" />
          ))}
        </FilterGroup>
        <FilterGroup label="Ligue">
          {allLigues.map(l => (
            <ChipFilter key={l} label={LIGUE_SHORT_LABEL[l] || l} active={ligues.includes(l)} onClick={() => toggle(setLigues, l)} color="bg-indigo-700" />
          ))}
        </FilterGroup>
      </div>

      {/* Player card */}
      {selectedPlayer && <PlayerCard player={selectedPlayer} onClose={() => setSelectedPlayer(null)} photos={photos} />}

      {/* Liste de résultats (inline) */}
      {!selectedPlayer && isSearching && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {results.length} joueur{results.length > 1 ? 's' : ''}
            </span>
            {(hasFilters || query) && (
              <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 font-medium">Tout effacer</button>
            )}
          </div>
          {results.length > 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[60vh] overflow-y-auto">
              {results.slice(0, 60).map(s => (
                <ResultRow key={s.key} s={s} onClick={() => selectPlayer(s)} photos={photos} />
              ))}
              {results.length > 60 && (
                <div className="px-4 py-2 text-xs text-center text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700">
                  Affine les filtres pour voir les {results.length - 60} autres
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-6 text-sm text-center text-slate-400 dark:text-slate-500">
              Aucun joueur trouvé
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!selectedPlayer && !isSearching && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <div className="text-5xl mb-3">⚽</div>
          <p className="text-base">Recherche un joueur ou filtre par coach, poste, ligue</p>
        </div>
      )}
    </div>
  );
}
