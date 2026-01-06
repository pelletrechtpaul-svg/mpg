import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Trophy, Lock, Plus, Trash2 } from 'lucide-react';

// Données d'exemple - à remplacer par vos vraies données
const defaultSampleData = [];

const defaultVsData = [];

const App = () => {
  // Load data from localStorage or use defaults
  const [sampleData, setSampleData] = useState(() => {
    const saved = localStorage.getItem('mpg_data');
    return saved ? JSON.parse(saved) : defaultSampleData;
  });
  const [vsData, setVsData] = useState(() => {
    const saved = localStorage.getItem('mpg_vs_data');
    return saved ? JSON.parse(saved) : defaultVsData;
  });

  // Ligue metadata (creation dates, matchs count, etc.)
  const [ligueMetadata, setLigueMetadata] = useState(() => {
    const saved = localStorage.getItem('mpg_ligue_metadata');
    return saved ? JSON.parse(saved) : {};
  });

  const [selectedSeason, setSelectedSeason] = useState('2025/2026');
  const [activeTab, setActiveTab] = useState('classements');
  const [selectedLigue, setSelectedLigue] = useState('general');
  const [selectedChampionnat, setSelectedChampionnat] = useState('total'); // 'total' or championnat string
  const [selectedStatsLigue, setSelectedStatsLigue] = useState('all');
  const [selectedPlayer1, setSelectedPlayer1] = useState('Paul');
  const [selectedPlayer2, setSelectedPlayer2] = useState('Adrien');

  // Admin states
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAddScoreForm, setShowAddScoreForm] = useState(false);
  const [showEditScoreForm, setShowEditScoreForm] = useState(false);
  const [showDeleteScoreForm, setShowDeleteScoreForm] = useState(false);
  const [showEditLigueForm, setShowEditLigueForm] = useState(false);
  const [editingScore, setEditingScore] = useState(null);
  const [editingLigue, setEditingLigue] = useState(null);
  const [scoresToDelete, setScoresToDelete] = useState([]);

  // Admin form states
  const [adminFormData, setAdminFormData] = useState({
    saison: '2025/2026',
    ligue: '',
    championnat: '',
    isNewChampionnat: false,
    newChampionnatMatchs: 6,
    selectedPlayers: [],
    playerScores: {}
  });

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('mpg_data', JSON.stringify(sampleData));
  }, [sampleData]);

  useEffect(() => {
    localStorage.setItem('mpg_vs_data', JSON.stringify(vsData));
  }, [vsData]);

  useEffect(() => {
    localStorage.setItem('mpg_ligue_metadata', JSON.stringify(ligueMetadata));
  }, [ligueMetadata]);

  // Filter data by selected season
  const filteredData = useMemo(() => {
    if (selectedSeason === 'All-Time') {
      return sampleData;
    }
    return sampleData.filter(d => d.saison === selectedSeason);
  }, [sampleData, selectedSeason]);

  const filteredVsData = useMemo(() => {
    if (selectedSeason === 'All-Time') {
      return vsData;
    }
    return vsData.filter(d => d.saison === selectedSeason);
  }, [vsData, selectedSeason]);

  const joueurs = useMemo(() => {
    const uniquePlayers = [...new Set(filteredData.map(d => d.joueur))];
    return uniquePlayers.length > 0 ? uniquePlayers : ['Paul', 'Adrien', 'Tiago', 'Roman'];
  }, [filteredData]);

  const ligues = useMemo(() => {
    const uniqueLigues = [...new Set(filteredData.map(d => d.ligue))];
    return uniqueLigues.length > 0 ? uniqueLigues : ['Ligue 1', 'Premier League', 'Liga', 'Calcio', 'Ligue des Champions'];
  }, [filteredData]);

  // Get numbered championnats for each ligue
  const championnatsByLigue = useMemo(() => {
    const championnatsMap = {};
    ligues.forEach(ligue => {
      const championnats = [...new Set(
        filteredData
          .filter(d => d.ligue === ligue)
          .map(d => d.championnat)
      )].sort(); // Sorted chronologically
      championnatsMap[ligue] = championnats;
    });
    return championnatsMap;
  }, [filteredData, ligues]);

  const playerColors = {
    Paul: 'bg-blue-600',
    Adrien: 'bg-green-600',
    Tiago: 'bg-purple-600',
    Roman: 'bg-orange-600',
  };

  // Admin authentication
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
    setShowAddScoreForm(false);
    setShowEditScoreForm(false);
    setShowDeleteScoreForm(false);
    setShowEditLigueForm(false);
  };

  // Add new score
  const handleAddScore = (e) => {
    e.preventDefault();

    const { saison, ligue, championnat, isNewChampionnat, newChampionnatMatchs, selectedPlayers, playerScores } = adminFormData;

    if (!ligue) {
      alert('Veuillez sélectionner une ligue');
      return;
    }

    if (selectedPlayers.length === 0) {
      alert('Veuillez sélectionner au moins un joueur');
      return;
    }

    let championnatToUse = championnat;

    // If creating new championnat, auto-increment championnat name
    if (isNewChampionnat) {
      // Count existing championnats for this saison/ligue
      const existingChampionnatsCount = sampleData.filter(
        d => d.saison === saison && d.ligue === ligue
      ).reduce((acc, d) => {
        if (!acc.includes(d.championnat)) acc.push(d.championnat);
        return acc;
      }, []).length;

      championnatToUse = `#${existingChampionnatsCount + 1}`;

      // Save ligue metadata
      const ligueKey = `${saison}-${ligue}-${championnatToUse}`;
      const newMetadata = {
        ...ligueMetadata,
        [ligueKey]: {
          createdAt: new Date().toISOString(),
          matchsTotal: newChampionnatMatchs,
          matchsEntered: 0
        }
      };
      setLigueMetadata(newMetadata);
    }

    if (!championnatToUse) {
      alert('Veuillez sélectionner ou créer un championnat');
      return;
    }

    // Validate that all selected players have scores
    for (const player of selectedPlayers) {
      if (!playerScores[player] || playerScores[player].buts_pour === undefined || playerScores[player].buts_contre === undefined) {
        alert(`Veuillez renseigner les buts pour ${player}`);
        return;
      }
    }

    // Calculate points for each player (based on their goals)
    const newScores = selectedPlayers.map(player => {
      const buts_pour = parseInt(playerScores[player].buts_pour);
      const buts_contre = parseInt(playerScores[player].buts_contre);
      const ga = buts_pour - buts_contre;

      // Simple point calculation: buts_pour * 3 + ga
      const points = (buts_pour * 3) + ga;

      return {
        joueur: player,
        buts_pour,
        buts_contre,
        ga,
        points
      };
    });

    // Sort by points to calculate ranks
    const sortedScores = [...newScores].sort((a, b) => b.points - a.points);

    // Assign ranks
    sortedScores.forEach((score, index) => {
      score.rang = index + 1;
    });

    const currentDate = new Date().toISOString();

    // Add all scores to sampleData
    const finalScores = sortedScores.map(score => ({
      saison,
      ligue,
      championnat: championnatToUse,
      matchs: newChampionnatMatchs,
      dateEntree: currentDate,
      ...score
    }));

    setSampleData([...sampleData, ...finalScores]);

    // Update ligue metadata matchs count
    const ligueKey = `${saison}-${ligue}-${championnatToUse}`;
    if (ligueMetadata[ligueKey]) {
      const updatedMetadata = {
        ...ligueMetadata,
        [ligueKey]: {
          ...ligueMetadata[ligueKey],
          matchsEntered: ligueMetadata[ligueKey].matchsEntered + 1,
          lastEntryDate: currentDate
        }
      };
      setLigueMetadata(updatedMetadata);
    }

    setShowAddScoreForm(false);

    // Reset form
    setAdminFormData({
      saison: '2025/2026',
      ligue: '',
      championnat: '',
      isNewChampionnat: false,
      newChampionnatMatchs: 6,
      selectedPlayers: [],
      playerScores: {}
    });

    alert('Scores ajoutés avec succès !');
  };

  // Delete selected scores
  const handleDeleteScores = () => {
    if (scoresToDelete.length === 0) {
      alert('Veuillez sélectionner au moins un score à supprimer');
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${scoresToDelete.length} score(s) ?`)) {
      return;
    }

    const updatedData = sampleData.filter((_, index) => !scoresToDelete.includes(index));
    setSampleData(updatedData);
    setScoresToDelete([]);
    setShowDeleteScoreForm(false);
    alert('Scores supprimés avec succès !');
  };

  // Calcul des victoires en championnat (1er de chaque championnat)
  const victoiresChampionnat = useMemo(() => {
    const victoires = {};
    joueurs.forEach(j => victoires[j] = 0);

    const championnats = [...new Set(filteredData.map(d => `${d.ligue}-${d.championnat}`))];
    championnats.forEach(ch => {
      const championnatData = filteredData.filter(d => `${d.ligue}-${d.championnat}` === ch);
      const winner = championnatData.find(d => d.rang === 1);
      if (winner) victoires[winner.joueur]++;
    });

    return victoires;
  }, [filteredData, joueurs]);

  // Classement général
  const classementGeneral = useMemo(() => {
    const stats = {};
    joueurs.forEach(joueur => {
      const playerData = filteredData.filter(d => d.joueur === joueur);
      const totalPoints = playerData.reduce((sum, d) => sum + d.points, 0);
      const bonusVictoires = victoiresChampionnat[joueur] * 3;

      stats[joueur] = {
        points: totalPoints + bonusVictoires,
        victoires: victoiresChampionnat[joueur],
        matchs: playerData.reduce((sum, d) => sum + d.matchs, 0),
        buts_pour: playerData.reduce((sum, d) => sum + d.buts_pour, 0),
        buts_contre: playerData.reduce((sum, d) => sum + d.buts_contre, 0),
        ga: playerData.reduce((sum, d) => sum + d.ga, 0),
      };
    });

    return Object.entries(stats)
      .map(([joueur, data]) => ({ joueur, ...data }))
      .sort((a, b) => b.points - a.points);
  }, [filteredData, joueurs, victoiresChampionnat]);

  // Classement par ligue
  const classementParLigue = useMemo(() => {
    if (selectedLigue === 'general') return classementGeneral;

    const stats = {};
    joueurs.forEach(joueur => {
      // Filter by ligue and optionally by championnat
      let playerData = filteredData.filter(d => d.joueur === joueur && d.ligue === selectedLigue);

      if (selectedChampionnat !== 'total') {
        playerData = playerData.filter(d => d.championnat === selectedChampionnat);
      }

      // Compter les victoires de championnat pour cette ligue
      const championnats = [...new Set(playerData.map(d => d.championnat))];
      let victoiresChampionnats = 0;
      championnats.forEach(ch => {
        const chData = filteredData.filter(d => d.ligue === selectedLigue && d.championnat === ch);
        const winner = chData.find(d => d.rang === 1);
        if (winner && winner.joueur === joueur) victoiresChampionnats++;
      });

      const totalPoints = playerData.reduce((sum, d) => sum + d.points, 0);
      const bonusVictoires = victoiresChampionnats * 3;

      stats[joueur] = {
        points: totalPoints + bonusVictoires,
        victoires: victoiresChampionnats,
        matchs: playerData.reduce((sum, d) => sum + d.matchs, 0),
        buts_pour: playerData.reduce((sum, d) => sum + d.buts_pour, 0),
        buts_contre: playerData.reduce((sum, d) => sum + d.buts_contre, 0),
        ga: playerData.reduce((sum, d) => sum + d.ga, 0),
      };
    });

    return Object.entries(stats)
      .map(([joueur, data]) => ({ joueur, ...data }))
      .sort((a, b) => b.points - a.points);
  }, [selectedLigue, selectedChampionnat, filteredData, joueurs, classementGeneral]);

  // Stats détaillées pour l'onglet Statistiques
  const statsDetaillees = useMemo(() => {
    const dataForStats = selectedStatsLigue === 'all'
      ? filteredData
      : filteredData.filter(d => d.ligue === selectedStatsLigue);

    const stats = {};
    joueurs.forEach(joueur => {
      const playerData = dataForStats.filter(d => d.joueur === joueur);
      const totalMatchs = playerData.reduce((sum, d) => sum + d.matchs, 0);
      stats[joueur] = {
        matchs: totalMatchs,
        buts_pour: playerData.reduce((sum, d) => sum + d.buts_pour, 0),
        buts_contre: playerData.reduce((sum, d) => sum + d.buts_contre, 0),
        ga: playerData.reduce((sum, d) => sum + d.ga, 0),
        points_moyen: playerData.length > 0 ? Math.round(playerData.reduce((sum, d) => sum + d.points, 0) / playerData.length) : 0,
        buts_par_match: totalMatchs > 0 ? (playerData.reduce((sum, d) => sum + d.buts_pour, 0) / totalMatchs).toFixed(2) : 0,
      };
    });
    return stats;
  }, [selectedStatsLigue, filteredData, joueurs]);

  // Evolution chart data for classement
  const evolutionData = useMemo(() => {
    // Only show evolution chart when viewing total (not a specific championnat)
    if (selectedChampionnat !== 'total') return [];

    // Get all unique championnats sorted chronologically
    let championnats;
    let dataToUse;

    if (selectedLigue === 'general') {
      // For general view, use all championnats
      championnats = [...new Set(filteredData.map(d => d.championnat))].sort();
      dataToUse = filteredData;
    } else {
      // For specific ligue, use only championnats from that ligue
      championnats = championnatsByLigue[selectedLigue] || [];
      dataToUse = filteredData.filter(d => d.ligue === selectedLigue);
    }

    // For each championnat, calculate cumulative points and ranking for each player
    const evolutionByChampionnat = championnats.map(championnat => {
      const dataPoint = { championnat };

      // Calculate cumulative points up to this championnat
      const championnatsUpToNow = championnats.slice(0, championnats.indexOf(championnat) + 1);

      joueurs.forEach(joueur => {
        // Get all data for this player up to current championnat
        const playerDataUpToNow = dataToUse.filter(d =>
          d.joueur === joueur && championnatsUpToNow.includes(d.championnat)
        );

        // Calculate total points including victory bonuses
        const totalPoints = playerDataUpToNow.reduce((sum, d) => sum + d.points, 0);

        // Count victories up to this championnat
        let victories = 0;
        championnatsUpToNow.forEach(ch => {
          const championnatData = dataToUse.filter(d => d.championnat === ch);
          const winner = championnatData.find(d => d.rang === 1);
          if (winner && winner.joueur === joueur) victories++;
        });

        const bonusVictoires = victories * 3;
        dataPoint[joueur] = totalPoints + bonusVictoires;
      });

      return dataPoint;
    });

    return evolutionByChampionnat;
  }, [filteredData, joueurs, selectedLigue, selectedChampionnat, championnatsByLigue]);

  // Face à face
  const currentVersus = useMemo(() => {
    return filteredVsData.find(vs =>
      (vs.joueur1 === selectedPlayer1 && vs.joueur2 === selectedPlayer2) ||
      (vs.joueur1 === selectedPlayer2 && vs.joueur2 === selectedPlayer1)
    );
  }, [selectedPlayer1, selectedPlayer2, filteredVsData]);

  const isReversed = currentVersus && currentVersus.joueur1 === selectedPlayer2;

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
          <button
            onClick={() => {
              setSelectedSeason('2025/2026');
              if (activeTab === 'admin') setActiveTab('classements');
            }}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              selectedSeason === '2025/2026' && activeTab !== 'admin'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            2025/2026
          </button>
          <button
            onClick={() => {
              setSelectedSeason('2024/2025');
              if (activeTab === 'admin') setActiveTab('classements');
            }}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              selectedSeason === '2024/2025' && activeTab !== 'admin'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            2024/2025
          </button>
          <button
            onClick={() => {
              setSelectedSeason('All-Time');
              if (activeTab === 'admin') setActiveTab('classements');
            }}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              selectedSeason === 'All-Time' && activeTab !== 'admin'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            All-Time
          </button>
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

        {/* Sub-navigation (for season views) */}
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
                      setSelectedChampionnat('total');
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

              {/* Menu déroulant pour sélectionner le championnat */}
              {selectedLigue !== 'general' && championnatsByLigue[selectedLigue] && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Championnat
                  </label>
                  <select
                    value={selectedChampionnat}
                    onChange={(e) => setSelectedChampionnat(e.target.value)}
                    className="w-full md:w-64 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="total">Total</option>
                    {championnatsByLigue[selectedLigue].map((championnat, index) => (
                      <option key={championnat} value={championnat}>
                        Championnat {index + 1} ({championnat})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Tableau de classement */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Rang</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Joueur</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">Victoires</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">Matchs</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">Buts</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">GA</th>
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
                        <td className="px-6 py-4 text-center">
                          <span className="font-semibold text-yellow-600">{player.victoires}</span>
                        </td>
                        <td className="px-6 py-4 text-center text-slate-700">{player.matchs}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-green-600 font-medium">{player.buts_pour}</span>
                          <span className="text-slate-400 mx-1">-</span>
                          <span className="text-red-600 font-medium">{player.buts_contre}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`font-bold ${player.ga >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {player.ga > 0 ? '+' : ''}{player.ga}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-xl font-bold text-blue-600">{player.points}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ligue metadata - dates */}
            {selectedLigue !== 'general' && selectedChampionnat !== 'total' && (
              (() => {
                const ligueKey = `${selectedSeason}-${selectedLigue}-${selectedChampionnat}`;
                const metadata = ligueMetadata[ligueKey];
                if (metadata) {
                  const createdDate = new Date(metadata.createdAt).toLocaleDateString('fr-FR');
                  const isComplete = metadata.matchsEntered >= metadata.matchsTotal;
                  const endDate = metadata.lastEntryDate ? new Date(metadata.lastEntryDate).toLocaleDateString('fr-FR') : null;

                  return (
                    <div className="mt-4 bg-slate-50 rounded-xl p-4">
                      <p className="text-xs text-slate-600">
                        <strong>Ligue créée le :</strong> {createdDate}
                        {isComplete && endDate && (
                          <span className="ml-4">
                            <strong>Terminée le :</strong> {endDate}
                          </span>
                        )}
                      </p>
                    </div>
                  );
                }
                return null;
              })()
            )}

            {/* Evolution chart - Only when viewing 'Total' */}
            {selectedChampionnat === 'total' && evolutionData.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Évolution du classement {selectedLigue === 'general' ? 'général' : selectedLigue}
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="championnat"
                      stroke="#64748b"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Legend />
                    {joueurs.map((joueur) => {
                      const colors = {
                        Paul: '#2563eb',
                        Adrien: '#16a34a',
                        Tiago: '#9333ea',
                        Roman: '#ea580c',
                      };
                      return (
                        <Line
                          key={joueur}
                          type="monotone"
                          dataKey={joueur}
                          stroke={colors[joueur] || '#6b7280'}
                          strokeWidth={3}
                          dot={{ r: 5 }}
                          activeDot={{ r: 7 }}
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
                <strong>Système de points :</strong> Chaque victoire de championnat (1er place) = +3 points au classement général
              </p>
            </div>
          </>
        )}

        {/* ONGLET STATISTIQUES */}
        {activeTab === 'statistiques' && (
          <>
            {/* Filtre ligue */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Ligue
              </label>
              <select
                value={selectedStatsLigue}
                onChange={(e) => setSelectedStatsLigue(e.target.value)}
                className="w-full md:w-64 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Toutes les ligues</option>
                {ligues.map(ligue => (
                  <option key={ligue} value={ligue}>{ligue}</option>
                ))}
              </select>
            </div>

            {/* Cartes statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {joueurs.map((joueur) => {
                const stats = statsDetaillees[joueur];
                return (
                  <div key={joueur} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className={`${playerColors[joueur] || 'bg-gray-600'} p-4`}>
                      <h3 className="text-white font-bold text-lg">{joueur}</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-600 text-sm">Matchs joués</span>
                        <span className="font-semibold">{stats.matchs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 text-sm">Buts marqués</span>
                        <span className="font-semibold text-green-600">{stats.buts_pour}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 text-sm">Buts encaissés</span>
                        <span className="font-semibold text-red-600">{stats.buts_contre}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 text-sm">Buts/match</span>
                        <span className="font-semibold text-blue-600">{stats.buts_par_match}</span>
                      </div>
                      <div className="flex justify-between border-t pt-3">
                        <span className="text-slate-600 text-sm">Goal Average</span>
                        <span className={`font-bold ${stats.ga >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stats.ga > 0 ? '+' : ''}{stats.ga}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 text-sm">Points moyen</span>
                        <span className="font-semibold">{stats.points_moyen}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Buts marqués */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Buts marqués</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(statsDetaillees).map(([joueur, stats]) => ({
                    joueur,
                    buts: stats.buts_pour
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="joueur" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="buts" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Goal Average */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Goal Average</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(statsDetaillees).map(([joueur, stats]) => ({
                    joueur,
                    ga: stats.ga
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="joueur" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="ga" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Radar chart */}
              <div className="bg-white rounded-xl shadow-sm p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Comparaison globale</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={joueurs.map(joueur => ({
                    joueur,
                    'Buts': statsDetaillees[joueur].buts_pour,
                    'GA': Math.max(0, statsDetaillees[joueur].ga + 20),
                    'Points': statsDetaillees[joueur].points_moyen,
                  }))}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="joueur" stroke="#64748b" />
                    <PolarRadiusAxis stroke="#64748b" />
                    <Radar name="Buts" dataKey="Buts" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                    <Radar name="GA" dataKey="GA" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                    <Radar name="Points" dataKey="Points" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
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
            {/* Sélection des joueurs */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Joueur 1
                  </label>
                  <select
                    value={selectedPlayer1}
                    onChange={(e) => setSelectedPlayer1(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {joueurs.filter(j => j !== selectedPlayer2).map(j => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Joueur 2
                  </label>
                  <select
                    value={selectedPlayer2}
                    onChange={(e) => setSelectedPlayer2(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {joueurs.filter(j => j !== selectedPlayer1).map(j => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Résultat du face à face */}
            {currentVersus ? (
              <div className="bg-white rounded-xl shadow-sm p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="text-center flex-1">
                    <div className={`w-16 h-16 ${playerColors[selectedPlayer1] || 'bg-gray-600'} rounded-full mx-auto mb-3`}></div>
                    <h3 className="text-2xl font-bold text-slate-800">{selectedPlayer1}</h3>
                  </div>
                  <div className="text-center px-8">
                    <div className="text-4xl font-bold text-slate-700">
                      {isReversed ? currentVersus.victoires_j2 : currentVersus.victoires_j1}
                      <span className="text-slate-400 mx-2">-</span>
                      {isReversed ? currentVersus.victoires_j1 : currentVersus.victoires_j2}
                    </div>
                    <div className="text-sm text-slate-600 mt-2">
                      {currentVersus.nuls} nul{currentVersus.nuls > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-center flex-1">
                    <div className={`w-16 h-16 ${playerColors[selectedPlayer2] || 'bg-gray-600'} rounded-full mx-auto mb-3`}></div>
                    <h3 className="text-2xl font-bold text-slate-800">{selectedPlayer2}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mt-8 pt-8 border-t">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600">
                      {isReversed ? currentVersus.buts_j2 : currentVersus.buts_j1}
                    </div>
                    <div className="text-sm text-slate-600 mt-2">Buts {selectedPlayer1}</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${
                      (isReversed ? currentVersus.ga_j1 * -1 : currentVersus.ga_j1) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(isReversed ? currentVersus.ga_j1 * -1 : currentVersus.ga_j1) > 0 ? '+' : ''}
                      {isReversed ? currentVersus.ga_j1 * -1 : currentVersus.ga_j1}
                    </div>
                    <div className="text-sm text-slate-600 mt-2">Goal Average</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-purple-600">
                      {isReversed ? currentVersus.buts_j1 : currentVersus.buts_j2}
                    </div>
                    <div className="text-sm text-slate-600 mt-2">Buts {selectedPlayer2}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <p className="text-slate-600">Aucune donnée de face-à-face disponible pour ces joueurs.</p>
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
                  <p className="text-slate-600">Entrez le code d'accès</p>
                </div>
                <form onSubmit={handleAdminLogin}>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Code d'accès"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    Se connecter
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">Panel Admin</h2>
                    <button
                      onClick={handleAdminLogout}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
                    >
                      Déconnexion
                    </button>
                  </div>

                  {!showAddScoreForm && !showEditScoreForm && !showDeleteScoreForm && !showEditLigueForm ? (
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowAddScoreForm(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Ajouter un score
                      </button>
                      {sampleData.length > 0 && (
                        <>
                          <button
                            onClick={() => setShowEditScoreForm(true)}
                            className="px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
                          >
                            Éditer un score
                          </button>
                          <button
                            onClick={() => setShowDeleteScoreForm(true)}
                            className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors inline-flex items-center gap-2"
                          >
                            <Trash2 className="w-5 h-5" />
                            Supprimer un score
                          </button>
                          <button
                            onClick={() => setShowEditLigueForm(true)}
                            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                          >
                            Éditer une ligue
                          </button>
                        </>
                      )}
                    </div>
                  ) : showDeleteScoreForm ? (
                    <div className="bg-slate-50 rounded-lg p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">Supprimer des scores</h3>
                        <button
                          onClick={() => {
                            setShowDeleteScoreForm(false);
                            setScoresToDelete([]);
                          }}
                          className="text-slate-600 hover:text-slate-800"
                        >
                          Annuler
                        </button>
                      </div>

                      <div className="space-y-4">
                        <p className="text-sm text-slate-600 mb-4">Sélectionnez les scores à supprimer :</p>
                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {sampleData.map((score, index) => (
                            <label key={index} className="flex items-center p-4 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={scoresToDelete.includes(index)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setScoresToDelete([...scoresToDelete, index]);
                                  } else {
                                    setScoresToDelete(scoresToDelete.filter(i => i !== index));
                                  }
                                }}
                                className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                              />
                              <div className="ml-3 flex-1">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-semibold text-slate-800">{score.joueur}</p>
                                    <p className="text-sm text-slate-600">
                                      {score.saison} - {score.ligue} - {score.championnat}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-blue-600">{score.points} pts</p>
                                    <p className="text-xs text-slate-500">
                                      {score.buts_pour}-{score.buts_contre} (GA: {score.ga})
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>

                        {scoresToDelete.length > 0 && (
                          <button
                            onClick={handleDeleteScores}
                            className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                          >
                            Supprimer {scoresToDelete.length} score(s)
                          </button>
                        )}
                      </div>
                    </div>
                  ) : showEditLigueForm ? (
                    <div className="bg-slate-50 rounded-lg p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">Éditer une ligue</h3>
                        <button
                          onClick={() => {
                            setShowEditLigueForm(false);
                            setEditingLigue(null);
                          }}
                          className="text-slate-600 hover:text-slate-800"
                        >
                          Annuler
                        </button>
                      </div>

                      {!editingLigue ? (
                        <div className="space-y-4">
                          <p className="text-sm text-slate-600 mb-4">Sélectionnez une ligue à modifier :</p>
                          <div className="space-y-2">
                            {Object.keys(ligueMetadata).map((ligueKey) => {
                              const metadata = ligueMetadata[ligueKey];
                              const [saison, ligue, championnat] = ligueKey.split('-');
                              return (
                                <button
                                  key={ligueKey}
                                  onClick={() => setEditingLigue({ ligueKey, ...metadata, saison, ligue, championnat })}
                                  className="w-full p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                                >
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <p className="font-semibold text-slate-800">{ligue} - {championnat}</p>
                                      <p className="text-sm text-slate-600">{saison}</p>
                                    </div>
                                    <div className="text-right text-sm text-slate-600">
                                      <p>Total matchs: {metadata.matchsTotal}</p>
                                      <p>Matchs entrés: {metadata.matchsEntered}</p>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const updatedMetadata = {
                            ...ligueMetadata,
                            [editingLigue.ligueKey]: {
                              createdAt: editingLigue.createdAt,
                              matchsTotal: parseInt(editingLigue.matchsTotal),
                              matchsEntered: editingLigue.matchsEntered,
                              lastEntryDate: editingLigue.lastEntryDate
                            }
                          };
                          setLigueMetadata(updatedMetadata);
                          setShowEditLigueForm(false);
                          setEditingLigue(null);
                          alert('Ligue modifiée avec succès !');
                        }} className="space-y-4">
                          <div>
                            <p className="text-sm text-slate-600 mb-2">
                              <strong>Ligue :</strong> {editingLigue.ligue} - {editingLigue.championnat}
                            </p>
                            <p className="text-sm text-slate-600 mb-4">
                              <strong>Saison :</strong> {editingLigue.saison}
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Nombre total de matchs
                            </label>
                            <input
                              type="number"
                              value={editingLigue.matchsTotal}
                              onChange={(e) => setEditingLigue({...editingLigue, matchsTotal: e.target.value})}
                              min="1"
                              required
                              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>

                          <div className="flex gap-3">
                            <button
                              type="submit"
                              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                            >
                              Enregistrer les modifications
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingLigue(null)}
                              className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
                            >
                              Retour
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : showEditScoreForm ? (
                    <div className="bg-slate-50 rounded-lg p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">Éditer un score</h3>
                        <button
                          onClick={() => {
                            setShowEditScoreForm(false);
                            setEditingScore(null);
                          }}
                          className="text-slate-600 hover:text-slate-800"
                        >
                          Annuler
                        </button>
                      </div>

                      {!editingScore ? (
                        <div className="space-y-4">
                          <p className="text-sm text-slate-600 mb-4">Sélectionnez un score à modifier :</p>
                          <div className="max-h-96 overflow-y-auto space-y-2">
                            {sampleData.map((score, index) => (
                              <button
                                key={index}
                                onClick={() => setEditingScore({...score, index})}
                                className="w-full p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-semibold text-slate-800">{score.joueur}</p>
                                    <p className="text-sm text-slate-600">
                                      {score.saison} - {score.ligue} - {score.championnat}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-blue-600">{score.points} pts</p>
                                    <p className="text-xs text-slate-500">
                                      {score.buts_pour}-{score.buts_contre} (GA: {score.ga})
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const updatedData = [...sampleData];
                          const buts_pour = parseInt(editingScore.buts_pour);
                          const buts_contre = parseInt(editingScore.buts_contre);
                          const ga = buts_pour - buts_contre;
                          const points = (buts_pour * 3) + ga;

                          updatedData[editingScore.index] = {
                            ...editingScore,
                            buts_pour,
                            buts_contre,
                            ga,
                            points,
                            dateEntree: new Date().toISOString()
                          };

                          // Recalculate ranks for this championnat
                          const sameChampionnatScores = updatedData
                            .map((s, i) => ({...s, originalIndex: i}))
                            .filter(s =>
                              s.saison === editingScore.saison &&
                              s.ligue === editingScore.ligue &&
                              s.championnat === editingScore.championnat
                            )
                            .sort((a, b) => b.points - a.points);

                          sameChampionnatScores.forEach((s, rank) => {
                            updatedData[s.originalIndex].rang = rank + 1;
                          });

                          setSampleData(updatedData);
                          setShowEditScoreForm(false);
                          setEditingScore(null);
                          alert('Score modifié avec succès !');
                        }} className="space-y-4">
                          <div>
                            <p className="text-sm text-slate-600 mb-2">
                              <strong>Joueur :</strong> {editingScore.joueur}
                            </p>
                            <p className="text-sm text-slate-600 mb-2">
                              <strong>Ligue :</strong> {editingScore.saison} - {editingScore.ligue} - {editingScore.championnat}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                Buts pour
                              </label>
                              <input
                                type="number"
                                value={editingScore.buts_pour}
                                onChange={(e) => setEditingScore({...editingScore, buts_pour: e.target.value})}
                                min="0"
                                required
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                Buts contre
                              </label>
                              <input
                                type="number"
                                value={editingScore.buts_contre}
                                onChange={(e) => setEditingScore({...editingScore, buts_contre: e.target.value})}
                                min="0"
                                required
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button
                              type="submit"
                              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                            >
                              Enregistrer les modifications
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingScore(null)}
                              className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
                            >
                              Retour
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">Nouveau score</h3>
                        <button
                          onClick={() => {
                            setShowAddScoreForm(false);
                            setAdminFormData({
                              saison: '2025/2026',
                              ligue: '',
                              championnat: '',
                              isNewChampionnat: false,
                              newChampionnatMatchs: 6,
                              selectedPlayers: [],
                              playerScores: {}
                            });
                          }}
                          className="text-slate-600 hover:text-slate-800"
                        >
                          Annuler
                        </button>
                      </div>
                      <form onSubmit={handleAddScore} className="space-y-6">
                        {/* Saison */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Saison
                          </label>
                          <select
                            value={adminFormData.saison}
                            onChange={(e) => setAdminFormData({...adminFormData, saison: e.target.value})}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="2025/2026">2025/2026</option>
                            <option value="2024/2025">2024/2025</option>
                          </select>
                        </div>

                        {/* Ligue - Radio buttons */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Ligue
                          </label>
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
                                  className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-slate-700">{ligue}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Championnat */}
                        {adminFormData.ligue && (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Championnat
                            </label>
                            <div className="space-y-2">
                              {/* Existing championnats */}
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
                                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                                  />
                                  <span className="ml-2 text-sm text-slate-700">{ch}</span>
                                </label>
                              ))}

                              {/* Create new championnat */}
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
                                  className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm font-medium text-blue-600">Créer un nouveau championnat</span>
                              </label>

                              {adminFormData.isNewChampionnat && (
                                <div className="ml-6 space-y-3">
                                  <div className="bg-blue-50 p-3 rounded-lg">
                                    <p className="text-sm text-blue-800">
                                      <strong>Nom du championnat :</strong> #{
                                        sampleData.filter(
                                          d => d.saison === adminFormData.saison && d.ligue === adminFormData.ligue
                                        ).reduce((acc, d) => {
                                          if (!acc.includes(d.championnat)) acc.push(d.championnat);
                                          return acc;
                                        }, []).length + 1
                                      }
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-sm text-slate-700 mb-1">
                                      Nombre de matchs
                                    </label>
                                    <input
                                      type="number"
                                      value={adminFormData.newChampionnatMatchs}
                                      onChange={(e) => setAdminFormData({...adminFormData, newChampionnatMatchs: parseInt(e.target.value)})}
                                      min="1"
                                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Joueurs - Checkboxes */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Joueurs
                          </label>
                          <div className="space-y-2">
                            {['Paul', 'Adrien', 'Tiago', 'Roman'].map(player => (
                              <label key={player} className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={adminFormData.selectedPlayers.includes(player)}
                                  onChange={(e) => {
                                    const selected = e.target.checked
                                      ? [...adminFormData.selectedPlayers, player]
                                      : adminFormData.selectedPlayers.filter(p => p !== player);
                                    setAdminFormData({...adminFormData, selectedPlayers: selected});
                                  }}
                                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-slate-700 font-medium">{player}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Scores for each selected player */}
                        {adminFormData.selectedPlayers.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">
                              Scores des joueurs
                            </label>
                            <div className="space-y-4">
                              {adminFormData.selectedPlayers.map(player => (
                                <div key={player} className="bg-slate-100 p-4 rounded-lg">
                                  <h4 className="font-semibold text-slate-800 mb-3">{player}</h4>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs text-slate-600 mb-1">
                                        Buts pour
                                      </label>
                                      <input
                                        type="number"
                                        value={adminFormData.playerScores[player]?.buts_pour || ''}
                                        onChange={(e) => setAdminFormData({
                                          ...adminFormData,
                                          playerScores: {
                                            ...adminFormData.playerScores,
                                            [player]: {
                                              ...adminFormData.playerScores[player],
                                              buts_pour: e.target.value
                                            }
                                          }
                                        })}
                                        min="0"
                                        placeholder="0"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-slate-600 mb-1">
                                        Buts contre
                                      </label>
                                      <input
                                        type="number"
                                        value={adminFormData.playerScores[player]?.buts_contre || ''}
                                        onChange={(e) => setAdminFormData({
                                          ...adminFormData,
                                          playerScores: {
                                            ...adminFormData.playerScores,
                                            [player]: {
                                              ...adminFormData.playerScores[player],
                                              buts_contre: e.target.value
                                            }
                                          }
                                        })}
                                        min="0"
                                        placeholder="0"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                        >
                          Enregistrer les scores
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 rounded-xl p-6">
                  <h3 className="font-semibold text-blue-900 mb-2">💾 Sauvegarde automatique</h3>
                  <p className="text-blue-800 text-sm">
                    Toutes les données sont automatiquement sauvegardées dans votre navigateur (localStorage).
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
