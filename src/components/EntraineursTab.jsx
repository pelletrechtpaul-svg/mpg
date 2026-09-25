import { useState, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { playerImages, playerColors, playerColorHex, ShareBtn, isCompte, hasDetailedData, ligueAbbr } from '../shared.jsx';
import { usePlayerPhotos } from './PlayerAvatar.jsx';
import { FormationPitch, SquadBench, computeFormation, POSTE_GROUP, POSTE_GROUP_ORDER } from './FormationPitch.jsx';

/* Pastilles de forme V/N/D — en fiche individuelle ('lg'), elles s'étirent
   pour occuper toute la largeur de la carte sur mobile (flex-1 + aspect
   carré) au lieu de rester minuscules et centrées avec du vide autour ;
   taille fixe reprise à partir de sm. */
const FormPills = ({ form, size = 'sm' }) => {
  const dim = size === 'lg' ? 'flex-1 sm:flex-none sm:w-9 sm:h-9 aspect-square text-sm' : 'w-6 h-6 text-[11px] flex-shrink-0';
  if (!form || form.length === 0) {
    return <span className="text-xs text-slate-500">Aucun match</span>;
  }
  return (
    <div className={`flex gap-1 ${size === 'lg' ? 'flex-nowrap' : 'flex-wrap justify-center'}`}>
      {form.map((r, i) => (
        <div
          key={i}
          className={`${dim} rounded flex items-center justify-center font-bold text-white ${
            r === 'W' ? 'bg-green-600' : r === 'L' ? 'bg-red-600' : 'bg-slate-400'
          }`}
        >
          {r === 'W' ? 'V' : r === 'L' ? 'D' : 'N'}
        </div>
      ))}
    </div>
  );
};

const Avatar = ({ joueur, className }) => (
  <div className={`rounded-full overflow-hidden ${className}`} style={{ borderColor: playerColorHex[joueur] }}>
    <img
      src={playerImages[joueur]}
      alt={joueur}
      className="w-full h-full object-cover"
      onError={(e) => {
        e.target.style.display = 'none';
        e.target.parentElement.classList.add(playerColors[joueur] || 'bg-gray-600');
      }}
    />
  </div>
);

const SUB_TABS = [
  { key: 'effectifs', label: 'Effectifs actuels', short: 'Effectifs' },
  { key: 'confrontations', label: 'Confrontations', short: 'Confront.' },
  { key: 'tops', label: 'Tops joueurs', short: 'Tops' },
  { key: 'records', label: 'Records détenus', short: 'Records' },
];

// flex-nowrap + libellés abrégés sur mobile : tient sur une seule ligne à 4
// onglets même sur un écran étroit (voir FormPills, même logique).
const PillTabs = ({ tabs, active, onChange }) => (
  <div className="flex flex-nowrap gap-1 bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-1 border border-indigo-100 dark:border-[#2d2b5e]">
    {tabs.map(t => (
      <button
        key={t.key}
        onClick={() => onChange(t.key)}
        className={`flex-1 min-w-0 px-1 sm:px-4 py-1.5 sm:py-2 rounded-xl font-medium transition-all text-xs sm:text-sm whitespace-nowrap ${
          active === t.key
            ? 'bg-violet-500 text-white shadow'
            : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/10'
        }`}
      >
        <span className="sm:hidden">{t.short}</span>
        <span className="hidden sm:inline">{t.label}</span>
      </button>
    ))}
  </div>
);

export default function EntraineursTab({
  joueurs, ligues, filteredData, mercatoData,
  classementGeneral, advancedStats,
  seasonRecords, perduUnPoint,
  selectedSeason, shareContext, onOpenPlayer,
  selectedPlayer, onSelectPlayer,
  subTab, onSubTabChange: setSubTab,
}) {
  const [h2hLigue, setH2hLigue] = useState('all');
  const [effectifLigue, setEffectifLigue] = useState(null);
  const photos = usePlayerPhotos();

  const selectPlayer = (joueur) => {
    onSelectPlayer(joueur);
    setH2hLigue('all');
    setEffectifLigue(null);
    setSubTab('effectifs');
  };

  /* Effectif actuel du coach sélectionné, par ligue (championnat le plus
     récent connu pour chaque ligue — cohérent avec l'onglet Classements),
     enrichi des moyennes d'équipe / par ligne / joueurs au loft une fois
     qu'au moins un match du championnat a été noté. Un objet par ligue
     plutôt qu'un seul terrain géant : avec 4-5 ligues et des effectifs de
     15-20 joueurs chacune, tout afficher d'un coup serait illisible. On
     affiche une puce par ligue et un seul terrain à la fois. */
  const effectifsParLigue = useMemo(() => {
    if (!selectedPlayer || !hasDetailedData(selectedSeason)) return [];
    return ligues
      .map(ligue => {
        const champs = (mercatoData || []).filter(m => m.ligue === ligue).map(m => m.championnat);
        if (!champs.length) return null;
        const dernier = Math.max(...champs);
        const squad = (mercatoData || []).filter(m =>
          m.ligue === ligue && m.championnat === dernier && m.acheteur === selectedPlayer);
        if (!squad.length) return null;

        const champMatches = (filteredData || []).filter(m =>
          m.ligue === ligue && m.championnat === `#${dernier}` && (m.joueur1 === selectedPlayer || m.joueur2 === selectedPlayer));

        const posteOf = {};
        squad.forEach(m => { posteOf[m.joueur] = m.poste; });

        // Note moyenne du coach sur ce championnat (choisit les titulaires
        // par note plutôt que par prix, comme sur Classements > Effectifs),
        // moyenne d'équipe (toutes les notes "compte"), moyenne par ligne de
        // poste, et nombre moyen de joueurs au loft par match (effectif
        // recruté moins les joueurs classés compte/banc ce match-là).
        const noteSums = {};
        let teamSum = 0, teamCount = 0, loftSum = 0, matchCount = 0;
        const lineSums = {};
        POSTE_GROUP_ORDER.forEach(g => { lineSums[g] = { sum: 0, count: 0 }; });
        champMatches.forEach(m => {
          const coachNotes = (m.notes || []).filter(n => n.acheteur === selectedPlayer);
          coachNotes.filter(isCompte).forEach(n => {
            if (n.note == null) return;
            const entry = noteSums[n.joueur] || (noteSums[n.joueur] = { sum: 0, count: 0 });
            entry.sum += n.note;
            entry.count += 1;
            teamSum += n.note;
            teamCount += 1;
            const group = POSTE_GROUP[posteOf[n.joueur]] || 'Milieux';
            lineSums[group].sum += n.note;
            lineSums[group].count += 1;
          });
          loftSum += Math.max(0, squad.length - coachNotes.length);
          matchCount += 1;
        });
        const avgNotes = {};
        Object.entries(noteSums).forEach(([joueur, { sum, count }]) => { avgNotes[joueur] = sum / count; });
        const hasNotes = champMatches.length > 0 && Object.keys(avgNotes).length > 0;

        const lineAvgs = {};
        POSTE_GROUP_ORDER.forEach(g => { lineAvgs[g] = lineSums[g].count > 0 ? lineSums[g].sum / lineSums[g].count : null; });

        return {
          ligue, championnat: dernier, squad,
          ratingFor: hasNotes ? (m => avgNotes[m.joueur] ?? 0) : undefined,
          avgNoteFor: hasNotes ? (m => avgNotes[m.joueur]) : undefined,
          teamAvg: hasNotes && teamCount > 0 ? teamSum / teamCount : null,
          loftAvg: hasNotes && matchCount > 0 ? loftSum / matchCount : null,
          lineAvgs: hasNotes ? lineAvgs : null,
        };
      })
      .filter(Boolean);
  }, [ligues, mercatoData, filteredData, selectedPlayer, selectedSeason]);

  /* Records détenus par chaque coach : uniquement ceux réellement affichés
     dans Records > Entraîneurs (Style de jeu / Étude de banc / Séries
     offensives — pas Ligues/Mercato/Exploits, pas propres à un coach, ni
     "Séries à oublier"/Face-à-face, pas des records "détenus" au sens
     flatteur). Un coach détient un record s'il est seul en tête (valeur > 0,
     pas d'ex-aequo au sommet) de la même liste que celle utilisée là-bas. */
  const recordsDetenus = useMemo(() => {
    const result = {};
    joueurs.forEach(j => { result[j] = []; });
    if (!seasonRecords) return result;

    const addLeader = (list, valueKey, label, detail) => {
      if (!list?.length) return;
      const leader = list[0];
      const value = leader[valueKey];
      if (!(value > 0)) return;
      if (list[1] && list[1][valueKey] === value) return;
      result[leader.joueur].push({ label, detail: detail(value) });
    };

    addLeader(seasonRecords.closeWinsKing, 'count', '🔪 Roi des scores serrés', v => `${v} victoire${v > 1 ? 's' : ''} par exactement 1 but d'écart`);
    addLeader(seasonRecords.berserkKing, 'count', '🪓 Berserk', v => `${v} victoire${v > 1 ? 's' : ''} avec 5 buts d'écart ou plus`);
    addLeader(seasonRecords.clutchChampion, 'count', '🎯 Clutch', v => `${v} championnat${v > 1 ? 's' : ''} gagné${v > 1 ? 's' : ''} avec exactement 1 point d'écart`);

    const unbeatenCounts = {};
    (seasonRecords.unbeatenChampion || []).forEach(inst => { unbeatenCounts[inst.joueur] = (unbeatenCounts[inst.joueur] || 0) + 1; });
    const unbeatenList = joueurs.map(j => ({ joueur: j, count: unbeatenCounts[j] || 0 })).sort((a, b) => b.count - a.count);
    addLeader(unbeatenList, 'count', '👑 Titres remportés sans défaite', v => `${v} titre${v > 1 ? 's' : ''} remporté${v > 1 ? 's' : ''} sans perdre un seul match`);

    if (perduUnPoint) {
      const perduList = joueurs.map(j => ({ joueur: j, count: (perduUnPoint[j] || []).length })).sort((a, b) => b.count - a.count);
      addLeader(perduList, 'count', '😤 Championnats perdus de justesse', v => `${v} championnat${v > 1 ? 's' : ''} perdu${v > 1 ? 's' : ''} à 1 point, au goal average ou à la différence particulière`);
    }

    if (hasDetailedData(selectedSeason)) {
      addLeader(seasonRecords.rotaldoKing, 'count', '🎲 Rotaldinho', v => `${v} rotaldo${v > 1 ? 's' : ''} subi${v > 1 ? 's' : ''} (titulaire absent non remplacé)`);
      addLeader(seasonRecords.benchGoalsKing, 'count', '🪑⚽ Buts gâchés sur le banc', v => `${v} but${v > 1 ? 's' : ''} marqué${v > 1 ? 's' : ''} par des joueurs restés sur le banc`);
      addLeader(seasonRecords.cscKing, 'count', '🙈 CSC', v => `${v} but${v > 1 ? 's' : ''} contre son camp inscrit${v > 1 ? 's' : ''} par ses recrues`);

      const bench = seasonRecords.benchVsCompteAvg || [];
      if (bench.length > 0 && bench[0].diff <= 0 && (!bench[1] || bench[1].diff !== bench[0].diff)) {
        result[bench[0].joueur].push({ label: '⭐ Banc vs titulaire', detail: `Son banc fait mieux que ses titulaires en moyenne (${bench[0].diff.toFixed(1)})` });
      }
    }

    const addStreakLeader = (streakData, label, unit) => {
      if (!streakData) return;
      const ranked = joueurs.map(j => ({ joueur: j, length: streakData[j]?.length || 0 })).sort((a, b) => b.length - a.length);
      addLeader(ranked, 'length', label, v => `${v} ${unit} d'affilée`);
    };
    addStreakLeader(seasonRecords.longestWinStreak, '🏆 Plus longue série de victoires', 'victoires');
    addStreakLeader(seasonRecords.longestUnbeatenStreak, '🧱 Plus longue série sans défaite', 'matchs sans défaite');
    addStreakLeader(seasonRecords.longestCleanSheetStreak, '🧤 Plus longue série sans encaisser', 'clean sheets');

    return result;
  }, [joueurs, seasonRecords, perduUnPoint, selectedSeason]);

  /* Head-to-head du joueur sélectionné contre tous les autres (totaux uniquement, triés par % victoire) */
  const h2h = useMemo(() => {
    if (!selectedPlayer) return [];
    return joueurs.filter(j => j !== selectedPlayer).map(opp => {
      let matches = filteredData.filter(m =>
        (m.joueur1 === selectedPlayer && m.joueur2 === opp) ||
        (m.joueur1 === opp && m.joueur2 === selectedPlayer));
      if (h2hLigue !== 'all') matches = matches.filter(m => m.ligue === h2hLigue);
      let w = 0, d = 0, l = 0, bf = 0, ba = 0;
      matches.forEach(m => {
        const pIs1 = m.joueur1 === selectedPlayer;
        const bp = pIs1 ? m.buts_j1 : m.buts_j2;
        const bc = pIs1 ? m.buts_j2 : m.buts_j1;
        bf += bp; ba += bc;
        if (bp > bc) w++; else if (bp === bc) d++; else l++;
      });
      const winPct = matches.length ? w / matches.length : -1;
      return { opp, w, d, l, bf, ba, matchs: matches.length, winPct };
    }).sort((a, b) => b.winPct - a.winPct);
  }, [selectedPlayer, joueurs, filteredData, h2hLigue]);

  const rankOf = j => classementGeneral.findIndex(c => c.joueur === j) + 1;
  const pointsOf = j => classementGeneral.find(c => c.joueur === j)?.points ?? 0;
  const rankedJoueurs = useMemo(() =>
    [...joueurs].sort((a, b) => classementGeneral.findIndex(c => c.joueur === a) - classementGeneral.findIndex(c => c.joueur === b)),
    [joueurs, classementGeneral]);

  /* Top buteurs / CSC parmi les joueurs recrutés par le coach sélectionné,
     comptés uniquement sur les championnats/ligues où le joueur appartenait
     RÉELLEMENT à ce coach (pas tout l'historique du coach ni tous les
     coachs) — sinon un but marqué après un transfert vers un autre coach
     se retrouvait crédité à l'ancien acheteur. */
  const { topButeurs, topCsc } = useMemo(() => {
    if (!selectedPlayer) return { topButeurs: [], topCsc: [] };
    const owned = new Set((mercatoData || [])
      .filter(m => m.acheteur === selectedPlayer)
      .map(m => `${m.joueur}|${m.ligue}|#${m.championnat}`));
    const buts = {}, csc = {};
    const matches = h2hLigue === 'all' ? filteredData : filteredData.filter(m => m.ligue === h2hLigue);
    matches.forEach(m => {
      (m.buteurs || []).filter(isCompte).forEach(b => {
        if (!b.joueur || !owned.has(`${b.joueur}|${m.ligue}|${m.championnat}`)) return;
        const map = b.csc ? csc : buts;
        map[b.joueur] = (map[b.joueur] || 0) + (b.buts || 1);
      });
    });
    const toSorted = obj => Object.entries(obj).map(([joueur, n]) => ({ joueur, n })).sort((a, b) => b.n - a.n);
    return { topButeurs: toSorted(buts), topCsc: toSorted(csc) };
  }, [filteredData, mercatoData, selectedPlayer, h2hLigue]);

  const LigueSelect = () => (
    <select
      value={h2hLigue}
      onChange={(e) => setH2hLigue(e.target.value)}
      className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500"
    >
      <option value="all" className="text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800">Toutes les ligues</option>
      {ligues.map(l => <option key={l} value={l} className="text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800">{l}</option>)}
    </select>
  );

  /* ---------- Vue profil détaillé ---------- */
  if (selectedPlayer) {
    const stats = classementGeneral.find(c => c.joueur === selectedPlayer);
    const adv = advancedStats[selectedPlayer];
    const fullForm = adv?.recentForm?.map(m => m.result) || [];
    const myRecords = recordsDetenus[selectedPlayer] || [];
    return (
      <div className="space-y-6">
        <button
          onClick={() => onSelectPlayer(null)}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour aux entraîneurs
        </button>

        {/* Carte profil */}
        <div data-card className="relative bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-6">
          <ShareBtn contextText={shareContext} />
          <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
            <Avatar joueur={selectedPlayer} className="w-24 h-24 sm:w-28 sm:h-28 border-4 shadow-lg flex-shrink-0" />
            <div className="text-center sm:text-left flex-1">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100">{selectedPlayer}</h2>
              <div className="flex items-center justify-center sm:justify-start gap-4 mt-2">
                <div>
                  <span className="text-2xl font-bold" style={{ color: playerColorHex[selectedPlayer] }}>#{rankOf(selectedPlayer)}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">au général</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-slate-700 dark:text-slate-200">{pointsOf(selectedPlayer)}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">pts</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bilan + forme, centrés plutôt qu'étalés sur toute la largeur */}
          <div className="grid grid-cols-4 gap-2 mt-6 pt-6 border-t dark:border-slate-700 text-center max-w-sm mx-auto">
            <div><div className="text-xl font-bold text-slate-700 dark:text-slate-200">{stats?.matchs ?? 0}</div><div className="text-xs text-slate-500 dark:text-slate-400">Matchs</div></div>
            <div><div className="text-xl font-bold text-green-600 dark:text-green-400">{stats?.victoires ?? 0}</div><div className="text-xs text-slate-500 dark:text-slate-400">Victoires</div></div>
            <div><div className="text-xl font-bold text-slate-400">{stats?.nuls ?? 0}</div><div className="text-xs text-slate-500 dark:text-slate-400">Nuls</div></div>
            <div><div className="text-xl font-bold text-red-600 dark:text-red-400">{stats?.defaites ?? 0}</div><div className="text-xs text-slate-500 dark:text-slate-400">Défaites</div></div>
          </div>
          <div className="mt-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 text-center">Forme récente</p>
            <FormPills form={fullForm} size="lg" />
          </div>
        </div>

        <PillTabs tabs={SUB_TABS} active={subTab} onChange={setSubTab} />

        {/* Effectifs actuels */}
        {subTab === 'effectifs' && (
          effectifsParLigue.length > 0 ? (() => {
            const active = effectifsParLigue.find(e => e.ligue === effectifLigue) || effectifsParLigue[0];
            const { bench } = computeFormation(active.squad, active.ratingFor);
            return (
              <div data-card className="relative bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] overflow-hidden transition-all duration-200 p-5">
                <ShareBtn contextText={shareContext} />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3">Effectifs actuels</h3>
                {effectifsParLigue.length > 1 && (
                  // flex-nowrap sans scroll : chaque puce se contracte (flex-1
                  // min-w-0 + libellé abrégé) plutôt que de déborder, pour
                  // tenir sur une seule ligne même à 5 ligues (LDC à venir).
                  <div className="flex flex-nowrap gap-1.5 mb-4">
                    {effectifsParLigue.map(({ ligue, championnat }) => (
                      <button
                        key={ligue}
                        onClick={() => setEffectifLigue(ligue)}
                        title={ligue}
                        className={`flex-1 min-w-0 px-1.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium truncate transition-all ${
                          active.ligue === ligue
                            ? 'bg-violet-500 text-white shadow'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                        }`}
                      >
                        {ligueAbbr(ligue)} #{championnat}
                      </button>
                    ))}
                  </div>
                )}
                {/* Terrain à gauche / stats à droite à partir du desktop ; empilé en mobile */}
                <div className="lg:flex lg:gap-6 lg:items-start">
                  <div className="lg:w-[340px] lg:flex-shrink-0">
                    <FormationPitch squad={active.squad} onOpenPlayer={onOpenPlayer} photos={photos} ratingFor={active.ratingFor} avgNoteFor={active.avgNoteFor} hideBench />
                  </div>
                  <div className="mt-4 lg:mt-0 lg:flex-1 space-y-4">
                    {(active.teamAvg != null || active.loftAvg != null) && (
                      <div className="flex flex-wrap gap-3">
                        {active.teamAvg != null && (
                          <div className="flex-1 min-w-[140px] bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">⭐ Moyenne d'équipe</p>
                            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{active.teamAvg.toFixed(1)}</p>
                          </div>
                        )}
                        {active.loftAvg != null && (
                          <div className="flex-1 min-w-[140px] bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">📦 Joueurs au loft (moy.)</p>
                            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{Math.round(active.loftAvg)}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {active.lineAvgs && (
                      <div className="grid grid-cols-2 gap-3">
                        {POSTE_GROUP_ORDER.filter(g => active.lineAvgs[g] != null).map(g => (
                          <div key={g} className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{g}</p>
                            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{active.lineAvgs[g].toFixed(1)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <SquadBench bench={bench} onOpenPlayer={onOpenPlayer} avgNoteFor={active.avgNoteFor} />
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-8 text-center">
              <p className="text-slate-500 dark:text-slate-400">Pas de données mercato pour cette période.</p>
            </div>
          )
        )}

        {/* Confrontations directes */}
        {subTab === 'confrontations' && (
          <div data-card className="relative bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-6">
            <ShareBtn contextText={shareContext} />
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Confrontations directes</h3>
              <LigueSelect />
            </div>
            <div className="space-y-3">
              {h2h.map(({ opp, w, d, l, bf, ba, matchs, winPct }) => (
                <div key={opp} className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar joueur={opp} className="w-10 h-10 border-2 flex-shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">vs {opp}</span>
                      {matchs > 0 && (
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{Math.round(winPct * 100)}% de victoires • {matchs} match{matchs > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  {matchs > 0 ? (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-bold text-green-600 dark:text-green-400">{w}V</span>
                      <span className="font-bold text-slate-400">{d}N</span>
                      <span className="font-bold text-red-600 dark:text-red-400">{l}D</span>
                      <span className="text-slate-500 dark:text-slate-400">• {bf}-{ba} buts</span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500">Aucune confrontation</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tops joueurs (buteurs / CSC parmi les recrues du coach) */}
        {subTab === 'tops' && (
          hasDetailedData(selectedSeason) ? (
            <div data-card className="relative bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-6">
              <ShareBtn contextText={shareContext} />
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Tops joueurs</h3>
                <LigueSelect />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">⚽ Top buteurs</h4>
                  {topButeurs.length > 0 ? (
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                        <tr>
                          <th className="px-1 py-2 sm:px-4 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                          <th className="px-1 py-2 sm:px-4 sm:py-3 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                          <th className="px-1 py-2 sm:px-4 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Buts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topButeurs.slice(0, 10).map((p, index) => (
                          <tr key={p.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                            <td className="px-1 py-2 sm:px-4 sm:py-3 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                            <td className="px-1 py-2 sm:px-4 sm:py-3 font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base">{p.joueur}</td>
                            <td className="px-1 py-2 sm:px-4 sm:py-3 text-center font-bold text-green-600 dark:text-green-400 text-xs sm:text-base">{p.n}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Aucun but marqué pour l'instant.</p>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">🙈 Top CSC</h4>
                  {topCsc.length > 0 ? (
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-indigo-50/50 dark:bg-[#151228]">
                        <tr>
                          <th className="px-1 py-2 sm:px-4 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">#</th>
                          <th className="px-1 py-2 sm:px-4 sm:py-3 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                          <th className="px-1 py-2 sm:px-4 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">CSC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topCsc.map((p, index) => (
                          <tr key={p.joueur} className="border-t border-indigo-50 dark:border-[#1e1c3a] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                            <td className="px-1 py-2 sm:px-4 sm:py-3 text-center font-bold text-sm sm:text-lg text-indigo-300 dark:text-indigo-500">{index + 1}</td>
                            <td className="px-1 py-2 sm:px-4 sm:py-3 font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base">{p.joueur}</td>
                            <td className="px-1 py-2 sm:px-4 sm:py-3 text-center font-bold text-orange-600 dark:text-orange-400 text-xs sm:text-base">{p.n}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Aucun CSC pour l'instant.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-8 text-center">
              <p className="text-slate-500 dark:text-slate-400">Pas de données détaillées pour cette période.</p>
            </div>
          )
        )}

        {/* Records détenus */}
        {subTab === 'records' && (
          <div data-card className="relative bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-6">
            <ShareBtn contextText={shareContext} />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Records détenus</h3>
            {myRecords.length > 0 ? (
              <div className="space-y-3">
                {myRecords.map((r, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{r.label}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{r.detail}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Aucun record détenu pour l'instant.</p>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ---------- Vue grille des cartes, triée par classement (leader à gauche) ---------- */
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {rankedJoueurs.map(joueur => {
        const adv = advancedStats[joueur];
        const form = adv?.recentForm?.map(m => m.result).slice(-5) || [];
        const color = playerColorHex[joueur];
        return (
          <div
            key={joueur}
            role="button"
            tabIndex={0}
            onClick={() => selectPlayer(joueur)}
            onKeyDown={(e) => { if (e.key === 'Enter') selectPlayer(joueur); }}
            className="group relative cursor-pointer text-left overflow-hidden rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#0f0e1a] shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300"
          >
            {/* Halo de couleur en fond */}
            <div
              className="absolute inset-x-0 top-0 h-24 opacity-20 dark:opacity-25 blur-xl pointer-events-none transition-opacity duration-300 group-hover:opacity-30"
              style={{ background: `radial-gradient(circle at 50% 0%, ${color}, transparent 70%)` }}
            />
            <div className="relative flex flex-col items-center text-center p-4 sm:p-5">
              {/* Avatar + badge rang */}
              <div className="relative mb-3">
                <Avatar joueur={joueur} className="w-16 h-16 sm:w-20 sm:h-20 border-[3px] shadow-md" />
                <span
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shadow ring-2 ring-white dark:ring-[#0f0e1a]"
                  style={{ backgroundColor: color }}
                >
                  {rankOf(joueur)}
                </span>
              </div>

              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg leading-none">{joueur}</h3>

              {/* Points */}
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-2xl font-black" style={{ color }}>{pointsOf(joueur)}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">pts</span>
              </div>

              {/* Forme */}
              <div className="mt-3">
                <FormPills form={form} />
              </div>

              <span className="mt-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors">
                Voir le profil →
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
