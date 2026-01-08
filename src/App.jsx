import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie, Cell } from 'recharts';
import { Trophy, Lock, Plus, Trash2, Edit, Medal, Music } from 'lucide-react';
import { db, auth } from './firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

const defaultMatchData = [];

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

const App = () => {
  // State - now synced with Firestore
  const [matchData, setMatchData] = useState([]);
  const [ligueMetadata, setLigueMetadata] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const [selectedSeason, setSelectedSeason] = useState('2025/2026');
  const [activeTab, setActiveTab] = useState('classements');
  const [selectedLigue, setSelectedLigue] = useState('general');
  const [selectedChampionnat, setSelectedChampionnat] = useState('total');
  const [selectedStatsLigue, setSelectedStatsLigue] = useState('all');

  // Face à face states
  const [selectedVersusPlayer1, setSelectedVersusPlayer1] = useState('Paul');
  const [selectedVersusPlayer2, setSelectedVersusPlayer2] = useState('Adrien');
  const [selectedVersusLigue, setSelectedVersusLigue] = useState('all');

  // Goals detail popup
  const [showGoalsDetail, setShowGoalsDetail] = useState(null);

  // Valise table toggle
  const [selectedValiseTable, setSelectedValiseTable] = useState('stats'); // 'stats' or 'efficaces'

  // Rankings view toggle (table or graph)
  const [rankingsView, setRankingsView] = useState('table'); // 'table' or 'graph'

  // Form match tooltip state
  const [activeMatchTooltip, setActiveMatchTooltip] = useState(null); // { joueur, index }

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioRef] = useState(new Audio('/audio/theme.mp3'));

  // Infos/Post-its state
  const [postIts, setPostIts] = useState([]);
  const [newPostItText, setNewPostItText] = useState('');
  const [newPostItAuthor, setNewPostItAuthor] = useState('');

  // Admin states
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAddMatchForm, setShowAddMatchForm] = useState(false);
  const [showEditMatchForm, setShowEditMatchForm] = useState(false);
  const [showEditLigueForm, setShowEditLigueForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [editingLigue, setEditingLigue] = useState(null);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');

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

  // MPG Calculator state
  const [mpgCards, setMpgCards] = useState([]);
  const [mpgForm, setMpgForm] = useState({
    nomJoueur: '',
    poste: 'A',
    noteMoyenne: '',
    titularisation: '',
    buts: '',
    matchsJoues: ''
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
    const uniqueLigues = [...new Set(matchData.map(d => d.ligue))];
    return uniqueLigues.length > 0 ? uniqueLigues : ['Ligue 1', 'Premier League', 'Liga', 'Serie A', 'Ligue des Champions'];
  }, [matchData]);

  const championnatsByLigue = useMemo(() => {
    const map = {};
    ligues.forEach(ligue => {
      const championnats = [...new Set(
        filteredData.filter(d => d.ligue === ligue).map(d => d.championnat)
      )].sort();
      map[ligue] = championnats;
    });
    return map;
  }, [filteredData, ligues]);

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

  // Calculate championship victories
  const victoiresChampionnat = useMemo(() => {
    const victoires = {};
    joueurs.forEach(j => victoires[j] = 0);

    const championnatsMap = {};
    filteredData.forEach(match => {
      const key = `${match.saison}-${match.ligue}-${match.championnat}`;
      if (!championnatsMap[key]) championnatsMap[key] = [];
      championnatsMap[key].push(match);
    });

    Object.entries(championnatsMap).forEach(([key, matches]) => {
      // Check if championship is complete
      const metadata = ligueMetadata[key];
      if (!metadata || metadata.matchsEntered < metadata.matchsTotal) {
        return; // Skip incomplete championships
      }

      // Only count victories for championships with exactly 6 matches (titles)
      if (metadata.matchsTotal !== 6) {
        return;
      }

      const stats = calculatePlayerStats(matches, joueurs);
      const ranking = Object.entries(stats)
        .map(([joueur, data]) => ({ joueur, ...data }))
        .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);

      if (ranking.length > 0 && ranking[0].points > 0) {
        victoires[ranking[0].joueur]++;
      }
    });

    return victoires;
  }, [filteredData, joueurs, ligueMetadata]);

  // Calculate medals (for championships with < 6 matches)
  const medaillesChampionnat = useMemo(() => {
    const medailles = {};
    joueurs.forEach(j => medailles[j] = 0);

    const championnatsMap = {};
    filteredData.forEach(match => {
      const key = `${match.saison}-${match.ligue}-${match.championnat}`;
      if (!championnatsMap[key]) championnatsMap[key] = [];
      championnatsMap[key].push(match);
    });

    Object.entries(championnatsMap).forEach(([key, matches]) => {
      // Check if championship is complete
      const metadata = ligueMetadata[key];
      if (!metadata || metadata.matchsEntered < metadata.matchsTotal) {
        return; // Skip incomplete championships
      }

      // Only for championships with less than 6 matches
      if (metadata.matchsTotal >= 6) {
        return;
      }

      const stats = calculatePlayerStats(matches, joueurs);
      const ranking = Object.entries(stats)
        .map(([joueur, data]) => ({ joueur, ...data }))
        .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);

      if (ranking.length > 0 && ranking[0].points > 0) {
        medailles[ranking[0].joueur]++;
      }
    });

    return medailles;
  }, [filteredData, joueurs, ligueMetadata]);

  // Classement général
  const classementGeneral = useMemo(() => {
    const stats = calculatePlayerStats(filteredData, joueurs);

    // Save points from matches before adding title/medal bonuses
    Object.keys(stats).forEach(joueur => {
      stats[joueur].pointsMatch = stats[joueur].points; // Points from match results only
      stats[joueur].points += victoiresChampionnat[joueur] * 3;
      stats[joueur].points += medaillesChampionnat[joueur] * 2;
      stats[joueur].victoiresChampionnat = victoiresChampionnat[joueur];
      stats[joueur].medaillesChampionnat = medaillesChampionnat[joueur];
    });

    // Add artificial titles for 2024/2025 General ranking
    if (selectedSeason === '2024/2025') {
      if (stats['Adrien']) {
        stats['Adrien'].victoiresChampionnat += 1;
        stats['Adrien'].points += 3;
      }
      if (stats['Paul']) {
        stats['Paul'].victoiresChampionnat += 1;
        stats['Paul'].points += 3;
      }
    }

    return Object.entries(stats)
      .map(([joueur, data]) => ({ joueur, ...data }))
      .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
  }, [filteredData, joueurs, victoiresChampionnat, medaillesChampionnat, selectedSeason]);

  // Classement par ligue
  const classementParLigue = useMemo(() => {
    if (selectedLigue === 'general') return classementGeneral;

    let matchesToUse = filteredData.filter(m => m.ligue === selectedLigue);

    if (selectedChampionnat !== 'total') {
      matchesToUse = matchesToUse.filter(m => m.championnat === selectedChampionnat);
    }

    const stats = calculatePlayerStats(matchesToUse, joueurs);

    if (selectedChampionnat === 'total') {
      const championnatsMap = {};
      matchesToUse.forEach(match => {
        const key = match.championnat;
        if (!championnatsMap[key]) championnatsMap[key] = [];
        championnatsMap[key].push(match);
      });

      const ligueVictoires = {};
      const ligueMedailles = {};
      joueurs.forEach(j => {
        ligueVictoires[j] = 0;
        ligueMedailles[j] = 0;
      });

      Object.entries(championnatsMap).forEach(([champ, matches]) => {
        // Check if championship is complete
        const metadataKey = `${selectedSeason}-${selectedLigue}-${champ}`;
        const metadata = ligueMetadata[metadataKey];
        if (!metadata || metadata.matchsEntered < metadata.matchsTotal) {
          return; // Skip incomplete championships
        }

        const champStats = calculatePlayerStats(matches, joueurs);
        const ranking = Object.entries(champStats)
          .map(([joueur, data]) => ({ joueur, ...data }))
          .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);

        if (ranking.length > 0 && ranking[0].points > 0) {
          // Award titre (3 pts) for 6+ matches, or médaille (2 pts) for < 6 matches
          if (metadata.matchsTotal >= 6) {
            ligueVictoires[ranking[0].joueur]++;
          } else {
            ligueMedailles[ranking[0].joueur]++;
          }
        }
      });

      // Save points from matches before adding title/medal bonuses
      Object.keys(stats).forEach(joueur => {
        stats[joueur].pointsMatch = stats[joueur].points; // Points from match results only
        stats[joueur].points += ligueVictoires[joueur] * 3;
        stats[joueur].points += ligueMedailles[joueur] * 2;
        stats[joueur].victoiresChampionnat = ligueVictoires[joueur];
        stats[joueur].medaillesChampionnat = ligueMedailles[joueur];
      });
    }

    // Add artificial data for 2024/2025 Ligue 1 Total
    if (selectedSeason === '2024/2025' && selectedLigue === 'Ligue 1' && selectedChampionnat === 'total') {
      if (stats['Paul']) {
        stats['Paul'].matchs += 12;
        stats['Paul'].ga -= 3;
        stats['Paul'].buts_pour += stats['Paul'].ga < 0 ? 0 : -3;
        stats['Paul'].buts_contre += 3;
        stats['Paul'].points += 15;
      }
      if (stats['Adrien']) {
        stats['Adrien'].matchs += 12;
        stats['Adrien'].ga += 7;
        stats['Adrien'].buts_pour += 7;
        stats['Adrien'].points += 19;
      }
      if (stats['Tiago']) {
        stats['Tiago'].matchs += 12;
        stats['Tiago'].ga += 6;
        stats['Tiago'].buts_pour += 6;
        stats['Tiago'].points += 22;
      }
      if (stats['Roman']) {
        stats['Roman'].matchs += 12;
        stats['Roman'].ga -= 10;
        stats['Roman'].buts_contre += 10;
        stats['Roman'].points += 15;
      }
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

    return stats;
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
        efficaces: 0
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
      mostGoalsInMatch: null,

      // 2. Le plus gros écart de buts dans une victoire
      biggestWinMargin: null,

      // 5. Le match le plus prolifique
      mostProlificMatch: null,

      // Series records (8-13)
      longestWinStreak: {},
      longestUnbeatenStreak: {},
      longestLossStreak: {},
      longestDrawStreak: {},
      longestGoalDrought: {},
      longestCleanSheetStreak: {},

      // 16-17. Regularity
      mostRegular: null,
      mostUnpredictable: null,

      // New records
      bestWinRatioPeak: null,      // Meilleur ratio de victoires atteint à un moment T
      bestCurrentWinRatio: null,   // Meilleur ratio de victoires actuel (fin de saison)
      bestHeadToHead: null         // Meilleur versus contre un autre joueur
    };

    // Record 1: Most goals scored in a single match
    seasonMatches.forEach(match => {
      [
        { joueur: match.joueur1, buts: match.buts_j1, adversaire: match.joueur2, butsAdv: match.buts_j2 },
        { joueur: match.joueur2, buts: match.buts_j2, adversaire: match.joueur1, butsAdv: match.buts_j1 }
      ].forEach(perf => {
        if (!records.mostGoalsInMatch || perf.buts > records.mostGoalsInMatch.buts) {
          records.mostGoalsInMatch = {
            joueur: perf.joueur,
            buts: perf.buts,
            adversaire: perf.adversaire,
            butsAdv: perf.butsAdv,
            date: match.dateMatch,
            ligue: match.ligue,
            championnat: match.championnat
          };
        }
      });
    });

    // Record 2: Biggest win margin
    seasonMatches.forEach(match => {
      const diff1 = match.buts_j1 - match.buts_j2;
      const diff2 = match.buts_j2 - match.buts_j1;

      if (diff1 > 0 && (!records.biggestWinMargin || diff1 > records.biggestWinMargin.margin)) {
        records.biggestWinMargin = {
          joueur: match.joueur1,
          adversaire: match.joueur2,
          score: `${match.buts_j1}-${match.buts_j2}`,
          margin: diff1,
          date: match.dateMatch,
          ligue: match.ligue,
          championnat: match.championnat
        };
      }

      if (diff2 > 0 && (!records.biggestWinMargin || diff2 > records.biggestWinMargin.margin)) {
        records.biggestWinMargin = {
          joueur: match.joueur2,
          adversaire: match.joueur1,
          score: `${match.buts_j2}-${match.buts_j1}`,
          margin: diff2,
          date: match.dateMatch,
          ligue: match.ligue,
          championnat: match.championnat
        };
      }
    });

    // Record 5: Most prolific match (total goals)
    seasonMatches.forEach(match => {
      const totalGoals = match.buts_j1 + match.buts_j2;
      if (!records.mostProlificMatch || totalGoals > records.mostProlificMatch.totalGoals) {
        records.mostProlificMatch = {
          joueur1: match.joueur1,
          joueur2: match.joueur2,
          score: `${match.buts_j1}-${match.buts_j2}`,
          totalGoals,
          date: match.dateMatch,
          ligue: match.ligue,
          championnat: match.championnat
        };
      }
    });

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
          result: isJ1
            ? (m.buts_j1 > m.buts_j2 ? 'W' : m.buts_j1 < m.buts_j2 ? 'L' : 'D')
            : (m.buts_j2 > m.buts_j1 ? 'W' : m.buts_j2 < m.buts_j1 ? 'L' : 'D'),
          ligue: m.ligue,
          championnat: m.championnat
        };
      });

      // Series 8: Longest win streak
      let currentWins = 0;
      let maxWins = 0;
      let maxWinsEnd = null;
      playerMatches.forEach((match, idx) => {
        if (match.result === 'W') {
          currentWins++;
          if (currentWins > maxWins) {
            maxWins = currentWins;
            maxWinsEnd = idx;
          }
        } else {
          currentWins = 0;
        }
      });
      if (maxWins > 0) {
        records.longestWinStreak[joueur] = {
          length: maxWins,
          endDate: playerMatches[maxWinsEnd]?.date
        };
      }

      // Series 9: Longest unbeaten streak
      let currentUnbeaten = 0;
      let maxUnbeaten = 0;
      let maxUnbeatenEnd = null;
      playerMatches.forEach((match, idx) => {
        if (match.result !== 'L') {
          currentUnbeaten++;
          if (currentUnbeaten > maxUnbeaten) {
            maxUnbeaten = currentUnbeaten;
            maxUnbeatenEnd = idx;
          }
        } else {
          currentUnbeaten = 0;
        }
      });
      if (maxUnbeaten > 0) {
        records.longestUnbeatenStreak[joueur] = {
          length: maxUnbeaten,
          endDate: playerMatches[maxUnbeatenEnd]?.date
        };
      }

      // Series 10: Longest loss streak
      let currentLosses = 0;
      let maxLosses = 0;
      let maxLossesEnd = null;
      playerMatches.forEach((match, idx) => {
        if (match.result === 'L') {
          currentLosses++;
          if (currentLosses > maxLosses) {
            maxLosses = currentLosses;
            maxLossesEnd = idx;
          }
        } else {
          currentLosses = 0;
        }
      });
      if (maxLosses > 0) {
        records.longestLossStreak[joueur] = {
          length: maxLosses,
          endDate: playerMatches[maxLossesEnd]?.date
        };
      }

      // Series 11: Longest draw streak
      let currentDraws = 0;
      let maxDraws = 0;
      let maxDrawsEnd = null;
      playerMatches.forEach((match, idx) => {
        if (match.result === 'D') {
          currentDraws++;
          if (currentDraws > maxDraws) {
            maxDraws = currentDraws;
            maxDrawsEnd = idx;
          }
        } else {
          currentDraws = 0;
        }
      });
      if (maxDraws > 0) {
        records.longestDrawStreak[joueur] = {
          length: maxDraws,
          endDate: playerMatches[maxDrawsEnd]?.date
        };
      }

      // Series 12: Longest goal drought (without scoring)
      let currentDrought = 0;
      let maxDrought = 0;
      let maxDroughtEnd = null;
      playerMatches.forEach((match, idx) => {
        if (match.buts === 0) {
          currentDrought++;
          if (currentDrought > maxDrought) {
            maxDrought = currentDrought;
            maxDroughtEnd = idx;
          }
        } else {
          currentDrought = 0;
        }
      });
      if (maxDrought > 0) {
        records.longestGoalDrought[joueur] = {
          length: maxDrought,
          endDate: playerMatches[maxDroughtEnd]?.date
        };
      }

      // Series 13: Longest clean sheet streak (without conceding)
      let currentCleanSheet = 0;
      let maxCleanSheet = 0;
      let maxCleanSheetEnd = null;
      playerMatches.forEach((match, idx) => {
        if (match.butsAdv === 0) {
          currentCleanSheet++;
          if (currentCleanSheet > maxCleanSheet) {
            maxCleanSheet = currentCleanSheet;
            maxCleanSheetEnd = idx;
          }
        } else {
          currentCleanSheet = 0;
        }
      });
      if (maxCleanSheet > 0) {
        records.longestCleanSheetStreak[joueur] = {
          length: maxCleanSheet,
          endDate: playerMatches[maxCleanSheetEnd]?.date
        };
      }

      // Calculate standard deviation for regularity (16-17)
      if (playerMatches.length > 2) {
        const goalDiffs = playerMatches.map(m => m.buts - m.butsAdv);
        const mean = goalDiffs.reduce((a, b) => a + b, 0) / goalDiffs.length;
        const squaredDiffs = goalDiffs.map(x => Math.pow(x - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / goalDiffs.length;
        const stdDev = Math.sqrt(variance);

        if (!records.mostRegular || stdDev < records.mostRegular.stdDev) {
          records.mostRegular = { joueur, stdDev, matchs: playerMatches.length };
        }

        if (!records.mostUnpredictable || stdDev > records.mostUnpredictable.stdDev) {
          records.mostUnpredictable = { joueur, stdDev, matchs: playerMatches.length };
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

        if (bestRatio > 0 && (!records.bestWinRatioPeak || bestRatio > records.bestWinRatioPeak.ratio)) {
          records.bestWinRatioPeak = {
            joueur,
            ratio: bestRatio,
            wins: bestRatioWins,
            totalMatches: bestRatioMatches,
            date: bestRatioDate
          };
        }
      }

      // NEW: Calculate current win ratio (at end of season)
      if (playerMatches.length >= 30) {
        const totalWins = playerMatches.filter(m => m.result === 'W').length;
        const currentRatio = totalWins / playerMatches.length;

        if (!records.bestCurrentWinRatio || currentRatio > records.bestCurrentWinRatio.ratio) {
          records.bestCurrentWinRatio = {
            joueur,
            ratio: currentRatio,
            wins: totalWins,
            totalMatches: playerMatches.length
          };
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

        if (!records.bestHeadToHead || dominanceScore > records.bestHeadToHead.dominanceScore) {
          records.bestHeadToHead = {
            dominant,
            dominated,
            wins: dominantWins,
            losses: dominatedWins,
            draws: h2hMatches.length - dominantWins - dominatedWins,
            totalMatches: h2hMatches.length,
            gaAdvantage,
            winRatio,
            dominanceScore
          };
        }
      });
    });

    return records;
  }, [filteredData, joueurs]);

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
      const championnatsMap = {};
      matchesToUse.forEach(match => {
        const key = `${match.saison}-${match.ligue}-${match.championnat}`;
        if (!championnatsMap[key]) championnatsMap[key] = [];
        championnatsMap[key].push(match);
      });

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

    // Add artificial titles for 2024/2025 season (at the very end)
    if (selectedLigue === 'general' && selectedSeason === '2024/2025' && sortedMatches.length > 0) {
      const lastMatchDate = new Date(sortedMatches[sortedMatches.length - 1].dateMatch);
      championshipBonuses.set('artificial-adrien', {
        endDate: lastMatchDate,
        winner: 'Adrien',
        points: 3
      });
      championshipBonuses.set('artificial-paul', {
        endDate: lastMatchDate,
        winner: 'Paul',
        points: 3
      });
    }

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
  const buteursEvolution = useMemo(() => {
    // Use all matches for the selected season
    const seasonMatches = matchData.filter(m => {
      if (selectedSeason === 'All-Time') return true;
      return m.saison === selectedSeason;
    });

    // Sort matches by date
    const sortedMatches = [...seasonMatches].sort((a, b) =>
      new Date(a.dateMatch) - new Date(b.dateMatch)
    );

    // Calculate cumulative goals over time
    const evolution = [];
    const playerGoals = {};
    joueurs.forEach(j => playerGoals[j] = 0);

    sortedMatches.forEach((match, index) => {
      // Add goals scored in this match
      const goals = {
        [match.joueur1]: match.buts_j1 || 0,
        [match.joueur2]: match.buts_j2 || 0,
        [match.joueur3]: match.buts_j3 || 0,
        [match.joueur4]: match.buts_j4 || 0
      };

      Object.entries(goals).forEach(([joueur, goalsScored]) => {
        if (joueur && joueur !== 'undefined') {
          playerGoals[joueur] = (playerGoals[joueur] || 0) + goalsScored;
        }
      });

      // Record snapshot every few matches
      if (index % Math.max(1, Math.floor(sortedMatches.length / 30)) === 0 || index === sortedMatches.length - 1) {
        const dataPoint = {
          date: new Date(match.dateMatch).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
          matchNumber: index + 1
        };
        joueurs.forEach(j => {
          dataPoint[j] = playerGoals[j] || 0;
        });
        evolution.push(dataPoint);
      }
    });

    return evolution;
  }, [matchData, selectedSeason, joueurs]);

  // Historical evolution for loosers (goals conceded)
  const loosersEvolution = useMemo(() => {
    // Use all matches for the selected season
    const seasonMatches = matchData.filter(m => {
      if (selectedSeason === 'All-Time') return true;
      return m.saison === selectedSeason;
    });

    // Sort matches by date
    const sortedMatches = [...seasonMatches].sort((a, b) =>
      new Date(a.dateMatch) - new Date(b.dateMatch)
    );

    // Calculate cumulative goals conceded over time
    const evolution = [];
    const playerGoalsConceded = {};
    joueurs.forEach(j => playerGoalsConceded[j] = 0);

    sortedMatches.forEach((match, index) => {
      // For each player, add the goals scored by their opponents
      const goalsConceded = {
        [match.joueur1]: (match.buts_j2 || 0) + (match.buts_j3 || 0) + (match.buts_j4 || 0),
        [match.joueur2]: (match.buts_j1 || 0) + (match.buts_j3 || 0) + (match.buts_j4 || 0),
        [match.joueur3]: (match.buts_j1 || 0) + (match.buts_j2 || 0) + (match.buts_j4 || 0),
        [match.joueur4]: (match.buts_j1 || 0) + (match.buts_j2 || 0) + (match.buts_j3 || 0)
      };

      Object.entries(goalsConceded).forEach(([joueur, conceded]) => {
        if (joueur && joueur !== 'undefined') {
          playerGoalsConceded[joueur] = (playerGoalsConceded[joueur] || 0) + conceded;
        }
      });

      // Record snapshot every few matches
      if (index % Math.max(1, Math.floor(sortedMatches.length / 30)) === 0 || index === sortedMatches.length - 1) {
        const dataPoint = {
          date: new Date(match.dateMatch).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
          matchNumber: index + 1
        };
        joueurs.forEach(j => {
          dataPoint[j] = playerGoalsConceded[j] || 0;
        });
        evolution.push(dataPoint);
      }
    });

    return evolution;
  }, [matchData, selectedSeason, joueurs]);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdminAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  // Load post-its from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'postits'), (snapshot) => {
      const postitsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPostIts(postitsData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    });
    return () => unsubscribe();
  }, []);

  // Add post-it
  const handleAddPostIt = async (e) => {
    e.preventDefault();
    if (!newPostItText.trim() || !newPostItAuthor.trim()) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    try {
      const postItRef = doc(collection(db, 'postits'));
      await setDoc(postItRef, {
        id: postItRef.id,
        text: newPostItText,
        author: newPostItAuthor,
        createdAt: Date.now()
      });
      setNewPostItText('');
      setNewPostItAuthor('');
      alert('Post-it ajouté avec succès !');
    } catch (error) {
      console.error('Error adding post-it:', error);
      alert(`Erreur lors de l'ajout du post-it: ${error.message}\n\nVérifiez les règles Firestore pour la collection 'postits'.`);
    }
  };

  // Delete post-it
  const handleDeletePostIt = async (postItId) => {
    if (!confirm('Supprimer ce post-it ?')) return;

    try {
      await deleteDoc(doc(db, 'postits', postItId));
    } catch (error) {
      console.error('Error deleting post-it:', error);
      alert('Erreur lors de la suppression');
    }
  };

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
      setShowDeleteMatchForm(false);
      setShowEditLigueForm(false);
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
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {/* MP3 Player */}
        <button
          onClick={() => {
            if (isPlaying) {
              audioRef.pause();
              setIsPlaying(false);
            } else {
              audioRef.play();
              setIsPlaying(true);
            }
          }}
          className={`px-2 py-2 rounded-lg shadow-md transition-all hover:shadow-lg border ${
            isPlaying
              ? 'bg-blue-600 text-white border-blue-600 animate-pulse'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
          title={isPlaying ? 'Pause' : 'Lecture'}
        >
          <Music className="w-4 h-4" />
        </button>

        {/* Mur d'infos button */}
        <button
          onClick={() => setActiveTab(activeTab === 'infos' ? 'classements' : 'infos')}
          className={`px-1.5 py-1.5 sm:px-3 sm:py-2 rounded-md sm:rounded-lg font-medium shadow-sm sm:shadow-md transition-all inline-flex items-center gap-2 border sm:border-2 ${
            activeTab === 'infos'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
          }`}
        >
          <span className="text-sm sm:text-lg">ℹ️</span>
          <span className="hidden sm:inline text-xs">Infos</span>
        </button>

        {/* Admin button */}
        <button
          onClick={() => setActiveTab(activeTab === 'admin' ? 'classements' : 'admin')}
          className={`px-1.5 py-1.5 sm:px-3 sm:py-2 rounded-md sm:rounded-lg font-medium shadow-sm sm:shadow-md transition-all inline-flex items-center gap-2 border sm:border-2 border-black ${
            activeTab === 'admin'
              ? 'bg-red-600 text-white'
              : 'bg-white text-red-600 hover:bg-red-50'
          }`}
        >
          <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
          <span className="hidden sm:inline text-red-600 text-xs">Admin</span>
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="px-2 py-2 rounded-lg shadow-md transition-all hover:shadow-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-yellow-400 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
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
                  : 'bg-white text-slate-600 hover:bg-slate-50'
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
                onClick={() => setActiveTab('records')}
                className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                  activeTab === 'records'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Records
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
            </div>

            {/* Séparateur */}
            <div className="hidden sm:block w-px bg-slate-300 dark:bg-slate-600 h-10"></div>

            {/* Calculateur MPG - séparé dans l'espace */}
            <button
              onClick={() => setActiveTab('calculateur-mpg')}
              className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base border-2 ${
                activeTab === 'calculateur-mpg'
                  ? 'bg-green-600 text-white shadow-lg border-green-600'
                  : 'bg-white text-green-600 border-green-600 hover:bg-green-50 dark:bg-slate-800 dark:text-green-400 dark:border-green-500'
              }`}
            >
              ⚽ Calculateur MPG
            </button>
          </div>
        )}

        {/* ONGLET CLASSEMENTS */}
        {activeTab === 'classements' && (
          <>
            {/* Onglets de ligue */}
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 mb-6">
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
                <button
                  onClick={() => {
                    setSelectedLigue('general');
                    setSelectedChampionnat('total');
                  }}
                  className={`px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold transition-all text-xs sm:text-base border-2 ${
                    selectedLigue === 'general'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
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
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {ligue}
                  </button>
                ))}
              </div>

              {/* Dropdown championnat */}
              {selectedSeason !== 'All-Time' && selectedLigue !== 'general' && championnatsByLigue[selectedLigue] && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Championnat
                  </label>
                  <select
                    value={selectedChampionnat}
                    onChange={(e) => setSelectedChampionnat(e.target.value)}
                    className="w-full md:w-64 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                <div className="inline-flex rounded-lg border border-slate-300 bg-white">
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
            <div
              className={`rounded-xl shadow-sm overflow-hidden ${
                selectedSeason === '2024/2025' && selectedLigue === 'general'
                  ? 'bg-gradient-to-br from-sky-100 via-white to-sky-50 relative'
                  : 'bg-white'
              }`}
              style={selectedSeason === '2024/2025' && selectedLigue === 'general' ? {
                backgroundImage: 'linear-gradient(to bottom right, rgba(224, 242, 254, 0.6), rgba(255, 255, 255, 0.7), rgba(240, 249, 255, 0.6)), url(https://upload.wikimedia.org/wikipedia/commons/d/d8/Olympique_Marseille_logo.svg)',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '650px 650px'
              } : {}}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 text-xs sm:text-sm">Rang</th>
                      <th className="px-1 py-2 sm:px-6 sm:py-4 text-left font-semibold text-slate-700 text-xs sm:text-sm">Joueur</th>
                      <th className="px-2 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 hidden md:table-cell">Matchs</th>
                      <th className="px-0.5 py-2 sm:px-4 sm:py-4 text-center font-semibold text-slate-700 text-xs sm:text-sm">V</th>
                      <th className="px-0.5 py-2 sm:px-4 sm:py-4 text-center font-semibold text-slate-700 text-xs sm:text-sm">N</th>
                      <th className="px-0.5 py-2 sm:px-4 sm:py-4 text-center font-semibold text-slate-700 text-xs sm:text-sm">D</th>
                      <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 text-xs sm:text-sm">GA</th>
                      {(selectedChampionnat === 'total' || selectedLigue === 'general') && (
                        <>
                          <th className="px-0.5 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 text-xs sm:text-sm">Titres</th>
                          <th className="px-0 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 text-xs sm:text-sm">
                            <span className="hidden sm:inline">Médailles</span>
                            <span className="sm:hidden">Méd.</span>
                          </th>
                        </>
                      )}
                      <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 text-xs sm:text-sm">
                        {selectedLigue === 'general' ? 'Points' : selectedChampionnat === 'total' ? 'Points en match' : 'Points'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {classementParLigue.map((player, index) => (
                      <tr key={player.joueur} className="border-t hover:bg-slate-50 transition-colors">
                        <td className="px-1 py-2 sm:px-6 sm:py-4">
                          <div className="flex items-center gap-0.5 sm:gap-2">
                            {index === 0 && (() => {
                              // Show trophy/medal only if:
                              // 1. Championship is complete (all matches played), OR
                              // 2. It's general ranking for 2024/2025 season
                              const isComplete = selectedLigue !== 'general' && selectedChampionnat !== 'total' && (() => {
                                const ligueKey = `${selectedSeason}-${selectedLigue}-${selectedChampionnat}`;
                                const metadata = ligueMetadata[ligueKey];
                                return metadata && metadata.matchsEntered >= metadata.matchsTotal;
                              })();
                              const isGeneral20242025 = selectedLigue === 'general' && selectedSeason === '2024/2025';

                              if (isComplete || isGeneral20242025) {
                                // Check if it's a medal (< 6 matches) or trophy (6 matches)
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
                            <span className="font-bold text-sm sm:text-lg text-slate-700">{index + 1}</span>
                          </div>
                        </td>
                        <td className="px-1 py-2 sm:px-6 sm:py-4">
                          <div className="flex items-center gap-1 sm:gap-3">
                            <div className={`w-1.5 h-1.5 sm:w-3 sm:h-3 rounded-full ${playerColors[player.joueur] || 'bg-gray-600'}`}></div>
                            <span className="font-semibold text-slate-800 text-xs sm:text-base">{player.joueur}</span>
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
                              <span className="font-semibold text-yellow-600 text-xs sm:text-base">{player.victoiresChampionnat || 0}</span>
                            </td>
                            <td className="px-0 py-2 sm:px-6 sm:py-4 text-center">
                              <span className="font-semibold text-slate-500 text-xs sm:text-base">{player.medaillesChampionnat || 0}</span>
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
            <div className="bg-white rounded-xl shadow-sm p-0 sm:p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-4 px-2 sm:px-0 pt-2 sm:pt-0">Évolution des points au fil du temps</h3>
              {historicalEvolution.length > 0 ? (
                <div className="w-full sm:w-1/2 sm:mx-auto">
                  <ResponsiveContainer width="100%" height={700}>
                    <LineChart data={historicalEvolution} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="date"
                        label={{ value: 'Date des matchs', position: 'insideBottom', offset: -10 }}
                        tick={{ fontSize: 12 }}
                        height={60}
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
                        verticalAlign="bottom"
                        height={50}
                        wrapperStyle={{ paddingTop: '20px' }}
                      />
                      {joueurs.map((joueur) => (
                        <Line
                          key={joueur}
                          type="monotone"
                          dataKey={joueur}
                          stroke={playerColors[joueur] === 'bg-blue-600' ? '#2563eb' :
                                  playerColors[joueur] === 'bg-green-600' ? '#16a34a' :
                                  playerColors[joueur] === 'bg-orange-600' ? '#ea580c' :
                                  playerColors[joueur] === 'bg-purple-600' ? '#9333ea' : '#6b7280'}
                          strokeWidth={3}
                          dot={false}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
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
                <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">{showGoalsDetail.joueur}</h3>
                    <button onClick={() => setShowGoalsDetail(null)} className="text-slate-600 hover:text-slate-800">
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
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-left font-semibold text-slate-700">Joueur</th>
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700">Utilisées</th>
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700">Reçues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {joueurs.map(joueur => (
                          <tr key={joueur} className="border-t hover:bg-slate-50">
                            <td className="px-2 py-2 sm:px-6 sm:py-4">
                              <div className="flex items-center gap-1.5 sm:gap-3">
                                <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${playerColors[joueur] || 'bg-gray-600'}`}></div>
                                <span className="font-semibold text-slate-800">{joueur}</span>
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
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b">
                      <p className="text-xs text-slate-600">Une valise est efficace si elle a été décisive pour obtenir un nul ou une victoire avec 1 but d'écart</p>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-left font-semibold text-slate-700">Rang</th>
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-left font-semibold text-slate-700">Joueur</th>
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700">Valises efficaces</th>
                        </tr>
                      </thead>
                      <tbody>
                        {joueurs
                          .map(j => ({ joueur: j, efficaces: valiseStats[j].efficaces }))
                          .sort((a, b) => b.efficaces - a.efficaces)
                          .map((item, index) => (
                            <tr key={item.joueur} className="border-t hover:bg-slate-50">
                              <td className="px-2 py-2 sm:px-6 sm:py-4">
                                <span className="font-bold text-base sm:text-lg text-slate-700">{index + 1}</span>
                              </td>
                              <td className="px-2 py-2 sm:px-6 sm:py-4">
                                <div className="flex items-center gap-1.5 sm:gap-3">
                                  <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${playerColors[item.joueur] || 'bg-gray-600'}`}></div>
                                  <span className="font-semibold text-slate-800">{item.joueur}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2 sm:px-6 sm:py-4 text-center">
                                <span className="text-base sm:text-xl font-bold text-green-600">{item.efficaces}</span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Liste des matchs */}
            {selectedLigue !== 'general' && selectedChampionnat !== 'total' && matchesListForChampionnat.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
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
                      <div className="mb-4 bg-slate-50 rounded-xl p-4">
                        <p className="text-xs text-slate-600">
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
                    <div key={index} className="flex flex-wrap items-center gap-1.5 sm:gap-4 p-2 sm:p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors text-xs sm:text-base">
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
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Joueur 1</label>
                  <select
                    value={selectedVersusPlayer1}
                    onChange={(e) => setSelectedVersusPlayer1(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {joueurs.filter(j => j !== selectedVersusPlayer2).map(j => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Joueur 2</label>
                  <select
                    value={selectedVersusPlayer2}
                    onChange={(e) => setSelectedVersusPlayer2(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {joueurs.filter(j => j !== selectedVersusPlayer1).map(j => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Ligue</label>
                  <select
                    value={selectedVersusLigue}
                    onChange={(e) => setSelectedVersusLigue(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                <div className="bg-white rounded-xl shadow-sm p-4 sm:p-8 mb-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center flex-1">
                      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full mx-auto mb-3 overflow-hidden border-4 border-blue-500 shadow-lg">
                        <img
                          src={playerImages[selectedVersusPlayer1]}
                          alt={selectedVersusPlayer1}
                          className="w-full h-full object-cover object-center"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.classList.add(playerColors[selectedVersusPlayer1] || 'bg-gray-600');
                          }}
                        />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-800">{selectedVersusPlayer1}</h3>
                    </div>
                    <div className="text-center px-4 md:px-8">
                      <div className="text-4xl sm:text-5xl font-bold text-slate-700">
                        {versusStats.victoires_j1}
                        <span className="text-slate-400 mx-2 sm:mx-3">-</span>
                        {versusStats.victoires_j2}
                      </div>
                      <div className="text-xs sm:text-sm text-slate-600 mt-2">
                        {versusStats.nuls} match{versusStats.nuls > 1 ? 's' : ''} nul{versusStats.nuls > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full mx-auto mb-3 overflow-hidden border-4 border-purple-500 shadow-lg">
                        <img
                          src={playerImages[selectedVersusPlayer2]}
                          alt={selectedVersusPlayer2}
                          className="w-full h-full object-cover object-center"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.classList.add(playerColors[selectedVersusPlayer2] || 'bg-gray-600');
                          }}
                        />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-800">{selectedVersusPlayer2}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 mt-8 pt-8 border-t">
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

                {/* Graphique en camembert des victoires */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 text-center">Répartition des victoires</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: selectedVersusPlayer1, value: versusStats.victoires_j1 },
                          { name: 'Nuls', value: versusStats.nuls },
                          { name: selectedVersusPlayer2, value: versusStats.victoires_j2 }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({name, value, percent}) => value > 0 ? `${name}: ${value} (${(percent * 100).toFixed(0)}%)` : ''}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#3b82f6" />
                        <Cell fill="#94a3b8" />
                        <Cell fill="#9333ea" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Total des confrontations :</strong> {versusStats.matchs} match{versusStats.matchs > 1 ? 's' : ''}
                    {selectedVersusLigue !== 'all' && ` en ${selectedVersusLigue}`}
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
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
            {selectedSeason === 'All-Time' ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <p className="text-slate-600">Section en construction...</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Classement des buteurs */}
                <div className="bg-white rounded-xl shadow-sm p-2 sm:p-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6 px-2 sm:px-0">Classement des buteurs</h2>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-4 text-left font-semibold text-slate-700">Rang</th>
                          <th className="px-6 py-4 text-left font-semibold text-slate-700">Joueur</th>
                          <th className="px-6 py-4 text-center font-semibold text-slate-700">Buts inscrits</th>
                          <th className="px-6 py-4 text-center font-semibold text-slate-700">Matchs</th>
                          <th className="px-6 py-4 text-center font-semibold text-slate-700">Moyenne</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(statsDetaillees)
                          .map(([joueur, data]) => ({ joueur, ...data }))
                          .sort((a, b) => b.buts_pour - a.buts_pour)
                          .map((player, index) => (
                            <tr key={player.joueur} className="border-t hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-bold text-lg text-slate-700">{index + 1}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-3 h-3 rounded-full ${playerColors[player.joueur] || 'bg-gray-600'}`}></div>
                                  <span className="font-semibold text-slate-800">{player.joueur}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-xl font-bold text-green-600">{player.buts_pour}</span>
                              </td>
                              <td className="px-6 py-4 text-center text-slate-700">{player.matchs}</td>
                              <td className="px-6 py-4 text-center">
                                <span className="font-semibold text-blue-600">
                                  {player.matchs > 0 ? (player.buts_pour / player.matchs).toFixed(2) : '0.00'}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Classement des loosers */}
                <div className="bg-white rounded-xl shadow-sm p-2 sm:p-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6 px-2 sm:px-0">Classement des loosers</h2>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-4 text-left font-semibold text-slate-700">Rang</th>
                          <th className="px-6 py-4 text-left font-semibold text-slate-700">Joueur</th>
                          <th className="px-6 py-4 text-center font-semibold text-slate-700">Buts encaissés</th>
                          <th className="px-6 py-4 text-center font-semibold text-slate-700">Matchs</th>
                          <th className="px-6 py-4 text-center font-semibold text-slate-700">Moyenne</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(statsDetaillees)
                          .map(([joueur, data]) => ({ joueur, ...data }))
                          .sort((a, b) => b.buts_contre - a.buts_contre)
                          .map((player, index) => (
                            <tr key={player.joueur} className="border-t hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-bold text-lg text-slate-700">{index + 1}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-3 h-3 rounded-full ${playerColors[player.joueur] || 'bg-gray-600'}`}></div>
                                  <span className="font-semibold text-slate-800">{player.joueur}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-xl font-bold text-red-600">{player.buts_contre}</span>
                              </td>
                              <td className="px-6 py-4 text-center text-slate-700">{player.matchs}</td>
                              <td className="px-6 py-4 text-center">
                                <span className="font-semibold text-orange-600">
                                  {player.matchs > 0 ? (player.buts_contre / player.matchs).toFixed(2) : '0.00'}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ONGLET RECORDS */}
        {activeTab === 'records' && (
          <>
            {selectedSeason === 'All-Time' || !seasonRecords ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <p className="text-slate-600">
                  {selectedSeason === 'All-Time'
                    ? 'Les records ne sont disponibles que pour une saison spécifique'
                    : 'Aucune donnée disponible pour cette saison'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Records individuels */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6">🏆 Records individuels</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Record 1: Plus de buts dans un match */}
                    {seasonRecords.mostGoalsInMatch && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">🎯 Plus de buts marqués dans un match</h3>
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full ${playerColors[seasonRecords.mostGoalsInMatch.joueur]}`}></div>
                          <div>
                            <p className="text-2xl font-bold text-green-700">{seasonRecords.mostGoalsInMatch.buts} buts</p>
                            <p className="text-sm text-slate-600">
                              <strong>{seasonRecords.mostGoalsInMatch.joueur}</strong> contre {seasonRecords.mostGoalsInMatch.adversaire}
                              ({seasonRecords.mostGoalsInMatch.buts}-{seasonRecords.mostGoalsInMatch.butsAdv})
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(seasonRecords.mostGoalsInMatch.date).toLocaleDateString('fr-FR')} • {seasonRecords.mostGoalsInMatch.ligue} {seasonRecords.mostGoalsInMatch.championnat}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Record 2: Plus gros écart */}
                    {seasonRecords.biggestWinMargin && (
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">💪 Plus grosse victoire</h3>
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full ${playerColors[seasonRecords.biggestWinMargin.joueur]}`}></div>
                          <div>
                            <p className="text-2xl font-bold text-blue-700">+{seasonRecords.biggestWinMargin.margin} buts</p>
                            <p className="text-sm text-slate-600">
                              <strong>{seasonRecords.biggestWinMargin.joueur}</strong> {seasonRecords.biggestWinMargin.score} contre {seasonRecords.biggestWinMargin.adversaire}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(seasonRecords.biggestWinMargin.date).toLocaleDateString('fr-FR')} • {seasonRecords.biggestWinMargin.ligue} {seasonRecords.biggestWinMargin.championnat}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* NEW: Meilleur ratio de victoires à un moment T */}
                    {seasonRecords.bestWinRatioPeak && (
                      <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-4 border-2 border-purple-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">📈 Meilleur ratio de victoires atteint</h3>
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full ${playerColors[seasonRecords.bestWinRatioPeak.joueur]}`}></div>
                          <div>
                            <p className="text-2xl font-bold text-purple-700">{(seasonRecords.bestWinRatioPeak.ratio * 100).toFixed(1)}%</p>
                            <p className="text-sm text-slate-600">
                              <strong>{seasonRecords.bestWinRatioPeak.joueur}</strong> ({seasonRecords.bestWinRatioPeak.wins}V sur {seasonRecords.bestWinRatioPeak.totalMatches} matchs)
                            </p>
                            <p className="text-xs text-slate-500">
                              Pic atteint le {new Date(seasonRecords.bestWinRatioPeak.date).toLocaleDateString('fr-FR')} • min 30 matchs
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* NEW: Meilleur ratio de victoires actuel */}
                    {seasonRecords.bestCurrentWinRatio && (
                      <div className="bg-gradient-to-br from-cyan-50 to-sky-50 rounded-lg p-4 border-2 border-cyan-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">📊 Meilleur ratio de victoires actuel</h3>
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full ${playerColors[seasonRecords.bestCurrentWinRatio.joueur]}`}></div>
                          <div>
                            <p className="text-2xl font-bold text-cyan-700">{(seasonRecords.bestCurrentWinRatio.ratio * 100).toFixed(1)}%</p>
                            <p className="text-sm text-slate-600">
                              <strong>{seasonRecords.bestCurrentWinRatio.joueur}</strong> ({seasonRecords.bestCurrentWinRatio.wins}V sur {seasonRecords.bestCurrentWinRatio.totalMatches} matchs)
                            </p>
                            <p className="text-xs text-slate-500">
                              Ratio final sur l'ensemble de la saison
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* NEW: Meilleur versus contre un autre joueur */}
                    {seasonRecords.bestHeadToHead && (
                      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg p-4 border-2 border-amber-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">⚔️ Meilleure domination en face-à-face</h3>
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full ${playerColors[seasonRecords.bestHeadToHead.dominant]}`}></div>
                          <div>
                            <p className="text-2xl font-bold text-amber-700">{seasonRecords.bestHeadToHead.wins}V-{seasonRecords.bestHeadToHead.draws}N-{seasonRecords.bestHeadToHead.losses}D</p>
                            <p className="text-sm text-slate-600">
                              <strong>{seasonRecords.bestHeadToHead.dominant}</strong> vs {seasonRecords.bestHeadToHead.dominated}
                            </p>
                            <p className="text-xs text-slate-500">
                              GA: {seasonRecords.bestHeadToHead.gaAdvantage > 0 ? '+' : ''}{seasonRecords.bestHeadToHead.gaAdvantage} • {(seasonRecords.bestHeadToHead.winRatio * 100).toFixed(0)}% victoires
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Record du match */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6">⚽ Record de match</h2>

                  {seasonRecords.mostProlificMatch && (
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border-2 border-orange-200">
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">🔥 Match le plus prolifique</h3>
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-2xl font-bold text-orange-700">{seasonRecords.mostProlificMatch.totalGoals} buts</p>
                          <p className="text-sm text-slate-600">
                            <strong>{seasonRecords.mostProlificMatch.joueur1}</strong> vs <strong>{seasonRecords.mostProlificMatch.joueur2}</strong>
                            {' '}({seasonRecords.mostProlificMatch.score})
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(seasonRecords.mostProlificMatch.date).toLocaleDateString('fr-FR')} • {seasonRecords.mostProlificMatch.ligue} {seasonRecords.mostProlificMatch.championnat}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Séries */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6">📊 Séries remarquables</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Série de victoires */}
                    {Object.keys(seasonRecords.longestWinStreak).length > 0 && (
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">🏆 Plus longue série de victoires</h3>
                        {Object.entries(seasonRecords.longestWinStreak)
                          .sort((a, b) => b[1].length - a[1].length)
                          .slice(0, 1)
                          .map(([joueur, data]) => (
                            <div key={joueur} className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${playerColors[joueur]}`}></div>
                              <div>
                                <p className="font-bold text-green-700 text-xl">{data.length} victoires</p>
                                <p className="text-sm text-slate-600">{joueur}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Série sans défaite */}
                    {Object.keys(seasonRecords.longestUnbeatenStreak).length > 0 && (
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">🛡️ Plus longue série sans défaite</h3>
                        {Object.entries(seasonRecords.longestUnbeatenStreak)
                          .sort((a, b) => b[1].length - a[1].length)
                          .slice(0, 1)
                          .map(([joueur, data]) => (
                            <div key={joueur} className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${playerColors[joueur]}`}></div>
                              <div>
                                <p className="font-bold text-blue-700 text-xl">{data.length} matchs</p>
                                <p className="text-sm text-slate-600">{joueur}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Série de défaites */}
                    {Object.keys(seasonRecords.longestLossStreak).length > 0 && (
                      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">💔 Plus longue série de défaites</h3>
                        {Object.entries(seasonRecords.longestLossStreak)
                          .sort((a, b) => b[1].length - a[1].length)
                          .slice(0, 1)
                          .map(([joueur, data]) => (
                            <div key={joueur} className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${playerColors[joueur]}`}></div>
                              <div>
                                <p className="font-bold text-red-700 text-xl">{data.length} défaites</p>
                                <p className="text-sm text-slate-600">{joueur}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Série de nuls */}
                    {Object.keys(seasonRecords.longestDrawStreak).length > 0 && (
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">🤝 Plus longue série de nuls</h3>
                        {Object.entries(seasonRecords.longestDrawStreak)
                          .sort((a, b) => b[1].length - a[1].length)
                          .slice(0, 1)
                          .map(([joueur, data]) => (
                            <div key={joueur} className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${playerColors[joueur]}`}></div>
                              <div>
                                <p className="font-bold text-slate-700 text-xl">{data.length} nuls</p>
                                <p className="text-sm text-slate-600">{joueur}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Série sans marquer */}
                    {Object.keys(seasonRecords.longestGoalDrought).length > 0 && (
                      <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">🚫 Plus longue disette offensive</h3>
                        {Object.entries(seasonRecords.longestGoalDrought)
                          .sort((a, b) => b[1].length - a[1].length)
                          .slice(0, 1)
                          .map(([joueur, data]) => (
                            <div key={joueur} className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${playerColors[joueur]}`}></div>
                              <div>
                                <p className="font-bold text-amber-700 text-xl">{data.length} matchs</p>
                                <p className="text-sm text-slate-600">{joueur}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Série sans encaisser */}
                    {Object.keys(seasonRecords.longestCleanSheetStreak).length > 0 && (
                      <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">🧤 Plus longue série sans encaisser</h3>
                        {Object.entries(seasonRecords.longestCleanSheetStreak)
                          .sort((a, b) => b[1].length - a[1].length)
                          .slice(0, 1)
                          .map(([joueur, data]) => (
                            <div key={joueur} className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${playerColors[joueur]}`}></div>
                              <div>
                                <p className="font-bold text-teal-700 text-xl">{data.length} matchs</p>
                                <p className="text-sm text-slate-600">{joueur}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Régularité */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6">📈 Régularité</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Plus régulier */}
                    {seasonRecords.mostRegular && (
                      <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-4 border-2 border-purple-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">📊 Joueur le plus régulier</h3>
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full ${playerColors[seasonRecords.mostRegular.joueur]}`}></div>
                          <div>
                            <p className="text-2xl font-bold text-purple-700">{seasonRecords.mostRegular.joueur}</p>
                            <p className="text-xs text-slate-500">
                              Écart-type: {seasonRecords.mostRegular.stdDev.toFixed(2)} • {seasonRecords.mostRegular.matchs} matchs
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Plus imprévisible */}
                    {seasonRecords.mostUnpredictable && (
                      <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-lg p-4 border-2 border-pink-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">🎲 Joueur le plus imprévisible</h3>
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full ${playerColors[seasonRecords.mostUnpredictable.joueur]}`}></div>
                          <div>
                            <p className="text-2xl font-bold text-pink-700">{seasonRecords.mostUnpredictable.joueur}</p>
                            <p className="text-xs text-slate-500">
                              Écart-type: {seasonRecords.mostUnpredictable.stdDev.toFixed(2)} • {seasonRecords.mostUnpredictable.matchs} matchs
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ONGLET FORME */}
        {activeTab === 'stats-avancees' && (
          <>
            {selectedSeason === 'All-Time' ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <p className="text-slate-600">Section en construction...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header with common info */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800">Forme récente</h2>
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
                      <div key={joueur} className="bg-white rounded-xl shadow-sm p-6">
                        {/* Player header */}
                        <div className="flex items-center gap-4 mb-6 pb-4 border-b">
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
                            <h3 className="text-xl font-bold text-slate-800">{joueur}</h3>
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
            )}
          </>
        )}

        {/* ONGLET INFOS */}
        {activeTab === 'infos' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">📝 Post-its collaboratifs</h2>

              {/* Add new post-it form */}
              <form onSubmit={handleAddPostIt} className="mb-8 bg-yellow-50 rounded-lg p-4 border-2 border-yellow-200 max-w-xl mx-auto">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Ajouter un post-it</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newPostItAuthor}
                    onChange={(e) => setNewPostItAuthor(e.target.value)}
                    placeholder="Votre nom..."
                    className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <textarea
                    value={newPostItText}
                    onChange={(e) => setNewPostItText(e.target.value)}
                    placeholder="Écrivez votre message..."
                    rows="3"
                    className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-yellow-400 text-slate-800 rounded-lg font-medium hover:bg-yellow-500 transition-colors"
                  >
                    Ajouter
                  </button>
                </div>
              </form>

              {/* Post-its grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {postIts.map((postIt) => (
                  <div
                    key={postIt.id}
                    className="bg-yellow-100 rounded-lg p-4 shadow-md border-l-4 border-yellow-400 relative hover:shadow-lg transition-shadow"
                  >
                    <button
                      onClick={() => handleDeletePostIt(postIt.id)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center justify-center text-xs font-bold"
                    >
                      ×
                    </button>
                    <p className="text-slate-800 mb-3 pr-6 whitespace-pre-wrap break-words">{postIt.text}</p>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-semibold">— {postIt.author}</span>
                      {postIt.createdAt && (
                        <span>{new Date(postIt.createdAt).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>
                  </div>
                ))}
                {postIts.length === 0 && (
                  <div className="col-span-full text-center py-12 text-slate-500">
                    <p className="text-lg">Aucun post-it pour le moment.</p>
                    <p className="text-sm mt-2">Soyez le premier à en ajouter un ! 📌</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ONGLET CALCULATEUR MPG */}
        {activeTab === 'calculateur-mpg' && (
          <div className="space-y-6">
            {/* En-tête */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-sm p-6 text-white">
              <h2 className="text-2xl font-bold mb-2">⚽ Calculateur d'Indice de Performance MPG</h2>
              <p className="text-green-100">Calculez et comparez les indices de performance de vos joueurs MonPetitGazon pour préparer vos mercatos</p>
            </div>

            {/* Formulaire */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Ajouter un joueur</h3>

              <form onSubmit={(e) => {
                e.preventDefault();

                // Validation
                if (!mpgForm.nomJoueur || !mpgForm.noteMoyenne || !mpgForm.titularisation || !mpgForm.buts || !mpgForm.matchsJoues) {
                  alert('Veuillez remplir tous les champs');
                  return;
                }

                // Calcul de l'indice
                const note = parseFloat(mpgForm.noteMoyenne);
                const titu = parseFloat(mpgForm.titularisation);
                const buts = parseInt(mpgForm.buts);
                const matchs = parseInt(mpgForm.matchsJoues);
                const poste = mpgForm.poste;

                // Coefficients par poste pour les buts (pondération inversée : plus rare = plus valorisé)
                const coeffButs = {
                  'G': 5,  // Gardien qui marque = exceptionnel
                  'D': 3,  // Défenseur buteur = très bon
                  'M': 2,  // Milieu buteur = bon
                  'A': 1   // Attaquant = normal
                };

                // Score de base ajusté à l'échelle MPG (note 3-8, avec 5+ = bon, 6+ = excellent, 7+ = exceptionnel)
                // Note 3 = 0, Note 5 = 44, Note 6 = 66, Note 7 = 88
                const scoreBase = (note - 3) * 22;

                // Facteur régularité : uniquement basé sur % titularisation (pas de bonus pour nb matchs)
                // 0% titu = 0.7, 100% titu = 1.0
                const facteurRegularite = 0.7 + (titu / 100 * 0.3);

                // Facteur offensif : ratio buts/matchs effectifs pondéré par poste (impact significatif)
                const matchsEffectifs = Math.max(1, matchs * (titu / 100));
                const ratioButs = buts / matchsEffectifs;
                const facteurOffensif = 1 + (ratioButs * coeffButs[poste] / 3);

                // Calcul final
                const indiceBrut = scoreBase * facteurRegularite * facteurOffensif;

                // Normalisation sur 100
                const indice = Math.min(100, Math.max(0, indiceBrut));

                // Ajouter la carte
                const newCard = {
                  id: Date.now(),
                  ...mpgForm,
                  indice: Math.round(indice)
                };

                setMpgCards([...mpgCards, newCard]);

                // Reset form
                setMpgForm({
                  nomJoueur: '',
                  poste: 'A',
                  noteMoyenne: '',
                  titularisation: '',
                  buts: '',
                  matchsJoues: ''
                });
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Nom du joueur */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Nom du joueur
                    </label>
                    <input
                      type="text"
                      value={mpgForm.nomJoueur}
                      onChange={(e) => setMpgForm({...mpgForm, nomJoueur: e.target.value})}
                      placeholder="ex: Mbappé"
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* Poste */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Poste
                    </label>
                    <select
                      value={mpgForm.poste}
                      onChange={(e) => setMpgForm({...mpgForm, poste: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="G">Gardien (G)</option>
                      <option value="D">Défenseur (D)</option>
                      <option value="M">Milieu (M)</option>
                      <option value="A">Attaquant (A)</option>
                    </select>
                  </div>

                  {/* Note moyenne */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Note moyenne (0-10)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={mpgForm.noteMoyenne}
                      onChange={(e) => setMpgForm({...mpgForm, noteMoyenne: e.target.value})}
                      placeholder="ex: 6.5"
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* Titularisation */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Titularisation (%)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={mpgForm.titularisation}
                      onChange={(e) => setMpgForm({...mpgForm, titularisation: e.target.value})}
                      placeholder="ex: 85"
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* Buts */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Nombre de buts
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={mpgForm.buts}
                      onChange={(e) => setMpgForm({...mpgForm, buts: e.target.value})}
                      placeholder="ex: 12"
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* Matchs joués */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Matchs joués
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={mpgForm.matchsJoues}
                      onChange={(e) => setMpgForm({...mpgForm, matchsJoues: e.target.value})}
                      placeholder="ex: 20"
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Ajouter le joueur
                  </button>
                </div>
              </form>
            </div>

            {/* Cartes de joueurs */}
            {mpgCards.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                    Comparaison ({mpgCards.length} joueur{mpgCards.length > 1 ? 's' : ''})
                  </h3>
                  <button
                    onClick={() => setMpgCards([])}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors text-sm"
                  >
                    Tout effacer
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mpgCards.map((card) => {
                    // Déterminer la couleur selon l'indice
                    let bgColor, borderColor, textColor, badgeText;
                    if (card.indice >= 80) {
                      bgColor = 'from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900';
                      borderColor = 'border-green-300 dark:border-green-600';
                      textColor = 'text-green-700 dark:text-green-300';
                      badgeText = 'Excellent';
                    } else if (card.indice >= 60) {
                      bgColor = 'from-blue-50 to-cyan-50 dark:from-blue-900 dark:to-cyan-900';
                      borderColor = 'border-blue-300 dark:border-blue-600';
                      textColor = 'text-blue-700 dark:text-blue-300';
                      badgeText = 'Très bien';
                    } else if (card.indice >= 40) {
                      bgColor = 'from-yellow-50 to-amber-50 dark:from-yellow-900 dark:to-amber-900';
                      borderColor = 'border-yellow-300 dark:border-yellow-600';
                      textColor = 'text-yellow-700 dark:text-yellow-300';
                      badgeText = 'Correct';
                    } else {
                      bgColor = 'from-red-50 to-orange-50 dark:from-red-900 dark:to-orange-900';
                      borderColor = 'border-red-300 dark:border-red-600';
                      textColor = 'text-red-700 dark:text-red-300';
                      badgeText = 'Faible';
                    }

                    const posteLabels = {
                      'G': 'Gardien',
                      'D': 'Défenseur',
                      'M': 'Milieu',
                      'A': 'Attaquant'
                    };

                    return (
                      <div key={card.id} className={`bg-gradient-to-br ${bgColor} rounded-lg p-5 border-2 ${borderColor} relative`}>
                        {/* Bouton supprimer */}
                        <button
                          onClick={() => setMpgCards(mpgCards.filter(c => c.id !== card.id))}
                          className="absolute top-3 right-3 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                        >
                          ×
                        </button>

                        {/* Nom et poste */}
                        <div className="mb-4">
                          <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{card.nomJoueur}</h4>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${textColor} bg-white dark:bg-slate-800`}>
                            {posteLabels[card.poste]}
                          </span>
                        </div>

                        {/* Indice */}
                        <div className="mb-4">
                          <div className="flex items-end gap-2 mb-2">
                            <span className="text-4xl font-bold text-slate-800 dark:text-white">{card.indice}</span>
                            <span className="text-lg text-slate-600 dark:text-slate-300 mb-1">/100</span>
                          </div>
                          <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${textColor} bg-white dark:bg-slate-800`}>
                            {badgeText}
                          </span>
                        </div>

                        {/* Barre de progression */}
                        <div className="mb-4">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full transition-all ${
                                card.indice >= 80 ? 'bg-green-600' :
                                card.indice >= 60 ? 'bg-blue-600' :
                                card.indice >= 40 ? 'bg-yellow-600' : 'bg-red-600'
                              }`}
                              style={{ width: `${card.indice}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Stats détaillées */}
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-300">Note moyenne:</span>
                            <span className="font-semibold text-slate-800 dark:text-white">{card.noteMoyenne}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-300">Titularisation:</span>
                            <span className="font-semibold text-slate-800 dark:text-white">{card.titularisation}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-300">Buts:</span>
                            <span className="font-semibold text-slate-800 dark:text-white">{card.buts}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-300">Matchs joués:</span>
                            <span className="font-semibold text-slate-800 dark:text-white">{card.matchsJoues}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Explication de l'algorithme */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-3">📊 Comment est calculé l'indice ?</h3>
              <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <div>
                  <p className="font-semibold mb-2">Formule générale :</p>
                  <p className="font-mono bg-white dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-600 text-xs">
                    Indice = Score de base × Facteur régularité × Facteur offensif
                  </p>
                </div>

                <div>
                  <p className="font-semibold mb-2">Échelle MPG (adaptée à la réalité) :</p>
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded border border-amber-200 dark:border-amber-700 text-xs">
                    <p className="mb-2"><strong>Score de base = (Note - 3) × 22</strong></p>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                      <li>Note 7+ = 88 pts (exceptionnel, quasi-inexistant)</li>
                      <li>Note 6+ = 66 pts (excellent)</li>
                      <li>Note 5+ = 44 pts (bon)</li>
                      <li>Note 4 = 22 pts (moyen)</li>
                      <li>Note 3 = 0 pts (faible)</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <p className="font-semibold mb-2">Détail des facteurs :</p>
                  <ul className="space-y-2 pl-2">
                    <li className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-600">
                      <strong>Facteur régularité :</strong>
                      <p className="font-mono text-xs mt-1">0.7 + (% Titularisation / 100 × 0.3)</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        0% titu = 0.7 • 100% titu = 1.0
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Valorise uniquement la régularité de titularisation, PAS le nombre de matchs
                      </p>
                    </li>
                    <li className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-600">
                      <strong>Facteur offensif :</strong>
                      <p className="font-mono text-xs mt-1">1 + (Ratio buts × Coeff poste / 3)</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Ratio buts = Buts / Matchs effectifs
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Matchs effectifs = Matchs × (% Titu / 100)
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Impact significatif : doubler les buts = ~10 points d'indice
                      </p>
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold mb-2">Coefficients par poste :</p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Gardien : ×5 (un but de gardien est exceptionnel)</li>
                    <li>Défenseur : ×3 (défenseur buteur = très bon)</li>
                    <li>Milieu : ×2 (milieu buteur = bon)</li>
                    <li>Attaquant : ×1 (buts = rôle normal)</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold mb-2">Exemples de calcul :</p>
                  <div className="space-y-2">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-700 text-xs">
                      <p className="font-semibold">Attaquant buteur</p>
                      <p>Note 6.2 • 22 matchs • 88% titu • 14 buts</p>
                      <p className="mt-2">• Score base = (6.2 - 3) × 22 = 70.4</p>
                      <p>• Facteur régularité = 0.7 + (0.88 × 0.3) = 0.964</p>
                      <p>• Matchs effectifs = 22 × 0.88 = 19.36</p>
                      <p>• Ratio buts = 14/19.36 = 0.723</p>
                      <p>• Facteur offensif = 1 + (0.723 × 1 / 3) = 1.241</p>
                      <p className="mt-2 font-semibold text-blue-700 dark:text-blue-300">
                        → Indice = 70.4 × 0.964 × 1.241 ≈ 84/100
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-700 text-xs">
                      <p className="font-semibold">Milieu régulier</p>
                      <p>Note 6 • 30 matchs • 80% titu • 8 buts</p>
                      <p className="mt-2">• Score base = (6 - 3) × 22 = 66</p>
                      <p>• Facteur régularité = 0.7 + (0.8 × 0.3) = 0.94</p>
                      <p>• Matchs effectifs = 30 × 0.8 = 24</p>
                      <p>• Ratio buts = 8/24 = 0.333</p>
                      <p>• Facteur offensif = 1 + (0.333 × 2 / 3) = 1.222</p>
                      <p className="mt-2 font-semibold text-green-700 dark:text-green-300">
                        → Indice = 66 × 0.94 × 1.222 ≈ 76/100
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="font-semibold mb-2">Échelle de résultat :</p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li className="text-green-600 dark:text-green-400">80-100 : Excellent</li>
                    <li className="text-blue-600 dark:text-blue-400">60-79 : Très bien</li>
                    <li className="text-yellow-600 dark:text-yellow-400">40-59 : Correct</li>
                    <li className="text-red-600 dark:text-red-400">0-39 : Faible</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
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
                              {championnatsByLigue[adminFormData.ligue]?.map(ch => (
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
