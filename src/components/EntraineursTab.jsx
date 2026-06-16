import { useState, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { playerImages, playerColors, playerColorHex, ShareBtn } from '../shared.jsx';

/* Pastilles de forme V/N/D */
const FormPills = ({ form, size = 'sm' }) => {
  const dim = size === 'lg' ? 'w-9 h-9 text-sm' : 'w-6 h-6 text-[11px]';
  if (!form || form.length === 0) {
    return <span className="text-xs text-slate-400">Aucun match</span>;
  }
  return (
    <div className="flex gap-1 flex-wrap justify-center">
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
      style={{ objectPosition: joueur === 'Paul' ? '65% 15%' : joueur === 'Roman' ? '50% 20%' : 'center' }}
      onError={(e) => {
        e.target.style.display = 'none';
        e.target.parentElement.classList.add(playerColors[joueur] || 'bg-gray-600');
      }}
    />
  </div>
);

export default function EntraineursTab({
  joueurs, ligues, filteredData,
  classementGeneral, advancedStats, cleanSheetsStats, statsDetaillees,
  heureDeGloire, selectedSeason, shareContext,
}) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [h2hLigue, setH2hLigue] = useState('all');
  const [sigBubble, setSigBubble] = useState(null);

  /* Stat signature : chaque joueur reçoit un titre distinct (assignation gloutonne) */
  const signatures = useMemo(() => {
    const cs = {};
    cleanSheetsStats.forEach(c => { cs[c.joueur] = c.cleanSheets; });
    const cl = j => classementGeneral.find(c => c.joueur === j);

    const metrics = [
      { key: 'titres',   label: '👑 Roi du championnat',  get: j => cl(j)?.victoiresChampionnat || 0, detail: v => `${v} titre${v > 1 ? 's' : ''} de championnat remporté${v > 1 ? 's' : ''}` },
      { key: 'buteur',   label: '⚽ Meilleur buteur',      get: j => statsDetaillees[j]?.buts_pour || 0, detail: v => `${v} buts marqués, plus que tous les autres` },
      { key: 'mur',      label: '🧤 Mur défensif',         get: j => cs[j] || 0, detail: v => `${v} clean sheet${v > 1 ? 's' : ''} (matchs sans encaisser)` },
      { key: 'diff',     label: '🎯 Meilleure différence', get: j => statsDetaillees[j]?.ga ?? -Infinity, detail: v => `différence de buts de ${v > 0 ? '+' : ''}${v}, la meilleure du groupe` },
      { key: 'serie',    label: '🔥 Série de feu',         get: j => advancedStats[j]?.maxWinStreak || 0, detail: v => `série record de ${v} victoires consécutives` },
      { key: 'invinc',   label: '🛡️ Invincible',           get: j => advancedStats[j]?.maxUnbeatenStreak || 0, detail: v => `${v} matchs d'affilée sans défaite` },
      { key: 'tauxV',    label: '📈 Machine à gagner',     get: j => { const s = cl(j); return s && s.matchs ? s.victoires / s.matchs : 0; }, detail: v => `${Math.round(v * 100)}% de victoires, le meilleur ratio` },
      { key: 'attaque',  label: '💥 Artilleur',            get: j => { const s = cl(j); return s && s.matchs ? (statsDetaillees[j]?.buts_pour || 0) / s.matchs : 0; }, detail: v => `${v.toFixed(2)} buts marqués par match en moyenne` },
    ];

    // Classement des joueurs par métrique (rang 1 = meilleur)
    const ranks = {}; // ranks[metricKey][joueur] = rang (1..n)
    metrics.forEach(m => {
      const ordered = [...joueurs].map(j => ({ j, v: m.get(j) })).sort((a, b) => b.v - a.v);
      ranks[m.key] = {};
      ordered.forEach((o, i) => { ranks[m.key][o.j] = { rank: i + 1, value: o.v }; });
    });

    // Assignation gloutonne : on prend itérativement la meilleure paire (joueur, métrique)
    const result = {};
    const usedMetrics = new Set();
    const candidates = [];
    joueurs.forEach(j => metrics.forEach(m => {
      const r = ranks[m.key][j];
      if (r.value > 0) candidates.push({ j, m, rank: r.rank, value: r.value });
    }));
    candidates.sort((a, b) => a.rank - b.rank || b.value - a.value);
    candidates.forEach(c => {
      if (result[c.j] || usedMetrics.has(c.m.key)) return;
      result[c.j] = { label: c.m.label, detail: c.m.detail(c.value) };
      usedMetrics.add(c.m.key);
    });
    joueurs.forEach(j => { if (!result[j]) result[j] = null; });
    return result;
  }, [joueurs, classementGeneral, statsDetaillees, cleanSheetsStats, advancedStats]);

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

  /* Bulle détail signature (partagée entre les deux vues) */
  const sigBubbleEl = sigBubble && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={() => setSigBubble(null)}
    >
      <div
        className="bg-white dark:bg-[#15131f] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-6 max-w-xs w-full text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{sigBubble.label}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{sigBubble.joueur}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{sigBubble.detail}</p>
        <button
          onClick={() => setSigBubble(null)}
          className="mt-4 px-4 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          Fermer
        </button>
      </div>
    </div>
  );

  /* ---------- Vue profil détaillé ---------- */
  if (selectedPlayer) {
    const stats = classementGeneral.find(c => c.joueur === selectedPlayer);
    const adv = advancedStats[selectedPlayer];
    const gloire = heureDeGloire[selectedPlayer];
    const fullForm = adv?.recentForm?.map(m => m.result) || [];
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedPlayer(null)}
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
              {signatures[selectedPlayer] && (
                <button
                  onClick={() => setSigBubble({ joueur: selectedPlayer, label: signatures[selectedPlayer].label, detail: signatures[selectedPlayer].detail })}
                  className="mt-2 inline-block text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  {signatures[selectedPlayer].label}
                </button>
              )}
            </div>
          </div>

          {/* Bilan + forme */}
          <div className="grid grid-cols-4 gap-2 mt-6 pt-6 border-t dark:border-slate-700 text-center">
            <div><div className="text-xl font-bold text-slate-700 dark:text-slate-200">{stats?.matchs ?? 0}</div><div className="text-xs text-slate-500 dark:text-slate-400">Matchs</div></div>
            <div><div className="text-xl font-bold text-green-600">{stats?.victoires ?? 0}</div><div className="text-xs text-slate-500 dark:text-slate-400">Victoires</div></div>
            <div><div className="text-xl font-bold text-slate-400">{stats?.nuls ?? 0}</div><div className="text-xs text-slate-500 dark:text-slate-400">Nuls</div></div>
            <div><div className="text-xl font-bold text-red-600">{stats?.defaites ?? 0}</div><div className="text-xs text-slate-500 dark:text-slate-400">Défaites</div></div>
          </div>
          <div className="mt-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 text-center">Forme récente</p>
            <FormPills form={fullForm} size="lg" />
          </div>
          {gloire && (
            <div className="mt-5 pt-5 border-t dark:border-slate-700 text-center">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">⭐ Heure de gloire</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{gloire.ligue} {gloire.championnat} — {gloire.avg} pts/match</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{gloire.saison}</p>
            </div>
          )}
        </div>

        {/* Head-to-head */}
        <div className="bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Confrontations directes</h3>
            <select
              value={h2hLigue}
              onChange={(e) => setH2hLigue(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">Toutes les ligues</option>
              {ligues.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
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
                    <span className="font-bold text-green-600">{w}V</span>
                    <span className="font-bold text-slate-400">{d}N</span>
                    <span className="font-bold text-red-600">{l}D</span>
                    <span className="text-slate-500 dark:text-slate-400">• {bf}-{ba} buts</span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">Aucune confrontation</span>
                )}
              </div>
            ))}
          </div>
        </div>
        {sigBubbleEl}
      </div>
    );
  }

  /* ---------- Vue grille des cartes ---------- */
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {joueurs.map(joueur => {
        const adv = advancedStats[joueur];
        const form = adv?.recentForm?.map(m => m.result).slice(-5) || [];
        const sig = signatures[joueur];
        const color = playerColorHex[joueur];
        return (
          <div
            key={joueur}
            role="button"
            tabIndex={0}
            onClick={() => { setSelectedPlayer(joueur); setH2hLigue('all'); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedPlayer(joueur); setH2hLigue('all'); } }}
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
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">pts</span>
              </div>

              {/* Forme */}
              <div className="mt-3">
                <FormPills form={form} />
              </div>

              {/* Signature en chip cliquable */}
              {sig && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSigBubble({ joueur, label: sig.label, detail: sig.detail }); }}
                  className="mt-3 inline-block px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 leading-tight hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                >
                  {sig.label}
                </button>
              )}

              <span className="mt-3 text-[11px] font-medium text-slate-400 dark:text-slate-500 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors">
                Voir le profil →
              </span>
            </div>
          </div>
        );
      })}

      {sigBubbleEl}
    </div>
  );
}
