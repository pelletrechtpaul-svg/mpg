import { useState, useMemo } from 'react';
import { Check } from 'lucide-react';
import { PlayerAvatar } from './PlayerAvatar.jsx';
import { POSTE_GROUP, POSTE_GROUP_ORDER } from './FormationPitch.jsx';
import { champNum, playerDisplayName } from './AdminScorerSection.jsx';

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

// Effectif d'un coach pour un championnat donné, dédupliqué par joueur —
// exporté pour être réutilisé à la sauvegarde d'un match (voir
// AdminAddMatchForm/AdminEditPanel) sans dupliquer cette logique de filtrage.
export function buildSquad(mercatoData, coach, saison, ligue, championnat) {
  const cNum = champNum(championnat);
  if (!coach || !saison || !ligue || cNum == null) return [];
  const seen = new Set();
  return (mercatoData || [])
    .filter(p => p.saison === saison && p.ligue === ligue && p.championnat === cNum && p.acheteur === coach)
    .filter(p => { if (seen.has(p.joueur)) return false; seen.add(p.joueur); return true; });
}

function StatutButton({ active, disabled, title, onClick, children, className }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${
        active ? className : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'
      }`}>
      {active && <Check className="w-3.5 h-3.5" />} {children}
    </button>
  );
}

function TriageRow({ m, statut, onSetStatut, photos, compteFull, bancFull, bancMax }) {
  const compteDisabled = compteFull && statut !== 'compte';
  const bancDisabled = bancFull && statut !== 'banc';
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="hidden sm:block">
        <PlayerAvatar joueur={m.joueur} ligue={m.ligue} displayName={m.joueur} photos={photos} size="sm" />
      </div>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
        {m.joueur} <span className="text-slate-400 dark:text-slate-500 text-xs">({m.poste})</span>
      </span>
      <div className="flex gap-1 w-40 flex-shrink-0">
        <StatutButton active={statut === 'compte'} disabled={compteDisabled} title={compteDisabled ? 'Max 11 joueurs qui comptent' : undefined}
          onClick={() => !compteDisabled && onSetStatut(m, 'compte')}
          className="bg-green-100 dark:bg-green-900/40 border-green-400 dark:border-green-600 text-green-700 dark:text-green-400">
          Compte
        </StatutButton>
        <StatutButton active={statut === 'banc'} disabled={bancDisabled} title={bancDisabled ? `Max ${bancMax} joueurs sur le banc` : undefined}
          onClick={() => !bancDisabled && onSetStatut(m, 'banc')}
          className="bg-amber-100 dark:bg-amber-900/40 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400">
          Banc
        </StatutButton>
      </div>
    </div>
  );
}

function NotationRow({ m, note, buts, onBumpNote, onBumpReal, onDecrementReal, onBumpVirtuel, onDecrementVirtuel, allowVirtuel, allowNonNote, onToggleNonNote, photos }) {
  const real = buts?.real || 0;
  const virtuel = buts?.virtuel || 0;
  const nonNote = note === null;
  return (
    <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1 py-1.5 text-xs">
      <div className="hidden sm:block">
        <PlayerAvatar joueur={m.joueur} ligue={m.ligue} displayName={m.joueur} photos={photos} size="sm" />
      </div>
      <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
        {m.joueur} <span className="text-slate-400 dark:text-slate-500">({m.poste})</span>
      </span>
      {!nonNote && (
        <span className="flex items-center gap-1 flex-shrink-0">
          <button type="button" onClick={() => onBumpReal(m)}
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
              <button type="button" onClick={() => onBumpVirtuel(m)}
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
      )}
      {nonNote ? (
        <span className="flex-shrink-0 italic text-slate-400 dark:text-slate-500 px-1">n'a pas joué</span>
      ) : (
        <span className="flex items-center gap-0.5 flex-shrink-0 bg-slate-100 dark:bg-slate-700 rounded px-0.5 py-0.5">
          <button type="button" onClick={() => onBumpNote(m.joueur, -0.5)} className="w-6 h-6 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-sm leading-none">−</button>
          <span className="w-5 text-center font-semibold text-slate-700 dark:text-slate-200">{formatNote(note ?? 5)}</span>
          <button type="button" onClick={() => onBumpNote(m.joueur, 0.5)} className="w-6 h-6 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-sm leading-none">+</button>
        </span>
      )}
      {allowNonNote && (
        <button type="button" onClick={() => onToggleNonNote(m.joueur)} title="N'a pas joué en vrai (resté sur le banc)"
          className={`flex-shrink-0 px-1.5 h-6 rounded text-[11px] font-medium border ${
            nonNote ? 'bg-slate-600 dark:bg-slate-500 border-slate-600 dark:border-slate-500 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500'
          }`}>
          Non noté
        </button>
      )}
    </div>
  );
}

// Saisie admin d'un match, par entraineur : triage (qui compte dans le
// match / qui reste sur le banc / qui est au loft) puis notation. Remplace
// l'ancien terrain graphique (starters/bench par prix) - le triage explicite
// est la seule façon fiable de distinguer les trois cas et de calculer les
// rotaldos, ce qu'un simple classement par valeur ne permettait pas.
//
// Le statut ('compte' | 'banc' | absent = loft) est porté directement par
// l'entrée `notes` du joueur (note par défaut 5 dès le triage, voir
// setStatut) plutôt que par un état séparé : ça évite un joueur classé mais
// jamais noté explicitement, qui existait avec l'ancien système "X".
//
// NB : "but virtuel" et "but MPG" désignent la même chose (bonification de
// note MPG comptée comme un but) — "MPG" est le terme retenu à l'affichage,
// le champ interne `virtuel` ne change pas (déjà en base sur les matchs
// existants). Un joueur "banc" n'a pas accès au but MPG (bonus lié au fait
// d'être effectivement en jeu).
export function AdminFormationEntry({ coach, matchKey, saison, ligue, championnat, mercatoData, buteurs, setButeurs, notes, setNotes, photos }) {
  const squad = useMemo(() => buildSquad(mercatoData, coach, saison, ligue, championnat), [mercatoData, coach, saison, ligue, championnat]);
  const sorted = useMemo(() => sortByPoste(squad), [squad]);
  const [step, setStep] = useState('triage');

  const current = buteurs[matchKey] || [];
  const notesCurrent = notes[matchKey] || [];

  // undefined = jamais noté (loft). Un match saisi avant cette refonte n'a
  // pas de champ `statut` sur ses notes : on le traite comme "compte" (même
  // logique que le helper isCompte utilisé pour les stats), sinon rouvrir un
  // vieux match en édition ferait perdre tout son effectif noté vers le loft.
  const statutFor = (joueur) => {
    const n = notesCurrent.find(n => n.acheteur === coach && n.joueur === joueur);
    if (!n) return undefined;
    return n.statut === 'banc' ? 'banc' : 'compte';
  };
  // `note` peut valoir `null` explicitement ("non noté" - resté sur le banc
  // et n'a pas joué en vrai), à distinguer d'une entrée absente : ne pas
  // utiliser `??` ici, ça retomberait aussi sur 5 pour `null`.
  const noteFor = (joueur) => {
    const n = notesCurrent.find(n => n.acheteur === coach && n.joueur === joueur);
    return n ? n.note : 5;
  };
  const isNonNote = (joueur) => noteFor(joueur) === null;
  const goalsFor = (joueur) => ({
    real: current.find(s => s.acheteur === coach && s.joueur === joueur && !s.csc && !s.virtuel)?.buts || 0,
    virtuel: current.find(s => s.acheteur === coach && s.joueur === joueur && !s.csc && s.virtuel)?.buts || 0,
  });

  const compteList = sorted.filter(m => statutFor(m.joueur) === 'compte');
  const bancList = sorted.filter(m => statutFor(m.joueur) === 'banc');
  const loftList = sorted.filter(m => !statutFor(m.joueur));
  const rotaldos = Math.max(0, 11 - compteList.length);

  // Classe un joueur "compte" ou "banc" (reclic sur le même statut = retour
  // au loft). Max 11 "compte". Le max "banc" est 7 + rotaldos : un rotaldo
  // (titulaire absent non remplacé) fait sortir un titulaire de "compte"
  // sans qu'il rejoigne explicitement le banc dans la liste, donc chaque
  // rotaldo libère une place supplémentaire côté banc pour garder
  // compte + banc ≤ 18 (taille max d'un effectif de matchday). Retour au
  // loft retire la note et les buts déjà tagués ; passage à "banc" retire un
  // éventuel but MPG (incompatible avec ce statut).
  const setStatut = (m, val) => {
    const currentStatut = statutFor(m.joueur);
    const next = currentStatut === val ? undefined : val;
    if (next) {
      const list = next === 'compte' ? compteList : bancList;
      const max = next === 'compte' ? 11 : 7 + rotaldos;
      if (!list.some(x => x.joueur === m.joueur) && list.length >= max) return;
    }
    setNotes(prev => {
      const arr = prev[matchKey] || [];
      const idx = arr.findIndex(n => n.acheteur === coach && n.joueur === m.joueur);
      if (!next) {
        if (idx < 0) return prev;
        return { ...prev, [matchKey]: arr.filter((_, i) => i !== idx) };
      }
      // Un joueur "compte" a forcément joué : si on le reclasse depuis
      // "banc" alors qu'il était marqué "non noté" (note null), on lui
      // remet la note par défaut plutôt que de laisser un "compte" sans
      // note (le toggle "non noté" n'existe que côté banc).
      if (idx >= 0) return { ...prev, [matchKey]: arr.map((n, i) => i === idx ? { ...n, statut: next, note: next === 'compte' && n.note === null ? 5 : n.note } : n) };
      return { ...prev, [matchKey]: [...arr, { joueur: m.joueur, acheteur: coach, note: 5, statut: next }] };
    });
    setButeurs(prev => {
      const arr = prev[matchKey] || [];
      if (!next) {
        const filtered = arr.filter(s => !(s.acheteur === coach && s.joueur === m.joueur && !s.csc));
        return filtered.length === arr.length ? prev : { ...prev, [matchKey]: filtered };
      }
      if (next === 'banc') {
        const filtered = arr.filter(s => !(s.acheteur === coach && s.joueur === m.joueur && !s.csc && s.virtuel));
        return filtered.length === arr.length ? prev : { ...prev, [matchKey]: filtered };
      }
      return prev;
    });
  };

  // Un but réel et un but MPG s'excluent mutuellement pour un même joueur
  // sur un même match : il faut d'abord retirer l'un pour pouvoir ajouter
  // l'autre, plutôt que de laisser les deux cumuler.
  const bumpReal = (m) => {
    const statut = statutFor(m.joueur);
    setButeurs(prev => {
      const arr = prev[matchKey] || [];
      if (arr.some(s => s.acheteur === coach && s.joueur === m.joueur && !s.csc && s.virtuel)) return prev;
      const idx = arr.findIndex(s => s.acheteur === coach && s.joueur === m.joueur && !s.csc && !s.virtuel);
      if (idx >= 0) return { ...prev, [matchKey]: arr.map((s, i) => i === idx ? { ...s, buts: Math.min(10, s.buts + 1) } : s) };
      return { ...prev, [matchKey]: [...arr, { joueur: m.joueur, displayName: playerDisplayName(m), buts: 1, acheteur: coach, csc: false, statut }] };
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

  // But MPG : au plus un seul par joueur et par match (une bonification de
  // note supérieure à 1 par match n'arrive quasiment jamais) - un second tap
  // une fois taggé est un no-op, on utilise le "×" pour retirer. Réservé à
  // la liste "compte" (allowVirtuel côté rendu).
  const bumpVirtuel = (m) => {
    const statut = statutFor(m.joueur);
    setButeurs(prev => {
      const arr = prev[matchKey] || [];
      if (arr.some(s => s.acheteur === coach && s.joueur === m.joueur && !s.csc && !s.virtuel)) return prev;
      if (arr.some(s => s.acheteur === coach && s.joueur === m.joueur && !s.csc && s.virtuel)) return prev;
      return { ...prev, [matchKey]: [...arr, { joueur: m.joueur, displayName: playerDisplayName(m), buts: 1, acheteur: coach, csc: false, virtuel: true, statut }] };
    });
  };

  const decrementVirtuel = (joueur) => {
    setButeurs(prev => {
      const arr = prev[matchKey] || [];
      const idx = arr.findIndex(s => s.acheteur === coach && s.joueur === joueur && !s.csc && s.virtuel);
      if (idx < 0) return prev;
      if (arr[idx].buts <= 1) return { ...prev, [matchKey]: arr.filter((_, i) => i !== idx) };
      return { ...prev, [matchKey]: arr.map((s, i) => i === idx ? { ...s, buts: s.buts - 1 } : s) };
    });
  };

  // Un joueur "banc" peut être resté sur le banc de son club en vrai (ou ne
  // pas avoir joué du tout) : bascule sa note à `null` ("non noté") plutôt
  // que de forcer une note par défaut qui n'a pas de sens sans match joué.
  // Repasser en note supprime aussi un éventuel but réel déjà tagué (on ne
  // peut pas avoir marqué sans avoir joué).
  const toggleNonNote = (joueur) => {
    const goingNonNote = !isNonNote(joueur);
    setNotes(prev => {
      const arr = prev[matchKey] || [];
      const idx = arr.findIndex(n => n.acheteur === coach && n.joueur === joueur);
      if (idx < 0) return prev;
      return { ...prev, [matchKey]: arr.map((n, i) => i === idx ? { ...n, note: goingNonNote ? null : 5 } : n) };
    });
    if (goingNonNote) {
      setButeurs(prev => {
        const arr = prev[matchKey] || [];
        const filtered = arr.filter(s => !(s.acheteur === coach && s.joueur === joueur && !s.csc));
        return filtered.length === arr.length ? prev : { ...prev, [matchKey]: filtered };
      });
    }
  };

  const bumpNote = (joueur, delta) => {
    setNotes(prev => {
      const arr = prev[matchKey] || [];
      const idx = arr.findIndex(n => n.acheteur === coach && n.joueur === joueur);
      if (idx < 0) return prev;
      const val = Math.max(0, Math.min(10, Math.round((arr[idx].note + delta) * 2) / 2));
      return { ...prev, [matchKey]: arr.map((n, i) => i === idx ? { ...n, note: val } : n) };
    });
  };

  if (squad.length === 0) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500 italic mt-2">
        Aucun joueur recruté par {coach} sur ce championnat.
      </p>
    );
  }

  if (step === 'triage') {
    // Une équipe MPG a toujours un gardien titulaire et un gardien
    // remplaçant - sans les deux le triage est forcément incomplet.
    const hasCompteGardien = compteList.some(m => m.poste === 'G');
    const hasBancGardien = bancList.some(m => m.poste === 'G');
    const missingGardien = !hasCompteGardien || !hasBancGardien;
    return (
      <div className="mt-2">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
          Coche "Compte" (titulaire non remplacé ou remplaçant entré) ou "Banc" (remplaçant resté sur le banc ou titulaire remplacé). Ni l'un ni l'autre = loft.
        </p>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {sorted.map(m => (
            <TriageRow key={m.joueur} m={m} statut={statutFor(m.joueur)} onSetStatut={setStatut} photos={photos}
              compteFull={compteList.length >= 11} bancFull={bancList.length >= 7 + rotaldos} bancMax={7 + rotaldos} />
          ))}
        </div>
        {missingGardien && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            ⚠️ Il manque au moins un gardien (G) dans {[!hasCompteGardien && '"Compte"', !hasBancGardien && '"Banc"'].filter(Boolean).join(' et ')}.
          </p>
        )}
        <button type="button" disabled={missingGardien} onClick={() => setStep('notation')}
          className={`mt-3 w-full px-4 py-2 rounded-lg text-sm font-medium text-white ${missingGardien ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
          Suivant →
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button type="button" onClick={() => setStep('triage')}
        className="mb-3 text-xs text-blue-600 dark:text-blue-400 hover:underline">← Précédent</button>

      {rotaldos > 0 && (
        <p className="mb-2 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/20 rounded-lg px-2 py-1">
          🎲 {rotaldos} rotaldo{rotaldos > 1 ? 's' : ''} (11 − {compteList.length} qui comptent)
        </p>
      )}

      <p className="text-[11px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">✅ Comptent dans le match ({compteList.length})</p>
      <div className="divide-y divide-slate-100 dark:divide-slate-700 mb-3">
        {compteList.map(m => (
          <NotationRow key={m.joueur} m={m} note={noteFor(m.joueur)} buts={goalsFor(m.joueur)}
            onBumpNote={bumpNote} onBumpReal={bumpReal} onDecrementReal={decrementReal}
            onBumpVirtuel={bumpVirtuel} onDecrementVirtuel={decrementVirtuel} allowVirtuel photos={photos} />
        ))}
      </div>

      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">🪑 Restés/finis sur le banc ({bancList.length})</p>
      <div className="divide-y divide-slate-100 dark:divide-slate-700 mb-3">
        {bancList.map(m => (
          <NotationRow key={m.joueur} m={m} note={noteFor(m.joueur)} buts={goalsFor(m.joueur)}
            onBumpNote={bumpNote} onBumpReal={bumpReal} onDecrementReal={decrementReal}
            onBumpVirtuel={bumpVirtuel} onDecrementVirtuel={decrementVirtuel} allowVirtuel={false}
            allowNonNote onToggleNonNote={toggleNonNote} photos={photos} />
        ))}
      </div>

      {loftList.length > 0 && (
        <>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">📦 Loft, indicatif ({loftList.length})</p>
          <div className="flex flex-wrap gap-1">
            {loftList.map(m => (
              <span key={m.joueur} className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 rounded px-1.5 py-0.5">{m.joueur}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
