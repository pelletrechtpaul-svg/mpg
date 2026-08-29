import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { Trophy, Medal, Pencil } from 'lucide-react';
import { playerColorHex, playerColorBg, ShareBtn, isCompte } from '../shared.jsx';
import { usePlayerPhotos, PlayerAvatar } from './PlayerAvatar.jsx';
import { VirtualGoalIcon } from './VirtualGoalIcon.jsx';
import { FormationPitch, POSTE_GROUP, POSTE_GROUP_ORDER } from './FormationPitch.jsx';
import { champNum } from './AdminScorerSection.jsx';

const PlayerBadge = ({ joueur, sm = true }) => (
  <div
    className={`${sm ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5'} rounded-full flex-shrink-0 ring-2 ring-white dark:ring-[#0f0e1a]`}
    style={{ backgroundColor: playerColorHex[joueur] || '#94a3b8' }}
  />
);

export default function ClassementsTab({
  joueurs, ligues, saisons, selectedSeason,
  selectedLigue, setSelectedLigue,
  selectedChampionnat, setSelectedChampionnat,
  championnatsByLigue,
  classementParLigue, statsDetaillees, cleanSheetsStats,
  valiseStats, matchesListForChampionnat,
  ligueMetadata, historicalEvolution, shareContext,
  mercatoData, onOpenPlayer,
  ligueView, setLigueView, effectifsCoach, setEffectifsCoach,
  buteursCscView, setButeursCscView, onEditMatch,
}) {
  const saisonYear = s => { const m = s?.match(/(\d{4})/); return m ? parseInt(m[1]) : 0; };
  const isSeasonFinished = selectedSeason !== 'All-Time' && saisons.some(s => saisonYear(s) > saisonYear(selectedSeason));
  const [rankingsView, setRankingsView] = useState('table');
  const [statsTable, setStatsTable] = useState(null);
  const photos = usePlayerPhotos();

  // Filtre par coach (un seul à la fois) dans les classements Buteurs/Note/
  // CSC (légende cliquable/décliquable) — réinitialisé dès qu'on change de
  // ligue, de championnat, ou de classement affiché (buteurs/note/csc) pour
  // repasser sur la vue collective par défaut. Ajusté pendant le rendu
  // (pattern React recommandé) plutôt que dans un effet, pour ne pas
  // déclencher un rendu superflu après coup.
  const [coachFilter, setCoachFilter] = useState(null);
  const filterScopeKey = `${selectedLigue}|${selectedChampionnat}|${buteursCscView}`;
  const [lastFilterScopeKey, setLastFilterScopeKey] = useState(filterScopeKey);
  if (filterScopeKey !== lastFilterScopeKey) {
    setLastFilterScopeKey(filterScopeKey);
    setCoachFilter(null);
  }

  // Effectif de chaque coach pour le championnat sélectionné, trié par poste.
  // "Total" n'affiche pas d'effectif (pas de synthèse pour l'instant — à
  // revoir plus tard) : il faut un championnat #N précis.
  const effectifsData = useMemo(() => {
    if (selectedLigue === 'general' || selectedChampionnat === 'total') return null;
    const byCoach = {};
    joueurs.forEach(j => { byCoach[j] = []; });

    // Le championnat des matchs (et du sélecteur) est stocké "#N", celui du
    // mercato est un nombre — sans ce parsing la comparaison échoue toujours
    // et l'effectif du tour sélectionné ressort vide.
    const championnatNum = champNum(selectedChampionnat);
    (mercatoData || []).forEach(m => {
      if (m.ligue !== selectedLigue || m.championnat !== championnatNum) return;
      if (!byCoach[m.acheteur]) byCoach[m.acheteur] = [];
      byCoach[m.acheteur].push(m);
    });

    Object.values(byCoach).forEach(squad => {
      squad.sort((a, b) => {
        const gA = POSTE_GROUP_ORDER.indexOf(POSTE_GROUP[a.poste] || 'Milieux');
        const gB = POSTE_GROUP_ORDER.indexOf(POSTE_GROUP[b.poste] || 'Milieux');
        return gA !== gB ? gA - gB : (b.prix || 0) - (a.prix || 0);
      });
    });
    return byCoach;
  }, [mercatoData, selectedLigue, selectedChampionnat, joueurs]);

  // Coach propriétaire de chaque joueur pour le championnat #x sélectionné
  // (dérivé du même effectif que ci-dessus) — sert à teinter les lignes des
  // classements buteurs/note/CSC pour distinguer visuellement les
  // entraineurs. null sur "Total" comme effectifsData : un joueur peut avoir
  // changé de coach d'un championnat à l'autre, teinter n'aurait pas de sens.
  const coachByPlayer = useMemo(() => {
    if (!effectifsData) return null;
    const map = {};
    Object.entries(effectifsData).forEach(([coach, squad]) => {
      squad.forEach(m => { map[m.joueur] = coach; });
    });
    return map;
  }, [effectifsData]);

  // Note moyenne par coach/joueur sur le championnat sélectionné, une fois
  // qu'au moins un match y a été saisi avec des notes — sert à choisir les
  // titulaires par note plutôt que par prix (voir usage plus bas) et à
  // l'afficher sur les cartes effectif.
  const avgNotesByCoach = useMemo(() => {
    const byCoach = {};
    matchesListForChampionnat.forEach(m => {
      (m.notes || []).filter(isCompte).forEach(n => {
        const players = byCoach[n.acheteur] || (byCoach[n.acheteur] = {});
        const entry = players[n.joueur] || (players[n.joueur] = { sum: 0, count: 0 });
        entry.sum += n.note;
        entry.count += 1;
      });
    });
    const avg = {};
    Object.entries(byCoach).forEach(([coach, players]) => {
      avg[coach] = {};
      Object.entries(players).forEach(([joueur, { sum, count }]) => { avg[coach][joueur] = sum / count; });
    });
    return avg;
  }, [matchesListForChampionnat]);

  const getTrophyForRow = (index) => {
    if (index !== 0) return null;
    if (selectedLigue === 'general') {
      return isSeasonFinished ? <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 dark:text-yellow-400 flex-shrink-0" /> : null;
    }
    if (selectedChampionnat !== 'total') {
      const metadata = ligueMetadata[`${selectedSeason}-${selectedLigue}-${selectedChampionnat}`];
      if (metadata && metadata.matchsEntered >= metadata.matchsTotal) {
        return metadata.matchsTotal < 6
          ? <Medal className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
          : <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />;
      }
    }
    return null;
  };
  const [showGoalsDetail, setShowGoalsDetail] = useState(null);
  const [showChampDetail, setShowChampDetail] = useState(null);

  // Classement des buts / CSC par joueur (mercato) pour la ligue/championnat sélectionné
  const { buteursRanking, cscRanking } = useMemo(() => {
    const buts = {}, virtuels = {}, csc = {};
    matchesListForChampionnat.forEach(m => {
      (m.buteurs || []).filter(isCompte).forEach(b => {
        if (!b.joueur) return;
        if (b.csc) { csc[b.joueur] = (csc[b.joueur] || 0) + (b.buts || 1); return; }
        buts[b.joueur] = (buts[b.joueur] || 0) + (b.buts || 1);
        if (b.virtuel) virtuels[b.joueur] = (virtuels[b.joueur] || 0) + (b.buts || 1);
      });
    });
    const toSorted = obj => Object.entries(obj).map(([joueur, n]) => ({ joueur, n })).sort((a, b) => b.n - a.n);
    return {
      buteursRanking: toSorted(buts).map(p => ({ ...p, virtuels: virtuels[p.joueur] || 0 })),
      cscRanking: toSorted(csc),
    };
  }, [matchesListForChampionnat]);

  // Classement par note moyenne (toutes notes saisies dans le championnat
  // sélectionné, ou tous championnats confondus sur "Total") — indépendant
  // du coach, contrairement à avgNotesByCoach qui sert à l'affichage effectif.
  const noteRanking = useMemo(() => {
    const acc = {};
    matchesListForChampionnat.forEach(m => {
      (m.notes || []).filter(isCompte).forEach(n => {
        if (!n.joueur) return;
        const entry = acc[n.joueur] || (acc[n.joueur] = { sum: 0, count: 0 });
        entry.sum += n.note;
        entry.count += 1;
      });
    });
    return Object.entries(acc)
      .map(([joueur, { sum, count }]) => ({ joueur, avg: sum / count, matchs: count }))
      .sort((a, b) => b.avg - a.avg);
  }, [matchesListForChampionnat]);

  // Classements filtrés par la légende coach cliquable (pas de filtre actif
  // = tout le monde). coachByPlayer est null sur "Total", donc un joueur y
  // matche toujours `undefined` — sans effet puisque coachFilter est aussi
  // remis à zéro dès qu'on quitte un championnat #x (voir plus haut).
  const filteredButeursRanking = coachFilter ? buteursRanking.filter(p => coachByPlayer?.[p.joueur] === coachFilter) : buteursRanking;
  const filteredNoteRanking = coachFilter ? noteRanking.filter(p => coachByPlayer?.[p.joueur] === coachFilter) : noteRanking;
  const filteredCscRanking = coachFilter ? cscRanking.filter(p => coachByPlayer?.[p.joueur] === coachFilter) : cscRanking;

  return (
    <>
      {/* Onglets de ligue */}
      <div className="mb-6">
        <div className="flex justify-between sm:justify-start gap-1 bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-1 border border-indigo-100 dark:border-[#2d2b5e] max-w-xl sm:w-fit">
          <button
            onClick={() => { setSelectedLigue('general'); setSelectedChampionnat('total'); setLigueView('classement'); }}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl font-medium transition-all text-sm sm:text-base whitespace-nowrap ${
              selectedLigue === 'general'
                ? 'bg-purple-400 text-white shadow'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/10'
            }`}
          >
            Général
          </button>
          {ligues.map(ligue => (
            <button
              key={ligue}
              onClick={() => {
                setSelectedLigue(ligue);
                // Par défaut sur le championnat #x le plus récent plutôt que
                // "Total" — championnatsByLigue est trié numériquement, donc
                // le dernier élément est le plus récent. Pas de notion de
                // "tour le plus récent" en All-Time (span plusieurs saisons,
                // le sélecteur de championnat y est d'ailleurs masqué).
                const champs = selectedSeason !== 'All-Time' ? (championnatsByLigue[ligue] || []) : [];
                setSelectedChampionnat(champs.length ? champs[champs.length - 1] : 'total');
                setLigueView('classement');
                setEffectifsCoach(null);
              }}
              className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl font-medium transition-all text-sm sm:text-base whitespace-nowrap ${
                selectedLigue === ligue
                  ? 'bg-purple-400 text-white shadow'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/10'
              }`}
            >
              {ligue === 'Champions League' || ligue === 'Ligue des Champions' ? 'LDC' : ligue === 'Premier League' ? 'PL' : ligue}
            </button>
          ))}
        </div>

        {selectedSeason !== 'All-Time' && selectedLigue !== 'general' && championnatsByLigue[selectedLigue] && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Championnat</label>
            <select
              value={selectedChampionnat}
              onChange={(e) => setSelectedChampionnat(e.target.value)}
              className="w-full md:w-64 px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="total" className="text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800">Total</option>
              {championnatsByLigue[selectedLigue].map((ch, i) => (
                <option key={ch} value={ch} className="text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800">Championnat {i + 1} ({ch})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Toggle Classement/Effectifs */}
      {selectedLigue !== 'general' && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setLigueView('classement')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-lg border ${ligueView === 'classement' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white/80 dark:bg-white/5 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'}`}
          >
            📊 Classement
          </button>
          {selectedChampionnat !== 'total' && (
            <button
              onClick={() => setLigueView('matchs')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-lg border ${ligueView === 'matchs' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white/80 dark:bg-white/5 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'}`}
            >
              🗓️ Matchs
            </button>
          )}
          <button
            onClick={() => setLigueView('effectifs')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-lg border ${ligueView === 'effectifs' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white/80 dark:bg-white/5 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'}`}
          >
            {selectedChampionnat === 'total' ? '🏆 Meilleurs effectifs' : '👥 Effectifs'}
          </button>
        </div>
      )}

      {/* Toggle Tableau/Graphique + Stats sub-tabs */}
      {selectedLigue === 'general' && (
        <div className="mb-4">
          {/* Ligne 1 : Tableau + Évolution */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => { setRankingsView('table'); setStatsTable(null); }}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-lg border ${rankingsView === 'table' && !statsTable ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white/80 dark:bg-white/5 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'}`}
            >
              📊 Tableau
            </button>
            <button
              onClick={() => { setRankingsView('graph'); setStatsTable(null); }}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-lg border ${rankingsView === 'graph' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white/80 dark:bg-white/5 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'}`}
            >
              📈 Évolution
            </button>
          </div>
          {/* Ligne 2+ : stats, centrées, flex-wrap */}
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { key: 'buteurs', label: '⚽ Buteurs' },
              { key: 'loosers', label: '🥅 Loosers' },
              { key: 'cleansheets', label: '🧤 Clean sheets' },
              { key: 'pannes', label: '🚫 Pannes' },
              ...(valiseStats ? [
                { key: 'valises', label: '💼 Valises' },
                { key: 'valises-efficaces', label: '🎯 Valises eff.' },
              ] : []),
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setStatsTable(statsTable === key ? null : key); setRankingsView('table'); }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                  statsTable === key
                    ? 'bg-blue-600 text-white border-blue-600 shadow'
                    : 'bg-white/80 dark:bg-white/5 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tableau classement / stats / graphique / effectifs / matchs */}
      {selectedLigue !== 'general' && ligueView === 'matchs' ? (
        selectedChampionnat !== 'total' && matchesListForChampionnat.length > 0 ? (
          <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-6 hover:-translate-y-0.5 transition-all duration-200">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Matchs du championnat {selectedChampionnat}
            </h3>
            {(() => {
              const ligueKey = `${selectedSeason}-${selectedLigue}-${selectedChampionnat}`;
              const metadata = ligueMetadata[ligueKey];
              if (metadata && matchesListForChampionnat.length > 0) {
                const sortedMatches = [...matchesListForChampionnat].sort((a, b) => new Date(a.dateMatch) - new Date(b.dateMatch));
                const firstMatchDate = sortedMatches[0]?.dateMatch;
                const lastMatchDate = sortedMatches[sortedMatches.length - 1]?.dateMatch;
                const isComplete = metadata.matchsEntered >= metadata.matchsTotal;
                return (
                  <div className="mb-4 bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <strong>Commencé le :</strong> {firstMatchDate ? new Date(firstMatchDate).toLocaleDateString('fr-FR') : 'N/A'} •
                      <strong className="ml-2">Matchs :</strong> {metadata.matchsEntered}/{metadata.matchsTotal}
                      {isComplete && lastMatchDate && <span className="ml-4"><strong>Terminé le :</strong> {new Date(lastMatchDate).toLocaleDateString('fr-FR')}</span>}
                    </p>
                  </div>
                );
              }
              return null;
            })()}
            {(() => {
              const coachesInChamp = [...new Set(matchesListForChampionnat.flatMap(m => [m.joueur1, m.joueur2]))];
              const rotaldosByCoach = {}, benchGoalsByCoach = {};
              coachesInChamp.forEach(c => { rotaldosByCoach[c] = 0; benchGoalsByCoach[c] = 0; });
              matchesListForChampionnat.forEach(match => {
                if (match.joueur1) rotaldosByCoach[match.joueur1] += match.rotaldos_j1 || 0;
                if (match.joueur2) rotaldosByCoach[match.joueur2] += match.rotaldos_j2 || 0;
                (match.buteurs || []).forEach(b => {
                  if (!b.acheteur || b.csc || b.statut !== 'banc' || benchGoalsByCoach[b.acheteur] === undefined) return;
                  benchGoalsByCoach[b.acheteur] += b.buts || 1;
                });
              });
              const hasRotaldos = coachesInChamp.some(c => rotaldosByCoach[c] > 0);
              const hasBenchGoals = coachesInChamp.some(c => benchGoalsByCoach[c] > 0);
              if (!hasRotaldos && !hasBenchGoals) return null;
              return (
                <div className="mb-4 flex flex-wrap gap-3">
                  {hasRotaldos && (
                    <div className="flex-1 min-w-[140px] bg-fuchsia-50 dark:bg-fuchsia-900/20 rounded-xl p-3">
                      <p className="text-[11px] font-semibold text-fuchsia-700 dark:text-fuchsia-400 uppercase tracking-wide mb-1">🎲 Rotaldos</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-3 gap-y-0.5">
                        {coachesInChamp.filter(c => rotaldosByCoach[c] > 0).map(c => (
                          <span key={c}>{c} <strong>{rotaldosByCoach[c]}</strong></span>
                        ))}
                      </p>
                    </div>
                  )}
                  {hasBenchGoals && (
                    <div className="flex-1 min-w-[140px] bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">🪑⚽ Buts gâchés sur le banc</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-3 gap-y-0.5">
                        {coachesInChamp.filter(c => benchGoalsByCoach[c] > 0).map(c => (
                          <span key={c}>{c} <strong>{benchGoalsByCoach[c]}</strong></span>
                        ))}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="space-y-2">
              {matchesListForChampionnat.map((match, index) => {
                const isWin1 = match.resultat === 'victoire_j1';
                const isWin2 = match.resultat === 'victoire_j2';
                const rotaldos1 = match.rotaldos_j1 || 0;
                const rotaldos2 = match.rotaldos_j2 || 0;
                const banc1 = (match.notes || []).filter(n => n.acheteur === match.joueur1 && n.statut === 'banc').length;
                const banc2 = (match.notes || []).filter(n => n.acheteur === match.joueur2 && n.statut === 'banc').length;
                const avgFor = (coach) => {
                  const notes = (match.notes || []).filter(n => n.acheteur === coach && isCompte(n) && n.note != null);
                  return notes.length > 0 ? notes.reduce((s, n) => s + n.note, 0) / notes.length : null;
                };
                const avg1 = avgFor(match.joueur1);
                const avg2 = avgFor(match.joueur2);
                const CoachBadges = ({ avg, rotaldos, banc, align }) => (avg != null || rotaldos > 0 || banc > 0) && (
                  <span className={`flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 ${align === 'right' ? 'justify-end' : ''}`}>
                    {avg != null && <span title="Note moyenne">⭐ {avg.toFixed(1)}</span>}
                    {rotaldos > 0 && <span title="Rotaldos" className="text-fuchsia-600 dark:text-fuchsia-400">🎲 {rotaldos}</span>}
                    {banc > 0 && <span title="Joueurs sur le banc">🪑 {banc}</span>}
                  </span>
                );
                return (
                  <div key={index} className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                      <span>{match.dateMatch ? new Date(match.dateMatch).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date(match.dateEntree).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                      {(match.valise_j1 || match.valise_j2) && (
                        <span>{match.valise_j1 && match.valise_j2 ? '💼💼' : '💼'}</span>
                      )}
                      {onEditMatch && (
                        <button
                          onClick={() => onEditMatch(match)}
                          title="Éditer ce match"
                          className="ml-auto flex items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex-shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Éditer</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0 text-right">
                        <span className={`font-medium text-sm sm:text-base ${isWin1 ? 'text-green-700 dark:text-green-400' : isWin2 ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>{match.joueur1}</span>
                        <CoachBadges avg={avg1} rotaldos={rotaldos1} banc={banc1} align="right" />
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-base sm:text-xl font-bold ${isWin1 ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>{match.buts_j1}</span>
                        <span className="text-slate-300 dark:text-slate-600">-</span>
                        <span className={`text-base sm:text-xl font-bold ${isWin2 ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>{match.buts_j2}</span>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className={`font-medium text-sm sm:text-base ${isWin2 ? 'text-green-700 dark:text-green-400' : isWin1 ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>{match.joueur2}</span>
                        <CoachBadges avg={avg2} rotaldos={rotaldos2} banc={banc2} align="left" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              {selectedChampionnat === 'total' ? 'Sélectionne un championnat pour afficher les matchs.' : 'Aucun match saisi pour ce championnat.'}
            </p>
          </div>
        )
      ) : selectedLigue !== 'general' && ligueView === 'effectifs' ? (
        effectifsData ? (
          <div className="space-y-4">
            {/* Sous-menu : un bouton par entraîneur */}
            <div className="flex flex-wrap gap-1 bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-1 border border-indigo-100 dark:border-[#2d2b5e] max-w-xl">
              {joueurs.map(coach => (
                <button
                  key={coach}
                  onClick={() => setEffectifsCoach(coach)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl font-medium transition-all text-sm sm:text-base whitespace-nowrap ${
                    (effectifsCoach ?? joueurs[0]) === coach
                      ? 'bg-purple-400 text-white shadow'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/10'
                  }`}
                >
                  <PlayerBadge joueur={coach} />
                  {coach}
                </button>
              ))}
            </div>

            {(() => {
              const coach = effectifsCoach ?? joueurs[0];
              const squad = effectifsData[coach] || [];
              // Au moins un match du championnat a été noté : les titulaires
              // sont choisis par note moyenne plutôt que par prix.
              const coachNotes = matchesListForChampionnat.length > 0 ? avgNotesByCoach[coach] : null;
              const ratingFor = coachNotes ? (m => coachNotes[m.joueur] ?? 0) : undefined;
              const avgNoteFor = coachNotes ? (m => coachNotes[m.joueur]) : undefined;
              return (
                <div data-card className="relative bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] overflow-hidden hover:-translate-y-0.5 transition-all duration-200 p-5">
                  <ShareBtn contextText={shareContext} />
                  {squad.length > 0 ? (
                    <FormationPitch squad={squad} onOpenPlayer={onOpenPlayer} photos={photos} ratingFor={ratingFor} avgNoteFor={avgNoteFor} />
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500">Aucun achat.</p>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              {selectedChampionnat === 'total' ? 'Sélectionne un championnat pour afficher l\'effectif.' : 'Pas de données mercato pour cette ligue.'}
            </p>
          </div>
        )
      ) : statsTable ? (
        <div data-card className="relative bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] overflow-hidden hover:-translate-y-0.5 transition-all duration-200">
          <ShareBtn contextText={shareContext} />
          {statsTable === 'buteurs' && (
            <table className="w-full table-fixed text-xs sm:text-sm">
              <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                <tr>
                  <th className="w-8 sm:w-14 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Entraîneur</th>
                  <th className="w-14 sm:w-20 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Buts</th>
                  <th className="w-10 sm:w-14 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                  <th className="w-12 sm:w-16 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Moy.</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(statsDetaillees).map(([joueur, data]) => ({ joueur, ...data })).sort((a, b) => b.buts_pour - a.buts_pour).map((player, index) => (
                  <tr key={player.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 truncate"><div className="flex items-center gap-1 sm:gap-3 min-w-0"><PlayerBadge joueur={player.joueur} /><span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base truncate">{player.joueur}</span></div></td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-green-600 dark:text-green-400 text-xs sm:text-base">{player.buts_pour}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center text-slate-700 dark:text-slate-200 text-xs sm:text-base">{player.matchs}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-blue-600 dark:text-blue-400 text-xs sm:text-base">{player.matchs > 0 ? (player.buts_pour / player.matchs).toFixed(2) : '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {statsTable === 'loosers' && (
            <table className="w-full table-fixed text-xs sm:text-sm">
              <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                <tr>
                  <th className="w-8 sm:w-14 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Entraîneur</th>
                  <th className="w-14 sm:w-20 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Buts enc.</th>
                  <th className="w-10 sm:w-14 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                  <th className="w-12 sm:w-16 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Moy.</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(statsDetaillees).map(([joueur, data]) => ({ joueur, ...data })).sort((a, b) => b.buts_contre - a.buts_contre).map((player, index) => (
                  <tr key={player.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 truncate"><div className="flex items-center gap-1 sm:gap-3 min-w-0"><PlayerBadge joueur={player.joueur} /><span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base truncate">{player.joueur}</span></div></td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-red-600 dark:text-red-400 text-xs sm:text-base">{player.buts_contre}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center text-slate-700 dark:text-slate-200 text-xs sm:text-base">{player.matchs}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-orange-600 dark:text-orange-400 text-xs sm:text-base">{player.matchs > 0 ? (player.buts_contre / player.matchs).toFixed(2) : '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {statsTable === 'cleansheets' && (
            <table className="w-full table-fixed text-xs sm:text-sm">
              <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                <tr>
                  <th className="w-8 sm:w-14 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Entraîneur</th>
                  <th className="w-14 sm:w-20 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">CS</th>
                  <th className="w-10 sm:w-14 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                  <th className="w-12 sm:w-16 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">%</th>
                </tr>
              </thead>
              <tbody>
                {[...cleanSheetsStats].sort((a, b) => b.cleanSheets - a.cleanSheets).map((player, index) => (
                  <tr key={player.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 truncate"><div className="flex items-center gap-1 sm:gap-3 min-w-0"><PlayerBadge joueur={player.joueur} /><span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base truncate">{player.joueur}</span></div></td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-sky-600 dark:text-sky-400 text-xs sm:text-base">{player.cleanSheets}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center text-slate-700 dark:text-slate-200 text-xs sm:text-base">{player.matchs}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-blue-600 dark:text-blue-400 text-xs sm:text-base">{player.matchs > 0 ? ((player.cleanSheets / player.matchs) * 100).toFixed(0) : '0'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {statsTable === 'pannes' && (
            <>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 px-1 sm:px-6 pt-3">Matchs sans marquer le moindre but</p>
              <table className="w-full table-fixed text-xs sm:text-sm mt-2">
                <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                  <tr>
                    <th className="w-8 sm:w-14 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                    <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Entraîneur</th>
                    <th className="w-14 sm:w-20 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">0 but</th>
                    <th className="w-10 sm:w-14 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                    <th className="w-12 sm:w-16 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[...cleanSheetsStats].sort((a, b) => b.pannesOffensives - a.pannesOffensives).map((player, index) => (
                    <tr key={player.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4 truncate"><div className="flex items-center gap-1 sm:gap-3 min-w-0"><PlayerBadge joueur={player.joueur} /><span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base truncate">{player.joueur}</span></div></td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-orange-600 dark:text-orange-400 text-xs sm:text-base">{player.pannesOffensives}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center text-slate-700 dark:text-slate-200 text-xs sm:text-base">{player.matchs}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-red-500 dark:text-red-400 text-xs sm:text-base">{player.matchs > 0 ? ((player.pannesOffensives / player.matchs) * 100).toFixed(0) : '0'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {statsTable === 'valises' && valiseStats && (
            <table className="w-full table-fixed text-xs sm:text-sm">
              <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                <tr>
                  <th className="w-8 sm:w-14 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Entraîneur</th>
                  <th className="w-16 sm:w-20 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Utilisées</th>
                  <th className="w-16 sm:w-20 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Reçues</th>
                </tr>
              </thead>
              <tbody>
                {joueurs.map(j => ({ joueur: j, utilisees: valiseStats[j].utilisees, recues: valiseStats[j].recues }))
                  .sort((a, b) => b.utilisees - a.utilisees || a.recues - b.recues)
                  .map((item, index) => (
                    <tr key={item.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4 truncate"><div className="flex items-center gap-1 sm:gap-3 min-w-0"><PlayerBadge joueur={item.joueur} /><span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base truncate">{item.joueur}</span></div></td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-blue-600 dark:text-blue-400 text-xs sm:text-base">{item.utilisees}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-red-600 dark:text-red-400 text-xs sm:text-base">{item.recues}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {statsTable === 'valises-efficaces' && valiseStats && (
            <table className="w-full table-fixed text-xs sm:text-sm">
              <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                <tr>
                  <th className="w-8 sm:w-14 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Entraîneur</th>
                  <th className="w-16 sm:w-20 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-green-700 dark:text-green-400 text-xs sm:text-sm">Infligées</th>
                  <th className="w-16 sm:w-20 px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-red-700 dark:text-red-400 text-xs sm:text-sm">Reçues</th>
                </tr>
              </thead>
              <tbody>
                {joueurs.map(j => ({ joueur: j, efficaces: valiseStats[j].efficaces, efficacesRecues: valiseStats[j].efficacesRecues }))
                  .sort((a, b) => b.efficaces - a.efficaces || a.efficacesRecues - b.efficacesRecues)
                  .map((item, index) => (
                    <tr key={item.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4 truncate"><div className="flex items-center gap-1 sm:gap-3 min-w-0"><PlayerBadge joueur={item.joueur} /><span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base truncate">{item.joueur}</span></div></td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-green-600 dark:text-green-400 text-xs sm:text-base">{item.efficaces}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-red-500 dark:text-red-400 text-xs sm:text-base">{item.efficacesRecues}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (selectedLigue !== 'general' || rankingsView === 'table') ? (
        <div data-card className="relative rounded-2xl overflow-hidden bg-white dark:bg-[#0f0e1a] border border-indigo-100 dark:border-[#2d2b5e]">
          <ShareBtn contextText={shareContext} />
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                <tr>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Entraîneur</th>
                  <th className="px-2 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                  <th className="px-0.5 py-2 sm:px-4 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">V</th>
                  <th className="px-0.5 py-2 sm:px-4 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">N</th>
                  <th className="px-0.5 py-2 sm:px-4 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">D</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">GA</th>
                  {(selectedChampionnat === 'total' || selectedLigue === 'general') && (
                    <>
                      <th className="px-0.5 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Titres</th>
                      <th className="px-0 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
                        <span className="hidden sm:inline">Médailles</span><span className="sm:hidden">Méd.</span>
                      </th>
                    </>
                  )}
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
                    {selectedLigue === 'general' ? 'Points' : selectedChampionnat === 'total' ? 'Points en match' : 'Points'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {classementParLigue.map((player, index) => (
                  <tr key={player.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center">
                      <span className="font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</span>
                    </td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4">
                      <div className="flex items-center gap-1 sm:gap-3 min-w-0">
                        {getTrophyForRow(index) || <PlayerBadge joueur={player.joueur} />}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base truncate">{player.joueur}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 text-center text-slate-700 dark:text-slate-300 text-xs sm:text-base">{player.matchs}</td>
                    <td className="px-0.5 py-2 sm:px-4 sm:py-4 text-center text-green-600 dark:text-green-400 font-semibold text-xs sm:text-base">{player.victoires}</td>
                    <td className="px-0.5 py-2 sm:px-4 sm:py-4 text-center text-slate-600 dark:text-slate-300 text-xs sm:text-base">{player.nuls}</td>
                    <td className="px-0.5 py-2 sm:px-4 sm:py-4 text-center text-red-600 dark:text-red-400 font-semibold text-xs sm:text-base">{player.defaites}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center">
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        <span className={`font-bold ${player.ga >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {player.ga > 0 ? '+' : ''}{player.ga}
                        </span>
                        <button onClick={() => setShowGoalsDetail(player)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 font-bold text-sm sm:text-lg">+</button>
                      </div>
                    </td>
                    {(selectedChampionnat === 'total' || selectedLigue === 'general') && (
                      <>
                        <td className="px-0.5 py-2 sm:px-6 sm:py-4 text-center">
                          <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                            <span className="font-semibold text-yellow-600 dark:text-yellow-400 text-xs sm:text-base">{player.victoiresChampionnat || 0}</span>
                            {selectedLigue === 'general' && (player.victoiresChampionnat || 0) > 0 && (
                              <button onClick={() => setShowChampDetail({ joueur: player.joueur, type: 'titres', ligues: player.victoiresLigues || [] })} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 font-bold text-xs sm:text-sm leading-none">+</button>
                            )}
                          </div>
                        </td>
                        <td className="px-0 py-2 sm:px-6 sm:py-4 text-center">
                          <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                            <span className="font-semibold text-slate-500 dark:text-slate-300 text-xs sm:text-base">{player.medaillesChampionnat || 0}</span>
                            {selectedLigue === 'general' && (player.medaillesChampionnat || 0) > 0 && (
                              <button onClick={() => setShowChampDetail({ joueur: player.joueur, type: 'medailles', ligues: player.medaillesLigues || [] })} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 font-bold text-xs sm:text-sm leading-none">+</button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center">
                      <span className="text-sm sm:text-xl font-bold text-indigo-600 dark:text-indigo-400">
                        {selectedLigue === 'general' ? player.points : selectedChampionnat === 'total' ? (player.pointsMatch || player.points) : player.points}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-0 sm:p-6 hover:-translate-y-0.5 transition-all duration-200">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 px-2 sm:px-0 pt-2 sm:pt-0">Évolution des points au fil du temps</h3>
          {historicalEvolution.length > 0 ? (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 px-2 sm:px-0">Déplacez les poignées de la tirette en bas pour zoomer sur une période</p>
              <div className="w-full sm:w-1/2 sm:mx-auto">
                <ResponsiveContainer width="100%" height={480}>
                  <LineChart data={historicalEvolution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} height={40} />
                    <YAxis label={{ value: 'Points cumulés', angle: -90, position: 'insideLeft' }} domain={['dataMin - 5', 'dataMax + 5']} scale="linear" />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Legend verticalAlign="top" height={36} />
                    <Brush dataKey="date" height={30} stroke="#94a3b8" fill="#f1f5f9" startIndex={Math.max(0, historicalEvolution.length - 20)} endIndex={historicalEvolution.length - 1} travellerWidth={8} />
                    {joueurs.map((joueur) => (
                      <Line key={joueur} type="monotone" dataKey={joueur} stroke={playerColorHex[joueur] || '#6b7280'} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="text-center text-slate-600 dark:text-slate-300 py-12"><p>Pas assez de données pour afficher l'évolution</p></div>
          )}
        </div>
      )}

      {/* Popup détails buts */}
      {showGoalsDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowGoalsDetail(null)}>
          <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{showGoalsDetail.joueur}</h3>
              <button onClick={() => setShowGoalsDetail(null)} className="text-slate-600 hover:text-slate-800 dark:hover:text-slate-100">✕</button>
            </div>
            <div className="space-y-3">
              <div className="flex flex-col items-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                <span className="text-slate-700 dark:text-slate-200 font-medium mb-2">Buts inscrits</span>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">{showGoalsDetail.buts_pour}</span>
              </div>
              <div className="flex flex-col items-center p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                <span className="text-slate-700 dark:text-slate-200 font-medium mb-2">Buts encaissés</span>
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">{showGoalsDetail.buts_contre}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup détail titres / médailles */}
      {showChampDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowChampDetail(null)}>
          <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-6 max-w-xs w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {showChampDetail.joueur} — {showChampDetail.type === 'titres' ? '🏆 Titres' : '🥈 Médailles'}
              </h3>
              <button onClick={() => setShowChampDetail(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-1.5">
              {selectedSeason === 'All-Time'
                ? Object.entries(showChampDetail.ligues.reduce((acc, e) => { acc[e.saison] = (acc[e.saison] || 0) + 1; return acc; }, {}))
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([saison, count]) => (
                      <div key={saison} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                        <span className="text-slate-700 dark:text-slate-200 font-medium">{saison}</span>
                        {count > 1 && <span className="text-xs font-bold text-white bg-blue-500 rounded-full px-2 py-0.5">×{count}</span>}
                      </div>
                    ))
                : Object.entries(showChampDetail.ligues.reduce((acc, e) => { acc[e.ligue] = (acc[e.ligue] || 0) + 1; return acc; }, {}))
                    .sort((a, b) => b[1] - a[1])
                    .map(([ligue, count]) => (
                      <div key={ligue} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                        <span className="text-slate-700 dark:text-slate-200 font-medium">{ligue}</span>
                        {count > 1 && <span className="text-xs font-bold text-white bg-blue-500 rounded-full px-2 py-0.5">×{count}</span>}
                      </div>
                    ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Classement buteurs / CSC (joueurs mercato), fusionnés dans une seule carte avec toggle */}
      {selectedLigue !== 'general' && ligueView === 'classement' && (
        <div data-card className="relative bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] overflow-hidden hover:-translate-y-0.5 transition-all duration-200 mt-6">
          <ShareBtn contextText={shareContext} />
          <div className="flex items-center gap-3 px-6 pt-6 pb-2">
            <div className="flex gap-1 bg-slate-100 dark:bg-white/5 rounded-xl p-1 flex-shrink-0">
              <button
                onClick={() => setButeursCscView('buteurs')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${buteursCscView === 'buteurs' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                ⚽
              </button>
              <button
                onClick={() => setButeursCscView('note')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${buteursCscView === 'note' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                ⭐
              </button>
              <button
                onClick={() => setButeursCscView('csc')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${buteursCscView === 'csc' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                🙈
              </button>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {buteursCscView === 'buteurs' ? 'Buteurs' : buteursCscView === 'note' ? 'Note moyenne' : 'CSC'}
            </h3>
          </div>

          {coachByPlayer && (
            <div className="flex flex-wrap gap-2 px-6 pb-2 text-[11px] text-slate-500 dark:text-slate-400">
              {joueurs.map(coach => {
                const active = !coachFilter || coachFilter === coach;
                return (
                  <button
                    key={coach}
                    type="button"
                    onClick={() => setCoachFilter(prev => prev === coach ? null : coach)}
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-opacity ${active ? '' : 'opacity-40'}`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: playerColorHex[coach] || '#94a3b8' }} />
                    {coach}
                  </button>
                );
              })}
            </div>
          )}

          {buteursCscView === 'buteurs' ? (
            filteredButeursRanking.length > 0 ? (
              <table className="w-full table-fixed text-xs sm:text-sm">
                <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                  <tr>
                    <th className="w-8 sm:w-14 px-1 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                    <th className="px-1 py-2 sm:px-6 sm:py-3 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                    <th className="w-14 sm:w-20 px-1 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Buts</th>
                    <th className="w-14 sm:w-20 px-1 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm" title="Dont buts MPG">dont <VirtualGoalIcon /></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredButeursRanking.slice(0, 10).map((p, index) => {
                    const coach = coachByPlayer?.[p.joueur];
                    return (
                      <tr key={p.joueur} className={`border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors ${coach ? playerColorBg[coach] : ''}`}>
                        <td className="px-1 py-2 sm:px-6 sm:py-3 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                        <td className="px-1 py-2 sm:px-6 sm:py-3 font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base truncate">
                          <button onClick={() => onOpenPlayer?.(p.joueur, selectedLigue)} className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left min-w-0">
                            <PlayerAvatar joueur={p.joueur} ligue={selectedLigue} displayName={p.joueur} photos={photos} size="sm" />
                            <span className="truncate">{p.joueur}</span>
                          </button>
                        </td>
                        <td className="px-1 py-2 sm:px-6 sm:py-3 text-center font-bold text-green-600 dark:text-green-400 text-xs sm:text-base">{p.n}</td>
                        <td className="px-1 py-2 sm:px-6 sm:py-3 text-center text-indigo-600 dark:text-indigo-400 text-xs sm:text-base">{p.virtuels > 0 ? p.virtuels : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 px-6 pb-6">{coachFilter ? 'Aucun but pour ce filtre.' : "Aucun but marqué pour l'instant."}</p>
            )
          ) : buteursCscView === 'note' ? (
            filteredNoteRanking.length > 0 ? (
              <table className="w-full table-fixed text-xs sm:text-sm">
                <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                  <tr>
                    <th className="w-8 sm:w-14 px-1 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                    <th className="px-1 py-2 sm:px-6 sm:py-3 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                    <th className="w-14 sm:w-20 px-1 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Note</th>
                    <th className="w-14 sm:w-20 px-1 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNoteRanking.slice(0, 10).map((p, index) => {
                    const coach = coachByPlayer?.[p.joueur];
                    return (
                      <tr key={p.joueur} className={`border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors ${coach ? playerColorBg[coach] : ''}`}>
                        <td className="px-1 py-2 sm:px-6 sm:py-3 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                        <td className="px-1 py-2 sm:px-6 sm:py-3 font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base truncate">
                          <button onClick={() => onOpenPlayer?.(p.joueur, selectedLigue)} className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left min-w-0">
                            <PlayerAvatar joueur={p.joueur} ligue={selectedLigue} displayName={p.joueur} photos={photos} size="sm" />
                            <span className="truncate">{p.joueur}</span>
                          </button>
                        </td>
                        <td className="px-1 py-2 sm:px-6 sm:py-3 text-center font-bold text-amber-600 dark:text-amber-400 text-xs sm:text-base">{p.avg.toFixed(1)}</td>
                        <td className="px-1 py-2 sm:px-6 sm:py-3 text-center text-slate-500 dark:text-slate-400 text-xs sm:text-base">{p.matchs}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 px-6 pb-6">{coachFilter ? 'Aucune note pour ce filtre.' : "Aucune note saisie pour l'instant."}</p>
            )
          ) : (
            filteredCscRanking.length > 0 ? (
              <table className="w-full table-fixed text-xs sm:text-sm">
                <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                  <tr>
                    <th className="w-8 sm:w-14 px-1 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                    <th className="px-1 py-2 sm:px-6 sm:py-3 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                    <th className="w-14 sm:w-20 px-1 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">CSC</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCscRanking.map((p, index) => {
                    const coach = coachByPlayer?.[p.joueur];
                    return (
                      <tr key={p.joueur} className={`border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors ${coach ? playerColorBg[coach] : ''}`}>
                        <td className="px-1 py-2 sm:px-6 sm:py-3 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                        <td className="px-1 py-2 sm:px-6 sm:py-3 font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base truncate">
                          <button onClick={() => onOpenPlayer?.(p.joueur, selectedLigue)} className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left min-w-0">
                            <PlayerAvatar joueur={p.joueur} ligue={selectedLigue} displayName={p.joueur} photos={photos} size="sm" />
                            <span className="truncate">{p.joueur}</span>
                          </button>
                        </td>
                        <td className="px-1 py-2 sm:px-6 sm:py-3 text-center font-bold text-orange-600 dark:text-orange-400 text-xs sm:text-base">{p.n}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 px-6 pb-6">{coachFilter ? 'Aucun CSC pour ce filtre.' : "Aucun CSC pour l'instant."}</p>
            )
          )}
        </div>
      )}

    </>
  );
}
