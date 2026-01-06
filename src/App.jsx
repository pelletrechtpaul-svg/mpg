import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie, Cell } from 'recharts';
import { Trophy, Lock, Plus, Trash2, Edit } from 'lucide-react';

const defaultMatchData = [];

const App = () => {
  // Load data from localStorage
  const [matchData, setMatchData] = useState(() => {
    const saved = localStorage.getItem('mpg_match_data');
    return saved ? JSON.parse(saved) : defaultMatchData;
  });

  const [ligueMetadata, setLigueMetadata] = useState(() => {
    const saved = localStorage.getItem('mpg_ligue_metadata');
    return saved ? JSON.parse(saved) : {};
  });

  const [selectedSeason, setSelectedSeason] = useState('2025/2026');
  const [activeTab, setActiveTab] = useState('classements');
  const [selectedLigue, setSelectedLigue] = useState('general');
  const [selectedChampionnat, setSelectedChampionnat] = useState('total');
  const [selectedStatsLigue, setSelectedStatsLigue] = useState('all');

  // Face à face states
  const [selectedVersusPlayer1, setSelectedVersusPlayer1] = useState('Paul');
  const [selectedVersusPlayer2, setSelectedVersusPlayer2] = useState('Adrien');
  const [selectedVersusLigue, setSelectedVersusLigue] = useState('all');

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
    joueur3: '',
    joueur4: '',
    buts_j3: '',
    buts_j4: ''
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('mpg_match_data', JSON.stringify(matchData));
  }, [matchData]);

  useEffect(() => {
    localStorage.setItem('mpg_ligue_metadata', JSON.stringify(ligueMetadata));
  }, [ligueMetadata]);

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
      const key = `${match.ligue}-${match.championnat}`;
      if (!championnatsMap[key]) championnatsMap[key] = [];
      championnatsMap[key].push(match);
    });

    Object.entries(championnatsMap).forEach(([key, matches]) => {
      const stats = calculatePlayerStats(matches, joueurs);
      const ranking = Object.entries(stats)
        .map(([joueur, data]) => ({ joueur, ...data }))
        .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);

      if (ranking.length > 0 && ranking[0].points > 0) {
        victoires[ranking[0].joueur]++;
      }
    });

    return victoires;
  }, [filteredData, joueurs]);

  // Classement général
  const classementGeneral = useMemo(() => {
    const stats = calculatePlayerStats(filteredData, joueurs);

    Object.keys(stats).forEach(joueur => {
      stats[joueur].points += victoiresChampionnat[joueur] * 3;
      stats[joueur].victoiresChampionnat = victoiresChampionnat[joueur];
    });

    return Object.entries(stats)
      .map(([joueur, data]) => ({ joueur, ...data }))
      .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
  }, [filteredData, joueurs, victoiresChampionnat]);

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
      joueurs.forEach(j => ligueVictoires[j] = 0);

      Object.entries(championnatsMap).forEach(([champ, matches]) => {
        const champStats = calculatePlayerStats(matches, joueurs);
        const ranking = Object.entries(champStats)
          .map(([joueur, data]) => ({ joueur, ...data }))
          .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);

        if (ranking.length > 0 && ranking[0].points > 0) {
          ligueVictoires[ranking[0].joueur]++;
        }
      });

      Object.keys(stats).forEach(joueur => {
        stats[joueur].points += ligueVictoires[joueur] * 3;
        stats[joueur].victoiresChampionnat = ligueVictoires[joueur];
      });
    }

    return Object.entries(stats)
      .map(([joueur, data]) => ({ joueur, ...data }))
      .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
  }, [selectedLigue, selectedChampionnat, filteredData, joueurs, classementGeneral]);

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
  const handleAddMatch = (e) => {
    e.preventDefault();

    const { saison, ligue, championnat, isNewChampionnat, newChampionnatMatchs, joueur1, joueur2, buts_j1, buts_j2, joueur3, joueur4, buts_j3, buts_j4 } = adminFormData;

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

      const ligueKey = `${saison}-${ligue}-${championnatToUse}`;
      setLigueMetadata({
        ...ligueMetadata,
        [ligueKey]: {
          createdAt: new Date().toISOString(),
          matchsTotal: newChampionnatMatchs,
          matchsEntered: 0
        }
      });
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
      resultat,
      points_j1,
      points_j2,
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
        resultat: resultat2,
        points_j1: points_j3,
        points_j2: points_j4,
        dateEntree: currentDate
      });
    }

    setMatchData([...matchData, ...newMatches]);

    // Update metadata
    const ligueKey = `${saison}-${ligue}-${championnatToUse}`;
    if (ligueMetadata[ligueKey]) {
      setLigueMetadata({
        ...ligueMetadata,
        [ligueKey]: {
          ...ligueMetadata[ligueKey],
          matchsEntered: ligueMetadata[ligueKey].matchsEntered + newMatches.length,
          lastEntryDate: currentDate
        }
      });
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
      joueur3: '',
      joueur4: '',
      buts_j3: '',
      buts_j4: ''
    });

    alert(`${newMatches.length} match${newMatches.length > 1 ? 's' : ''} ajouté${newMatches.length > 1 ? 's' : ''} avec succès !`);
  };

  // Admin: Delete matches
  const handleDeleteMatches = () => {
    if (matchesToDelete.length === 0) {
      alert('Veuillez sélectionner au moins un match');
      return;
    }

    if (!confirm(`Supprimer ${matchesToDelete.length} match(s) ?`)) {
      return;
    }

    setMatchData(matchData.filter((_, i) => !matchesToDelete.includes(i)));
    setMatchesToDelete([]);
    setShowDeleteMatchForm(false);
    alert('Matchs supprimés !');
  };

  // Admin: Edit match
  const handleEditMatch = (e) => {
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

    const updatedData = [...matchData];
    updatedData[index] = {
      ...updatedData[index],
      joueur1,
      joueur2,
      buts_j1: butsJ1,
      buts_j2: butsJ2,
      resultat,
      points_j1,
      points_j2,
      dateEntree: new Date().toISOString()
    };

    setMatchData(updatedData);
    setShowEditMatchForm(false);
    setEditingMatch(null);
    alert('Match modifié !');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">MonPetitGazon</h1>
          <p className="text-slate-600">Statistiques et performances</p>
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
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                selectedSeason === season && activeTab !== 'admin'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {season}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-6 py-3 rounded-lg font-medium transition-all inline-flex items-center gap-2 ${
              activeTab === 'admin'
                ? 'bg-red-600 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Lock className="w-4 h-4" />
            Admin
          </button>
        </div>

        {/* Sub-navigation */}
        {activeTab !== 'admin' && (
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setActiveTab('classements')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'classements'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Classements
            </button>
            <button
              onClick={() => setActiveTab('statistiques')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'statistiques'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Statistiques
            </button>
            <button
              onClick={() => setActiveTab('versus')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
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
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => {
                    setSelectedLigue('general');
                    setSelectedChampionnat('total');
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
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
                      // Select the most recent championnat (last in the list) by default
                      const championnats = championnatsByLigue[ligue];
                      if (championnats && championnats.length > 0) {
                        setSelectedChampionnat(championnats[championnats.length - 1]);
                      } else {
                        setSelectedChampionnat('total');
                      }
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
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
              {selectedLigue !== 'general' && championnatsByLigue[selectedLigue] && (
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
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Rang</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Joueur</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">Matchs</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">V</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">N</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">D</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">BP</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">BC</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">GA</th>
                      {(selectedChampionnat === 'total' || selectedLigue === 'general') && (
                        <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">Titres</th>
                      )}
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classementParLigue.map((player, index) => (
                      <tr key={player.joueur} className="border-t hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {index === 0 && <Trophy className="w-5 h-5 text-yellow-500" />}
                            <span className="font-bold text-lg text-slate-700">{index + 1}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${playerColors[player.joueur] || 'bg-gray-600'}`}></div>
                            <span className="font-semibold text-slate-800">{player.joueur}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-slate-700">{player.matchs}</td>
                        <td className="px-6 py-4 text-center text-green-600 font-semibold">{player.victoires}</td>
                        <td className="px-6 py-4 text-center text-slate-600">{player.nuls}</td>
                        <td className="px-6 py-4 text-center text-red-600 font-semibold">{player.defaites}</td>
                        <td className="px-6 py-4 text-center text-green-600 font-medium">{player.buts_pour}</td>
                        <td className="px-6 py-4 text-center text-red-600 font-medium">{player.buts_contre}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`font-bold ${player.ga >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {player.ga > 0 ? '+' : ''}{player.ga}
                          </span>
                        </td>
                        {(selectedChampionnat === 'total' || selectedLigue === 'general') && (
                          <td className="px-6 py-4 text-center">
                            <span className="font-semibold text-yellow-600">{player.victoiresChampionnat || 0}</span>
                          </td>
                        )}
                        <td className="px-6 py-4 text-center">
                          <span className="text-xl font-bold text-blue-600">{player.points}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Liste des matchs */}
            {selectedLigue !== 'general' && matchesListForChampionnat.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Matchs {selectedChampionnat !== 'total' ? `du championnat ${selectedChampionnat}` : 'de tous les championnats'}
                </h3>
                <div className="space-y-2">
                  {matchesListForChampionnat.map((match, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <span className="text-slate-600">
                        {new Date(match.dateEntree).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                      <span className="font-medium text-slate-800">{match.joueur1}</span>
                      <span className="text-lg font-bold text-blue-600">{match.buts_j1}</span>
                      <span className="text-slate-400">-</span>
                      <span className="text-lg font-bold text-purple-600">{match.buts_j2}</span>
                      <span className="font-medium text-slate-800">{match.joueur2}</span>
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

            {/* Evolution chart */}
            {selectedChampionnat === 'total' && evolutionData.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Évolution {selectedLigue === 'general' ? 'générale' : selectedLigue}
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="championnat" stroke="#64748b" angle={-45} textAnchor="end" height={100} />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Legend />
                    {joueurs.map(joueur => {
                      const colors = { Paul: '#2563eb', Adrien: '#16a34a', Tiago: '#9333ea', Roman: '#ea580c' };
                      return (
                        <Line
                          key={joueur}
                          type="monotone"
                          dataKey={joueur}
                          stroke={colors[joueur] || '#6b7280'}
                          strokeWidth={3}
                          dot={{ r: 5 }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Légende */}
            <div className="mt-4 bg-blue-50 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                <strong>Système :</strong> Victoire = 3 pts • Nul = 1 pt • Défaite = 0 pt<br />
                <strong>Classement :</strong> Points (puis Goal Average si égalité) • Bonus +3 pts par titre
              </p>
            </div>
          </>
        )}

        {/* ONGLET STATISTIQUES */}
        {activeTab === 'statistiques' && (
          <>
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Ligue</label>
              <select
                value={selectedStatsLigue}
                onChange={(e) => setSelectedStatsLigue(e.target.value)}
                className="w-full md:w-64 px-4 py-2 border border-slate-300 rounded-lg"
              >
                <option value="all">Toutes</option>
                {ligues.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {joueurs.map(joueur => {
                const stats = statsDetaillees[joueur];
                const winRate = stats.matchs > 0 ? ((stats.victoires / stats.matchs) * 100).toFixed(1) : 0;
                return (
                  <div key={joueur} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className={`${playerColors[joueur] || 'bg-gray-600'} p-4`}>
                      <h3 className="text-white font-bold text-lg">{joueur}</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-600 text-sm">Matchs</span>
                        <span className="font-semibold">{stats.matchs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 text-sm">Victoires</span>
                        <span className="font-semibold text-green-600">{stats.victoires}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 text-sm">Buts pour</span>
                        <span className="font-semibold text-green-600">{stats.buts_pour}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 text-sm">Buts contre</span>
                        <span className="font-semibold text-red-600">{stats.buts_contre}</span>
                      </div>
                      <div className="flex justify-between border-t pt-3">
                        <span className="text-slate-600 text-sm">Goal Avg</span>
                        <span className={`font-bold ${stats.ga >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stats.ga > 0 ? '+' : ''}{stats.ga}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 text-sm">% victoires</span>
                        <span className="font-bold text-blue-600">{winRate}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Points</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(statsDetaillees).map(([joueur, stats]) => ({ joueur, points: stats.points }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="joueur" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="points" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Goal Average</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(statsDetaillees).map(([joueur, stats]) => ({ joueur, ga: stats.ga }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="joueur" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="ga" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Comparaison</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={joueurs.map(joueur => ({
                    joueur,
                    'Points': statsDetaillees[joueur].points,
                    'Victoires': statsDetaillees[joueur].victoires,
                    'Buts': statsDetaillees[joueur].buts_pour,
                  }))}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="joueur" stroke="#64748b" />
                    <PolarRadiusAxis stroke="#64748b" />
                    <Radar name="Points" dataKey="Points" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                    <Radar name="Victoires" dataKey="Victoires" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                    <Radar name="Buts" dataKey="Buts" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
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
                <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <div className={`w-20 h-20 ${playerColors[selectedVersusPlayer1] || 'bg-gray-600'} rounded-full mx-auto mb-3`}></div>
                      <h3 className="text-2xl font-bold text-slate-800">{selectedVersusPlayer1}</h3>
                    </div>
                    <div className="text-center px-8">
                      <div className="text-5xl font-bold text-slate-700">
                        {versusStats.victoires_j1}
                        <span className="text-slate-400 mx-3">-</span>
                        {versusStats.victoires_j2}
                      </div>
                      <div className="text-sm text-slate-600 mt-2">
                        {versusStats.nuls} match{versusStats.nuls > 1 ? 's' : ''} nul{versusStats.nuls > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-center flex-1">
                      <div className={`w-20 h-20 ${playerColors[selectedVersusPlayer2] || 'bg-gray-600'} rounded-full mx-auto mb-3`}></div>
                      <h3 className="text-2xl font-bold text-slate-800">{selectedVersusPlayer2}</h3>
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
                              joueur3: '',
                              joueur4: '',
                              buts_j3: '',
                              buts_j4: ''
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
                            <label className="block text-sm font-medium text-slate-700 mb-2">Score du match</label>
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
                            <h4 className="text-md font-semibold text-slate-700 mb-4">Match 2 (optionnel)</h4>
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
                              <label className="block text-sm font-medium text-slate-700 mb-2">Score du match</label>
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
                  <h3 className="font-semibold text-blue-900 mb-2">💾 Sauvegarde automatique</h3>
                  <p className="text-blue-800 text-sm">
                    Toutes les données sont sauvegardées dans votre navigateur (localStorage).
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
