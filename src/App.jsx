import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { Lock, SkipBack, SkipForward, Play, Pause } from 'lucide-react';
const JoueursTab = lazy(() => import('./components/JoueursTab'));
const EntraineursTab = lazy(() => import('./components/EntraineursTab'));
const RecordsTab = lazy(() => import('./components/RecordsTab'));
const ClassementsTab = lazy(() => import('./components/ClassementsTab'));
const AdminTab = lazy(() => import('./components/AdminTab'));
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestoreSync } from './hooks/useFirestoreSync';
import { useDarkMode } from './hooks/useDarkMode';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useSeasonData } from './hooks/useSeasonData';

import { useChampionshipStats } from './hooks/useChampionshipStats';
import { usePlayerStats } from './hooks/usePlayerStats';
import { useEvolutionData } from './hooks/useEvolutionData';
import { useAdvancedStats } from './hooks/useAdvancedStats';
import { useRecords } from './hooks/useRecords';

const saisonYear = s => { const m = s?.match(/(\d{4})/); return m ? parseInt(m[1]) : 0; };
const mostRecentSeason = (list) => [...list].sort((a, b) => saisonYear(b) - saisonYear(a))[0];

const App = () => {
  const [selectedSeason, setSelectedSeason] = useState(() => mostRecentSeason(['2025/2026', '2024/2025']));
  const [activeTab, setActiveTab] = useState('classements');
  const [selectedLigue, setSelectedLigue] = useState('general');
  const [selectedChampionnat, setSelectedChampionnat] = useState('total');
  const [selectedStatsLigue, setSelectedStatsLigue] = useState('all');
  const [pendingPlayerKey, setPendingPlayerKey] = useState(null);
  const [cameFromEffectifs, setCameFromEffectifs] = useState(false);
  const [ligueView, setLigueView] = useState('classement');
  const [effectifsCoach, setEffectifsCoach] = useState(null);
  const [buteursCscView, setButeursCscView] = useState('buteurs');
  const [pendingEditMatch, setPendingEditMatch] = useState(null);

  const openPlayer = (joueur, ligue) => {
    setPendingPlayerKey(joueur + '|||' + ligue);
    setCameFromEffectifs(true);
    setActiveTab('joueurs');
  };

  const backToEffectifs = () => {
    setCameFromEffectifs(false);
    setActiveTab('classements');
  };

  const openMatchEdit = (match) => {
    setPendingEditMatch(match);
    setActiveTab('admin');
  };

  const backToClassementsFromEdit = () => {
    setPendingEditMatch(null);
    setActiveTab('classements');
  };

  const { matchData, mercatoData, ligueMetadata, isLoading, isOnline, lastSyncTime, syncError, setSyncError, isAdminAuthenticated } = useFirestoreSync();

  const [saisons, setSaisons] = useState(['2025/2026', '2024/2025']);
  // true seulement après un choix manuel de saison par l'utilisateur (jamais
  // sur un simple événement de synchro — Firestore peut renvoyer d'abord une
  // version en cache périmée avant la vraie donnée serveur)
  const hasUserPickedSeason = useRef(false);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'saisons'), snap => {
      if (snap.exists()) {
        const list = snap.data().list || ['2025/2026', '2024/2025'];
        setSaisons(list);
        if (!hasUserPickedSeason.current) {
          setSelectedSeason(mostRecentSeason(list));
        }
      }
    }, () => {});
    return unsub;
  }, []);
  const { darkMode, setDarkMode } = useDarkMode();
  const { isPlaying, currentTitle, playPause, prevTrack, nextTrack } = useAudioPlayer();
  const { filteredData, joueurs, ligues, championnatsByLigue } = useSeasonData(matchData, selectedSeason);
  const filteredMercatoData = useMemo(() =>
    selectedSeason === 'All-Time' ? mercatoData : mercatoData.filter(m => m.saison === selectedSeason),
    [mercatoData, selectedSeason]
  );

  const { victoiresChampionnat, medaillesChampionnat, victoiresDetail, medaillesDetail, perduUnPoint, classementGeneral, classementParLigue } = useChampionshipStats(filteredData, joueurs, ligueMetadata, selectedSeason, selectedLigue, selectedChampionnat);
  const { statsDetaillees, cleanSheetsStats, heureDeGloire, valiseStats } = usePlayerStats(filteredData, joueurs, selectedStatsLigue, selectedLigue, selectedChampionnat, ligueMetadata);
  const { matchesListForChampionnat, historicalEvolution } = useEvolutionData(filteredData, joueurs, selectedLigue, selectedChampionnat, ligueMetadata);
  const advancedStats = useAdvancedStats(matchData, joueurs, selectedSeason);
  const { seasonRecords, ligueRecordsAllTime, ligueRecordsSeason, mercatoRecordsAllTime, mercatoRecordsSeason } = useRecords(filteredData, joueurs, ligueMetadata, matchData, selectedSeason, mercatoData, filteredMercatoData);

  const shareContext = [selectedSeason, selectedLigue && selectedLigue !== 'Toutes' ? selectedLigue : null].filter(Boolean).join(' · ');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#0a0918] dark:to-[#0d0a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-[#0a0918] dark:to-[#0d0a1a]">
      {/* Fixed top-right controls: MP3 Player + Buttons */}
      <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">
        {/* Mini music player */}
        <div className={`pointer-events-auto rounded-md shadow-md border transition-all ${
          isPlaying
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
        }`}>
          {/* Track title */}
          <div className="px-1.5 pt-1.5 pb-0 overflow-hidden h-6 w-[120px] sm:w-[220px]">
            <p className={`text-[11px] font-medium whitespace-nowrap leading-6 ${isPlaying ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'} animate-marquee`}>
              {currentTitle}
            </p>
          </div>
          <div className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-2 py-1 sm:pb-1.5 sm:pt-0">
            <button onClick={prevTrack} className="p-1 sm:p-1.5 rounded hover:opacity-70 transition-opacity" title="Précédent">
              <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button onClick={playPause} className="p-1 sm:p-1.5 rounded hover:opacity-70 transition-opacity" title={isPlaying ? 'Pause' : 'Lecture'}>
              {isPlaying ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
            <button onClick={nextTrack} className="p-1 sm:p-1.5 rounded hover:opacity-70 transition-opacity" title="Suivant">
              <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Dark mode + Admin buttons in a row */}
        <div className="pointer-events-auto flex gap-1">
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
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:px-10 lg:py-8">
        {/* Header */}
        <div className="mb-6 lg:flex lg:items-end lg:justify-between lg:gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black mb-2 text-violet-700 dark:text-violet-400">MesPetitsBavons</h1>
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

          {/* Season Navigation — à droite du header sur desktop */}
          <div className="flex gap-1 mt-4 lg:mt-0 flex-wrap bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-1 border border-indigo-100 dark:border-[#2d2b5e]">
            {[...saisons, 'All-Time'].map(season => (
              <button
                key={season}
                onClick={() => {
                  hasUserPickedSeason.current = true;
                  setSelectedSeason(season);
                  if (activeTab === 'admin') setActiveTab('classements');
                }}
                className={`px-3 py-1.5 sm:px-5 sm:py-2 rounded-xl font-medium transition-all text-sm sm:text-base whitespace-nowrap ${
                  selectedSeason === season && activeTab !== 'admin'
                    ? 'bg-indigo-700 text-white shadow'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/10'
                }`}
              >
                {season}
              </button>
            ))}
          </div>
        </div>

        {/* Sync error banner */}
        {syncError && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
            <span className="flex-1">{syncError}</span>
            <button onClick={() => setSyncError(null)} className="text-red-400 hover:text-red-600 font-bold">✕</button>
          </div>
        )}

        {/* Sub-navigation */}
        {activeTab !== 'admin' && (
          <div className="mb-6 max-w-xl sm:w-fit">
            {(() => {
              const tabs = [
                { key: 'classements', label: 'Classement' },
                { key: 'entraineurs', label: 'Entraîneurs' },
                { key: 'records', label: 'Records' },
                { key: 'joueurs', label: 'Joueurs' },
              ];
              return (
                <div className="flex justify-between sm:justify-start gap-1 bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-1 border border-indigo-100 dark:border-[#2d2b5e]">
                  {tabs.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`px-2 sm:px-4 py-1 sm:py-2 rounded-xl font-medium transition-all text-sm sm:text-base whitespace-nowrap ${activeTab === key ? 'bg-violet-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/10'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>}>

        {activeTab === 'classements' && (
          <ClassementsTab
            joueurs={joueurs}
            ligues={ligues}
            saisons={saisons}
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
            mercatoData={filteredMercatoData}
            onOpenPlayer={openPlayer}
            ligueView={ligueView}
            setLigueView={setLigueView}
            effectifsCoach={effectifsCoach}
            setEffectifsCoach={setEffectifsCoach}
            buteursCscView={buteursCscView}
            setButeursCscView={setButeursCscView}
            onEditMatch={openMatchEdit}
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
            initialEditMatch={pendingEditMatch}
            onConsumeInitialEditMatch={() => setPendingEditMatch(null)}
            onBackToClassements={backToClassementsFromEdit}
          />
        )}

        {activeTab === 'entraineurs' && (
          <EntraineursTab
            joueurs={joueurs}
            ligues={ligues}
            filteredData={filteredData}
            mercatoData={filteredMercatoData}
            classementGeneral={classementGeneral}
            advancedStats={advancedStats}
            cleanSheetsStats={cleanSheetsStats}
            statsDetaillees={statsDetaillees}
            heureDeGloire={heureDeGloire}
            selectedSeason={selectedSeason}
            shareContext={shareContext}
            onOpenPlayer={openPlayer}
          />
        )}

        {activeTab === 'records' && (
          <RecordsTab
            joueurs={joueurs}
            selectedSeason={selectedSeason}
            seasonRecords={seasonRecords}
            perduUnPoint={perduUnPoint}
            ligueRecordsAllTime={ligueRecordsAllTime}
            ligueRecordsSeason={ligueRecordsSeason}
            mercatoRecordsAllTime={mercatoRecordsAllTime}
            mercatoRecordsSeason={mercatoRecordsSeason}
            shareContext={shareContext}
          />
        )}

        {activeTab === 'joueurs' && (
          <JoueursTab
            mercatoData={filteredMercatoData}
            matchData={filteredData}
            initialPlayerKey={pendingPlayerKey}
            onConsumeInitialPlayer={() => setPendingPlayerKey(null)}
            showBackToEffectifs={cameFromEffectifs}
            onBackToEffectifs={backToEffectifs}
          />
        )}

        </Suspense>

      </div>
    </div>
  );
};

export default App;
