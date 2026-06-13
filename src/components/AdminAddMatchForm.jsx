import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import { doc, collection, writeBatch } from 'firebase/firestore';
import { encodeFirestoreKey } from '../shared.jsx';

const EMPTY_FORM = {
  saison: '2025/2026', ligue: '', championnat: '', isNewChampionnat: false,
  newChampionnatMatchs: 6, joueur1: '', joueur2: '', buts_j1: '', buts_j2: '',
  valise_j1: false, valise_j2: false, joueur3: '', joueur4: '', buts_j3: '', buts_j4: '',
  valise_j3: false, valise_j4: false, dateMatch: new Date().toISOString().split('T')[0]
};

const JOUEURS = ['Paul', 'Adrien', 'Tiago', 'Roman'];

const ScorerSection = ({ matchKey, ownerName, opponentName, formData, buteurs, setButeurs, scorerSearch, setScorerSearch, mercatoData }) => {
  if (!ownerName) return null;
  const saison = formData.saison;
  const ligue = formData.ligue;
  const dedup = arr => arr.filter((p, i, self) => i === self.findIndex(q => q.joueur === p.joueur));
  const ownPlayers = dedup(mercatoData.filter(p => p.acheteur === ownerName && p.saison === saison && p.ligue === ligue));
  const oppPlayers = dedup(mercatoData.filter(p => p.acheteur === opponentName && p.saison === saison && p.ligue === ligue));
  const allPlayers = [...ownPlayers, ...oppPlayers];
  const search = scorerSearch[matchKey] || '';
  const filtered = allPlayers.filter(p => p.joueur.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const current = buteurs[matchKey] || [];

  const addScorer = (joueur) => {
    setButeurs(prev => ({ ...prev, [matchKey]: [...(prev[matchKey] || []), { joueur, buts: 1 }] }));
    setScorerSearch(prev => ({ ...prev, [matchKey]: '' }));
  };
  const removeScorer = (i) => setButeurs(prev => ({ ...prev, [matchKey]: prev[matchKey].filter((_, idx) => idx !== i) }));
  const updateButs = (i, buts) => setButeurs(prev => ({ ...prev, [matchKey]: prev[matchKey].map((s, idx) => idx === i ? { ...s, buts } : s) }));

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-slate-600 mb-1">Buteurs ({ownerName})</p>
      {current.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {current.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
              {s.joueur}
              <input type="number" value={s.buts} min="1" max="10" onChange={(e) => updateButs(i, parseInt(e.target.value) || 1)} className="w-8 text-center bg-transparent border-none outline-none text-xs" />
              <button type="button" onClick={() => removeScorer(i)} className="text-blue-500 hover:text-red-600">×</button>
            </span>
          ))}
        </div>
      )}
      {allPlayers.length > 0 && (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setScorerSearch(prev => ({ ...prev, [matchKey]: e.target.value }))}
            placeholder="Rechercher un buteur..."
            className="w-full text-xs px-2 py-1 border border-slate-200 rounded"
          />
          {search && filtered.length > 0 && (
            <div className="absolute z-10 w-full bg-white border border-slate-200 rounded shadow-lg mt-0.5 max-h-32 overflow-y-auto">
              {filtered.map((p, i) => (
                <button key={i} type="button" onClick={() => addScorer(p.joueur)}
                  className="w-full text-left px-2 py-1 text-xs hover:bg-blue-50">
                  {p.joueur} <span className="text-slate-400">({p.acheteur === ownerName ? ownerName : opponentName})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AdminAddMatchForm = ({ matchData, ligues, mercatoData, ligueMetadata, onCancel }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [buteurs, setButeurs] = useState({ m1j1: [], m1j2: [], m2j1: [], m2j2: [] });
  const [scorerSearch, setScorerSearch] = useState({ m1j1: '', m1j2: '', m2j1: '', m2j2: '' });

  const adminChampionnatsByLigue = useMemo(() => {
    const data = formData.saison === 'All-Time' ? matchData : matchData.filter(d => d.saison === formData.saison);
    const map = {};
    ligues.forEach(ligue => { map[ligue] = [...new Set(data.filter(d => d.ligue === ligue).map(d => d.championnat))].sort(); });
    return map;
  }, [matchData, ligues, formData.saison]);

  const valiseUsed = useMemo(() => {
    if (!formData.ligue || !formData.championnat) return {};
    const used = {};
    matchData.filter(m => m.saison === formData.saison && m.ligue === formData.ligue && m.championnat === formData.championnat).forEach(m => {
      if (m.valise_j1) used[m.joueur1] = true;
      if (m.valise_j2) used[m.joueur2] = true;
    });
    return used;
  }, [matchData, formData.saison, formData.ligue, formData.championnat]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { saison, ligue, championnat, isNewChampionnat, newChampionnatMatchs, joueur1, joueur2, buts_j1, buts_j2, valise_j1, valise_j2, joueur3, joueur4, buts_j3, buts_j4, valise_j3, valise_j4, dateMatch } = formData;
    if (!ligue || !joueur1 || !joueur2) { alert('Veuillez remplir tous les champs du premier match'); return; }
    if (joueur1 === joueur2) { alert('Les deux joueurs doivent être différents'); return; }
    if (buts_j1 === '' || buts_j2 === '') { alert('Veuillez entrer les buts des deux joueurs du premier match'); return; }
    if (!dateMatch) { alert('Veuillez renseigner la date du match'); return; }
    const b1 = parseInt(buts_j1), b2 = parseInt(buts_j2);
    if (b1 < 0 || b2 < 0) { alert('Les buts ne peuvent pas être négatifs'); return; }
    if (b1 > 30 || b2 > 30) { alert('Score inhabituellement élevé (> 30). Vérifiez la saisie.'); return; }
    const isDuplicate = matchData.some(m => m.dateMatch === dateMatch && m.championnat === championnat && ((m.joueur1 === joueur1 && m.joueur2 === joueur2) || (m.joueur1 === joueur2 && m.joueur2 === joueur1)));
    if (isDuplicate && !window.confirm('Un match entre ces deux joueurs dans ce championnat à cette date existe déjà. Continuer quand même ?')) return;

    const hasSecondMatch = joueur3 && joueur4 && buts_j3 !== '' && buts_j4 !== '';
    if (hasSecondMatch) {
      if (joueur3 === joueur4) { alert('Match 2 : les deux joueurs doivent être différents'); return; }
      if (new Set([joueur1, joueur2, joueur3, joueur4]).size < 4) { alert('Match 2 : les joueurs doivent être différents de ceux du match 1'); return; }
      const b3 = parseInt(buts_j3), b4 = parseInt(buts_j4);
      if (b3 < 0 || b4 < 0) { alert('Match 2 : les buts ne peuvent pas être négatifs'); return; }
      if (b3 > 30 || b4 > 30) { alert('Match 2 : score inhabituellement élevé (> 30). Vérifiez la saisie.'); return; }
    }

    let championnatToUse = championnat;
    if (isNewChampionnat) {
      const existingCount = matchData.filter(d => d.saison === saison && d.ligue === ligue).reduce((acc, d) => { if (!acc.includes(d.championnat)) acc.push(d.championnat); return acc; }, []).length;
      championnatToUse = `#${existingCount + 1}`;
    }
    if (!championnatToUse) { alert('Veuillez sélectionner ou créer un championnat'); return; }

    const newMatches = [];
    const currentDate = new Date().toISOString();
    const butsJ1 = parseInt(buts_j1) || 0, butsJ2 = parseInt(buts_j2) || 0;
    let points_j1, points_j2, resultat;
    if (butsJ1 > butsJ2) { points_j1 = 3; points_j2 = 0; resultat = 'victoire_j1'; }
    else if (butsJ1 < butsJ2) { points_j1 = 0; points_j2 = 3; resultat = 'victoire_j2'; }
    else { points_j1 = 1; points_j2 = 1; resultat = 'nul'; }
    newMatches.push({ saison, ligue, championnat: championnatToUse, joueur1, joueur2, buts_j1: butsJ1, buts_j2: butsJ2, valise_j1, valise_j2, resultat, points_j1, points_j2, dateMatch, dateEntree: currentDate, buteurs_j1: buteurs.m1j1, buteurs_j2: buteurs.m1j2 });

    if (hasSecondMatch) {
      const butsJ3 = parseInt(buts_j3) || 0, butsJ4 = parseInt(buts_j4) || 0;
      let p3, p4, r2;
      if (butsJ3 > butsJ4) { p3 = 3; p4 = 0; r2 = 'victoire_j1'; }
      else if (butsJ3 < butsJ4) { p3 = 0; p4 = 3; r2 = 'victoire_j2'; }
      else { p3 = 1; p4 = 1; r2 = 'nul'; }
      newMatches.push({ saison, ligue, championnat: championnatToUse, joueur1: joueur3, joueur2: joueur4, buts_j1: butsJ3, buts_j2: butsJ4, valise_j1: valise_j3, valise_j2: valise_j4, resultat: r2, points_j1: p3, points_j2: p4, dateMatch, dateEntree: currentDate, buteurs_j1: buteurs.m2j1, buteurs_j2: buteurs.m2j2 });
    }

    try {
      const batch = writeBatch(db);
      newMatches.forEach(match => {
        const matchRef = doc(collection(db, 'matches'));
        batch.set(matchRef, { ...match, id: matchRef.id });
      });

      if (isNewChampionnat) {
        const ligueKey = `${saison}-${ligue}-${championnatToUse}`;
        const metaRef = doc(db, 'metadata', encodeFirestoreKey(ligueKey));
        batch.set(metaRef, { createdAt: currentDate, matchsTotal: newChampionnatMatchs, matchsEntered: newMatches.length, ligue, saison, championnat: championnatToUse });
      } else {
        const ligueKey = `${saison}-${ligue}-${championnatToUse}`;
        const existingMeta = ligueMetadata[ligueKey];
        if (existingMeta) {
          const metaRef = doc(db, 'metadata', encodeFirestoreKey(ligueKey));
          batch.set(metaRef, { ...existingMeta, matchsEntered: (existingMeta.matchsEntered || 0) + newMatches.length });
        }
      }

      await batch.commit();
      alert(`${newMatches.length} match(s) enregistré(s) avec succès !`);
      setFormData({ ...EMPTY_FORM, dateMatch: new Date().toISOString().split('T')[0] });
      setButeurs({ m1j1: [], m1j2: [], m2j1: [], m2j2: [] });
      setScorerSearch({ m1j1: '', m1j2: '', m2j1: '', m2j2: [] });
    } catch (error) {
      console.error('Error adding match:', error);
      alert('Erreur lors de la sauvegarde du match');
    }
  };

  const scorerProps = { formData, buteurs, setButeurs, scorerSearch, setScorerSearch, mercatoData };

  return (
    <div className="bg-slate-50 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-800">Nouveau match</h3>
        <button onClick={onCancel} className="text-slate-600 hover:text-slate-800">Annuler</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Saison</label>
          <select value={formData.saison} onChange={(e) => setFormData({ ...formData, saison: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
            <option value="2025/2026">2025/2026</option>
            <option value="2024/2025">2024/2025</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Ligue</label>
          <div className="flex flex-wrap gap-3">
            {['Ligue 1', 'Premier League', 'Liga', 'Serie A', 'Ligue des Champions'].map(ligue => (
              <label key={ligue} className="inline-flex items-center">
                <input type="radio" name="ligue" value={ligue} checked={formData.ligue === ligue}
                  onChange={(e) => setFormData({ ...formData, ligue: e.target.value, championnat: '', isNewChampionnat: false })}
                  className="w-4 h-4 text-blue-600" />
                <span className="ml-2 text-sm">{ligue}</span>
              </label>
            ))}
          </div>
        </div>

        {formData.ligue && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Championnat</label>
            <div className="space-y-2">
              {adminChampionnatsByLigue[formData.ligue]?.map(ch => (
                <label key={ch} className="flex items-center">
                  <input type="radio" name="championnat" value={ch} checked={!formData.isNewChampionnat && formData.championnat === ch}
                    onChange={(e) => setFormData({ ...formData, championnat: e.target.value, isNewChampionnat: false })}
                    className="w-4 h-4 text-blue-600" />
                  <span className="ml-2 text-sm">{ch}</span>
                </label>
              ))}
              <label className="flex items-center">
                <input type="radio" name="championnat" checked={formData.isNewChampionnat}
                  onChange={() => setFormData({ ...formData, isNewChampionnat: true, championnat: '' })}
                  className="w-4 h-4 text-blue-600" />
                <span className="ml-2 text-sm font-medium text-blue-600">Nouveau championnat</span>
              </label>
              {formData.isNewChampionnat && (
                <div className="ml-6 space-y-3">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Nom :</strong> #{matchData.filter(d => d.saison === formData.saison && d.ligue === formData.ligue).reduce((acc, d) => { if (!acc.includes(d.championnat)) acc.push(d.championnat); return acc; }, []).length + 1}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1">Nombre de matchs</label>
                    <input type="number" value={formData.newChampionnatMatchs} onChange={(e) => setFormData({ ...formData, newChampionnatMatchs: parseInt(e.target.value) })} min="1" className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Date du match</label>
          <input type="date" value={formData.dateMatch} onChange={(e) => setFormData({ ...formData, dateMatch: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
        </div>

        <div>
          <h4 className="text-md font-semibold text-slate-700 mb-4">1er match</h4>
          <div className="grid grid-cols-2 gap-4">
            <select value={formData.joueur1} onChange={(e) => setFormData({ ...formData, joueur1: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
              <option value="">Sélectionner...</option>
              {JOUEURS.filter(j => j !== formData.joueur2).map(j => <option key={j} value={j}>{j}</option>)}
            </select>
            <select value={formData.joueur2} onChange={(e) => setFormData({ ...formData, joueur2: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
              <option value="">Sélectionner...</option>
              {JOUEURS.filter(j => j !== formData.joueur1).map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
        </div>

        {formData.joueur1 && formData.joueur2 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Score</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input type="number" value={formData.buts_j1} onChange={(e) => setFormData({ ...formData, buts_j1: e.target.value })} min="0" className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="0" />
                {!valiseUsed[formData.joueur1] && (
                  <label className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={formData.valise_j1} onChange={(e) => setFormData({ ...formData, valise_j1: e.target.checked })} className="w-4 h-4" />
                    <span className="text-xs text-slate-600">Valise 💼</span>
                  </label>
                )}
              </div>
              <div>
                <input type="number" value={formData.buts_j2} onChange={(e) => setFormData({ ...formData, buts_j2: e.target.value })} min="0" className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="0" />
                {!valiseUsed[formData.joueur2] && (
                  <label className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={formData.valise_j2} onChange={(e) => setFormData({ ...formData, valise_j2: e.target.checked })} className="w-4 h-4" />
                    <span className="text-xs text-slate-600">Valise 💼</span>
                  </label>
                )}
              </div>
            </div>
            {formData.buts_j1 !== '' && formData.buts_j2 !== '' && (
              <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Résultat :</strong> {parseInt(formData.buts_j1) > parseInt(formData.buts_j2) ? `Victoire ${formData.joueur1} (3 pts)` : parseInt(formData.buts_j1) < parseInt(formData.buts_j2) ? `Victoire ${formData.joueur2} (3 pts)` : 'Match nul (1 pt chacun)'}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <ScorerSection matchKey="m1j1" ownerName={formData.joueur1} opponentName={formData.joueur2} {...scorerProps} />
              <ScorerSection matchKey="m1j2" ownerName={formData.joueur2} opponentName={formData.joueur1} {...scorerProps} />
            </div>
          </div>
        )}

        {formData.joueur1 && formData.joueur2 && formData.joueur3 && formData.joueur4 && (
          <div className="border-t pt-6">
            <h4 className="text-md font-semibold text-slate-700 mb-4">2ème match</h4>
            <div className="flex items-center gap-2 mb-4">
              <select value={formData.joueur3} onChange={(e) => setFormData({ ...formData, joueur3: e.target.value })} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg">
                {JOUEURS.filter(j => j !== formData.joueur1 && j !== formData.joueur2 && j !== formData.joueur4).map(j => <option key={j} value={j}>{j}</option>)}
              </select>
              <button type="button" onClick={() => setFormData({ ...formData, joueur3: formData.joueur4, joueur4: formData.joueur3, buts_j3: formData.buts_j4, buts_j4: formData.buts_j3, valise_j3: formData.valise_j4, valise_j4: formData.valise_j3 })} className="p-2 hover:bg-slate-100 rounded transition-colors shrink-0" title="Inverser les joueurs">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
              </button>
              <select value={formData.joueur4} onChange={(e) => setFormData({ ...formData, joueur4: e.target.value })} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg">
                {JOUEURS.filter(j => j !== formData.joueur1 && j !== formData.joueur2 && j !== formData.joueur3).map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input type="number" value={formData.buts_j3} onChange={(e) => setFormData({ ...formData, buts_j3: e.target.value })} min="0" className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="0" />
                {!valiseUsed[formData.joueur3] && (
                  <label className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={formData.valise_j3} onChange={(e) => setFormData({ ...formData, valise_j3: e.target.checked })} className="w-4 h-4" />
                    <span className="text-xs text-slate-600">Valise 💼</span>
                  </label>
                )}
              </div>
              <div>
                <input type="number" value={formData.buts_j4} onChange={(e) => setFormData({ ...formData, buts_j4: e.target.value })} min="0" className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="0" />
                {!valiseUsed[formData.joueur4] && (
                  <label className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={formData.valise_j4} onChange={(e) => setFormData({ ...formData, valise_j4: e.target.checked })} className="w-4 h-4" />
                    <span className="text-xs text-slate-600">Valise 💼</span>
                  </label>
                )}
              </div>
            </div>
            {formData.buts_j3 !== '' && formData.buts_j4 !== '' && (
              <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Résultat :</strong> {parseInt(formData.buts_j3) > parseInt(formData.buts_j4) ? `Victoire ${formData.joueur3} (3 pts)` : parseInt(formData.buts_j3) < parseInt(formData.buts_j4) ? `Victoire ${formData.joueur4} (3 pts)` : 'Match nul (1 pt chacun)'}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <ScorerSection matchKey="m2j1" ownerName={formData.joueur3} opponentName={formData.joueur4} {...scorerProps} />
              <ScorerSection matchKey="m2j2" ownerName={formData.joueur4} opponentName={formData.joueur3} {...scorerProps} />
            </div>
          </div>
        )}

        <button type="submit" className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
          Enregistrer {formData.joueur3 && formData.joueur4 && formData.buts_j3 !== '' && formData.buts_j4 !== '' ? 'les 2 matchs' : 'le match'}
        </button>
      </form>
    </div>
  );
};

export default AdminAddMatchForm;
