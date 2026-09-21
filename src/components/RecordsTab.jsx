import { useState } from 'react';
import { playerColors, playerColorText, playerColorBorder, ShareBtn, hasDetailedData } from '../shared.jsx';

// Couleurs par coach dérivées de la source unique dans shared.jsx.
const colorText = playerColorText;
const colorBorder = playerColorBorder;
const colorBg = playerColors;

// Couleurs par grande famille de poste (records mercato "par poste") -
// mêmes familles chromatiques que POSTE_COLORS dans JoueursTab.jsx
// (gardien/jaune, défenseur/bleu, milieu/vert, attaquant/rouge) pour rester
// cohérent avec le reste de l'appli, en version texte plutôt que badge.
const POSTE_GROUP_COLORS = {
  Gardiens: 'text-yellow-600 dark:text-yellow-400',
  Défenseurs: 'text-blue-600 dark:text-blue-400',
  Milieux: 'text-emerald-600 dark:text-emerald-400',
  Attaquants: 'text-red-600 dark:text-red-400',
};
const posteGroupColor = poste => POSTE_GROUP_COLORS[poste] || 'text-violet-600 dark:text-violet-400';

const fmt = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

// Rang façon Records > Mercato : "1." / "2." / ... et rien du tout (label
// vide) au lieu de répéter un rang déjà attribué à la même valeur juste
// au-dessus — l'alignement fixe de RankBadge fait que le nom/la pastille se
// retrouvent alignés sur ceux de l'entrée ex-aequo au-dessus.
function withRankLabels(items, scoreFn) {
  return items.map((item, i) => ({
    item,
    label: i > 0 && scoreFn(item) === scoreFn(items[i - 1]) ? '' : `${i + 1}.`,
  }));
}

// Largeur fixe : que le label soit "1.", "12." ou vide (ex-aequo), tout ce
// qui suit (pastille + nom) démarre exactement au même endroit.
function RankBadge({ label, className = '' }) {
  return <span className={`inline-block w-8 flex-shrink-0 text-xs font-bold text-slate-400 dark:text-slate-500 ${className}`}>{label}</span>;
}

function AllPlayersGrid({ data, valueKey = 'count', valueClassName = 'text-3xl font-bold', children }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
      {data.map(entry => (
        <div key={entry.joueur} className={`rounded-lg border-2 ${colorBorder[entry.joueur]} p-3 text-center`}>
          <div className={`${valueClassName} ${colorText[entry.joueur]}`}>{entry[valueKey]}</div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-1">{entry.joueur}</div>
          {children && children(entry)}
        </div>
      ))}
    </div>
  );
}

// Liste classée façon Records > Mercato, pour les records par entraîneur
// (remplace les grilles de tuiles AllPlayersGrid dans Style de jeu / Étude
// de banc) : rang numéroté + ex-aequo, pastille couleur, valeur, détail
// optionnel sur une ligne à part.
function CoachRankList({ data, valueKey = 'count', unit = '', renderExtra }) {
  const sorted = [...data].sort((a, b) => b[valueKey] - a[valueKey]);
  const ranked = withRankLabels(sorted, e => e[valueKey]);
  return (
    <div className="space-y-1.5 mt-2">
      {ranked.map(({ item: entry, label }) => (
        <div key={entry.joueur} className="text-sm">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <RankBadge label={label} />
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`} />
            <span className="font-semibold text-slate-700 dark:text-slate-200">{entry.joueur}</span>
            <span className={`font-bold ${colorText[entry.joueur]}`}>{entry[valueKey]}{unit}</span>
          </div>
          {renderExtra && renderExtra(entry)}
        </div>
      ))}
    </div>
  );
}

function Top3List({ entries, renderValue, renderDetail }) {
  if (!entries?.length) return null;
  const ranked = withRankLabels(entries, renderValue);
  return (
    <div className="space-y-2 mt-2">
      {ranked.map(({ item: entry, label }, i) => (
        <div key={i} className="text-sm">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <RankBadge label={label} />
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${playerColors[entry.joueur || entry.champion]}`} />
            <span className="font-semibold text-slate-700 dark:text-slate-200">{renderValue(entry)}</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{renderDetail(entry)}</div>
        </div>
      ))}
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
  const ranked = withRankLabels(sorted, e => e.length);
  return (
    <div className="space-y-2 mt-2">
      {ranked.map(({ item: entry, label }) => (
        <div key={entry.joueur} className="flex items-center gap-2">
          <span className="w-14 flex-shrink-0"><RankBadge label={entry.length > 0 ? label : ''} /></span>
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`} />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{entry.joueur}</span>
            <span className={`ml-2 font-bold ${colorText[entry.joueur]}`}>{entry.length} {unit}</span>
            {entry.startDate && (
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">{fmt(entry.startDate)} → {fmt(entry.endDate)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RecordsTab({
  joueurs, selectedSeason,
  seasonRecords, perduUnPoint,
  ligueRecordsAllTime, ligueRecordsSeason,
  mercatoRecordsSeason,
}) {
  const [activeSubTab, setActiveSubTab] = useState('entraineurs');
  const [bigTransferThreshold, setBigTransferThreshold] = useState(80);

  const ligueData = selectedSeason === 'All-Time' ? ligueRecordsAllTime : ligueRecordsSeason;
  // mercatoRecordsSeason est déjà null tant qu'une saison sans mercato importé
  // (y compris All-Time, qui les mélange toutes) fait partie de la période.
  const mercatoData = mercatoRecordsSeason;

  const unbeatenCountPerPlayer = joueurs.map(j => ({
    joueur: j,
    count: seasonRecords ? (seasonRecords.unbeatenChampion || []).filter(e => e.joueur === j).length : 0,
    instances: seasonRecords ? (seasonRecords.unbeatenChampion || []).filter(e => e.joueur === j) : [],
  })).sort((a, b) => b.count - a.count);

  const perduDeJustesseList = joueurs.map(j => ({
    joueur: j,
    count: (perduUnPoint?.[j] || []).length,
    details: perduUnPoint?.[j] || [],
  }));

  return (
    <>
      <div className="space-y-6">

        {/* Sub-tab navigation */}
        <div className="flex gap-1 bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-1 border border-indigo-100 dark:border-[#2d2b5e] max-w-xl">
          {[
            { id: 'entraineurs', label: '👤 Entraîneurs' },
            { id: 'exploits', label: '🏆 Exploits' },
            { id: 'ligues', label: '🌍 Ligues' },
            { id: 'mercato', label: '💰 Mercato' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveSubTab(id)}
              className={`flex-1 px-1 sm:px-4 py-1.5 sm:py-2 rounded-xl font-medium text-[11px] sm:text-base text-center whitespace-nowrap transition-all ${
                activeSubTab === id
                  ? 'bg-purple-400 text-white shadow'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {!seasonRecords && activeSubTab !== 'ligues' && activeSubTab !== 'mercato' && (
          <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] transition-all duration-200 p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              Les records entraîneurs et exploits ne sont disponibles que par saison.
              Sélectionne une saison ou consulte l'onglet <button onClick={() => setActiveSubTab('ligues')} className="text-blue-500 underline">Ligues</button>.
            </p>
          </div>
        )}

        {/* ── ENTRAÎNEURS ── */}
        {activeSubTab === 'entraineurs' && seasonRecords && (<>

          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">Trop en avance pour leur demander l'heure</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">

            {/* Style de jeu (+ championnats perdus de justesse) */}
            <RecordCard className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200 dark:from-teal-900/30 dark:to-cyan-900/30 dark:border-teal-700" contextText={selectedSeason}>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3 text-center">🎮 Style de jeu</h3>

              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🔪 Roi des scores serrés</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Victoires par exactement 1 but d'écart</p>
              <CoachRankList data={seasonRecords.closeWinsKing} valueKey="count" />

              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-teal-200 dark:border-teal-800">💥 Berserk</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Victoires avec 5 buts d'écart ou plus</p>
              <CoachRankList data={seasonRecords.berserkKing} valueKey="count" />

              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-teal-200 dark:border-teal-800">🎯 Clutch</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Championnats gagnés avec exactement 1 point d'écart</p>
              <CoachRankList data={seasonRecords.clutchChampion} valueKey="count" />

              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-teal-200 dark:border-teal-800">🛡️ Titres remportés sans défaite</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Championnats gagnés sans perdre un seul match</p>
              <CoachRankList data={unbeatenCountPerPlayer} valueKey="count" renderExtra={entry => entry.instances.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {entry.instances.map((inst, i) => (
                    <div key={i} className="text-xs text-slate-400 dark:text-slate-500">{inst.ligue} #{inst.championnat} · {inst.saison}</div>
                  ))}
                </div>
              )} />

              {perduUnPoint && (
                <>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-teal-200 dark:border-teal-800">😤 Championnats perdus de justesse</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Perdu à 1 point, au goal average ou à la différence particulière</p>
                  <CoachRankList data={perduDeJustesseList} valueKey="count" renderExtra={entry => entry.details.length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {entry.details.map((d, i) => (
                        <div key={i} className="text-xs text-slate-400 dark:text-slate-500">
                          {d.ligue} #{d.championnat} vs {d.winner} · <span className={d.raison === '1 pt' ? 'text-red-500' : d.raison === 'goal avg' ? 'text-orange-500' : 'text-purple-500'}>{d.raison}</span>
                        </div>
                      ))}
                    </div>
                  )} />
                </>
              )}
            </RecordCard>

            {/* Étude de banc — nécessite les notes/buteurs par match, pas
                saisis sur 2024/2025 et 2025/2026 (ni sur All-Time, qui les
                mélange) */}
            {hasDetailedData(selectedSeason) && (
              <RecordCard className="bg-gradient-to-br from-fuchsia-50 to-purple-50 border-fuchsia-200 dark:from-fuchsia-900/30 dark:to-purple-900/30 dark:border-fuchsia-700" contextText={selectedSeason}>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3 text-center">🎲 Étude de banc</h3>

                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🎲 Rotaldinho</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Titulaires absents non remplacés (rotaldos subis)</p>
                <CoachRankList data={seasonRecords.rotaldoKing} valueKey="count" />

                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-fuchsia-200 dark:border-fuchsia-800">🪑⚽ Buts gâchés sur le banc</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Buts marqués par des joueurs restés sur le banc - ne comptent pas</p>
                <CoachRankList data={seasonRecords.benchGoalsKing} valueKey="count" />

                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-fuchsia-200 dark:border-fuchsia-800">🙈 CSC</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Buts contre son camp inscrits par les recrues de chaque entraîneur</p>
                <CoachRankList data={seasonRecords.cscKing} valueKey="count" />

                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-fuchsia-200 dark:border-fuchsia-800">⭐ Banc vs titulaire</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Écart entre la note moyenne des joueurs qui ont compté et celle des joueurs restés sur le banc (min. 3 notes banc)</p>
                {seasonRecords.benchVsCompteAvg.length > 0 ? (
                  <div className="space-y-1.5 mt-2">
                    {withRankLabels(seasonRecords.benchVsCompteAvg, e => e.diff).map(({ item: e, label }) => (
                      <div key={e.joueur} className="flex items-center gap-2">
                        <RankBadge label={label} />
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${playerColors[e.joueur]}`} />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 w-16">{e.joueur}</span>
                        <span className={`font-bold ${e.diff <= 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {e.diff >= 0 ? '+' : ''}{e.diff.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">Pas encore assez de données.</p>
                )}
              </RecordCard>
            )}

            {/* Séries remarquables */}
            <RecordCard className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 dark:from-green-900/30 dark:to-emerald-900/30 dark:border-green-700" contextText={selectedSeason}>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3 text-center">🔥 Séries offensives</h3>

              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🏆 Plus longue série de victoires</h4>
              <StreakRows streakData={seasonRecords.longestWinStreak} joueurs={joueurs} unit="victoires" />

              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-green-200 dark:border-green-800">🛡️ Plus longue série sans défaite</h4>
              <StreakRows streakData={seasonRecords.longestUnbeatenStreak} joueurs={joueurs} unit="matchs" />

              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-green-200 dark:border-green-800">🧤 Plus longue série sans encaisser</h4>
              <StreakRows streakData={seasonRecords.longestCleanSheetStreak} joueurs={joueurs} unit="clean sheets" />
            </RecordCard>

            <RecordCard className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200 dark:from-red-900/30 dark:to-rose-900/30 dark:border-red-700" contextText={selectedSeason}>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3 text-center">🥶 Séries à oublier</h3>

              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">💔 Plus longue série de défaites</h4>
              <StreakRows streakData={seasonRecords.longestLossStreak} joueurs={joueurs} unit="défaites" />

              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-red-200 dark:border-red-800">🤝 Plus longue série de nuls</h4>
              <StreakRows streakData={seasonRecords.longestDrawStreak} joueurs={joueurs} unit="nuls" />

              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-red-200 dark:border-red-800">🚫 Plus longue disette offensive</h4>
              <StreakRows streakData={seasonRecords.longestGoalDrought} joueurs={joueurs} unit="matchs sans marquer" />
            </RecordCard>

            <RecordCard className="bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200 dark:from-amber-900/30 dark:to-orange-900/30 dark:border-amber-700" contextText={selectedSeason}>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3 text-center">⚔️ Face-à-face</h3>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Meilleure série en face-à-face</h4>
              <div className="space-y-2 mt-2">
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
            </RecordCard>

          </div>

          {/* Régularité */}
          {seasonRecords.allPlayerStdDevs.length > 0 && (
            <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] transition-all duration-200 p-6">
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

            <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">La puissance ne respecte que la puissance</h2>

            {/* Records de match */}
            <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] transition-all duration-200 p-6">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">⚽ Records de match</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {seasonRecords.mostGoalsInMatch.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 dark:from-green-900/30 dark:to-emerald-900/30 dark:border-green-700" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🎯 Plus de buts dans un match</h3>
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
                    <Top3List
                      entries={seasonRecords.mostProlificMatch}
                      renderValue={e => `${e.totalGoals} buts`}
                      renderDetail={e => `${e.joueur1} vs ${e.joueur2} (${e.score}) · ${fmt(e.date)} · ${e.ligue} ${e.championnat}`}
                    />
                  </RecordCard>
                )}

                {seasonRecords.mostProlificDraw.length > 0 && (
                  <RecordCard className="bg-gradient-to-br from-slate-50 to-zinc-50 border-slate-300 dark:from-slate-700/50 dark:border-slate-600" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🤝 Match nul le plus prolifique</h3>
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
            <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] transition-all duration-200 p-6">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">🏆 Records de championnat</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Championnats à 6 matchs uniquement</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {(seasonRecords.mostGoalsInChampionship.length > 0 || seasonRecords.mostConcededInChampionship.length > 0) && (
                  <RecordCard className="bg-gradient-to-br from-green-50 to-rose-50 border-green-200 dark:from-green-900/30 dark:to-rose-900/30 dark:border-green-700" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 text-center">⚽🥅 Attaque / Défense en 1 championnat</h3>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Plus de buts marqués</h4>
                    <Top3List
                      entries={seasonRecords.mostGoalsInChampionship}
                      renderValue={e => `${e.goals} buts`}
                      renderDetail={e => `${e.joueur} · ${e.ligue} ${e.championnat} · ${e.saison}`}
                    />
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1 mt-4 pt-4 border-t border-green-200 dark:border-green-800">Plus de buts encaissés</h4>
                    <Top3List
                      entries={seasonRecords.mostConcededInChampionship}
                      renderValue={e => `${e.goals} buts`}
                      renderDetail={e => `${e.joueur} · ${e.ligue} ${e.championnat} · ${e.saison}`}
                    />
                  </RecordCard>
                )}

                {(seasonRecords.bestGAChampionship.length > 0 || seasonRecords.worstGAChampionship.length > 0) && (
                  <RecordCard className="bg-gradient-to-br from-emerald-50 to-red-50 border-emerald-200 dark:from-emerald-900/30 dark:to-red-900/30 dark:border-emerald-700" contextText={selectedSeason}>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 text-center">📈📉 Goal average en 1 championnat</h3>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Meilleur</h4>
                    <Top3List
                      entries={seasonRecords.bestGAChampionship}
                      renderValue={e => `${e.ga > 0 ? '+' : ''}${e.ga}`}
                      renderDetail={e => `${e.joueur} · ${e.ligue} ${e.championnat} · ${e.saison}`}
                    />
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1 mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800">Pire</h4>
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
                    <div className="space-y-3 mt-2">
                      {withRankLabels(seasonRecords.tightestChampionship, e => e.sigma).map(({ item: entry, label }, i) => (
                        <div key={i} className={i > 0 ? 'pt-2 border-t border-slate-200 dark:border-slate-700' : ''}>
                          <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{label} </span>
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
        {activeSubTab === 'ligues' && (<>
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">Méfie-toi même des petits, car il n'y a plus de grands</h2>
          {!ligueData ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm">Pas assez de données pour cette période.</p>
          ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      label: '⚽ Ligues les plus prolifiques',
                      color: 'from-green-50 to-green-100 border-green-200 dark:from-green-900/30 dark:border-green-700',
                      sorted: [...ligueData.ligues].sort((a, b) => b.avgGoals - a.avgGoals),
                      renderValue: l => `${l.avgGoals.toFixed(2)} buts/match`,
                      renderDetail: l => `${l.totalGoals} buts sur ${l.matchs} matchs`,
                      textColor: 'text-green-700 dark:text-green-400',
                    },
                    {
                      label: '🤝 Ligues avec le plus de nuls',
                      color: 'from-zinc-50 to-zinc-100 border-zinc-300 dark:from-zinc-800/50 dark:border-zinc-600',
                      sorted: [...ligueData.ligues].sort((a, b) => b.drawRate - a.drawRate),
                      renderValue: l => `${(l.drawRate * 100).toFixed(1)}%`,
                      renderDetail: l => `${l.drawCount} nuls sur ${l.matchs} matchs`,
                      textColor: 'text-zinc-700 dark:text-zinc-300',
                    },
                    {
                      label: '🧤 Ligues avec le plus de clean sheets',
                      color: 'from-teal-50 to-teal-100 border-teal-200 dark:from-teal-900/30 dark:border-teal-700',
                      sorted: [...ligueData.ligues].sort((a, b) => b.cleanSheetRate - a.cleanSheetRate),
                      renderValue: l => `${(l.cleanSheetRate * 100).toFixed(1)}%`,
                      renderDetail: l => `${l.cleanSheetCount} CS sur ${l.matchs} matchs`,
                      textColor: 'text-teal-700 dark:text-teal-400',
                    },
                    {
                      label: '🎯 Ligues les plus serrées',
                      color: 'from-blue-50 to-blue-100 border-blue-200 dark:from-blue-900/30 dark:border-blue-700',
                      sorted: [...ligueData.ligues].sort((a, b) => a.avgMargin - b.avgMargin),
                      renderValue: l => `${l.avgMargin.toFixed(2)} buts d'écart/match`,
                      renderDetail: l => `${l.matchs} matchs`,
                      textColor: 'text-blue-700 dark:text-blue-400',
                    },
                  ].map(({ label, color, sorted, renderValue, renderDetail, textColor }) => (
                    <div key={label} data-card className={`relative bg-gradient-to-br ${color} rounded-lg p-4 border-2`}>
                      <ShareBtn contextText={selectedSeason === 'All-Time' ? 'All-Time' : selectedSeason} />
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{label}</h3>
                      <div className="space-y-1">
                        {withRankLabels(sorted, renderValue).map(({ item: l, label: rankLbl }) => (
                          <div key={l.ligue} className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-14">{rankLbl}</span>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{l.ligue}</span>
                            <span className={`text-sm font-bold ${textColor}`}>{renderValue(l)}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">({renderDetail(l)})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {mercatoData && (
                  <div data-card className="relative bg-gradient-to-br from-fuchsia-50 to-purple-50 border-fuchsia-200 dark:from-fuchsia-900/30 dark:to-purple-900/30 dark:border-fuchsia-700 rounded-lg p-4 border-2 mt-4">
                    <ShareBtn contextText={selectedSeason === 'All-Time' ? 'All-Time' : selectedSeason} />
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2 pr-8">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">💎 Ligues avec le plus de gros transferts</h3>
                      <div className="flex gap-1">
                        {mercatoData.BIG_TRANSFER_THRESHOLDS.map(t => (
                          <button
                            key={t}
                            onClick={() => setBigTransferThreshold(t)}
                            className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                              bigTransferThreshold === t
                                ? 'bg-fuchsia-500 text-white'
                                : 'bg-white/60 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/20'
                            }`}
                          >
                            ≥{t}M
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1 mt-2">
                      {withRankLabels(mercatoData.bigTransfersByLigue[bigTransferThreshold], l => l.count).map(({ item: l, label: rankLbl }) => (
                        <div key={l.ligue} className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-14">{rankLbl}</span>
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{l.ligue}</span>
                          <span className="text-sm font-bold text-fuchsia-700 dark:text-fuchsia-400">{l.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mercatoData && (
                  <div data-card className="relative bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 dark:from-orange-900/30 dark:to-red-900/30 dark:border-orange-700 rounded-lg p-4 border-2 mt-4">
                    <ShareBtn contextText={selectedSeason === 'All-Time' ? 'All-Time' : selectedSeason} />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">⚔️ Ligues avec le plus de batailles d'enchères</h3>
                    <div className="space-y-1 mt-2">
                      {withRankLabels(mercatoData.bidWarsByLigue, l => l.count).map(({ item: l, label: rankLbl }) => (
                        <div key={l.ligue} className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-14">{rankLbl}</span>
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{l.ligue}</span>
                          <span className="text-sm font-bold text-orange-700 dark:text-orange-400">{l.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
        </>)}

        {/* ── MERCATO ── */}
        {activeSubTab === 'mercato' && (<>
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">Ma question préférée ?</h2>
          {!mercatoData ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm">Pas de données mercato pour cette période.</p>
          ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* ── ONE SHOTS ── */}
                <RecordCard className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 dark:from-amber-900/30 dark:to-yellow-900/30 dark:border-amber-700" contextText={selectedSeason === 'All-Time' ? 'All-Time' : selectedSeason}>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3 text-center">🎯 One shots</h3>

                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">💸 Plus grosse enchère</h4>
                  {mercatoData.biggestBids.length > 0 ? (
                    <div className="space-y-1.5 mt-2">
                      {withRankLabels(mercatoData.biggestBids, m => m.prix).map(({ item: m, label }, i) => (
                        <div key={i} className="text-sm">
                          <div className="flex flex-wrap items-baseline gap-x-1.5">
                            <RankBadge label={label} />
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{m.joueur}</span>
                            <span className="font-bold text-amber-700 dark:text-amber-400">{m.prix}M</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{m.acheteur} · {m.ligue} · Champ. {m.championnat}{selectedSeason === 'All-Time' ? ` · ${m.saison}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500 dark:text-slate-400">Aucune donnée.</p>}

                  {mercatoData.recordParPoste.length > 0 && (
                    <div className="mt-3">
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Par poste</h5>
                      <div className="space-y-1.5">
                        {mercatoData.recordParPoste.map((m, i) => (
                          <div key={i} className="text-sm">
                            <div className="flex flex-wrap items-baseline gap-x-1.5">
                              <span className={`text-xs font-semibold uppercase tracking-wide ${posteGroupColor(m.poste)}`}>{m.poste}</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{m.joueur}</span>
                              <span className="font-bold text-violet-700 dark:text-violet-400">{m.prix}M</span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{m.acheteur} · {m.ligue} · Champ. {m.championnat}{selectedSeason === 'All-Time' ? ` · ${m.saison}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-amber-200 dark:border-amber-800">🎯 Meilleur rapport qualité/prix</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sur un seul championnat</p>
                  {mercatoData.bestValueForMoney.length > 0 ? (
                    <div className="space-y-1.5 mt-2">
                      {withRankLabels(mercatoData.bestValueForMoney, m => m.ratio).map(({ item: m, label }, i) => (
                        <div key={i} className="text-sm">
                          <div className="flex flex-wrap items-baseline gap-x-1.5">
                            <RankBadge label={label} />
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{m.joueur}</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">{m.buts} but{m.buts > 1 ? 's' : ''} / {m.prix}M</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{m.acheteur} · {m.ligue} · Champ. {m.championnat}{selectedSeason === 'All-Time' ? ` · ${m.saison}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500 dark:text-slate-400">Pas assez de buts pour établir ce classement.</p>}

                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-amber-200 dark:border-amber-800">📉 Plus gros flop</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sur un seul championnat, à partir de 3 matchs joués</p>
                  {mercatoData.biggestFlops.length > 0 ? (
                    <div className="space-y-1.5 mt-2">
                      {withRankLabels(mercatoData.biggestFlops, m => m.prix).map(({ item: m, label }, i) => (
                        <div key={i} className="text-sm">
                          <div className="flex flex-wrap items-baseline gap-x-1.5">
                            <RankBadge label={label} />
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{m.joueur}</span>
                            <span className="font-bold text-rose-700 dark:text-rose-400">0 but / {m.prix}M</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{m.acheteur} · {m.ligue} · Champ. {m.championnat}{selectedSeason === 'All-Time' ? ` · ${m.saison}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500 dark:text-slate-400">Aucun flop pour l'instant.</p>}
                </RecordCard>

                {/* ── CUMUL DES MANDATS ── */}
                <RecordCard className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 dark:from-orange-900/30 dark:to-amber-900/30 dark:border-orange-700" contextText={selectedSeason === 'All-Time' ? 'All-Time' : selectedSeason}>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3 text-center">🔁 Cumul des mandats</h3>

                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">💰 Plus grosse mise cumulée</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total dépensé sur un même joueur, tous mercatos et toutes ligues confondus</p>
                  {mercatoData.biggestCumulativeSpend.length > 0 ? (
                    <div className="space-y-1.5 mt-2">
                      {withRankLabels(mercatoData.biggestCumulativeSpend, m => m.total).map(({ item: m, label }, i) => (
                        <div key={i} className="text-sm">
                          <RankBadge label={label} className="mr-1" />
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{m.joueur}</span>
                          <span className="font-bold text-orange-700 dark:text-orange-400 ml-1.5">{m.total}M</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500 dark:text-slate-400">Aucune donnée.</p>}

                  {mercatoData.cumulativeSpendParPoste.length > 0 && (
                    <div className="mt-3">
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Par poste</h5>
                      <div className="space-y-1.5">
                        {mercatoData.cumulativeSpendParPoste.map((m, i) => (
                          <div key={i} className="text-sm">
                            <span className={`text-xs font-semibold uppercase tracking-wide ${posteGroupColor(m.poste)}`}>{m.poste}</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200 ml-1.5">{m.joueur}</span>
                            <span className="font-bold text-orange-700 dark:text-orange-400 ml-1.5">{m.total}M</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-orange-200 dark:border-orange-800">🎯 Meilleur rapport qualité/prix cumulé</h4>
                  {mercatoData.bestValueForMoneyCumule.length > 0 ? (
                    <div className="space-y-1.5 mt-2">
                      {withRankLabels(mercatoData.bestValueForMoneyCumule, m => m.ratio).map(({ item: m, label }, i) => (
                        <div key={i} className="text-sm">
                          <RankBadge label={label} className="mr-1" />
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{m.joueur}</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 ml-1.5">{m.buts} but{m.buts > 1 ? 's' : ''} / {m.total}M</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500 dark:text-slate-400">Pas assez de buts pour établir ce classement.</p>}

                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-orange-200 dark:border-orange-800">📉 Plus gros flop cumulé</h4>
                  {mercatoData.biggestFlopsCumule.length > 0 ? (
                    <div className="space-y-1.5 mt-2">
                      {withRankLabels(mercatoData.biggestFlopsCumule, m => m.total).map(({ item: m, label }, i) => (
                        <div key={i} className="text-sm">
                          <RankBadge label={label} className="mr-1" />
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{m.joueur}</span>
                          <span className="font-bold text-rose-700 dark:text-rose-400 ml-1.5">0 but / {m.total}M</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500 dark:text-slate-400">Aucun flop pour l'instant.</p>}

                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-orange-200 dark:border-orange-800">🔂 Plus grand nombre de mises cumulées</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total des enchères reçues (gagnées + perdues) sur un même joueur, toutes ligues confondues</p>
                  {mercatoData.mostBidsCumulees.length > 0 ? (
                    <div className="space-y-1.5 mt-2">
                      {withRankLabels(mercatoData.mostBidsCumulees, m => m.count).map(({ item: m, label }, i) => (
                        <div key={i} className="text-sm">
                          <RankBadge label={label} className="mr-1" />
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{m.joueur}</span>
                          <span className="font-bold text-orange-700 dark:text-orange-400 ml-1.5">{m.count} mises</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500 dark:text-slate-400">Aucune donnée.</p>}
                </RecordCard>

                {/* ── DIVERS ── */}
                <RecordCard className="bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200 dark:from-sky-900/30 dark:to-blue-900/30 dark:border-sky-700" contextText={selectedSeason === 'All-Time' ? 'All-Time' : selectedSeason}>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3 text-center">🗂️ Divers</h3>

                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">🏠 Fidélité</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Nombre de recrutement d'affilé</p>
                  {mercatoData.longevite.length > 0 ? (
                    <div className="space-y-1.5 mt-2">
                      {withRankLabels(mercatoData.longevite, l => l.streak).map(({ item: l, label }, i) => (
                        <div key={i} className="text-sm">
                          <RankBadge label={label} className="mr-1" />
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{l.joueur}</span>
                          <span className="font-bold text-sky-700 dark:text-sky-400 ml-1.5">{l.streak}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5">chez {l.acheteur}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500 dark:text-slate-400">Pas encore de fidélité mercato notable.</p>}

                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-sky-200 dark:border-sky-800">👥 Joueurs recrutés (distincts)</h4>
                  {mercatoData.recruitsCountByCoach.length > 0 ? (
                    <AllPlayersGrid data={mercatoData.recruitsCountByCoach} valueKey="count" />
                  ) : <p className="text-sm text-slate-500 dark:text-slate-400">Aucune donnée.</p>}

                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-sky-200 dark:border-sky-800">⚔️ Batailles d'enchères remportées</h4>
                  {mercatoData.bidWarsWonCoach.length > 0 ? (
                    <AllPlayersGrid data={mercatoData.bidWarsWonCoach} valueKey="count" />
                  ) : <p className="text-sm text-slate-500 dark:text-slate-400">Aucune bataille d'enchères pour l'instant.</p>}

                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 mt-4 pt-4 border-t border-sky-200 dark:border-sky-800">📊 Enchère médiane</h4>
                  {mercatoData.medianBidCoach.length > 0 ? (
                    <AllPlayersGrid data={mercatoData.medianBidCoach} valueKey="medianLabel" valueClassName="text-xl font-bold" />
                  ) : <p className="text-sm text-slate-500 dark:text-slate-400">Aucune donnée.</p>}
                </RecordCard>
              </div>
            )}
        </>)}
      </div>
    </>
  );
}
