import { useState, useRef, useEffect } from 'react';
import { useJoueursSearch } from '../hooks/useJoueursSearch';
import { ShareBtn, playerColors, playerColorText } from '../shared.jsx';
import { usePlayerPhotos, PlayerAvatar } from './PlayerAvatar.jsx';

// html2canvas (utilisé pour le partage) ne respecte pas text-overflow:
// ellipsis / overflow:hidden — il peint le texte complet non tronqué, ce qui
// provoque des chevauchements dans la capture. On tronque donc la chaîne
// elle-même plutôt que de compter sur le CSS `truncate`.
function truncateText(str, maxLen) {
  if (!str) return str;
  return str.length > maxLen ? str.slice(0, maxLen - 1).trimEnd() + '…' : str;
}

// Couleurs par coach dérivées de la source unique dans shared.jsx (plutôt
// que recopiées ici — évite la désync si une couleur change un jour).
const COACH_COLORS = Object.fromEntries(
  Object.keys(playerColors).map(j => [j, { bg: playerColors[j], text: playerColorText[j], dot: playerColors[j] }])
);

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
    <span className={`inline-flex items-center justify-center flex-shrink-0 whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-semibold leading-none ${POSTE_COLORS[poste] || 'bg-slate-100 text-slate-700'}`}>
      {poste}
    </span>
  );
}

function computeGoalStats(matchData, joueur, ligue) {
  let buts = 0, csc = 0, virtuels = 0;
  (matchData || []).forEach(m => {
    if (m.ligue !== ligue) return;
    (m.buteurs || []).forEach(b => {
      if (b.joueur !== joueur) return;
      if (b.csc) { csc += (b.buts || 1); return; }
      buts += (b.buts || 1);
      if (b.virtuel) virtuels += (b.buts || 1);
    });
  });
  return { buts, csc, virtuels };
}

function PlayerCard({ player, onClose, photos, matchData }) {
  const { entries, displayName, poste, nationalite, joueur, ligue } = player;
  const { buts, csc, virtuels } = computeGoalStats(matchData, joueur, ligue);

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
    <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <ShareBtn contextText={`${displayName} — MesPetitsBavons`} />
      <div className="p-5 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-start">
          <PlayerAvatar joueur={joueur} ligue={ligue} displayName={displayName} photos={photos} size="lg" />
          <div className="flex-1 min-w-0 ml-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{displayName}</h2>
                <div className="flex items-center mt-1 flex-wrap">
                  {poste && <span className="mr-2 mb-1"><PosteBadge poste={poste} /></span>}
                  {nationalite && <span className="text-xs text-slate-500 dark:text-slate-400 mb-1">{nationalite}</span>}
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none flex-shrink-0 p-1 ml-2">✕</button>
            </div>
            <div className="flex mt-3 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="mr-4 mb-1"><span className="font-semibold text-slate-800 dark:text-slate-200">{entries.length}</span> achat{entries.length > 1 ? 's' : ''}</span>
              <span className="mr-4 mb-1"><span className="font-semibold text-slate-800 dark:text-slate-200">{totalSpent}M</span> total misé</span>
              <span className="mr-4 mb-1">max <span className="font-semibold text-slate-800 dark:text-slate-200">{prixMax}M</span></span>
              <span className="mr-4 mb-1">⚽ <span className="font-semibold text-slate-800 dark:text-slate-200">{buts}</span> but{buts > 1 ? 's' : ''}{virtuels > 0 && <span className="text-slate-400 dark:text-slate-500"> (dont {virtuels} 🎮)</span>}</span>
              {csc > 0 && (
                <span className="text-orange-600 dark:text-orange-400 mb-1">🙈 <span className="font-semibold">{csc}</span> CSC</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Historique des transferts</h3>
        <div className="space-y-4">
          {champList.map(({ saison, ligue, championnat, tours }) => (
            <div key={`${saison}|${ligue}|${championnat}`} className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-600">
              <div className="flex items-center mb-2">
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
                        <div className="flex items-center min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`}></span>
                          <span className={`text-sm font-semibold flex-shrink-0 ml-2 ${colors.text}`}>{e.acheteur}</span>
                          {e.equipe_acheteur && <span className="text-xs text-slate-400 dark:text-slate-500 truncate min-w-0 flex-1 ml-2" title={e.equipe_acheteur}>{truncateText(e.equipe_acheteur, 18)}</span>}
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-shrink-0 ml-2">{e.prix}M</span>
                      </div>
                      <div className="flex items-center text-xs text-slate-400 dark:text-slate-500 mb-1">
                        <span>Tour {e.tour}</span>
                        {e.club && <><span className="mx-2">·</span><span>{e.club}</span></>}
                      </div>
                      {e.encheres_perdues?.length > 0 && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-600">
                          <div className="text-xs text-slate-400 dark:text-slate-500 mb-1">Enchères perdues :</div>
                          <div className="flex flex-wrap">
                            {e.encheres_perdues.map((ep, j) => {
                              const epColors = COACH_COLORS[ep.equipe] || { dot: 'bg-slate-400', text: 'text-slate-500' };
                              return (
                                <span key={j} className="inline-flex items-center text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 mr-1.5 mb-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${epColors.dot}`}></span>
                                  <span className="text-slate-600 dark:text-slate-300 ml-1" title={ep.equipe}>{truncateText(ep.equipe, 16)}</span>
                                  <span className="text-slate-400 ml-1">{ep.prix}M</span>
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

export default function JoueursTab({ mercatoData, matchData, initialPlayerKey, onConsumeInitialPlayer, showBackToEffectifs, onBackToEffectifs }) {
  const [joke] = useState(() => NO_DATA_JOKES[Math.floor(Math.random() * NO_DATA_JOKES.length)]);
  const photos = usePlayerPhotos();
  const [query, setQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const inputRef = useRef(null);

  const { getSuggestions, getPlayerHistory } = useJoueursSearch(mercatoData);

  // Ouverture directe d'une fiche joueur depuis un autre onglet (ex: Effectifs)
  useEffect(() => {
    if (!initialPlayerKey) return;
    const hist = getPlayerHistory(initialPlayerKey);
    if (hist) { setSelectedPlayer(hist); setQuery(hist.displayName); }
    onConsumeInitialPlayer?.();
  }, [initialPlayerKey]);

  const results = getSuggestions(query);
  const isSearching = query.length >= 2;

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

  function selectPlayer(s) {
    setSelectedPlayer(getPlayerHistory(s.key));
  }

  function handleClear() {
    setSelectedPlayer(null);
    setQuery('');
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
      {showBackToEffectifs && selectedPlayer && (
        <button
          onClick={onBackToEffectifs}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
        >
          ← Retour aux effectifs
        </button>
      )}
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
          placeholder="Rechercher un joueur…"
          className="relative w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base shadow-sm"
        />
        {query && (
          <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
        )}
      </div>

      {/* Player card */}
      {selectedPlayer && <PlayerCard player={selectedPlayer} onClose={() => setSelectedPlayer(null)} photos={photos} matchData={matchData} />}

      {/* Liste de résultats (inline) */}
      {!selectedPlayer && isSearching && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {results.length} joueur{results.length > 1 ? 's' : ''}
            </span>
          </div>
          {results.length > 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[60vh] overflow-y-auto">
              {results.slice(0, 60).map(s => (
                <ResultRow key={s.key} s={s} onClick={() => selectPlayer(s)} photos={photos} />
              ))}
              {results.length > 60 && (
                <div className="px-4 py-2 text-xs text-center text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700">
                  Affine ta recherche pour voir les {results.length - 60} autres
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
          <p className="text-base">Recherche un joueur par son nom</p>
        </div>
      )}
    </div>
  );
}
