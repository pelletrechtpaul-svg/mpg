import { useState } from 'react';
import { playerColors, ShareBtn } from '../shared.jsx';

export default function RecordsTab({
  joueurs, selectedSeason,
  seasonRecords, perduUnPoint,
  ligueRecordsAllTime, ligueRecordsSeason,
}) {
  const [activeSubTab, setActiveSubTab] = useState('individuels');

  const ligueData = selectedSeason === 'All-Time' ? ligueRecordsAllTime : ligueRecordsSeason;

  return (
    <>
      <div className="space-y-6">
        {/* Sub-tab navigation */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {[
            { id: 'individuels', label: '👤 Individuels', needsData: true },
            { id: 'collectifs', label: '🏆 Collectifs', needsData: true },
            { id: 'ligues', label: '🌍 Ligues', needsData: false },
          ].map(({ id, label, needsData }) => (
            <button
              key={id}
              onClick={() => { if (!needsData || seasonRecords) setActiveSubTab(id); }}
              disabled={needsData && !seasonRecords}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                needsData && !seasonRecords ? 'opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600' :
                activeSubTab === id
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Championnats perdus d'un point */}
        {perduUnPoint && (
          <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
            <ShareBtn contextText={`Championnats perdus d'un point — ${selectedSeason}`} />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">😤 Championnats perdus de justesse</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Perdu à 1 point, au goal average ou à la différence particulière</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {joueurs.map(joueur => {
                const count = (perduUnPoint[joueur] || []).length;
                const colorText = { Paul: 'text-blue-600 dark:text-blue-400', Adrien: 'text-green-600 dark:text-green-400', Tiago: 'text-purple-600 dark:text-purple-400', Roman: 'text-orange-600 dark:text-orange-400' }[joueur];
                const colorBorder = { Paul: 'border-blue-200 dark:border-blue-800', Adrien: 'border-green-200 dark:border-green-800', Tiago: 'border-purple-200 dark:border-purple-800', Roman: 'border-orange-200 dark:border-orange-800' }[joueur];
                return (
                  <div key={joueur} className={`rounded-lg border ${colorBorder} p-3 text-center`}>
                    <div className={`text-3xl font-bold ${colorText}`}>{count}</div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-1">{joueur}</div>
                    {count > 0 && (
                      <div className="mt-2 space-y-1">
                        {(perduUnPoint[joueur] || []).map((d, i) => (
                          <div key={i} className="text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-medium text-slate-600 dark:text-slate-300">{d.ligue} #{d.championnat}</span>
                            <br />
                            <span className="text-slate-400 dark:text-slate-500">vs {d.winner} · </span>
                            <span className={`font-semibold ${d.raison === '1 pt' ? 'text-red-500' : d.raison === 'goal avg' ? 'text-orange-500' : 'text-purple-500'}`}>{d.raison}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!seasonRecords && activeSubTab !== 'ligues' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              Les records individuels et collectifs ne sont disponibles que par saison.
              Sélectionne une saison ou consulte l'onglet <button onClick={() => setActiveSubTab('ligues')} className="text-blue-500 underline">Ligues</button>.
            </p>
          </div>
        )}

        {/* INDIVIDUELS */}
        {activeSubTab === 'individuels' && seasonRecords && (<>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">🏅 Records personnels</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {seasonRecords.mostGoalsInMatch.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">🎯 Plus de buts marqués dans un match</h3>
                  <p className="text-2xl font-bold text-green-700">{seasonRecords.mostGoalsInMatch[0].buts} buts</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.mostGoalsInMatch.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong> contre {entry.adversaire} ({entry.buts}-{entry.butsAdv})</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(entry.date).toLocaleDateString('fr-FR')} • {entry.ligue} {entry.championnat}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.biggestWinMargin.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">💪 Plus grosse victoire</h3>
                  <p className="text-2xl font-bold text-blue-700">+{seasonRecords.biggestWinMargin[0].margin} buts</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.biggestWinMargin.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong> {entry.score} contre {entry.adversaire}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(entry.date).toLocaleDateString('fr-FR')} • {entry.ligue} {entry.championnat}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.bestWinRatioPeak.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-4 border-2 border-purple-200">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">📈 Meilleur ratio de victoires atteint</h3>
                  <p className="text-2xl font-bold text-purple-700">{(seasonRecords.bestWinRatioPeak[0].ratio * 100).toFixed(1)}%</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.bestWinRatioPeak.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong> ({entry.wins}V sur {entry.totalMatches} matchs)</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Pic atteint le {new Date(entry.date).toLocaleDateString('fr-FR')} • min 30 matchs</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.bestCurrentWinRatio.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-cyan-50 to-sky-50 rounded-lg p-4 border-2 border-cyan-200">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">📊 Meilleur ratio de victoires actuel</h3>
                  <p className="text-2xl font-bold text-cyan-700">{(seasonRecords.bestCurrentWinRatio[0].ratio * 100).toFixed(1)}%</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.bestCurrentWinRatio.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong> ({entry.wins}V sur {entry.totalMatches} matchs)</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Ratio final sur l'ensemble de la saison</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.closeWinsKing.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg p-4 border-2 border-teal-200">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">🔪 Roi des scores serrés</h3>
                  <p className="text-2xl font-bold text-teal-700">{seasonRecords.closeWinsKing[0].count} victoires</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.closeWinsKing.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong></p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Victoires par exactement 1 but d'écart</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.berserkKing.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-4 border-2 border-red-300">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">💥 Berserk</h3>
                  <p className="text-2xl font-bold text-red-700">{seasonRecords.berserkKing[0].count} victoires</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.berserkKing.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong></p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Victoires avec 5 buts d'écart ou plus</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.clutchChampion.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg p-4 border-2 border-violet-300">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">🎯 Joueur le plus clutch</h3>
                  <p className="text-2xl font-bold text-violet-700">{seasonRecords.clutchChampion[0].count} titre{seasonRecords.clutchChampion[0].count > 1 ? 's' : ''}</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.clutchChampion.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong></p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Championnats gagnés avec exactement 1 point d'écart</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.drawSpecialist.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-700 dark:to-slate-600 rounded-lg p-4 border-2 border-slate-300 dark:border-slate-500">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🤝 Spécialiste des nuls</h3>
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{(seasonRecords.drawSpecialist[0].ratio * 100).toFixed(0)}% de nuls</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.drawSpecialist.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong></p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{entry.draws} nuls sur {entry.total} matchs</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">🏆 Records en championnat</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Championnats à 6 matchs uniquement</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { data: seasonRecords.mostGoalsInChampionship, label: '⚽ Plus de buts marqués en 1 championnat', valueKey: 'goals', color: 'green', suffix: ' buts' },
                { data: seasonRecords.mostConcededInChampionship, label: '🥅 Plus de buts encaissés en 1 championnat', valueKey: 'goals', color: 'red', suffix: ' buts' },
                { data: seasonRecords.bestGAChampionship, label: '📈 Meilleur goal average en 1 championnat', valueKey: 'ga', color: 'emerald', prefix: '+' },
                { data: seasonRecords.worstGAChampionship, label: '📉 Pire goal average en 1 championnat', valueKey: 'ga', color: 'rose' },
              ].map(({ data, label, valueKey, color, prefix = '', suffix = '' }) => data.length > 0 && (
                <div key={label} data-card className={`relative bg-gradient-to-br from-${color}-50 to-${color}-100 dark:from-${color}-900/40 dark:to-${color}-900/40 rounded-lg p-4 border-2 border-${color}-200 dark:border-${color}-700`}>
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{label}</h3>
                  <p className={`text-2xl font-bold text-${color}-700 dark:text-${color}-400`}>{prefix}{data[0][valueKey]}{suffix}</p>
                  <div className="space-y-1 mt-1">
                    {data.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur || entry.champion]}`}></div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur || entry.champion}</strong></p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {seasonRecords.biggestDomination.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/40 dark:to-amber-900/40 rounded-lg p-4 border-2 border-yellow-200 dark:border-yellow-700">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">👑 Plus grande domination en 1 championnat</h3>
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">+{seasonRecords.biggestDomination[0].gap} pts</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.biggestDomination.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.champion]}`}></div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.champion}</strong> ({entry.pointsChampion} pts) devant <strong>{entry.second}</strong> ({entry.pointsSecond} pts)</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.remontada.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/40 dark:to-blue-900/40 rounded-lg p-4 border-2 border-indigo-200 dark:border-indigo-700">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🔄 Remontada</h3>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.remontada.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{entry.joueur}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300">Dernier à mi-parcours ({entry.halfPoints} pts) → Champion ({entry.finalPoints} pts)</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.unbeatenChampion.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-700 col-span-1 md:col-span-2">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">🛡️ Titre sans défaite</h3>
                  <div className="flex flex-wrap gap-3">
                    {seasonRecords.unbeatenChampion.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white/60 dark:bg-slate-700/60 rounded-lg px-3 py-2">
                        <div className={`w-3 h-3 rounded-full ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{entry.joueur} — {entry.victoires}V {entry.nuls}N 0D</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Séries */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">📊 Séries remarquables</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'longestWinStreak', label: '🏆 Plus longue série de victoires', color: 'green', unit: 'victoires' },
                { key: 'longestUnbeatenStreak', label: '🛡️ Plus longue série sans défaite', color: 'blue', unit: 'matchs' },
                { key: 'longestLossStreak', label: '💔 Plus longue série de défaites', color: 'red', unit: 'défaites' },
                { key: 'longestDrawStreak', label: '🤝 Plus longue série de nuls', color: 'slate', unit: 'nuls' },
                { key: 'longestGoalDrought', label: '🚫 Plus longue disette offensive', color: 'amber', unit: 'matchs' },
                { key: 'longestCleanSheetStreak', label: '🧤 Plus longue série sans encaisser', color: 'teal', unit: 'matchs' },
              ].map(({ key, label, color, unit }) => {
                const streakData = seasonRecords[key];
                if (!streakData || Object.keys(streakData).length === 0) return null;
                const sorted = Object.entries(streakData).sort((a, b) => b[1].length - a[1].length);
                const maxLen = sorted[0][1].length;
                const top = sorted.filter(([, d]) => d.length === maxLen);
                return (
                  <div key={key} data-card className={`relative bg-${color}-50 rounded-lg p-4 border border-${color}-200`}>
                    <ShareBtn contextText={selectedSeason} />
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">{label}</h3>
                    <p className={`font-bold text-${color}-700 text-xl`}>{maxLen} {unit}</p>
                    <div className="space-y-1 mt-1">
                      {top.map(([joueur, data]) => (
                        <div key={joueur} className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[joueur]}`}></div>
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{joueur}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(data.startDate).toLocaleDateString('fr-FR')} → {new Date(data.endDate).toLocaleDateString('fr-FR')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {seasonRecords.bestH2HStreak.length > 0 && (
                <div data-card className="relative bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">⚔️ Plus longue série en face-à-face</h3>
                  <p className="font-bold text-amber-700 text-xl">{seasonRecords.bestH2HStreak[0].length} victoires</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.bestH2HStreak.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong> vs {entry.adversaire}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(entry.startDate).toLocaleDateString('fr-FR')} → {new Date(entry.endDate).toLocaleDateString('fr-FR')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Régularité */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">📈 Régularité</h2>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-4 py-3 mb-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
              σ(buts marqués − buts encaissés){' '}
              <span className="font-sans not-italic text-slate-400 dark:text-slate-500">— plus σ est faible, plus les scores sont stables d'un match à l'autre</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {seasonRecords.mostRegular.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/30 dark:to-violet-900/30 rounded-lg p-4 border-2 border-purple-200 dark:border-purple-700">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">📊 Joueur le plus régulier</h3>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">σ = {seasonRecords.mostRegular[0].stdDev.toFixed(2)}</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.mostRegular.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong></p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Écart-type: {entry.stdDev.toFixed(2)} • {entry.matchs} matchs</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.mostUnpredictable.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/30 dark:to-rose-900/30 rounded-lg p-4 border-2 border-pink-200 dark:border-pink-700">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🎲 Joueur le plus imprévisible</h3>
                  <p className="text-2xl font-bold text-pink-700 dark:text-pink-400">σ = {seasonRecords.mostUnpredictable[0].stdDev.toFixed(2)}</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.mostUnpredictable.map((entry, i) => (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong></p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Écart-type: {entry.stdDev.toFixed(2)} • {entry.matchs} matchs</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>)}

        {/* COLLECTIFS */}
        {activeSubTab === 'collectifs' && seasonRecords && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Championnats à 6 matchs uniquement pour les records de championnat</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {seasonRecords.mostProlificMatch.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/40 dark:to-amber-900/40 rounded-lg p-4 border-2 border-orange-200 dark:border-orange-700">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🔥 Match le plus prolifique</h3>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{seasonRecords.mostProlificMatch[0].totalGoals} buts</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.mostProlificMatch.map((entry, i) => (
                      <div key={i} className={i > 0 ? 'pt-1 border-t border-current/10' : ''}>
                        <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur1}</strong> vs <strong>{entry.joueur2}</strong> ({entry.score})</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(entry.date).toLocaleDateString('fr-FR')} • {entry.ligue} {entry.championnat}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.mostProlificDraw.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-slate-50 to-zinc-50 dark:from-slate-700/50 dark:to-zinc-700/50 rounded-lg p-4 border-2 border-slate-300 dark:border-slate-600">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🤝 Match nul le plus prolifique</h3>
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{seasonRecords.mostProlificDraw[0].totalGoals} buts</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.mostProlificDraw.map((entry, i) => (
                      <div key={i} className={i > 0 ? 'pt-1 border-t border-current/10' : ''}>
                        <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur1}</strong> vs <strong>{entry.joueur2}</strong> ({entry.score})</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(entry.date).toLocaleDateString('fr-FR')} • {entry.ligue} {entry.championnat}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.tightestChampionship.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-slate-50 to-zinc-50 dark:from-slate-700/50 dark:to-zinc-700/50 rounded-lg p-4 border-2 border-slate-200 dark:border-slate-600">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🎯 Championnat le plus serré</h3>
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-200 font-mono">σ = {seasonRecords.tightestChampionship[0].sigma}</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.tightestChampionship.map((entry, i) => (
                      <div key={i} className={i > 0 ? 'pt-1 border-t border-current/10' : ''}>
                        <div className="mt-1 space-y-0.5">
                          {entry.ranking.map((p, j) => (
                            <p key={j} className="text-xs text-slate-600 dark:text-slate-300">{j + 1}. <strong>{p.joueur}</strong> — {p.points} pts</p>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.mostExplosive.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/40 dark:to-red-900/40 rounded-lg p-4 border-2 border-orange-200 dark:border-orange-700">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">💥 Championnat le plus explosif</h3>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{seasonRecords.mostExplosive[0].totalGoals} buts</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.mostExplosive.map((entry, i) => (
                      <div key={i} className={i > 0 ? 'pt-1 border-t border-current/10' : ''}>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{entry.avgGoals.toFixed(1)} buts/match</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.leastExplosive.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-700/50 dark:to-gray-700/50 rounded-lg p-4 border-2 border-slate-200 dark:border-slate-600">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🥱 Championnat le moins explosif</h3>
                  <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{seasonRecords.leastExplosive[0].totalGoals} buts</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.leastExplosive.map((entry, i) => (
                      <div key={i} className={i > 0 ? 'pt-1 border-t border-current/10' : ''}>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{entry.avgGoals.toFixed(1)} buts/match</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.mostDrawsChampionship.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-zinc-50 to-slate-50 dark:from-zinc-800/50 dark:to-slate-800/50 rounded-lg p-4 border-2 border-zinc-300 dark:border-zinc-600">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🤝 Championnat avec le plus de nuls</h3>
                  <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">{seasonRecords.mostDrawsChampionship[0].count} nul{seasonRecords.mostDrawsChampionship[0].count > 1 ? 's' : ''}</p>
                  <div className="space-y-1 mt-1">
                    {seasonRecords.mostDrawsChampionship.map((entry, i) => (
                      <div key={i} className={i > 0 ? 'pt-1 border-t border-current/10' : ''}>
                        <p className="text-sm text-slate-600 dark:text-slate-300">sur {entry.total} matchs ({Math.round(entry.count / entry.total * 100)}%)</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {seasonRecords.perfectSeason.length > 0 && (
                <div data-card className="relative bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/40 dark:to-orange-900/40 rounded-lg p-4 border-2 border-yellow-300 dark:border-yellow-600 col-span-1 md:col-span-2">
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">🌟 Saison parfaite (6V/6)</h3>
                  <div className="flex flex-wrap gap-3">
                    {seasonRecords.perfectSeason.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white/60 dark:bg-slate-700/60 rounded-lg px-3 py-2">
                        <div className={`w-3 h-3 rounded-full ${playerColors[entry.joueur]}`}></div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{entry.joueur}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LIGUES */}
        {activeSubTab === 'ligues' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">🌍 Stats par ligue</h2>
            {!ligueData ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm">Pas assez de données pour cette période.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {[
                    { label: '⚽ Ligue la plus prolifique', data: ligueData.mostProlific, value: `${ligueData.mostProlific.avgGoals.toFixed(2)} buts/match`, detail: `${ligueData.mostProlific.totalGoals} buts sur ${ligueData.mostProlific.matchs} matchs`, color: 'green' },
                    { label: '🥱 Ligue la moins prolifique', data: ligueData.leastProlific, value: `${ligueData.leastProlific.avgGoals.toFixed(2)} buts/match`, detail: `${ligueData.leastProlific.totalGoals} buts sur ${ligueData.leastProlific.matchs} matchs`, color: 'slate' },
                    { label: '🤝 Ligue avec le plus de nuls', data: ligueData.mostDraws, value: `${(ligueData.mostDraws.drawRate * 100).toFixed(1)}%`, detail: `${ligueData.mostDraws.drawCount} nuls sur ${ligueData.mostDraws.matchs} matchs`, color: 'zinc' },
                    { label: '🧤 Ligue avec le plus de clean sheets', data: ligueData.mostCleanSheets, value: `${(ligueData.mostCleanSheets.cleanSheetRate * 100).toFixed(1)}%`, detail: `${ligueData.mostCleanSheets.cleanSheetCount} matchs avec clean sheet sur ${ligueData.mostCleanSheets.matchs}`, color: 'teal' },
                    { label: '🎯 Ligue la plus serrée', data: ligueData.tightest, value: `${ligueData.tightest.avgMargin.toFixed(2)} buts d'écart/match`, detail: `${ligueData.tightest.matchs} matchs`, color: 'blue' },
                  ].map(({ label, data, value, detail, color }) => (
                    <div key={label} data-card className={`relative bg-gradient-to-br from-${color}-50 to-${color}-100 dark:from-${color}-900/40 dark:to-${color}-900/40 rounded-lg p-4 border-2 border-${color}-200 dark:border-${color}-700`}>
                      <ShareBtn contextText={selectedSeason === 'All-Time' ? 'All-Time' : selectedSeason} />
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{label}</h3>
                      <p className={`text-2xl font-bold text-${color}-700 dark:text-${color}-400`}>{value}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">{data.ligue}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{detail}</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
                        <th className="text-left px-3 py-2 font-semibold">Ligue</th>
                        <th className="text-center px-3 py-2 font-semibold">Matchs</th>
                        <th className="text-center px-3 py-2 font-semibold">Buts/match</th>
                        <th className="text-center px-3 py-2 font-semibold">% Nuls</th>
                        <th className="text-center px-3 py-2 font-semibold">% CS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ligueData.ligues.map((l, i) => (
                        <tr key={l.ligue} className={`border-t border-slate-100 dark:border-slate-700 ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-700/20'}`}>
                          <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{l.ligue}</td>
                          <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{l.matchs}</td>
                          <td className="px-3 py-2 text-center font-mono text-slate-800 dark:text-slate-100">{l.avgGoals.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{(l.drawRate * 100).toFixed(0)}%</td>
                          <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{(l.cleanSheetRate * 100).toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
