import { useState, useEffect } from 'react';
import { Lock, Plus, Edit, Settings, RefreshCw } from 'lucide-react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from '../firebase';
import { doc, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { encodeFirestoreKey } from '../shared.jsx';
import AdminAddMatchForm from './AdminAddMatchForm';
import AdminEditPanel from './AdminEditPanel';

function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-medium flex items-center gap-2 ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
      {type === 'error' ? '❌' : '✅'} {message}
    </div>
  );
}

const AdminTab = ({ matchData, mercatoData, joueurs, ligueMetadata, ligues, isAdminAuthenticated }) => {
  const [loginError, setLoginError] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [view, setView] = useState('menu');
  const [saisons, setSaisons] = useState([]);
  const [toast, setToast] = useState(null);
  const [newSaison, setNewSaison] = useState('');

  const showToast = (message, type = 'success') => setToast({ message, type });

  useEffect(() => {
    getDoc(doc(db, 'config', 'saisons')).then(snap => {
      setSaisons(snap.exists() ? (snap.data().list || []) : ['2025/2026', '2024/2025']);
    }).catch(() => setSaisons(['2025/2026', '2024/2025']));
  }, []);

  const saveSaisons = async (list) => {
    await setDoc(doc(db, 'config', 'saisons'), { list });
    setSaisons(list);
  };

  const handleAddSaison = async () => {
    const s = newSaison.trim();
    if (!s || saisons.includes(s)) return;
    await saveSaisons([s, ...saisons]);
    setNewSaison('');
    showToast(`Saison ${s} ajoutée`);
  };

  const handleRemoveSaison = async (s) => {
    await saveSaisons(saisons.filter(x => x !== s));
    showToast(`Saison ${s} supprimée`);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
      setAdminEmail('');
      setAdminPassword('');
    } catch {
      setLoginError('Identifiants incorrects ou compte admin introuvable.');
      setAdminPassword('');
    }
  };

  const handleAdminLogout = async () => {
    try { await signOut(auth); } catch {}
    setView('menu');
  };

  const handleRecalculateMetadata = async () => {
    try {
      const groups = {};
      matchData.forEach(m => {
        const key = `${m.saison}-${m.ligue}-${m.championnat}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(m);
      });
      const batch = writeBatch(db);
      let count = 0;
      Object.entries(groups).forEach(([key, matches]) => {
        const days = new Set(matches.map(m => m.dateMatch)).size;
        const meta = ligueMetadata[key];
        if (meta) {
          if (meta.matchsEntered !== days) {
            batch.set(doc(db, 'metadata', encodeFirestoreKey(key)), { ...meta, matchsEntered: days, lastRecalculated: new Date().toISOString() });
            count++;
          }
        } else {
          batch.set(doc(db, 'metadata', encodeFirestoreKey(key)), { createdAt: new Date().toISOString(), matchsTotal: days, matchsEntered: days, lastRecalculated: new Date().toISOString() });
          count++;
        }
      });
      await batch.commit();
      showToast(`${count} championnat(s) recalculé(s)`);
    } catch {
      showToast('Erreur lors du recalcul', 'error');
    }
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {!isAdminAuthenticated ? (
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md mx-auto">
          <div className="text-center mb-6">
            <Lock className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Accès Admin</h2>
          </div>
          <form onSubmit={handleAdminLogin}>
            <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="Email" autoComplete="username" className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4" autoFocus />
            <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Mot de passe" autoComplete="current-password" className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4" />
            {loginError && <p className="text-red-600 text-sm mb-3">{loginError}</p>}
            <button type="submit" className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">Se connecter</button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Panel Admin</h2>
              <button onClick={handleAdminLogout} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Déconnexion</button>
            </div>

            {view === 'menu' && (
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setView('add')} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Ajouter une journée
                </button>
                {matchData.length > 0 && (
                  <button onClick={() => setView('edit')} className="px-5 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 inline-flex items-center gap-2">
                    <Edit className="w-4 h-4" /> Éditer un match
                  </button>
                )}
                <button onClick={() => setView('saisons')} className="px-5 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 inline-flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Gérer les saisons
                </button>
                {matchData.length > 0 && (
                  <button onClick={handleRecalculateMetadata} className="px-5 py-2.5 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Recalculer métadonnées
                  </button>
                )}
              </div>
            )}

            {view === 'add' && (
              <AdminAddMatchForm
                matchData={matchData}
                ligues={ligues}
                saisons={saisons}
                mercatoData={mercatoData}
                ligueMetadata={ligueMetadata}
                showToast={showToast}
                onCancel={() => setView('menu')}
              />
            )}

            {view === 'edit' && (
              <AdminEditPanel
                matchData={matchData}
                joueurs={joueurs}
                saisons={saisons}
                mercatoData={mercatoData}
                showToast={showToast}
                onClose={() => setView('menu')}
              />
            )}

            {view === 'saisons' && (
              <div>
                <button onClick={() => setView('menu')} className="mb-4 text-sm text-blue-600 hover:text-blue-800">← Retour</button>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Gérer les saisons</h3>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newSaison}
                    onChange={e => setNewSaison(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSaison()}
                    placeholder="ex: 2026/2027"
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <button onClick={handleAddSaison} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Ajouter</button>
                </div>
                <div className="space-y-2">
                  {saisons.map(s => (
                    <div key={s} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium text-sm">{s}</span>
                      <button onClick={() => handleRemoveSaison(s)} className="text-sm text-red-500 hover:text-red-700">Supprimer</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 rounded-xl p-5">
            <h3 className="font-semibold text-blue-900 mb-1 text-sm">☁️ Synchronisation Cloud</h3>
            <p className="text-blue-800 text-sm">Données sauvegardées dans Firebase, synchronisées en temps réel sur tous les appareils.</p>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminTab;
