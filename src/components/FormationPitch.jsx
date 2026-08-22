import { PlayerAvatar } from './PlayerAvatar.jsx';

export const FORMATION_SLOTS = { Attaquants: 3, Milieux: 3, Défenseurs: 4, Gardien: 1 };
// Position fixe du cercle (haut de l'avatar), % depuis le haut du terrain —
// but adverse en haut, notre but en bas. Milieux/Défenseurs remontés un peu
// pour ne pas chevaucher le gardien.
export const FORMATION_ROW_TOP = { Attaquants: 12, Milieux: 36, Défenseurs: 60, Gardien: 82 };
// Décalage vertical par joueur dans la ligne, pour un placement plus réaliste
// (ex : les 2 attaquants de côté un peu plus bas que celui du centre)
export const SLOT_OFFSET_CLASS = {
  Attaquants: ['translate-y-3 sm:translate-y-4', '', 'translate-y-3 sm:translate-y-4'],
  Milieux: ['', 'translate-y-4 sm:translate-y-5', ''],
  Défenseurs: ['-translate-y-2 sm:-translate-y-3', 'translate-y-2 sm:translate-y-3', 'translate-y-2 sm:translate-y-3', '-translate-y-2 sm:-translate-y-3'],
  Gardien: [''],
};

function FormationRow({ group, players, onOpenPlayer, photos, avgNoteFor }) {
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
        const avgNote = avgNoteFor?.(m);
        return (
          <button
            key={i}
            onClick={() => onOpenPlayer?.(m.joueur, m.ligue)}
            className={`relative w-11 h-11 sm:w-14 sm:h-14 group ${offsetClass}`}
          >
            <div className="w-full h-full ring-2 ring-slate-900/70 rounded-full shadow-lg">
              <PlayerAvatar joueur={m.joueur} ligue={m.ligue} displayName={m.joueur} photos={photos} size="formation" />
            </div>
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-max px-1.5 py-0.5 rounded bg-black/55 text-[11px] sm:text-sm font-bold text-white leading-tight text-center whitespace-nowrap group-hover:underline">
              {m.joueur}
            </span>
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-6 sm:mt-7 w-max text-[10px] sm:text-xs font-semibold text-white/90 leading-none whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {typeof avgNote === 'number' && `${avgNote.toFixed(1)} · `}{m.prix}M
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Bandes de tonte alternées façon terrain de foot (verts sobres).
// Rendues en divs pleins plutôt qu'en repeating-linear-gradient : html2canvas
// (partage WhatsApp) ne sait pas rasteriser les gradients répétés et sortait
// un terrain noir.
const PITCH_STRIPE_COUNT = 14;
const PitchStripes = () => (
  <div className="absolute inset-0">
    {Array.from({ length: PITCH_STRIPE_COUNT }).map((_, i) => (
      <div
        key={i}
        className="absolute inset-x-0"
        style={{
          top: `${(i * 100) / PITCH_STRIPE_COUNT}%`,
          height: `${100 / PITCH_STRIPE_COUNT}%`,
          backgroundColor: i % 2 === 0 ? '#35894f' : '#2c7642',
        }}
      />
    ))}
  </div>
);
export const LINE = 'border-white/90';

// Lignes du terrain (bandes de tonte, rond central, surfaces, buts) — partagées
// entre l'affichage pur (FormationPitch) et la saisie interactive admin
// (AdminFormationEntry), pour ne pas dupliquer ce balisage purement visuel.
export function PitchLines() {
  return (
    <>
      <PitchStripes />
      {/* Ligne médiane + rond central */}
      <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 border-t ${LINE}`} />
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-32 sm:h-32 rounded-full border ${LINE}`} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/90" />

      {/* Surface + petite surface + but, en haut (but adverse) */}
      <div className={`absolute left-1/2 top-0 -translate-x-1/2 w-[62%] h-[16%] border border-t-0 ${LINE}`} />
      <div className={`absolute left-1/2 top-0 -translate-x-1/2 w-[32%] h-[6%] border border-t-0 ${LINE}`} />
      <div className={`absolute left-1/2 top-[16%] -translate-x-1/2 w-16 h-6 sm:w-20 sm:h-8 border border-t-0 ${LINE} rounded-b-full`} />
      <div className={`absolute left-1/2 top-0 -translate-x-1/2 w-[14%] h-[2.5%] border border-t-0 ${LINE}`} />

      {/* Surface + petite surface + but, en bas (notre but) */}
      <div className={`absolute left-1/2 bottom-0 -translate-x-1/2 w-[62%] h-[16%] border border-b-0 ${LINE}`} />
      <div className={`absolute left-1/2 bottom-0 -translate-x-1/2 w-[32%] h-[6%] border border-b-0 ${LINE}`} />
      <div className={`absolute left-1/2 bottom-[16%] -translate-x-1/2 w-16 h-6 sm:w-20 sm:h-8 border border-b-0 ${LINE} rounded-t-full`} />
      <div className={`absolute left-1/2 bottom-0 -translate-x-1/2 w-[14%] h-[2.5%] border border-b-0 ${LINE}`} />
    </>
  );
}

// Assigne les joueurs d'un groupe aux slots d'une ligne en respectant une
// préférence de poste par slot (ex : DC au centre, DL sur les côtés), avec
// repli sur n'importe quel joueur du groupe si le poste précis manque.
// Traité rang par rang sur TOUS les slots à la fois, pour qu'un slot moins
// prioritaire (repli "any") ne pioche jamais dans le vivier d'un poste
// réservé à un autre slot avant que celui-ci ait eu sa chance.
function assignSlots(players, slotPrefs, rating) {
  const used = new Set();
  const n = slotPrefs.length;
  const result = new Array(n).fill(null);
  const takeBest = (poste) => {
    const candidates = poste
      ? players.filter(m => m.poste === poste && !used.has(m))
      : players.filter(m => !used.has(m));
    return [...candidates].sort((a, b) => rating(b) - rating(a))[0] || null;
  };
  const maxRank = Math.max(...slotPrefs.map(p => p.length));
  for (let rank = 0; rank < maxRank; rank++) {
    for (let i = 0; i < n; i++) {
      if (result[i]) continue;
      const poste = slotPrefs[i][rank];
      if (poste === undefined) continue;
      const player = takeBest(poste);
      if (player) { used.add(player); result[i] = player; }
    }
  }
  return result;
}

export const POSTE_GROUP = {
  A: 'Attaquants',
  MC: 'Milieux', MO: 'Milieux', MD: 'Milieux', M: 'Milieux',
  DC: 'Défenseurs', DL: 'Défenseurs', DG: 'Défenseurs', DD: 'Défenseurs', D: 'Défenseurs',
  G: 'Gardien',
};
export const POSTE_GROUP_ORDER = ['Attaquants', 'Milieux', 'Défenseurs', 'Gardien'];

// Répartit un effectif en onze de départ (par ligne/slot) + banc — logique
// partagée entre l'affichage (FormationPitch) et la saisie admin.
// `rating` détermine qui est titulaire : prix par défaut, ou note moyenne du
// championnat une fois qu'au moins un match a été noté (voir ClassementsTab /
// EntraineursTab, qui passent alors une fonction basée sur les notes).
export function computeFormation(squad, rating = (m) => m.prix || 0) {
  const defenders = squad.filter(m => (POSTE_GROUP[m.poste] || 'Milieux') === 'Défenseurs');
  const midfielders = squad.filter(m => (POSTE_GROUP[m.poste] || 'Milieux') === 'Milieux');
  const attackers = squad.filter(m => (POSTE_GROUP[m.poste] || 'Milieux') === 'Attaquants').sort((a, b) => rating(b) - rating(a));
  const keepers = squad.filter(m => (POSTE_GROUP[m.poste] || 'Milieux') === 'Gardien').sort((a, b) => rating(b) - rating(a));

  const starters = {
    Attaquants: attackers.slice(0, FORMATION_SLOTS.Attaquants),
    // Milieu axial : priorité aux MD (milieux défensifs) ; ailiers : priorité aux MO
    Milieux: assignSlots(midfielders, [['MO', null], ['MD', 'MO', null], ['MO', null]], rating),
    // Défenseurs axiaux : priorité aux DC ; latéraux : priorité aux DL
    Défenseurs: assignSlots(defenders, [['DL', null], ['DC', 'DL', null], ['DC', 'DL', null], ['DL', null]], rating),
    Gardien: keepers.slice(0, FORMATION_SLOTS.Gardien),
  };
  const startersSet = new Set(Object.values(starters).flat().filter(Boolean));
  const bench = squad
    .filter(m => !startersSet.has(m))
    .sort((a, b) => POSTE_GROUP_ORDER.indexOf(POSTE_GROUP[a.poste] || 'Milieux') - POSTE_GROUP_ORDER.indexOf(POSTE_GROUP[b.poste] || 'Milieux'));
  return { starters, bench };
}

// `ratingFor(m)` : critère de sélection des titulaires (prix par défaut). Sur
// "Effectifs" (Classements/Entraîneurs), une fois qu'au moins un match du
// championnat a été noté, l'appelant passe la note moyenne à la place.
// `avgNoteFor(m)` : note moyenne à afficher à gauche du prix (même
// info que celle utilisée par `ratingFor`, mais brute — pas de repli à 0 pour
// un joueur sans note, pour ne pas afficher un "0.0" trompeur).
export function FormationPitch({ squad, onOpenPlayer, photos, ratingFor, avgNoteFor }) {
  const { starters, bench } = computeFormation(squad, ratingFor);

  return (
    <div className="sm:max-w-sm sm:mx-auto">
      {/* Largeur plafonnée + centrée à partir de sm : sans ça, la carte
          s'étire à toute la largeur du conteneur desktop et le terrain
          (ratio portrait via paddingBottom) devient démesurément haut,
          forçant un scroll pour le voir en entier. */}
      {/* paddingBottom plutôt qu'aspect-ratio : html2canvas (partage WhatsApp)
          ignore aspect-ratio et la hauteur s'effondrait, décalant tout. */}
      {/* 148% plutôt que le 133% d'origine : la ligne du gardien (la plus
          basse) n'avait presque aucune marge sous son étiquette, et le
          préfixe de note moyenne ("7.2 · 45M") ajouté à l'étiquette la
          faisait déborder de l'overflow-hidden — surtout visible en desktop
          où le terrain est plus large donc plus haut en px. */}
      <div className="relative rounded-2xl overflow-hidden border-[3px] border-white/90" style={{ paddingBottom: '148%' }}>
        <PitchLines />

        <FormationRow group="Attaquants" players={starters.Attaquants} onOpenPlayer={onOpenPlayer} photos={photos} avgNoteFor={avgNoteFor} />
        <FormationRow group="Milieux" players={starters.Milieux} onOpenPlayer={onOpenPlayer} photos={photos} avgNoteFor={avgNoteFor} />
        <FormationRow group="Défenseurs" players={starters.Défenseurs} onOpenPlayer={onOpenPlayer} photos={photos} avgNoteFor={avgNoteFor} />
        <FormationRow group="Gardien" players={starters.Gardien} onOpenPlayer={onOpenPlayer} photos={photos} avgNoteFor={avgNoteFor} />
      </div>

      {bench.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">Reste de l'effectif</h4>
          <div className="grid grid-cols-2 gap-x-4">
            {bench.map((m, i) => {
              const avgNote = avgNoteFor?.(m);
              return (
                <div key={i} className="flex items-center justify-between text-sm gap-2 py-1">
                  <button
                    onClick={() => onOpenPlayer?.(m.joueur, m.ligue)}
                    className="text-slate-700 dark:text-slate-200 truncate text-left hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                  >
                    {m.joueur} <span className="text-xs text-slate-400 dark:text-slate-500">({m.poste})</span>
                  </button>
                  <span className="font-semibold text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {typeof avgNote === 'number' && `${avgNote.toFixed(1)} · `}{m.prix}M
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
