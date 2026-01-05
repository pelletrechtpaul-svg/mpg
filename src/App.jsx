import React, { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Trophy, TrendingUp, Upload } from 'lucide-react';
import Papa from 'papaparse';

// Données d'exemple - à remplacer par vos vraies données
const defaultSampleData = [
  { championnat: 'Ligue 1', edition: '01/09/24-15/10/24', joueur: 'Paul', matchs: 6, buts_pour: 12, buts_contre: 8, ga: 4, points: 78, rang: 2 },
  { championnat: 'Ligue 1', edition: '01/09/24-15/10/24', joueur: 'Adrien', matchs: 6, buts_pour: 10, buts_contre: 9, ga: 1, points: 65, rang: 3 },
  { championnat: 'Ligue 1', edition: '01/09/24-15/10/24', joueur: 'Tiago', matchs: 6, buts_pour: 14, buts_contre: 7, ga: 7, points: 82, rang: 1 },
  { championnat: 'Ligue 1', edition: '01/09/24-15/10/24', joueur: 'Roman', matchs: 6, buts_pour: 9, buts_contre: 11, ga: -2, points: 58, rang: 4 },
  { championnat: 'Ligue 1', edition: '16/10/24-30/11/24', joueur: 'Paul', matchs: 6, buts_pour: 15, buts_contre: 6, ga: 9, points: 85, rang: 1 },
  { championnat: 'Ligue 1', edition: '16/10/24-30/11/24', joueur: 'Adrien', matchs: 6, buts_pour: 11, buts_contre: 10, ga: 1, points: 68, rang: 3 },
  { championnat: 'Ligue 1', edition: '16/10/24-30/11/24', joueur: 'Tiago', matchs: 6, buts_pour: 13, buts_contre: 8, ga: 5, points: 76, rang: 2 },
  { championnat: 'Ligue 1', edition: '16/10/24-30/11/24', joueur: 'Roman', matchs: 6, buts_pour: 8, buts_contre: 12, ga: -4, points: 52, rang: 4 },
  { championnat: 'Premier League', edition: '01/09/24-15/10/24', joueur: 'Paul', matchs: 6, buts_pour: 11, buts_contre: 9, ga: 2, points: 72, rang: 3 },
  { championnat: 'Premier League', edition: '01/09/24-15/10/24', joueur: 'Adrien', matchs: 6, buts_pour: 13, buts_contre: 7, ga: 6, points: 80, rang: 1 },
  { championnat: 'Premier League', edition: '01/09/24-15/10/24', joueur: 'Tiago', matchs: 6, buts_pour: 10, buts_contre: 10, ga: 0, points: 66, rang: 4 },
  { championnat: 'Premier League', edition: '01/09/24-15/10/24', joueur: 'Roman', matchs: 6, buts_pour: 12, buts_contre: 8, ga: 4, points: 75, rang: 2 },
  { championnat: 'Liga', edition: '01/09/24-15/10/24', joueur: 'Paul', matchs: 6, buts_pour: 13, buts_contre: 7, ga: 6, points: 79, rang: 2 },
  { championnat: 'Liga', edition: '01/09/24-15/10/24', joueur: 'Adrien', matchs: 6, buts_pour: 14, buts_contre: 6, ga: 8, points: 84, rang: 1 },
  { championnat: 'Liga', edition: '01/09/24-15/10/24', joueur: 'Tiago', matchs: 6, buts_pour: 11, buts_contre: 9, ga: 2, points: 70, rang: 3 },
  { championnat: 'Liga', edition: '01/09/24-15/10/24', joueur: 'Roman', matchs: 6, buts_pour: 9, buts_contre: 11, ga: -2, points: 62, rang: 4 },
];

const defaultVsData = [
  { joueur1: 'Paul', joueur2: 'Adrien', buts_j1: 24, buts_j2: 19, ga_j1: 5, victoires_j1: 8, victoires_j2: 6, nuls: 2 },
  { joueur1: 'Paul', joueur2: 'Tiago', buts_j1: 22, buts_j2: 26, ga_j1: -4, victoires_j1: 6, victoires_j2: 9, nuls: 1 },
  { joueur1: 'Paul', joueur2: 'Roman', buts_j1: 28, buts_j2: 18, ga_j1: 10, victoires_j1: 10, victoires_j2: 4, nuls: 2 },
  { joueur1: 'Adrien', joueur2: 'Tiago', buts_j1: 20, buts_j2: 23, ga_j1: -3, victoires_j1: 7, victoires_j2: 8, nuls: 1 },
  { joueur1: 'Adrien', joueur2: 'Roman', buts_j1: 25, buts_j2: 17, ga_j1: 8, victoires_j1: 9, victoires_j2: 5, nuls: 2 },
  { joueur1: 'Tiago', joueur2: 'Roman', buts_j1: 27, buts_j2: 16, ga_j1: 11, victoires_j1: 11, victoires_j2: 3, nuls: 2 },
];

const App = () => {
  const [sampleData, setSampleData] = useState(defaultSampleData);
  const [vsData, setVsData] = useState(defaultVsData);
  const [activeTab, setActiveTab] = useState('classements');
  const [selectedChampionnat, setSelectedChampionnat] = useState('general');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedStatsChampionnat, setSelectedStatsChampionnat] = useState('all');
  const [selectedPlayer1, setSelectedPlayer1] = useState('Paul');
  const [selectedPlayer2, setSelectedPlayer2] = useState('Adrien');

  const joueurs = useMemo(() => {
    const uniquePlayers = [...new Set(sampleData.map(d => d.joueur))];
    return uniquePlayers.length > 0 ? uniquePlayers : ['Paul', 'Adrien', 'Tiago', 'Roman'];
  }, [sampleData]);

  const championnats = useMemo(() => {
    const uniqueChampionnats = [...new Set(sampleData.map(d => d.championnat))];
    return uniqueChampionnats.length > 0 ? uniqueChampionnats : ['Ligue 1', 'Premier League', 'Liga', 'Calcio', 'Ligue des Champions'];
  }, [sampleData]);

  const playerColors = {
    Paul: 'bg-blue-600',
    Adrien: 'bg-green-600',
    Tiago: 'bg-purple-600',
    Roman: 'bg-orange-600',
  };

  // Import CSV pour les données principales
  const handleFileUpload = (event, dataType) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (dataType === 'main') {
          setSampleData(results.data);
        } else if (dataType === 'versus') {
          setVsData(results.data);
        }
      },
      error: (error) => {
        alert('Erreur lors de la lecture du fichier: ' + error.message);
      }
    });
  };

  // Export des données en CSV
  const exportToCSV = (data, filename) => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calcul des victoires en championnat (1er de chaque édition)
  const victoiresChampionnat = useMemo(() => {
    const victoires = {};
    joueurs.forEach(j => victoires[j] = 0);

    const editions = [...new Set(sampleData.map(d => `${d.championnat}-${d.edition}`))];
    editions.forEach(ed => {
      const editionData = sampleData.filter(d => `${d.championnat}-${d.edition}` === ed);
      const winner = editionData.find(d => d.rang === 1);
      if (winner) victoires[winner.joueur]++;
    });

    return victoires;
  }, [sampleData, joueurs]);

  // Classement général
  const classementGeneral = useMemo(() => {
    const stats = {};
    joueurs.forEach(joueur => {
      const playerData = sampleData.filter(d => d.joueur === joueur);
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
  }, [sampleData, joueurs, victoiresChampionnat]);

  // Classement par championnat
  const classementParChampionnat = useMemo(() => {
    if (selectedChampionnat === 'general') return classementGeneral;

    const stats = {};
    joueurs.forEach(joueur => {
      const playerData = sampleData.filter(d => d.joueur === joueur && d.championnat === selectedChampionnat);

      // Compter les victoires d'édition pour ce championnat
      const editions = [...new Set(playerData.map(d => d.edition))];
      let victoiresEditions = 0;
      editions.forEach(ed => {
        const edData = sampleData.filter(d => d.championnat === selectedChampionnat && d.edition === ed);
        const winner = edData.find(d => d.rang === 1);
        if (winner && winner.joueur === joueur) victoiresEditions++;
      });

      const totalPoints = playerData.reduce((sum, d) => sum + d.points, 0);
      const bonusVictoires = victoiresEditions * 3;

      stats[joueur] = {
        points: totalPoints + bonusVictoires,
        victoires: victoiresEditions,
        matchs: playerData.reduce((sum, d) => sum + d.matchs, 0),
        buts_pour: playerData.reduce((sum, d) => sum + d.buts_pour, 0),
        buts_contre: playerData.reduce((sum, d) => sum + d.buts_contre, 0),
        ga: playerData.reduce((sum, d) => sum + d.ga, 0),
      };
    });

    return Object.entries(stats)
      .map(([joueur, data]) => ({ joueur, ...data }))
      .sort((a, b) => b.points - a.points);
  }, [selectedChampionnat, sampleData, joueurs, classementGeneral]);

  // Stats détaillées pour l'onglet Statistiques
  const statsDetaillees = useMemo(() => {
    const filteredData = selectedStatsChampionnat === 'all'
      ? sampleData
      : sampleData.filter(d => d.championnat === selectedStatsChampionnat);

    const stats = {};
    joueurs.forEach(joueur => {
      const playerData = filteredData.filter(d => d.joueur === joueur);
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
  }, [selectedStatsChampionnat, sampleData, joueurs]);

  // Face à face
  const currentVersus = useMemo(() => {
    return vsData.find(vs =>
      (vs.joueur1 === selectedPlayer1 && vs.joueur2 === selectedPlayer2) ||
      (vs.joueur1 === selectedPlayer2 && vs.joueur2 === selectedPlayer1)
    );
  }, [selectedPlayer1, selectedPlayer2, vsData]);

  const isReversed = currentVersus && currentVersus.joueur1 === selectedPlayer2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">MonPetitGazon</h1>
          <p className="text-slate-600">Statistiques et performances</p>

          {/* Boutons d'import/export */}
          <div className="mt-4 flex gap-4 flex-wrap">
            <div>
              <label className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium cursor-pointer hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Importer données principales (CSV)
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'main')}
                  className="hidden"
                />
              </label>
            </div>
            <div>
              <label className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium cursor-pointer hover:bg-green-700 transition-colors inline-flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Importer face-à-face (CSV)
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'versus')}
                  className="hidden"
                />
              </label>
            </div>
            <button
              onClick={() => exportToCSV(sampleData, 'donnees_mpg.csv')}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
            >
              Exporter données principales
            </button>
            <button
              onClick={() => exportToCSV(vsData, 'face_a_face_mpg.csv')}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
            >
              Exporter face-à-face
            </button>
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="flex gap-2 mb-6">
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

        {/* ONGLET CLASSEMENTS */}
        {activeTab === 'classements' && (
          <>
            {/* Filtre championnat */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedChampionnat('general')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedChampionnat === 'general'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Général
                </button>
                {championnats.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedChampionnat(c)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      selectedChampionnat === c
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
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
                    {classementParChampionnat.map((player, index) => (
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

            {/* Légende */}
            <div className="mt-4 bg-blue-50 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                <strong>Système de points :</strong> Chaque victoire d'édition (1er place) = +3 points au classement général
              </p>
            </div>
          </>
        )}

        {/* ONGLET STATISTIQUES */}
        {activeTab === 'statistiques' && (
          <>
            {/* Filtre championnat */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Championnat
              </label>
              <select
                value={selectedStatsChampionnat}
                onChange={(e) => setSelectedStatsChampionnat(e.target.value)}
                className="w-full md:w-64 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les championnats</option>
                {championnats.map(c => (
                  <option key={c} value={c}>{c}</option>
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

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">📝 Comment mettre à jour vos données</h3>
          <div className="text-blue-800 text-sm space-y-2">
            <p>
              <strong>Format CSV pour les données principales :</strong> championnat, edition, joueur, matchs, buts_pour, buts_contre, ga, points, rang
            </p>
            <p>
              <strong>Format CSV pour le face-à-face :</strong> joueur1, joueur2, buts_j1, buts_j2, ga_j1, victoires_j1, victoires_j2, nuls
            </p>
            <p className="mt-2">
              Utilisez les boutons "Exporter" pour télécharger un template avec la structure correcte, puis modifiez-le et réimportez-le !
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
