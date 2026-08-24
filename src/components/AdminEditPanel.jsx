import { useState, useMemo, useEffect } from 'react';
import { db } from '../firebase';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import { TeamButeurs, CscToggle } from './AdminAddMatchForm';
import { usePlayerPhotos } from './PlayerAvatar.jsx';

const JOUEURS = ['Paul', 'Adrien', 'Tiago', 'Roman'];
const LIGUES = ['Ligue 1', 'Premier League', 'Liga', 'Serie A', 'Ligue des Champions'];

function normalizeLegacyButeurs(match) {
  if (match.buteurs) return match.buteurs;
  return [
    ...(match.buteurs_j1 || []).map(b => ({ ...b, acheteur: match.joueur1 })),
    ...(match.buteurs_j2 || []).map(b => ({ ...b, acheteur: match.joueur2 })),
  ];
}

function calcResult(b1, b2) {
  if (b1 > b2) return { points_j1: 3, points_j2: 0, resultat: 'victoire_j1' };
  if (b1 < b2) return { points_j1: 0, points_j2: 3, resultat: 'victoire_j2' };
  return { points_j1: 1, points_j2: 1, resultat: 'nul' };
}

const AdminEditPanel = ({ matchData, joueurs, saisons, mercatoData, showToast, onClose, initialMatch, onConsumeInitialMatch, onBackToClassements }) => {
  const [selSaison, setSelSaison] = useState('');
  const [selLigue, setSelLigue] = useState('');
  const [selChamp, setSelChamp] = useState('');
  const [selMatchIds, setSelMatchIds] = useState([]);
  const [selChamps, setSelChamps] = useState([]);
  const [editing, setEditing] = useState(null);
  const [buteurs, setButeurs] = useState({ m: [] });
  const [notes, setNotes] = useState({ m: [] });
  const [cameFromExternal, setCameFromExternal] = useState(false);
  const photos = usePlayerPhotos();

  const championnats = useMemo(() => {
    if (!selSaison || !selLigue) return [];
    return [...new Set(matchData.filter(m => m.saison === selSaison && m.ligue === selLigue).map(m => m.championnat))].sort((a, b) => {
      const na = parseInt(a.match(/#(\d+)/)?.[1] || '0');
      const nb = parseInt(b.match(/#(\d+)/)?.[1] || '0');
      return na - nb;
    });
  }, [matchData, selSaison, selLigue]);

  const currentMatches = useMemo(() => {
    if (!selSaison || !selLigue || !selChamp) return [];
    return matchData.filter(m => m.saison === selSaison && m.ligue === selLigue && m.championnat === selChamp);
  }, [matchData, selSaison, selLigue, selChamp]);

  const allLigues = useMemo(() => [...new Set(matchData.filter(m => m.saison === selSaison).map(m => m.ligue))], [matchData, selSaison]);

  const openEdit = (match) => {
    setEditing({ ...match, _buteurs: normalizeLegacyButeurs(match) });
    setButeurs({ m: normalizeLegacyButeurs(match) });
    setNotes({ m: match.notes || [] });
  };

  // Arrivée directe depuis "éditer ce match" dans Classements > Matchs :
  // ouvre le match sans passer par la sélection saison/ligue/championnat.
  useEffect(() => {
    if (initialMatch) {
      openEdit(initialMatch);
      setCameFromExternal(true);
      onConsumeInitialMatch?.();
    }
  }, [initialMatch]);

  // Arrivé directement depuis Classements > Matchs (pas de saison/ligue/
  // championnat sélectionnés ici) : revenir à la liste de sélection n'aurait
  // aucun sens, on retourne plutôt à Classements.
  const goBack = () => cameFromExternal ? onBackToClassements?.() : setEditing(null);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const b1 = parseInt(editing.buts_j1), b2 = parseInt(editing.buts_j2);
      const updated = {
        ...editing,
        buts_j1: b1,
        buts_j2: b2,
        ...calcResult(b1, b2),
        buteurs: buteurs.m,
        notes: notes.m,
      };
      delete updated._buteurs;
      delete updated.buteurs_j1;
      delete updated.buteurs_j2;
      delete updated.firestoreId;
      await setDoc(doc(db, 'matches', editing.firestoreId), updated);
      showToast('Match modifié');
      goBack();
    } catch {
      showToast('Erreur lors de la modification', 'error');
    }
  };

  const handleDeleteMatch = async (firestoreId) => {
    try {
      await deleteDoc(doc(db, 'matches', firestoreId));
      showToast('Match supprimé');
      goBack();
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const handleDeleteMatches = async () => {
    try {
      await Promise.all(selMatchIds.map(id => deleteDoc(doc(db, 'matches', id))));
      showToast(`${selMatchIds.length} match(s) supprimé(s)`);
      setSelMatchIds([]);
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const handleDeleteChamps = async () => {
    try {
      const toDelete = matchData.filter(m => selChamps.includes(m.championnat) && m.saison === selSaison && m.ligue === selLigue);
      await Promise.all(toDelete.map(m => deleteDoc(doc(db, 'matches', m.firestoreId))));
      showToast(`${toDelete.length} match(s) supprimé(s)`);
      setSelChamps([]);
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  if (editing) {
    // Fond du score : vert léger pour le gagnant, rouge léger pour le
    // perdant, gris léger en cas d'égalité.
    const scoreBg = (mineRaw, otherRaw) => {
      const mine = parseInt(mineRaw), other = parseInt(otherRaw);
      if (isNaN(mine) || isNaN(other)) return '';
      if (mine > other) return 'bg-green-100/70 dark:bg-green-900/25';
      if (mine < other) return 'bg-red-100/70 dark:bg-red-900/25';
      return 'bg-slate-200/70 dark:bg-slate-700/40';
    };
    return (
      <div>
        <button onClick={goBack} className="mb-4 text-sm text-blue-600 hover:text-blue-800">← Retour</button>
        <form onSubmit={handleSave} className="space-y-4">
          <p className="text-sm text-slate-500">{editing.saison} · {editing.ligue} · {editing.championnat}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Saison</label>
              <select value={editing.saison} onChange={e => setEditing({ ...editing, saison: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                {saisons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" value={editing.dateMatch || ''} onChange={e => setEditing({ ...editing, dateMatch: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ligue</label>
              <select value={editing.ligue} onChange={e => setEditing({ ...editing, ligue: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                {LIGUES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Championnat</label>
              <input type="text" value={editing.championnat} onChange={e => setEditing({ ...editing, championnat: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{editing.joueur1}</label>
              <select value={editing.joueur1} onChange={e => setEditing({ ...editing, joueur1: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white mb-2">
                {JOUEURS.filter(j => j !== editing.joueur2).map(j => <option key={j} value={j}>{j}</option>)}
              </select>
              <input type="number" value={editing.buts_j1} onChange={e => setEditing({ ...editing, buts_j1: e.target.value })}
                min="0" className={`w-full px-3 py-2 border-2 border-blue-300 dark:border-blue-600 rounded-lg text-sm text-center font-bold ${scoreBg(editing.buts_j1, editing.buts_j2) || 'bg-white dark:bg-slate-800'}`} />
              <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                <input type="checkbox" checked={editing.valise_j1 || false} onChange={e => setEditing({ ...editing, valise_j1: e.target.checked })} className="w-3.5 h-3.5" />
                <span className="text-xs text-slate-500">Valise 💼</span>
              </label>
              <CscToggle coach={editing.joueur1} matchKey="m" buteurs={buteurs} setButeurs={setButeurs}
                saison={editing.saison} ligue={editing.ligue} championnat={editing.championnat} mercatoData={mercatoData} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{editing.joueur2}</label>
              <select value={editing.joueur2} onChange={e => setEditing({ ...editing, joueur2: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white mb-2">
                {JOUEURS.filter(j => j !== editing.joueur1).map(j => <option key={j} value={j}>{j}</option>)}
              </select>
              <input type="number" value={editing.buts_j2} onChange={e => setEditing({ ...editing, buts_j2: e.target.value })}
                min="0" className={`w-full px-3 py-2 border-2 border-emerald-300 dark:border-emerald-600 rounded-lg text-sm text-center font-bold ${scoreBg(editing.buts_j2, editing.buts_j1) || 'bg-white dark:bg-slate-800'}`} />
              <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                <input type="checkbox" checked={editing.valise_j2 || false} onChange={e => setEditing({ ...editing, valise_j2: e.target.checked })} className="w-3.5 h-3.5" />
                <span className="text-xs text-slate-500">Valise 💼</span>
              </label>
              <CscToggle coach={editing.joueur2} matchKey="m" buteurs={buteurs} setButeurs={setButeurs}
                saison={editing.saison} ligue={editing.ligue} championnat={editing.championnat} mercatoData={mercatoData} />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <div className="border-l-2 border-blue-300 dark:border-blue-600 pl-2">
              <TeamButeurs coach={editing.joueur1} matchKey="m" buteurs={buteurs} setButeurs={setButeurs} notes={notes} setNotes={setNotes}
                saison={editing.saison} ligue={editing.ligue} championnat={editing.championnat} mercatoData={mercatoData} photos={photos} />
            </div>
            <div className="border-l-2 border-emerald-300 dark:border-emerald-600 pl-2">
              <TeamButeurs coach={editing.joueur2} matchKey="m" buteurs={buteurs} setButeurs={setButeurs} notes={notes} setNotes={setNotes}
                saison={editing.saison} ligue={editing.ligue} championnat={editing.championnat} mercatoData={mercatoData} photos={photos} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">Enregistrer</button>
            <button type="button" onClick={() => handleDeleteMatch(editing.firestoreId)}
              className="px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">Supprimer</button>
            <button type="button" onClick={goBack}
              className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg font-medium">Annuler</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onClose} className="mb-4 text-sm text-blue-600 hover:text-blue-800">← Retour</button>
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Éditer / Supprimer un match</h3>

      <div className="space-y-4">
        {/* Saison */}
        {!selSaison && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Saison</label>
            <div className="space-y-2">
              {saisons.map(s => (
                <button key={s} onClick={() => setSelSaison(s)} className="w-full p-3 bg-white rounded-lg border hover:border-blue-400 text-left font-medium text-sm">{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Ligue */}
        {selSaison && !selLigue && (
          <div>
            <button onClick={() => setSelSaison('')} className="mb-3 text-sm text-blue-600 hover:text-blue-800">← Retour</button>
            <label className="block text-sm font-medium text-slate-700 mb-2">Compétition · {selSaison}</label>
            <div className="space-y-2">
              {allLigues.map(l => (
                <button key={l} onClick={() => setSelLigue(l)} className="w-full p-3 bg-white rounded-lg border hover:border-blue-400 text-left font-medium text-sm">{l}</button>
              ))}
            </div>
          </div>
        )}

        {/* Championnats */}
        {selSaison && selLigue && !selChamp && (
          <div>
            <button onClick={() => { setSelLigue(''); setSelChamps([]); }} className="mb-3 text-sm text-blue-600 hover:text-blue-800">← Retour</button>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-slate-700">{selLigue}</label>
              <div className="flex gap-2">
                {championnats.length > 0 && (
                  <button onClick={() => setSelChamps(selChamps.length === championnats.length ? [] : championnats)}
                    className="px-3 py-1 text-xs bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                    {selChamps.length === championnats.length ? 'Désélectionner tout' : 'Tout sélectionner'}
                  </button>
                )}
                {selChamps.length > 0 && (
                  <button onClick={handleDeleteChamps} className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
                    Supprimer ({selChamps.length})
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {championnats.map(ch => (
                <div key={ch} className="flex items-center gap-2 p-3 bg-white rounded-lg border">
                  <input type="checkbox" checked={selChamps.includes(ch)}
                    onChange={e => setSelChamps(e.target.checked ? [...selChamps, ch] : selChamps.filter(c => c !== ch))}
                    onClick={e => e.stopPropagation()} className="w-4 h-4 text-red-600 cursor-pointer" />
                  <button onClick={() => setSelChamp(ch)} className="flex-1 text-left text-sm font-medium hover:text-blue-600">{ch}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Matches */}
        {selSaison && selLigue && selChamp && (
          <div>
            <button onClick={() => { setSelChamp(''); setSelMatchIds([]); }} className="mb-3 text-sm text-blue-600 hover:text-blue-800">← Retour</button>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-slate-700">{selChamp}</label>
              <div className="flex gap-2">
                {currentMatches.length > 0 && (
                  <button onClick={() => { const ids = currentMatches.map(m => m.firestoreId); setSelMatchIds(selMatchIds.length === ids.length ? [] : ids); }}
                    className="px-3 py-1 text-xs bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                    {selMatchIds.length === currentMatches.length ? 'Désélectionner tout' : 'Tout sélectionner'}
                  </button>
                )}
                {selMatchIds.length > 0 && (
                  <button onClick={handleDeleteMatches} className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
                    Supprimer ({selMatchIds.length})
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {currentMatches.map(match => (
                <div key={match.firestoreId} className="flex items-center gap-2 p-3 bg-white rounded-lg border">
                  <input type="checkbox" checked={selMatchIds.includes(match.firestoreId)}
                    onChange={e => setSelMatchIds(e.target.checked ? [...selMatchIds, match.firestoreId] : selMatchIds.filter(id => id !== match.firestoreId))}
                    onClick={e => e.stopPropagation()} className="w-4 h-4 text-red-600 cursor-pointer" />
                  <button onClick={() => openEdit(match)} className="flex-1 text-left hover:bg-slate-50 rounded px-2 py-1">
                    <p className="text-sm font-semibold text-slate-800">{match.joueur1} {match.buts_j1} – {match.buts_j2} {match.joueur2}</p>
                    <p className="text-xs text-slate-500">
                      {match.dateMatch || 'Date ?'}
                      {match.valise_j1 && ` · 💼 ${match.joueur1}`}
                      {match.valise_j2 && ` · 💼 ${match.joueur2}`}
                      {(match.buteurs || match.buteurs_j1 || []).length > 0 && ` · ⚽ ${(match.buteurs || [...(match.buteurs_j1||[]), ...(match.buteurs_j2||[])]).map(b => b.joueur).join(', ')}`}
                    </p>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminEditPanel;
