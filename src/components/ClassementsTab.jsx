import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { Trophy, Medal } from 'lucide-react';
import { playerColors, playerColorHex, ShareBtn } from '../shared.jsx';

export default function ClassementsTab({
  joueurs, ligues, selectedSeason,
  selectedLigue, setSelectedLigue,
  selectedChampionnat, setSelectedChampionnat,
  championnatsByLigue,
  classementParLigue, statsDetaillees, cleanSheetsStats,
  valiseStats, matchesListForChampionnat,
  ligueMetadata, historicalEvolution, shareContext,
}) {
  const [rankingsView, setRankingsView] = useState('table');
  const [statsTable, setStatsTable] = useState(null);
  const [showGoalsDetail, setShowGoalsDetail] = useState(null);
  const [showChampDetail, setShowChampDetail] = useState(null);

  return (
    <>
      {/* Onglets de ligue */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-3 sm:p-6 mb-6">
        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
          <button
            onClick={() => { setSelectedLigue('general'); setSelectedChampionnat('total'); }}
            className={`px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold transition-all text-xs sm:text-base border-2 ${
              selectedLigue === 'general'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-600'
            }`}
          >
            Général
          </button>
          {ligues.map(ligue => (
            <button
              key={ligue}
              onClick={() => {
                setSelectedLigue(ligue);
                if (selectedSeason === 'All-Time') {
                  setSelectedChampionnat('total');
                } else {
                  const championnats = championnatsByLigue[ligue];
                  setSelectedChampionnat(championnats?.length > 0 ? championnats[championnats.length - 1] : 'total');
                }
              }}
              className={`px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-base ${
                selectedLigue === ligue
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {ligue}
            </button>
          ))}
        </div>

        {selectedSeason !== 'All-Time' && selectedLigue !== 'general' && championnatsByLigue[selectedLigue] && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Championnat</label>
            <select
              value={selectedChampionnat}
              onChange={(e) => setSelectedChampionnat(e.target.value)}
              className="w-full md:w-64 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="total">Total</option>
              {championnatsByLigue[selectedLigue].map((ch, i) => (
                <option key={ch} value={ch}>Championnat {i + 1} ({ch})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Toggle Tableau/Graphique */}
      {selectedLigue === 'general' && (
        <div className="mb-4 flex justify-end">
          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
            <button
              onClick={() => setRankingsView('table')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${rankingsView === 'table' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'} rounded-l-lg`}
            >
              📊 Tableau
            </button>
            <button
              onClick={() => setRankingsView('graph')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${rankingsView === 'graph' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'} rounded-r-lg`}
            >
              📈 Évolution
            </button>
          </div>
        </div>
      )}

      {/* Tableau classement */}
      {(selectedLigue !== 'general' || rankingsView === 'table') ? (
        <div data-card className="relative rounded-xl shadow-sm overflow-hidden bg-white dark:bg-slate-800">
          <ShareBtn contextText={shareContext} />
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Rang</th>
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
                  <tr key={player.joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-1 py-2 sm:px-6 sm:py-4">
                      <div className="flex items-center gap-0.5 sm:gap-2">
                        <span className="font-bold text-sm sm:text-lg text-slate-700 dark:text-slate-200">{index + 1}</span>
                        <span className="w-3 sm:w-5 flex-shrink-0">
                          {index === 0 && (() => {
                            const isComplete = selectedLigue !== 'general' && selectedChampionnat !== 'total' && (() => {
                              const ligueKey = `${selectedSeason}-${selectedLigue}-${selectedChampionnat}`;
                              const metadata = ligueMetadata[ligueKey];
                              return metadata && metadata.matchsEntered >= metadata.matchsTotal;
                            })();
                            const isGeneral20242025 = selectedLigue === 'general' && selectedSeason === '2024/2025';
                            if (isComplete || isGeneral20242025) {
                              if (isComplete && !isGeneral20242025) {
                                const metadata = ligueMetadata[`${selectedSeason}-${selectedLigue}-${selectedChampionnat}`];
                                if (metadata && metadata.matchsTotal < 6) return <Medal className="w-3 h-3 sm:w-5 sm:h-5 text-yellow-500" />;
                              }
                              return <Trophy className="w-3 h-3 sm:w-5 sm:h-5 text-yellow-500" />;
                            }
                            return null;
                          })()}
                        </span>
                      </div>
                    </td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4">
                      <div className="flex items-center gap-1 sm:gap-3">
                        <div className={`w-1.5 h-1.5 sm:w-3 sm:h-3 rounded-full ${playerColors[player.joueur] || 'bg-gray-600'}`}></div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base">{player.joueur}</span>
                        {index === 0 && (() => {
                          const flagIcons = { Paul: '🇫🇷', Adrien: '🇲🇨', Roman: '🇵🇱', Tiago: '🇧🇷' };
                          const flag = flagIcons[player.joueur];
                          return flag ? <span className="text-sm sm:text-base ml-1">{flag}</span> : null;
                        })()}
                      </div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 text-center text-slate-700 hidden md:table-cell">{player.matchs}</td>
                    <td className="px-0.5 py-2 sm:px-4 sm:py-4 text-center text-green-600 font-semibold text-xs sm:text-base">{player.victoires}</td>
                    <td className="px-0.5 py-2 sm:px-4 sm:py-4 text-center text-slate-600 text-xs sm:text-base">{player.nuls}</td>
                    <td className="px-0.5 py-2 sm:px-4 sm:py-4 text-center text-red-600 font-semibold text-xs sm:text-base">{player.defaites}</td>
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center">
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        <span className={`font-bold ${player.ga >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {player.ga > 0 ? '+' : ''}{player.ga}
                        </span>
                        <button onClick={() => setShowGoalsDetail(player)} className="text-blue-600 hover:text-blue-800 font-bold text-sm sm:text-lg">+</button>
                      </div>
                    </td>
                    {(selectedChampionnat === 'total' || selectedLigue === 'general') && (
                      <>
                        <td className="px-0.5 py-2 sm:px-6 sm:py-4 text-center">
                          <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                            <span className="font-semibold text-yellow-600 text-xs sm:text-base">{player.victoiresChampionnat || 0}</span>
                            {selectedLigue === 'general' && (player.victoiresChampionnat || 0) > 0 && (
                              <button onClick={() => setShowChampDetail({ joueur: player.joueur, type: 'titres', ligues: player.victoiresLigues || [] })} className="text-blue-600 hover:text-blue-800 font-bold text-xs sm:text-sm leading-none">+</button>
                            )}
                          </div>
                        </td>
                        <td className="px-0 py-2 sm:px-6 sm:py-4 text-center">
                          <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                            <span className="font-semibold text-slate-500 text-xs sm:text-base">{player.medaillesChampionnat || 0}</span>
                            {selectedLigue === 'general' && (player.medaillesChampionnat || 0) > 0 && (
                              <button onClick={() => setShowChampDetail({ joueur: player.joueur, type: 'medailles', ligues: player.medaillesLigues || [] })} className="text-blue-600 hover:text-blue-800 font-bold text-xs sm:text-sm leading-none">+</button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                    <td className="px-1 py-2 sm:px-6 sm:py-4 text-center">
                      <span className="text-sm sm:text-xl font-bold text-blue-600">
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
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-0 sm:p-6">
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
            <div className="text-center text-slate-600 py-12"><p>Pas assez de données pour afficher l'évolution</p></div>
          )}
        </div>
      )}

      {/* Popup détails buts */}
      {showGoalsDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowGoalsDetail(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800">{showGoalsDetail.joueur}</h3>
              <button onClick={() => setShowGoalsDetail(null)} className="text-slate-600 hover:text-slate-800 dark:hover:text-slate-100">✕</button>
            </div>
            <div className="space-y-3">
              <div className="flex flex-col items-center p-3 bg-green-50 rounded-lg">
                <span className="text-slate-700 font-medium mb-2">Buts inscrits</span>
                <span className="text-2xl font-bold text-green-600">{showGoalsDetail.buts_pour}</span>
              </div>
              <div className="flex flex-col items-center p-3 bg-red-50 rounded-lg">
                <span className="text-slate-700 font-medium mb-2">Buts encaissés</span>
                <span className="text-2xl font-bold text-red-600">{showGoalsDetail.buts_contre}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup détail titres / médailles */}
      {showChampDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowChampDetail(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 max-w-xs w-full mx-4" onClick={(e) => e.stopPropagation()}>
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

      {/* Stats globales + Valises */}
      {selectedLigue === 'general' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'buteurs', label: '⚽ Buteurs' },
              { key: 'loosers', label: '🥅 Loosers' },
              { key: 'cleansheets', label: '🧤 Clean sheets' },
              { key: 'pannes', label: '🚫 Pannes offensives' },
              ...(valiseStats ? [
                { key: 'valises', label: '💼 Valises' },
                { key: 'valises-efficaces', label: '🎯 Valises efficaces' },
              ] : []),
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatsTable(statsTable === key ? null : key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  statsTable === key
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {statsTable === 'buteurs' && (
            <div data-card className="relative mt-4">
              <ShareBtn contextText={shareContext} />
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs w-8">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs">Joueur</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs">Buts</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs">MJ</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs">Moy.</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statsDetaillees).map(([joueur, data]) => ({ joueur, ...data })).sort((a, b) => b.buts_pour - a.buts_pour).map((player, index) => (
                    <tr key={player.joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200 text-sm">{index + 1}</td>
                      <td className="px-3 py-2"><div className="flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${playerColors[player.joueur] || 'bg-gray-600'}`}></div><span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{player.joueur}</span></div></td>
                      <td className="px-3 py-2 text-center font-bold text-green-600">{player.buts_pour}</td>
                      <td className="px-3 py-2 text-center text-sm text-slate-700 dark:text-slate-200">{player.matchs}</td>
                      <td className="px-3 py-2 text-center font-semibold text-blue-600 text-sm">{player.matchs > 0 ? (player.buts_pour / player.matchs).toFixed(2) : '0.00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {statsTable === 'loosers' && (
            <div data-card className="relative mt-4">
              <ShareBtn contextText={shareContext} />
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs w-8">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs">Joueur</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs">Buts enc.</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs">MJ</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs">Moy.</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statsDetaillees).map(([joueur, data]) => ({ joueur, ...data })).sort((a, b) => b.buts_contre - a.buts_contre).map((player, index) => (
                    <tr key={player.joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200 text-sm">{index + 1}</td>
                      <td className="px-3 py-2"><div className="flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${playerColors[player.joueur] || 'bg-gray-600'}`}></div><span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{player.joueur}</span></div></td>
                      <td className="px-3 py-2 text-center font-bold text-red-600">{player.buts_contre}</td>
                      <td className="px-3 py-2 text-center text-sm text-slate-700 dark:text-slate-200">{player.matchs}</td>
                      <td className="px-3 py-2 text-center font-semibold text-orange-600 text-sm">{player.matchs > 0 ? (player.buts_contre / player.matchs).toFixed(2) : '0.00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {statsTable === 'cleansheets' && (
            <div data-card className="relative mt-4">
              <ShareBtn contextText={shareContext} />
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs w-8">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs">Joueur</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs">CS</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs">MJ</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[...cleanSheetsStats].sort((a, b) => b.cleanSheets - a.cleanSheets).map((player, index) => (
                    <tr key={player.joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200 text-sm">{index + 1}</td>
                      <td className="px-3 py-2"><div className="flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${playerColors[player.joueur] || 'bg-gray-600'}`}></div><span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{player.joueur}</span></div></td>
                      <td className="px-3 py-2 text-center font-bold text-sky-600">{player.cleanSheets}</td>
                      <td className="px-3 py-2 text-center text-sm text-slate-700 dark:text-slate-200">{player.matchs}</td>
                      <td className="px-3 py-2 text-center font-semibold text-blue-600 text-sm">{player.matchs > 0 ? ((player.cleanSheets / player.matchs) * 100).toFixed(0) : '0'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {statsTable === 'pannes' && (
            <div data-card className="relative mt-4">
              <ShareBtn contextText={shareContext} />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 mb-2">Matchs sans marquer le moindre but</p>
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs w-8">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs">Joueur</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs">0 but</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs">MJ</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[...cleanSheetsStats].sort((a, b) => b.pannesOffensives - a.pannesOffensives).map((player, index) => (
                    <tr key={player.joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200 text-sm">{index + 1}</td>
                      <td className="px-3 py-2"><div className="flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${playerColors[player.joueur] || 'bg-gray-600'}`}></div><span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{player.joueur}</span></div></td>
                      <td className="px-3 py-2 text-center font-bold text-orange-600">{player.pannesOffensives}</td>
                      <td className="px-3 py-2 text-center text-sm text-slate-700 dark:text-slate-200">{player.matchs}</td>
                      <td className="px-3 py-2 text-center font-semibold text-red-500 text-sm">{player.matchs > 0 ? ((player.pannesOffensives / player.matchs) * 100).toFixed(0) : '0'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {statsTable === 'valises' && valiseStats && (
            <div data-card className="relative mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <ShareBtn contextText={shareContext} />
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Joueur</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200">Utilisées</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200">Reçues</th>
                  </tr>
                </thead>
                <tbody>
                  {joueurs.map(joueur => (
                    <tr key={joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="px-3 py-2"><div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${playerColors[joueur] || 'bg-gray-600'}`}></div><span className="font-semibold text-slate-800 dark:text-slate-100">{joueur}</span></div></td>
                      <td className="px-3 py-2 text-center font-bold text-blue-600">{valiseStats[joueur].utilisees}</td>
                      <td className="px-3 py-2 text-center font-bold text-red-600">{valiseStats[joueur].recues}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {statsTable === 'valises-efficaces' && valiseStats && (
            <div data-card className="relative mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <ShareBtn contextText={shareContext} />
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 w-6">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Joueur</th>
                    <th className="px-3 py-2 text-center font-semibold text-green-700 dark:text-green-400">Infligées</th>
                    <th className="px-3 py-2 text-center font-semibold text-red-700 dark:text-red-400">Reçues</th>
                  </tr>
                </thead>
                <tbody>
                  {joueurs.map(j => ({ joueur: j, efficaces: valiseStats[j].efficaces, efficacesRecues: valiseStats[j].efficacesRecues }))
                    .sort((a, b) => b.efficaces - a.efficaces || a.efficacesRecues - b.efficacesRecues)
                    .map((item, index) => (
                      <tr key={item.joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200 text-sm">{index + 1}</td>
                        <td className="px-3 py-2"><div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${playerColors[item.joueur] || 'bg-gray-600'}`}></div><span className="font-semibold text-slate-800 dark:text-slate-100">{item.joueur}</span></div></td>
                        <td className="px-3 py-2 text-center font-bold text-green-600">{item.efficaces}</td>
                        <td className="px-3 py-2 text-center font-bold text-red-500">{item.efficacesRecues}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Liste des matchs */}
      {selectedLigue !== 'general' && selectedChampionnat !== 'total' && matchesListForChampionnat.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 mt-6">
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
                <span className="text-slate-600 min-w-[70px] sm:min-w-0">
                  {match.dateMatch ? new Date(match.dateMatch).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date(match.dateEntree).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
                <span className="font-medium text-slate-800">{match.joueur1}</span>
                <span className="text-sm sm:text-lg font-bold text-blue-600">{match.buts_j1}</span>
                <span className="text-slate-400">-</span>
                <span className="text-sm sm:text-lg font-bold text-purple-600">{match.buts_j2}</span>
                <span className="font-medium text-slate-800">{match.joueur2}</span>
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
