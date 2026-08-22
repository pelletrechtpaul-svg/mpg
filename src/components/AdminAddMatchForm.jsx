import { useState, useMemo, useEffect } from 'react';
import { db } from '../firebase';
import { doc, collection, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { encodeFirestoreKey } from '../shared.jsx';
import CoachPlayerSearch from './AdminScorerSection';
import { AdminFormationEntry } from './AdminFormationEntry.jsx';
import { usePlayerPhotos } from './PlayerAvatar.jsx';

const JOUEURS = ['Paul', 'Adrien', 'Tiago', 'Roman'];

const LIGUE_CONFIG = [
  { id: 'Ligue 1',           label: 'Ligue 1',           flag: '🇫🇷', color: 'bg-blue-600 hover:bg-blue-700' },
  { id: 'Premier League',    label: 'Premier League',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: 'bg-purple-600 hover:bg-purple-700' },
  { id: 'Liga',              label: 'Liga',              flag: '🇪🇸', color: 'bg-red-600 hover:bg-red-700' },
  { id: 'Serie A',           label: 'Serie A',           flag: '🇮🇹', color: 'bg-green-700 hover:bg-green-800' },
  { id: 'Ligue des Champions', label: 'Champions',       flag: '⭐', color: 'bg-slate-700 hover:bg-slate-800' },
];

const EMPTY_MATCH = { joueur1: '', joueur2: '', buts1: '', buts2: '', valise1: false, valise2: false };

function calcResult(b1, b2) {
  if (b1 > b2) return { points_j1: 3, points_j2: 0, resultat: 'victoire_j1' };
  if (b1 < b2) return { points_j1: 0, points_j2: 3, resultat: 'victoire_j2' };
  return { points_j1: 1, points_j2: 1, resultat: 'nul' };
}

function resultLabel(j1, j2, b1, b2) {
  if (b1 > b2) return `Victoire ${j1} (3 pts)`;
  if (b1 < b2) return `Victoire ${j2} (3 pts)`;
  return 'Match nul (1 pt chacun)';
}

function getChampStatus(matchData, ligueMetadata, saison, ligue) {
  const championnats = [...new Set(
    matchData.filter(m => m.saison === saison && m.ligue === ligue).map(m => m.championnat)
  )].sort((a, b) => {
    const na = parseInt(a.match(/#(\d+)/)?.[1] || 0);
    const nb = parseInt(b.match(/#(\d+)/)?.[1] || 0);
    return na - nb;
  });

  if (championnats.length === 0) return { championnat: null, number: 0, isFull: false, meta: null };

  const current = championnats[championnats.length - 1];
  const key = `${saison}-${ligue}-${current}`;
  const meta = ligueMetadata[key] || null;
  const number = parseInt(current.match(/#(\d+)/)?.[1] || 0);
  const isFull = meta ? meta.matchsEntered >= meta.matchsTotal : false;

  return { championnat: current, number, isFull, meta };
}

export function TeamButeurs({ coach, matchKey, buteurs, setButeurs, notes, setNotes, saison, ligue, championnat, mercatoData, photos }) {
  return (
    <div className="mt-2">
      <AdminFormationEntry
        coach={coach} matchKey={matchKey} saison={saison} ligue={ligue} championnat={championnat}
        mercatoData={mercatoData} buteurs={buteurs} setButeurs={setButeurs} notes={notes} setNotes={setNotes} photos={photos}
      />
    </div>
  );
}

// Séparé de TeamButeurs pour pouvoir être affiché à côté de la case Valise
// (juste sous le score) plutôt qu'enterré sous le terrain interactif — trop
// rare pour justifier de le chercher en bas de la carte à chaque saisie.
export function CscToggle({ coach, matchKey, buteurs, setButeurs, saison, ligue, championnat, mercatoData }) {
  const current = buteurs[matchKey] || [];
  const cscEntries = current.map((s, i) => ({ ...s, idx: i })).filter(s => s.acheteur === coach && s.csc);
  const [cscOpen, setCscOpen] = useState(false);

  const removeEntry = (idx) => setButeurs(prev => ({ ...prev, [matchKey]: prev[matchKey].filter((_, i) => i !== idx) }));

  const addCsc = (player) => {
    setButeurs(prev => ({
      ...prev,
      [matchKey]: [...prev[matchKey], { joueur: player.joueur, displayName: player.displayName, buts: 1, acheteur: coach, csc: true }],
    }));
    setCscOpen(false);
  };

  return (
    <div className="mt-1.5">
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input type="checkbox" checked={cscOpen} onChange={e => setCscOpen(e.target.checked)} className="w-3.5 h-3.5 accent-orange-500" />
        <span className="text-xs text-orange-600 dark:text-orange-400">CSC</span>
      </label>
      {cscEntries.length > 0 && (
        <div className="space-y-0.5 mt-1">
          {cscEntries.map(s => (
            <div key={s.idx} className="flex items-center gap-1.5 text-xs text-orange-700 dark:text-orange-400 py-0.5">
              <span className="flex-1 truncate">{s.displayName} (CSC)</span>
              <button type="button" onClick={() => removeEntry(s.idx)} className="text-slate-300 hover:text-red-500 leading-none">×</button>
            </div>
          ))}
        </div>
      )}
      {cscOpen && (
        <div className="mt-1">
          <CoachPlayerSearch
            coach={coach} saison={saison} ligue={ligue} championnat={championnat} mercatoData={mercatoData}
            onSelect={addCsc} placeholder={`Qui a marqué contre son camp ?`}
          />
        </div>
      )}
    </div>
  );
}

function MatchBlock({ label, match, setMatch, otherMatch, buteurs, setButeurs, notes, setNotes, matchKey, saison, ligue, championnat, valiseUsed, mercatoData, photos, autoFilled }) {
  const available1 = JOUEURS.filter(j => j !== match.joueur2 && j !== otherMatch.joueur1 && j !== otherMatch.joueur2);
  const available2 = JOUEURS.filter(j => j !== match.joueur1 && j !== otherMatch.joueur1 && j !== otherMatch.joueur2);
  const b1 = parseInt(match.buts1), b2 = parseInt(match.buts2);
  const hasResult = match.buts1 !== '' && match.buts2 !== '' && !isNaN(b1) && !isNaN(b2);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</h4>

      <div className="grid grid-cols-2 gap-2">
        {autoFilled ? (
          <>
            <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium">{match.joueur1 || '—'}</div>
            <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium">{match.joueur2 || '—'}</div>
          </>
        ) : (
          <>
            <select value={match.joueur1} onChange={e => setMatch({ ...match, joueur1: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option value="">Joueur 1...</option>
              {available1.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
            <select value={match.joueur2} onChange={e => setMatch({ ...match, joueur2: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option value="">Joueur 2...</option>
              {available2.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </>
        )}
      </div>

      {match.joueur1 && match.joueur2 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">{match.joueur1}</label>
              <input type="number" value={match.buts1} onChange={e => setMatch({ ...match, buts1: e.target.value })}
                min="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-center text-xl font-bold bg-white" placeholder="0" />
              {!valiseUsed[match.joueur1] && (
                <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={match.valise1} onChange={e => setMatch({ ...match, valise1: e.target.checked })} className="w-3.5 h-3.5" />
                  <span className="text-xs text-slate-500">Valise 💼</span>
                </label>
              )}
              <CscToggle coach={match.joueur1} matchKey={matchKey} buteurs={buteurs} setButeurs={setButeurs}
                saison={saison} ligue={ligue} championnat={championnat} mercatoData={mercatoData} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{match.joueur2}</label>
              <input type="number" value={match.buts2} onChange={e => setMatch({ ...match, buts2: e.target.value })}
                min="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-center text-xl font-bold bg-white" placeholder="0" />
              {!valiseUsed[match.joueur2] && (
                <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={match.valise2} onChange={e => setMatch({ ...match, valise2: e.target.checked })} className="w-3.5 h-3.5" />
                  <span className="text-xs text-slate-500">Valise 💼</span>
                </label>
              )}
              <CscToggle coach={match.joueur2} matchKey={matchKey} buteurs={buteurs} setButeurs={setButeurs}
                saison={saison} ligue={ligue} championnat={championnat} mercatoData={mercatoData} />
            </div>
          </div>

          <div className="border-l-2 border-blue-300 dark:border-blue-600 pl-2">
            <TeamButeurs coach={match.joueur1} matchKey={matchKey} buteurs={buteurs} setButeurs={setButeurs} notes={notes} setNotes={setNotes}
              saison={saison} ligue={ligue} championnat={championnat} mercatoData={mercatoData} photos={photos} />
          </div>
          <div className="border-l-2 border-emerald-300 dark:border-emerald-600 pl-2">
            <TeamButeurs coach={match.joueur2} matchKey={matchKey} buteurs={buteurs} setButeurs={setButeurs} notes={notes} setNotes={setNotes}
              saison={saison} ligue={ligue} championnat={championnat} mercatoData={mercatoData} photos={photos} />
          </div>

          {hasResult && (
            <div className="text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200">
              {resultLabel(match.joueur1, match.joueur2, b1, b2)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const AdminAddMatchForm = ({ matchData, saisons, mercatoData, ligueMetadata, showToast, onCancel }) => {
  const today = new Date().toISOString().split('T')[0];

  // view: 'ligue' | 'entry' | 'newchamp'
  const [view, setView] = useState('ligue');
  const [selLigue, setSelLigue] = useState('');
  const [selSaison, setSelSaison] = useState('');
  const [championnat, setChampionnat] = useState('');
  const [champMeta, setChampMeta] = useState(null);

  // New championnat config
  const [newChampMatchs, setNewChampMatchs] = useState(6);
  const [creatingChamp, setCreatingChamp] = useState(false);

  // Entry form state
  const [dateMatch, setDateMatch] = useState(today);
  const [match1, setMatch1] = useState(EMPTY_MATCH);
  const [match2, setMatch2] = useState(EMPTY_MATCH);
  const [buteurs, setButeurs] = useState({ m1: [], m2: [] });
  const [notes, setNotes] = useState({ m1: [], m2: [] });
  const [saving, setSaving] = useState(false);
  const photos = usePlayerPhotos();

  // Init selSaison to first saison that has mercato data
  useEffect(() => {
    if (saisons.length && !selSaison) {
      const withData = saisons.find(s => mercatoData.some(p => p.saison === s));
      setSelSaison(withData || saisons[0]);
    }
  }, [saisons, mercatoData]);

  // Auto-fill match2
  useEffect(() => {
    if (match1.joueur1 && match1.joueur2) {
      const [j1, j2] = JOUEURS.filter(j => j !== match1.joueur1 && j !== match1.joueur2);
      setMatch2(prev => ({ ...prev, joueur1: j1 || '', joueur2: j2 || '' }));
    } else {
      setMatch2(EMPTY_MATCH);
    }
  }, [match1.joueur1, match1.joueur2]);

  const champStatus = useMemo(() =>
    selSaison && selLigue ? getChampStatus(matchData, ligueMetadata, selSaison, selLigue) : null,
    [matchData, ligueMetadata, selSaison, selLigue]
  );

  const valiseUsed = useMemo(() => {
    if (!championnat || !selLigue || !selSaison) return {};
    const used = {};
    matchData.filter(m => m.saison === selSaison && m.ligue === selLigue && m.championnat === championnat).forEach(m => {
      if (m.valise_j1) used[m.joueur1] = true;
      if (m.valise_j2) used[m.joueur2] = true;
    });
    return used;
  }, [matchData, selSaison, selLigue, championnat]);

  const handleSelectLigue = (ligue) => {
    const saison = selSaison || saisons[0] || '';
    setSelLigue(ligue);
    if (!selSaison) setSelSaison(saison);
    const status = getChampStatus(matchData, ligueMetadata, saison, ligue);
    if (!status.championnat) {
      // No championnat yet → go straight to new champ creation
      setView('newchamp');
    } else if (status.isFull) {
      // Current champ is full → show entry but with full banner
      setChampionnat(status.championnat);
      setChampMeta(status.meta);
      setView('entry');
    } else {
      setChampionnat(status.championnat);
      setChampMeta(status.meta);
      setView('entry');
    }
  };

  const handleCreateChamp = async () => {
    if (creatingChamp) return;
    setCreatingChamp(true);
    try {
      const snap = await getDocs(query(collection(db, 'matches'), where('saison', '==', selSaison), where('ligue', '==', selLigue)));
      const existing = new Set(snap.docs.map(d => d.data().championnat));
      const newChamp = `#${existing.size + 1}`;
      setChampionnat(newChamp);
      setChampMeta({ matchsTotal: newChampMatchs, matchsEntered: 0 });
      setView('entry');
    } catch {
      showToast('Erreur lors de la création du championnat', 'error');
    } finally {
      setCreatingChamp(false);
    }
  };

  const isReady = championnat && dateMatch
    && match1.joueur1 && match1.joueur2 && match1.buts1 !== '' && match1.buts2 !== ''
    && match2.joueur1 && match2.joueur2 && match2.buts1 !== '' && match2.buts2 !== ''
    && !(champStatus?.isFull && championnat === champStatus?.championnat);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isReady || saving) return;

    const scores = [parseInt(match1.buts1), parseInt(match1.buts2), parseInt(match2.buts1), parseInt(match2.buts2)];
    if (scores.some(b => isNaN(b) || b < 0 || b > 30)) { showToast('Score invalide (0–30)', 'error'); return; }

    const isDup = matchData.some(m =>
      m.dateMatch === dateMatch && m.championnat === championnat &&
      ((m.joueur1 === match1.joueur1 && m.joueur2 === match1.joueur2) || (m.joueur1 === match1.joueur2 && m.joueur2 === match1.joueur1))
    );
    if (isDup) { showToast('Ce match existe déjà pour cette date', 'error'); return; }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const buildMatch = (m, buts, matchNotes) => {
        const b1 = parseInt(m.buts1), b2 = parseInt(m.buts2);
        return { saison: selSaison, ligue: selLigue, championnat, joueur1: m.joueur1, joueur2: m.joueur2, buts_j1: b1, buts_j2: b2, valise_j1: m.valise1, valise_j2: m.valise2, ...calcResult(b1, b2), dateMatch, dateEntree: now, buteurs: buts, notes: matchNotes };
      };

      const batch = writeBatch(db);
      [buildMatch(match1, buteurs.m1, notes.m1), buildMatch(match2, buteurs.m2, notes.m2)].forEach(m => {
        const ref = doc(collection(db, 'matches'));
        batch.set(ref, { ...m, id: ref.id });
      });

      const ligueKey = `${selSaison}-${selLigue}-${championnat}`;
      const metaRef = doc(db, 'metadata', encodeFirestoreKey(ligueKey));
      const isNew = !champMeta || champMeta.matchsEntered === 0;
      if (isNew) {
        batch.set(metaRef, { createdAt: now, matchsTotal: newChampMatchs, matchsEntered: 1, ligue: selLigue, saison: selSaison, championnat });
      } else {
        batch.set(metaRef, { ...champMeta, matchsEntered: (champMeta.matchsEntered || 0) + 1 });
      }

      await batch.commit();
      showToast('Journée enregistrée !');
      setMatch1(EMPTY_MATCH);
      setMatch2(EMPTY_MATCH);
      setButeurs({ m1: [], m2: [] });
      setNotes({ m1: [], m2: [] });
      setDateMatch(today);
      // Update local champMeta count
      setChampMeta(prev => prev ? { ...prev, matchsEntered: (prev.matchsEntered || 0) + 1 } : null);
    } catch {
      showToast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  };

  const currentLigueConfig = LIGUE_CONFIG.find(l => l.id === selLigue);

  // ── VIEW: Ligue selection ──────────────────────────────────────────────────
  if (view === 'ligue') {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-slate-800">Ajouter une journée</h3>
          <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">Annuler</button>
        </div>

        {saisons.length > 0 && (
          <div className="mb-5 flex items-center gap-2">
            <span className="text-sm text-slate-500">Saison :</span>
            <select
              value={selSaison || saisons[0]}
              onChange={e => setSelSaison(e.target.value)}
              className="text-sm px-2 py-1 border border-slate-200 rounded-lg bg-white"
            >
              {saisons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LIGUE_CONFIG.map(l => (
            <button key={l.id} onClick={() => handleSelectLigue(l.id)}
              className={`${l.color} text-white rounded-xl px-5 py-4 text-left transition-transform hover:scale-[1.02] active:scale-[0.98]`}>
              <span className="text-2xl mb-2 block">{l.flag}</span>
              <span className="font-semibold text-base">{l.label}</span>
              {(() => {
                const saison = selSaison || saisons[0] || '';
                if (!saison) return null;
                const s = getChampStatus(matchData, ligueMetadata, saison, l.id);
                if (!s.championnat) return <span className="block text-xs opacity-70 mt-1">Aucun championnat</span>;
                if (s.isFull) return <span className="block text-xs opacity-70 mt-1">{s.championnat} · terminé</span>;
                return <span className="block text-xs opacity-70 mt-1">{s.championnat} · {s.meta?.matchsEntered || 0}/{s.meta?.matchsTotal || '?'} journées</span>;
              })()}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── VIEW: New championnat ──────────────────────────────────────────────────
  if (view === 'newchamp') {
    return (
      <div>
        <button onClick={() => setView('ligue')} className="mb-4 text-sm text-blue-600 hover:text-blue-800">← Retour</button>
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xl">{currentLigueConfig?.flag}</span>
          <h3 className="text-lg font-semibold text-slate-800">Nouveau championnat · {selLigue}</h3>
        </div>

        <div className="bg-slate-50 rounded-xl p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Nombre de journées</label>
            <div className="flex gap-2">
              {[3, 4, 5, 6].map(n => (
                <button key={n} type="button" onClick={() => setNewChampMatchs(n)}
                  className={`w-12 h-12 rounded-lg font-semibold text-base transition-colors ${newChampMatchs === n ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:border-blue-400'}`}>
                  {n}
                </button>
              ))}
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm text-slate-500">ou</span>
                <input type="number" value={newChampMatchs} onChange={e => setNewChampMatchs(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1" max="20" className="w-16 px-2 py-2 border border-slate-300 rounded-lg text-sm text-center" />
              </div>
            </div>
          </div>

          <button onClick={handleCreateChamp} disabled={creatingChamp}
            className="w-full px-5 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
            {creatingChamp ? 'Création...' : `Créer et saisir la première journée`}
          </button>
        </div>
      </div>
    );
  }

  // ── VIEW: Match entry ──────────────────────────────────────────────────────
  const isFull = champStatus?.isFull && championnat === champStatus?.championnat;

  return (
    <div>
      <button onClick={() => setView('ligue')} className="mb-4 text-sm text-blue-600 hover:text-blue-800">← Retour</button>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-xl">{currentLigueConfig?.flag}</span>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{selLigue} · {championnat}</h3>
            {champMeta && (
              <p className="text-xs text-slate-500">
                {isFull
                  ? `${champMeta.matchsEntered}/${champMeta.matchsTotal} journées · terminé`
                  : `Journée ${(champMeta.matchsEntered || 0) + 1} / ${champMeta.matchsTotal}`}
              </p>
            )}
          </div>
        </div>
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">Annuler</button>
      </div>

      {/* Full championship banner */}
      {isFull && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <p className="text-amber-800 font-medium text-sm mb-3">
            Le championnat {championnat} est terminé ({champMeta?.matchsTotal} journées jouées).
          </p>
          <button onClick={() => setView('newchamp')}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
            Démarrer le championnat #{(champStatus?.number || 0) + 1}
          </button>
        </div>
      )}

      {!isFull && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date de la journée</label>
            <input type="date" value={dateMatch} onChange={e => setDateMatch(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MatchBlock label="Match 1" match={match1} setMatch={setMatch1} otherMatch={match2}
              buteurs={buteurs} setButeurs={setButeurs} notes={notes} setNotes={setNotes} matchKey="m1"
              saison={selSaison} ligue={selLigue} championnat={championnat} valiseUsed={valiseUsed}
              mercatoData={mercatoData} photos={photos} autoFilled={false} />
            <MatchBlock label="Match 2 (auto)" match={match2} setMatch={setMatch2} otherMatch={match1}
              buteurs={buteurs} setButeurs={setButeurs} notes={notes} setNotes={setNotes} matchKey="m2"
              saison={selSaison} ligue={selLigue} championnat={championnat} valiseUsed={valiseUsed}
              mercatoData={mercatoData} photos={photos} autoFilled={!!(match1.joueur1 && match1.joueur2)} />
          </div>

          <button type="submit" disabled={!isReady || saving}
            className={`w-full px-6 py-3 rounded-xl font-semibold text-white transition-colors ${isReady && !saving ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-300 cursor-not-allowed'}`}>
            {saving ? 'Enregistrement...' : 'Enregistrer la journée'}
          </button>
        </form>
      )}
    </div>
  );
};

export default AdminAddMatchForm;
