import React, { useState, lazy, Suspense } from 'react';
import { Lock, SkipBack, SkipForward, Play, Pause } from 'lucide-react';
import { PLAYLIST } from './shared.jsx';
const MercatoTab = lazy(() => import('./components/MercatoTab'));
const JoueursTab = lazy(() => import('./components/JoueursTab'));
const AdvancedStatsTab = lazy(() => import('./components/AdvancedStatsTab'));
const VersusTab = lazy(() => import('./components/VersusTab'));
const RecordsTab = lazy(() => import('./components/RecordsTab'));
const ClassementsTab = lazy(() => import('./components/ClassementsTab'));
const AdminTab = lazy(() => import('./components/AdminTab'));
import { useFirestoreSync } from './hooks/useFirestoreSync';
import { useDarkMode } from './hooks/useDarkMode';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useSeasonData } from './hooks/useSeasonData';
import { useMercatoStats } from './hooks/useMercatoStats';
import { useChampionshipStats } from './hooks/useChampionshipStats';
import { usePlayerStats } from './hooks/usePlayerStats';
import { useEvolutionData } from './hooks/useEvolutionData';
import { useAdvancedStats } from './hooks/useAdvancedStats';
import { useRecords } from './hooks/useRecords';

const App = () => {
  const [selectedSeason, setSelectedSeason] = useState('2025/2026');
  const [activeTab, setActiveTab] = useState('classements');
  const [ligueRecordsMode, setLigueRecordsMode] = useState('alltime');
  const [selectedLigue, setSelectedLigue] = useState('general');
  const [selectedChampionnat, setSelectedChampionnat] = useState('total');
  const [selectedStatsLigue, setSelectedStatsLigue] = useState('all');
  const [selectedVersusPlayer1, setSelectedVersusPlayer1] = useState('Paul');
  const [selectedVersusPlayer2, setSelectedVersusPlayer2] = useState('Adrien');
  const [selectedVersusLigue, setSelectedVersusLigue] = useState('all');
  const [selectedValiseTable, setSelectedValiseTable] = useState('stats');
  const [activeVersusTooltip, setActiveVersusTooltip] = useState(null);

  const { matchData, mercatoData, ligueMetadata, isLoading, isOnline, lastSyncTime, syncError, setSyncError, isAdminAuthenticated } = useFirestoreSync();
  const { darkMode, setDarkMode } = useDarkMode();
  const { isPlaying, currentTrack, playPause, prevTrack, nextTrack } = useAudioPlayer();
  const { filteredData, joueurs, ligues, championnatsByLigue } = useSeasonData(matchData, selectedSeason);
  const mercatoStats = useMercatoStats(mercatoData);
  const { victoiresChampionnat, medaillesChampionnat, victoiresDetail, medaillesDetail, perduUnPoint, classementGeneral, classementParLigue } = useChampionshipStats(filteredData, joueurs, ligueMetadata, selectedSeason, selectedLigue, selectedChampionnat);
  const { statsDetaillees, cleanSheetsStats, scoreDistribution, heureDeGloire, valiseStats, versusStats, versusMatchHistory } = usePlayerStats(filteredData, joueurs, selectedStatsLigue, selectedLigue, selectedChampionnat, ligueMetadata, selectedVersusPlayer1, selectedVersusPlayer2, selectedVersusLigue);
  const { evolutionData, matchesListForChampionnat, historicalEvolution, buteursEvolution, loosersEvolution } = useEvolutionData(filteredData, joueurs, selectedLigue, selectedChampionnat, championnatsByLigue, ligueMetadata, matchData, selectedSeason);
  const advancedStats = useAdvancedStats(matchData, joueurs, selectedSeason);
  const { seasonRecords, ligueRecordsAllTime, ligueRecordsSeason } = useRecords(filteredData, joueurs, ligueMetadata, matchData, selectedSeason);

  const shareContext = [selectedSeason, selectedLigue && selectedLigue !== 'Toutes' ? selectedLigue : null].filter(Boolean).join(' · ');

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
        {/* Mini music player */}
        <div className={`w-[220px] rounded-md shadow-md border transition-all ${
          isPlaying
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
        }`}>
          <div className="px-1.5 pt-1 pb-0 overflow-hidden h-4">
            <p className={`text-[10px] font-medium whitespace-nowrap leading-4 ${isPlaying ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'} ${PLAYLIST[currentTrack].title.length > 28 ? 'animate-marquee' : 'text-center'}`}>
              {PLAYLIST[currentTrack].title}
            </p>
          </div>
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

        {/* Dark mode toggle */}
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

        {/* Admin button */}
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
                onClick={() => setActiveTab('joueurs')}
                className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                  activeTab === 'joueurs'
                    ? 'bg-amber-500 text-white shadow-lg'
                    : 'bg-white text-amber-600 hover:bg-amber-50 dark:bg-slate-800 dark:text-amber-400'
                }`}
              >
                Joueurs
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

        <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>}>
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

        {activeTab === 'stats-avancees' && (
          <AdvancedStatsTab
            joueurs={joueurs}
            advancedStats={advancedStats}
            statsDetaillees={statsDetaillees}
            scoreDistribution={scoreDistribution}
            heureDeGloire={heureDeGloire}
            buteursEvolution={buteursEvolution}
            loosersEvolution={loosersEvolution}
            perduUnPoint={perduUnPoint}
            shareContext={shareContext}
          />
        )}

        {activeTab === 'versus' && (
          <VersusTab
            joueurs={joueurs}
            selectedVersusPlayer1={selectedVersusPlayer1}
            setSelectedVersusPlayer1={setSelectedVersusPlayer1}
            selectedVersusPlayer2={selectedVersusPlayer2}
            setSelectedVersusPlayer2={setSelectedVersusPlayer2}
            selectedVersusLigue={selectedVersusLigue}
            setSelectedVersusLigue={setSelectedVersusLigue}
            ligues={ligues}
            versusStats={versusStats}
            versusMatchHistory={versusMatchHistory}
            activeVersusTooltip={activeVersusTooltip}
            setActiveVersusTooltip={setActiveVersusTooltip}
            selectedValiseTable={selectedValiseTable}
            setSelectedValiseTable={setSelectedValiseTable}
            shareContext={shareContext}
          />
        )}

        {activeTab === 'records' && (
          <RecordsTab
            joueurs={joueurs}
            seasonRecords={seasonRecords}
            ligueRecordsAllTime={ligueRecordsAllTime}
            ligueRecordsSeason={ligueRecordsSeason}
            ligueRecordsMode={ligueRecordsMode}
            setLigueRecordsMode={setLigueRecordsMode}
            shareContext={shareContext}
          />
        )}

        {activeTab === 'joueurs' && (
          <JoueursTab mercatoData={mercatoData} />
        )}

        {activeTab === 'mercato' && (
          <MercatoTab
            mercatoStats={mercatoStats}
            shareContext={shareContext}
          />
        )}
        </Suspense>

      </div>
    </div>
  );
};

export default App;
