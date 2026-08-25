import { useState, useMemo } from 'react';
import { Check } from 'lucide-react';
import { buildSquad } from './AdminFormationEntry.jsx';
import { POSTE_GROUP, POSTE_GROUP_ORDER } from './FormationPitch.jsx';
import { usePlayerPhotos, PlayerAvatar } from './PlayerAvatar.jsx';

// Bac à sable 100% local (aucune lecture/écriture de match, seul l'effectif
// mercato est lu en base pour avoir des données réalistes) pour tester la
// nouvelle UX de saisie (triage titulaire/banc/loft, notation en 2 temps,
// rotaldos) avant de la brancher sur la vraie saisie/édition de match.
// Rien ici n'est sauvegardé nulle part.

function formatNote(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function sortByPoste(squad) {
  return [...squad].sort((a, b) => {
    const gA = POSTE_GROUP_ORDER.indexOf(POSTE_GROUP[a.poste] || 'Milieux');
    const gB = POSTE_GROUP_ORDER.indexOf(POSTE_GROUP[b.poste] || 'Milieux');
    return gA !== gB ? gA - gB : (b.prix || 0) - (a.prix || 0);
  });
}

const emptyCoachState = () => ({ step: 'triage', statuts: {}, notes: {}, buts: {} });

function StatutButton({ active, onClick, children, className }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
        active ? className : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'
      }`}>
      {active && <Check className="w-3.5 h-3.5" />} {children}
    </button>
  );
}

function TriageRow({ m, statut, onSetStatut, photos }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <PlayerAvatar joueur={m.joueur} ligue={m.ligue} displayName={m.joueur} photos={photos} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
        {m.joueur} <span className="text-slate-400 dark:text-slate-500 text-xs">({m.poste})</span>
      </span>
      <div className="flex gap-1 w-40 flex-shrink-0">
        <StatutButton active={statut === 'compte'} onClick={() => onSetStatut(m.joueur, 'compte')}
          className="bg-green-100 dark:bg-green-900/40 border-green-400 dark:border-green-600 text-green-700 dark:text-green-400">
          Compte
        </StatutButton>
        <StatutButton active={statut === 'banc'} onClick={() => onSetStatut(m.joueur, 'banc')}
          className="bg-amber-100 dark:bg-amber-900/40 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400">
          Banc
        </StatutButton>
      </div>
    </div>
  );
}

function NotationRow({ m, note, buts, onBumpNote, onResetNote, onBumpReal, onDecrementReal, onBumpVirtuel, onDecrementVirtuel, allowVirtuel, photos }) {
  const real = buts?.real || 0;
  const virtuel = buts?.virtuel || 0;
  const noted = note != null;
  return (
    <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1 py-1.5 text-xs">
      <PlayerAvatar joueur={m.joueur} ligue={m.ligue} displayName={m.joueur} photos={photos} size="sm" />
      <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
        {m.joueur} <span className="text-slate-400 dark:text-slate-500">({m.poste})</span>
      </span>
      <span className="flex items-center gap-1 flex-shrink-0">
        <button type="button" onClick={() => onBumpReal(m.joueur)}
          title={virtuel > 0 ? 'Retirer le but MPG avant d\'ajouter un but' : undefined}
          className={`px-1.5 h-6 rounded font-semibold ${virtuel > 0 ? 'opacity-40 text-slate-400' : 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 active:bg-green-100'}`}>
          But{real > 0 && ` ${real}`}
        </button>
        {real > 0 && (
          <button type="button" onClick={() => onDecrementReal(m.joueur)} title="Retirer un but"
            className="w-6 h-6 rounded-full bg-green-600 text-white text-[11px] font-bold leading-none">×</button>
        )}
        {allowVirtuel && (
          <>
            <button type="button" onClick={() => onBumpVirtuel(m.joueur)}
              title={real > 0 ? 'Retirer le(s) but(s) réel(s) avant d\'ajouter un but MPG' : (virtuel > 0 ? 'Un seul but MPG par joueur et par match' : undefined)}
              className={`px-1.5 h-6 rounded font-semibold ${real > 0 ? 'opacity-40 text-slate-400' : virtuel > 0 ? 'text-white bg-indigo-600' : 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 active:bg-indigo-100'}`}>
              But MPG
            </button>
            {virtuel > 0 && (
              <button type="button" onClick={() => onDecrementVirtuel(m.joueur)} title="Retirer un but MPG"
                className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-bold leading-none">×</button>
            )}
          </>
        )}
      </span>
      <span className="flex items-center gap-0.5 flex-shrink-0 bg-slate-100 dark:bg-slate-700 rounded px-0.5 py-0.5">
        <button type="button" onClick={() => onBumpNote(m.joueur, -0.5)} className="w-6 h-6 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-sm leading-none">−</button>
        <button type="button" onClick={() => onResetNote(m.joueur)} disabled={!noted}
          title={noted ? 'Remettre à zéro (non noté)' : undefined}
          className={`w-5 text-center font-semibold ${noted ? 'text-slate-700 dark:text-slate-200' : 'text-red-600 dark:text-red-400 cursor-default'}`}>
          {noted ? formatNote(note) : 'X'}
        </button>
        <button type="button" onClick={() => onBumpNote(m.joueur, 0.5)} className="w-6 h-6 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-sm leading-none">+</button>
      </span>
    </div>
  );
}

function CoachColumn({ coach, squad, state, setState, photos }) {
  const sorted = useMemo(() => sortByPoste(squad), [squad]);
  const compteList = sorted.filter(m => state.statuts[m.joueur] === 'compte');
  const bancList = sorted.filter(m => state.statuts[m.joueur] === 'banc');
  const loftList = sorted.filter(m => !state.statuts[m.joueur]);
  const rotaldos = Math.max(0, 11 - compteList.length);

  const setStatut = (joueur, val) => setState(prev => ({
    ...prev,
    statuts: { ...prev.statuts, [joueur]: prev.statuts[joueur] === val ? undefined : val },
  }));

  const bumpNote = (joueur, delta) => setState(prev => {
    const base = prev.notes[joueur] ?? 5;
    const val = Math.max(0, Math.min(10, Math.round((base + delta) * 2) / 2));
    return { ...prev, notes: { ...prev.notes, [joueur]: val } };
  });
  const resetNote = (joueur) => setState(prev => {
    const notes = { ...prev.notes };
    delete notes[joueur];
    return { ...prev, notes };
  });

  const bumpReal = (joueur) => setState(prev => {
    const cur = prev.buts[joueur] || { real: 0, virtuel: 0 };
    if (cur.virtuel > 0) return prev;
    return { ...prev, buts: { ...prev.buts, [joueur]: { ...cur, real: Math.min(10, cur.real + 1) } } };
  });
  const decrementReal = (joueur) => setState(prev => {
    const cur = prev.buts[joueur] || { real: 0, virtuel: 0 };
    return { ...prev, buts: { ...prev.buts, [joueur]: { ...cur, real: Math.max(0, cur.real - 1) } } };
  });
  const bumpVirtuel = (joueur) => setState(prev => {
    const cur = prev.buts[joueur] || { real: 0, virtuel: 0 };
    if (cur.real > 0 || cur.virtuel > 0) return prev;
    return { ...prev, buts: { ...prev.buts, [joueur]: { ...cur, virtuel: 1 } } };
  });
  const decrementVirtuel = (joueur) => setState(prev => {
    const cur = prev.buts[joueur] || { real: 0, virtuel: 0 };
    return { ...prev, buts: { ...prev.buts, [joueur]: { ...cur, virtuel: 0 } } };
  });

  if (squad.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500 italic">Aucun joueur recruté par {coach} sur ce championnat.</p>;
  }

  if (state.step === 'triage') {
    return (
      <div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
          Coche "Compte" (titulaire non remplacé ou remplaçant entré) ou "Banc" (remplaçant resté sur le banc). Ni l'un ni l'autre = loft / non concerné.
        </p>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {sorted.map(m => (
            <TriageRow key={m.joueur} m={m} statut={state.statuts[m.joueur]} onSetStatut={setStatut} photos={photos} />
          ))}
        </div>
        <button type="button" onClick={() => setState(prev => ({ ...prev, step: 'notation' }))}
          className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Suivant →
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => setState(prev => ({ ...prev, step: 'triage' }))}
        className="mb-3 text-xs text-blue-600 dark:text-blue-400 hover:underline">← Précédent</button>

      {rotaldos > 0 && (
        <p className="mb-2 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/20 rounded-lg px-2 py-1">
          🎲 {rotaldos} rotaldo{rotaldos > 1 ? 's' : ''} calculé{rotaldos > 1 ? 's' : ''} (11 − {compteList.length} qui comptent)
        </p>
      )}

      <p className="text-[11px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">✅ Comptent dans le match ({compteList.length})</p>
      {compteList.length === 0 ? (
        <p className="text-xs text-slate-400 italic mb-2">Aucun.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700 mb-3">
          {compteList.map(m => (
            <NotationRow key={m.joueur} m={m} note={state.notes[m.joueur]} buts={state.buts[m.joueur]}
              onBumpNote={bumpNote} onResetNote={resetNote} onBumpReal={bumpReal} onDecrementReal={decrementReal}
              onBumpVirtuel={bumpVirtuel} onDecrementVirtuel={decrementVirtuel} allowVirtuel photos={photos} />
          ))}
        </div>
      )}

      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">🪑 Restés/finis sur le banc ({bancList.length})</p>
      {bancList.length === 0 ? (
        <p className="text-xs text-slate-400 italic mb-2">Aucun.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700 mb-3">
          {bancList.map(m => (
            <NotationRow key={m.joueur} m={m} note={state.notes[m.joueur]} buts={state.buts[m.joueur]}
              onBumpNote={bumpNote} onResetNote={resetNote} onBumpReal={bumpReal} onDecrementReal={decrementReal}
              onBumpVirtuel={bumpVirtuel} onDecrementVirtuel={decrementVirtuel} allowVirtuel={false} photos={photos} />
          ))}
        </div>
      )}

      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">📦 Loft, indicatif ({loftList.length})</p>
      {loftList.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Aucun.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {loftList.map(m => (
            <span key={m.joueur} className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 rounded px-1.5 py-0.5">{m.joueur}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminSaisieTest({ mercatoData, joueurs }) {
  const photos = usePlayerPhotos();
  const [selSaison, setSelSaison] = useState('');
  const [selLigue, setSelLigue] = useState('');
  const [selChamp, setSelChamp] = useState('');
  const [coach1, setCoach1] = useState('');
  const [coach2, setCoach2] = useState('');
  const [states, setStates] = useState({});
  const [showResult, setShowResult] = useState(false);

  const saisons = useMemo(() => [...new Set(mercatoData.map(m => m.saison))].sort().reverse(), [mercatoData]);
  const ligues = useMemo(() => [...new Set(mercatoData.filter(m => m.saison === selSaison).map(m => m.ligue))], [mercatoData, selSaison]);
  const championnats = useMemo(() =>
    [...new Set(mercatoData.filter(m => m.saison === selSaison && m.ligue === selLigue).map(m => m.championnat))]
      .sort((a, b) => a - b).map(n => `#${n}`),
    [mercatoData, selSaison, selLigue]);

  const squad1 = useMemo(() => buildSquad(mercatoData, coach1, selSaison, selLigue, selChamp), [mercatoData, coach1, selSaison, selLigue, selChamp]);
  const squad2 = useMemo(() => buildSquad(mercatoData, coach2, selSaison, selLigue, selChamp), [mercatoData, coach2, selSaison, selLigue, selChamp]);

  const stateFor = (coach) => states[coach] || emptyCoachState();
  const setStateFor = (coach, updater) => setStates(prev => ({ ...prev, [coach]: updater(prev[coach] || emptyCoachState()) }));

  const ready = coach1 && coach2 && coach1 !== coach2 && selChamp;
  const bothDone = ready && stateFor(coach1).step === 'notation' && stateFor(coach2).step === 'notation';

  const summaryFor = (coach, squad) => {
    const s = stateFor(coach);
    const compte = squad.filter(m => s.statuts[m.joueur] === 'compte');
    const banc = squad.filter(m => s.statuts[m.joueur] === 'banc');
    const rotaldos = Math.max(0, 11 - compte.length);
    return { coach, compte, banc, rotaldos, notes: s.notes, buts: s.buts };
  };

  return (
    <div>
      <div className="bg-fuchsia-50 dark:bg-fuchsia-900/20 border border-fuchsia-200 dark:border-fuchsia-800 rounded-xl p-3 mb-4 text-xs text-fuchsia-800 dark:text-fuchsia-300">
        🧪 Bac à sable UX — rien n'est sauvegardé ici. Seul l'effectif mercato est lu en base (lecture seule) pour tester avec des vraies données.
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <select value={selSaison} onChange={e => { setSelSaison(e.target.value); setSelLigue(''); setSelChamp(''); }}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-slate-200">
          <option value="">Saison...</option>
          {saisons.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={selLigue} onChange={e => { setSelLigue(e.target.value); setSelChamp(''); }} disabled={!selSaison}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-slate-200 disabled:opacity-50">
          <option value="">Ligue...</option>
          {ligues.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={selChamp} onChange={e => setSelChamp(e.target.value)} disabled={!selLigue}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-slate-200 disabled:opacity-50">
          <option value="">Championnat...</option>
          {championnats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <select value={coach1} onChange={e => setCoach1(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-slate-200">
          <option value="">Entraîneur 1...</option>
          {joueurs.filter(j => j !== coach2).map(j => <option key={j} value={j}>{j}</option>)}
        </select>
        <select value={coach2} onChange={e => setCoach2(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-slate-200">
          <option value="">Entraîneur 2...</option>
          {joueurs.filter(j => j !== coach1).map(j => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>

      {ready && (
        <>
          <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl p-3 mb-4 text-xs text-slate-500 dark:text-slate-400">
            ⚠️ Score / Valise / CSC — inchangé, non interactif dans ce test (on ne teste que la partie effectif ci-dessous).
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="border-l-2 border-blue-300 dark:border-blue-600 pl-3">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">{coach1}</h4>
              <CoachColumn coach={coach1} squad={squad1} state={stateFor(coach1)} setState={u => setStateFor(coach1, u)} photos={photos} />
            </div>
            <div className="border-l-2 border-emerald-300 dark:border-emerald-600 pl-3">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">{coach2}</h4>
              <CoachColumn coach={coach2} squad={squad2} state={stateFor(coach2)} setState={u => setStateFor(coach2, u)} photos={photos} />
            </div>
          </div>

          <button type="button" disabled={!bothDone} onClick={() => setShowResult(true)}
            className={`mt-5 w-full px-6 py-3 rounded-xl font-semibold text-white ${bothDone ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-300 cursor-not-allowed'}`}>
            ✅ Valider (test — aperçu du résultat, rien n'est sauvegardé)
          </button>

          {showResult && bothDone && (
            <div className="mt-4 bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-xs space-y-3">
              {[summaryFor(coach1, squad1), summaryFor(coach2, squad2)].map(s => (
                <div key={s.coach}>
                  <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{s.coach} — {s.rotaldos} rotaldo{s.rotaldos > 1 ? 's' : ''}</p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Comptent : {s.compte.map(m => `${m.joueur} (${s.notes[m.joueur] != null ? formatNote(s.notes[m.joueur]) : 'X'}${s.buts[m.joueur]?.real ? `, ${s.buts[m.joueur].real} but` : ''}${s.buts[m.joueur]?.virtuel ? ', 1 but MPG' : ''})`).join(', ') || '—'}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Banc : {s.banc.map(m => `${m.joueur} (${s.notes[m.joueur] != null ? formatNote(s.notes[m.joueur]) : 'X'}${s.buts[m.joueur]?.real ? `, ${s.buts[m.joueur].real} but` : ''})`).join(', ') || '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
