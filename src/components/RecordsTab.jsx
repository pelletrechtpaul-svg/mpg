import { useState } from 'react';
import { playerColors, ShareBtn } from '../shared.jsx';

const colorText = { Paul: 'text-blue-600 dark:text-blue-400', Adrien: 'text-green-600 dark:text-green-400', Tiago: 'text-purple-600 dark:text-purple-400', Roman: 'text-orange-600 dark:text-orange-400' };
const colorBorder = { Paul: 'border-blue-200 dark:border-blue-800', Adrien: 'border-green-200 dark:border-green-800', Tiago: 'border-purple-200 dark:border-purple-800', Roman: 'border-orange-200 dark:border-orange-800' };
const colorBg = { Paul: 'bg-blue-500', Adrien: 'bg-green-500', Tiago: 'bg-purple-500', Roman: 'bg-orange-500' };

const fmt = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

function AllPlayersGrid({ data, valueKey = 'count', children }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
      {data.map(entry => (
        <div key={entry.joueur} className={`rounded-lg border-2 ${colorBorder[entry.joueur]} p-3 text-center`}>
          <div className={`text-3xl font-bold ${colorText[entry.joueur]}`}>{entry[valueKey]}</div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-1">{entry.joueur}</div>
          {children && children(entry)}
        </div>
      ))}
    </div>
  );
}

function Top3List({ entries, renderValue, renderDetail }) {
  if (!entries?.length) return null;
  const medals = ['🥇', '🥈', '🥉'];
  let rank = 0, prevScore = null;
  return (
    <div className="space-y-2 mt-2">
      {entries.map((entry, i) => {
        const score = renderValue(entry);
        if (score !== prevScore) { rank = i; prevScore = score; }
        return (
          <div key={i} className="flex items-start gap-2">
            <span className="text-base w-5 flex-shrink-0">{medals[rank] || ''}</span>
            <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${playerColors[entry.joueur || entry.champion]}`} />
            <div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{score}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">— {renderDetail(entry)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecordCard({ className = '', children, contextText }) {
  return (
    <div data-card className={`relative rounded-lg p-4 border-2 ${className}`}>
      <ShareBtn contextText={contextText} />
      {children}
    </div>
  );
}

function StreakRows({ streakData, joueurs, unit }) {
  const sorted = joueurs
    .map(j => ({ joueur: j, ...(streakData[j] || { length: 0, startDate: null, endDate: null }) }))
    .sort((a, b) => b.length - a.length);
  const medals = ['🥇', '🥈', '🥉', ''];
  let rank = 0, prevLen = null;
  return (
    <div className="space-y-2 mt-2">
      {sorted.map((entry, i) => {
        if (entry.length !== prevLen) { rank = i; prevLen = entry.length; }
        return (
          <div key={entry.joueur} className="flex items-center gap-2">
            <span className="w-5 text-base">{entry.length > 0 ? (medals[rank] || '') : ''}</span>
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`} />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{entry.joueur}</span>
              <span className={`ml-2 font-bold ${colorText[entry.joueur]}`}>{entry.length} {unit}</span>
              {entry.startDate && (
                <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">{fmt(entry.startDate)} → {fmt(entry.endDate)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RecordsTab({
  joueurs, selectedSeason,
  seasonRecords, perduUnPoint,
  ligueRecordsAllTime, ligueRecordsSeason,
}) {
  const [activeSubTab, setActiveSubTab] = useState('entraineurs');

  const ligueData = selectedSeason === 'All-Time' ? ligueRecordsAllTime : ligueRecordsSeason;

  const unbeatenCountPerPlayer = joueurs.map(j => ({
    joueur: j,
    count: seasonRecords ? (seasonRecords.unbeatenChampion || []).filter(e => e.joueur === j).length : 0,
    instances: seasonRecords ? (seasonRecords.unbeatenChampion || []).filter(e => e.joueur === j) : [],
  })).sort((a, b) => b.count - a.count);

  return (
    <>
      <div className="space-y-6">

        {/* Sub-tab navigation */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {[
            { id: 'entraineurs', label: '👤 Entraîneurs' },
            { id: 'exploits', label: '🏆 Exploits' },
            { id: 'ligues', label: '🌍 Ligues' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveSubTab(id)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeSubTab === id
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {!seasonRecords && activeSubTab !== 'ligues' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              Les records entraîneurs et exploits ne sont disponibles que par saison.
              Sélectionne une saison ou consulte l'onglet <button onClick={() => setActiveSubTab('ligues')} className="text-blue-500 underline">Ligues</button>.
            </p>
          </div>
        )}

        {/* ── ENTRAÎNEURS ── */}
        {activeSubTab === 'entraineurs' && seasonRecords && (<>

          {/* Championnats perdus de justesse */}
          {perduUnPoint && (
            <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
              <ShareBtn contextText={`Championnats perdus d'un point — ${selectedSeason}`} />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">😤 Championnats perdus de justesse</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Perdu à 1 point, au goal average ou à la différence particulière</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {joueurs.map(joueur => {
                  const count = (perduUnPoint[joueur] || []).length;
                  return (
                    <div key={joueur} className={`rounded-lg border-2 ${colorBorder[joueur]} p-3 text-center`}>
                      <div className={`text-3xl font-bold ${colorText[joueur]}`}>{count}</div>
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

          {/* Style de jeu */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">🎮 Style de jeu</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <RecordCard className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200 dark:from-teal-900/30 dark:to-cyan-900/30 dark:border-teal-700" contextText={selectedSeason}>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🔪 Roi des scores serrés</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Victoires par exactement 1 but d'écart</p>
                <AllPlayersGrid data={seasonRecords.closeWinsKing} valueKey="count" />
              </RecordCard>

              <RecordCard className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200 dark:from-red-900/30 dark:to-orange-900/30 dark:border-red-700" contextText={selectedSeason}>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">💥 Berserk</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Victoires avec 5 buts d'écart ou plus</p>
                <AllPlayersGrid data={seasonRecords.berserkKing} valueKey="count" />
              </RecordCard>

              <RecordCard className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200 dark:from-violet-900/30 dark:to-purple-900/30 dark:border-violet-700" contextText={selectedSeason}>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🎯 Clutch</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Championnats gagnés avec exactement 1 point d'écart</p>
                <AllPlayersGrid data={seasonRecords.clutchChampion} valueKey="count" />
              </RecordCard>

              <RecordCard className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/30 dark:to-indigo-900/30 dark:border-blue-700" contextText={selectedSeason}>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🛡️ Titres remportés sans défaite</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Championnats gagnés sans perdre un seul match</p>
                <AllPlayersGrid data={unbeatenCountPerPlayer} valueKey="count">
                  {entry => entry.instances.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {entry.instances.map((inst, i) => (
                        <div key={i} className="text-xs text-slate-400 dark:text-slate-500">{inst.ligue} #{inst.championnat} · {inst.saison}</div>
                      ))}
                    </div>
                  )}
                </AllPlayersGrid>
              </RecordCard>

            </div>
          </div>

          {/* Séries remarquables */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">📊 Séries remarquables</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'longestWinStreak', label: '🏆 Plus longue série de victoires', color: 'from-green-50 to-green-100 border-green-200', unit: 'victoires' },
                { key: 'longestUnbeatenStreak', label: '🛡️ Plus longue série sans défaite', color: 'from-blue-50 to-blue-100 border-blue-200', unit: 'matchs' },
                { key: 'longestLossStreak', label: '💔 Plus longue série de défaites', color: 'from-red-50 to-red-100 border-red-200', unit: 'défaites' },
                { key: 'longestDrawStreak', label: '🤝 Plus longue série de nuls', color: 'from-slate-50 to-slate-100 border-slate-200', unit: 'nuls' },
                { key: 'longestGoalDrought', label: '🚫 Plus longue disette offensive', color: 'from-amber-50 to-amber-100 border-amber-200', unit: 'matchs sans marquer' },
                { key: 'longestCleanSheetStreak', label: '🧤 Plus longue série sans encaisser', color: 'from-teal-50 to-teal-100 border-teal-200', unit: 'clean sheets' },
              ].map(({ key, label, color, unit }) => (
                <div key={key} data-card className={`relative bg-gradient-to-br ${color} dark:from-slate-700/40 dark:to-slate-700/40 dark:border-slate-600 rounded-lg p-4 border-2`}>
                  <ShareBtn contextText={selectedSeason} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">{label}</h3>
                  <StreakRows streakData={seasonRecords[key]} joueurs={joueurs} unit={unit} />
                </div>
              ))}

              <div data-card className="relative bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200 dark:from-amber-900/30 dark:to-orange-900/30 dark:border-amber-700 rounded-lg p-4 border-2">
                <ShareBtn contextText={selectedSeason} />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">⚔️ Meilleure série en face-à-face</h3>
                <div className="space-y-2">
                  {joueurs.map(j => {
                    const best = seasonRecords.bestH2HStreak[j];
                    return (
                      <div key={j} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[j]}`} />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 w-14">{j}</span>
                        {best ? (
                          <>
                            <span className={`font-bold ${colorText[j]}`}>{best.length} victoires</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">vs {best.adversaire}</span>
                          </>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Régularité */}
          {seasonRecords.allPlayerStdDevs.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">📈 Régularité des scores</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Du plus constant au plus imprévisible — basé sur l'écart-type des différences de buts</p>
              <div data-card className="relative">
                <ShareBtn contextText={selectedSeason} />
                {(() => {
                  const players = seasonRecords.allPlayerStdDevs;
                  const maxStd = players[players.length - 1]?.stdDev || 1;
                  const labels = ['🎖️ Très régulier', '✅ Régulier', '🎲 Variable', '🌪️ Imprévisible'];
                  return players.map((entry, i) => (
                    <div key={entry.joueur} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                      <span className="text-base w-6">{['🥇', '🥈', '🥉', '4️⃣'][i] || ''}</span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 w-16">{entry.joueur}</span>
                      <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-4 rounded-full ${colorBg[entry.joueur]}`}
                          style={{ width: `${(entry.stdDev / maxStd) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 w-8 font-mono">{entry.stdDev.toFixed(1)}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block w-32">{labels[i]}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </>)}

        {/* ── EXPLOITS ── */}
        {activeSubTab === 'exploits' && seasonRecords && (
          <div className="space-y-6">

            {/* Records de match */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">⚽ Records de match</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {seasonRecords.mostGoalsInMatch.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 dark:from-green-900/30 dark:to-emerald-900/30 dark:border-green-700" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🎯 Plus de buts dans un match</h3>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{seasonRecords.mostGoalsInMatch[0].buts} buts</p>
                    <Top3List
                      entries={seasonRecords.mostGoalsInMatch}
                      renderValue={e => `${e.buts} buts`}
                      renderDetail={e => `${e.joueur} vs ${e.adversaire} (${e.buts}-${e.butsAdv}) · ${fmt(e.date)} · ${e.ligue} ${e.championnat}`}
                    />
                  </RecordCard>
                )}

                {seasonRecords.biggestWinMargin.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/30 dark:to-indigo-900/30 dark:border-blue-700" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">💪 Plus grosse victoire</h3>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">+{seasonRecords.biggestWinMargin[0].margin} buts</p>
                    <Top3List
                      entries={seasonRecords.biggestWinMargin}
                      renderValue={e => `+${e.margin} buts`}
                      renderDetail={e => `${e.joueur} ${e.score} vs ${e.adversaire} · ${fmt(e.date)} · ${e.ligue} ${e.championnat}`}
                    />
                  </RecordCard>
                )}

                {seasonRecords.mostProlificMatch.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 dark:from-orange-900/30 dark:border-orange-700" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🔥 Match le plus prolifique</h3>
                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{seasonRecords.mostProlificMatch[0].totalGoals} buts</p>
                    <Top3List
                      entries={seasonRecords.mostProlificMatch}
                      renderValue={e => `${e.totalGoals} buts`}
                      renderDetail={e => `${e.joueur1} vs ${e.joueur2} (${e.score}) · ${fmt(e.date)} · ${e.ligue} ${e.championnat}`}
                    />
                  </RecordCard>
                )}

                {seasonRecords.mostProlificDraw.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-slate-50 to-zinc-50 border-slate-300 dark:from-slate-700/50 dark:border-slate-600" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🤝 Nul le plus prolifique</h3>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{seasonRecords.mostProlificDraw[0].totalGoals} buts</p>
                    <Top3List
                      entries={seasonRecords.mostProlificDraw}
                      renderValue={e => `${e.totalGoals} buts`}
                      renderDetail={e => `${e.joueur1} vs ${e.joueur2} (${e.score}) · ${fmt(e.date)} · ${e.ligue} ${e.championnat}`}
                    />
                  </RecordCard>
                )}
              </div>
            </div>

            {/* Records de championnat */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">🏆 Records de championnat</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Championnats à 6 matchs uniquement</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {seasonRecords.mostGoalsInChampionship.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-green-50 to-emerald-100 border-green-200 dark:from-green-900/30 dark:border-green-700" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">⚽ Plus de buts en 1 championnat</h3>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{seasonRecords.mostGoalsInChampionship[0].goals} buts</p>
                    <Top3List
                      entries={seasonRecords.mostGoalsInChampionship}
                      renderValue={e => `${e.goals} buts`}
                      renderDetail={e => `${e.joueur} · ${e.ligue} ${e.championnat} · ${e.saison}`}
                    />
                  </RecordCard>
                )}

                {seasonRecords.mostConcededInChampionship.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-red-50 to-rose-100 border-red-200 dark:from-red-900/30 dark:border-red-700" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🥅 Plus de buts encaissés en 1 championnat</h3>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">{seasonRecords.mostConcededInChampionship[0].goals} buts</p>
                    <Top3List
                      entries={seasonRecords.mostConcededInChampionship}
                      renderValue={e => `${e.goals} buts`}
                      renderDetail={e => `${e.joueur} · ${e.ligue} ${e.championnat} · ${e.saison}`}
                    />
                  </RecordCard>
                )}

                {seasonRecords.bestGAChampionship.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200 dark:from-emerald-900/30 dark:border-emerald-700" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">📈 Meilleur goal average en 1 championnat</h3>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">+{seasonRecords.bestGAChampionship[0].ga}</p>
                    <Top3List
                      entries={seasonRecords.bestGAChampionship}
                      renderValue={e => `${e.ga > 0 ? '+' : ''}${e.ga}`}
                      renderDetail={e => `${e.joueur} · ${e.ligue} ${e.championnat} · ${e.saison}`}
                    />
                  </RecordCard>
                )}

                {seasonRecords.worstGAChampionship.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-rose-50 to-red-100 border-rose-200 dark:from-rose-900/30 dark:border-rose-700" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">📉 Pire goal average en 1 championnat</h3>
                    <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">{seasonRecords.worstGAChampionship[0].ga}</p>
                    <Top3List
                      entries={seasonRecords.worstGAChampionship}
                      renderValue={e => `${e.ga}`}
                      renderDetail={e => `${e.joueur} · ${e.ligue} ${e.championnat} · ${e.saison}`}
                    />
                  </RecordCard>
                )}

                {seasonRecords.tightestChampionship.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-slate-50 to-zinc-50 border-slate-200 dark:from-slate-700/50 dark:border-slate-600" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🎯 Championnat le plus serré</h3>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-200 font-mono">σ = {seasonRecords.tightestChampionship[0].sigma}</p>
                    <div className="space-y-3 mt-2">
                      {seasonRecords.tightestChampionship.map((entry, i) => (
                        <div key={i} className={i > 0 ? 'pt-2 border-t border-slate-200 dark:border-slate-700' : ''}>
                          {['🥇', '🥈', '🥉'][i] && <span className="text-sm">{['🥇', '🥈', '🥉'][i]} </span>}
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{entry.ligue} #{entry.championnat} · {entry.saison} · σ={entry.sigma}</span>
                          <div className="mt-1">
                            {entry.ranking.map((p, j) => (
                              <div key={j} className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${playerColors[p.joueur]}`} />
                                <span className="text-xs text-slate-600 dark:text-slate-300">{j + 1}. <strong>{p.joueur}</strong> — {p.points} pts</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </RecordCard>
                )}

                {seasonRecords.mostExplosive.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 dark:from-orange-900/30 dark:border-orange-700" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">💥 Championnat le plus explosif</h3>
                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{seasonRecords.mostExplosive[0].totalGoals} buts</p>
                    <Top3List
                      entries={seasonRecords.mostExplosive}
                      renderValue={e => `${e.totalGoals} buts`}
                      renderDetail={e => `${e.avgGoals.toFixed(1)} buts/match · ${e.ligue} ${e.championnat} · ${e.saison}`}
                    />
                  </RecordCard>
                )}

                {seasonRecords.leastExplosive.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200 dark:from-slate-700/50 dark:border-slate-600" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🥱 Championnat le moins explosif</h3>
                    <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{seasonRecords.leastExplosive[0].totalGoals} buts</p>
                    <Top3List
                      entries={seasonRecords.leastExplosive}
                      renderValue={e => `${e.totalGoals} buts`}
                      renderDetail={e => `${e.avgGoals.toFixed(1)} buts/match · ${e.ligue} ${e.championnat} · ${e.saison}`}
                    />
                  </RecordCard>
                )}

                {seasonRecords.mostDrawsChampionship.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-zinc-50 to-slate-50 border-zinc-300 dark:from-zinc-800/50 dark:border-zinc-600" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🤝 Championnat avec le plus de nuls</h3>
                    <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">{seasonRecords.mostDrawsChampionship[0].count} nuls</p>
                    <Top3List
                      entries={seasonRecords.mostDrawsChampionship}
                      renderValue={e => `${e.count} nuls`}
                      renderDetail={e => `sur ${e.total} matchs (${Math.round(e.count / e.total * 100)}%) · ${e.ligue} ${e.championnat} · ${e.saison}`}
                    />
                  </RecordCard>
                )}

                {seasonRecords.perfectSeason.length > 0 ? (
                  <RecordCard className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300 dark:from-yellow-900/30 dark:border-yellow-600 md:col-span-2" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">🌟 Saison parfaite (6V/6)</h3>
                    <div className="flex flex-wrap gap-3">
                      {seasonRecords.perfectSeason.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white/60 dark:bg-slate-700/60 rounded-lg px-3 py-2">
                          <div className={`w-3 h-3 rounded-full ${playerColors[entry.joueur]}`} />
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{entry.joueur}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} #{entry.championnat} · {entry.saison}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </RecordCard>
                ) : (
                  <div className="md:col-span-2 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-dashed border-yellow-200 dark:from-yellow-900/10 dark:border-yellow-700 rounded-lg p-4 text-center">
                    <p className="text-2xl mb-1">🌟</p>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Saison parfaite (6V/6)</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Aucun joueur n'a encore réussi à remporter les 6 matchs d'un championnat</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── LIGUES ── */}
        {activeSubTab === 'ligues' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">🌍 Stats par ligue</h2>
            {!ligueData ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm">Pas assez de données pour cette période.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {[
                    {
                      label: '⚽ Ligue la plus prolifique',
                      color: 'from-green-50 to-green-100 border-green-200 dark:from-green-900/30 dark:border-green-700',
                      sorted: [...ligueData.ligues].sort((a, b) => b.avgGoals - a.avgGoals),
                      renderValue: l => `${l.avgGoals.toFixed(2)} buts/match`,
                      renderDetail: l => `${l.totalGoals} buts sur ${l.matchs} matchs`,
                      textColor: 'text-green-700 dark:text-green-400',
                    },
                    {
                      label: '🥱 Ligue la moins prolifique',
                      color: 'from-slate-50 to-slate-100 border-slate-200 dark:from-slate-700/50 dark:border-slate-600',
                      sorted: [...ligueData.ligues].sort((a, b) => a.avgGoals - b.avgGoals),
                      renderValue: l => `${l.avgGoals.toFixed(2)} buts/match`,
                      renderDetail: l => `${l.totalGoals} buts sur ${l.matchs} matchs`,
                      textColor: 'text-slate-600 dark:text-slate-300',
                    },
                    {
                      label: '🤝 Ligue avec le plus de nuls',
                      color: 'from-zinc-50 to-zinc-100 border-zinc-300 dark:from-zinc-800/50 dark:border-zinc-600',
                      sorted: [...ligueData.ligues].sort((a, b) => b.drawRate - a.drawRate),
                      renderValue: l => `${(l.drawRate * 100).toFixed(1)}%`,
                      renderDetail: l => `${l.drawCount} nuls sur ${l.matchs} matchs`,
                      textColor: 'text-zinc-700 dark:text-zinc-300',
                    },
                    {
                      label: '🧤 Ligue avec le plus de clean sheets',
                      color: 'from-teal-50 to-teal-100 border-teal-200 dark:from-teal-900/30 dark:border-teal-700',
                      sorted: [...ligueData.ligues].sort((a, b) => b.cleanSheetRate - a.cleanSheetRate),
                      renderValue: l => `${(l.cleanSheetRate * 100).toFixed(1)}%`,
                      renderDetail: l => `${l.cleanSheetCount} CS sur ${l.matchs} matchs`,
                      textColor: 'text-teal-700 dark:text-teal-400',
                    },
                    {
                      label: '🎯 Ligue la plus serrée',
                      color: 'from-blue-50 to-blue-100 border-blue-200 dark:from-blue-900/30 dark:border-blue-700',
                      sorted: [...ligueData.ligues].sort((a, b) => a.avgMargin - b.avgMargin),
                      renderValue: l => `${l.avgMargin.toFixed(2)} buts d'écart/match`,
                      renderDetail: l => `${l.matchs} matchs`,
                      textColor: 'text-blue-700 dark:text-blue-400',
                    },
                  ].map(({ label, color, sorted, renderValue, renderDetail, textColor }) => {
                    const top = sorted.slice(0, 3);
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <div key={label} data-card className={`relative bg-gradient-to-br ${color} rounded-lg p-4 border-2`}>
                        <ShareBtn contextText={selectedSeason === 'All-Time' ? 'All-Time' : selectedSeason} />
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</h3>
                        <p className={`text-2xl font-bold ${textColor} mb-2`}>{renderValue(top[0])}</p>
                        <div className="space-y-1">
                          {top.map((l, i) => (
                            <div key={l.ligue} className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm">{medals[i]}</span>
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{l.ligue}</span>
                              <span className={`text-sm font-bold ${textColor}`}>{renderValue(l)}</span>
                              <span className="text-xs text-slate-400 dark:text-slate-500">({renderDetail(l)})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
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
