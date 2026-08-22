import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { Trophy, Medal } from 'lucide-react';
import { playerColorHex, ShareBtn } from '../shared.jsx';
import { usePlayerPhotos } from './PlayerAvatar.jsx';
import { FormationPitch, POSTE_GROUP, POSTE_GROUP_ORDER } from './FormationPitch.jsx';

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
}) {
  const saisonYear = s => { const m = s?.match(/(\d{4})/); return m ? parseInt(m[1]) : 0; };
  const isSeasonFinished = selectedSeason !== 'All-Time' && saisons.some(s => saisonYear(s) > saisonYear(selectedSeason));
  const [rankingsView, setRankingsView] = useState('table');
  const [statsTable, setStatsTable] = useState(null);
  const photos = usePlayerPhotos();

  // Championnat affiché dans Effectifs : réutilise le sélecteur du classement.
  // "Total" n'a pas de sens pour un effectif → on retombe sur le plus récent.
  const currentEffectifsChampionnat = useMemo(() => {
    if (selectedLigue === 'general') return null;
    if (selectedChampionnat !== 'total') return Number(selectedChampionnat);
    const nums = (mercatoData || []).filter(m => m.ligue === selectedLigue).map(m => m.championnat);
    return nums.length ? Math.max(...nums) : null;
  }, [mercatoData, selectedLigue, selectedChampionnat]);

  // Effectif de chaque coach pour le championnat affiché, trié par poste
  const effectifsData = useMemo(() => {
    if (selectedLigue === 'general' || currentEffectifsChampionnat == null) return null;
    const byCoach = {};
    joueurs.forEach(j => { byCoach[j] = []; });
    (mercatoData || []).forEach(m => {
      if (m.ligue !== selectedLigue || m.championnat !== currentEffectifsChampionnat) return;
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
  }, [mercatoData, selectedLigue, currentEffectifsChampionnat, joueurs]);

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
      (m.buteurs || []).forEach(b => {
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
                setSelectedChampionnat('total');
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
          <button
            onClick={() => setLigueView('effectifs')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-lg border ${ligueView === 'effectifs' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white/80 dark:bg-white/5 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'}`}
          >
            👥 Effectifs
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

      {/* Tableau classement / stats / graphique / effectifs */}
      {selectedLigue !== 'general' && ligueView === 'effectifs' ? (
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
              return (
                <div data-card className="relative bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] overflow-hidden hover:-translate-y-0.5 transition-all duration-200 p-5">
                  <ShareBtn contextText={shareContext} />
                  {squad.length > 0 ? (
                    <FormationPitch squad={squad} onOpenPlayer={onOpenPlayer} photos={photos} />
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500">Aucun achat.</p>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">Pas de données mercato pour cette ligue.</p>
          </div>
        )
      ) : statsTable ? (
        <div data-card className="relative bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] overflow-hidden hover:-translate-y-0.5 transition-all duration-200">
          <ShareBtn contextText={shareContext} />
          {statsTable === 'buteurs' && (
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                <tr>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Buts</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Moy.</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(statsDetaillees).map(([joueur, data]) => ({ joueur, ...data })).sort((a, b) => b.buts_pour - a.buts_pour).map((player, index) => (
                  <tr key={player.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4"><div className="flex items-center gap-1 sm:gap-3"><PlayerBadge joueur={player.joueur} /><span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base">{player.joueur}</span></div></td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-green-600 dark:text-green-400 text-xs sm:text-base">{player.buts_pour}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center text-slate-700 dark:text-slate-200 text-xs sm:text-base">{player.matchs}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-blue-600 dark:text-blue-400 text-xs sm:text-base">{player.matchs > 0 ? (player.buts_pour / player.matchs).toFixed(2) : '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {statsTable === 'loosers' && (
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                <tr>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Buts enc.</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Moy.</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(statsDetaillees).map(([joueur, data]) => ({ joueur, ...data })).sort((a, b) => b.buts_contre - a.buts_contre).map((player, index) => (
                  <tr key={player.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4"><div className="flex items-center gap-1 sm:gap-3"><PlayerBadge joueur={player.joueur} /><span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base">{player.joueur}</span></div></td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-red-600 dark:text-red-400 text-xs sm:text-base">{player.buts_contre}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center text-slate-700 dark:text-slate-200 text-xs sm:text-base">{player.matchs}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-orange-600 dark:text-orange-400 text-xs sm:text-base">{player.matchs > 0 ? (player.buts_contre / player.matchs).toFixed(2) : '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {statsTable === 'cleansheets' && (
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                <tr>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">CS</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">%</th>
                </tr>
              </thead>
              <tbody>
                {[...cleanSheetsStats].sort((a, b) => b.cleanSheets - a.cleanSheets).map((player, index) => (
                  <tr key={player.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4"><div className="flex items-center gap-1 sm:gap-3"><PlayerBadge joueur={player.joueur} /><span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base">{player.joueur}</span></div></td>
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
              <table className="w-full text-xs sm:text-sm mt-2">
                <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                  <tr>
                    <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                    <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                    <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">0 but</th>
                    <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                    <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[...cleanSheetsStats].sort((a, b) => b.pannesOffensives - a.pannesOffensives).map((player, index) => (
                    <tr key={player.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4"><div className="flex items-center gap-1 sm:gap-3"><PlayerBadge joueur={player.joueur} /><span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base">{player.joueur}</span></div></td>
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
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                <tr>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Utilisées</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Reçues</th>
                </tr>
              </thead>
              <tbody>
                {joueurs.map(j => ({ joueur: j, utilisees: valiseStats[j].utilisees, recues: valiseStats[j].recues }))
                  .sort((a, b) => b.utilisees - a.utilisees || a.recues - b.recues)
                  .map((item, index) => (
                    <tr key={item.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4"><div className="flex items-center gap-1 sm:gap-3"><PlayerBadge joueur={item.joueur} /><span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base">{item.joueur}</span></div></td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-blue-600 dark:text-blue-400 text-xs sm:text-base">{item.utilisees}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-red-600 dark:text-red-400 text-xs sm:text-base">{item.recues}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {statsTable === 'valises-efficaces' && valiseStats && (
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                <tr>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-green-700 dark:text-green-400 text-xs sm:text-sm">Infligées</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-red-700 dark:text-red-400 text-xs sm:text-sm">Reçues</th>
                </tr>
              </thead>
              <tbody>
                {joueurs.map(j => ({ joueur: j, efficaces: valiseStats[j].efficaces, efficacesRecues: valiseStats[j].efficacesRecues }))
                  .sort((a, b) => b.efficaces - a.efficaces || a.efficacesRecues - b.efficacesRecues)
                  .map((item, index) => (
                    <tr key={item.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-1 py-2 sm:px-6 sm:py-4 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-4"><div className="flex items-center gap-1 sm:gap-3"><PlayerBadge joueur={item.joueur} /><span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base">{item.joueur}</span></div></td>
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
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Rang</th>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                  <th className="px-2 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 hidden md:table-cell">Matchs</th>
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
                      <div className="flex items-center gap-1 sm:gap-3">
                        {getTrophyForRow(index) || <PlayerBadge joueur={player.joueur} />}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base">{player.joueur}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 text-center text-slate-700 dark:text-slate-300 hidden md:table-cell">{player.matchs}</td>
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

      {/* Classement buteurs / CSC (joueurs mercato) */}
      {selectedLigue !== 'general' && ligueView === 'classement' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div data-card className="relative bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] overflow-hidden hover:-translate-y-0.5 transition-all duration-200">
            <ShareBtn contextText={shareContext} />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 px-6 pt-6 pb-2">⚽ Buteurs</h3>
            {buteursRanking.length > 0 ? (
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                  <tr>
                    <th className="px-1 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                    <th className="px-1 py-2 sm:px-6 sm:py-3 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                    <th className="px-1 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Buts</th>
                    <th className="px-1 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm" title="Dont buts virtuels MPG">dont 🎮</th>
                  </tr>
                </thead>
                <tbody>
                  {buteursRanking.map((p, index) => (
                    <tr key={p.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-1 py-2 sm:px-6 sm:py-3 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-3 font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base">{p.joueur}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-3 text-center font-bold text-green-600 dark:text-green-400 text-xs sm:text-base">{p.n}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-3 text-center text-indigo-600 dark:text-indigo-400 text-xs sm:text-base">{p.virtuels > 0 ? p.virtuels : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 px-6 pb-6">Aucun but marqué pour l'instant.</p>
            )}
          </div>
          <div data-card className="relative bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] overflow-hidden hover:-translate-y-0.5 transition-all duration-200">
            <ShareBtn contextText={shareContext} />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 px-6 pt-6 pb-2">🙈 CSC</h3>
            {cscRanking.length > 0 ? (
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                  <tr>
                    <th className="px-1 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                    <th className="px-1 py-2 sm:px-6 sm:py-3 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                    <th className="px-1 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">CSC</th>
                  </tr>
                </thead>
                <tbody>
                  {cscRanking.map((p, index) => (
                    <tr key={p.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                      <td className="px-1 py-2 sm:px-6 sm:py-3 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-3 font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base">{p.joueur}</td>
                      <td className="px-1 py-2 sm:px-6 sm:py-3 text-center font-bold text-orange-600 dark:text-orange-400 text-xs sm:text-base">{p.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 px-6 pb-6">Aucun CSC pour l'instant.</p>
            )}
          </div>
        </div>
      )}

      {/* Liste des matchs */}
      {selectedLigue !== 'general' && selectedChampionnat !== 'total' && matchesListForChampionnat.length > 0 && (
        <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-6 mt-6 hover:-translate-y-0.5 transition-all duration-200">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            Matchs {selectedChampionnat !== 'total' ? `du championnat ${selectedChampionnat}` : 'de tous les championnats'}
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
          <div className="space-y-2">
            {matchesListForChampionnat.map((match, index) => (
              <div key={index} className="flex flex-wrap items-center gap-1.5 sm:gap-4 p-2 sm:p-3 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors text-xs sm:text-base">
                <span className="text-slate-600 dark:text-slate-300 min-w-[70px] sm:min-w-0">
                  {match.dateMatch ? new Date(match.dateMatch).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date(match.dateEntree).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{match.joueur1}</span>
                <span className="text-sm sm:text-lg font-bold text-blue-600 dark:text-blue-400">{match.buts_j1}</span>
                <span className="text-slate-400">-</span>
                <span className="text-sm sm:text-lg font-bold text-purple-600 dark:text-purple-400">{match.buts_j2}</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{match.joueur2}</span>
                {(match.valise_j1 || match.valise_j2) && (
                  <span className="text-xs sm:text-sm">{match.valise_j1 && match.valise_j2 ? '💼💼' : '💼'}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
