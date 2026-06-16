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

  /* Stat signature : la catégorie où chaque joueur domine */
  const signatures = useMemo(() => {
    const cs = {};
    cleanSheetsStats.forEach(c => { cs[c.joueur] = c.cleanSheets; });

    const metrics = [
      { key: 'titres',  label: '👑 Roi du championnat', get: j => classementGeneral.find(c => c.joueur === j)?.victoiresChampionnat || 0, better: 'max' },
      { key: 'buteur',  label: '⚽ Meilleur buteur',     get: j => statsDetaillees[j]?.buts_pour || 0, better: 'max' },
      { key: 'mur',     label: '🧤 Mur défensif',        get: j => cs[j] || 0, better: 'max' },
      { key: 'attaque', label: '🎯 Meilleure différence', get: j => statsDetaillees[j]?.ga ?? -Infinity, better: 'max' },
    ];

    // Pour chaque métrique, trouver le leader unique
    const leaders = {};
    metrics.forEach(m => {
      const vals = joueurs.map(j => ({ j, v: m.get(j) }));
      const best = Math.max(...vals.map(x => x.v));
      const top = vals.filter(x => x.v === best && best > 0);
      if (top.length === 1) leaders[m.key] = top[0].j;
    });

    // Assigner à chaque joueur la 1re métrique (par priorité) où il est leader unique
    const result = {};
    joueurs.forEach(j => {
      const m = metrics.find(mm => leaders[mm.key] === j);
      result[j] = m ? { label: m.label, value: m.get(j) } : null;
    });
    return result;
  }, [joueurs, classementGeneral, statsDetaillees, cleanSheetsStats]);

  /* Head-to-head du joueur sélectionné contre tous les autres */
  const h2h = useMemo(() => {
    if (!selectedPlayer) return [];
    return joueurs.filter(j => j !== selectedPlayer).map(opp => {
      let matches = filteredData.filter(m =>
        (m.joueur1 === selectedPlayer && m.joueur2 === opp) ||
        (m.joueur1 === opp && m.joueur2 === selectedPlayer));
      if (h2hLigue !== 'all') matches = matches.filter(m => m.ligue === h2hLigue);
      let w = 0, d = 0, l = 0, bf = 0, ba = 0;
      const history = [...matches].sort((a, b) => new Date(a.dateMatch) - new Date(b.dateMatch)).map(m => {
        const pIs1 = m.joueur1 === selectedPlayer;
        const bp = pIs1 ? m.buts_j1 : m.buts_j2;
        const bc = pIs1 ? m.buts_j2 : m.buts_j1;
        bf += bp; ba += bc;
        const res = bp > bc ? 'W' : bp < bc ? 'L' : 'D';
        if (res === 'W') w++; else if (res === 'D') d++; else l++;
        return { res, bp, bc, ligue: m.ligue, championnat: m.championnat, date: new Date(m.dateMatch).toLocaleDateString('fr-FR') };
      });
      return { opp, w, d, l, bf, ba, matchs: matches.length, history };
    });
  }, [selectedPlayer, joueurs, filteredData, h2hLigue]);

  const rankOf = j => classementGeneral.findIndex(c => c.joueur === j) + 1;
  const pointsOf = j => classementGeneral.find(c => c.joueur === j)?.points ?? 0;

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
                <p className="mt-2 text-sm font-semibold text-violet-600 dark:text-violet-400">{signatures[selectedPlayer].label}</p>
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
          <div className="space-y-4">
            {h2h.map(({ opp, w, d, l, bf, ba, matchs, history }) => (
              <div key={opp} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Avatar joueur={opp} className="w-10 h-10 border-2 flex-shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">vs {opp}</span>
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
                {history.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-3">
                    {history.map((m, i) => (
                      <span
                        key={i}
                        title={`${m.bp}-${m.bc} • ${m.ligue} ${m.championnat} • ${m.date}`}
                        className={`px-1.5 h-6 rounded flex items-center justify-center text-[11px] font-bold text-white ${
                          m.res === 'W' ? 'bg-green-600' : m.res === 'L' ? 'bg-red-600' : 'bg-slate-400'
                        }`}
                      >
                        {m.bp}-{m.bc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
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
        return (
          <button
            key={joueur}
            onClick={() => { setSelectedPlayer(joueur); setH2hLigue('all'); }}
            className="text-left bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e] p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
            style={{ borderTopWidth: 3, borderTopColor: playerColorHex[joueur] }}
          >
            <div className="flex flex-col items-center text-center">
              <Avatar joueur={joueur} className="w-16 h-16 sm:w-20 sm:h-20 border-[3px] shadow mb-2" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100">{joueur}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold" style={{ color: playerColorHex[joueur] }}>#{rankOf(joueur)}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{pointsOf(joueur)} pts</span>
              </div>
              <div className="mt-3">
                <FormPills form={form} />
              </div>
              {sig && (
                <p className="mt-3 text-[11px] sm:text-xs font-semibold text-violet-600 dark:text-violet-400 leading-tight">{sig.label}</p>
              )}
              <span className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">Voir le détail →</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
