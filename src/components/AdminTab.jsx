import React, { useState } from 'react';
import { Lock, Plus, Edit } from 'lucide-react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { encodeFirestoreKey } from '../shared.jsx';
import AdminAddMatchForm from './AdminAddMatchForm';
import AdminEditPanel from './AdminEditPanel';

const AdminTab = ({ matchData, mercatoData, joueurs, ligueMetadata, ligues, isAdminAuthenticated }) => {
  const [loginError, setLoginError] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAddMatchForm, setShowAddMatchForm] = useState(false);
  const [showEditMatchForm, setShowEditMatchForm] = useState(false);

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
        const actualMatchDays = new Set(matches.map(m => m.dateMatch)).size;
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

  return (
    <>
      {!isAdminAuthenticated ? (
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md mx-auto">
          <div className="text-center mb-6">
            <Lock className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Accès Admin</h2>
          </div>
          <form onSubmit={handleAdminLogin}>
            <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="Email" autoComplete="username" className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4" autoFocus />
            <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Mot de passe" autoComplete="current-password" className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4" />
            {loginError && <p className="text-red-600 text-sm mb-3">{loginError}</p>}
            <button type="submit" className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">Se connecter</button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Panel Admin</h2>
              <button onClick={handleAdminLogout} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg">Déconnexion</button>
            </div>

            {!showAddMatchForm && !showEditMatchForm ? (
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setShowAddMatchForm(true)} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 inline-flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Ajouter un match
                </button>
                {matchData.length > 0 && (
                  <>
                    <button onClick={() => setShowEditMatchForm(true)} className="px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 inline-flex items-center gap-2">
                      <Edit className="w-5 h-5" />
                      Éditer un match
                    </button>
                    <button onClick={handleRecalculateMetadata} className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 inline-flex items-center gap-2" title="Recalculer les métadonnées des championnats">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Recalculer métadonnées
                    </button>
                  </>
                )}
              </div>
            ) : showAddMatchForm ? (
              <AdminAddMatchForm
                matchData={matchData}
                ligues={ligues}
                mercatoData={mercatoData}
                ligueMetadata={ligueMetadata}
                onCancel={() => setShowAddMatchForm(false)}
              />
            ) : showEditMatchForm ? (
              <AdminEditPanel
                matchData={matchData}
                joueurs={joueurs}
                onClose={() => setShowEditMatchForm(false)}
              />
            ) : null}
          </div>

          <div className="bg-blue-50 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 mb-2">☁️ Synchronisation Cloud</h3>
            <p className="text-blue-800 text-sm">Toutes les données sont sauvegardées dans Firebase et synchronisées automatiquement entre tous vos appareils en temps réel.</p>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminTab;
