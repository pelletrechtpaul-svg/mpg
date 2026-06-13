import { useState } from 'react';
import { playerImages, ShareBtn } from '../shared';

export default function AdvancedStatsTab({ joueurs, advancedStats, shareContext }) {
  const [activeMatchTooltip, setActiveMatchTooltip] = useState(null);

  const playerColors = {
    Paul: 'bg-blue-600',
    Adrien: 'bg-green-600',
    Tiago: 'bg-purple-600',
    Roman: 'bg-orange-600',
  };

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Forme récente</h2>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {joueurs.map(joueur => {
            const stats = advancedStats[joueur];
            if (!stats) return null;

            return (
              <div key={joueur} data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
                <ShareBtn contextText={shareContext} />
                <div className="flex items-center gap-4 mb-6 pb-4 border-b dark:border-slate-700">
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
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{joueur}</h3>
                  </div>
                </div>

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

                        {activeMatchTooltip?.joueur === joueur && activeMatchTooltip?.index === idx && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setActiveMatchTooltip(null)}
                            />
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
    </>
  );
}
