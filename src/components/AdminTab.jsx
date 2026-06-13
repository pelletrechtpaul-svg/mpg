import React, { useState, useMemo } from 'react';
import { Lock, Plus, Edit } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, collection, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { encodeFirestoreKey } from '../shared.jsx';

const EMPTY_FORM = {
  saison: '2025/2026',
  ligue: '',
  championnat: '',
  isNewChampionnat: false,
  newChampionnatMatchs: 6,
  joueur1: '',
  joueur2: '',
  buts_j1: '',
  buts_j2: '',
  valise_j1: false,
  valise_j2: false,
  joueur3: '',
  joueur4: '',
  buts_j3: '',
  buts_j4: '',
  valise_j3: false,
  valise_j4: false,
  dateMatch: new Date().toISOString().split('T')[0]
};

const AdminTab = ({ matchData, mercatoData, joueurs, ligueMetadata, ligues, isAdminAuthenticated }) => {
  const [loginError, setLoginError] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAddMatchForm, setShowAddMatchForm] = useState(false);
  const [showEditMatchForm, setShowEditMatchForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [editSelectedSaison, setEditSelectedSaison] = useState('');
  const [editSelectedLigue, setEditSelectedLigue] = useState('');
  const [editSelectedChampionnat, setEditSelectedChampionnat] = useState('');
  const [selectedMatchesToDelete, setSelectedMatchesToDelete] = useState([]);
  const [selectedChampionnatsToDelete, setSelectedChampionnatsToDelete] = useState([]);
  const [adminFormData, setAdminFormData] = useState(EMPTY_FORM);
  const [buteurs, setButeurs] = useState({ m1j1: [], m1j2: [], m2j1: [], m2j2: [] });
  const [scorerSearch, setScorerSearch] = useState({ m1j1: '', m1j2: '', m2j1: '', m2j2: '' });

  const adminChampionnatsByLigue = useMemo(() => {
    const adminData = adminFormData.saison === 'All-Time'
      ? matchData
      : matchData.filter(d => d.saison === adminFormData.saison);
    const map = {};
    ligues.forEach(ligue => {
      map[ligue] = [...new Set(
        adminData.filter(d => d.ligue === ligue).map(d => d.championnat)
      )].sort();
    });
    return map;
  }, [matchData, ligues, adminFormData.saison]);

  const valiseUsed = useMemo(() => {
    if (!adminFormData.ligue || !adminFormData.championnat) return {};
    const champMatches = matchData.filter(m =>
      m.saison === adminFormData.saison &&
      m.ligue === adminFormData.ligue &&
      m.championnat === adminFormData.championnat
    );
    const used = {};
    champMatches.forEach(match => {
      if (match.valise_j1) used[match.joueur1] = true;
      if (match.valise_j2) used[match.joueur2] = true;
    });
    return used;
  }, [matchData, adminFormData.saison, adminFormData.ligue, adminFormData.championnat]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
      setAdminEmail('');
      setAdminPassword('');
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Identifiants incorrects ou compte admin introuvable.');
      setAdminPassword('');
    }
  };

  const handleAdminLogout = async () => {
    try {
      await signOut(auth);
      setShowAddMatchForm(false);
      setShowEditMatchForm(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleAddMatch = async (e) => {
    e.preventDefault();
    const { saison, ligue, championnat, isNewChampionnat, newChampionnatMatchs, joueur1, joueur2, buts_j1, buts_j2, valise_j1, valise_j2, joueur3, joueur4, buts_j3, buts_j4, valise_j3, valise_j4, dateMatch } = adminFormData;

    if (!ligue || !joueur1 || !joueur2) {
      alert('Veuillez remplir tous les champs du premier match');
      return;
    }
    if (joueur1 === joueur2) {
      alert('Les deux joueurs doivent être différents');
      return;
    }
    if (buts_j1 === '' || buts_j2 === '') {
      alert('Veuillez entrer les buts des deux joueurs du premier match');
      return;
    }
    if (!dateMatch) {
      alert('Veuillez renseigner la date du match');
      return;
    }

    const b1 = parseInt(buts_j1);
    const b2 = parseInt(buts_j2);

    if (b1 < 0 || b2 < 0) { alert('Les buts ne peuvent pas être négatifs'); return; }
    if (b1 > 30 || b2 > 30) { alert('Score inhabituellement élevé (> 30). Vérifiez la saisie.'); return; }

    const isDuplicate = matchData.some(m =>
      m.dateMatch === dateMatch &&
      m.championnat === championnat &&
      ((m.joueur1 === joueur1 && m.joueur2 === joueur2) ||
       (m.joueur1 === joueur2 && m.joueur2 === joueur1))
    );
    if (isDuplicate) {
      const ok = window.confirm('Un match entre ces deux joueurs dans ce championnat à cette date existe déjà. Continuer quand même ?');
      if (!ok) return;
    }

    const hasSecondMatch = joueur3 && joueur4 && buts_j3 !== '' && buts_j4 !== '';
    if (hasSecondMatch) {
      if (joueur3 === joueur4) { alert('Match 2 : les deux joueurs doivent être différents'); return; }
      const allFour = [joueur1, joueur2, joueur3, joueur4];
      if (new Set(allFour).size < 4) { alert('Match 2 : les joueurs doivent être différents de ceux du match 1'); return; }
      const b3 = parseInt(buts_j3);
      const b4 = parseInt(buts_j4);
      if (b3 < 0 || b4 < 0) { alert('Match 2 : les buts ne peuvent pas être négatifs'); return; }
      if (b3 > 30 || b4 > 30) { alert('Match 2 : score inhabituellement élevé (> 30). Vérifiez la saisie.'); return; }
    }

    let championnatToUse = championnat;
    if (isNewChampionnat) {
      const existingCount = matchData.filter(d => d.saison === saison && d.ligue === ligue)
        .reduce((acc, d) => { if (!acc.includes(d.championnat)) acc.push(d.championnat); return acc; }, []).length;
      championnatToUse = `#${existingCount + 1}`;
    }
    if (!championnatToUse) { alert('Veuillez sélectionner ou créer un championnat'); return; }

    const newMatches = [];
    const currentDate = new Date().toISOString();
    const butsJ1 = parseInt(buts_j1) || 0;
    const butsJ2 = parseInt(buts_j2) || 0;

    let points_j1, points_j2, resultat;
    if (butsJ1 > butsJ2) { points_j1 = 3; points_j2 = 0; resultat = 'victoire_j1'; }
    else if (butsJ1 < butsJ2) { points_j1 = 0; points_j2 = 3; resultat = 'victoire_j2'; }
    else { points_j1 = 1; points_j2 = 1; resultat = 'nul'; }

    newMatches.push({ saison, ligue, championnat: championnatToUse, joueur1, joueur2, buts_j1: butsJ1, buts_j2: butsJ2, valise_j1, valise_j2, resultat, points_j1, points_j2, dateMatch, dateEntree: currentDate, buteurs_j1: buteurs.m1j1, buteurs_j2: buteurs.m1j2 });

    if (hasSecondMatch) {
      const butsJ3 = parseInt(buts_j3) || 0;
      const butsJ4 = parseInt(buts_j4) || 0;
      let points_j3, points_j4, resultat2;
      if (butsJ3 > butsJ4) { points_j3 = 3; points_j4 = 0; resultat2 = 'victoire_j1'; }
      else if (butsJ3 < butsJ4) { points_j3 = 0; points_j4 = 3; resultat2 = 'victoire_j2'; }
      else { points_j3 = 1; points_j4 = 1; resultat2 = 'nul'; }
      newMatches.push({ saison, ligue, championnat: championnatToUse, joueur1: joueur3, joueur2: joueur4, buts_j1: butsJ3, buts_j2: butsJ4, valise_j1: valise_j3, valise_j2: valise_j4, resultat: resultat2, points_j1: points_j3, points_j2: points_j4, dateMatch, dateEntree: currentDate, buteurs_j1: buteurs.m2j1, buteurs_j2: buteurs.m2j2 });
    }

    try {
      const batch = writeBatch(db);
      newMatches.forEach(match => {
        const matchRef = doc(collection(db, 'matches'));
        batch.set(matchRef, { ...match, id: matchRef.id });
      });

      const ligueKey = `${saison}-${ligue}-${championnatToUse}`;
      const metaRef = doc(db, 'metadata', encodeFirestoreKey(ligueKey));
      if (isNewChampionnat) {
        batch.set(metaRef, { createdAt: currentDate, matchsTotal: newChampionnatMatchs, matchsEntered: 1, lastEntryDate: currentDate });
      } else if (ligueMetadata[ligueKey]) {
        batch.set(metaRef, { ...ligueMetadata[ligueKey], matchsEntered: ligueMetadata[ligueKey].matchsEntered + 1, lastEntryDate: currentDate });
      }

      await batch.commit();
    } catch (error) {
      console.error('Error saving matches:', error);
      alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
      return;
    }

    setShowAddMatchForm(false);
    setAdminFormData({ ...EMPTY_FORM, dateMatch: new Date().toISOString().split('T')[0] });
    setButeurs({ m1j1: [], m1j2: [], m2j1: [], m2j2: [] });
    setScorerSearch({ m1j1: '', m1j2: '', m2j1: '', m2j2: '' });
    alert('Match ajouté avec succès !');
  };

  const handleEditMatch = async (e) => {
    e.preventDefault();
    const { index, joueur1, joueur2, buts_j1, buts_j2, dateMatch } = editingMatch;
    const butsJ1 = parseInt(buts_j1);
    const butsJ2 = parseInt(buts_j2);

    let points_j1, points_j2, resultat;
    if (butsJ1 > butsJ2) { points_j1 = 3; points_j2 = 0; resultat = 'victoire_j1'; }
    else if (butsJ1 < butsJ2) { points_j1 = 0; points_j2 = 3; resultat = 'victoire_j2'; }
    else { points_j1 = 1; points_j2 = 1; resultat = 'nul'; }

    const match = matchData[index];
    const updatedMatch = { ...match, joueur1, joueur2, buts_j1: butsJ1, buts_j2: butsJ2, resultat, points_j1, points_j2, dateMatch: dateMatch || match.dateMatch, dateEntree: new Date().toISOString() };

    try {
      if (match.firestoreId) {
        await setDoc(doc(db, 'matches', match.firestoreId), updatedMatch);
      }
      setShowEditMatchForm(false);
      setEditingMatch(null);
      alert('Match modifié !');
    } catch (error) {
      console.error('Error updating match:', error);
      alert('Erreur lors de la modification');
    }
  };

  const handleRecalculateMetadata = async () => {
    if (!confirm('Recalculer toutes les métadonnées des championnats en fonction du nombre réel de matchs dans la base de données ?')) return;
    try {
      const championshipGroups = {};
      matchData.forEach(match => {
        const key = `${match.saison}-${match.ligue}-${match.championnat}`;
        if (!championshipGroups[key]) championshipGroups[key] = [];
        championshipGroups[key].push(match);
      });

      const batch = writeBatch(db);
      let updatedCount = 0;

      Object.entries(championshipGroups).forEach(([key, matches]) => {
        const uniqueDates = new Set(matches.map(m => m.dateMatch));
        const actualMatchDays = uniqueDates.size;
        const metadata = ligueMetadata[key];
        if (metadata) {
          if (metadata.matchsEntered !== actualMatchDays) {
            batch.set(doc(db, 'metadata', encodeFirestoreKey(key)), { ...metadata, matchsEntered: actualMatchDays, lastRecalculated: new Date().toISOString() });
            updatedCount++;
          }
        } else {
          batch.set(doc(db, 'metadata', encodeFirestoreKey(key)), { createdAt: new Date().toISOString(), matchsTotal: actualMatchDays, matchsEntered: actualMatchDays, lastRecalculated: new Date().toISOString() });
          updatedCount++;
        }
      });

      await batch.commit();
      alert(`✅ Recalcul terminé ! ${updatedCount} championnat(s) mis à jour.`);
    } catch (error) {
      console.error('Error recalculating metadata:', error);
      alert('❌ Erreur lors du recalcul des métadonnées');
    }
  };

  const addScorer = (key, player, isCsc) => {
    setButeurs(prev => {
      const list = prev[key];
      const idx = list.findIndex(b => b.joueur === player.joueur && b.prenom === player.prenom && b.csc === isCsc);
      if (idx >= 0) {
        const updated = [...list];
        updated[idx] = { ...updated[idx], buts: updated[idx].buts + 1 };
        return { ...prev, [key]: updated };
      }
      return { ...prev, [key]: [...list, { joueur: player.joueur, prenom: player.prenom, club: player.club, buts: 1, csc: isCsc }] };
    });
    setScorerSearch(prev => ({ ...prev, [key]: '' }));
  };

  const removeScorer = (key, idx) => {
    setButeurs(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  };

  const updateScorerButs = (key, idx, delta) => {
    setButeurs(prev => {
      const list = [...prev[key]];
      const newButs = list[idx].buts + delta;
      if (newButs <= 0) list.splice(idx, 1);
      else list[idx] = { ...list[idx], buts: newButs };
      return { ...prev, [key]: list };
    });
  };

  const renderScorerSection = (key, ownerName, opponentName) => {
    const { saison, ligue } = adminFormData;
    const searchText = scorerSearch[key];
    const selectedScorers = buteurs[key];

    const dedup = players => {
      const seen = new Set();
      return players.filter(p => {
        const k = `${p.joueur}|${p.prenom}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    };

    const ownPlayers = dedup(mercatoData.filter(p => p.acheteur === ownerName && p.saison === saison && p.ligue === ligue));
    const oppPlayers = dedup(mercatoData.filter(p => p.acheteur === opponentName && p.saison === saison && p.ligue === ligue));

    const searchLower = searchText.toLowerCase().trim();
    const suggestions = searchLower.length >= 2 ? [
      ...ownPlayers.filter(p => `${p.joueur} ${p.prenom}`.toLowerCase().includes(searchLower)).map(p => ({ ...p, isCsc: false })),
      ...oppPlayers.filter(p => `${p.joueur} ${p.prenom}`.toLowerCase().includes(searchLower)).map(p => ({ ...p, isCsc: true }))
    ].slice(0, 8) : [];

    return (
      <div className="mt-3">
        <p className="text-xs font-medium text-slate-500 mb-2">Buteurs (optionnel)</p>
        {selectedScorers.length > 0 && (
          <div className="flex flex-col gap-1 mb-2">
            {selectedScorers.map((s, i) => (
              <div key={i} className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs">
                <span className="flex-1 truncate">
                  {s.prenom ? `${s.prenom} ${s.joueur}` : s.joueur}
                  {s.club ? ` (${s.club})` : ''}
                  {s.csc ? ' — csc' : ''}
                </span>
                <button type="button" onClick={() => updateScorerButs(key, i, -1)} className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-700 font-bold">−</button>
                <span className="font-bold w-4 text-center">{s.buts}</span>
                <button type="button" onClick={() => updateScorerButs(key, i, 1)} className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-700 font-bold">+</button>
                <button type="button" onClick={() => removeScorer(key, i)} className="text-red-400 hover:text-red-600 ml-1">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          <input
            type="text"
            value={searchText}
            onChange={e => setScorerSearch(prev => ({ ...prev, [key]: e.target.value }))}
            placeholder="Rechercher un buteur..."
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
              {suggestions.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => addScorer(key, p, p.isCsc)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100 last:border-0"
                >
                  <span className="flex-1">
                    {p.prenom ? `${p.prenom} ${p.joueur}` : p.joueur}
                    {p.club ? ` — ${p.club}` : ''}
                  </span>
                  {p.isCsc && <span className="text-orange-500 font-medium shrink-0">CSC</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {!isAdminAuthenticated ? (
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md mx-auto">
          <div className="text-center mb-6">
            <Lock className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Accès Admin</h2>
          </div>
          <form onSubmit={handleAdminLogin}>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="Email"
              autoComplete="username"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4"
              autoFocus
            />
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Mot de passe"
              autoComplete="current-password"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4"
            />
            {loginError && (
              <p className="text-red-600 text-sm mb-3">{loginError}</p>
            )}
            <button type="submit" className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">
              Se connecter
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Panel Admin</h2>
              <button onClick={handleAdminLogout} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg">
                Déconnexion
              </button>
            </div>

            {!showAddMatchForm && !showEditMatchForm ? (
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowAddMatchForm(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Ajouter un match
                </button>
                {matchData.length > 0 && (
                  <>
                    <button
                      onClick={() => {
                        setShowEditMatchForm(true);
                        setEditSelectedSaison('');
                        setEditSelectedLigue('');
                        setEditSelectedChampionnat('');
                        setEditingMatch(null);
                      }}
                      className="px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 inline-flex items-center gap-2"
                    >
                      <Edit className="w-5 h-5" />
                      Éditer un match
                    </button>
                    <button
                      onClick={handleRecalculateMetadata}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 inline-flex items-center gap-2"
                      title="Recalculer les métadonnées des championnats (nombre de matchs, etc.)"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Recalculer métadonnées
                    </button>
                  </>
                )}
              </div>
            ) : showAddMatchForm ? (
              <div className="bg-slate-50 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Nouveau match</h3>
                  <button
                    onClick={() => {
                      setShowAddMatchForm(false);
                      setAdminFormData({ ...EMPTY_FORM, dateMatch: new Date().toISOString().split('T')[0] });
                      setButeurs({ m1j1: [], m1j2: [], m2j1: [], m2j2: [] });
                      setScorerSearch({ m1j1: '', m1j2: '', m2j1: '', m2j2: '' });
                    }}
                    className="text-slate-600 hover:text-slate-800"
                  >
                    Annuler
                  </button>
                </div>
                <form onSubmit={handleAddMatch} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Saison</label>
                    <select
                      value={adminFormData.saison}
                      onChange={(e) => setAdminFormData({...adminFormData, saison: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="2025/2026">2025/2026</option>
                      <option value="2024/2025">2024/2025</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Ligue</label>
                    <div className="flex flex-wrap gap-3">
                      {['Ligue 1', 'Premier League', 'Liga', 'Serie A', 'Ligue des Champions'].map(ligue => (
                        <label key={ligue} className="inline-flex items-center">
                          <input
                            type="radio"
                            name="ligue"
                            value={ligue}
                            checked={adminFormData.ligue === ligue}
                            onChange={(e) => setAdminFormData({
                              ...adminFormData,
                              ligue: e.target.value,
                              championnat: '',
                              isNewChampionnat: false
                            })}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm">{ligue}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {adminFormData.ligue && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Championnat</label>
                      <div className="space-y-2">
                        {adminChampionnatsByLigue[adminFormData.ligue]?.map(ch => (
                          <label key={ch} className="flex items-center">
                            <input
                              type="radio"
                              name="championnat"
                              value={ch}
                              checked={!adminFormData.isNewChampionnat && adminFormData.championnat === ch}
                              onChange={(e) => setAdminFormData({
                                ...adminFormData,
                                championnat: e.target.value,
                                isNewChampionnat: false
                              })}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="ml-2 text-sm">{ch}</span>
                          </label>
                        ))}

                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="championnat"
                            checked={adminFormData.isNewChampionnat}
                            onChange={() => setAdminFormData({
                              ...adminFormData,
                              isNewChampionnat: true,
                              championnat: ''
                            })}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm font-medium text-blue-600">Nouveau championnat</span>
                        </label>

                        {adminFormData.isNewChampionnat && (
                          <div className="ml-6 space-y-3">
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <p className="text-sm text-blue-800">
                                <strong>Nom :</strong> #{
                                  matchData.filter(d => d.saison === adminFormData.saison && d.ligue === adminFormData.ligue)
                                    .reduce((acc, d) => {
                                      if (!acc.includes(d.championnat)) acc.push(d.championnat);
                                      return acc;
                                    }, []).length + 1
                                }
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm text-slate-700 mb-1">Nombre de matchs</label>
                              <input
                                type="number"
                                value={adminFormData.newChampionnatMatchs}
                                onChange={(e) => setAdminFormData({...adminFormData, newChampionnatMatchs: parseInt(e.target.value)})}
                                min="1"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Date du match</label>
                    <input
                      type="date"
                      value={adminFormData.dateMatch}
                      onChange={(e) => setAdminFormData({...adminFormData, dateMatch: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <h4 className="text-md font-semibold text-slate-700 mb-4">1er match</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <select
                          value={adminFormData.joueur1}
                          onChange={(e) => setAdminFormData({...adminFormData, joueur1: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        >
                          <option value="">Sélectionner...</option>
                          {['Paul', 'Adrien', 'Tiago', 'Roman'].filter(j => j !== adminFormData.joueur2).map(j => (
                            <option key={j} value={j}>{j}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <select
                          value={adminFormData.joueur2}
                          onChange={(e) => setAdminFormData({...adminFormData, joueur2: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        >
                          <option value="">Sélectionner...</option>
                          {['Paul', 'Adrien', 'Tiago', 'Roman'].filter(j => j !== adminFormData.joueur1).map(j => (
                            <option key={j} value={j}>{j}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {adminFormData.joueur1 && adminFormData.joueur2 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Score</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <input
                            type="number"
                            value={adminFormData.buts_j1}
                            onChange={(e) => setAdminFormData({...adminFormData, buts_j1: e.target.value})}
                            min="0"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                            placeholder="0"
                          />
                          {!valiseUsed[adminFormData.joueur1] && (
                            <label className="flex items-center gap-2 mt-2">
                              <input
                                type="checkbox"
                                checked={adminFormData.valise_j1}
                                onChange={(e) => setAdminFormData({...adminFormData, valise_j1: e.target.checked})}
                                className="w-4 h-4"
                              />
                              <span className="text-xs text-slate-600">Valise 💼</span>
                            </label>
                          )}
                        </div>
                        <div>
                          <input
                            type="number"
                            value={adminFormData.buts_j2}
                            onChange={(e) => setAdminFormData({...adminFormData, buts_j2: e.target.value})}
                            min="0"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                            placeholder="0"
                          />
                          {!valiseUsed[adminFormData.joueur2] && (
                            <label className="flex items-center gap-2 mt-2">
                              <input
                                type="checkbox"
                                checked={adminFormData.valise_j2}
                                onChange={(e) => setAdminFormData({...adminFormData, valise_j2: e.target.checked})}
                                className="w-4 h-4"
                              />
                              <span className="text-xs text-slate-600">Valise 💼</span>
                            </label>
                          )}
                        </div>
                      </div>
                      {adminFormData.buts_j1 !== '' && adminFormData.buts_j2 !== '' && (
                        <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>Résultat :</strong> {
                              parseInt(adminFormData.buts_j1) > parseInt(adminFormData.buts_j2)
                                ? `Victoire ${adminFormData.joueur1} (3 pts)`
                                : parseInt(adminFormData.buts_j1) < parseInt(adminFormData.buts_j2)
                                ? `Victoire ${adminFormData.joueur2} (3 pts)`
                                : 'Match nul (1 pt chacun)'
                            }
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>{renderScorerSection('m1j1', adminFormData.joueur1, adminFormData.joueur2)}</div>
                        <div>{renderScorerSection('m1j2', adminFormData.joueur2, adminFormData.joueur1)}</div>
                      </div>
                    </div>
                  )}

                  {adminFormData.joueur1 && adminFormData.joueur2 && adminFormData.joueur3 && adminFormData.joueur4 && (
                    <div className="border-t pt-6">
                      <h4 className="text-md font-semibold text-slate-700 mb-4">2ème match</h4>

                      <div className="flex items-center gap-2 mb-4">
                        <select
                          value={adminFormData.joueur3}
                          onChange={(e) => setAdminFormData({...adminFormData, joueur3: e.target.value})}
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
                        >
                          {['Paul', 'Adrien', 'Tiago', 'Roman']
                            .filter(j => j !== adminFormData.joueur1 && j !== adminFormData.joueur2 && j !== adminFormData.joueur4)
                            .map(j => (
                              <option key={j} value={j}>{j}</option>
                            ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => setAdminFormData({
                            ...adminFormData,
                            joueur3: adminFormData.joueur4,
                            joueur4: adminFormData.joueur3,
                            buts_j3: adminFormData.buts_j4,
                            buts_j4: adminFormData.buts_j3,
                            valise_j3: adminFormData.valise_j4,
                            valise_j4: adminFormData.valise_j3
                          })}
                          className="p-2 hover:bg-slate-100 rounded transition-colors shrink-0"
                          title="Inverser les joueurs"
                        >
                          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </button>

                        <select
                          value={adminFormData.joueur4}
                          onChange={(e) => setAdminFormData({...adminFormData, joueur4: e.target.value})}
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
                        >
                          {['Paul', 'Adrien', 'Tiago', 'Roman']
                            .filter(j => j !== adminFormData.joueur1 && j !== adminFormData.joueur2 && j !== adminFormData.joueur3)
                            .map(j => (
                              <option key={j} value={j}>{j}</option>
                            ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <input
                            type="number"
                            value={adminFormData.buts_j3}
                            onChange={(e) => setAdminFormData({...adminFormData, buts_j3: e.target.value})}
                            min="0"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                            placeholder="0"
                          />
                          {!valiseUsed[adminFormData.joueur3] && (
                            <label className="flex items-center gap-2 mt-2">
                              <input
                                type="checkbox"
                                checked={adminFormData.valise_j3}
                                onChange={(e) => setAdminFormData({...adminFormData, valise_j3: e.target.checked})}
                                className="w-4 h-4"
                              />
                              <span className="text-xs text-slate-600">Valise 💼</span>
                            </label>
                          )}
                        </div>
                        <div>
                          <input
                            type="number"
                            value={adminFormData.buts_j4}
                            onChange={(e) => setAdminFormData({...adminFormData, buts_j4: e.target.value})}
                            min="0"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                            placeholder="0"
                          />
                          {!valiseUsed[adminFormData.joueur4] && (
                            <label className="flex items-center gap-2 mt-2">
                              <input
                                type="checkbox"
                                checked={adminFormData.valise_j4}
                                onChange={(e) => setAdminFormData({...adminFormData, valise_j4: e.target.checked})}
                                className="w-4 h-4"
                              />
                              <span className="text-xs text-slate-600">Valise 💼</span>
                            </label>
                          )}
                        </div>
                      </div>
                      {adminFormData.buts_j3 !== '' && adminFormData.buts_j4 !== '' && (
                        <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>Résultat :</strong> {
                              parseInt(adminFormData.buts_j3) > parseInt(adminFormData.buts_j4)
                                ? `Victoire ${adminFormData.joueur3} (3 pts)`
                                : parseInt(adminFormData.buts_j3) < parseInt(adminFormData.buts_j4)
                                ? `Victoire ${adminFormData.joueur4} (3 pts)`
                                : 'Match nul (1 pt chacun)'
                            }
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>{renderScorerSection('m2j1', adminFormData.joueur3, adminFormData.joueur4)}</div>
                        <div>{renderScorerSection('m2j2', adminFormData.joueur4, adminFormData.joueur3)}</div>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                    Enregistrer {adminFormData.joueur3 && adminFormData.joueur4 && adminFormData.buts_j3 !== '' && adminFormData.buts_j4 !== '' ? 'les 2 matchs' : 'le match'}
                  </button>
                </form>
              </div>
            ) : showEditMatchForm ? (
              <div className="bg-slate-50 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Éditer / Supprimer un match</h3>
                  <button
                    onClick={() => {
                      setShowEditMatchForm(false);
                      setEditingMatch(null);
                      setEditSelectedSaison('');
                      setEditSelectedLigue('');
                      setEditSelectedChampionnat('');
                    }}
                    className="text-slate-600 hover:text-slate-800"
                  >
                    Annuler
                  </button>
                </div>

                {!editingMatch ? (
                  <div className="space-y-4">
                    {!editSelectedSaison && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Sélectionnez une saison</label>
                        <div className="space-y-2">
                          {['2025/2026', '2024/2025'].map(saison => (
                            <button
                              key={saison}
                              onClick={() => setEditSelectedSaison(saison)}
                              className="w-full p-4 bg-white rounded-lg border hover:border-blue-500 text-left font-semibold"
                            >
                              {saison}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {editSelectedSaison && !editSelectedLigue && (
                      <div>
                        <button onClick={() => setEditSelectedSaison('')} className="mb-3 text-sm text-blue-600 hover:text-blue-800">
                          ← Retour aux saisons
                        </button>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Sélectionnez une compétition ({editSelectedSaison})
                        </label>
                        <div className="space-y-2">
                          {Array.from(new Set(
                            matchData.filter(m => m.saison === editSelectedSaison).map(m => m.ligue)
                          )).map(ligue => (
                            <button
                              key={ligue}
                              onClick={() => setEditSelectedLigue(ligue)}
                              className="w-full p-4 bg-white rounded-lg border hover:border-blue-500 text-left font-semibold"
                            >
                              {ligue}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {editSelectedSaison && editSelectedLigue && !editSelectedChampionnat && (
                      <div>
                        <button
                          onClick={() => { setEditSelectedLigue(''); setSelectedChampionnatsToDelete([]); }}
                          className="mb-3 text-sm text-blue-600 hover:text-blue-800"
                        >
                          ← Retour aux compétitions
                        </button>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Sélectionnez un championnat ({editSelectedLigue})
                          </label>
                          <div className="flex gap-2">
                            {(() => {
                              const championnats = Array.from(new Set(
                                matchData
                                  .filter(m => m.saison === editSelectedSaison && m.ligue === editSelectedLigue)
                                  .map(m => m.championnat)
                              ));
                              return (
                                <>
                                  {championnats.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (selectedChampionnatsToDelete.length === championnats.length) {
                                          setSelectedChampionnatsToDelete([]);
                                        } else {
                                          setSelectedChampionnatsToDelete(championnats);
                                        }
                                      }}
                                      className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                                    >
                                      {selectedChampionnatsToDelete.length === championnats.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                                    </button>
                                  )}
                                  {selectedChampionnatsToDelete.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (confirm(`Êtes-vous sûr de vouloir supprimer ${selectedChampionnatsToDelete.length} championnat(s) et tous leurs matchs ?`)) {
                                          try {
                                            const matchesToDelete = matchData.filter(m =>
                                              selectedChampionnatsToDelete.includes(m.championnat) &&
                                              m.saison === editSelectedSaison &&
                                              m.ligue === editSelectedLigue
                                            );
                                            await Promise.all(
                                              matchesToDelete.map(match => deleteDoc(doc(db, 'matches', match.firestoreId)))
                                            );
                                            alert(`${matchesToDelete.length} match(s) supprimé(s) avec succès !`);
                                            setSelectedChampionnatsToDelete([]);
                                          } catch (error) {
                                            console.error('Error deleting championships:', error);
                                            alert('Erreur lors de la suppression des championnats');
                                          }
                                        }
                                      }}
                                      className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                                    >
                                      Supprimer ({selectedChampionnatsToDelete.length})
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {Array.from(new Set(
                            matchData
                              .filter(m => m.saison === editSelectedSaison && m.ligue === editSelectedLigue)
                              .map(m => m.championnat)
                          )).sort((a, b) => {
                            const numA = a.match(/#(\d+)/)?.[1] || '0';
                            const numB = b.match(/#(\d+)/)?.[1] || '0';
                            return parseInt(numA) - parseInt(numB);
                          }).map(championnat => (
                            <div key={championnat} className="flex items-center gap-2 p-4 bg-white rounded-lg border">
                              <input
                                type="checkbox"
                                checked={selectedChampionnatsToDelete.includes(championnat)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedChampionnatsToDelete([...selectedChampionnatsToDelete, championnat]);
                                  } else {
                                    setSelectedChampionnatsToDelete(selectedChampionnatsToDelete.filter(c => c !== championnat));
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 text-red-600 cursor-pointer"
                              />
                              <button
                                onClick={() => setEditSelectedChampionnat(championnat)}
                                className="flex-1 text-left hover:bg-slate-50 rounded px-2 py-1 font-semibold"
                              >
                                {championnat}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {editSelectedSaison && editSelectedLigue && editSelectedChampionnat && (
                      <div>
                        <button
                          onClick={() => { setEditSelectedChampionnat(''); setSelectedMatchesToDelete([]); }}
                          className="mb-3 text-sm text-blue-600 hover:text-blue-800"
                        >
                          ← Retour aux championnats
                        </button>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Sélectionnez un match ({editSelectedChampionnat})
                          </label>
                          <div className="flex gap-2">
                            {(() => {
                              const currentMatches = matchData.filter(m =>
                                m.saison === editSelectedSaison &&
                                m.ligue === editSelectedLigue &&
                                m.championnat === editSelectedChampionnat
                              );
                              return (
                                <>
                                  {currentMatches.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentMatchIds = currentMatches.map(m => m.firestoreId);
                                        if (selectedMatchesToDelete.length === currentMatchIds.length) {
                                          setSelectedMatchesToDelete([]);
                                        } else {
                                          setSelectedMatchesToDelete(currentMatchIds);
                                        }
                                      }}
                                      className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                                    >
                                      {selectedMatchesToDelete.length === currentMatches.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                                    </button>
                                  )}
                                  {selectedMatchesToDelete.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (confirm(`Êtes-vous sûr de vouloir supprimer ${selectedMatchesToDelete.length} match(s) ?`)) {
                                          try {
                                            await Promise.all(
                                              selectedMatchesToDelete.map(id => deleteDoc(doc(db, 'matches', id)))
                                            );
                                            alert(`${selectedMatchesToDelete.length} match(s) supprimé(s) avec succès !`);
                                            setSelectedMatchesToDelete([]);
                                          } catch (error) {
                                            console.error('Error deleting matches:', error);
                                            alert('Erreur lors de la suppression des matchs');
                                          }
                                        }
                                      }}
                                      className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                                    >
                                      Supprimer ({selectedMatchesToDelete.length})
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {matchData
                            .map((match, index) => ({ match, index }))
                            .filter(({ match }) =>
                              match.saison === editSelectedSaison &&
                              match.ligue === editSelectedLigue &&
                              match.championnat === editSelectedChampionnat
                            )
                            .map(({ match, index }) => (
                              <div key={index} className="flex items-center gap-2 p-4 bg-white rounded-lg border">
                                <input
                                  type="checkbox"
                                  checked={selectedMatchesToDelete.includes(match.firestoreId)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMatchesToDelete([...selectedMatchesToDelete, match.firestoreId]);
                                    } else {
                                      setSelectedMatchesToDelete(selectedMatchesToDelete.filter(id => id !== match.firestoreId));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 text-red-600 cursor-pointer"
                                />
                                <button
                                  onClick={() => setEditingMatch({...match, index})}
                                  className="flex-1 text-left hover:bg-slate-50 rounded px-2 py-1"
                                >
                                  <p className="font-semibold text-slate-800">
                                    {match.joueur1} {match.buts_j1} - {match.buts_j2} {match.joueur2}
                                    {match.joueur3 && ` • ${match.joueur3} ${match.buts_j3} - ${match.buts_j4} ${match.joueur4}`}
                                  </p>
                                  <p className="text-sm text-slate-600">
                                    {match.dateMatch || 'Date non définie'}
                                    {match.valise_j1 && ' 🧳 ' + match.joueur1}
                                    {match.valise_j2 && ' 🧳 ' + match.joueur2}
                                  </p>
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleEditMatch} className="space-y-4">
                    <p className="text-sm text-slate-600">
                      <strong>Match :</strong> {editingMatch.saison} • {editingMatch.ligue} • {editingMatch.championnat}
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Date du match</label>
                      <input
                        type="date"
                        value={editingMatch.dateMatch || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setEditingMatch({...editingMatch, dateMatch: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Joueur 1</label>
                        <select
                          value={editingMatch.joueur1}
                          onChange={(e) => setEditingMatch({...editingMatch, joueur1: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        >
                          {joueurs.filter(j => j !== editingMatch.joueur2).map(j => (
                            <option key={j} value={j}>{j}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Joueur 2</label>
                        <select
                          value={editingMatch.joueur2}
                          onChange={(e) => setEditingMatch({...editingMatch, joueur2: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        >
                          {joueurs.filter(j => j !== editingMatch.joueur1).map(j => (
                            <option key={j} value={j}>{j}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-700 mb-1">Buts {editingMatch.joueur1}</label>
                        <input
                          type="number"
                          value={editingMatch.buts_j1}
                          onChange={(e) => setEditingMatch({...editingMatch, buts_j1: e.target.value})}
                          min="0"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-700 mb-1">Buts {editingMatch.joueur2}</label>
                        <input
                          type="number"
                          value={editingMatch.buts_j2}
                          onChange={(e) => setEditingMatch({...editingMatch, buts_j2: e.target.value})}
                          min="0"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editingMatch.valise_j1 || false}
                          onChange={(e) => setEditingMatch({...editingMatch, valise_j1: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">🧳 Valise {editingMatch.joueur1}</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editingMatch.valise_j2 || false}
                          onChange={(e) => setEditingMatch({...editingMatch, valise_j2: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">🧳 Valise {editingMatch.joueur2}</span>
                      </label>
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
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
                        }}
                        className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                      >
                        Supprimer
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMatch(null)}
                        className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-medium"
                      >
                        Retour
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}
          </div>

          <div className="bg-blue-50 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 mb-2">☁️ Synchronisation Cloud</h3>
            <p className="text-blue-800 text-sm">
              Toutes les données sont sauvegardées dans Firebase et synchronisées automatiquement entre tous vos appareils en temps réel.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminTab;
