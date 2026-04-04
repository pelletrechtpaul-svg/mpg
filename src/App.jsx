import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie, Cell, Brush } from 'recharts';
import { Trophy, Lock, Plus, Trash2, Edit, Medal, SkipBack, SkipForward, Play, Pause } from 'lucide-react';
import { db, auth } from './firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// Helper function to encode keys for Firestore (no slashes allowed in doc IDs)
const encodeFirestoreKey = (key) => key.replace(/\//g, '_');
const decodeFirestoreKey = (key) => key.replace(/_/g, '/');

// Player images mapping
const playerImages = {
  'Roman': '/images/1.png',
  'Adrien': '/images/2.png',
  'Paul': '/images/3.png',
  'Tiago': '/images/4.png'
};

// Playlist — ajoute tes fichiers dans /public/audio/ et référence-les ici
const PLAYLIST = [
  { title: "Baby c'est MPG",  src: "/audio/Baby c'est MPG.mp3" },
  { title: 'Cette fusion',    src: '/audio/Cette fusion.mp3' },
  { title: 'Communiqué',      src: '/audio/Communiqué.mp3' },
  { title: 'Déni',            src: '/audio/Déni.mp3' },
  { title: 'Faut doser',      src: '/audio/Faut doser.mp3' },
  { title: 'Greenwood',       src: '/audio/Greenwood.mp3' },
  { title: 'Jeanette',        src: '/audio/Jeanette.mp3' },
  { title: 'Looser',          src: '/audio/Looser.mp3' },
  { title: 'Mercato',         src: '/audio/Mercato.mp3' },
];

// Championnats sans détail de matchs — classement final saisi manuellement
const MANUAL_CHAMPIONSHIPS = [
  {
    saison: '2024/2025',
    ligue: 'Ligue des Champions',
    championnat: '#1',
    matchsTotal: 6,
    standings: [
      { joueur: 'Paul',   points: 15, ga: 8,   matchs: 6, victoires: 5, nuls: 0, defaites: 1 },
      { joueur: 'Roman',  points: 12, ga: 4,   matchs: 6, victoires: 4, nuls: 0, defaites: 2 },
      { joueur: 'Adrien', points: 7,  ga: -2,  matchs: 6, victoires: 2, nuls: 1, defaites: 3 },
      { joueur: 'Tiago',  points: 1,  ga: -10, matchs: 6, victoires: 0, nuls: 1, defaites: 5 },
    ]
  }
];

// Group matches by championship key (saison-ligue-championnat)
const groupMatchesByChampionship = (matches) => {
  const map = {};
  matches.forEach(match => {
    const key = `${match.saison}-${match.ligue}-${match.championnat}`;
    if (!map[key]) map[key] = [];
    map[key].push(match);
  });
  return map;
};

// Calculate longest streak of a given condition in a list of matches
const calculateLongestStreak = (playerMatches, conditionFn) => {
  let current = 0, max = 0, maxEnd = null;
  playerMatches.forEach((match, idx) => {
    if (conditionFn(match)) {
      current++;
      if (current > max) { max = current; maxEnd = idx; }
    } else {
      current = 0;
    }
  });
  if (max === 0) return null;
  const startDate = playerMatches[maxEnd - max + 1]?.date;
  const endDate = playerMatches[maxEnd]?.date;
  return { length: max, startDate, endDate };
};

// Hex colors for chart rendering (matches playerColors bg classes)
const playerColorHex = {
  Paul: '#2563eb',
  Adrien: '#16a34a',
  Tiago: '#9333ea',
  Roman: '#ea580c',
};

const App = () => {
  // State - now synced with Firestore
  const [matchData, setMatchData] = useState([]);
  const [ligueMetadata, setLigueMetadata] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const [selectedSeason, setSelectedSeason] = useState('2025/2026');
  const [activeTab, setActiveTab] = useState('classements');
  const [activeRecordsSubTab, setActiveRecordsSubTab] = useState('individuels');
  const [ligueRecordsMode, setLigueRecordsMode] = useState('alltime'); // 'saison' | 'alltime'
  const [selectedLigue, setSelectedLigue] = useState('general');
  const [selectedChampionnat, setSelectedChampionnat] = useState('total');
  const [selectedStatsLigue, setSelectedStatsLigue] = useState('all');

  // Face à face states
  const [selectedVersusPlayer1, setSelectedVersusPlayer1] = useState('Paul');
  const [selectedVersusPlayer2, setSelectedVersusPlayer2] = useState('Adrien');
  const [selectedVersusLigue, setSelectedVersusLigue] = useState('all');

  // Goals detail popup
  const [showGoalsDetail, setShowGoalsDetail] = useState(null);

  // Championship / medal detail popup
  const [showChampDetail, setShowChampDetail] = useState(null); // { joueur, type: 'titres'|'medailles', ligues: string[] }

  // Valise table toggle
  const [selectedValiseTable, setSelectedValiseTable] = useState('stats'); // 'stats' or 'efficaces'

  // Rankings view toggle (table or graph)
  const [rankingsView, setRankingsView] = useState('table'); // 'table' or 'graph'

  // Form match tooltip state
  const [activeMatchTooltip, setActiveMatchTooltip] = useState(null); // { joueur, index }
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
  const [adminPassword, setAdminPassword] = useState('');
  const [showAddMatchForm, setShowAddMatchForm] = useState(false);
  const [showEditMatchForm, setShowEditMatchForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);

  // Edit form cascade states
  const [editSelectedSaison, setEditSelectedSaison] = useState('');
  const [editSelectedLigue, setEditSelectedLigue] = useState('');
  const [editSelectedChampionnat, setEditSelectedChampionnat] = useState('');
  const [selectedMatchesToDelete, setSelectedMatchesToDelete] = useState([]);
  const [selectedChampionnatsToDelete, setSelectedChampionnatsToDelete] = useState([]);

  // Admin form
  const [adminFormData, setAdminFormData] = useState({
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
  });

  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('mpg_dark_mode');
    return saved ? JSON.parse(saved) : false;
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
            console.log('✅ Matches migrated to Firestore');
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
            console.log('✅ Metadata migrated to Firestore');
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

        // Cleanup listeners on unmount
        return () => {
          unsubscribeMatches();
          unsubscribeMetadata();
        };
      } catch (error) {
        console.error('Error syncing with Firestore:', error);
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

  // Championnats filtrés par la saison du formulaire admin (indépendant de la saison globale)
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

  const playerColors = {
    Paul: 'bg-blue-600',
    Adrien: 'bg-green-600',
    Tiago: 'bg-purple-600',
    Roman: 'bg-orange-600',
  };

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
  const { victoiresChampionnat, medaillesChampionnat, victoiresDetail, medaillesDetail } = useMemo(() => {
    const victoires = {};
    const medailles = {};
    const victoiresLigues = {}; // joueur -> [ligue, ...]
    const medaillesLigues = {}; // joueur -> [ligue, ...]
    joueurs.forEach(j => {
      victoires[j] = 0; medailles[j] = 0;
      victoiresLigues[j] = []; medaillesLigues[j] = [];
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
        const winner = ranking[0].joueur;
        const entry = { ligue: matches[0].ligue, saison: matches[0].saison };
        if (metadata.matchsTotal >= 6) {
          victoires[winner]++;
          victoiresLigues[winner].push(entry);
        } else {
          medailles[winner]++;
          medaillesLigues[winner].push(entry);
        }
      }
    });

    // Inject manual championships (no match data available)
    const filteredSeasons = new Set(filteredData.map(m => m.saison));
    MANUAL_CHAMPIONSHIPS.forEach(mc => {
      if (!filteredSeasons.has(mc.saison) && selectedSeason !== 'All-Time') return;
      const sorted = [...mc.standings].sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
      if (sorted.length === 0) return;
      const winner = sorted[0].joueur;
      if (victoires[winner] === undefined) return;
      const entry = { ligue: mc.ligue, saison: mc.saison };
      if (mc.matchsTotal >= 6) {
        victoires[winner]++;
        victoiresLigues[winner].push(entry);
      } else {
        medailles[winner]++;
        medaillesLigues[winner].push(entry);
      }
    });

    return {
      victoiresChampionnat: victoires,
      medaillesChampionnat: medailles,
      victoiresDetail: victoiresLigues,
      medaillesDetail: medaillesLigues,
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

  // Calculate remaining players for second match
  const remainingPlayers = useMemo(() => {
    if (!adminFormData.joueur1 || !adminFormData.joueur2) return [];
    const allPlayers = ['Paul', 'Adrien', 'Tiago', 'Roman'];
    return allPlayers.filter(p => p !== adminFormData.joueur1 && p !== adminFormData.joueur2);
  }, [adminFormData.joueur1, adminFormData.joueur2]);

  // Auto-assign joueur3 and joueur4 when joueur1 and joueur2 change
  useEffect(() => {
    if (remainingPlayers.length === 2) {
      setAdminFormData(prev => ({
        ...prev,
        joueur3: remainingPlayers[0],
        joueur4: remainingPlayers[1]
      }));
    }
  }, [remainingPlayers]);

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

  // Check if players have used their valise in the current championnat
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
  const handleRecalculateMetadata = async () => {
    if (!confirm('Recalculer toutes les métadonnées des championnats en fonction du nombre réel de matchs dans la base de données ?')) return;

    try {
      // Group matches by championship
      const championshipGroups = {};
      matchData.forEach(match => {
        const key = `${match.saison}-${match.ligue}-${match.championnat}`;
        if (!championshipGroups[key]) {
          championshipGroups[key] = [];
        }
        championshipGroups[key].push(match);
      });

      // Update metadata for each championship
      const batch = writeBatch(db);
      let updatedCount = 0;

      Object.entries(championshipGroups).forEach(([key, matches]) => {
        // Count unique match dates to get number of "match days" (rounds)
        // Each round = 1 match per player (even if 2 games happen simultaneously)
        const uniqueDates = new Set(matches.map(m => m.dateMatch));
        const actualMatchDays = uniqueDates.size;
        const actualEntries = matches.length;
        const metadata = ligueMetadata[key];

        if (metadata) {
          // Only update matchsEntered (match days), keep matchsTotal as configured
          if (metadata.matchsEntered !== actualMatchDays) {
            const metaRef = doc(db, 'metadata', encodeFirestoreKey(key));

            batch.set(metaRef, {
              ...metadata,
              matchsEntered: actualMatchDays,
              // matchsTotal stays unchanged - manually configured (match days)
              lastRecalculated: new Date().toISOString()
            });
            updatedCount++;
            console.log(`Updating ${key}: ${metadata.matchsEntered}/${metadata.matchsTotal} → ${actualMatchDays}/${metadata.matchsTotal} (${actualEntries} entrées, ${uniqueDates.size} dates)`);
          }
        } else {
          // Create metadata if it doesn't exist
          const metaRef = doc(db, 'metadata', encodeFirestoreKey(key));
          batch.set(metaRef, {
            createdAt: new Date().toISOString(),
            matchsTotal: actualMatchDays,
            matchsEntered: actualMatchDays,
            lastRecalculated: new Date().toISOString()
          });
          updatedCount++;
          console.log(`Creating metadata for ${key}: ${actualMatchDays} journées (${actualEntries} entrées)`);
        }
      });

      await batch.commit();
      alert(`✅ Recalcul terminé ! ${updatedCount} championnat(s) mis à jour.`);
    } catch (error) {
      console.error('Error recalculating metadata:', error);
      alert('❌ Erreur lors du recalcul des métadonnées');
    }
  };

  // Admin: Login
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (adminPassword === 'admin') {
      try {
        // Sign in with Firebase Auth
        // Using a default admin account - you should create this user in Firebase Console
        await signInWithEmailAndPassword(auth, 'admin@mpg-fantasy.app', 'adminmpg2025');
        setAdminPassword('');
      } catch (error) {
        console.error('Login error:', error);
        alert('Erreur de connexion. Assurez-vous que le compte admin existe dans Firebase.');
        setAdminPassword('');
      }
    } else {
      alert('Code incorrect');
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

  // Admin: Add match (can add 2 matches at once)
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

    // Check if second match is filled
    const hasSecondMatch = joueur3 && joueur4 && buts_j3 !== '' && buts_j4 !== '';

    let championnatToUse = championnat;

    if (isNewChampionnat) {
      const existingCount = matchData.filter(
        d => d.saison === saison && d.ligue === ligue
      ).reduce((acc, d) => {
        if (!acc.includes(d.championnat)) acc.push(d.championnat);
        return acc;
      }, []).length;

      championnatToUse = `#${existingCount + 1}`;
    }

    if (!championnatToUse) {
      alert('Veuillez sélectionner ou créer un championnat');
      return;
    }

    const newMatches = [];
    const currentDate = new Date().toISOString();

    // First match (empty fields default to 0)
    const butsJ1 = parseInt(buts_j1) || 0;
    const butsJ2 = parseInt(buts_j2) || 0;

    let points_j1, points_j2, resultat;

    if (butsJ1 > butsJ2) {
      points_j1 = 3;
      points_j2 = 0;
      resultat = 'victoire_j1';
    } else if (butsJ1 < butsJ2) {
      points_j1 = 0;
      points_j2 = 3;
      resultat = 'victoire_j2';
    } else {
      points_j1 = 1;
      points_j2 = 1;
      resultat = 'nul';
    }

    newMatches.push({
      saison,
      ligue,
      championnat: championnatToUse,
      joueur1,
      joueur2,
      buts_j1: butsJ1,
      buts_j2: butsJ2,
      valise_j1,
      valise_j2,
      resultat,
      points_j1,
      points_j2,
      dateMatch,
      dateEntree: currentDate
    });

    // Second match (if filled, empty fields default to 0)
    if (hasSecondMatch) {
      const butsJ3 = parseInt(buts_j3) || 0;
      const butsJ4 = parseInt(buts_j4) || 0;

      let points_j3, points_j4, resultat2;

      if (butsJ3 > butsJ4) {
        points_j3 = 3;
        points_j4 = 0;
        resultat2 = 'victoire_j1';
      } else if (butsJ3 < butsJ4) {
        points_j3 = 0;
        points_j4 = 3;
        resultat2 = 'victoire_j2';
      } else {
        points_j3 = 1;
        points_j4 = 1;
        resultat2 = 'nul';
      }

      newMatches.push({
        saison,
        ligue,
        championnat: championnatToUse,
        joueur1: joueur3,
        joueur2: joueur4,
        buts_j1: butsJ3,
        buts_j2: butsJ4,
        valise_j1: valise_j3,
        valise_j2: valise_j4,
        resultat: resultat2,
        points_j1: points_j3,
        points_j2: points_j4,
        dateMatch,
        dateEntree: currentDate
      });
    }

    // Save matches to Firestore
    try {
      const batch = writeBatch(db);

      newMatches.forEach(match => {
        const matchRef = doc(collection(db, 'matches'));
        batch.set(matchRef, { ...match, id: matchRef.id });
      });

      // Update metadata (1 entry = 1 match, regardless of how many scores filled)
      const ligueKey = `${saison}-${ligue}-${championnatToUse}`;
      const metaRef = doc(db, 'metadata', encodeFirestoreKey(ligueKey));

      // If new championnat, create metadata, otherwise update existing
      if (isNewChampionnat) {
        batch.set(metaRef, {
          createdAt: currentDate,
          matchsTotal: newChampionnatMatchs,
          matchsEntered: 1, // This is the first match
          lastEntryDate: currentDate
        });
      } else if (ligueMetadata[ligueKey]) {
        batch.set(metaRef, {
          ...ligueMetadata[ligueKey],
          matchsEntered: ligueMetadata[ligueKey].matchsEntered + 1,
          lastEntryDate: currentDate
        });
      }

      await batch.commit();
    } catch (error) {
      console.error('Error saving matches:', error);
      alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
      return;
    }

    setShowAddMatchForm(false);
    setAdminFormData({
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
    });

    alert('Match ajouté avec succès !');
  };

  // Admin: Edit match
  const handleEditMatch = async (e) => {
    e.preventDefault();

    const { index, joueur1, joueur2, buts_j1, buts_j2, dateMatch } = editingMatch;

    const butsJ1 = parseInt(buts_j1);
    const butsJ2 = parseInt(buts_j2);

    let points_j1, points_j2, resultat;

    if (butsJ1 > butsJ2) {
      points_j1 = 3;
      points_j2 = 0;
      resultat = 'victoire_j1';
    } else if (butsJ1 < butsJ2) {
      points_j1 = 0;
      points_j2 = 3;
      resultat = 'victoire_j2';
    } else {
      points_j1 = 1;
      points_j2 = 1;
      resultat = 'nul';
    }

    const match = matchData[index];
    const updatedMatch = {
      ...match,
      joueur1,
      joueur2,
      buts_j1: butsJ1,
      buts_j2: butsJ2,
      resultat,
      points_j1,
      points_j2,
      dateMatch: dateMatch || match.dateMatch,
      dateEntree: new Date().toISOString()
    };

    try {
      if (match.firestoreId) {
        const matchRef = doc(db, 'matches', match.firestoreId);
        await setDoc(matchRef, updatedMatch);
      }
      setShowEditMatchForm(false);
      setEditingMatch(null);
      alert('Match modifié !');
    } catch (error) {
      console.error('Error updating match:', error);
      alert('Erreur lors de la modification');
    }
  };

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
        <div className={`w-[76px] rounded-md shadow-md border transition-all ${
          isPlaying
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
        }`}>
          {/* Track title — défilement si trop long */}
          <div className="px-1.5 pt-1 pb-0 overflow-hidden">
            <p className={`text-[10px] font-medium whitespace-nowrap ${isPlaying ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'} ${PLAYLIST[currentTrack].title.length > 8 ? 'animate-marquee' : 'text-center'}`}>
              {PLAYLIST[currentTrack].title}
            </p>
          </div>
          {/* Controls */}
          <div className="flex items-center justify-center gap-0 px-1 pb-1">
            <button onClick={prevTrack} className="p-0.5 rounded hover:opacity-70 transition-opacity" title="Précédent">
              <SkipBack className="w-3 h-3" />
            </button>
            <button onClick={playPause} className="p-0.5 rounded hover:opacity-70 transition-opacity" title={isPlaying ? 'Pause' : 'Lecture'}>
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button onClick={nextTrack} className="p-0.5 rounded hover:opacity-70 transition-opacity" title="Suivant">
              <SkipForward className="w-3 h-3" />
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
                onClick={() => setActiveTab('statistiques')}
                className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                  activeTab === 'statistiques'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Statistiques
              </button>
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
            </div>

          </div>
        )}

        {/* ONGLET CLASSEMENTS */}
        {activeTab === 'classements' && (
          <>
            {/* Onglets de ligue */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-3 sm:p-6 mb-6">
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
                <button
                  onClick={() => {
                    setSelectedLigue('general');
                    setSelectedChampionnat('total');
                  }}
                  className={`px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold transition-all text-xs sm:text-base border-2 ${
                    selectedLigue === 'general'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-600'
                  }`}
                >
                  Général
                </button>
                {ligues.map(ligue => (
                  <button
                    key={ligue}
                    onClick={() => {
                      setSelectedLigue(ligue);
                      // For All-Time, always show total. For regular seasons, select most recent championnat
                      if (selectedSeason === 'All-Time') {
                        setSelectedChampionnat('total');
                      } else {
                        const championnats = championnatsByLigue[ligue];
                        if (championnats && championnats.length > 0) {
                          setSelectedChampionnat(championnats[championnats.length - 1]);
                        } else {
                          setSelectedChampionnat('total');
                        }
                      }
                    }}
                    className={`px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-base ${
                      selectedLigue === ligue
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {ligue}
                  </button>
                ))}
              </div>

              {/* Dropdown championnat */}
              {selectedSeason !== 'All-Time' && selectedLigue !== 'general' && championnatsByLigue[selectedLigue] && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                    Championnat
                  </label>
                  <select
                    value={selectedChampionnat}
                    onChange={(e) => setSelectedChampionnat(e.target.value)}
                    className="w-full md:w-64 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="total">Total</option>
                    {championnatsByLigue[selectedLigue].map((ch, i) => (
                      <option key={ch} value={ch}>
                        Championnat {i + 1} ({ch})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Toggle Tableau/Graphique (uniquement pour classement général) */}
            {selectedLigue === 'general' && (
              <div className="mb-4 flex justify-end">
                <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
                  <button
                    onClick={() => setRankingsView('table')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      rankingsView === 'table'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    } rounded-l-lg`}
                  >
                    📊 Tableau
                  </button>
                  <button
                    onClick={() => setRankingsView('graph')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      rankingsView === 'graph'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    } rounded-r-lg`}
                  >
                    📈 Évolution
                  </button>
                </div>
              </div>
            )}

            {/* Tableau classement */}
            {(selectedLigue !== 'general' || rankingsView === 'table') ? (
            <div className="rounded-xl shadow-sm overflow-hidden bg-white dark:bg-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Rang</th>
                      <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                      <th className="px-2 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 hidden md:table-cell">Matchs</th>
                      <th className="px-0.5 py-2 sm:px-4 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">V</th>
                      <th className="px-0.5 py-2 sm:px-4 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">N</th>
                      <th className="px-0.5 py-2 sm:px-4 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">D</th>
                      <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">GA</th>
                      {(selectedChampionnat === 'total' || selectedLigue === 'general') && (
                        <>
                          <th className="px-0.5 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Titres</th>
                          <th className="px-0 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
                            <span className="hidden sm:inline">Médailles</span>
                            <span className="sm:hidden">Méd.</span>
                          </th>
                        </>
                      )}
                      <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
                        {selectedLigue === 'general' ? 'Points' : selectedChampionnat === 'total' ? 'Points en match' : 'Points'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {classementParLigue.map((player, index) => (
                      <tr key={player.joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-1 py-2 sm:px-6 sm:py-4">
                          <div className="flex items-center gap-0.5 sm:gap-2">
                            <span className="font-bold text-sm sm:text-lg text-slate-700 dark:text-slate-200">{index + 1}</span>
                            <span className="w-3 sm:w-5 flex-shrink-0">
                              {index === 0 && (() => {
                                const isComplete = selectedLigue !== 'general' && selectedChampionnat !== 'total' && (() => {
                                  const ligueKey = `${selectedSeason}-${selectedLigue}-${selectedChampionnat}`;
                                  const metadata = ligueMetadata[ligueKey];
                                  return metadata && metadata.matchsEntered >= metadata.matchsTotal;
                                })();
                                const isGeneral20242025 = selectedLigue === 'general' && selectedSeason === '2024/2025';
                                if (isComplete || isGeneral20242025) {
                                  if (isComplete && !isGeneral20242025) {
                                    const ligueKey = `${selectedSeason}-${selectedLigue}-${selectedChampionnat}`;
                                    const metadata = ligueMetadata[ligueKey];
                                    if (metadata && metadata.matchsTotal < 6) {
                                      return <Medal className="w-3 h-3 sm:w-5 sm:h-5 text-yellow-500" />;
                                    }
                                  }
                                  return <Trophy className="w-3 h-3 sm:w-5 sm:h-5 text-yellow-500" />;
                                }
                                return null;
                              })()}
                            </span>
                          </div>
                        </td>
                        <td className="px-1 py-2 sm:px-6 sm:py-4">
                          <div className="flex items-center gap-1 sm:gap-3">
                            <div className={`w-1.5 h-1.5 sm:w-3 sm:h-3 rounded-full ${playerColors[player.joueur] || 'bg-gray-600'}`}></div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-base">{player.joueur}</span>
                            {/* Flag icon for winners (1st place) */}
                            {index === 0 && (() => {
                              const flagIcons = {
                                'Paul':   <span className="text-sm sm:text-base ml-1">🇫🇷</span>,
                                'Adrien': <span className="text-sm sm:text-base ml-1">🇲🇨</span>,
                                'Roman':  <span className="text-sm sm:text-base ml-1">🇵🇱</span>,
                                'Tiago':  <span className="text-sm sm:text-base ml-1">🇧🇷</span>,
                              };
                              return flagIcons[player.joueur] || null;
                            })()}
                          </div>
                        </td>
                        <td className="px-2 py-2 sm:px-6 sm:py-4 text-center text-slate-700 hidden md:table-cell">{player.matchs}</td>
                        <td className="px-0.5 py-2 sm:px-4 sm:py-4 text-center text-green-600 font-semibold text-xs sm:text-base">{player.victoires}</td>
                        <td className="px-0.5 py-2 sm:px-4 sm:py-4 text-center text-slate-600 text-xs sm:text-base">{player.nuls}</td>
                        <td className="px-0.5 py-2 sm:px-4 sm:py-4 text-center text-red-600 font-semibold text-xs sm:text-base">{player.defaites}</td>
                        <td className="px-1 py-2 sm:px-6 sm:py-4 text-center">
                          <div className="flex items-center justify-center gap-1 sm:gap-2">
                            <span className={`font-bold ${player.ga >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {player.ga > 0 ? '+' : ''}{player.ga}
                            </span>
                            <button
                              onClick={() => setShowGoalsDetail(player)}
                              className="text-blue-600 hover:text-blue-800 font-bold text-sm sm:text-lg"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        {(selectedChampionnat === 'total' || selectedLigue === 'general') && (
                          <>
                            <td className="px-0.5 py-2 sm:px-6 sm:py-4 text-center">
                              <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                                <span className="font-semibold text-yellow-600 text-xs sm:text-base">{player.victoiresChampionnat || 0}</span>
                                {selectedLigue === 'general' && (player.victoiresChampionnat || 0) > 0 && (
                                  <button
                                    onClick={() => setShowChampDetail({ joueur: player.joueur, type: 'titres', ligues: player.victoiresLigues || [] })}
                                    className="text-blue-600 hover:text-blue-800 font-bold text-xs sm:text-sm leading-none"
                                  >+</button>
                                )}
                              </div>
                            </td>
                            <td className="px-0 py-2 sm:px-6 sm:py-4 text-center">
                              <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                                <span className="font-semibold text-slate-500 text-xs sm:text-base">{player.medaillesChampionnat || 0}</span>
                                {selectedLigue === 'general' && (player.medaillesChampionnat || 0) > 0 && (
                                  <button
                                    onClick={() => setShowChampDetail({ joueur: player.joueur, type: 'medailles', ligues: player.medaillesLigues || [] })}
                                    className="text-blue-600 hover:text-blue-800 font-bold text-xs sm:text-sm leading-none"
                                  >+</button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                        <td className="px-1 py-2 sm:px-6 sm:py-4 text-center">
                          <span className="text-sm sm:text-xl font-bold text-blue-600">
                            {selectedLigue === 'general' ? player.points : selectedChampionnat === 'total' ? (player.pointsMatch || player.points) : player.points}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            ) : (
            /* Graphique d'évolution */
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-0 sm:p-6">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 px-2 sm:px-0 pt-2 sm:pt-0">Évolution des points au fil du temps</h3>
              {historicalEvolution.length > 0 ? (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 px-2 sm:px-0">
                    Déplacez les poignées de la tirette en bas pour zoomer sur une période
                  </p>
                  <div className="w-full sm:w-1/2 sm:mx-auto">
                    <ResponsiveContainer width="100%" height={480}>
                      <LineChart data={historicalEvolution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          height={40}
                        />
                        <YAxis
                          label={{ value: 'Points cumulés', angle: -90, position: 'insideLeft' }}
                          domain={['dataMin - 5', 'dataMax + 5']}
                          scale="linear"
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        />
                        <Legend
                          verticalAlign="top"
                          height={36}
                        />
                        <Brush
                          dataKey="date"
                          height={30}
                          stroke="#94a3b8"
                          fill="#f1f5f9"
                          startIndex={Math.max(0, historicalEvolution.length - 20)}
                          endIndex={historicalEvolution.length - 1}
                          travellerWidth={8}
                        />
                        {joueurs.map((joueur) => (
                          <Line
                            key={joueur}
                            type="monotone"
                            dataKey={joueur}
                            stroke={playerColorHex[joueur] || '#6b7280'}
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-600 py-12">
                  <p>Pas assez de données pour afficher l'évolution</p>
                </div>
              )}
            </div>
            )}

            {/* Popup détails buts */}
            {showGoalsDetail && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowGoalsDetail(null)}>
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">{showGoalsDetail.joueur}</h3>
                    <button onClick={() => setShowGoalsDetail(null)} className="text-slate-600 hover:text-slate-800 dark:hover:text-slate-100">
                      ✕
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-col items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-slate-700 font-medium mb-2">Buts inscrits</span>
                      <span className="text-2xl font-bold text-green-600">{showGoalsDetail.buts_pour}</span>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-slate-700 font-medium mb-2">Buts encaissés</span>
                      <span className="text-2xl font-bold text-red-600">{showGoalsDetail.buts_contre}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Popup détail titres / médailles */}
            {showChampDetail && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowChampDetail(null)}>
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 max-w-xs w-full mx-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                      {showChampDetail.joueur} — {showChampDetail.type === 'titres' ? '🏆 Titres' : '🥈 Médailles'}
                    </h3>
                    <button onClick={() => setShowChampDetail(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg leading-none">✕</button>
                  </div>
                  <div className="space-y-1.5">
                    {selectedSeason === 'All-Time'
                      ? /* All-Time : regrouper par saison */
                        Object.entries(
                          showChampDetail.ligues.reduce((acc, e) => {
                            acc[e.saison] = (acc[e.saison] || 0) + 1;
                            return acc;
                          }, {})
                        )
                          .sort((a, b) => b[0].localeCompare(a[0]))
                          .map(([saison, count]) => (
                            <div key={saison} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                              <span className="text-slate-700 dark:text-slate-200 font-medium">{saison}</span>
                              {count > 1 && <span className="text-xs font-bold text-white bg-blue-500 rounded-full px-2 py-0.5">×{count}</span>}
                            </div>
                          ))
                      : /* Saison spécifique : regrouper par ligue */
                        Object.entries(
                          showChampDetail.ligues.reduce((acc, e) => {
                            acc[e.ligue] = (acc[e.ligue] || 0) + 1;
                            return acc;
                          }, {})
                        )
                          .sort((a, b) => b[1] - a[1])
                          .map(([ligue, count]) => (
                            <div key={ligue} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                              <span className="text-slate-700 dark:text-slate-200 font-medium">{ligue}</span>
                              {count > 1 && <span className="text-xs font-bold text-white bg-blue-500 rounded-full px-2 py-0.5">×{count}</span>}
                            </div>
                          ))
                    }
                  </div>
                </div>
              </div>
            )}

            {/* Tableaux de valises (only for general and total) */}
            {valiseStats && (selectedLigue === 'general' || selectedChampionnat === 'total') && (
              <div className="mt-6">
                {/* Toggle buttons */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setSelectedValiseTable('stats')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedValiseTable === 'stats'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    Valises 💼
                  </button>
                  <button
                    onClick={() => setSelectedValiseTable('efficaces')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedValiseTable === 'efficaces'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    Valises efficaces 🎯
                  </button>
                </div>

                {/* Tableau utilisées/reçues */}
                {selectedValiseTable === 'stats' && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-700">
                        <tr>
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Joueur</th>
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200">Utilisées</th>
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-200">Reçues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {joueurs.map(joueur => (
                          <tr key={joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                            <td className="px-2 py-2 sm:px-6 sm:py-4">
                              <div className="flex items-center gap-1.5 sm:gap-3">
                                <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${playerColors[joueur] || 'bg-gray-600'}`}></div>
                                <span className="font-semibold text-slate-800 dark:text-slate-100">{joueur}</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 sm:px-6 sm:py-4 text-center font-semibold text-blue-600">{valiseStats[joueur].utilisees}</td>
                            <td className="px-2 py-2 sm:px-6 sm:py-4 text-center font-semibold text-red-600">{valiseStats[joueur].recues}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                )}

                {/* Classement valises efficaces */}
                {selectedValiseTable === 'efficaces' && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600">
                      <p className="text-xs text-slate-600 dark:text-slate-300">Une valise est efficace si elle a été décisive pour obtenir un nul ou une victoire avec 1 but d'écart</p>
                    </div>
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-700">
                        <tr>
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-left font-semibold text-slate-700 dark:text-slate-200 w-8">#</th>
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Joueur</th>
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-center font-semibold text-green-700 dark:text-green-400">Efficaces infligées</th>
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-center font-semibold text-red-700 dark:text-red-400">Efficaces reçues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {joueurs
                          .map(j => ({ joueur: j, efficaces: valiseStats[j].efficaces, efficacesRecues: valiseStats[j].efficacesRecues }))
                          .sort((a, b) => b.efficaces - a.efficaces || a.efficacesRecues - b.efficacesRecues)
                          .map((item, index) => (
                            <tr key={item.joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                              <td className="px-2 py-2 sm:px-6 sm:py-4">
                                <span className="font-bold text-base sm:text-lg text-slate-700 dark:text-slate-200">{index + 1}</span>
                              </td>
                              <td className="px-2 py-2 sm:px-6 sm:py-4">
                                <div className="flex items-center gap-1.5 sm:gap-3">
                                  <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${playerColors[item.joueur] || 'bg-gray-600'}`}></div>
                                  <span className="font-semibold text-slate-800 dark:text-slate-100">{item.joueur}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2 sm:px-6 sm:py-4 text-center">
                                <span className="text-base sm:text-xl font-bold text-green-600">{item.efficaces}</span>
                              </td>
                              <td className="px-2 py-2 sm:px-6 sm:py-4 text-center">
                                <span className="text-base sm:text-xl font-bold text-red-500">{item.efficacesRecues}</span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Liste des matchs */}
            {selectedLigue !== 'general' && selectedChampionnat !== 'total' && matchesListForChampionnat.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 mt-6">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
                  Matchs {selectedChampionnat !== 'total' ? `du championnat ${selectedChampionnat}` : 'de tous les championnats'}
                </h3>

                {/* Metadata - positioned above match list */}
                {(() => {
                  const ligueKey = `${selectedSeason}-${selectedLigue}-${selectedChampionnat}`;
                  const metadata = ligueMetadata[ligueKey];
                  if (metadata && matchesListForChampionnat.length > 0) {
                    // Get first and last match dates
                    const sortedMatches = [...matchesListForChampionnat].sort((a, b) => new Date(a.dateMatch) - new Date(b.dateMatch));
                    const firstMatchDate = sortedMatches[0]?.dateMatch;
                    const lastMatchDate = sortedMatches[sortedMatches.length - 1]?.dateMatch;
                    const isComplete = metadata.matchsEntered >= metadata.matchsTotal;

                    return (
                      <div className="mb-4 bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          <strong>Commencé le :</strong> {firstMatchDate ? new Date(firstMatchDate).toLocaleDateString('fr-FR') : 'N/A'} •
                          <strong className="ml-2">Matchs :</strong> {metadata.matchsEntered}/{metadata.matchsTotal}
                          {isComplete && lastMatchDate && (
                            <span className="ml-4">
                              <strong>Terminé le :</strong> {new Date(lastMatchDate).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="space-y-2">
                  {matchesListForChampionnat.map((match, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-1.5 sm:gap-4 p-2 sm:p-3 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors text-xs sm:text-base">
                      <span className="text-slate-600 min-w-[70px] sm:min-w-0">
                        {match.dateMatch ? new Date(match.dateMatch).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date(match.dateEntree).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                      <span className="font-medium text-slate-800">{match.joueur1}</span>
                      <span className="text-sm sm:text-lg font-bold text-blue-600">{match.buts_j1}</span>
                      <span className="text-slate-400">-</span>
                      <span className="text-sm sm:text-lg font-bold text-purple-600">{match.buts_j2}</span>
                      <span className="font-medium text-slate-800">{match.joueur2}</span>
                      {(match.valise_j1 || match.valise_j2) && (
                        <span className="text-xs sm:text-sm">
                          {match.valise_j1 && match.valise_j2 ? '💼💼' : '💼'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ONGLET FACE À FACE */}
        {activeTab === 'versus' && (
          <>
            {/* Sélection des joueurs et filtre ligue */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Joueur 1</label>
                  <select
                    value={selectedVersusPlayer1}
                    onChange={(e) => setSelectedVersusPlayer1(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {joueurs.filter(j => j !== selectedVersusPlayer2).map(j => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Joueur 2</label>
                  <select
                    value={selectedVersusPlayer2}
                    onChange={(e) => setSelectedVersusPlayer2(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {joueurs.filter(j => j !== selectedVersusPlayer1).map(j => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Ligue</label>
                  <select
                    value={selectedVersusLigue}
                    onChange={(e) => setSelectedVersusLigue(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Toutes les ligues</option>
                    {ligues.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Affichage du bilan */}
            {versusStats.matchs > 0 ? (
              <>
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 sm:p-8 mb-6">
                  <div className="grid grid-cols-3 items-center gap-4 md:gap-6">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full mb-3 overflow-hidden border-4 border-blue-500 shadow-lg">
                        <img
                          src={playerImages[selectedVersusPlayer1]}
                          alt={selectedVersusPlayer1}
                          className="w-full h-full object-cover"
                          style={{ objectPosition: selectedVersusPlayer1 === 'Paul' ? '65% 15%' : selectedVersusPlayer1 === 'Roman' ? '50% 20%' : 'center' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.classList.add(playerColors[selectedVersusPlayer1] || 'bg-gray-600');
                          }}
                        />
                      </div>
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedVersusPlayer1}</h3>
                      {heureDeGloire[selectedVersusPlayer1] && (
                        <div className="mt-1">
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">⭐ Heure de gloire</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{heureDeGloire[selectedVersusPlayer1].ligue} {heureDeGloire[selectedVersusPlayer1].championnat}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{heureDeGloire[selectedVersusPlayer1].avg} pts/match • {heureDeGloire[selectedVersusPlayer1].saison}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-700 dark:text-slate-200">
                        {versusStats.victoires_j1}
                        <span className="text-slate-400 mx-2 sm:mx-3">-</span>
                        {versusStats.victoires_j2}
                      </div>
                      <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2">
                        {versusStats.nuls} match{versusStats.nuls > 1 ? 's' : ''} nul{versusStats.nuls > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full mb-3 overflow-hidden border-4 border-purple-500 shadow-lg">
                        <img
                          src={playerImages[selectedVersusPlayer2]}
                          alt={selectedVersusPlayer2}
                          className="w-full h-full object-cover"
                          style={{ objectPosition: selectedVersusPlayer2 === 'Paul' ? '65% 15%' : selectedVersusPlayer2 === 'Roman' ? '50% 20%' : 'center' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.classList.add(playerColors[selectedVersusPlayer2] || 'bg-gray-600');
                          }}
                        />
                      </div>
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedVersusPlayer2}</h3>
                      {heureDeGloire[selectedVersusPlayer2] && (
                        <div className="mt-1">
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">⭐ Heure de gloire</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{heureDeGloire[selectedVersusPlayer2].ligue} {heureDeGloire[selectedVersusPlayer2].championnat}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{heureDeGloire[selectedVersusPlayer2].avg} pts/match • {heureDeGloire[selectedVersusPlayer2].saison}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 mt-8 pt-8 border-t dark:border-slate-700">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-blue-600">{versusStats.buts_j1}</div>
                      <div className="text-sm text-slate-600 mt-2">Buts {selectedVersusPlayer1}</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-4xl font-bold ${versusStats.ga_j1 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {versusStats.ga_j1 > 0 ? '+' : ''}{versusStats.ga_j1}
                      </div>
                      <div className="text-sm text-slate-600 mt-2">Goal Average</div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-purple-600">{versusStats.buts_j2}</div>
                      <div className="text-sm text-slate-600 mt-2">Buts {selectedVersusPlayer2}</div>
                    </div>
                  </div>
                </div>

                {/* Valises en face-à-face */}
                {(versusStats.valises_j1 > 0 || versusStats.valises_j2 > 0) && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 text-center">💼 Valises</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-3xl font-bold text-blue-600">{versusStats.valises_j1}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">utilisées</div>
                        {versusStats.valises_j1 > 0 && (
                          <div className="text-sm font-semibold text-green-600 mt-1">
                            {versusStats.valises_j1_efficaces} efficace{versusStats.valises_j1_efficaces !== 1 ? 's' : ''}
                            <span className="text-slate-400 font-normal"> ({Math.round(versusStats.valises_j1_efficaces / versusStats.valises_j1 * 100)}%)</span>
                          </div>
                        )}
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">{selectedVersusPlayer1}</div>
                      </div>
                      <div></div>
                      <div>
                        <div className="text-3xl font-bold text-purple-600">{versusStats.valises_j2}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">utilisées</div>
                        {versusStats.valises_j2 > 0 && (
                          <div className="text-sm font-semibold text-green-600 mt-1">
                            {versusStats.valises_j2_efficaces} efficace{versusStats.valises_j2_efficaces !== 1 ? 's' : ''}
                            <span className="text-slate-400 font-normal"> ({Math.round(versusStats.valises_j2_efficaces / versusStats.valises_j2 * 100)}%)</span>
                          </div>
                        )}
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">{selectedVersusPlayer2}</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-8 text-center">
                <p className="text-slate-600">
                  Aucune confrontation directe entre {selectedVersusPlayer1} et {selectedVersusPlayer2}
                  {selectedVersusLigue !== 'all' && ` en ${selectedVersusLigue}`}.
                </p>
              </div>
            )}
          </>
        )}

        {/* ONGLET STATISTIQUES */}
        {activeTab === 'statistiques' && (
          <>
            <div className="space-y-8">
                {/* Classement des buteurs */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-2 sm:p-6">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4 px-2 sm:px-0">Classement des buteurs</h2>

                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm w-8">#</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Buts</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Moy.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(statsDetaillees)
                        .map(([joueur, data]) => ({ joueur, ...data }))
                        .sort((a, b) => b.buts_pour - a.buts_pour)
                        .map((player, index) => (
                          <tr key={player.joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <td className="px-2 sm:px-6 py-2 sm:py-4">
                              <span className="font-bold text-sm sm:text-lg text-slate-700 dark:text-slate-200">{index + 1}</span>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${playerColors[player.joueur] || 'bg-gray-600'}`}></div>
                                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm sm:text-base">{player.joueur}</span>
                              </div>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-center">
                              <span className="text-base sm:text-xl font-bold text-green-600">{player.buts_pour}</span>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-center text-sm sm:text-base text-slate-700 dark:text-slate-200">{player.matchs}</td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-center">
                              <span className="font-semibold text-blue-600 text-sm sm:text-base">
                                {player.matchs > 0 ? (player.buts_pour / player.matchs).toFixed(2) : '0.00'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Classement des loosers */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-2 sm:p-6">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4 px-2 sm:px-0">Classement des loosers</h2>

                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm w-8">#</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Buts enc.</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Moy.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(statsDetaillees)
                        .map(([joueur, data]) => ({ joueur, ...data }))
                        .sort((a, b) => b.buts_contre - a.buts_contre)
                        .map((player, index) => (
                          <tr key={player.joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <td className="px-2 sm:px-6 py-2 sm:py-4">
                              <span className="font-bold text-sm sm:text-lg text-slate-700 dark:text-slate-200">{index + 1}</span>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${playerColors[player.joueur] || 'bg-gray-600'}`}></div>
                                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm sm:text-base">{player.joueur}</span>
                              </div>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-center">
                              <span className="text-base sm:text-xl font-bold text-red-600">{player.buts_contre}</span>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-center text-sm sm:text-base text-slate-700 dark:text-slate-200">{player.matchs}</td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-center">
                              <span className="font-semibold text-orange-600 text-sm sm:text-base">
                                {player.matchs > 0 ? (player.buts_contre / player.matchs).toFixed(2) : '0.00'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Clean sheets */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-2 sm:p-6">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4 px-2 sm:px-0">🧤 Clean sheets</h2>
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm w-8">#</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">CS</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...cleanSheetsStats]
                        .sort((a, b) => b.cleanSheets - a.cleanSheets)
                        .map((player, index) => (
                          <tr key={player.joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <td className="px-2 sm:px-6 py-2 sm:py-4">
                              <span className="font-bold text-sm sm:text-lg text-slate-700 dark:text-slate-200">{index + 1}</span>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${playerColors[player.joueur] || 'bg-gray-600'}`}></div>
                                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm sm:text-base">{player.joueur}</span>
                              </div>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-center">
                              <span className="text-base sm:text-xl font-bold text-sky-600">{player.cleanSheets}</span>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-center text-sm sm:text-base text-slate-700 dark:text-slate-200">{player.matchs}</td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-center">
                              <span className="font-semibold text-blue-600 text-sm sm:text-base">
                                {player.matchs > 0 ? ((player.cleanSheets / player.matchs) * 100).toFixed(0) : '0'}%
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Pannes offensives */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-2 sm:p-6">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4 px-2 sm:px-0">🚫 Pannes offensives</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 px-2 sm:px-0">Matchs sans marquer le moindre but</p>
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm w-8">#</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Joueur</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">0 but</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">MJ</th>
                        <th className="px-2 sm:px-6 py-2 sm:py-4 text-center font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...cleanSheetsStats]
                        .sort((a, b) => b.pannesOffensives - a.pannesOffensives)
                        .map((player, index) => (
                          <tr key={player.joueur} className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <td className="px-2 sm:px-6 py-2 sm:py-4">
                              <span className="font-bold text-sm sm:text-lg text-slate-700 dark:text-slate-200">{index + 1}</span>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${playerColors[player.joueur] || 'bg-gray-600'}`}></div>
                                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm sm:text-base">{player.joueur}</span>
                              </div>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-center">
                              <span className="text-base sm:text-xl font-bold text-orange-600">{player.pannesOffensives}</span>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-center text-sm sm:text-base text-slate-700 dark:text-slate-200">{player.matchs}</td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-center">
                              <span className="font-semibold text-red-500 text-sm sm:text-base">
                                {player.matchs > 0 ? ((player.pannesOffensives / player.matchs) * 100).toFixed(0) : '0'}%
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Distribution des scores */}
                {scoreDistribution.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-2 sm:p-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2 px-2 sm:px-0">📊 Distribution des scores</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 px-2 sm:px-0">Top 15 scores les plus fréquents (score normalisé, victoire en premier)</p>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={scoreDistribution} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="score" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => [value, 'Occurrences']} />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
            </div>
          </>
        )}

        {/* ONGLET RECORDS */}
        {activeTab === 'records' && (
          <>
              <div className="space-y-6">
                {/* Sub-tab navigation */}
                <div className="flex gap-1 overflow-x-auto pb-1">
                  <button
                    onClick={() => { if (seasonRecords) setActiveRecordsSubTab('individuels'); }}
                    disabled={!seasonRecords}
                    className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                      !seasonRecords ? 'opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600' :
                      activeRecordsSubTab === 'individuels'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    👤 Individuels
                  </button>
                  <button
                    onClick={() => { if (seasonRecords) setActiveRecordsSubTab('collectifs'); }}
                    disabled={!seasonRecords}
                    className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                      !seasonRecords ? 'opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600' :
                      activeRecordsSubTab === 'collectifs'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    🏆 Collectifs
                  </button>
                  <button
                    onClick={() => setActiveRecordsSubTab('ligues')}
                    className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                      activeRecordsSubTab === 'ligues'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    🌍 Ligues
                  </button>
                </div>

                {/* Message si saison non disponible et onglet qui nécessite des données */}
                {!seasonRecords && activeRecordsSubTab !== 'ligues' && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-8 text-center">
                    <p className="text-slate-500 dark:text-slate-400">
                      Les records individuels et collectifs ne sont disponibles que par saison.
                      Sélectionne une saison ou consulte l'onglet <button onClick={() => setActiveRecordsSubTab('ligues')} className="text-blue-500 underline">Ligues</button>.
                    </p>
                  </div>
                )}

                {/* SOUS-ONGLET INDIVIDUELS */}
                {activeRecordsSubTab === 'individuels' && seasonRecords && (<>
                {/* Records personnels */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">🏅 Records personnels</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Record 1: Plus de buts dans un match */}
                    {seasonRecords.mostGoalsInMatch.length > 0 && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">🎯 Plus de buts marqués dans un match</h3>
                        <p className="text-2xl font-bold text-green-700">{seasonRecords.mostGoalsInMatch[0].buts} buts</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.mostGoalsInMatch.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                  <strong>{entry.joueur}</strong> contre {entry.adversaire} ({entry.buts}-{entry.butsAdv})
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {new Date(entry.date).toLocaleDateString('fr-FR')} • {entry.ligue} {entry.championnat}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Record 2: Plus gros écart */}
                    {seasonRecords.biggestWinMargin.length > 0 && (
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">💪 Plus grosse victoire</h3>
                        <p className="text-2xl font-bold text-blue-700">+{seasonRecords.biggestWinMargin[0].margin} buts</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.biggestWinMargin.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                  <strong>{entry.joueur}</strong> {entry.score} contre {entry.adversaire}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {new Date(entry.date).toLocaleDateString('fr-FR')} • {entry.ligue} {entry.championnat}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* NEW: Meilleur ratio de victoires à un moment T */}
                    {seasonRecords.bestWinRatioPeak.length > 0 && (
                      <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-4 border-2 border-purple-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">📈 Meilleur ratio de victoires atteint</h3>
                        <p className="text-2xl font-bold text-purple-700">{(seasonRecords.bestWinRatioPeak[0].ratio * 100).toFixed(1)}%</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.bestWinRatioPeak.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                  <strong>{entry.joueur}</strong> ({entry.wins}V sur {entry.totalMatches} matchs)
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Pic atteint le {new Date(entry.date).toLocaleDateString('fr-FR')} • min 30 matchs
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* NEW: Meilleur ratio de victoires actuel */}
                    {seasonRecords.bestCurrentWinRatio.length > 0 && (
                      <div className="bg-gradient-to-br from-cyan-50 to-sky-50 rounded-lg p-4 border-2 border-cyan-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">📊 Meilleur ratio de victoires actuel</h3>
                        <p className="text-2xl font-bold text-cyan-700">{(seasonRecords.bestCurrentWinRatio[0].ratio * 100).toFixed(1)}%</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.bestCurrentWinRatio.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                  <strong>{entry.joueur}</strong> ({entry.wins}V sur {entry.totalMatches} matchs)
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Ratio final sur l'ensemble de la saison
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* NEW: Meilleur versus contre un autre joueur */}

                    {/* Roi des scores serrés */}
                    {seasonRecords.closeWinsKing.length > 0 && (
                      <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg p-4 border-2 border-teal-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">🔪 Roi des scores serrés</h3>
                        <p className="text-2xl font-bold text-teal-700">{seasonRecords.closeWinsKing[0].count} victoires</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.closeWinsKing.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                  <strong>{entry.joueur}</strong>
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Victoires par exactement 1 but d'écart</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Berserk */}
                    {seasonRecords.berserkKing.length > 0 && (
                      <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-4 border-2 border-red-300">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">💥 Berserk</h3>
                        <p className="text-2xl font-bold text-red-700">{seasonRecords.berserkKing[0].count} victoires</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.berserkKing.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                  <strong>{entry.joueur}</strong>
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Victoires avec 5 buts d'écart ou plus</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clutch champion */}
                    {seasonRecords.clutchChampion.length > 0 && (
                      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg p-4 border-2 border-violet-300">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">🎯 Joueur le plus clutch</h3>
                        <p className="text-2xl font-bold text-violet-700">{seasonRecords.clutchChampion[0].count} titre{seasonRecords.clutchChampion[0].count > 1 ? 's' : ''}</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.clutchChampion.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                  <strong>{entry.joueur}</strong>
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Championnats gagnés avec exactement 1 point d'écart</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Spécialiste des nuls */}
                    {seasonRecords.drawSpecialist.length > 0 && (
                      <div className="bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-700 dark:to-slate-600 rounded-lg p-4 border-2 border-slate-300 dark:border-slate-500">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🤝 Spécialiste des nuls</h3>
                        <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                          {(seasonRecords.drawSpecialist[0].ratio * 100).toFixed(0)}% de nuls
                        </p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.drawSpecialist.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                  <strong>{entry.joueur}</strong>
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {entry.draws} nuls sur {entry.total} matchs
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Records en championnat — section individuelle */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">🏆 Records en championnat</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Championnats à 6 matchs uniquement</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {seasonRecords.mostGoalsInChampionship.length > 0 && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/40 dark:to-emerald-900/40 rounded-lg p-4 border-2 border-green-200 dark:border-green-700">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">⚽ Plus de buts marqués en 1 championnat</h3>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">{seasonRecords.mostGoalsInChampionship[0].goals} buts</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.mostGoalsInChampionship.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong></p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {seasonRecords.mostConcededInChampionship.length > 0 && (
                      <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/40 dark:to-rose-900/40 rounded-lg p-4 border-2 border-red-200 dark:border-red-700">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🥅 Plus de buts encaissés en 1 championnat</h3>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-400">{seasonRecords.mostConcededInChampionship[0].goals} buts</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.mostConcededInChampionship.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong></p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {seasonRecords.bestGAChampionship.length > 0 && (
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/40 rounded-lg p-4 border-2 border-emerald-200 dark:border-emerald-700">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">📈 Meilleur goal average en 1 championnat</h3>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">+{seasonRecords.bestGAChampionship[0].ga}</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.bestGAChampionship.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong></p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {seasonRecords.worstGAChampionship.length > 0 && (
                      <div className="bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-900/40 dark:to-red-900/40 rounded-lg p-4 border-2 border-rose-200 dark:border-rose-700">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">📉 Pire goal average en 1 championnat</h3>
                        <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">{seasonRecords.worstGAChampionship[0].ga}</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.worstGAChampionship.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong></p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {seasonRecords.biggestDomination.length > 0 && (
                      <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/40 dark:to-amber-900/40 rounded-lg p-4 border-2 border-yellow-200 dark:border-yellow-700">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">👑 Plus grande domination en 1 championnat</h3>
                        <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">+{seasonRecords.biggestDomination[0].gap} pts</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.biggestDomination.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.champion]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                  <strong>{entry.champion}</strong> ({entry.pointsChampion} pts) devant <strong>{entry.second}</strong> ({entry.pointsSecond} pts)
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {seasonRecords.remontada.length > 0 && (
                      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/40 dark:to-blue-900/40 rounded-lg p-4 border-2 border-indigo-200 dark:border-indigo-700">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🔄 Remontada</h3>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.remontada.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{entry.joueur}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                  Dernier à mi-parcours ({entry.halfPoints} pts) → Champion ({entry.finalPoints} pts)
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {seasonRecords.unbeatenChampion.length > 0 && (
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-700 col-span-1 md:col-span-2">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">🛡️ Titre sans défaite</h3>
                        <div className="flex flex-wrap gap-3">
                          {seasonRecords.unbeatenChampion.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white/60 dark:bg-slate-700/60 rounded-lg px-3 py-2">
                              <div className={`w-3 h-3 rounded-full ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{entry.joueur} — {entry.victoires}V {entry.nuls}N 0D</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                </>)}

                {/* SOUS-ONGLET COLLECTIFS */}
                {activeRecordsSubTab === 'collectifs' && seasonRecords && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Championnats à 6 matchs uniquement pour les records de championnat</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Match le plus prolifique */}
                    {seasonRecords.mostProlificMatch.length > 0 && (
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/40 dark:to-amber-900/40 rounded-lg p-4 border-2 border-orange-200 dark:border-orange-700">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🔥 Match le plus prolifique</h3>
                        <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{seasonRecords.mostProlificMatch[0].totalGoals} buts</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.mostProlificMatch.map((entry, i) => (
                            <div key={i} className={i > 0 ? 'pt-1 border-t border-current/10' : ''}>
                              <p className="text-sm text-slate-600 dark:text-slate-300">
                                <strong>{entry.joueur1}</strong> vs <strong>{entry.joueur2}</strong>
                                {' '}({entry.score})
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(entry.date).toLocaleDateString('fr-FR')} • {entry.ligue} {entry.championnat}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Nul le plus prolifique */}
                    {seasonRecords.mostProlificDraw.length > 0 && (
                      <div className="bg-gradient-to-br from-slate-50 to-zinc-50 dark:from-slate-700/50 dark:to-zinc-700/50 rounded-lg p-4 border-2 border-slate-300 dark:border-slate-600">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🤝 Match nul le plus prolifique</h3>
                        <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{seasonRecords.mostProlificDraw[0].totalGoals} buts</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.mostProlificDraw.map((entry, i) => (
                            <div key={i} className={i > 0 ? 'pt-1 border-t border-current/10' : ''}>
                              <p className="text-sm text-slate-600 dark:text-slate-300">
                                <strong>{entry.joueur1}</strong> vs <strong>{entry.joueur2}</strong>
                                {' '}({entry.score})
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(entry.date).toLocaleDateString('fr-FR')} • {entry.ligue} {entry.championnat}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Championnat le plus serré (σ) */}
                    {seasonRecords.tightestChampionship.length > 0 && (
                      <div className="bg-gradient-to-br from-slate-50 to-zinc-50 dark:from-slate-700/50 dark:to-zinc-700/50 rounded-lg p-4 border-2 border-slate-200 dark:border-slate-600">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🎯 Championnat le plus serré</h3>
                        <p className="text-2xl font-bold text-slate-700 dark:text-slate-200 font-mono">σ = {seasonRecords.tightestChampionship[0].sigma}</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.tightestChampionship.map((entry, i) => (
                            <div key={i} className={i > 0 ? 'pt-1 border-t border-current/10' : ''}>
                              <div className="mt-1 space-y-0.5">
                                {entry.ranking.map((p, j) => (
                                  <p key={j} className="text-xs text-slate-600 dark:text-slate-300">
                                    {j + 1}. <strong>{p.joueur}</strong> — {p.points} pts
                                  </p>
                                ))}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Championnat le plus explosif */}
                    {seasonRecords.mostExplosive.length > 0 && (
                      <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/40 dark:to-red-900/40 rounded-lg p-4 border-2 border-orange-200 dark:border-orange-700">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">💥 Championnat le plus explosif</h3>
                        <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{seasonRecords.mostExplosive[0].totalGoals} buts</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.mostExplosive.map((entry, i) => (
                            <div key={i} className={i > 0 ? 'pt-1 border-t border-current/10' : ''}>
                              <p className="text-sm text-slate-600 dark:text-slate-300">{entry.avgGoals.toFixed(1)} buts/match</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Championnat le moins explosif */}
                    {seasonRecords.leastExplosive.length > 0 && (
                      <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-700/50 dark:to-gray-700/50 rounded-lg p-4 border-2 border-slate-200 dark:border-slate-600">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🥱 Championnat le moins explosif</h3>
                        <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{seasonRecords.leastExplosive[0].totalGoals} buts</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.leastExplosive.map((entry, i) => (
                            <div key={i} className={i > 0 ? 'pt-1 border-t border-current/10' : ''}>
                              <p className="text-sm text-slate-600 dark:text-slate-300">{entry.avgGoals.toFixed(1)} buts/match</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Plus de nuls en 1 championnat */}
                    {seasonRecords.mostDrawsChampionship.length > 0 && (
                      <div className="bg-gradient-to-br from-zinc-50 to-slate-50 dark:from-zinc-800/50 dark:to-slate-800/50 rounded-lg p-4 border-2 border-zinc-300 dark:border-zinc-600">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🤝 Championnat avec le plus de nuls</h3>
                        <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">{seasonRecords.mostDrawsChampionship[0].count} nul{seasonRecords.mostDrawsChampionship[0].count > 1 ? 's' : ''}</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.mostDrawsChampionship.map((entry, i) => (
                            <div key={i} className={i > 0 ? 'pt-1 border-t border-current/10' : ''}>
                              <p className="text-sm text-slate-600 dark:text-slate-300">sur {entry.total} matchs ({Math.round(entry.count / entry.total * 100)}%)</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Saison parfaite */}
                    {seasonRecords.perfectSeason.length > 0 && (
                      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/40 dark:to-orange-900/40 rounded-lg p-4 border-2 border-yellow-300 dark:border-yellow-600 col-span-1 md:col-span-2">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">🌟 Saison parfaite (6V/6)</h3>
                        <div className="flex flex-wrap gap-3">
                          {seasonRecords.perfectSeason.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white/60 dark:bg-slate-700/60 rounded-lg px-3 py-2">
                              <div className={`w-3 h-3 rounded-full ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{entry.joueur}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ligue} {entry.championnat} • {entry.saison}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* SOUS-ONGLET LIGUES */}
                {activeRecordsSubTab === 'ligues' && (() => {
                  const ligueData = selectedSeason === 'All-Time' ? ligueRecordsAllTime : ligueRecordsSeason;
                  return (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">🌍 Stats par ligue</h2>

                  {!ligueData ? (
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Pas assez de données pour cette période.</p>
                  ) : (
                    <>
                      {/* Cards des extrêmes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/40 dark:to-emerald-900/40 rounded-lg p-4 border-2 border-green-200 dark:border-green-700">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">⚽ Ligue la plus prolifique</h3>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{ligueData.mostProlific.avgGoals.toFixed(2)} buts/match</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">{ligueData.mostProlific.ligue}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{ligueData.mostProlific.totalGoals} buts sur {ligueData.mostProlific.matchs} matchs</p>
                        </div>

                        <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-700/50 dark:to-gray-700/50 rounded-lg p-4 border-2 border-slate-200 dark:border-slate-600">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🥱 Ligue la moins prolifique</h3>
                          <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{ligueData.leastProlific.avgGoals.toFixed(2)} buts/match</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">{ligueData.leastProlific.ligue}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{ligueData.leastProlific.totalGoals} buts sur {ligueData.leastProlific.matchs} matchs</p>
                        </div>

                        <div className="bg-gradient-to-br from-zinc-50 to-slate-50 dark:from-zinc-800/50 dark:to-slate-800/50 rounded-lg p-4 border-2 border-zinc-300 dark:border-zinc-600">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🤝 Ligue avec le plus de nuls</h3>
                          <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">{(ligueData.mostDraws.drawRate * 100).toFixed(1)}%</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">{ligueData.mostDraws.ligue}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{ligueData.mostDraws.drawCount} nuls sur {ligueData.mostDraws.matchs} matchs</p>
                        </div>

                        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/40 dark:to-cyan-900/40 rounded-lg p-4 border-2 border-teal-200 dark:border-teal-700">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🧤 Ligue avec le plus de clean sheets</h3>
                          <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">{(ligueData.mostCleanSheets.cleanSheetRate * 100).toFixed(1)}%</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">{ligueData.mostCleanSheets.ligue}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{ligueData.mostCleanSheets.cleanSheetCount} matchs avec clean sheet sur {ligueData.mostCleanSheets.matchs}</p>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-700">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🎯 Ligue la plus serrée</h3>
                          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{ligueData.tightest.avgMargin.toFixed(2)} buts d'écart/match</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">{ligueData.tightest.ligue}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{ligueData.tightest.matchs} matchs</p>
                        </div>
                      </div>

                      {/* Tableau comparatif */}
                      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
                              <th className="text-left px-3 py-2 font-semibold">Ligue</th>
                              <th className="text-center px-3 py-2 font-semibold">Matchs</th>
                              <th className="text-center px-3 py-2 font-semibold">Buts/match</th>
                              <th className="text-center px-3 py-2 font-semibold">% Nuls</th>
                              <th className="text-center px-3 py-2 font-semibold">% CS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ligueData.ligues.map((l, i) => (
                              <tr key={l.ligue} className={`border-t border-slate-100 dark:border-slate-700 ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-700/20'}`}>
                                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{l.ligue}</td>
                                <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{l.matchs}</td>
                                <td className="px-3 py-2 text-center font-mono text-slate-800 dark:text-slate-100">{l.avgGoals.toFixed(2)}</td>
                                <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{(l.drawRate * 100).toFixed(0)}%</td>
                                <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{(l.cleanSheetRate * 100).toFixed(0)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
                  );
                })()}

                {/* SOUS-ONGLET INDIVIDUELS — Séries */}
                {activeRecordsSubTab === 'individuels' && seasonRecords && (<>
                {/* Séries */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">📊 Séries remarquables</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Série de victoires */}
                    {Object.keys(seasonRecords.longestWinStreak).length > 0 && (() => {
                      const sorted = Object.entries(seasonRecords.longestWinStreak).sort((a, b) => b[1].length - a[1].length);
                      const maxLen = sorted[0][1].length;
                      const top = sorted.filter(([, d]) => d.length === maxLen);
                      return (
                        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                          <h3 className="text-sm font-semibold text-slate-700 mb-3">🏆 Plus longue série de victoires</h3>
                          <p className="font-bold text-green-700 text-xl">{maxLen} victoires</p>
                          <div className="space-y-1 mt-1">
                            {top.map(([joueur, data]) => (
                              <div key={joueur} className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[joueur]}`}></div>
                                <div>
                                  <p className="text-sm text-slate-600 dark:text-slate-300">{joueur}</p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(data.startDate).toLocaleDateString('fr-FR')} → {new Date(data.endDate).toLocaleDateString('fr-FR')}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Série sans défaite */}
                    {Object.keys(seasonRecords.longestUnbeatenStreak).length > 0 && (() => {
                      const sorted = Object.entries(seasonRecords.longestUnbeatenStreak).sort((a, b) => b[1].length - a[1].length);
                      const maxLen = sorted[0][1].length;
                      const top = sorted.filter(([, d]) => d.length === maxLen);
                      return (
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <h3 className="text-sm font-semibold text-slate-700 mb-3">🛡️ Plus longue série sans défaite</h3>
                          <p className="font-bold text-blue-700 text-xl">{maxLen} matchs</p>
                          <div className="space-y-1 mt-1">
                            {top.map(([joueur, data]) => (
                              <div key={joueur} className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[joueur]}`}></div>
                                <div>
                                  <p className="text-sm text-slate-600 dark:text-slate-300">{joueur}</p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(data.startDate).toLocaleDateString('fr-FR')} → {new Date(data.endDate).toLocaleDateString('fr-FR')}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Série de défaites */}
                    {Object.keys(seasonRecords.longestLossStreak).length > 0 && (() => {
                      const sorted = Object.entries(seasonRecords.longestLossStreak).sort((a, b) => b[1].length - a[1].length);
                      const maxLen = sorted[0][1].length;
                      const top = sorted.filter(([, d]) => d.length === maxLen);
                      return (
                        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                          <h3 className="text-sm font-semibold text-slate-700 mb-3">💔 Plus longue série de défaites</h3>
                          <p className="font-bold text-red-700 text-xl">{maxLen} défaites</p>
                          <div className="space-y-1 mt-1">
                            {top.map(([joueur, data]) => (
                              <div key={joueur} className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[joueur]}`}></div>
                                <div>
                                  <p className="text-sm text-slate-600 dark:text-slate-300">{joueur}</p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(data.startDate).toLocaleDateString('fr-FR')} → {new Date(data.endDate).toLocaleDateString('fr-FR')}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Série de nuls */}
                    {Object.keys(seasonRecords.longestDrawStreak).length > 0 && (() => {
                      const sorted = Object.entries(seasonRecords.longestDrawStreak).sort((a, b) => b[1].length - a[1].length);
                      const maxLen = sorted[0][1].length;
                      const top = sorted.filter(([, d]) => d.length === maxLen);
                      return (
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
                          <h3 className="text-sm font-semibold text-slate-700 mb-3">🤝 Plus longue série de nuls</h3>
                          <p className="font-bold text-slate-700 text-xl">{maxLen} nuls</p>
                          <div className="space-y-1 mt-1">
                            {top.map(([joueur, data]) => (
                              <div key={joueur} className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[joueur]}`}></div>
                                <div>
                                  <p className="text-sm text-slate-600 dark:text-slate-300">{joueur}</p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(data.startDate).toLocaleDateString('fr-FR')} → {new Date(data.endDate).toLocaleDateString('fr-FR')}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Série sans marquer */}
                    {Object.keys(seasonRecords.longestGoalDrought).length > 0 && (() => {
                      const sorted = Object.entries(seasonRecords.longestGoalDrought).sort((a, b) => b[1].length - a[1].length);
                      const maxLen = sorted[0][1].length;
                      const top = sorted.filter(([, d]) => d.length === maxLen);
                      return (
                        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                          <h3 className="text-sm font-semibold text-slate-700 mb-3">🚫 Plus longue disette offensive</h3>
                          <p className="font-bold text-amber-700 text-xl">{maxLen} matchs</p>
                          <div className="space-y-1 mt-1">
                            {top.map(([joueur, data]) => (
                              <div key={joueur} className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[joueur]}`}></div>
                                <div>
                                  <p className="text-sm text-slate-600 dark:text-slate-300">{joueur}</p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(data.startDate).toLocaleDateString('fr-FR')} → {new Date(data.endDate).toLocaleDateString('fr-FR')}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Série sans encaisser */}
                    {Object.keys(seasonRecords.longestCleanSheetStreak).length > 0 && (() => {
                      const sorted = Object.entries(seasonRecords.longestCleanSheetStreak).sort((a, b) => b[1].length - a[1].length);
                      const maxLen = sorted[0][1].length;
                      const top = sorted.filter(([, d]) => d.length === maxLen);
                      return (
                        <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                          <h3 className="text-sm font-semibold text-slate-700 mb-3">🧤 Plus longue série sans encaisser</h3>
                          <p className="font-bold text-teal-700 text-xl">{maxLen} matchs</p>
                          <div className="space-y-1 mt-1">
                            {top.map(([joueur, data]) => (
                              <div key={joueur} className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[joueur]}`}></div>
                                <div>
                                  <p className="text-sm text-slate-600 dark:text-slate-300">{joueur}</p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(data.startDate).toLocaleDateString('fr-FR')} → {new Date(data.endDate).toLocaleDateString('fr-FR')}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Plus longue série en face-à-face */}
                    {seasonRecords.bestH2HStreak.length > 0 && (
                      <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">⚔️ Plus longue série en face-à-face</h3>
                        <p className="font-bold text-amber-700 text-xl">{seasonRecords.bestH2HStreak[0].length} victoires</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.bestH2HStreak.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong> vs {entry.adversaire}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(entry.startDate).toLocaleDateString('fr-FR')} → {new Date(entry.endDate).toLocaleDateString('fr-FR')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Régularité */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">📈 Régularité</h2>

                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-4 py-3 mb-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                    σ(buts marqués − buts encaissés){' '}
                    <span className="font-sans not-italic text-slate-400 dark:text-slate-500">— plus σ est faible, plus les scores sont stables d'un match à l'autre</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Plus régulier */}
                    {seasonRecords.mostRegular.length > 0 && (
                      <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/30 dark:to-violet-900/30 rounded-lg p-4 border-2 border-purple-200 dark:border-purple-700">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">📊 Joueur le plus régulier</h3>
                        <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">σ = {seasonRecords.mostRegular[0].stdDev.toFixed(2)}</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.mostRegular.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong></p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Écart-type: {entry.stdDev.toFixed(2)} • {entry.matchs} matchs
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Plus imprévisible */}
                    {seasonRecords.mostUnpredictable.length > 0 && (
                      <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/30 dark:to-rose-900/30 rounded-lg p-4 border-2 border-pink-200 dark:border-pink-700">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">🎲 Joueur le plus imprévisible</h3>
                        <p className="text-2xl font-bold text-pink-700 dark:text-pink-400">σ = {seasonRecords.mostUnpredictable[0].stdDev.toFixed(2)}</p>
                        <div className="space-y-1 mt-1">
                          {seasonRecords.mostUnpredictable.map((entry, i) => (
                            <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'pt-1 border-t border-current/10' : ''}`}>
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${playerColors[entry.joueur]}`}></div>
                              <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{entry.joueur}</strong></p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Écart-type: {entry.stdDev.toFixed(2)} • {entry.matchs} matchs
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </>)}
              </div>
          </>
        )}

        {/* ONGLET FORME */}
        {activeTab === 'stats-avancees' && (
          <>
            <div className="space-y-6">
                {/* Header with common info */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Forme récente</h2>
                      <p className="text-sm text-slate-600">10 derniers matchs</p>
                    </div>
                    {advancedStats[joueurs[0]] && (
                      <div className="text-right">
                        <p className="text-3xl font-bold text-blue-600">{advancedStats[joueurs[0]].totalMatches}</p>
                        <p className="text-sm text-slate-600">matchs joués</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Player forms grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {joueurs.map(joueur => {
                    const stats = advancedStats[joueur];
                    if (!stats) return null;

                    return (
                      <div key={joueur} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
                        {/* Player header */}
                        <div className="flex items-center gap-4 mb-6 pb-4 border-b dark:border-slate-700">
                          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-blue-500">
                            <img
                              src={playerImages[joueur]}
                              alt={joueur}
                              className="w-full h-full object-cover object-center"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.classList.add(playerColors[joueur] || 'bg-gray-600');
                              }}
                            />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{joueur}</h3>
                          </div>
                        </div>

                        {/* Recent form squares */}
                        <div className="flex gap-2 flex-wrap justify-center relative">
                          {stats.recentForm.length > 0 ? (
                            stats.recentForm.map((match, idx) => (
                              <div key={idx} className="relative">
                                <div
                                  className={`w-10 h-10 rounded flex items-center justify-center font-bold text-white cursor-pointer transition-transform hover:scale-110 ${
                                    match.result === 'W' ? 'bg-green-600' :
                                    match.result === 'L' ? 'bg-red-600' :
                                    'bg-slate-400'
                                  }`}
                                  onClick={() => {
                                    if (activeMatchTooltip?.joueur === joueur && activeMatchTooltip?.index === idx) {
                                      setActiveMatchTooltip(null);
                                    } else {
                                      setActiveMatchTooltip({ joueur, index: idx });
                                    }
                                  }}
                                >
                                  {match.result}
                                </div>

                                {/* Tooltip */}
                                {activeMatchTooltip?.joueur === joueur && activeMatchTooltip?.index === idx && (
                                  <>
                                    {/* Backdrop to close tooltip */}
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={() => setActiveMatchTooltip(null)}
                                    />
                                    {/* Tooltip content */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64">
                                      <div className="bg-slate-800 text-white rounded-lg p-3 shadow-lg">
                                        <div className="text-center mb-2">
                                          <p className="text-2xl font-bold">
                                            {match.butsFor} - {match.butsAgainst}
                                          </p>
                                          <p className="text-sm text-slate-300">
                                            vs {match.opponent}
                                          </p>
                                        </div>
                                        <div className="text-xs text-slate-400 text-center space-y-1">
                                          <p>{match.ligue} {match.championnat}</p>
                                          <p>{match.date}</p>
                                        </div>
                                        {/* Arrow */}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                                          <div className="border-8 border-transparent border-t-slate-800"></div>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500">Aucun match</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
            </div>
          </>
        )}

        {/* ONGLET ADMIN */}
        {activeTab === 'admin' && (
          <>
            {!isAdminAuthenticated ? (
              <div className="bg-white rounded-xl shadow-sm p-8 max-w-md mx-auto">
                <div className="text-center mb-6">
                  <Lock className="w-12 h-12 text-red-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Accès Admin</h2>
                </div>
                <form onSubmit={handleAdminLogin}>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Code d'accès"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4"
                    autoFocus
                  />
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
                            setAdminFormData({
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
                            });
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
                          </div>
                        )}

                        {/* Second match (auto-displayed when joueur1 and joueur2 are selected) */}
                        {adminFormData.joueur1 && adminFormData.joueur2 && adminFormData.joueur3 && adminFormData.joueur4 && (
                          <div className="border-t pt-6">
                            <h4 className="text-md font-semibold text-slate-700 mb-4">2ème match</h4>

                            {/* Joueur selection with swap button */}
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

                            {/* Scores */}
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
                          {/* Étape 1 : Sélection de la saison */}
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

                          {/* Étape 2 : Sélection de la compétition */}
                          {editSelectedSaison && !editSelectedLigue && (
                            <div>
                              <button
                                onClick={() => setEditSelectedSaison('')}
                                className="mb-3 text-sm text-blue-600 hover:text-blue-800"
                              >
                                ← Retour aux saisons
                              </button>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                Sélectionnez une compétition ({editSelectedSaison})
                              </label>
                              <div className="space-y-2">
                                {Array.from(new Set(
                                  matchData
                                    .filter(m => m.saison === editSelectedSaison)
                                    .map(m => m.ligue)
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

                          {/* Étape 3 : Sélection du championnat #X */}
                          {editSelectedSaison && editSelectedLigue && !editSelectedChampionnat && (
                            <div>
                              <button
                                onClick={() => {
                                  setEditSelectedLigue('');
                                  setSelectedChampionnatsToDelete([]);
                                }}
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
                                        .filter(m =>
                                          m.saison === editSelectedSaison &&
                                          m.ligue === editSelectedLigue
                                        )
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
                                                    matchesToDelete.map(match =>
                                                      deleteDoc(doc(db, 'matches', match.firestoreId))
                                                    )
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
                                    .filter(m =>
                                      m.saison === editSelectedSaison &&
                                      m.ligue === editSelectedLigue
                                    )
                                    .map(m => m.championnat)
                                )).sort((a, b) => {
                                  const numA = a.match(/#(\d+)/)?.[1] || '0';
                                  const numB = b.match(/#(\d+)/)?.[1] || '0';
                                  return parseInt(numA) - parseInt(numB);
                                }).map(championnat => (
                                  <div
                                    key={championnat}
                                    className="flex items-center gap-2 p-4 bg-white rounded-lg border"
                                  >
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

                          {/* Étape 4 : Liste des matchs */}
                          {editSelectedSaison && editSelectedLigue && editSelectedChampionnat && (
                            <div>
                              <button
                                onClick={() => {
                                  setEditSelectedChampionnat('');
                                  setSelectedMatchesToDelete([]);
                                }}
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
                                                    selectedMatchesToDelete.map(id =>
                                                      deleteDoc(doc(db, 'matches', id))
                                                    )
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
                                    <div
                                      key={index}
                                      className="flex items-center gap-2 p-4 bg-white rounded-lg border"
                                    >
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
                                    const matchDoc = doc(db, 'matches', matchData[editingMatch.index].firestoreId);
                                    await deleteDoc(matchDoc);
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
        )}

      </div>
    </div>
  );
};

export default App;
