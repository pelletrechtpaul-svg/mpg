import { useState, useMemo, useEffect } from 'react';
import { db } from '../firebase';
import { doc, collection, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { encodeFirestoreKey } from '../shared.jsx';
import ScorerSection from './AdminScorerSection';

const JOUEURS = ['Paul', 'Adrien', 'Tiago', 'Roman'];
const LIGUES = ['Ligue 1', 'Premier League', 'Liga', 'Serie A', 'Ligue des Champions'];
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

function MatchBlock({ label, match, setMatch, otherMatch, buteurs, setButeurs, matchKey, saison, ligue, valiseUsed, mercatoData, autoFilled }) {
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
            </div>
          </div>

          {hasResult && (
            <div className="text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200">
              {resultLabel(match.joueur1, match.joueur2, b1, b2)}
            </div>
          )}

          <ScorerSection
            matchKey={matchKey}
            joueur1={match.joueur1}
            joueur2={match.joueur2}
            saison={saison}
            ligue={ligue}
            buteurs={buteurs}
            setButeurs={setButeurs}
            mercatoData={mercatoData}
          />
        </>
      )}
    </div>
  );
}

const AdminAddMatchForm = ({ matchData, ligues, saisons, mercatoData, ligueMetadata, showToast, onCancel }) => {
  const today = new Date().toISOString().split('T')[0];
  const [common, setCommon] = useState({ saison: saisons[0] || '', ligue: '', championnat: '', isNewChampionnat: false, newChampionnatMatchs: 6, dateMatch: today });
  const [match1, setMatch1] = useState(EMPTY_MATCH);
  const [match2, setMatch2] = useState(EMPTY_MATCH);
  const [buteurs, setButeurs] = useState({ m1: [], m2: [] });
  const [saving, setSaving] = useState(false);

  // Sync saison when list loads
  useEffect(() => {
    if (!common.saison && saisons.length) setCommon(c => ({ ...c, saison: saisons[0] }));
  }, [saisons]);

  // Auto-fill match2 from match1 selection
  useEffect(() => {
    if (match1.joueur1 && match1.joueur2) {
      const [j1, j2] = JOUEURS.filter(j => j !== match1.joueur1 && j !== match1.joueur2);
      setMatch2(prev => ({ ...prev, joueur1: j1 || '', joueur2: j2 || '' }));
    } else {
      setMatch2(EMPTY_MATCH);
    }
  }, [match1.joueur1, match1.joueur2]);

  const championnats = useMemo(() => {
    if (!common.ligue) return [];
    return [...new Set(matchData.filter(d => d.saison === common.saison && d.ligue === common.ligue).map(d => d.championnat))].sort();
  }, [matchData, common.saison, common.ligue]);

  const valiseUsed = useMemo(() => {
    if (!common.ligue || (!common.championnat && !common.isNewChampionnat)) return {};
    const used = {};
    matchData.filter(m => m.saison === common.saison && m.ligue === common.ligue && m.championnat === common.championnat).forEach(m => {
      if (m.valise_j1) used[m.joueur1] = true;
      if (m.valise_j2) used[m.joueur2] = true;
    });
    return used;
  }, [matchData, common]);

  const isReady = common.ligue && (common.championnat || common.isNewChampionnat) && common.dateMatch
    && match1.joueur1 && match1.joueur2 && match1.buts1 !== '' && match1.buts2 !== ''
    && match2.joueur1 && match2.joueur2 && match2.buts1 !== '' && match2.buts2 !== '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isReady || saving) return;

    const { saison, ligue, isNewChampionnat, newChampionnatMatchs, dateMatch } = common;
    const scores = [parseInt(match1.buts1), parseInt(match1.buts2), parseInt(match2.buts1), parseInt(match2.buts2)];
    if (scores.some(b => isNaN(b) || b < 0 || b > 30)) { showToast('Score invalide (0–30)', 'error'); return; }

    setSaving(true);
    try {
      let championnat = common.championnat;
      if (isNewChampionnat) {
        const snap = await getDocs(query(collection(db, 'matches'), where('saison', '==', saison), where('ligue', '==', ligue)));
        const existing = new Set(snap.docs.map(d => d.data().championnat));
        championnat = `#${existing.size + 1}`;
      }

      const isDup = matchData.some(m =>
        m.dateMatch === dateMatch && m.championnat === championnat &&
        ((m.joueur1 === match1.joueur1 && m.joueur2 === match1.joueur2) || (m.joueur1 === match1.joueur2 && m.joueur2 === match1.joueur1))
      );
      if (isDup) { showToast('Ce match existe déjà pour cette date', 'error'); setSaving(false); return; }

      const now = new Date().toISOString();
      const buildMatch = (m, buts) => {
        const b1 = parseInt(m.buts1), b2 = parseInt(m.buts2);
        return { saison, ligue, championnat, joueur1: m.joueur1, joueur2: m.joueur2, buts_j1: b1, buts_j2: b2, valise_j1: m.valise1, valise_j2: m.valise2, ...calcResult(b1, b2), dateMatch, dateEntree: now, buteurs: buts };
      };

      const batch = writeBatch(db);
      [buildMatch(match1, buteurs.m1), buildMatch(match2, buteurs.m2)].forEach(m => {
        const ref = doc(collection(db, 'matches'));
        batch.set(ref, { ...m, id: ref.id });
      });

      const ligueKey = `${saison}-${ligue}-${championnat}`;
      const metaRef = doc(db, 'metadata', encodeFirestoreKey(ligueKey));
      if (isNewChampionnat) {
        batch.set(metaRef, { createdAt: now, matchsTotal: newChampionnatMatchs, matchsEntered: 1, ligue, saison, championnat });
      } else {
        const meta = ligueMetadata[ligueKey];
        if (meta) batch.set(metaRef, { ...meta, matchsEntered: (meta.matchsEntered || 0) + 1 });
      }

      await batch.commit();
      showToast('Journée enregistrée !');
      setMatch1(EMPTY_MATCH);
      setMatch2(EMPTY_MATCH);
      setButeurs({ m1: [], m2: [] });
      setCommon(c => ({ ...c, dateMatch: today }));
    } catch {
      showToast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-slate-800">Nouvelle journée</h3>
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">Annuler</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Saison</label>
            <select value={common.saison} onChange={e => setCommon({ ...common, saison: e.target.value, championnat: '', isNewChampionnat: false })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              {saisons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input type="date" value={common.dateMatch} onChange={e => setCommon({ ...common, dateMatch: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Ligue</label>
          <div className="flex flex-wrap gap-2">
            {LIGUES.map(l => (
              <button key={l} type="button"
                onClick={() => setCommon({ ...common, ligue: l, championnat: '', isNewChampionnat: false })}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${common.ligue === l ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {common.ligue && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Championnat</label>
            <div className="flex flex-wrap gap-2">
              {championnats.map(ch => (
                <button key={ch} type="button"
                  onClick={() => setCommon({ ...common, championnat: ch, isNewChampionnat: false })}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${!common.isNewChampionnat && common.championnat === ch ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}>
                  {ch}
                </button>
              ))}
              <button type="button"
                onClick={() => setCommon({ ...common, isNewChampionnat: true, championnat: '' })}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${common.isNewChampionnat ? 'bg-blue-600 text-white border-blue-600' : 'border-dashed border-slate-300 text-blue-600 hover:border-blue-400'}`}>
                + Nouveau
              </button>
            </div>
            {common.isNewChampionnat && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-sm text-slate-600">Nombre de journées :</label>
                <input type="number" value={common.newChampionnatMatchs}
                  onChange={e => setCommon({ ...common, newChampionnatMatchs: parseInt(e.target.value) || 6 })}
                  min="1" max="20" className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-center" />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MatchBlock label="Match 1" match={match1} setMatch={setMatch1} otherMatch={match2}
            buteurs={buteurs} setButeurs={setButeurs} matchKey="m1"
            saison={common.saison} ligue={common.ligue} valiseUsed={valiseUsed}
            mercatoData={mercatoData} autoFilled={false} />
          <MatchBlock label="Match 2 (auto)" match={match2} setMatch={setMatch2} otherMatch={match1}
            buteurs={buteurs} setButeurs={setButeurs} matchKey="m2"
            saison={common.saison} ligue={common.ligue} valiseUsed={valiseUsed}
            mercatoData={mercatoData} autoFilled={!!(match1.joueur1 && match1.joueur2)} />
        </div>

        <button type="submit" disabled={!isReady || saving}
          className={`w-full px-6 py-3 rounded-xl font-semibold text-white transition-colors ${isReady && !saving ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-300 cursor-not-allowed'}`}>
          {saving ? 'Enregistrement...' : 'Enregistrer la journée'}
        </button>
      </form>
    </div>
  );
};

export default AdminAddMatchForm;
