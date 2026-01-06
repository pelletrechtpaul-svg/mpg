import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Trophy, Lock, Plus, Trash2 } from 'lucide-react';

// Données d'exemple - à remplacer par vos vraies données
const defaultMatchData = [];

const App = () => {
  // Load data from localStorage or use defaults
  const [matchData, setMatchData] = useState(() => {
    const saved = localStorage.getItem('mpg_match_data');
    return saved ? JSON.parse(saved) : defaultMatchData;
  });

  // Ligue metadata (creation dates, matchs count, etc.)
  const [ligueMetadata, setLigueMetadata] = useState(() => {
    const saved = localStorage.getItem('mpg_ligue_metadata');
    return saved ? JSON.parse(saved) : {};
  });

  const [selectedSeason, setSelectedSeason] = useState('2025/2026');
  const [activeTab, setActiveTab] = useState('classements');
  const [selectedLigue, setSelectedLigue] = useState('general');
  const [selectedChampionnat, setSelectedChampionnat] = useState('total');
  const [selectedStatsLigue, setSelectedStatsLigue] = useState('all');

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

  // Admin form states
  const [adminFormData, setAdminFormData] = useState({
    saison: '2025/2026',
    ligue: '',
    championnat: '',
    isNewChampionnat: false,
    newChampionnatMatchs: 6,
    joueur1: '',
    joueur2: '',
    resultat: ''
  });

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('mpg_match_data', JSON.stringify(matchData));
  }, [matchData]);

  useEffect(() => {
    localStorage.setItem('mpg_ligue_metadata', JSON.stringify(ligueMetadata));
  }, [ligueMetadata]);

  // Filter data by selected season
  const filteredData = useMemo(() => {
    if (selectedSeason === 'All-Time') {
      return matchData;
    }
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

  // Get numbered championnats for each ligue
  const championnatsByLigue = useMemo(() => {
    const championnatsMap = {};
    ligues.forEach(ligue => {
      const championnats = [...new Set(
        filteredData
          .filter(d => d.ligue === ligue)
          .map(d => d.championnat)
      )].sort();
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
    setShowAddMatchForm(false);
    setShowEditMatchForm(false);
    setShowDeleteMatchForm(false);
    setShowEditLigueForm(false);
  };

  // Add new match
  const handleAddMatch = (e) => {
    e.preventDefault();

    const { saison, ligue, championnat, isNewChampionnat, newChampionnatMatchs, joueur1, joueur2, resultat } = adminFormData;

    if (!ligue) {
      alert('Veuillez sélectionner une ligue');
      return;
    }

    if (!joueur1 || !joueur2) {
      alert('Veuillez sélectionner les deux joueurs');
      return;
    }

    if (joueur1 === joueur2) {
      alert('Les deux joueurs doivent être différents');
      return;
    }

    if (!resultat) {
      alert('Veuillez sélectionner le résultat du match');
      return;
    }

    let championnatToUse = championnat;

    // If creating new championnat, auto-increment championnat name
    if (isNewChampionnat) {
      const existingChampionnatsCount = matchData.filter(
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

    // Calculate points based on result
    let points_j1 = 0, points_j2 = 0;
    if (resultat === 'victoire_j1') {
      points_j1 = 3;
      points_j2 = 0;
    } else if (resultat === 'nul') {
      points_j1 = 1;
      points_j2 = 1;
    } else if (resultat === 'victoire_j2') {
      points_j1 = 0;
      points_j2 = 3;
    }

    const currentDate = new Date().toISOString();

    const newMatch = {
      saison,
      ligue,
      championnat: championnatToUse,
      joueur1,
      joueur2,
      resultat,
      points_j1,
      points_j2,
      dateEntree: currentDate
    };

    setMatchData([...matchData, newMatch]);

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

    setShowAddMatchForm(false);

    // Reset form
    setAdminFormData({
      saison: '2025/2026',
      ligue: '',
      championnat: '',
      isNewChampionnat: false,
      newChampionnatMatchs: 6,
      joueur1: '',
      joueur2: '',
      resultat: ''
    });

    alert('Match ajouté avec succès !');
  };

  // Delete selected matches
  const handleDeleteMatches = () => {
    if (matchesToDelete.length === 0) {
      alert('Veuillez sélectionner au moins un match à supprimer');
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${matchesToDelete.length} match(s) ?`)) {
      return;
    }

    const updatedData = matchData.filter((_, index) => !matchesToDelete.includes(index));
    setMatchData(updatedData);
    setMatchesToDelete([]);
    setShowDeleteMatchForm(false);
    alert('Matchs supprimés avec succès !');
  };

  // Calculate player stats for a given set of matches
  const calculatePlayerStats = (matches, joueursList) => {
    const stats = {};

    joueursList.forEach(joueur => {
      stats[joueur] = {
        points: 0,
        matchs: 0,
        victoires: 0,
        nuls: 0,
        defaites: 0
      };
    });

    matches.forEach(match => {
      const { joueur1, joueur2, points_j1, points_j2, resultat } = match;

      if (stats[joueur1]) {
        stats[joueur1].points += points_j1;
        stats[joueur1].matchs += 1;
        if (resultat === 'victoire_j1') stats[joueur1].victoires += 1;
        else if (resultat === 'nul') stats[joueur1].nuls += 1;
        else stats[joueur1].defaites += 1;
      }

      if (stats[joueur2]) {
        stats[joueur2].points += points_j2;
        stats[joueur2].matchs += 1;
        if (resultat === 'victoire_j2') stats[joueur2].victoires += 1;
        else if (resultat === 'nul') stats[joueur2].nuls += 1;
        else stats[joueur2].defaites += 1;
      }
    });

    return stats;
  };

  // Calcul des victoires de championnat (bonus pour classement général)
  const victoiresChampionnat = useMemo(() => {
    const victoires = {};
    joueurs.forEach(j => victoires[j] = 0);

    // Group matches by championnat
    const championnatsMap = {};
    filteredData.forEach(match => {
      const key = `${match.ligue}-${match.championnat}`;
      if (!championnatsMap[key]) championnatsMap[key] = [];
      championnatsMap[key].push(match);
    });

    // For each championnat, find the winner
    Object.entries(championnatsMap).forEach(([key, matches]) => {
      const stats = calculatePlayerStats(matches, joueurs);
      const ranking = Object.entries(stats)
        .map(([joueur, data]) => ({ joueur, ...data }))
        .sort((a, b) => b.points - a.points);

      if (ranking.length > 0 && ranking[0].points > 0) {
        victoires[ranking[0].joueur]++;
      }
    });

    return victoires;
  }, [filteredData, joueurs]);

  // Classement général
  const classementGeneral = useMemo(() => {
    const stats = calculatePlayerStats(filteredData, joueurs);

    // Add championship victory bonus
    Object.keys(stats).forEach(joueur => {
      stats[joueur].points += victoiresChampionnat[joueur] * 3;
      stats[joueur].victoiresChampionnat = victoiresChampionnat[joueur];
    });

    return Object.entries(stats)
      .map(([joueur, data]) => ({ joueur, ...data }))
      .sort((a, b) => b.points - a.points);
  }, [filteredData, joueurs, victoiresChampionnat]);

  // Classement par ligue
  const classementParLigue = useMemo(() => {
    if (selectedLigue === 'general') return classementGeneral;

    // Filter matches by ligue and optionally by championnat
    let matchesToUse = filteredData.filter(m => m.ligue === selectedLigue);

    if (selectedChampionnat !== 'total') {
      matchesToUse = matchesToUse.filter(m => m.championnat === selectedChampionnat);
    }

    const stats = calculatePlayerStats(matchesToUse, joueurs);

    // If viewing total, add championship bonuses for this ligue only
    if (selectedChampionnat === 'total') {
      // Group by championnat in this ligue
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
          .sort((a, b) => b.points - a.points);

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
      .sort((a, b) => b.points - a.points);
  }, [selectedLigue, selectedChampionnat, filteredData, joueurs, classementGeneral]);

  // Stats détaillées
  const statsDetaillees = useMemo(() => {
    const matchesToUse = selectedStatsLigue === 'all'
      ? filteredData
      : filteredData.filter(d => d.ligue === selectedStatsLigue);

    return calculatePlayerStats(matchesToUse, joueurs);
  }, [selectedStatsLigue, filteredData, joueurs]);

  // Evolution chart data
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

    const evolutionByChampionnat = championnats.map(championnat => {
      const dataPoint = { championnat };
      const championnatsUpToNow = championnats.slice(0, championnats.indexOf(championnat) + 1);

      const matchesUpToNow = dataToUse.filter(m => championnatsUpToNow.includes(m.championnat));
      const stats = calculatePlayerStats(matchesUpToNow, joueurs);

      // Count championship victories up to this point
      const victoires = {};
      joueurs.forEach(j => victoires[j] = 0);

      championnatsUpToNow.forEach(ch => {
        const champMatches = dataToUse.filter(m => m.championnat === ch);
        const champStats = calculatePlayerStats(champMatches, joueurs);
        const ranking = Object.entries(champStats)
          .map(([joueur, data]) => ({ joueur, ...data }))
          .sort((a, b) => b.points - a.points);

        if (ranking.length > 0 && ranking[0].points > 0) {
          victoires[ranking[0].joueur]++;
        }
      });

      joueurs.forEach(joueur => {
        dataPoint[joueur] = stats[joueur].points + (victoires[joueur] * 3);
      });

      return dataPoint;
    });

    return evolutionByChampionnat;
  }, [filteredData, joueurs, selectedLigue, selectedChampionnat, championnatsByLigue]);

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
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">Matchs</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">V</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">N</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">D</th>
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
                        <strong>Championnat créé le :</strong> {createdDate} •
                        <strong className="ml-2">Matchs :</strong> {metadata.matchsEntered}/{metadata.matchsTotal}
                        {isComplete && endDate && (
                          <span className="ml-4">
                            <strong>Terminé le :</strong> {endDate}
                          </span>
                        )}
                      </p>
                    </div>
                  );
                }
                return null;
              })()
            )}

            {/* Evolution chart */}
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
                <strong>Système de points :</strong> Victoire = 3 points • Nul = 1 point • Défaite = 0 point<br />
                <strong>Bonus :</strong> Chaque titre de championnat = +3 points au classement général/total
              </p>
            </div>
          </>
        )}

        {/* ONGLET STATISTIQUES */}
        {activeTab === 'statistiques' && (
          <>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {joueurs.map((joueur) => {
                const stats = statsDetaillees[joueur];
                const winRate = stats.matchs > 0 ? ((stats.victoires / stats.matchs) * 100).toFixed(1) : 0;
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
                        <span className="text-slate-600 text-sm">Victoires</span>
                        <span className="font-semibold text-green-600">{stats.victoires}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 text-sm">Nuls</span>
                        <span className="font-semibold text-slate-600">{stats.nuls}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 text-sm">Défaites</span>
                        <span className="font-semibold text-red-600">{stats.defaites}</span>
                      </div>
                      <div className="flex justify-between border-t pt-3">
                        <span className="text-slate-600 text-sm">Taux victoire</span>
                        <span className="font-bold text-blue-600">{winRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 text-sm">Points totaux</span>
                        <span className="font-semibold">{stats.points}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Points totaux</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(statsDetaillees).map(([joueur, stats]) => ({
                    joueur,
                    points: stats.points
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="joueur" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="points" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Victoires</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(statsDetaillees).map(([joueur, stats]) => ({
                    joueur,
                    victoires: stats.victoires
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="joueur" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="victoires" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Comparaison globale</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={joueurs.map(joueur => ({
                    joueur,
                    'Points': statsDetaillees[joueur].points,
                    'Victoires': statsDetaillees[joueur].victoires,
                    'Matchs': statsDetaillees[joueur].matchs,
                  }))}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="joueur" stroke="#64748b" />
                    <PolarRadiusAxis stroke="#64748b" />
                    <Radar name="Points" dataKey="Points" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                    <Radar name="Victoires" dataKey="Victoires" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                    <Radar name="Matchs" dataKey="Matchs" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
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

                  {!showAddMatchForm && !showEditMatchForm && !showDeleteMatchForm && !showEditLigueForm ? (
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowAddMatchForm(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Ajouter un match
                      </button>
                      {matchData.length > 0 && (
                        <>
                          <button
                            onClick={() => setShowEditMatchForm(true)}
                            className="px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
                          >
                            Éditer un match
                          </button>
                          <button
                            onClick={() => setShowDeleteMatchForm(true)}
                            className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors inline-flex items-center gap-2"
                          >
                            <Trash2 className="w-5 h-5" />
                            Supprimer un match
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
                              resultat: ''
                            });
                          }}
                          className="text-slate-600 hover:text-slate-800"
                        >
                          Annuler
                        </button>
                      </div>
                      <form onSubmit={handleAddMatch} className="space-y-6">
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

                        {/* Ligue */}
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
                                        matchData.filter(
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
                                      Nombre de matchs total
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

                        {/* Joueurs */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Joueur 1
                            </label>
                            <select
                              value={adminFormData.joueur1}
                              onChange={(e) => setAdminFormData({...adminFormData, joueur1: e.target.value})}
                              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">Sélectionner...</option>
                              {['Paul', 'Adrien', 'Tiago', 'Roman'].filter(j => j !== adminFormData.joueur2).map(j => (
                                <option key={j} value={j}>{j}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Joueur 2
                            </label>
                            <select
                              value={adminFormData.joueur2}
                              onChange={(e) => setAdminFormData({...adminFormData, joueur2: e.target.value})}
                              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">Sélectionner...</option>
                              {['Paul', 'Adrien', 'Tiago', 'Roman'].filter(j => j !== adminFormData.joueur1).map(j => (
                                <option key={j} value={j}>{j}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Résultat */}
                        {adminFormData.joueur1 && adminFormData.joueur2 && (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Résultat du match
                            </label>
                            <div className="space-y-2">
                              <label className="flex items-center p-3 bg-white rounded-lg border border-slate-200 hover:bg-green-50 cursor-pointer">
                                <input
                                  type="radio"
                                  name="resultat"
                                  value="victoire_j1"
                                  checked={adminFormData.resultat === 'victoire_j1'}
                                  onChange={(e) => setAdminFormData({...adminFormData, resultat: e.target.value})}
                                  className="w-4 h-4 text-green-600 border-slate-300 focus:ring-green-500"
                                />
                                <span className="ml-3 text-sm font-medium">Victoire {adminFormData.joueur1} (3 pts)</span>
                              </label>
                              <label className="flex items-center p-3 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                <input
                                  type="radio"
                                  name="resultat"
                                  value="nul"
                                  checked={adminFormData.resultat === 'nul'}
                                  onChange={(e) => setAdminFormData({...adminFormData, resultat: e.target.value})}
                                  className="w-4 h-4 text-slate-600 border-slate-300 focus:ring-slate-500"
                                />
                                <span className="ml-3 text-sm font-medium">Match nul (1 pt chacun)</span>
                              </label>
                              <label className="flex items-center p-3 bg-white rounded-lg border border-slate-200 hover:bg-green-50 cursor-pointer">
                                <input
                                  type="radio"
                                  name="resultat"
                                  value="victoire_j2"
                                  checked={adminFormData.resultat === 'victoire_j2'}
                                  onChange={(e) => setAdminFormData({...adminFormData, resultat: e.target.value})}
                                  className="w-4 h-4 text-green-600 border-slate-300 focus:ring-green-500"
                                />
                                <span className="ml-3 text-sm font-medium">Victoire {adminFormData.joueur2} (3 pts)</span>
                              </label>
                            </div>
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                        >
                          Enregistrer le match
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="text-center text-slate-600 py-8">
                      Autres fonctionnalités admin à venir...
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
