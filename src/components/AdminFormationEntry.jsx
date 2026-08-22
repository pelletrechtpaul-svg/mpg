import { useMemo } from 'react';
import { PlayerAvatar } from './PlayerAvatar.jsx';
import { FORMATION_SLOTS, FORMATION_ROW_TOP, SLOT_OFFSET_CLASS, PitchLines, computeFormation } from './FormationPitch.jsx';
import { champNum, playerDisplayName } from './AdminScorerSection.jsx';

function formatNote(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Effectif d'un coach pour un championnat donné, dédupliqué par joueur —
// exporté pour être réutilisé à la sauvegarde d'un match (backfill des notes
// par défaut, voir AdminAddMatchForm/AdminEditPanel) sans dupliquer cette
// logique de filtrage.
export function buildSquad(mercatoData, coach, saison, ligue, championnat) {
  const cNum = champNum(championnat);
  if (!coach || !saison || !ligue || cNum == null) return [];
  const seen = new Set();
  return (mercatoData || [])
    .filter(p => p.saison === saison && p.ligue === ligue && p.championnat === cNum && p.acheteur === coach)
    .filter(p => { if (seen.has(p.joueur)) return false; seen.add(p.joueur); return true; });
}

// Complète un tableau de notes avec une note par défaut pour chaque joueur de
// l'effectif d'un coach qui n'a pas encore été noté explicitement pour ce
// match — sans ça, un joueur laissé à la valeur par défaut (5, jamais touché
// au stepper) n'a tout simplement pas d'entrée en base et ne compte pas dans
// la moyenne du championnat.
export function withDefaultNotes(notesForMatch, squad, coach, defaultNote = 5) {
  const already = new Set(notesForMatch.filter(n => n.acheteur === coach).map(n => n.joueur));
  const additions = squad.filter(m => !already.has(m.joueur)).map(m => ({ joueur: m.joueur, acheteur: coach, note: defaultNote }));
  return additions.length ? [...notesForMatch, ...additions] : notesForMatch;
}

// Terrain interactif de saisie admin : reprend le layout visuel de
// FormationPitch (lecture seule, utilisé pour l'affichage effectifs) mais
// chaque avatar devient cliquable pour taguer un but réel / virtuel MPG, et
// porte un stepper de note. Volontairement séparé de FormationPitch pour ne
// pas mélanger logique d'affichage et logique de saisie dans le même
// composant partagé ailleurs en lecture seule.
export function AdminFormationEntry({ coach, matchKey, saison, ligue, championnat, mercatoData, buteurs, setButeurs, notes, setNotes, photos }) {
  const squad = useMemo(() => buildSquad(mercatoData, coach, saison, ligue, championnat), [mercatoData, coach, saison, ligue, championnat]);

  const current = buteurs[matchKey] || [];
  const notesCurrent = notes[matchKey] || [];

  const goalsFor = (joueur) => ({
    real: current.find(s => s.acheteur === coach && s.joueur === joueur && !s.csc && !s.virtuel)?.buts || 0,
    virtuel: current.find(s => s.acheteur === coach && s.joueur === joueur && !s.csc && s.virtuel)?.buts || 0,
  });

  const noteFor = (joueur) => notesCurrent.find(n => n.acheteur === coach && n.joueur === joueur)?.note ?? 5;

  // Un but réel et un but virtuel MPG s'excluent mutuellement pour un même
  // joueur sur un même match : il faut d'abord retirer l'un pour pouvoir
  // ajouter l'autre, plutôt que de laisser les deux cumuler.
  const bumpReal = (m) => {
    setButeurs(prev => {
      const arr = prev[matchKey] || [];
      if (arr.some(s => s.acheteur === coach && s.joueur === m.joueur && !s.csc && s.virtuel)) return prev;
      const idx = arr.findIndex(s => s.acheteur === coach && s.joueur === m.joueur && !s.csc && !s.virtuel);
      if (idx >= 0) return { ...prev, [matchKey]: arr.map((s, i) => i === idx ? { ...s, buts: Math.min(10, s.buts + 1) } : s) };
      return { ...prev, [matchKey]: [...arr, { joueur: m.joueur, displayName: playerDisplayName(m), buts: 1, acheteur: coach, csc: false }] };
    });
  };

  const decrementReal = (joueur) => {
    setButeurs(prev => {
      const arr = prev[matchKey] || [];
      const idx = arr.findIndex(s => s.acheteur === coach && s.joueur === joueur && !s.csc && !s.virtuel);
      if (idx < 0) return prev;
      if (arr[idx].buts <= 1) return { ...prev, [matchKey]: arr.filter((_, i) => i !== idx) };
      return { ...prev, [matchKey]: arr.map((s, i) => i === idx ? { ...s, buts: s.buts - 1 } : s) };
    });
  };

  // But virtuel MPG : simple bascule 0/1 (une bonification de note supérieure
  // à 1 par match n'arrive quasiment jamais) plutôt qu'un compteur — un tap
  // suffit à taguer/détaguer, pas besoin d'un second geste pour retirer.
  const toggleVirtuel = (m) => {
    setButeurs(prev => {
      const arr = prev[matchKey] || [];
      const idx = arr.findIndex(s => s.acheteur === coach && s.joueur === m.joueur && !s.csc && s.virtuel);
      if (idx >= 0) return { ...prev, [matchKey]: arr.filter((_, i) => i !== idx) };
      if (arr.some(s => s.acheteur === coach && s.joueur === m.joueur && !s.csc && !s.virtuel)) return prev;
      return { ...prev, [matchKey]: [...arr, { joueur: m.joueur, displayName: playerDisplayName(m), buts: 1, acheteur: coach, csc: false, virtuel: true }] };
    });
  };

  const bumpNote = (joueur, delta) => {
    setNotes(prev => {
      const arr = prev[matchKey] || [];
      const idx = arr.findIndex(n => n.acheteur === coach && n.joueur === joueur);
      const base = idx >= 0 ? arr[idx].note : 5;
      const val = Math.max(0, Math.min(10, Math.round((base + delta) * 2) / 2));
      if (idx >= 0) return { ...prev, [matchKey]: arr.map((n, i) => i === idx ? { ...n, note: val } : n) };
      return { ...prev, [matchKey]: [...arr, { joueur, acheteur: coach, note: val }] };
    });
  };

  if (squad.length === 0) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500 italic mt-2">
        Aucun joueur recruté par {coach} sur ce championnat.
      </p>
    );
  }

  const { starters, bench } = computeFormation(squad);

  return (
    <div className="mt-2">
      <div className="sm:max-w-sm sm:mx-auto">
        {/* paddingBottom plus généreux qu'en lecture seule (FormationPitch,
            133%) : la carte admin ajoute un stepper de note sous chaque
            titulaire, plus haut que le simple prix affiché en lecture seule.
            Avec 133%, le gardien (ligne la plus basse) avait sa note coupée
            par l'overflow-hidden du terrain. */}
        <div className="relative rounded-2xl overflow-hidden border-[3px] border-white/90" style={{ paddingBottom: '178%' }}>
          <PitchLines />
          {['Attaquants', 'Milieux', 'Défenseurs', 'Gardien'].map(group => (
            <AdminFormationRow
              key={group} group={group} players={starters[group]} photos={photos}
              goalsFor={goalsFor} noteFor={noteFor} bumpReal={bumpReal} decrementReal={decrementReal}
              toggleVirtuel={toggleVirtuel} bumpNote={bumpNote}
            />
          ))}
        </div>

        {bench.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Reste de l'effectif <span className="normal-case font-normal">(clic photo = but, 🎮 = virtuel)</span>
            </p>
            <div className="space-y-1.5">
              {bench.map(m => {
                const { real, virtuel } = goalsFor(m.joueur);
                return (
                  <div key={m.joueur} className="flex items-center gap-1.5 text-xs">
                    <div className="relative w-8 h-8 flex-shrink-0">
                      <button type="button" onClick={() => bumpReal(m)}
                        title={virtuel > 0 ? 'Retirer le but virtuel avant d\'ajouter un but réel' : undefined}
                        className={`block w-full h-full rounded-full overflow-hidden ${virtuel > 0 ? 'opacity-50' : ''} ${real > 0 || virtuel > 0 ? 'ring-2 ring-green-500' : 'ring-1 ring-slate-400 dark:ring-slate-500'}`}>
                        <PlayerAvatar joueur={m.joueur} ligue={m.ligue} displayName={m.joueur} photos={photos} size="sm" />
                      </button>
                      {real > 0 && (
                        <button type="button" onClick={() => decrementReal(m.joueur)}
                          className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-0.5 rounded-full bg-green-600 text-white text-[10px] font-bold leading-[18px] text-center">
                          {real}
                        </button>
                      )}
                      <button type="button" onClick={() => toggleVirtuel(m)}
                        title={real > 0 ? 'Retirer le(s) but(s) réel(s) avant d\'ajouter un but virtuel' : 'But virtuel MPG'}
                        className={`absolute -bottom-1.5 -right-1.5 w-[18px] h-[18px] rounded-full text-[9px] leading-[17px] text-center ${virtuel ? 'bg-indigo-600' : 'bg-white/90 dark:bg-slate-700/90 border border-indigo-300 dark:border-indigo-500'} ${real > 0 && !virtuel ? 'opacity-40' : ''}`}>
                        🎮
                      </button>
                    </div>
                    <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                      {m.joueur} <span className="text-slate-400 dark:text-slate-500">({m.poste})</span>
                    </span>
                    <span className="flex items-center gap-0.5 flex-shrink-0 bg-slate-100 dark:bg-slate-700 rounded px-0.5 py-0.5">
                      <button type="button" onClick={() => bumpNote(m.joueur, -0.5)} className="w-5 h-5 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-sm leading-none">−</button>
                      <span className="w-5 text-center font-semibold text-slate-700 dark:text-slate-200">{formatNote(noteFor(m.joueur))}</span>
                      <button type="button" onClick={() => bumpNote(m.joueur, 0.5)} className="w-5 h-5 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-sm leading-none">+</button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminFormationRow({ group, players, photos, goalsFor, noteFor, bumpReal, decrementReal, toggleVirtuel, bumpNote }) {
  const slots = FORMATION_SLOTS[group];
  return (
    <div className="absolute inset-x-0 flex justify-around px-1 sm:px-4" style={{ top: `${FORMATION_ROW_TOP[group]}%` }}>
      {Array.from({ length: slots }).map((_, i) => {
        const m = players[i];
        const offsetClass = SLOT_OFFSET_CLASS[group][i] || '';
        if (!m) {
          return (
            <div key={i} className={`relative w-11 h-11 sm:w-14 sm:h-14 ${offsetClass}`}>
              <div className="w-full h-full rounded-full border-2 border-dashed border-slate-800/50" />
            </div>
          );
        }
        const { real, virtuel } = goalsFor(m.joueur);
        return (
          <div key={i} className={`relative w-11 h-11 sm:w-14 sm:h-14 ${offsetClass}`}>
            <button type="button" onClick={() => bumpReal(m)} title={virtuel > 0 ? 'Retirer le but virtuel avant d\'ajouter un but réel' : '+1 but'}
              className={`block w-full h-full ${virtuel > 0 ? 'opacity-50' : ''}`}>
              <div className={`w-full h-full rounded-full shadow-lg ${real > 0 || virtuel > 0 ? 'ring-4 ring-green-500' : 'ring-2 ring-slate-900/70'}`}>
                <PlayerAvatar joueur={m.joueur} ligue={m.ligue} displayName={m.joueur} photos={photos} size="formation" />
              </div>
            </button>
            {real > 0 && (
              <button type="button" onClick={() => decrementReal(m.joueur)} title="Retirer un but"
                className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-0.5 rounded-full bg-green-600 text-white text-[11px] font-bold leading-5 text-center">
                {real}
              </button>
            )}
            <button type="button" onClick={() => toggleVirtuel(m)}
              title={real > 0 ? 'Retirer le(s) but(s) réel(s) avant d\'ajouter un but virtuel' : 'But virtuel MPG'}
              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full text-[10px] leading-5 text-center ${virtuel ? 'bg-indigo-600' : 'bg-white/90 dark:bg-slate-700/90 border border-indigo-300 dark:border-indigo-500'} ${real > 0 && !virtuel ? 'opacity-40' : ''}`}>
              🎮
            </button>
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-max max-w-[70px] px-1 py-0.5 rounded bg-black/55 text-[10px] sm:text-xs font-bold text-white leading-tight text-center truncate">
              {m.joueur}
            </span>
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-6 sm:mt-7 flex items-center gap-0.5 bg-black/55 rounded px-0.5 py-0.5">
              <button type="button" onClick={() => bumpNote(m.joueur, -0.5)} className="w-5 h-5 flex items-center justify-center text-white text-sm font-bold leading-none">−</button>
              <span className="text-white text-[10px] sm:text-xs font-bold leading-none w-5 text-center">{formatNote(noteFor(m.joueur))}</span>
              <button type="button" onClick={() => bumpNote(m.joueur, 0.5)} className="w-5 h-5 flex items-center justify-center text-white text-sm font-bold leading-none">+</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
