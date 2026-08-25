import { useState, useEffect } from 'react';
import { Lock, Plus, Edit, Settings, RefreshCw, KeyRound } from 'lucide-react';
import { auth } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import { db } from '../firebase';
import { doc, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { encodeFirestoreKey } from '../shared.jsx';
import AdminAddMatchForm from './AdminAddMatchForm';
import AdminEditPanel from './AdminEditPanel';
import AdminSaisieTest from './AdminSaisieTest';

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

const AdminTab = ({ matchData, mercatoData, joueurs, ligueMetadata, ligues, isAdminAuthenticated, initialEditMatch, onConsumeInitialEditMatch, onBackToClassements }) => {
  const [loginError, setLoginError] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [view, setView] = useState('menu');
  const [saisons, setSaisons] = useState([]);
  const [toast, setToast] = useState(null);
  const [saisonConfirm, setSaisonConfirm] = useState(null); // { action: 'add'|'remove', target?: string }
  const [saisonPassword, setSaisonPassword] = useState('');
  const [saisonAuthError, setSaisonAuthError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // 'full' = tous les droits, 'matches' = édition de matchs uniquement
  // (pas de gestion des saisons). Par défaut 'matches' tant que le rôle
  // n'est pas confirmé, pour ne jamais exposer une action sensible par erreur.
  const [adminRole, setAdminRole] = useState('matches');
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { setAdminRole('matches'); return; }
      getDoc(doc(db, 'config', 'adminRoles')).then(snap => {
        const roles = snap.exists() ? snap.data() : {};
        setAdminRole(roles[user.email?.toLowerCase()] === 'full' ? 'full' : 'matches');
      }).catch(() => setAdminRole('matches'));
    });
    return unsub;
  }, []);
  const isFullAdmin = adminRole === 'full';

  // Arrivée directe depuis "éditer ce match" dans Classements > Matchs :
  // saute le menu et la sélection saison/ligue/championnat/match.
  useEffect(() => {
    if (initialEditMatch) setView('edit');
  }, [initialEditMatch]);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const resetPasswordForm = () => {
    setCurrentPassword(''); setNewPassword(''); setNewPasswordConfirm(''); setPasswordError('');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 6) { setPasswordError('Le nouveau mot de passe doit faire au moins 6 caractères.'); return; }
    if (newPassword !== newPasswordConfirm) { setPasswordError('Les deux mots de passe ne correspondent pas.'); return; }

    setChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
    } catch {
      setPasswordError('Mot de passe actuel incorrect.');
      setChangingPassword(false);
      return;
    }

    try {
      await updatePassword(auth.currentUser, newPassword);
      showToast('Mot de passe changé avec succès');
      resetPasswordForm();
      setView('menu');
    } catch {
      setPasswordError('Erreur lors du changement de mot de passe.');
    } finally {
      setChangingPassword(false);
    }
  };

  useEffect(() => {
    getDoc(doc(db, 'config', 'saisons')).then(snap => {
      setSaisons(snap.exists() ? (snap.data().list || []) : ['2025/2026', '2024/2025']);
    }).catch(() => setSaisons(['2025/2026', '2024/2025']));
  }, []);

  const saveSaisons = async (list) => {
    await setDoc(doc(db, 'config', 'saisons'), { list });
    setSaisons(list);
  };

  function nextSaison(current) {
    const match = current?.match(/(\d{4})\/(\d{4})/);
    if (!match) return '';
    return `${parseInt(match[1]) + 1}/${parseInt(match[2]) + 1}`;
  }

  const openSaisonConfirm = (action, target) => {
    setSaisonConfirm({ action, target });
    setSaisonPassword('');
    setSaisonAuthError('');
  };

  const handleSaisonConfirm = async () => {
    setSaisonAuthError('');
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, saisonPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
    } catch {
      setSaisonAuthError('Mot de passe incorrect.');
      return;
    }

    try {
      if (saisonConfirm.action === 'add') {
        const next = nextSaison(saisons[0]);
        await saveSaisons([next, ...saisons]);
        showToast(`Saison ${next} ajoutée`);
      } else if (saisonConfirm.action === 'remove') {
        await saveSaisons(saisons.filter(x => x !== saisonConfirm.target));
        showToast(`Saison ${saisonConfirm.target} supprimée`);
      }
      setSaisonConfirm(null);
      setSaisonPassword('');
    } catch {
      showToast('Erreur lors de la modification', 'error');
    }
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
                {isFullAdmin && (
                  <button onClick={() => setView('saisons')} className="px-5 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 inline-flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Gérer les saisons
                  </button>
                )}
                {matchData.length > 0 && (
                  <button onClick={handleRecalculateMetadata} className="px-5 py-2.5 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Recalculer métadonnées
                  </button>
                )}
                <button onClick={() => { resetPasswordForm(); setView('password'); }} className="px-5 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 inline-flex items-center gap-2">
                  <KeyRound className="w-4 h-4" /> Changer mon mot de passe
                </button>
                <button onClick={() => setView('test-saisie')} className="px-5 py-2.5 bg-fuchsia-600 text-white rounded-lg font-medium hover:bg-fuchsia-700 inline-flex items-center gap-2">
                  🧪 Test saisie (bêta)
                </button>
              </div>
            )}

            {view === 'password' && (
              <div>
                <button onClick={() => setView('menu')} className="mb-4 text-sm text-blue-600 hover:text-blue-800">← Retour</button>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Changer mon mot de passe</h3>
                <form onSubmit={handleChangePassword} className="max-w-sm space-y-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Mot de passe actuel</label>
                    <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                      autoComplete="current-password" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" autoFocus />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Nouveau mot de passe</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      autoComplete="new-password" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Au moins 6 caractères" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Confirmer le nouveau mot de passe</label>
                    <input type="password" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)}
                      autoComplete="new-password" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  {passwordError && <p className="text-red-500 text-xs">{passwordError}</p>}
                  <button type="submit" disabled={changingPassword}
                    className="w-full px-5 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50">
                    {changingPassword ? 'Changement...' : 'Changer le mot de passe'}
                  </button>
                </form>
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

            {view === 'test-saisie' && (
              <div>
                <button onClick={() => setView('menu')} className="mb-4 text-sm text-blue-600 hover:text-blue-800">← Retour</button>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">🧪 Test saisie (bêta)</h3>
                <AdminSaisieTest mercatoData={mercatoData} joueurs={joueurs} />
              </div>
            )}

            {view === 'edit' && (
              <AdminEditPanel
                matchData={matchData}
                joueurs={joueurs}
                saisons={saisons}
                mercatoData={mercatoData}
                showToast={showToast}
                onClose={() => setView('menu')}
                initialMatch={initialEditMatch}
                onConsumeInitialMatch={onConsumeInitialEditMatch}
                onBackToClassements={onBackToClassements}
              />
            )}

            {view === 'saisons' && isFullAdmin && (
              <div>
                <button onClick={() => setView('menu')} className="mb-4 text-sm text-blue-600 hover:text-blue-800">← Retour</button>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Gérer les saisons</h3>

                {saisonConfirm ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                    <p className="text-sm text-slate-700">
                      {saisonConfirm.action === 'add'
                        ? `Confirmer l'ajout de la saison ${nextSaison(saisons[0])} ?`
                        : `Confirmer la suppression de la saison ${saisonConfirm.target} ?`}
                    </p>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Mot de passe admin</label>
                      <input
                        type="password"
                        value={saisonPassword}
                        onChange={e => setSaisonPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaisonConfirm()}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        autoFocus
                      />
                      {saisonAuthError && <p className="text-red-500 text-xs mt-1">{saisonAuthError}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaisonConfirm}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white ${saisonConfirm.action === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        Confirmer
                      </button>
                      <button onClick={() => setSaisonConfirm(null)}
                        className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 mb-4">
                      {saisons.map(s => (
                        <div key={s} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <span className="font-medium text-sm">{s}</span>
                          <button onClick={() => openSaisonConfirm('remove', s)} className="text-sm text-red-500 hover:text-red-700">Supprimer</button>
                        </div>
                      ))}
                    </div>
                    {saisons.length > 0 && (
                      <button onClick={() => openSaisonConfirm('add')}
                        className="w-full px-4 py-3 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-sm font-medium hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        + Nouvelle saison ({nextSaison(saisons[0])})
                      </button>
                    )}
                  </>
                )}
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
