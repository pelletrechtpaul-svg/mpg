import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Lock, SkipBack, SkipForward, Play, Pause } from 'lucide-react';
import { PLAYLIST } from './shared.jsx';
const JoueursTab = lazy(() => import('./components/JoueursTab'));
const AdvancedStatsTab = lazy(() => import('./components/AdvancedStatsTab'));
const VersusTab = lazy(() => import('./components/VersusTab'));
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

  const [saisons, setSaisons] = useState(['2025/2026', '2024/2025']);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'saisons'), snap => {
      if (snap.exists()) setSaisons(snap.data().list || ['2025/2026', '2024/2025']);
    }, () => {});
    return unsub;
  }, []);
  const { darkMode, setDarkMode } = useDarkMode();
  const { isPlaying, currentTrack, playPause, prevTrack, nextTrack } = useAudioPlayer();
  const { filteredData, joueurs, ligues, championnatsByLigue } = useSeasonData(matchData, selectedSeason);

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
              {PLAYLIST[currentTrack].title}
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

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="pointer-events-auto w-8 h-8 flex items-center justify-center rounded-lg shadow-md transition-all hover:shadow-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-yellow-400 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
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
          className={`pointer-events-auto w-8 h-8 flex items-center justify-center rounded-lg shadow-md transition-all border ${
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
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white mb-2">MesPetitsBavons</h1>
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
          {[...saisons, 'All-Time'].map(season => (
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
                onClick={() => setActiveTab('style')}
                className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                  activeTab === 'style'
                    ? 'bg-pink-500 text-white shadow-lg'
                    : 'bg-white text-pink-500 hover:bg-pink-50 dark:bg-slate-800 dark:text-pink-400'
                }`}
              >
                🎨
              </button>
            </div>
          </div>
        )}

        <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>}>

        {/* Placeholder saison vide (hors admin, joueurs, all-time) */}
        {filteredData.length === 0 && selectedSeason !== 'All-Time' && activeTab !== 'admin' && activeTab !== 'joueurs' ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="text-8xl mb-6 select-none" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}>
              ⚽
            </div>
            <div className="text-6xl mb-2 -mt-4 select-none">💥</div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 mt-4 mb-3 leading-tight">
              Le retour de la bagarre<br/>
              <span className="text-blue-600 dark:text-blue-400">bientôt sur vos écrans</span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base max-w-xs">
              La saison <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedSeason}</span> n'a pas encore commencé.<br />
              Revenez quand les coups de pied ont fusé. 🥊
            </p>
          </div>
        ) : null}

        {activeTab === 'classements' && !(filteredData.length === 0 && selectedSeason !== 'All-Time') && (
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

        {activeTab === 'stats-avancees' && !(filteredData.length === 0 && selectedSeason !== 'All-Time') && (
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

        {activeTab === 'versus' && !(filteredData.length === 0 && selectedSeason !== 'All-Time') && (
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
            heureDeGloire={heureDeGloire}
            activeVersusTooltip={activeVersusTooltip}
            setActiveVersusTooltip={setActiveVersusTooltip}
            selectedValiseTable={selectedValiseTable}
            setSelectedValiseTable={setSelectedValiseTable}
            shareContext={shareContext}
          />
        )}

        {activeTab === 'records' && !(filteredData.length === 0 && selectedSeason !== 'All-Time') && (
          <RecordsTab
            joueurs={joueurs}
            selectedSeason={selectedSeason}
            seasonRecords={seasonRecords}
            perduUnPoint={perduUnPoint}
            ligueRecordsAllTime={ligueRecordsAllTime}
            ligueRecordsSeason={ligueRecordsSeason}
          />
        )}

        {activeTab === 'joueurs' && (
          <JoueursTab mercatoData={mercatoData} />
        )}

        {activeTab === 'style' && (
          <div className="space-y-8">
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center">Style D — version light vs dark</p>

            {/* D Light */}
            <div>
              <h2 className="text-base font-bold text-slate-500 mb-3">D — Light</h2>
              <div style={{background:'linear-gradient(135deg,#eff6ff,#f5f3ff)',borderRadius:16,padding:2}}>
                <div className="rounded-2xl overflow-hidden bg-white border border-indigo-100">
                  <div className="px-5 py-4 border-b border-indigo-100 flex items-center justify-between">
                    <span className="text-slate-700 font-semibold text-sm">Classement général</span>
                    <span className="text-xs font-medium text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">2025/2026</span>
                  </div>
                  <table className="w-full">
                    <thead><tr className="border-b border-indigo-50">{['#','Joueur','V','N','D','Pts'].map(h=><th key={h} className="px-4 py-3 text-slate-400 text-xs font-medium text-center first:text-left">{h}</th>)}</tr></thead>
                    <tbody>
                      {[['Paul','blue','P',12,3,2,39],['Adrien','green','A',10,4,3,34],['Tiago','purple','T',8,5,4,29],['Roman','orange','R',6,2,9,20]].map(([name,color,letter,v,n,d,pts],i)=>(
                        <tr key={name} className="border-b border-indigo-50 hover:bg-indigo-50/50 transition-colors">
                          <td className="px-4 py-3 text-indigo-300 font-bold text-lg">{i+1}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><div className={`w-6 h-6 rounded-lg bg-${color}-100 border border-${color}-200 flex items-center justify-center text-xs font-bold text-${color}-600`}>{letter}</div><span className="text-slate-800 font-semibold">{name}</span></div></td>
                          <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{v}</td>
                          <td className="px-4 py-3 text-center text-slate-400">{n}</td>
                          <td className="px-4 py-3 text-center text-rose-400">{d}</td>
                          <td className="px-4 py-3 text-center font-black text-indigo-600 text-lg">{pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* D Dark */}
            <div>
              <h2 className="text-base font-bold text-slate-500 mb-3">D — Dark</h2>
              <div style={{background:'linear-gradient(135deg,#1e1b4b,#1e1b4b 50%,#2e1065)',borderRadius:16,padding:2}}>
                <div className="rounded-2xl overflow-hidden" style={{background:'#0f0e1a',border:'1px solid #2d2b5e'}}>
                  <div className="px-5 py-4 flex items-center justify-between" style={{borderBottom:'1px solid #2d2b5e'}}>
                    <span className="text-slate-200 font-semibold text-sm">Classement général</span>
                    <span className="text-xs font-medium text-indigo-300 px-2 py-0.5 rounded-full" style={{background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.3)'}}>2025/2026</span>
                  </div>
                  <table className="w-full">
                    <thead><tr style={{borderBottom:'1px solid #2d2b5e'}}>{['#','Joueur','V','N','D','Pts'].map(h=><th key={h} className="px-4 py-3 text-xs font-medium text-center first:text-left" style={{color:'#6b7280'}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {[['Paul','blue','P','#3b82f6',12,3,2,39],['Adrien','green','A','#22c55e',10,4,3,34],['Tiago','purple','T','#a855f7',8,5,4,29],['Roman','orange','R','#f97316',6,2,9,20]].map(([name,color,letter,hex,v,n,d,pts],i)=>(
                        <tr key={name} className="transition-colors" style={{borderBottom:'1px solid #1e1c3a'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(99,102,241,0.07)'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                          <td className="px-4 py-3 font-bold text-lg" style={{color:'#4f46e5'}}>{i+1}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold" style={{background:`${hex}22`,border:`1px solid ${hex}55`,color:hex}}>{letter}</div><span className="text-slate-200 font-semibold">{name}</span></div></td>
                          <td className="px-4 py-3 text-center font-semibold" style={{color:'#34d399'}}>{v}</td>
                          <td className="px-4 py-3 text-center" style={{color:'#6b7280'}}>{n}</td>
                          <td className="px-4 py-3 text-center" style={{color:'#f87171'}}>{d}</td>
                          <td className="px-4 py-3 text-center font-black text-lg" style={{color:'#818cf8'}}>{pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        </Suspense>

      </div>
    </div>
  );
};

export default App;
