import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';

const AdminEditPanel = ({ matchData, joueurs, onClose }) => {
  const [editSelectedSaison, setEditSelectedSaison] = useState('');
  const [editSelectedLigue, setEditSelectedLigue] = useState('');
  const [editSelectedChampionnat, setEditSelectedChampionnat] = useState('');
  const [selectedMatchesToDelete, setSelectedMatchesToDelete] = useState([]);
  const [selectedChampionnatsToDelete, setSelectedChampionnatsToDelete] = useState([]);
  const [editingMatch, setEditingMatch] = useState(null);

  const handleEditMatch = async (e) => {
    e.preventDefault();
    try {
      const { buts_j1, buts_j2 } = editingMatch;
      let points_j1, points_j2, resultat;
      if (buts_j1 > buts_j2) { points_j1 = 3; points_j2 = 0; resultat = 'victoire_j1'; }
      else if (buts_j1 < buts_j2) { points_j1 = 0; points_j2 = 3; resultat = 'victoire_j2'; }
      else { points_j1 = 1; points_j2 = 1; resultat = 'nul'; }
      const updatedMatch = { ...editingMatch, points_j1, points_j2, resultat };
      delete updatedMatch.index;
      await setDoc(doc(db, 'matches', matchData[editingMatch.index].firestoreId), updatedMatch);
      alert('Match modifié avec succès !');
      setEditingMatch(null);
    } catch (error) {
      console.error('Error editing match:', error);
      alert('Erreur lors de la modification du match');
    }
  };

  return (
    <div className="bg-slate-50 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-800">Éditer / Supprimer un match</h3>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-800">Annuler</button>
      </div>

      {!editingMatch ? (
        <div className="space-y-4">
          {!editSelectedSaison && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Sélectionnez une saison</label>
              <div className="space-y-2">
                {['2025/2026', '2024/2025'].map(saison => (
                  <button key={saison} onClick={() => setEditSelectedSaison(saison)} className="w-full p-4 bg-white rounded-lg border hover:border-blue-500 text-left font-semibold">{saison}</button>
                ))}
              </div>
            </div>
          )}

          {editSelectedSaison && !editSelectedLigue && (
            <div>
              <button onClick={() => setEditSelectedSaison('')} className="mb-3 text-sm text-blue-600 hover:text-blue-800">← Retour aux saisons</button>
              <label className="block text-sm font-medium text-slate-700 mb-2">Sélectionnez une compétition ({editSelectedSaison})</label>
              <div className="space-y-2">
                {Array.from(new Set(matchData.filter(m => m.saison === editSelectedSaison).map(m => m.ligue))).map(ligue => (
                  <button key={ligue} onClick={() => setEditSelectedLigue(ligue)} className="w-full p-4 bg-white rounded-lg border hover:border-blue-500 text-left font-semibold">{ligue}</button>
                ))}
              </div>
            </div>
          )}

          {editSelectedSaison && editSelectedLigue && !editSelectedChampionnat && (() => {
            const championnats = Array.from(new Set(matchData.filter(m => m.saison === editSelectedSaison && m.ligue === editSelectedLigue).map(m => m.championnat)));
            return (
              <div>
                <button onClick={() => { setEditSelectedLigue(''); setSelectedChampionnatsToDelete([]); }} className="mb-3 text-sm text-blue-600 hover:text-blue-800">← Retour aux compétitions</button>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-slate-700">Sélectionnez un championnat ({editSelectedLigue})</label>
                  <div className="flex gap-2">
                    {championnats.length > 0 && (
                      <button type="button" onClick={() => setSelectedChampionnatsToDelete(selectedChampionnatsToDelete.length === championnats.length ? [] : championnats)} className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                        {selectedChampionnatsToDelete.length === championnats.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                      </button>
                    )}
                    {selectedChampionnatsToDelete.length > 0 && (
                      <button type="button" onClick={async () => {
                        if (confirm(`Êtes-vous sûr de vouloir supprimer ${selectedChampionnatsToDelete.length} championnat(s) et tous leurs matchs ?`)) {
                          try {
                            const toDelete = matchData.filter(m => selectedChampionnatsToDelete.includes(m.championnat) && m.saison === editSelectedSaison && m.ligue === editSelectedLigue);
                            await Promise.all(toDelete.map(m => deleteDoc(doc(db, 'matches', m.firestoreId))));
                            alert(`${toDelete.length} match(s) supprimé(s) avec succès !`);
                            setSelectedChampionnatsToDelete([]);
                          } catch (error) {
                            console.error('Error deleting championships:', error);
                            alert('Erreur lors de la suppression des championnats');
                          }
                        }
                      }} className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
                        Supprimer ({selectedChampionnatsToDelete.length})
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {championnats.sort((a, b) => parseInt(a.match(/#(\d+)/)?.[1] || '0') - parseInt(b.match(/#(\d+)/)?.[1] || '0')).map(ch => (
                    <div key={ch} className="flex items-center gap-2 p-4 bg-white rounded-lg border">
                      <input type="checkbox" checked={selectedChampionnatsToDelete.includes(ch)}
                        onChange={(e) => setSelectedChampionnatsToDelete(e.target.checked ? [...selectedChampionnatsToDelete, ch] : selectedChampionnatsToDelete.filter(c => c !== ch))}
                        onClick={(e) => e.stopPropagation()} className="w-4 h-4 text-red-600 cursor-pointer" />
                      <button onClick={() => setEditSelectedChampionnat(ch)} className="flex-1 text-left hover:bg-slate-50 rounded px-2 py-1 font-semibold">{ch}</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {editSelectedSaison && editSelectedLigue && editSelectedChampionnat && (() => {
            const currentMatches = matchData.filter(m => m.saison === editSelectedSaison && m.ligue === editSelectedLigue && m.championnat === editSelectedChampionnat);
            return (
              <div>
                <button onClick={() => { setEditSelectedChampionnat(''); setSelectedMatchesToDelete([]); }} className="mb-3 text-sm text-blue-600 hover:text-blue-800">← Retour aux championnats</button>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-slate-700">Sélectionnez un match ({editSelectedChampionnat})</label>
                  <div className="flex gap-2">
                    {currentMatches.length > 0 && (
                      <button type="button" onClick={() => { const ids = currentMatches.map(m => m.firestoreId); setSelectedMatchesToDelete(selectedMatchesToDelete.length === ids.length ? [] : ids); }} className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                        {selectedMatchesToDelete.length === currentMatches.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                      </button>
                    )}
                    {selectedMatchesToDelete.length > 0 && (
                      <button type="button" onClick={async () => {
                        if (confirm(`Êtes-vous sûr de vouloir supprimer ${selectedMatchesToDelete.length} match(s) ?`)) {
                          try {
                            await Promise.all(selectedMatchesToDelete.map(id => deleteDoc(doc(db, 'matches', id))));
                            alert(`${selectedMatchesToDelete.length} match(s) supprimé(s) avec succès !`);
                            setSelectedMatchesToDelete([]);
                          } catch (error) {
                            console.error('Error deleting matches:', error);
                            alert('Erreur lors de la suppression des matchs');
                          }
                        }
                      }} className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
                        Supprimer ({selectedMatchesToDelete.length})
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {matchData.map((match, index) => ({ match, index })).filter(({ match }) => match.saison === editSelectedSaison && match.ligue === editSelectedLigue && match.championnat === editSelectedChampionnat).map(({ match, index }) => (
                    <div key={index} className="flex items-center gap-2 p-4 bg-white rounded-lg border">
                      <input type="checkbox" checked={selectedMatchesToDelete.includes(match.firestoreId)}
                        onChange={(e) => setSelectedMatchesToDelete(e.target.checked ? [...selectedMatchesToDelete, match.firestoreId] : selectedMatchesToDelete.filter(id => id !== match.firestoreId))}
                        onClick={(e) => e.stopPropagation()} className="w-4 h-4 text-red-600 cursor-pointer" />
                      <button onClick={() => setEditingMatch({ ...match, index })} className="flex-1 text-left hover:bg-slate-50 rounded px-2 py-1">
                        <p className="font-semibold text-slate-800">{match.joueur1} {match.buts_j1} - {match.buts_j2} {match.joueur2}{match.joueur3 && ` • ${match.joueur3} ${match.buts_j3} - ${match.buts_j4} ${match.joueur4}`}</p>
                        <p className="text-sm text-slate-600">{match.dateMatch || 'Date non définie'}{match.valise_j1 && ' 🧳 ' + match.joueur1}{match.valise_j2 && ' 🧳 ' + match.joueur2}</p>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <form onSubmit={handleEditMatch} className="space-y-4">
          <p className="text-sm text-slate-600"><strong>Match :</strong> {editingMatch.saison} • {editingMatch.ligue} • {editingMatch.championnat}</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date du match</label>
            <input type="date" value={editingMatch.dateMatch || new Date().toISOString().split('T')[0]} onChange={(e) => setEditingMatch({ ...editingMatch, dateMatch: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Joueur 1</label>
              <select value={editingMatch.joueur1} onChange={(e) => setEditingMatch({ ...editingMatch, joueur1: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                {joueurs.filter(j => j !== editingMatch.joueur2).map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Joueur 2</label>
              <select value={editingMatch.joueur2} onChange={(e) => setEditingMatch({ ...editingMatch, joueur2: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                {joueurs.filter(j => j !== editingMatch.joueur1).map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Buts {editingMatch.joueur1}</label>
              <input type="number" value={editingMatch.buts_j1} onChange={(e) => setEditingMatch({ ...editingMatch, buts_j1: parseInt(e.target.value) || 0 })} min="0" className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
              <label className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={editingMatch.valise_j1 || false} onChange={(e) => setEditingMatch({ ...editingMatch, valise_j1: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm">🧳 Valise {editingMatch.joueur1}</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Buts {editingMatch.joueur2}</label>
              <input type="number" value={editingMatch.buts_j2} onChange={(e) => setEditingMatch({ ...editingMatch, buts_j2: parseInt(e.target.value) || 0 })} min="0" className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
              <label className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={editingMatch.valise_j2 || false} onChange={(e) => setEditingMatch({ ...editingMatch, valise_j2: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm">🧳 Valise {editingMatch.joueur2}</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">Enregistrer</button>
            <button type="button" onClick={async () => {
              if (confirm('Êtes-vous sûr de vouloir supprimer ce match ?')) {
                try {
                  await deleteDoc(doc(db, 'matches', matchData[editingMatch.index].firestoreId));
                  alert('Match supprimé avec succès !');
                  setEditingMatch(null);
                } catch (error) {
                  console.error('Error deleting match:', error);
                  alert('Erreur lors de la suppression du match');
                }
              }
            }} className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">Supprimer</button>
            <button type="button" onClick={() => setEditingMatch(null)} className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-medium">Retour</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AdminEditPanel;
