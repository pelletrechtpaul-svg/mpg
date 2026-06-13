import { playerImages, playerColors, ShareBtn } from '../shared.jsx';

export default function VersusTab({
  joueurs, ligues,
  selectedVersusPlayer1, setSelectedVersusPlayer1,
  selectedVersusPlayer2, setSelectedVersusPlayer2,
  selectedVersusLigue, setSelectedVersusLigue,
  versusStats, heureDeGloire, selectedSeason,
}) {
  return (
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

      {versusStats.matchs > 0 ? (
        <>
          <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 sm:p-8 mb-6">
            <ShareBtn contextText={[selectedSeason, selectedVersusLigue && selectedVersusLigue !== 'all' ? selectedVersusLigue : null].filter(Boolean).join(' · ') || null} />
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

            {(versusStats.valises_j1 > 0 || versusStats.valises_j2 > 0) && (
              <div className="grid grid-cols-3 gap-4 text-center items-center mt-6 pt-6 border-t dark:border-slate-700">
                <div>
                  <div className="text-3xl font-bold text-blue-600">{versusStats.valises_j1}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">utilisées</div>
                  {versusStats.valises_j1 > 0 && (
                    <div className="text-sm font-semibold text-green-600 mt-1">
                      {versusStats.valises_j1_efficaces} efficace{versusStats.valises_j1_efficaces !== 1 ? 's' : ''}
                      <span className="text-slate-400 font-normal"> ({Math.round(versusStats.valises_j1_efficaces / versusStats.valises_j1 * 100)}%)</span>
                    </div>
                  )}
                </div>
                <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">💼 Valises</div>
                <div>
                  <div className="text-3xl font-bold text-purple-600">{versusStats.valises_j2}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">utilisées</div>
                  {versusStats.valises_j2 > 0 && (
                    <div className="text-sm font-semibold text-green-600 mt-1">
                      {versusStats.valises_j2_efficaces} efficace{versusStats.valises_j2_efficaces !== 1 ? 's' : ''}
                      <span className="text-slate-400 font-normal"> ({Math.round(versusStats.valises_j2_efficaces / versusStats.valises_j2 * 100)}%)</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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
  );
}
