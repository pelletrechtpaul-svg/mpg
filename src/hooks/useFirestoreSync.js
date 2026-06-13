import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import { encodeFirestoreKey, decodeFirestoreKey } from '../shared.jsx';

export const useFirestoreSync = () => {
  const [matchData, setMatchData] = useState([]);
  const [mercatoData, setMercatoData] = useState([]);
  const [ligueMetadata, setLigueMetadata] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdminAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const migrateAndSync = async () => {
      try {
        const savedMatches = localStorage.getItem('mpg_match_data');
        const savedMetadata = localStorage.getItem('mpg_ligue_metadata');

        if (savedMatches) {
          const localMatches = JSON.parse(savedMatches);
          if (localMatches.length > 0) {
            const batch = writeBatch(db);
            localMatches.forEach(match => {
              const matchRef = doc(collection(db, 'matches'));
              batch.set(matchRef, { ...match, id: matchRef.id });
            });
            await batch.commit();
            localStorage.removeItem('mpg_match_data');
          }
        }

        if (savedMetadata) {
          const localMetadata = JSON.parse(savedMetadata);
          if (Object.keys(localMetadata).length > 0) {
            const batch = writeBatch(db);
            Object.entries(localMetadata).forEach(([key, value]) => {
              const metaRef = doc(db, 'metadata', encodeFirestoreKey(key));
              batch.set(metaRef, value);
            });
            await batch.commit();
            localStorage.removeItem('mpg_ligue_metadata');
          }
        }

        const unsubscribeMatches = onSnapshot(collection(db, 'matches'), (snapshot) => {
          setMatchData(snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
          setIsLoading(false);
          setLastSyncTime(new Date());
        });

        const unsubscribeMetadata = onSnapshot(collection(db, 'metadata'), (snapshot) => {
          const metadata = {};
          snapshot.docs.forEach(d => {
            metadata[decodeFirestoreKey(d.id)] = d.data();
          });
          setLigueMetadata(metadata);
          setLastSyncTime(new Date());
        });

        const unsubscribeMercato = onSnapshot(collection(db, 'mercato'), (snapshot) => {
          setMercatoData(snapshot.docs.map(d => {
            const data = d.data();
            return { ...data, firestoreId: d.id, acheteur: data.acheteur ? data.acheteur.charAt(0).toUpperCase() + data.acheteur.slice(1) : data.acheteur };
          }));
        });

        return () => { unsubscribeMatches(); unsubscribeMetadata(); unsubscribeMercato(); };
      } catch (error) {
        console.error('Error syncing with Firestore:', error);
        setSyncError('Impossible de se connecter à la base de données. Les données affichées peuvent être obsolètes.');
        setIsLoading(false);
      }
    };

    migrateAndSync();
  }, []);

  return { matchData, mercatoData, ligueMetadata, isLoading, isOnline, lastSyncTime, syncError, setSyncError, isAdminAuthenticated };
};
