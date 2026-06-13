import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie, Cell, Brush } from 'recharts';
import { Lock, SkipBack, SkipForward, Play, Pause } from 'lucide-react';
import { db, auth } from './firebase';
import { collection, doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  JOUEURS_MERCATO, LIGUE_NAT_EXCLUE, getPosteGroupe, medianFn, POSTE_LABEL,
  playerImages, playerColors, playerColorHex, PLAYLIST, MANUAL_CHAMPIONSHIPS,
  encodeFirestoreKey, decodeFirestoreKey, groupMatchesByChampionship,
  calculateLongestStreak, shareCard, ShareBtn,
} from './shared.jsx';
import MercatoTab from './components/MercatoTab';
import AdvancedStatsTab from './components/AdvancedStatsTab';
import VersusTab from './components/VersusTab';
import RecordsTab from './components/RecordsTab';
import ClassementsTab from './components/ClassementsTab';
import AdminTab from './components/AdminTab';

const App = () => {
  // State - now synced with Firestore
  const [matchData, setMatchData] = useState([]);
  const [mercatoData, setMercatoData] = useState([]);
  const [ligueMetadata, setLigueMetadata] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);

  const [selectedSeason, setSelectedSeason] = useState('2025/2026');
  const [activeTab, setActiveTab] = useState('classements');

  const [ligueRecordsMode, setLigueRecordsMode] = useState('alltime'); // 'saison' | 'alltime'
  const [selectedLigue, setSelectedLigue] = useState('general');
  const [selectedChampionnat, setSelectedChampionnat] = useState('total');
  const [selectedStatsLigue, setSelectedStatsLigue] = useState('all');

  // Face à face states
  const [selectedVersusPlayer1, setSelectedVersusPlayer1] = useState('Paul');
  const [selectedVersusPlayer2, setSelectedVersusPlayer2] = useState('Adrien');
  const [selectedVersusLigue, setSelectedVersusLigue] = useState('all');

  // Valise table toggle
  const [selectedValiseTable, setSelectedValiseTable] = useState('stats'); // 'stats' or 'efficaces'

  const [activeVersusTooltip, setActiveVersusTooltip] = useState(null); // index

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const audioRef = React.useRef(null);
  if (!audioRef.current) {
    audioRef.current = new Audio(PLAYLIST[0].src);
  }

  // Admin states
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  // Dark mode state — fallback to OS preference on first visit
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('mpg_dark_mode');
    if (saved !== null) return JSON.parse(saved);
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('mpg_dark_mode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Change track: update src, resume playback if already playing
  useEffect(() => {
    const audio = audioRef.current;
    audio.src = PLAYLIST[currentTrack].src;
    audio.load();
    if (isPlaying) audio.play();
  }, [currentTrack]);

  // Auto-advance to next track (with infinite loop) when a song ends
  useEffect(() => {
    const audio = audioRef.current;
    const handleEnded = () => {
      setCurrentTrack(t => (t + 1) % PLAYLIST.length);
    };
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, []);

  const playPause = () => {
    const audio = audioRef.current;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play(); setIsPlaying(true); }
  };

  const prevTrack = () => {
    setCurrentTrack(t => (t - 1 + PLAYLIST.length) % PLAYLIST.length);
  };

  const nextTrack = () => {
    setCurrentTrack(t => (t + 1) % PLAYLIST.length);
  };

  // Monitor online/offline status
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

  // Migrate localStorage to Firestore and setup real-time sync
  useEffect(() => {
    const migrateAndSync = async () => {
      try {
        // Check if localStorage has data
        const savedMatches = localStorage.getItem('mpg_match_data');
        const savedMetadata = localStorage.getItem('mpg_ligue_metadata');

        // Migrate to Firestore if localStorage has data
        if (savedMatches) {
          const localMatches = JSON.parse(savedMatches);
          if (localMatches.length > 0) {
            const batch = writeBatch(db);
            localMatches.forEach((match, index) => {
              const matchRef = doc(collection(db, 'matches'));
              batch.set(matchRef, { ...match, id: matchRef.id });
            });
            await batch.commit();
            localStorage.removeItem('mpg_match_data'); // Clean up
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
            localStorage.removeItem('mpg_ligue_metadata'); // Clean up
          }
        }

        // Setup real-time listeners
        const unsubscribeMatches = onSnapshot(collection(db, 'matches'), (snapshot) => {
          const matches = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
          setMatchData(matches);
          setIsLoading(false);
          setLastSyncTime(new Date());
        });

        const unsubscribeMetadata = onSnapshot(collection(db, 'metadata'), (snapshot) => {
          const metadata = {};
          snapshot.docs.forEach(doc => {
            // Decode the Firestore key back to original format
            const originalKey = decodeFirestoreKey(doc.id);
            metadata[originalKey] = doc.data();
          });
          setLigueMetadata(metadata);
          setLastSyncTime(new Date());
        });

        const unsubscribeMercato = onSnapshot(collection(db, 'mercato'), (snapshot) => {
          const entries = snapshot.docs.map(doc => {
            const d = doc.data();
            return { ...d, firestoreId: doc.id, acheteur: d.acheteur ? d.acheteur.charAt(0).toUpperCase() + d.acheteur.slice(1) : d.acheteur };
          });
          setMercatoData(entries);
        });

        // Cleanup listeners on unmount
        return () => {
          unsubscribeMatches();
          unsubscribeMetadata();
          unsubscribeMercato();
        };
      } catch (error) {
        console.error('Error syncing with Firestore:', error);
        setSyncError('Impossible de se connecter à la base de données. Les données affichées peuvent être obsolètes.');
        setIsLoading(false);
      }
    };

    migrateAndSync();
  }, []);

  // Filter data by season
  const filteredData = useMemo(() => {
    if (selectedSeason === 'All-Time') return matchData;
    return matchData.filter(d => d.saison === selectedSeason);
  }, [matchData, selectedSeason]);

  const joueurs = useMemo(() => {
    const uniquePlayers = new Set();
    filteredData.forEach(match => {
      uniquePlayers.add(match.joueur1);
      uniquePlayers.add(match.joueur2);
    });
    return Array.from(uniquePlayers).length > 0 ? Array.from(uniquePlayers) : ['Paul', 'Adrien', 'Tiago', 'Roman'];
  }, [filteredData]);

  const ligues = useMemo(() => {
    const uniqueLigues = new Set(matchData.map(d => d.ligue));
    MANUAL_CHAMPIONSHIPS.forEach(mc => uniqueLigues.add(mc.ligue));
    const result = [...uniqueLigues];
    return result.length > 0 ? result : ['Ligue 1', 'Premier League', 'Liga', 'Serie A', 'Ligue des Champions'];
  }, [matchData]);

  const championnatsByLigue = useMemo(() => {
    const map = {};
    const filteredSeasons = new Set(filteredData.map(m => m.saison));
    ligues.forEach(ligue => {
      const championnats = new Set(
        filteredData.filter(d => d.ligue === ligue).map(d => d.championnat)
      );
      // Inject manual championships for this ligue when the season matches
      MANUAL_CHAMPIONSHIPS.forEach(mc => {
        if (mc.ligue === ligue && (selectedSeason === 'All-Time' || filteredSeasons.has(mc.saison))) {
          championnats.add(mc.championnat);
        }
      });
      map[ligue] = [...championnats].sort();
    });
    return map;
  }, [filteredData, ligues, selectedSeason]);

  const mercatoStats = useMemo(() => {
    if (mercatoData.length === 0) return null;

    // Per-player stats
    const perPlayer = {};
    JOUEURS_MERCATO.forEach(j => {
      const entries = mercatoData.filter(e => e.acheteur === j);
      if (entries.length === 0) { perPlayer[j] = null; return; }

      const mediane = medianFn(entries.map(e => e.prix));

      // Ligue où il se lâche = ligue avec le plus d'enchères > 50m
      const liguesMap = {};
      entries.forEach(e => {
        if (!liguesMap[e.ligue]) liguesMap[e.ligue] = 0;
        if (e.prix > 50) liguesMap[e.ligue]++;
      });
      let ligueFolie = null, ligueFolieCount = 0;
      Object.entries(liguesMap).forEach(([ligue, count]) => {
        if (count > ligueFolieCount) { ligueFolieCount = count; ligueFolie = ligue; }
      });

      // Preferred nationality
      const natsMap = {};
      entries.forEach(e => {
        if (e.nationalite) natsMap[e.nationalite] = (natsMap[e.nationalite] || 0) + 1;
      });
      let natPref = null, natMax = 0;
      Object.entries(natsMap).forEach(([nat, count]) => {
        if (count > natMax) { natMax = count; natPref = nat; }
      });
      const natDistinctes = Object.keys(natsMap).length;

      // Preferred position (A/M/D, no G) — determined by most players recruited
      const postesMap = { A: [], M: [], D: [] };
      entries.forEach(e => {
        const g = getPosteGroupe(e.poste);
        if (g && g !== 'G') postesMap[g].push(e.prix);
      });
      const postePref = Object.entries(postesMap).sort((a, b) => b[1].length - a[1].length)[0]?.[0] || null;
      const postePrefCount = postePref ? postesMap[postePref].length : null;

      perPlayer[j] = { mediane, ligueFolie, ligueFolieCount, natPref, natMax, natDistinctes, postePref, postePrefCount, count: entries.length };
    });

    // Poste le plus valorisé — nb d'enchères > 15m (hors G)
    const SEUIL_POSTE = 30;
    const posteValeur = { A: 0, M: 0, D: 0 };
    mercatoData.forEach(e => {
      const g = getPosteGroupe(e.poste);
      if (g && g !== 'G' && e.prix >= SEUIL_POSTE) posteValeur[g]++;
    });

    // Podium plus cher
    const podiumCher = [...mercatoData].sort((a, b) => b.prix - a.prix).slice(0, 3);

    // Podium plus disputé (sum of all bids)
    const podiumDispute = [...mercatoData]
      .map(e => ({
        ...e,
        totalMise: e.prix + (e.encheres_perdues || []).reduce((s, ep) => s + ep.prix, 0),
        nbEncheres: 1 + (e.encheres_perdues || []).length,
      }))
      .sort((a, b) => b.totalMise - a.totalMise)
      .slice(0, 3);

    // Ligue avec enchère médiane la plus élevée
    const ligueMedianes = {};
    mercatoData.forEach(e => {
      if (!ligueMedianes[e.ligue]) ligueMedianes[e.ligue] = [];
      ligueMedianes[e.ligue].push(e.prix);
    });
    const ligueRanking = Object.entries(ligueMedianes)
      .map(([ligue, prices]) => ({ ligue, mediane: medianFn(prices), count: prices.length }))
      .sort((a, b) => b.mediane - a.mediane);

    // Roi du tour X: average recruits per championship at that tour
    const roiTour = (tourNum) => {
      const champMap = {};
      mercatoData.forEach(e => {
        if (e.tour !== tourNum) return;
        const key = `${e.saison}_${e.ligue}_${e.championnat}`;
        if (!champMap[key]) { champMap[key] = {}; JOUEURS_MERCATO.forEach(j => { champMap[key][j] = 0; }); }
        champMap[key][e.acheteur] = (champMap[key][e.acheteur] || 0) + 1;
      });
      const keys = Object.keys(champMap);
      if (keys.length === 0) return null;
      const totals = {};
      JOUEURS_MERCATO.forEach(j => { totals[j] = 0; });
      keys.forEach(k => JOUEURS_MERCATO.forEach(j => { totals[j] += champMap[k][j] || 0; }));
      const averages = {};
      JOUEURS_MERCATO.forEach(j => { averages[j] = +(totals[j] / keys.length).toFixed(2); });
      const [winner, val] = Object.entries(averages).sort((a, b) => b[1] - a[1])[0];
      return { winner, val, averages };
    };

    // Recrutement moyen par championnat (tous tours confondus)
    const recrutementMoyen = (() => {
      const champMap = {};
      mercatoData.forEach(e => {
        const key = `${e.saison}_${e.ligue}_${e.championnat}`;
        if (!champMap[key]) { champMap[key] = {}; JOUEURS_MERCATO.forEach(j => { champMap[key][j] = 0; }); }
        if (e.acheteur) champMap[key][e.acheteur] = (champMap[key][e.acheteur] || 0) + 1;
      });
      const keys = Object.keys(champMap);
      if (keys.length === 0) return null;
      const totals = {};
      JOUEURS_MERCATO.forEach(j => { totals[j] = 0; });
      keys.forEach(k => JOUEURS_MERCATO.forEach(j => { totals[j] += champMap[k][j] || 0; }));
      const averages = {};
      JOUEURS_MERCATO.forEach(j => { averages[j] = +(totals[j] / keys.length).toFixed(1); });
      const [winner, val] = Object.entries(averages).sort((a, b) => b[1] - a[1])[0];
      return { winner, val, averages };
    })();

    // Roi des enchères (wins where ≥1 others bid)
    const enchereWins = {};
    JOUEURS_MERCATO.forEach(j => { enchereWins[j] = 0; });
    mercatoData.forEach(e => {
      if ((e.encheres_perdues || []).length >= 1 && e.acheteur) {
        enchereWins[e.acheteur] = (enchereWins[e.acheteur] || 0) + 1;
      }
    });
    const [roiEncheresWinner, roiEncheresVal] = Object.entries(enchereWins).sort((a, b) => b[1] - a[1])[0];

    // Roi des postes (share of total spending on each position)
    // Denominator uses only entries with a valid poste group so A+M+D+G = 100%
    const roiPoste = (posteGroupe) => {
      const shares = {};
      JOUEURS_MERCATO.forEach(j => {
        const entries = mercatoData.filter(e => e.acheteur === j && getPosteGroupe(e.poste) !== null);
        const total = entries.reduce((s, e) => s + e.prix, 0);
        const onPoste = entries.filter(e => getPosteGroupe(e.poste) === posteGroupe).reduce((s, e) => s + e.prix, 0);
        shares[j] = total > 0 ? +(onPoste / total * 100).toFixed(1) : 0;
      });
      const [winner, val] = Object.entries(shares).sort((a, b) => b[1] - a[1])[0];
      return { winner, val, shares };
    };

    // Medianes par joueur pour la carte globale
    const medianeParJoueur = {};
    JOUEURS_MERCATO.forEach(j => {
      medianeParJoueur[j] = medianFn(mercatoData.filter(e => e.acheteur === j).map(e => e.prix));
    });

    return {
      perPlayer,
      posteValeur,
      podiumCher,
      podiumDispute,
      ligueRanking,
      roiTour1: roiTour(1),
      recrutementMoyen,

      // Roi des bonnes affaires: wins à 1m
      roiBonnesAffaires: (() => {
        const counts = {};
        JOUEURS_MERCATO.forEach(j => { counts[j] = 0; });
        mercatoData.forEach(e => { if (e.prix === 1 && e.acheteur) counts[e.acheteur]++; });
        const [winner] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return { winner, counts };
      })(),

      // Chasseur solitaire: achats sans aucun concurrent
      chasseurSolitaire: (() => {
        const counts = {};
        JOUEURS_MERCATO.forEach(j => { counts[j] = 0; });
        mercatoData.forEach(e => { if ((e.encheres_perdues || []).length === 0 && e.acheteur) counts[e.acheteur]++; });
        const [winner] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return { winner, counts };
      })(),

      // Podium enchères perdues les plus chères
      podiumEncheresPerduees: (() => {
        const perdues = [];
        mercatoData.forEach(e => {
          (e.encheres_perdues || []).forEach(ep => {
            // find which player bid ep.prix on this entry (by matching equipe)
            // We store equipe_acheteur on the winner; ep.equipe is the loser's team
            perdues.push({ joueur: e.joueur, prenom: e.prenom, club: e.club, ligue: e.ligue, championnat: e.championnat, prixPerdu: ep.prix, equipePerdue: ep.equipe, acheteur: e.acheteur, prixGagnant: e.prix });
          });
        });
        return perdues.sort((a, b) => b.prixPerdu - a.prixPerdu).slice(0, 3);
      })(),

      // Nationalité la plus disputée (le plus d'enchères concurrentes par nationalité)
      natPlusDisputee: (() => {
        const nats = {};
        mercatoData.forEach(e => {
          if (!e.nationalite || (e.encheres_perdues || []).length === 0) return;
          nats[e.nationalite] = (nats[e.nationalite] || 0) + 1;
        });
        return Object.entries(nats).sort((a, b) => b[1] - a[1]).slice(0, 3);
      })(),

      // Surenchérisseur — spread moyen entre prix gagné et 2e mise (enchères disputées)
      surencherisseur: (() => {
        const spreads = {};
        const counts = {};
        JOUEURS_MERCATO.forEach(j => { spreads[j] = 0; counts[j] = 0; });
        mercatoData.forEach(e => {
          if (!e.acheteur || !(e.encheres_perdues || []).length) return;
          const maxLost = Math.max(...e.encheres_perdues.map(ep => ep.prix));
          const spread = e.prix - maxLost;
          if (spread >= 0) {
            spreads[e.acheteur] += spread;
            counts[e.acheteur]++;
          }
        });
        const avgSpreads = {};
        JOUEURS_MERCATO.forEach(j => {
          avgSpreads[j] = counts[j] > 0 ? +(spreads[j] / counts[j]).toFixed(1) : 0;
        });
        return { avgSpreads, counts };
      })(),

      // Rivalités — paires de joueurs qui s'affrontent le plus souvent
      rivalites: (() => {
        // Build equipe → acheteur mapping per championship
        const equipeMap = {};
        mercatoData.forEach(e => {
          if (e.equipe_acheteur && e.acheteur) {
            const key = `${e.saison}_${e.ligue}_${e.championnat}`;
            if (!equipeMap[key]) equipeMap[key] = {};
            equipeMap[key][e.equipe_acheteur] = e.acheteur;
          }
        });
        // Count clashes per pair
        const pairCounts = {};
        mercatoData.forEach(e => {
          if (!e.acheteur || !(e.encheres_perdues || []).length) return;
          const champMap = equipeMap[`${e.saison}_${e.ligue}_${e.championnat}`] || {};
          e.encheres_perdues.forEach(ep => {
            const loser = champMap[ep.equipe];
            if (!loser || loser === e.acheteur) return;
            const pair = [e.acheteur, loser].sort().join(' vs ');
            pairCounts[pair] = (pairCounts[pair] || 0) + 1;
          });
        });
        return Object.entries(pairCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
      })(),

      // Enchères par tour (moyenne de prix par tour, tous joueurs confondus)
      encheresParTour: (() => {
        const tourData = {};
        mercatoData.forEach(e => {
          if (!tourData[e.tour]) tourData[e.tour] = [];
          tourData[e.tour].push(e.prix);
        });
        return [1,2,3,4].map(t => ({
          tour: `Tour ${t}`,
          mediane: medianFn(tourData[t] || []),
          count: (tourData[t] || []).length,
        }));
      })(),
      roiEncheres: { winner: roiEncheresWinner, val: roiEncheresVal, wins: enchereWins },
      roiAttaquants: roiPoste('A'),
      roiMilieux: roiPoste('M'),
      roiDefenseurs: roiPoste('D'),
      roiGardiens: roiPoste('G'),
      medianeParJoueur,
    };
  }, [mercatoData]);

  // Calculate player stats from matches
  const calculatePlayerStats = (matches, joueursList) => {
    const stats = {};

    joueursList.forEach(joueur => {
      stats[joueur] = {
        points: 0,
        matchs: 0,
        victoires: 0,
        nuls: 0,
        defaites: 0,
        buts_pour: 0,
        buts_contre: 0,
        ga: 0
      };
    });

    matches.forEach(match => {
      const { joueur1, joueur2, buts_j1, buts_j2, points_j1, points_j2 } = match;

      if (stats[joueur1]) {
        stats[joueur1].points += points_j1;
        stats[joueur1].matchs += 1;
        stats[joueur1].buts_pour += buts_j1;
        stats[joueur1].buts_contre += buts_j2;

        if (buts_j1 > buts_j2) stats[joueur1].victoires += 1;
        else if (buts_j1 === buts_j2) stats[joueur1].nuls += 1;
        else stats[joueur1].defaites += 1;
      }

      if (stats[joueur2]) {
        stats[joueur2].points += points_j2;
        stats[joueur2].matchs += 1;
        stats[joueur2].buts_pour += buts_j2;
        stats[joueur2].buts_contre += buts_j1;

        if (buts_j2 > buts_j1) stats[joueur2].victoires += 1;
        else if (buts_j1 === buts_j2) stats[joueur2].nuls += 1;
        else stats[joueur2].defaites += 1;
      }
    });

    // Calculate goal average
    Object.keys(stats).forEach(joueur => {
      stats[joueur].ga = stats[joueur].buts_pour - stats[joueur].buts_contre;
    });

    return stats;
  };

  // Calculate championship victories (titres) and medals in a single pass
  const { victoiresChampionnat, medaillesChampionnat, victoiresDetail, medaillesDetail, perduUnPoint } = useMemo(() => {
    const victoires = {};
    const medailles = {};
    const victoiresLigues = {}; // joueur -> [ligue, ...]
    const medaillesLigues = {}; // joueur -> [ligue, ...]
    const perduUnPt = {}; // joueur -> [{ ligue, championnat, saison, points, winnerPoints, winner }]
    joueurs.forEach(j => {
      victoires[j] = 0; medailles[j] = 0;
      victoiresLigues[j] = []; medaillesLigues[j] = [];
      perduUnPt[j] = [];
    });

    const championnatsMap = groupMatchesByChampionship(filteredData);

    Object.entries(championnatsMap).forEach(([key, matches]) => {
      const metadata = ligueMetadata[key];
      if (!metadata || metadata.matchsEntered < metadata.matchsTotal) return;

      const stats = calculatePlayerStats(matches, joueurs);
      const ranking = Object.entries(stats)
        .map(([joueur, data]) => ({ joueur, ...data }))
        .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);

      if (ranking.length > 0 && ranking[0].points > 0) {
        const winner = ranking[0];
        const entry = { ligue: matches[0].ligue, saison: matches[0].saison };
        if (metadata.matchsTotal >= 6) {
          victoires[winner.joueur]++;
          victoiresLigues[winner.joueur].push(entry);
        } else {
          medailles[winner.joueur]++;
          medaillesLigues[winner.joueur].push(entry);
        }
        // Championnats perdus de justesse : 1 point, goal average, ou différence particulière
        if (metadata.matchsTotal >= 6) {
          ranking.slice(1).forEach(p => {
            let raison = null;
            if (winner.points - p.points === 1) raison = '1 pt';
            else if (winner.points === p.points && winner.ga > p.ga) raison = 'goal avg';
            else if (winner.points === p.points && winner.ga === p.ga) raison = 'diff. part.';
            if (raison) {
              perduUnPt[p.joueur].push({
                ligue: matches[0].ligue,
                championnat: matches[0].championnat,
                saison: matches[0].saison,
                points: p.points,
                winnerPoints: winner.points,
                winnerGa: winner.ga,
                ga: p.ga,
                winner: winner.joueur,
                raison,
              });
            }
          });
        }
      }
    });

    // Inject manual championships (no match data available)
    const filteredSeasons = new Set(filteredData.map(m => m.saison));
    MANUAL_CHAMPIONSHIPS.forEach(mc => {
      if (!filteredSeasons.has(mc.saison) && selectedSeason !== 'All-Time') return;
      const sorted = [...mc.standings].sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
      if (sorted.length === 0) return;
      const winnerJoueur = sorted[0].joueur;
      if (victoires[winnerJoueur] === undefined) return;
      const entry = { ligue: mc.ligue, saison: mc.saison };
      if (mc.matchsTotal >= 6) {
        victoires[winnerJoueur]++;
        victoiresLigues[winnerJoueur].push(entry);
        sorted.slice(1).forEach(p => {
          if (!perduUnPt[p.joueur]) return;
          let raison = null;
          if (sorted[0].points - p.points === 1) raison = '1 pt';
          else if (sorted[0].points === p.points && sorted[0].ga > p.ga) raison = 'goal avg';
          else if (sorted[0].points === p.points && sorted[0].ga === p.ga) raison = 'diff. part.';
          if (raison) perduUnPt[p.joueur].push({ ligue: mc.ligue, championnat: mc.championnat, saison: mc.saison, points: p.points, winnerPoints: sorted[0].points, winnerGa: sorted[0].ga, ga: p.ga, winner: winnerJoueur, raison });
        });
      } else {
        medailles[winnerJoueur]++;
        medaillesLigues[winnerJoueur].push(entry);
      }
    });

    return {
      victoiresChampionnat: victoires,
      medaillesChampionnat: medailles,
      victoiresDetail: victoiresLigues,
      medaillesDetail: medaillesLigues,
      perduUnPoint: perduUnPt,
    };
  }, [filteredData, joueurs, ligueMetadata, selectedSeason]);

  // Classement général
  const classementGeneral = useMemo(() => {
    const stats = calculatePlayerStats(filteredData, joueurs);

    // Inject match points from manual championships (no match data available)
    const filteredSeasons = new Set(filteredData.map(m => m.saison));
    MANUAL_CHAMPIONSHIPS.forEach(mc => {
      if (!filteredSeasons.has(mc.saison) && selectedSeason !== 'All-Time') return;
      mc.standings.forEach(s => {
        if (!stats[s.joueur]) return;
        stats[s.joueur].points   += s.points;
        stats[s.joueur].matchs   += s.matchs;
        stats[s.joueur].victoires += s.victoires;
        stats[s.joueur].nuls     += s.nuls;
        stats[s.joueur].defaites += s.defaites;
        stats[s.joueur].ga       += s.ga;
        stats[s.joueur].buts_pour   = (stats[s.joueur].buts_pour || 0);
        stats[s.joueur].buts_contre = (stats[s.joueur].buts_contre || 0);
      });
    });

    // Save points from matches before adding title/medal bonuses
    Object.keys(stats).forEach(joueur => {
      stats[joueur].pointsMatch = stats[joueur].points; // Points from match results only
      stats[joueur].points += victoiresChampionnat[joueur] * 3;
      stats[joueur].points += medaillesChampionnat[joueur] * 2;
      stats[joueur].victoiresChampionnat = victoiresChampionnat[joueur];
      stats[joueur].medaillesChampionnat = medaillesChampionnat[joueur];
      stats[joueur].victoiresLigues = victoiresDetail[joueur] || [];
      stats[joueur].medaillesLigues = medaillesDetail[joueur] || [];
    });

    return Object.entries(stats)
      .map(([joueur, data]) => ({ joueur, ...data }))
      .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
  }, [filteredData, joueurs, victoiresChampionnat, medaillesChampionnat, victoiresDetail, medaillesDetail, selectedSeason]);

  // Classement par ligue
  const classementParLigue = useMemo(() => {
    if (selectedLigue === 'general') return classementGeneral;

    let matchesToUse = filteredData.filter(m => m.ligue === selectedLigue);

    if (selectedChampionnat !== 'total') {
      matchesToUse = matchesToUse.filter(m => m.championnat === selectedChampionnat);
    }

    const stats = calculatePlayerStats(matchesToUse, joueurs);

    // Inject manual championships matching the current ligue/championnat/season
    const filteredSeasons = new Set(filteredData.map(m => m.saison));
    const relevantManual = MANUAL_CHAMPIONSHIPS.filter(mc =>
      mc.ligue === selectedLigue &&
      (selectedSeason === 'All-Time' || filteredSeasons.has(mc.saison)) &&
      (selectedChampionnat === 'total' || mc.championnat === selectedChampionnat)
    );
    relevantManual.forEach(mc => {
      mc.standings.forEach(s => {
        if (!stats[s.joueur]) return;
        stats[s.joueur].points    += s.points;
        stats[s.joueur].matchs    += s.matchs;
        stats[s.joueur].victoires += s.victoires;
        stats[s.joueur].nuls      += s.nuls;
        stats[s.joueur].defaites  += s.defaites;
        stats[s.joueur].ga        += s.ga;
      });
    });

    if (selectedChampionnat === 'total') {
      // Group by saison+championnat to avoid merging same-named championships across seasons
      const championnatsMap = {};
      matchesToUse.forEach(match => {
        const key = `${match.saison}||${match.championnat}`;
        if (!championnatsMap[key]) championnatsMap[key] = [];
        championnatsMap[key].push(match);
      });

      const ligueVictoires = {};
      const ligueMedailles = {};
      const ligueVictoiresLigues = {};
      const ligueMedaillesLigues = {};
      joueurs.forEach(j => {
        ligueVictoires[j] = 0; ligueMedailles[j] = 0;
        ligueVictoiresLigues[j] = []; ligueMedaillesLigues[j] = [];
      });

      Object.entries(championnatsMap).forEach(([key, matches]) => {
        // Use the match's own saison for the metadata key (handles All-Time correctly)
        const matchSaison = matches[0].saison;
        const matchChamp = matches[0].championnat;
        const metadataKey = `${matchSaison}-${selectedLigue}-${matchChamp}`;
        const metadata = ligueMetadata[metadataKey];
        if (!metadata || metadata.matchsEntered < metadata.matchsTotal) {
          return; // Skip incomplete championships
        }

        const champStats = calculatePlayerStats(matches, joueurs);
        const ranking = Object.entries(champStats)
          .map(([joueur, data]) => ({ joueur, ...data }))
          .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);

        if (ranking.length > 0 && ranking[0].points > 0) {
          const winner = ranking[0].joueur;
          const entry = { ligue: selectedLigue, saison: matches[0].saison };
          if (metadata.matchsTotal >= 6) {
            ligueVictoires[winner]++;
            ligueVictoiresLigues[winner].push(entry);
          } else {
            ligueMedailles[winner]++;
            ligueMedaillesLigues[winner].push(entry);
          }
        }
      });

      // Add titles from manual championships
      relevantManual.forEach(mc => {
        const sorted = [...mc.standings].sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
        if (sorted.length === 0 || ligueVictoires[sorted[0].joueur] === undefined) return;
        const winner = sorted[0].joueur;
        const entry = { ligue: mc.ligue, saison: mc.saison };
        if (mc.matchsTotal >= 6) {
          ligueVictoires[winner]++;
          ligueVictoiresLigues[winner].push(entry);
        } else {
          ligueMedailles[winner]++;
          ligueMedaillesLigues[winner].push(entry);
        }
      });

      const isAllTime = selectedSeason === 'All-Time';
      Object.keys(stats).forEach(joueur => {
        stats[joueur].pointsMatch = stats[joueur].points;
        // En All-Time : afficher les titres/médailles mais ne pas ajouter les points bonus
        if (!isAllTime) {
          stats[joueur].points += ligueVictoires[joueur] * 3;
          stats[joueur].points += ligueMedailles[joueur] * 2;
        }
        stats[joueur].victoiresChampionnat = ligueVictoires[joueur];
        stats[joueur].medaillesChampionnat = ligueMedailles[joueur];
        stats[joueur].victoiresLigues = ligueVictoiresLigues[joueur];
        stats[joueur].medaillesLigues = ligueMedaillesLigues[joueur];
      });
    }

    return Object.entries(stats)
      .map(([joueur, data]) => ({ joueur, ...data }))
      .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
  }, [selectedLigue, selectedChampionnat, filteredData, joueurs, classementGeneral, ligueMetadata, selectedSeason]);

  // Stats détaillées
  const statsDetaillees = useMemo(() => {
    const matchesToUse = selectedStatsLigue === 'all'
      ? filteredData
      : filteredData.filter(d => d.ligue === selectedStatsLigue);

    return calculatePlayerStats(matchesToUse, joueurs);
  }, [selectedStatsLigue, filteredData, joueurs]);

  // Clean sheets & pannes offensives stats
  const cleanSheetsStats = useMemo(() => {
    const matchesToUse = selectedStatsLigue === 'all'
      ? filteredData
      : filteredData.filter(d => d.ligue === selectedStatsLigue);
    const stats = {};
    joueurs.forEach(j => { stats[j] = { cleanSheets: 0, pannesOffensives: 0, matchs: 0 }; });
    matchesToUse.forEach(m => {
      if (stats[m.joueur1] !== undefined) {
        stats[m.joueur1].matchs++;
        if (m.buts_j2 === 0) stats[m.joueur1].cleanSheets++;
        if (m.buts_j1 === 0) stats[m.joueur1].pannesOffensives++;
      }
      if (stats[m.joueur2] !== undefined) {
        stats[m.joueur2].matchs++;
        if (m.buts_j1 === 0) stats[m.joueur2].cleanSheets++;
        if (m.buts_j2 === 0) stats[m.joueur2].pannesOffensives++;
      }
    });
    return Object.entries(stats).map(([joueur, data]) => ({ joueur, ...data }));
  }, [selectedStatsLigue, filteredData, joueurs]);

  // Score distribution
  const scoreDistribution = useMemo(() => {
    const matchesToUse = selectedStatsLigue === 'all'
      ? filteredData
      : filteredData.filter(d => d.ligue === selectedStatsLigue);
    const scoreCounts = {};
    matchesToUse.forEach(m => {
      const [hi, lo] = m.buts_j1 >= m.buts_j2 ? [m.buts_j1, m.buts_j2] : [m.buts_j2, m.buts_j1];
      const key = `${hi}-${lo}`;
      scoreCounts[key] = (scoreCounts[key] || 0) + 1;
    });
    return Object.entries(scoreCounts)
      .map(([score, count]) => ({ score, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [selectedStatsLigue, filteredData]);

  // Heure de gloire — best championship per player (for Face à Face tab)
  const heureDeGloire = useMemo(() => {
    const result = {};
    joueurs.forEach(j => {
      const playerMatches = filteredData.filter(m => m.joueur1 === j || m.joueur2 === j);
      const champMap = groupMatchesByChampionship(playerMatches);
      let best = null;
      Object.entries(champMap).forEach(([key, matches]) => {
        const meta = ligueMetadata[key];
        if (!meta || meta.matchsEntered < meta.matchsTotal) return;
        let pts = 0, matchCount = 0;
        matches.forEach(m => {
          if (m.joueur1 === j) { pts += m.points_j1; matchCount++; }
          else if (m.joueur2 === j) { pts += m.points_j2; matchCount++; }
        });
        if (matchCount === 0) return;
        const avg = pts / matchCount;
        if (!best || avg > best.avg || (avg === best.avg && pts > best.pts)) {
          best = {
            ligue: matches[0].ligue,
            championnat: matches[0].championnat,
            saison: matches[0].saison,
            avg: parseFloat(avg.toFixed(2)),
            pts,
            matchCount
          };
        }
      });
      result[j] = best;
    });
    return result;
  }, [filteredData, joueurs, ligueMetadata]);

  // Face à face stats
  const versusStats = useMemo(() => {
    // Filter matches between the two selected players
    let matchesToUse = filteredData.filter(m =>
      (m.joueur1 === selectedVersusPlayer1 && m.joueur2 === selectedVersusPlayer2) ||
      (m.joueur1 === selectedVersusPlayer2 && m.joueur2 === selectedVersusPlayer1)
    );

    // Filter by ligue if not 'all'
    if (selectedVersusLigue !== 'all') {
      matchesToUse = matchesToUse.filter(m => m.ligue === selectedVersusLigue);
    }

    const stats = {
      matchs: matchesToUse.length,
      victoires_j1: 0,
      victoires_j2: 0,
      nuls: 0,
      buts_j1: 0,
      buts_j2: 0,
      points_j1: 0,
      points_j2: 0
    };

    matchesToUse.forEach(match => {
      // Determine which player is j1 and j2 in this match
      if (match.joueur1 === selectedVersusPlayer1) {
        stats.buts_j1 += match.buts_j1;
        stats.buts_j2 += match.buts_j2;
        stats.points_j1 += match.points_j1;
        stats.points_j2 += match.points_j2;

        if (match.buts_j1 > match.buts_j2) stats.victoires_j1++;
        else if (match.buts_j1 === match.buts_j2) stats.nuls++;
        else stats.victoires_j2++;
      } else {
        // Players are reversed in the match
        stats.buts_j1 += match.buts_j2;
        stats.buts_j2 += match.buts_j1;
        stats.points_j1 += match.points_j2;
        stats.points_j2 += match.points_j1;

        if (match.buts_j2 > match.buts_j1) stats.victoires_j1++;
        else if (match.buts_j1 === match.buts_j2) stats.nuls++;
        else stats.victoires_j2++;
      }
    });

    stats.ga_j1 = stats.buts_j1 - stats.buts_j2;
    stats.ga_j2 = stats.buts_j2 - stats.buts_j1;

    // Valise stats
    stats.valises_j1 = 0; stats.valises_j1_efficaces = 0;
    stats.valises_j2 = 0; stats.valises_j2_efficaces = 0;
    matchesToUse.forEach(match => {
      const j1IsP1 = match.joueur1 === selectedVersusPlayer1;
      const valP1 = j1IsP1 ? match.valise_j1 : match.valise_j2;
      const valP2 = j1IsP1 ? match.valise_j2 : match.valise_j1;
      const diff = Math.abs(match.buts_j1 - match.buts_j2);
      if (valP1) {
        stats.valises_j1++;
        const won = j1IsP1 ? match.resultat === 'victoire_j1' : match.resultat === 'victoire_j2';
        if (diff === 0 || (won && diff === 1)) stats.valises_j1_efficaces++;
      }
      if (valP2) {
        stats.valises_j2++;
        const won = j1IsP1 ? match.resultat === 'victoire_j2' : match.resultat === 'victoire_j1';
        if (diff === 0 || (won && diff === 1)) stats.valises_j2_efficaces++;
      }
    });

    return stats;
  }, [filteredData, selectedVersusPlayer1, selectedVersusPlayer2, selectedVersusLigue]);

  // Versus match history for thermomètre
  const versusMatchHistory = useMemo(() => {
    let matchesToUse = filteredData.filter(m =>
      (m.joueur1 === selectedVersusPlayer1 && m.joueur2 === selectedVersusPlayer2) ||
      (m.joueur1 === selectedVersusPlayer2 && m.joueur2 === selectedVersusPlayer1)
    );
    if (selectedVersusLigue !== 'all') {
      matchesToUse = matchesToUse.filter(m => m.ligue === selectedVersusLigue);
    }
    return [...matchesToUse]
      .sort((a, b) => new Date(a.dateMatch) - new Date(b.dateMatch))
      .map(m => {
        const j1IsPlayer1 = m.joueur1 === selectedVersusPlayer1;
        const butsJ1 = j1IsPlayer1 ? m.buts_j1 : m.buts_j2;
        const butsJ2 = j1IsPlayer1 ? m.buts_j2 : m.buts_j1;
        let result;
        if (butsJ1 > butsJ2) result = 'W';
        else if (butsJ1 < butsJ2) result = 'L';
        else result = 'D';
        return {
          result,
          butsJ1,
          butsJ2,
          date: new Date(m.dateMatch).toLocaleDateString('fr-FR'),
          ligue: m.ligue,
          championnat: m.championnat,
          saison: m.saison
        };
      });
  }, [filteredData, selectedVersusPlayer1, selectedVersusPlayer2, selectedVersusLigue]);

  // Evolution data
  const evolutionData = useMemo(() => {
    if (selectedChampionnat !== 'total') return [];

    let championnats;
    let dataToUse;

    if (selectedLigue === 'general') {
      championnats = [...new Set(filteredData.map(d => d.championnat))].sort();
      dataToUse = filteredData;
    } else {
      championnats = championnatsByLigue[selectedLigue] || [];
      dataToUse = filteredData.filter(d => d.ligue === selectedLigue);
    }

    return championnats.map(championnat => {
      const dataPoint = { championnat };
      const championnatsUpToNow = championnats.slice(0, championnats.indexOf(championnat) + 1);
      const matchesUpToNow = dataToUse.filter(m => championnatsUpToNow.includes(m.championnat));
      const stats = calculatePlayerStats(matchesUpToNow, joueurs);

      const victoires = {};
      joueurs.forEach(j => victoires[j] = 0);

      championnatsUpToNow.forEach(ch => {
        const champMatches = dataToUse.filter(m => m.championnat === ch);
        const champStats = calculatePlayerStats(champMatches, joueurs);
        const ranking = Object.entries(champStats)
          .map(([joueur, data]) => ({ joueur, ...data }))
          .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);

        if (ranking.length > 0 && ranking[0].points > 0) {
          victoires[ranking[0].joueur]++;
        }
      });

      joueurs.forEach(joueur => {
        dataPoint[joueur] = stats[joueur].points + (victoires[joueur] * 3);
      });

      return dataPoint;
    });
  }, [filteredData, joueurs, selectedLigue, selectedChampionnat, championnatsByLigue]);

  // Matches list for current championnat
  const matchesListForChampionnat = useMemo(() => {
    if (selectedLigue === 'general') return [];

    let matches = filteredData.filter(d => d.ligue === selectedLigue);

    if (selectedChampionnat !== 'total') {
      matches = matches.filter(d => d.championnat === selectedChampionnat);
    }

    return matches.sort((a, b) => new Date(b.dateMatch) - new Date(a.dateMatch));
  }, [filteredData, selectedLigue, selectedChampionnat]);

  // Valise statistics
  const valiseStats = useMemo(() => {
    if (selectedLigue !== 'general' && selectedChampionnat !== 'total') return null;

    let matchesToAnalyze = [];
    if (selectedLigue === 'general') {
      matchesToAnalyze = filteredData;
    } else {
      matchesToAnalyze = filteredData.filter(m => m.ligue === selectedLigue);
    }

    const stats = {};
    joueurs.forEach(j => {
      stats[j] = {
        utilisees: 0,
        recues: 0,
        efficaces: 0,
        efficacesRecues: 0
      };
    });

    matchesToAnalyze.forEach(match => {
      // Count valises used and received
      if (match.valise_j1) {
        stats[match.joueur1].utilisees++;
        stats[match.joueur2].recues++;

        // Check if valise was efficace (decisive)
        const diff = Math.abs(match.buts_j1 - match.buts_j2);
        const isEfficace = (diff === 0) || (match.resultat === 'victoire_j1' && diff === 1);
        if (isEfficace) {
          stats[match.joueur1].efficaces++;
          stats[match.joueur2].efficacesRecues++;
        }
      }

      if (match.valise_j2) {
        stats[match.joueur2].utilisees++;
        stats[match.joueur1].recues++;

        // Check if valise was efficace
        const diff = Math.abs(match.buts_j1 - match.buts_j2);
        const isEfficace = (diff === 0) || (match.resultat === 'victoire_j2' && diff === 1);
        if (isEfficace) {
          stats[match.joueur2].efficaces++;
          stats[match.joueur1].efficacesRecues++;
        }
      }
    });

    return stats;
  }, [filteredData, selectedLigue, selectedChampionnat, joueurs]);
  // Advanced stats: recent form and streaks (no championship filtering)
  const advancedStats = useMemo(() => {
    const stats = {};

    // Get all matches sorted by date (newest first)
    const sortedMatches = [...matchData]
      .filter(m => selectedSeason === 'All-Time' || m.saison === selectedSeason)
      .sort((a, b) => new Date(b.dateMatch) - new Date(a.dateMatch));

    joueurs.forEach(joueur => {
      // Get all matches for this player
      const playerMatches = [];
      sortedMatches.forEach(match => {
        if (match.joueur1 === joueur) {
          playerMatches.push({
            date: match.dateMatch,
            opponent: match.joueur2,
            butsFor: match.buts_j1,
            butsAgainst: match.buts_j2,
            result: match.buts_j1 > match.buts_j2 ? 'W' : match.buts_j1 < match.buts_j2 ? 'L' : 'D',
            championnat: match.championnat,
            ligue: match.ligue
          });
        } else if (match.joueur2 === joueur) {
          playerMatches.push({
            date: match.dateMatch,
            opponent: match.joueur1,
            butsFor: match.buts_j2,
            butsAgainst: match.buts_j1,
            result: match.buts_j2 > match.buts_j1 ? 'W' : match.buts_j2 < match.buts_j1 ? 'L' : 'D',
            championnat: match.championnat,
            ligue: match.ligue
          });
        }
      });

      // Recent form (last 10 matches) - reversed to show oldest first (left) to newest (right)
      const recentForm = playerMatches.slice(0, 10).reverse();

      // Calculate streaks
      let currentStreak = { type: null, count: 0 };
      let maxWinStreak = 0;
      let maxUnbeatenStreak = 0;
      let currentWinStreak = 0;
      let currentUnbeatenStreak = 0;

      playerMatches.forEach((match, index) => {
        // Current streak (most recent)
        if (index === 0) {
          currentStreak.type = match.result;
          currentStreak.count = 1;
        } else if (currentStreak.count > 0 && match.result === currentStreak.type) {
          currentStreak.count++;
        }

        // Win streak
        if (match.result === 'W') {
          currentWinStreak++;
          maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        } else {
          currentWinStreak = 0;
        }

        // Unbeaten streak (W or D)
        if (match.result === 'W' || match.result === 'D') {
          currentUnbeatenStreak++;
          maxUnbeatenStreak = Math.max(maxUnbeatenStreak, currentUnbeatenStreak);
        } else {
          currentUnbeatenStreak = 0;
        }
      });

      stats[joueur] = {
        recentForm,
        currentStreak,
        maxWinStreak,
        maxUnbeatenStreak,
        totalMatches: playerMatches.length
      };
    });

    return stats;
  }, [matchData, joueurs, selectedSeason]);

  // Calculate records for the selected season
  const seasonRecords = useMemo(() => {
    const seasonMatches = filteredData;

    if (seasonMatches.length === 0) {
      return null;
    }

    const records = {
      // 1. Le plus grand nombre de buts inscrits dans un match
      mostGoalsInMatch: [],

      // 2. Le plus gros écart de buts dans une victoire
      biggestWinMargin: [],

      // 5. Le match le plus prolifique
      mostProlificMatch: [],

      // Series records (8-13)
      longestWinStreak: {},
      longestUnbeatenStreak: {},
      longestLossStreak: {},
      longestDrawStreak: {},
      longestGoalDrought: {},
      longestCleanSheetStreak: {},

      // 16-17. Regularity
      mostRegular: [],
      mostUnpredictable: [],

      // New records
      bestWinRatioPeak: [],      // Meilleur ratio de victoires atteint à un moment T
      bestCurrentWinRatio: [],   // Meilleur ratio de victoires actuel (fin de saison)
      bestHeadToHead: [],        // Meilleur versus contre un autre joueur (kept for computation, not displayed)
      bestH2HStreak: [],         // Plus longue série de victoires en face-à-face
      mostGoalsInChampionship: [],     // Plus de buts marqués en 1 championnat (6 matches)
      mostConcededInChampionship: [],  // Plus de buts encaissés en 1 championnat (6 matches)
      mostProlificDraw: [],            // Nul le plus prolifique
      clutchChampion: [],              // Titres gagnés avec 1 seul point d'écart
      closeWinsKing: [],               // Le plus de victoires par 1 but d'écart
      berserkKing: [],                 // Le plus de victoires par 5+ buts d'écart
      drawSpecialist: [],              // Spécialiste des nuls (ratio de nuls le plus élevé)
      perfectSeason: [],                 // 6V en 6 matchs
      unbeatenChampion: [],              // Titre sans défaite
      bestGAChampionship: [],          // Meilleur GA sur un championnat
      worstGAChampionship: [],         // Pire GA sur un championnat
      tightestChampionship: [],        // Championnat le plus équitable (σ points le plus faible)
      mostExplosive: [],               // Plus grand total de buts sur un championnat
      leastExplosive: [],              // Moins grand total de buts sur un championnat
      mostDrawsChampionship: [],       // Plus grand nombre de nuls en 1 championnat
      biggestDomination: [],           // Plus grand écart 1er/2ème (en points)
      remontada: []                    // Dernier à mi-parcours → champion
    };

    // Record 1: Most goals scored in a single match
    seasonMatches.forEach(match => {
      [
        { joueur: match.joueur1, buts: match.buts_j1, adversaire: match.joueur2, butsAdv: match.buts_j2 },
        { joueur: match.joueur2, buts: match.buts_j2, adversaire: match.joueur1, butsAdv: match.buts_j1 }
      ].forEach(perf => {
        if (records.mostGoalsInMatch.length === 0 || perf.buts > records.mostGoalsInMatch[0].buts) {
          records.mostGoalsInMatch = [{
            joueur: perf.joueur,
            buts: perf.buts,
            adversaire: perf.adversaire,
            butsAdv: perf.butsAdv,
            date: match.dateMatch,
            ligue: match.ligue,
            championnat: match.championnat
          }];
        } else if (perf.buts === records.mostGoalsInMatch[0].buts) {
          records.mostGoalsInMatch.push({
            joueur: perf.joueur,
            buts: perf.buts,
            adversaire: perf.adversaire,
            butsAdv: perf.butsAdv,
            date: match.dateMatch,
            ligue: match.ligue,
            championnat: match.championnat
          });
        }
      });
    });

    // Record 2: Biggest win margin
    seasonMatches.forEach(match => {
      const diff1 = match.buts_j1 - match.buts_j2;
      const diff2 = match.buts_j2 - match.buts_j1;

      if (diff1 > 0) {
        if (records.biggestWinMargin.length === 0 || diff1 > records.biggestWinMargin[0].margin) {
          records.biggestWinMargin = [{
            joueur: match.joueur1,
            adversaire: match.joueur2,
            score: `${match.buts_j1}-${match.buts_j2}`,
            margin: diff1,
            date: match.dateMatch,
            ligue: match.ligue,
            championnat: match.championnat
          }];
        } else if (diff1 === records.biggestWinMargin[0].margin) {
          records.biggestWinMargin.push({
            joueur: match.joueur1,
            adversaire: match.joueur2,
            score: `${match.buts_j1}-${match.buts_j2}`,
            margin: diff1,
            date: match.dateMatch,
            ligue: match.ligue,
            championnat: match.championnat
          });
        }
      }

      if (diff2 > 0) {
        if (records.biggestWinMargin.length === 0 || diff2 > records.biggestWinMargin[0].margin) {
          records.biggestWinMargin = [{
            joueur: match.joueur2,
            adversaire: match.joueur1,
            score: `${match.buts_j2}-${match.buts_j1}`,
            margin: diff2,
            date: match.dateMatch,
            ligue: match.ligue,
            championnat: match.championnat
          }];
        } else if (diff2 === records.biggestWinMargin[0].margin) {
          records.biggestWinMargin.push({
            joueur: match.joueur2,
            adversaire: match.joueur1,
            score: `${match.buts_j2}-${match.buts_j1}`,
            margin: diff2,
            date: match.dateMatch,
            ligue: match.ligue,
            championnat: match.championnat
          });
        }
      }
    });

    // Record 5: Most prolific match (total goals) + most prolific draw
    seasonMatches.forEach(match => {
      const totalGoals = match.buts_j1 + match.buts_j2;
      if (records.mostProlificMatch.length === 0 || totalGoals > records.mostProlificMatch[0].totalGoals) {
        records.mostProlificMatch = [{
          joueur1: match.joueur1,
          joueur2: match.joueur2,
          score: `${match.buts_j1}-${match.buts_j2}`,
          totalGoals,
          date: match.dateMatch,
          ligue: match.ligue,
          championnat: match.championnat
        }];
      } else if (totalGoals === records.mostProlificMatch[0].totalGoals) {
        records.mostProlificMatch.push({
          joueur1: match.joueur1,
          joueur2: match.joueur2,
          score: `${match.buts_j1}-${match.buts_j2}`,
          totalGoals,
          date: match.dateMatch,
          ligue: match.ligue,
          championnat: match.championnat
        });
      }
      if (match.resultat === 'nul') {
        if (records.mostProlificDraw.length === 0 || totalGoals > records.mostProlificDraw[0].totalGoals) {
          records.mostProlificDraw = [{
            joueur1: match.joueur1,
            joueur2: match.joueur2,
            score: `${match.buts_j1}-${match.buts_j2}`,
            totalGoals,
            date: match.dateMatch,
            ligue: match.ligue,
            championnat: match.championnat
          }];
        } else if (totalGoals === records.mostProlificDraw[0].totalGoals) {
          records.mostProlificDraw.push({
            joueur1: match.joueur1,
            joueur2: match.joueur2,
            score: `${match.buts_j1}-${match.buts_j2}`,
            totalGoals,
            date: match.dateMatch,
            ligue: match.ligue,
            championnat: match.championnat
          });
        }
      }
    });

    // Roi des scores serrés (victoire par 1 but) + Berserk (victoire par 5+ buts)
    const closeWinsCounts = {};
    const berserkCounts = {};
    joueurs.forEach(j => { closeWinsCounts[j] = 0; berserkCounts[j] = 0; });
    seasonMatches.forEach(match => {
      const margin = Math.abs(match.buts_j1 - match.buts_j2);
      let winner = null;
      if (match.resultat === 'victoire_j1') winner = match.joueur1;
      else if (match.resultat === 'victoire_j2') winner = match.joueur2;
      if (winner && closeWinsCounts[winner] !== undefined) {
        if (margin === 1) closeWinsCounts[winner]++;
        if (margin >= 5) berserkCounts[winner]++;
      }
    });
    const maxClose = Math.max(...Object.values(closeWinsCounts).filter(v => v > 0), 0);
    if (maxClose > 0) records.closeWinsKing = Object.entries(closeWinsCounts).filter(([, v]) => v === maxClose).map(([joueur]) => ({ joueur, count: maxClose }));
    const maxBerserk = Math.max(...Object.values(berserkCounts).filter(v => v > 0), 0);
    if (maxBerserk > 0) records.berserkKing = Object.entries(berserkCounts).filter(([, v]) => v === maxBerserk).map(([joueur]) => ({ joueur, count: maxBerserk }));

    // Draw specialist: player with highest draw ratio (min 10 matches)
    const drawCounts = {};
    joueurs.forEach(j => { drawCounts[j] = { draws: 0, total: 0 }; });
    seasonMatches.forEach(m => {
      const isDraw = m.buts_j1 === m.buts_j2;
      if (drawCounts[m.joueur1]) { drawCounts[m.joueur1].total++; if (isDraw) drawCounts[m.joueur1].draws++; }
      if (drawCounts[m.joueur2]) { drawCounts[m.joueur2].total++; if (isDraw) drawCounts[m.joueur2].draws++; }
    });
    const drawSpecialistCandidates = Object.entries(drawCounts)
      .filter(([, s]) => s.total >= 10)
      .map(([joueur, s]) => ({ joueur, draws: s.draws, total: s.total, ratio: s.draws / s.total }))
      .sort((a, b) => b.ratio - a.ratio);
    if (drawSpecialistCandidates.length > 0) {
      const maxRatio = drawSpecialistCandidates[0].ratio;
      records.drawSpecialist = drawSpecialistCandidates.filter(e => e.ratio === maxRatio);
    }

    // Sort matches by date for series calculation
    const sortedMatches = [...seasonMatches].sort((a, b) =>
      new Date(a.dateMatch) - new Date(b.dateMatch)
    );

    // Calculate series for each player
    joueurs.forEach(joueur => {
      const playerMatches = sortedMatches.filter(m =>
        m.joueur1 === joueur || m.joueur2 === joueur
      ).map(m => {
        const isJ1 = m.joueur1 === joueur;
        return {
          date: m.dateMatch,
          buts: isJ1 ? m.buts_j1 : m.buts_j2,
          butsAdv: isJ1 ? m.buts_j2 : m.buts_j1,
          result: m.resultat === (isJ1 ? 'victoire_j1' : 'victoire_j2') ? 'W'
              : m.resultat === 'nul' ? 'D' : 'L',
          ligue: m.ligue,
          championnat: m.championnat
        };
      });

      // Calculate all series using the shared helper
      const streaks = {
        longestWinStreak: calculateLongestStreak(playerMatches, m => m.result === 'W'),
        longestUnbeatenStreak: calculateLongestStreak(playerMatches, m => m.result !== 'L'),
        longestLossStreak: calculateLongestStreak(playerMatches, m => m.result === 'L'),
        longestDrawStreak: calculateLongestStreak(playerMatches, m => m.result === 'D'),
        longestGoalDrought: calculateLongestStreak(playerMatches, m => m.buts === 0),
        longestCleanSheetStreak: calculateLongestStreak(playerMatches, m => m.butsAdv === 0),
      };

      Object.entries(streaks).forEach(([key, streak]) => {
        if (streak) records[key][joueur] = streak;
      });

      // Calculate standard deviation for regularity (16-17)
      if (playerMatches.length > 2) {
        const goalDiffs = playerMatches.map(m => m.buts - m.butsAdv);
        const mean = goalDiffs.reduce((a, b) => a + b, 0) / goalDiffs.length;
        const squaredDiffs = goalDiffs.map(x => Math.pow(x - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / goalDiffs.length;
        const stdDev = Math.sqrt(variance);

        if (records.mostRegular.length === 0 || stdDev < records.mostRegular[0].stdDev) {
          records.mostRegular = [{ joueur, stdDev, matchs: playerMatches.length }];
        } else if (stdDev === records.mostRegular[0].stdDev) {
          records.mostRegular.push({ joueur, stdDev, matchs: playerMatches.length });
        }

        if (records.mostUnpredictable.length === 0 || stdDev > records.mostUnpredictable[0].stdDev) {
          records.mostUnpredictable = [{ joueur, stdDev, matchs: playerMatches.length }];
        } else if (stdDev === records.mostUnpredictable[0].stdDev) {
          records.mostUnpredictable.push({ joueur, stdDev, matchs: playerMatches.length });
        }
      }

      // NEW: Calculate best win ratio peak (at any moment T)
      if (playerMatches.length >= 30) {
        let wins = 0;
        let totalMatches = 0;
        let bestRatio = 0;
        let bestRatioDate = null;
        let bestRatioWins = 0;
        let bestRatioMatches = 0;

        playerMatches.forEach((match) => {
          totalMatches++;
          if (match.result === 'W') wins++;

          // Calculate ratio after this match (minimum 30 matches)
          if (totalMatches >= 30) {
            const ratio = wins / totalMatches;
            if (ratio > bestRatio || (ratio === bestRatio && totalMatches > bestRatioMatches)) {
              bestRatio = ratio;
              bestRatioDate = match.date;
              bestRatioWins = wins;
              bestRatioMatches = totalMatches;
            }
          }
        });

        if (bestRatio > 0) {
          if (records.bestWinRatioPeak.length === 0 || bestRatio > records.bestWinRatioPeak[0].ratio) {
            records.bestWinRatioPeak = [{
              joueur,
              ratio: bestRatio,
              wins: bestRatioWins,
              totalMatches: bestRatioMatches,
              date: bestRatioDate
            }];
          } else if (bestRatio === records.bestWinRatioPeak[0].ratio) {
            records.bestWinRatioPeak.push({
              joueur,
              ratio: bestRatio,
              wins: bestRatioWins,
              totalMatches: bestRatioMatches,
              date: bestRatioDate
            });
          }
        }
      }

      // NEW: Calculate current win ratio (at end of season)
      if (playerMatches.length >= 30) {
        const totalWins = playerMatches.filter(m => m.result === 'W').length;
        const currentRatio = totalWins / playerMatches.length;

        if (records.bestCurrentWinRatio.length === 0 || currentRatio > records.bestCurrentWinRatio[0].ratio) {
          records.bestCurrentWinRatio = [{
            joueur,
            ratio: currentRatio,
            wins: totalWins,
            totalMatches: playerMatches.length
          }];
        } else if (currentRatio === records.bestCurrentWinRatio[0].ratio) {
          records.bestCurrentWinRatio.push({
            joueur,
            ratio: currentRatio,
            wins: totalWins,
            totalMatches: playerMatches.length
          });
        }
      }
    });

    // NEW: Calculate best head-to-head versus record
    const h2hStats = {};

    joueurs.forEach(j1 => {
      joueurs.forEach(j2 => {
        if (j1 >= j2) return; // Skip self and duplicates

        const h2hMatches = sortedMatches.filter(m =>
          (m.joueur1 === j1 && m.joueur2 === j2) ||
          (m.joueur1 === j2 && m.joueur2 === j1)
        );

        // Require minimum 8 confrontations for significance
        if (h2hMatches.length < 8) return;

        let j1Wins = 0, j1GA = 0;
        let j2Wins = 0, j2GA = 0;

        h2hMatches.forEach(m => {
          if (m.joueur1 === j1) {
            j1GA += (m.buts_j1 - m.buts_j2);
            j2GA += (m.buts_j2 - m.buts_j1);
            if (m.buts_j1 > m.buts_j2) j1Wins++;
            else if (m.buts_j2 > m.buts_j1) j2Wins++;
          } else {
            j1GA += (m.buts_j2 - m.buts_j1);
            j2GA += (m.buts_j1 - m.buts_j2);
            if (m.buts_j2 > m.buts_j1) j1Wins++;
            else if (m.buts_j1 > m.buts_j2) j2Wins++;
          }
        });

        // Determine dominant player (by wins first, then GA)
        let dominant, dominated, dominantWins, dominatedWins, gaAdvantage, winRatio;

        if (j1Wins > j2Wins || (j1Wins === j2Wins && j1GA > j2GA)) {
          dominant = j1;
          dominated = j2;
          dominantWins = j1Wins;
          dominatedWins = j2Wins;
          gaAdvantage = j1GA;
          winRatio = j1Wins / h2hMatches.length;
        } else if (j2Wins > j1Wins || (j2Wins === j1Wins && j2GA > j1GA)) {
          dominant = j2;
          dominated = j1;
          dominantWins = j2Wins;
          dominatedWins = j1Wins;
          gaAdvantage = j2GA;
          winRatio = j2Wins / h2hMatches.length;
        } else {
          return; // Perfect equality, skip
        }

        // Score based on dominance (win ratio × GA advantage)
        const dominanceScore = winRatio * Math.abs(gaAdvantage);

        if (records.bestHeadToHead.length === 0 || dominanceScore > records.bestHeadToHead[0].dominanceScore) {
          records.bestHeadToHead = [{
            dominant,
            dominated,
            wins: dominantWins,
            losses: dominatedWins,
            draws: h2hMatches.length - dominantWins - dominatedWins,
            totalMatches: h2hMatches.length,
            gaAdvantage,
            winRatio,
            dominanceScore
          }];
        } else if (dominanceScore === records.bestHeadToHead[0].dominanceScore) {
          records.bestHeadToHead.push({
            dominant,
            dominated,
            wins: dominantWins,
            losses: dominatedWins,
            draws: h2hMatches.length - dominantWins - dominatedWins,
            totalMatches: h2hMatches.length,
            gaAdvantage,
            winRatio,
            dominanceScore
          });
        }
      });
    });

    // NEW: Longest h2h win streak
    joueurs.forEach(j1 => {
      joueurs.forEach(j2 => {
        if (j1 >= j2) return;
        const h2hMatches = sortedMatches
          .filter(m => (m.joueur1 === j1 && m.joueur2 === j2) || (m.joueur1 === j2 && m.joueur2 === j1))
          .map(m => {
            const isJ1 = m.joueur1 === j1;
            const bJ1 = isJ1 ? m.buts_j1 : m.buts_j2;
            const bJ2 = isJ1 ? m.buts_j2 : m.buts_j1;
            return { date: m.dateMatch, resultForJ1: bJ1 > bJ2 ? 'W' : bJ1 < bJ2 ? 'L' : 'D' };
          });
        if (h2hMatches.length < 3) return;
        [{ player: j1, winKey: 'W' }, { player: j2, winKey: 'L' }].forEach(({ player, winKey }) => {
          const opponent = player === j1 ? j2 : j1;
          const streak = calculateLongestStreak(h2hMatches, m => m.resultForJ1 === winKey);
          if (!streak) return;
          if (records.bestH2HStreak.length === 0 || streak.length > records.bestH2HStreak[0].length) {
            records.bestH2HStreak = [{ joueur: player, adversaire: opponent, length: streak.length, startDate: streak.startDate, endDate: streak.endDate }];
          } else if (streak.length === records.bestH2HStreak[0].length) {
            records.bestH2HStreak.push({ joueur: player, adversaire: opponent, length: streak.length, startDate: streak.startDate, endDate: streak.endDate });
          }
        });
      });
    });

    // NEW: Calculate most goals scored/conceded in a single championship (6-match championships only)
    const championshipsMap = groupMatchesByChampionship(seasonMatches);

    Object.entries(championshipsMap).forEach(([key, matches]) => {
      // Only consider completed 6-journée championships
      const champMeta = ligueMetadata[key];
      if (!champMeta || champMeta.matchsTotal !== 6 || champMeta.matchsEntered < champMeta.matchsTotal) return;

      const championshipStats = {};
      joueurs.forEach(j => {
        championshipStats[j] = { goalsScored: 0, goalsConceded: 0 };
      });

      matches.forEach(match => {
        // Process all 4 players in the match
        if (match.joueur1) {
          championshipStats[match.joueur1].goalsScored += match.buts_j1 || 0;
          championshipStats[match.joueur1].goalsConceded += match.buts_j2 || 0;
        }
        if (match.joueur2) {
          championshipStats[match.joueur2].goalsScored += match.buts_j2 || 0;
          championshipStats[match.joueur2].goalsConceded += match.buts_j1 || 0;
        }
        if (match.joueur3) {
          championshipStats[match.joueur3].goalsScored += match.buts_j3 || 0;
          championshipStats[match.joueur3].goalsConceded += match.buts_j4 || 0;
        }
        if (match.joueur4) {
          championshipStats[match.joueur4].goalsScored += match.buts_j4 || 0;
          championshipStats[match.joueur4].goalsConceded += match.buts_j3 || 0;
        }
      });

      // Check for records
      Object.entries(championshipStats).forEach(([joueur, stats]) => {
        // Most goals scored
        if (records.mostGoalsInChampionship.length === 0 || stats.goalsScored > records.mostGoalsInChampionship[0].goals) {
          records.mostGoalsInChampionship = [{
            joueur,
            goals: stats.goalsScored,
            championnat: matches[0].championnat,
            ligue: matches[0].ligue,
            saison: matches[0].saison
          }];
        } else if (stats.goalsScored === records.mostGoalsInChampionship[0].goals) {
          records.mostGoalsInChampionship.push({
            joueur,
            goals: stats.goalsScored,
            championnat: matches[0].championnat,
            ligue: matches[0].ligue,
            saison: matches[0].saison
          });
        }

        // Most goals conceded
        if (records.mostConcededInChampionship.length === 0 || stats.goalsConceded > records.mostConcededInChampionship[0].goals) {
          records.mostConcededInChampionship = [{
            joueur,
            goals: stats.goalsConceded,
            championnat: matches[0].championnat,
            ligue: matches[0].ligue,
            saison: matches[0].saison
          }];
        } else if (stats.goalsConceded === records.mostConcededInChampionship[0].goals) {
          records.mostConcededInChampionship.push({
            joueur,
            goals: stats.goalsConceded,
            championnat: matches[0].championnat,
            ligue: matches[0].ligue,
            saison: matches[0].saison
          });
        }
      });

      // Compute full championship ranking
      const champStats = calculatePlayerStats(matches, joueurs);
      const ranking = Object.entries(champStats)
        .map(([joueur, data]) => ({ joueur, ...data }))
        .filter(p => p.matchs > 0)
        .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);

      if (ranking.length < 2) return;
      const champion = ranking[0];
      const last = ranking[ranking.length - 1];

      // perfectSeason: 6V en 6 matchs
      if (champion.victoires === 6) {
        records.perfectSeason.push({
          joueur: champion.joueur,
          championnat: matches[0].championnat,
          ligue: matches[0].ligue,
          saison: matches[0].saison
        });
      }

      // unbeatenChampion: titre sans défaite
      if (champion.defaites === 0) {
        records.unbeatenChampion.push({
          joueur: champion.joueur,
          victoires: champion.victoires,
          nuls: champion.nuls,
          championnat: matches[0].championnat,
          ligue: matches[0].ligue,
          saison: matches[0].saison
        });
      }

      // bestGAChampionship / worstGAChampionship: per player
      ranking.forEach(p => {
        if (records.bestGAChampionship.length === 0 || p.ga > records.bestGAChampionship[0].ga) {
          records.bestGAChampionship = [{ joueur: p.joueur, ga: p.ga, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison }];
        } else if (p.ga === records.bestGAChampionship[0].ga) {
          records.bestGAChampionship.push({ joueur: p.joueur, ga: p.ga, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
        }
        if (records.worstGAChampionship.length === 0 || p.ga < records.worstGAChampionship[0].ga) {
          records.worstGAChampionship = [{ joueur: p.joueur, ga: p.ga, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison }];
        } else if (p.ga === records.worstGAChampionship[0].ga) {
          records.worstGAChampionship.push({ joueur: p.joueur, ga: p.ga, championnat: matches[0].championnat, ligue: matches[0].ligue, saison: matches[0].saison });
        }
      });

      // tightestChampionship: most equitable (lowest σ of players' points)
      const pointsValues = ranking.map(p => p.points);
      const meanPoints = pointsValues.reduce((a, b) => a + b, 0) / pointsValues.length;
      const sigmaPoints = Math.sqrt(pointsValues.reduce((sum, p) => sum + Math.pow(p - meanPoints, 2), 0) / pointsValues.length);
      const sigmaRounded = parseFloat(sigmaPoints.toFixed(2));
      if (records.tightestChampionship.length === 0 || sigmaRounded < records.tightestChampionship[0].sigma) {
        records.tightestChampionship = [{
          sigma: sigmaRounded,
          ranking: ranking.map(p => ({ joueur: p.joueur, points: p.points })),
          championnat: matches[0].championnat,
          ligue: matches[0].ligue,
          saison: matches[0].saison
        }];
      } else if (sigmaRounded === records.tightestChampionship[0].sigma) {
        records.tightestChampionship.push({
          sigma: sigmaRounded,
          ranking: ranking.map(p => ({ joueur: p.joueur, points: p.points })),
          championnat: matches[0].championnat,
          ligue: matches[0].ligue,
          saison: matches[0].saison
        });
      }

      // mostExplosive / leastExplosive: total goals in a championship
      const totalGoals = matches.reduce((sum, m) => sum + (m.buts_j1 || 0) + (m.buts_j2 || 0), 0);
      if (records.mostExplosive.length === 0 || totalGoals > records.mostExplosive[0].totalGoals) {
        records.mostExplosive = [{
          totalGoals,
          avgGoals: totalGoals / matches.length,
          championnat: matches[0].championnat,
          ligue: matches[0].ligue,
          saison: matches[0].saison
        }];
      } else if (totalGoals === records.mostExplosive[0].totalGoals) {
        records.mostExplosive.push({
          totalGoals,
          avgGoals: totalGoals / matches.length,
          championnat: matches[0].championnat,
          ligue: matches[0].ligue,
          saison: matches[0].saison
        });
      }
      if (records.leastExplosive.length === 0 || totalGoals < records.leastExplosive[0].totalGoals) {
        records.leastExplosive = [{
          totalGoals,
          avgGoals: totalGoals / matches.length,
          championnat: matches[0].championnat,
          ligue: matches[0].ligue,
          saison: matches[0].saison
        }];
      } else if (totalGoals === records.leastExplosive[0].totalGoals) {
        records.leastExplosive.push({
          totalGoals,
          avgGoals: totalGoals / matches.length,
          championnat: matches[0].championnat,
          ligue: matches[0].ligue,
          saison: matches[0].saison
        });
      }

      // mostDrawsChampionship: most draws in a championship
      const totalDraws = matches.filter(m => m.buts_j1 === m.buts_j2).length;
      if (totalDraws > 0) {
        if (records.mostDrawsChampionship.length === 0 || totalDraws > records.mostDrawsChampionship[0].count) {
          records.mostDrawsChampionship = [{
            count: totalDraws,
            total: matches.length,
            championnat: matches[0].championnat,
            ligue: matches[0].ligue,
            saison: matches[0].saison
          }];
        } else if (totalDraws === records.mostDrawsChampionship[0].count) {
          records.mostDrawsChampionship.push({
            count: totalDraws,
            total: matches.length,
            championnat: matches[0].championnat,
            ligue: matches[0].ligue,
            saison: matches[0].saison
          });
        }
      }

      // biggestDomination: biggest gap between 1st and 2nd (points)
      const domGap = champion.points - ranking[1].points;
      if (records.biggestDomination.length === 0 || domGap > records.biggestDomination[0].gap) {
        records.biggestDomination = [{
          gap: domGap,
          champion: champion.joueur,
          second: ranking[1].joueur,
          pointsChampion: champion.points,
          pointsSecond: ranking[1].points,
          championnat: matches[0].championnat,
          ligue: matches[0].ligue,
          saison: matches[0].saison
        }];
      } else if (domGap === records.biggestDomination[0].gap) {
        records.biggestDomination.push({
          gap: domGap,
          champion: champion.joueur,
          second: ranking[1].joueur,
          pointsChampion: champion.points,
          pointsSecond: ranking[1].points,
          championnat: matches[0].championnat,
          ligue: matches[0].ligue,
          saison: matches[0].saison
        });
      }

      // remontada: last at halfway → becomes champion
      const sortedChampMatches = [...matches].sort((a, b) => new Date(a.dateMatch) - new Date(b.dateMatch));
      const halfMatches = sortedChampMatches.slice(0, Math.floor(matches.length / 2));
      if (halfMatches.length > 0) {
        const halfStats = calculatePlayerStats(halfMatches, joueurs);
        const halfRanking = Object.entries(halfStats)
          .map(([joueur, data]) => ({ joueur, ...data }))
          .filter(p => p.matchs > 0)
          .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
        if (halfRanking.length >= 2) {
          const halfLast = halfRanking[halfRanking.length - 1];
          if (halfLast.joueur === champion.joueur) {
            if (records.remontada.length === 0 || halfLast.points < records.remontada[0].halfPoints) {
              records.remontada = [{
                joueur: champion.joueur,
                halfPoints: halfLast.points,
                halfRank: halfRanking.length,
                finalPoints: champion.points,
                championnat: matches[0].championnat,
                ligue: matches[0].ligue,
                saison: matches[0].saison
              }];
            } else if (halfLast.points === records.remontada[0].halfPoints) {
              records.remontada.push({
                joueur: champion.joueur,
                halfPoints: halfLast.points,
                halfRank: halfRanking.length,
                finalPoints: champion.points,
                championnat: matches[0].championnat,
                ligue: matches[0].ligue,
                saison: matches[0].saison
              });
            }
          }
        }
      }
    });

    // Clutch champion — tous championnats complétés (pas uniquement 6 matchs)
    const clutchCounts = {};
    joueurs.forEach(j => { clutchCounts[j] = 0; });
    Object.entries(championshipsMap).forEach(([key, matches]) => {
      const meta = ligueMetadata[key];
      if (!meta || meta.matchsEntered < meta.matchsTotal) return;
      const stats = calculatePlayerStats(matches, joueurs);
      const ranking = Object.entries(stats)
        .filter(([, s]) => s.matchs > 0)
        .sort((a, b) => b[1].points - a[1].points || b[1].ga - a[1].ga);
      if (ranking.length < 2) return;
      if (ranking[0][1].points - ranking[1][1].points === 1) {
        clutchCounts[ranking[0][0]]++;
      }
    });
    const maxClutch = Math.max(...Object.values(clutchCounts).filter(v => v > 0), 0);
    if (maxClutch > 0) records.clutchChampion = Object.entries(clutchCounts).filter(([, v]) => v === maxClutch).map(([joueur]) => ({ joueur, count: maxClutch }));

    return records;
  }, [filteredData, joueurs, ligueMetadata]);

  // Helper: compute per-ligue stats from a list of matches
  const computeLigueStats = (matches, minMatchs = 3) => {
    if (!matches || matches.length === 0) return null;
    const ligueStats = {};
    matches.forEach(match => {
      const ligue = match.ligue;
      if (!ligue) return;
      if (!ligueStats[ligue]) ligueStats[ligue] = { matchs: 0, totalGoals: 0, draws: 0, cleanSheets: 0, totalMargin: 0 };
      const s = ligueStats[ligue];
      s.matchs++;
      s.totalGoals += (match.buts_j1 || 0) + (match.buts_j2 || 0);
      s.totalMargin += Math.abs((match.buts_j1 || 0) - (match.buts_j2 || 0));
      if (match.buts_j1 === match.buts_j2) s.draws++;
      if (match.buts_j1 === 0 || match.buts_j2 === 0) s.cleanSheets++;
    });
    const ligues = Object.entries(ligueStats)
      .filter(([, s]) => s.matchs >= minMatchs)
      .map(([ligue, s]) => ({
        ligue, matchs: s.matchs,
        avgGoals: s.totalGoals / s.matchs, totalGoals: s.totalGoals,
        drawRate: s.draws / s.matchs, drawCount: s.draws,
        cleanSheetRate: s.cleanSheets / s.matchs, cleanSheetCount: s.cleanSheets,
        avgMargin: s.totalMargin / s.matchs
      }))
      .sort((a, b) => b.avgGoals - a.avgGoals);
    if (ligues.length === 0) return null;
    return {
      ligues,
      mostProlific: ligues[0],
      leastProlific: ligues[ligues.length - 1],
      mostDraws: [...ligues].sort((a, b) => b.drawRate - a.drawRate)[0],
      mostCleanSheets: [...ligues].sort((a, b) => b.cleanSheetRate - a.cleanSheetRate)[0],
      tightest: [...ligues].sort((a, b) => a.avgMargin - b.avgMargin)[0]
    };
  };

  const ligueRecordsAllTime = useMemo(() => computeLigueStats(matchData, 5), [matchData]);
  const ligueRecordsSeason = useMemo(() => {
    if (selectedSeason === 'All-Time') return null;
    return computeLigueStats(filteredData, 3);
  }, [filteredData, selectedSeason]);

  // Historical evolution for graph view
  const historicalEvolution = useMemo(() => {
    let matchesToUse = filteredData;

    // Filter by ligue if not general
    if (selectedLigue !== 'general') {
      matchesToUse = matchesToUse.filter(m => m.ligue === selectedLigue);

      // Filter by championnat if not total
      if (selectedChampionnat !== 'total') {
        matchesToUse = matchesToUse.filter(m => m.championnat === selectedChampionnat);
      }
    }

    // Sort matches by date
    const sortedMatches = [...matchesToUse].sort((a, b) =>
      new Date(a.dateMatch) - new Date(b.dateMatch)
    );

    // Build a map of championship end dates and winners for general ranking
    const championshipBonuses = new Map(); // key: championshipKey, value: { endDate, winner, points }
    const appliedBonuses = new Set(); // Track which bonuses have been applied

    if (selectedLigue === 'general') {
      const championnatsMap = groupMatchesByChampionship(matchesToUse);

      Object.entries(championnatsMap).forEach(([key, matches]) => {
        const metadata = ligueMetadata[key];
        if (!metadata || metadata.matchsEntered < metadata.matchsTotal) return;

        // Find last match date of this championship
        const lastMatch = matches.reduce((latest, m) =>
          new Date(m.dateMatch) > new Date(latest.dateMatch) ? m : latest
        );

        const stats = calculatePlayerStats(matches, joueurs);
        const ranking = Object.entries(stats)
          .map(([joueur, data]) => ({ joueur, ...data }))
          .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);

        if (ranking.length > 0 && ranking[0].points > 0) {
          // FIX: Use >= 6 for titles (3 pts), < 6 for medals (2 pts)
          const bonusPoints = metadata.matchsTotal >= 6 ? 3 : 2;
          championshipBonuses.set(key, {
            endDate: new Date(lastMatch.dateMatch),
            winner: ranking[0].joueur,
            points: bonusPoints
          });
        }
      });
    }

    // Calculate cumulative points over time
    const evolution = [];
    const playerPoints = {};
    const playerBonusPoints = {};
    joueurs.forEach(j => {
      playerPoints[j] = 0;
      playerBonusPoints[j] = 0;
    });

    sortedMatches.forEach((match, index) => {
      // Add points for this match
      if (match.joueur1) playerPoints[match.joueur1] = (playerPoints[match.joueur1] || 0) + (match.points_j1 || 0);
      if (match.joueur2) playerPoints[match.joueur2] = (playerPoints[match.joueur2] || 0) + (match.points_j2 || 0);
      if (match.joueur3) playerPoints[match.joueur3] = (playerPoints[match.joueur3] || 0) + (match.points_j3 || 0);
      if (match.joueur4) playerPoints[match.joueur4] = (playerPoints[match.joueur4] || 0) + (match.points_j4 || 0);

      // Check if any championship ends with this match (only add bonus once per championship)
      if (selectedLigue === 'general') {
        const matchDate = new Date(match.dateMatch);
        championshipBonuses.forEach((bonus, champKey) => {
          if (!appliedBonuses.has(champKey) && Math.abs(bonus.endDate - matchDate) < 1000 * 60 * 60 * 24) {
            playerBonusPoints[bonus.winner] = (playerBonusPoints[bonus.winner] || 0) + bonus.points;
            appliedBonuses.add(champKey); // Mark as applied to avoid duplicates
          }
        });
      }

      // Record snapshot every few matches to avoid too many data points
      if (index % Math.max(1, Math.floor(sortedMatches.length / 30)) === 0 || index === sortedMatches.length - 1) {
        const dataPoint = {
          date: new Date(match.dateMatch).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
          matchNumber: index + 1
        };
        joueurs.forEach(j => {
          dataPoint[j] = (playerPoints[j] || 0) + (playerBonusPoints[j] || 0);
        });
        evolution.push(dataPoint);
      }
    });

    return evolution;
  }, [filteredData, selectedLigue, selectedChampionnat, joueurs, ligueMetadata, selectedSeason]);

  // Historical evolution for buteurs (goals scored)
  // Historical evolution for goals scored and conceded (computed in a single pass)
  const { buteursEvolution, loosersEvolution } = useMemo(() => {
    const seasonMatches = matchData.filter(m =>
      selectedSeason === 'All-Time' || m.saison === selectedSeason
    );

    const sortedMatches = [...seasonMatches].sort((a, b) =>
      new Date(a.dateMatch) - new Date(b.dateMatch)
    );

    const goalsEvolution = [];
    const concededEvolution = [];
    const playerGoals = {};
    const playerConceded = {};
    joueurs.forEach(j => { playerGoals[j] = 0; playerConceded[j] = 0; });

    sortedMatches.forEach((match, index) => {
      // Goals scored
      const scored = {
        [match.joueur1]: match.buts_j1 || 0,
        [match.joueur2]: match.buts_j2 || 0,
        [match.joueur3]: match.buts_j3 || 0,
        [match.joueur4]: match.buts_j4 || 0
      };
      // Goals conceded
      const conceded = {
        [match.joueur1]: (match.buts_j2 || 0) + (match.buts_j3 || 0) + (match.buts_j4 || 0),
        [match.joueur2]: (match.buts_j1 || 0) + (match.buts_j3 || 0) + (match.buts_j4 || 0),
        [match.joueur3]: (match.buts_j1 || 0) + (match.buts_j2 || 0) + (match.buts_j4 || 0),
        [match.joueur4]: (match.buts_j1 || 0) + (match.buts_j2 || 0) + (match.buts_j3 || 0)
      };

      Object.entries(scored).forEach(([joueur, g]) => {
        if (joueur && joueur !== 'undefined') playerGoals[joueur] = (playerGoals[joueur] || 0) + g;
      });
      Object.entries(conceded).forEach(([joueur, g]) => {
        if (joueur && joueur !== 'undefined') playerConceded[joueur] = (playerConceded[joueur] || 0) + g;
      });

      // Record snapshot every few matches
      if (index % Math.max(1, Math.floor(sortedMatches.length / 30)) === 0 || index === sortedMatches.length - 1) {
        const date = new Date(match.dateMatch).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const goalsPt = { date, matchNumber: index + 1 };
        const concPt = { date, matchNumber: index + 1 };
        joueurs.forEach(j => {
          goalsPt[j] = playerGoals[j] || 0;
          concPt[j] = playerConceded[j] || 0;
        });
        goalsEvolution.push(goalsPt);
        concededEvolution.push(concPt);
      }
    });

    return { buteursEvolution: goalsEvolution, loosersEvolution: concededEvolution };
  }, [matchData, selectedSeason, joueurs]);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdminAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);


  // Recalculate all metadata based on actual match counts
  const shareContext = [selectedSeason, selectedLigue && selectedLigue !== 'Toutes' ? selectedLigue : null].filter(Boolean).join(' · ');

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Fixed top-right controls: MP3 Player + Buttons */}
      <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
        {/* Mini music player — largeur fixe réduite */}
        <div className={`w-[220px] rounded-md shadow-md border transition-all ${
          isPlaying
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
        }`}>
          {/* Track title — défilement si trop long */}
          <div className="px-1.5 pt-1 pb-0 overflow-hidden h-4">
            <p className={`text-[10px] font-medium whitespace-nowrap leading-4 ${isPlaying ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'} ${PLAYLIST[currentTrack].title.length > 28 ? 'animate-marquee' : 'text-center'}`}>
              {PLAYLIST[currentTrack].title}
            </p>
          </div>
          {/* Controls */}
          <div className="flex items-center justify-center gap-2 px-2 pb-1.5">
            <button onClick={prevTrack} className="p-1.5 rounded hover:opacity-70 transition-opacity" title="Précédent">
              <SkipBack className="w-4 h-4" />
            </button>
            <button onClick={playPause} className="p-1.5 rounded hover:opacity-70 transition-opacity" title={isPlaying ? 'Pause' : 'Lecture'}>
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button onClick={nextTrack} className="p-1.5 rounded hover:opacity-70 transition-opacity" title="Suivant">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dark mode toggle — taille fixe */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="w-8 h-8 flex items-center justify-center rounded-lg shadow-md transition-all hover:shadow-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-yellow-400 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          title={darkMode ? 'Mode clair' : 'Mode sombre'}
        >
          {darkMode ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>

        {/* Admin button — taille fixe identique au bouton mode nuit */}
        <button
          onClick={() => setActiveTab(activeTab === 'admin' ? 'classements' : 'admin')}
          className={`w-8 h-8 flex items-center justify-center rounded-lg shadow-md transition-all border ${
            activeTab === 'admin'
              ? 'bg-red-600 border-red-600 text-white'
              : 'bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 border-slate-300 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-slate-700'
          }`}
          title="Admin"
        >
          <Lock className="w-4 h-4" />
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white mb-2">MonPetitGazon</h1>
            <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base">Statistiques et performances</p>
            {/* Sync indicator */}
            <div className="flex items-center gap-2 mt-2">
              {isOnline ? (
                <div className="flex items-center gap-1.5 text-green-600 text-xs">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span>Synchronisé</span>
                  {lastSyncTime && (
                    <span className="text-slate-400">
                      • {lastSyncTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-red-600 text-xs">
                  <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                  <span>Hors ligne</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sync error banner */}
        {syncError && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
            <span className="flex-1">{syncError}</span>
            <button onClick={() => setSyncError(null)} className="text-red-400 hover:text-red-600 font-bold">✕</button>
          </div>
        )}

        {/* Season Navigation */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {['2025/2026', '2024/2025', 'All-Time'].map(season => (
            <button
              key={season}
              onClick={() => {
                setSelectedSeason(season);
                if (activeTab === 'admin') setActiveTab('classements');
              }}
              className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                selectedSeason === season && activeTab !== 'admin'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {season}
            </button>
          ))}
        </div>

        {/* Sub-navigation */}
        {activeTab !== 'admin' && (
          <div className="flex gap-4 mb-6 flex-wrap items-center">
            {/* Onglets principaux */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveTab('classements')}
                className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                  activeTab === 'classements'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Classements
              </button>
              {selectedSeason === '2025/2026' && (
                <button
                  onClick={() => setActiveTab('stats-avancees')}
                  className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                    activeTab === 'stats-avancees'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  Forme
                </button>
              )}
              <button
                onClick={() => setActiveTab('versus')}
                className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                  activeTab === 'versus'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Face à face
              </button>
              <button
                onClick={() => setActiveTab('records')}
                className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                  activeTab === 'records'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Records
              </button>
              <button
                  onClick={() => setActiveTab('mercato')}
                  className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                    activeTab === 'mercato'
                      ? 'bg-amber-500 text-white shadow-lg'
                      : 'bg-white text-amber-600 hover:bg-amber-50 dark:bg-slate-800 dark:text-amber-400'
                  }`}
                >
                  Mercato
                </button>
            </div>

          </div>
        )}

        {/* ONGLET CLASSEMENTS */}
        {activeTab === 'classements' && (
          <ClassementsTab
            joueurs={joueurs}
            ligues={ligues}
            selectedSeason={selectedSeason}
            selectedLigue={selectedLigue}
            setSelectedLigue={setSelectedLigue}
            selectedChampionnat={selectedChampionnat}
            setSelectedChampionnat={setSelectedChampionnat}
            championnatsByLigue={championnatsByLigue}
            classementParLigue={classementParLigue}
            statsDetaillees={statsDetaillees}
            cleanSheetsStats={cleanSheetsStats}
            valiseStats={valiseStats}
            matchesListForChampionnat={matchesListForChampionnat}
            ligueMetadata={ligueMetadata}
            historicalEvolution={historicalEvolution}
            shareContext={shareContext}
          />
        )}

                {/* ONGLET ADMIN */}
        {activeTab === 'admin' && (
          <AdminTab
            matchData={matchData}
            mercatoData={mercatoData}
            joueurs={joueurs}
            ligueMetadata={ligueMetadata}
            ligues={ligues}
            isAdminAuthenticated={isAdminAuthenticated}
          />
        )}

      </div>
    </div>
  );
};

export default App;
