import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie, Cell } from 'recharts';
import { Trophy, Lock, Plus, Trash2, Edit } from 'lucide-react';
import { db } from './firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';

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

  // Admin states
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAddMatchForm, setShowAddMatchForm] = useState(false);
  const [showEditMatchForm, setShowEditMatchForm] = useState(false);
  const [showDeleteMatchForm, setShowDeleteMatchForm] = useState(false);
  const [showEditLigueForm, setShowEditLigueForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [editingLigue, setEditingLigue] = useState(null);
  const [matchesToDelete, setMatchesToDelete] = useState([]);

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
        });

        const unsubscribeMetadata = onSnapshot(collection(db, 'metadata'), (snapshot) => {
          const metadata = {};
          snapshot.docs.forEach(doc => {
            // Decode the Firestore key back to original format
            const originalKey = decodeFirestoreKey(doc.id);
            metadata[originalKey] = doc.data();
          });
          setLigueMetadata(metadata);
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
    const uniqueLigues = [...new Set(filteredData.map(d => d.ligue))];
    return uniqueLigues.length > 0 ? uniqueLigues : ['Ligue 1', 'Premier League', 'Liga', 'Calcio', 'Ligue des Champions'];
  }, [filteredData]);

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

    Object.keys(stats).forEach(joueur => {
      stats[joueur].points += victoiresChampionnat[joueur] * 3;
      stats[joueur].points += medaillesChampionnat[joueur] * 2;
      stats[joueur].victoiresChampionnat = victoiresChampionnat[joueur];
      stats[joueur].medaillesChampionnat = medaillesChampionnat[joueur];
    });

    return Object.entries(stats)
      .map(([joueur, data]) => ({ joueur, ...data }))
      .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
  }, [filteredData, joueurs, victoiresChampionnat, medaillesChampionnat]);

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

      Object.keys(stats).forEach(joueur => {
        stats[joueur].points += ligueVictoires[joueur] * 3;
        stats[joueur].points += ligueMedailles[joueur] * 2;
        stats[joueur].victoiresChampionnat = ligueVictoires[joueur];
        stats[joueur].medaillesChampionnat = ligueMedailles[joueur];
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

    return matches.sort((a, b) => new Date(b.dateEntree) - new Date(a.dateEntree));
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

  // Admin: Login
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassword === 'admin') {
      setIsAdminAuthenticated(true);
      setAdminPassword('');
    } else {
      alert('Code incorrect');
      setAdminPassword('');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setShowAddMatchForm(false);
    setShowEditMatchForm(false);
    setShowDeleteMatchForm(false);
    setShowEditLigueForm(false);
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

    // First match
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

    // Second match (if filled)
    if (hasSecondMatch) {
      const butsJ3 = parseInt(buts_j3);
      const butsJ4 = parseInt(buts_j4);

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

  // Admin: Delete matches
  const handleDeleteMatches = async () => {
    if (matchesToDelete.length === 0) {
      alert('Veuillez sélectionner au moins un match');
      return;
    }

    if (!confirm(`Supprimer ${matchesToDelete.length} match(s) ?`)) {
      return;
    }

    try {
      const batch = writeBatch(db);

      matchesToDelete.forEach(index => {
        const match = matchData[index];
        if (match.firestoreId) {
          const matchRef = doc(db, 'matches', match.firestoreId);
          batch.delete(matchRef);
        }
      });

      await batch.commit();
      setMatchesToDelete([]);
      setShowDeleteMatchForm(false);
      alert('Matchs supprimés !');
    } catch (error) {
      console.error('Error deleting matches:', error);
      alert('Erreur lors de la suppression');
    }
  };

  // Admin: Edit match
  const handleEditMatch = async (e) => {
    e.preventDefault();

    const { index, joueur1, joueur2, buts_j1, buts_j2 } = editingMatch;

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-2">MonPetitGazon</h1>
            <p className="text-slate-600 text-sm sm:text-base">Statistiques et performances</p>
          </div>
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all inline-flex items-center gap-2 border-2 border-black ${
              activeTab === 'admin'
                ? 'bg-red-600 text-white shadow-lg'
                : 'bg-white text-red-600 hover:bg-red-50'
            }`}
          >
            <Lock className="w-4 h-4 text-red-600" />
            <span className="text-red-600">Admin</span>
          </button>
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
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setActiveTab('classements')}
              className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                activeTab === 'classements'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Classements
            </button>
            <button
              onClick={() => setActiveTab('versus')}
              className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                activeTab === 'versus'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Face à face
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
                  className={`px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-base ${
                    selectedLigue === 'general'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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

            {/* Tableau classement */}
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
                      <th className="px-1 py-2 sm:px-6 sm:py-4 text-center font-semibold text-slate-700 text-xs sm:text-sm">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classementParLigue.map((player, index) => (
                      <tr key={player.joueur} className="border-t hover:bg-slate-50 transition-colors">
                        <td className="px-1 py-2 sm:px-6 sm:py-4">
                          <div className="flex items-center gap-0.5 sm:gap-2">
                            {index === 0 && (() => {
                              // Show trophy only if:
                              // 1. Championship is complete (all matches played), OR
                              // 2. It's general ranking for 2024/2025 season
                              const isComplete = selectedLigue !== 'general' && selectedChampionnat !== 'total' && (() => {
                                const ligueKey = `${selectedSeason}-${selectedLigue}-${selectedChampionnat}`;
                                const metadata = ligueMetadata[ligueKey];
                                return metadata && metadata.matchsEntered >= metadata.matchsTotal;
                              })();
                              const isGeneral20242025 = selectedLigue === 'general' && selectedSeason === '2024/2025';
                              return (isComplete || isGeneral20242025) && <Trophy className="w-3 h-3 sm:w-5 sm:h-5 text-yellow-500" />;
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
                          <span className="text-sm sm:text-xl font-bold text-blue-600">{player.points}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

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
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-slate-700 font-medium">Buts pour</span>
                      <span className="text-2xl font-bold text-green-600">{showGoalsDetail.buts_pour}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-slate-700 font-medium">Buts contre</span>
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
                          <th className="px-2 py-2 sm:px-6 sm:py-3 text-center font-semibold text-slate-700">valises efficaces</th>
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
                        <span className="text-xs sm:text-sm">💼</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            {selectedLigue !== 'general' && selectedChampionnat !== 'total' && (() => {
              const ligueKey = `${selectedSeason}-${selectedLigue}-${selectedChampionnat}`;
              const metadata = ligueMetadata[ligueKey];
              if (metadata) {
                return (
                  <div className="mt-4 bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-600">
                      <strong>Créé le :</strong> {new Date(metadata.createdAt).toLocaleDateString('fr-FR')} •
                      <strong className="ml-2">Matchs :</strong> {metadata.matchsEntered}/{metadata.matchsTotal}
                      {metadata.matchsEntered >= metadata.matchsTotal && metadata.lastEntryDate && (
                        <span className="ml-4">
                          <strong>Terminé le :</strong> {new Date(metadata.lastEntryDate).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </p>
                  </div>
                );
              }
              return null;
            })()}
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

                  {!showAddMatchForm && !showEditMatchForm && !showDeleteMatchForm ? (
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
                            onClick={() => setShowEditMatchForm(true)}
                            className="px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 inline-flex items-center gap-2"
                          >
                            <Edit className="w-5 h-5" />
                            Éditer un match
                          </button>
                          <button
                            onClick={() => setShowDeleteMatchForm(true)}
                            className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 inline-flex items-center gap-2"
                          >
                            <Trash2 className="w-5 h-5" />
                            Supprimer
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
                            {['Ligue 1', 'Premier League', 'Liga', 'Calcio', 'Ligue des Champions'].map(ligue => (
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

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Joueur 1</label>
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
                            <label className="block text-sm font-medium text-slate-700 mb-2">Joueur 2</label>
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

                        {adminFormData.joueur1 && adminFormData.joueur2 && (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">1er score</label>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-slate-600 mb-1">Buts {adminFormData.joueur1}</label>
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
                                <label className="block text-xs text-slate-600 mb-1">Buts {adminFormData.joueur2}</label>
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
                            <h4 className="text-md font-semibold text-slate-700 mb-4">2ème score</h4>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Joueur 3</label>
                                <input
                                  type="text"
                                  value={adminFormData.joueur3}
                                  readOnly
                                  className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-100 cursor-not-allowed"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Joueur 4</label>
                                <input
                                  type="text"
                                  value={adminFormData.joueur4}
                                  readOnly
                                  className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-100 cursor-not-allowed"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Score</label>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs text-slate-600 mb-1">Buts {adminFormData.joueur3}</label>
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
                                  <label className="block text-xs text-slate-600 mb-1">Buts {adminFormData.joueur4}</label>
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
                        <h3 className="text-lg font-semibold text-slate-800">Éditer un match</h3>
                        <button
                          onClick={() => {
                            setShowEditMatchForm(false);
                            setEditingMatch(null);
                          }}
                          className="text-slate-600 hover:text-slate-800"
                        >
                          Annuler
                        </button>
                      </div>

                      {!editingMatch ? (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {matchData.map((match, index) => (
                            <button
                              key={index}
                              onClick={() => setEditingMatch({...match, index})}
                              className="w-full p-4 bg-white rounded-lg border hover:border-blue-500 text-left"
                            >
                              <p className="font-semibold text-slate-800">
                                {match.joueur1} {match.buts_j1} - {match.buts_j2} {match.joueur2}
                              </p>
                              <p className="text-sm text-slate-600">
                                {match.saison} • {match.ligue} • {match.championnat} • {new Date(match.dateEntree).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <form onSubmit={handleEditMatch} className="space-y-4">
                          <p className="text-sm text-slate-600">
                            <strong>Match :</strong> {editingMatch.saison} • {editingMatch.ligue} • {editingMatch.championnat}
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Joueur 1</label>
                              <select
                                value={editingMatch.joueur1}
                                onChange={(e) => setEditingMatch({...editingMatch, joueur1: e.target.value})}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                              >
                                {['Paul', 'Adrien', 'Tiago', 'Roman'].filter(j => j !== editingMatch.joueur2).map(j => (
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
                                {['Paul', 'Adrien', 'Tiago', 'Roman'].filter(j => j !== editingMatch.joueur1).map(j => (
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
                          <div className="flex gap-3">
                            <button type="submit" className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                              Enregistrer
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
                  ) : showDeleteMatchForm ? (
                    <div className="bg-slate-50 rounded-lg p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">Supprimer des matchs</h3>
                        <button
                          onClick={() => {
                            setShowDeleteMatchForm(false);
                            setMatchesToDelete([]);
                          }}
                          className="text-slate-600 hover:text-slate-800"
                        >
                          Annuler
                        </button>
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                        {matchData.map((match, index) => (
                          <label key={index} className="flex items-center p-4 bg-white rounded-lg border hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={matchesToDelete.includes(index)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setMatchesToDelete([...matchesToDelete, index]);
                                } else {
                                  setMatchesToDelete(matchesToDelete.filter(i => i !== index));
                                }
                              }}
                              className="w-4 h-4 text-red-600"
                            />
                            <div className="ml-3 flex-1">
                              <p className="font-semibold text-slate-800">
                                {match.joueur1} {match.buts_j1} - {match.buts_j2} {match.joueur2}
                              </p>
                              <p className="text-sm text-slate-600">
                                {match.saison} • {match.ligue} • {match.championnat}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                      {matchesToDelete.length > 0 && (
                        <button
                          onClick={handleDeleteMatches}
                          className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                        >
                          Supprimer {matchesToDelete.length} match(s)
                        </button>
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
