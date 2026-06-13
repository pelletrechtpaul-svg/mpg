import { JOUEURS_MERCATO, POSTE_LABEL, playerImages, ShareBtn } from '../shared';

export default function MercatoTab({ mercatoStats }) {
  return (
    <div className="space-y-6">
      {!mercatoStats ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-8 text-center">
          <p className="text-slate-500 dark:text-slate-400">Chargement des données mercato...</p>
        </div>
      ) : (
        <>
          {/* ── CARDS PAR JOUEUR ── */}
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Par joueur</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {JOUEURS_MERCATO.map(joueur => {
                const s = mercatoStats.perPlayer[joueur];
                if (!s) return null;
                const colorBg = { Paul: 'bg-blue-600', Adrien: 'bg-green-600', Tiago: 'bg-purple-600', Roman: 'bg-orange-600' }[joueur];
                const colorText = { Paul: 'text-blue-600 dark:text-blue-400', Adrien: 'text-green-600 dark:text-green-400', Tiago: 'text-purple-600 dark:text-purple-400', Roman: 'text-orange-600 dark:text-orange-400' }[joueur];
                const colorBorder = { Paul: 'border-blue-300 dark:border-blue-700', Adrien: 'border-green-300 dark:border-green-700', Tiago: 'border-purple-300 dark:border-purple-700', Roman: 'border-orange-300 dark:border-orange-700' }[joueur];
                return (
                  <div key={joueur} data-card className={`relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 border-t-4 ${colorBorder.replace('border-', 'border-t-').split(' ')[0]}`}>
                    <ShareBtn contextText={`Mercato ${joueur} — MPG`} />
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-full overflow-hidden border-2 ${colorBorder.split(' ')[0]} flex-shrink-0`}>
                        <img src={playerImages[joueur]} alt={joueur}
                          className="w-full h-full object-cover"
                          onError={e => { e.target.style.display='none'; e.target.parentNode.classList.add(colorBg); }}
                        />
                      </div>
                      <div>
                        <div className={`font-bold text-lg ${colorText}`}>{joueur}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{s.count} joueurs achetés</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Enchère médiane</span>
                        <span className={`font-bold text-lg ${colorText}`}>{s.mediane}m</span>
                      </div>
                      <div className="border-t dark:border-slate-700 pt-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ligue où il se lâche</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{s.ligueFolie || '—'}</div>
                        {s.ligueFolieCount > 0 && <div className="text-xs text-slate-500 dark:text-slate-400">{s.ligueFolieCount} enchère{s.ligueFolieCount > 1 ? 's' : ''} &gt; 50m</div>}
                      </div>
                      <div className="border-t dark:border-slate-700 pt-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400">Nationalité préférée</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 mb-1">parmi {s.natDistinctes} nationalité{s.natDistinctes > 1 ? 's' : ''} recrutées</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{s.natPref || '—'}</div>
                        {s.natMax > 0 && <div className="text-xs text-slate-500 dark:text-slate-400">{s.natMax} joueur{s.natMax > 1 ? 's' : ''}</div>}
                      </div>
                      <div className="border-t dark:border-slate-700 pt-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Poste préféré</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{s.postePref ? POSTE_LABEL[s.postePref] : '—'}</div>
                        {s.postePrefCount && <div className="text-xs text-slate-500 dark:text-slate-400">{s.postePrefCount} joueur{s.postePrefCount > 1 ? 's' : ''} recrutés</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── STATS GLOBALES ── */}
          <div className="space-y-8">

            {/* VUE D'ENSEMBLE */}
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Vue d'ensemble</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {[{ label: 'Recrutement moyen', desc: 'Nb moyen de joueurs recrutés par championnat', data: mercatoStats.recrutementMoyen },
                  { label: 'Roi du tour 1', desc: 'Recrute le plus de joueurs en moyenne au tour 1', data: mercatoStats.roiTour1 }].map(({ label, desc, data }) => (
                  <div key={label} data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
                    <ShareBtn contextText={`${label} — Mercato MPG`} />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{desc}</p>
                    {data ? (
                      <div className="space-y-2">
                        {Object.entries(data.averages).sort((a, b) => b[1] - a[1]).map(([joueur, avg], i) => {
                          const maxAvg = Math.max(...Object.values(data.averages));
                          const colorBg = { Paul: 'bg-blue-600', Adrien: 'bg-green-600', Tiago: 'bg-purple-600', Roman: 'bg-orange-600' }[joueur];
                          return (
                            <div key={joueur} className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${colorBg} flex-shrink-0`}></div>
                              <span className="text-sm text-slate-600 dark:text-slate-300 w-16">{joueur}</span>
                              <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                <div className={`${colorBg} h-2 rounded-full`} style={{ width: `${maxAvg > 0 ? (avg / maxAvg) * 100 : 0}%` }}></div>
                              </div>
                              <span className="text-sm text-slate-800 dark:text-slate-100 w-24 text-right">{avg} joueur{avg !== 1 ? 's' : ''}{i === 0 ? ' 👑' : ''}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-xs text-slate-500 dark:text-slate-400">Pas assez de données</p>}
                  </div>
                ))}
                {/* Roi des enchères */}
                <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
                  <ShareBtn contextText="Roi des enchères — Mercato MPG" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Roi des enchères</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Gagne le plus d'enchères disputées</p>
                  <div className="space-y-2">
                    {Object.entries(mercatoStats.roiEncheres.wins).sort((a, b) => b[1] - a[1]).map(([joueur, wins], i) => {
                      const maxWins = Math.max(...Object.values(mercatoStats.roiEncheres.wins));
                      const colorBg = { Paul: 'bg-blue-600', Adrien: 'bg-green-600', Tiago: 'bg-purple-600', Roman: 'bg-orange-600' }[joueur];
                      return (
                        <div key={joueur} className={`flex items-center gap-2 ${i === 0 ? 'font-semibold' : ''}`}>
                          <div className={`w-2.5 h-2.5 rounded-full ${colorBg} flex-shrink-0`}></div>
                          <span className="text-sm text-slate-600 dark:text-slate-300 w-16">{joueur}</span>
                          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                            <div className={`${colorBg} h-2 rounded-full`} style={{ width: `${maxWins > 0 ? (wins / maxWins) * 100 : 0}%` }}></div>
                          </div>
                          <span className="text-sm text-slate-800 dark:text-slate-100 w-12 text-right">{wins}{i === 0 ? ' 👑' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* Rivalités */}
              <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
                <ShareBtn contextText="Rivalités — Mercato MPG" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Rivalités</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Paires qui s'affrontent le plus souvent aux enchères</p>
                <div className="space-y-3">
                  {mercatoStats.rivalites.map(([pair, count], i) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const [j1, j2] = pair.split(' vs ');
                    const colorBg1 = { Paul: 'bg-blue-600', Adrien: 'bg-green-600', Tiago: 'bg-purple-600', Roman: 'bg-orange-600' }[j1];
                    const colorBg2 = { Paul: 'bg-blue-600', Adrien: 'bg-green-600', Tiago: 'bg-purple-600', Roman: 'bg-orange-600' }[j2];
                    return (
                      <div key={pair} className="flex items-center gap-2">
                        <span className="text-lg w-6 flex-shrink-0">{medals[i]}</span>
                        <div className="flex items-center gap-1.5 flex-1">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorBg1}`}></span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{j1}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">vs</span>
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorBg2}`}></span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{j2}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-shrink-0">{count} duel{count > 1 ? 's' : ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Rois des postes */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-3">Rois des postes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Roi des attaquants', data: mercatoStats.roiAttaquants, poste: 'A' },
                    { label: 'Roi des milieux', data: mercatoStats.roiMilieux, poste: 'M' },
                    { label: 'Roi des défenseurs', data: mercatoStats.roiDefenseurs, poste: 'D' },
                    { label: 'Roi des gardiens', data: mercatoStats.roiGardiens, poste: 'G' },
                  ].map(({ label, data, poste }) => (
                    <div key={poste} data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
                      <ShareBtn contextText={`${label} — Mercato MPG`} />
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">% du budget sur les {POSTE_LABEL[poste].toLowerCase()}</p>
                      {data ? (
                        <div className="space-y-2">
                          {Object.entries(data.shares).sort((a, b) => b[1] - a[1]).map(([joueur, pct], i) => {
                            const colorBg = { Paul: 'bg-blue-600', Adrien: 'bg-green-600', Tiago: 'bg-purple-600', Roman: 'bg-orange-600' }[joueur];
                            return (
                              <div key={joueur} className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${colorBg} flex-shrink-0`}></div>
                                <span className="text-sm text-slate-600 dark:text-slate-300 w-16">{joueur}</span>
                                <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                  <div className={`${colorBg} h-2 rounded-full`} style={{ width: `${pct}%` }}></div>
                                </div>
                                <span className="text-sm text-slate-800 dark:text-slate-100 w-14 text-right">{pct}%{i === 0 ? ' 👑' : ''}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : <p className="text-xs text-slate-500 dark:text-slate-400">—</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* LES PODIUMS */}
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Les podiums</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
                  <ShareBtn contextText="Joueurs achetés le plus cher — Mercato MPG" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Joueurs achetés le plus cher</h3>
                  <div className="space-y-3">
                    {mercatoStats.podiumCher.map((e, i) => {
                      const medals = ['🥇', '🥈', '🥉'];
                      const acheteurColor = { Paul: 'bg-blue-600', Adrien: 'bg-green-600', Tiago: 'bg-purple-600', Roman: 'bg-orange-600' }[e.acheteur];
                      return (
                        <div key={e.firestoreId} className="flex items-center gap-2">
                          <span className="text-lg w-6 flex-shrink-0">{medals[i]}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{e.joueur.toLowerCase().startsWith(e.prenom.toLowerCase()) ? e.joueur : `${e.prenom} ${e.joueur}`}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{e.ligue} · champ. {e.championnat}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-slate-800 dark:text-slate-100">{e.prix}m</div>
                            <div className="flex items-center gap-1 justify-end">
                              <div className={`w-2 h-2 rounded-full ${acheteurColor}`}></div>
                              <span className="text-xs text-slate-500 dark:text-slate-400">{e.acheteur}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
                  <ShareBtn contextText="Joueurs les plus disputés — Mercato MPG" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Joueurs les plus disputés</h3>
                  <div className="space-y-3">
                    {mercatoStats.podiumDispute.map((e, i) => {
                      const medals = ['🥇', '🥈', '🥉'];
                      const acheteurColor = { Paul: 'bg-blue-600', Adrien: 'bg-green-600', Tiago: 'bg-purple-600', Roman: 'bg-orange-600' }[e.acheteur];
                      return (
                        <div key={e.firestoreId} className="flex items-center gap-2">
                          <span className="text-lg w-6 flex-shrink-0">{medals[i]}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{e.joueur.toLowerCase().startsWith(e.prenom.toLowerCase()) ? e.joueur : `${e.prenom} ${e.joueur}`}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{e.ligue} · champ. {e.championnat} · {e.nbEncheres} enchère{e.nbEncheres > 1 ? 's' : ''}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-blue-600 dark:text-blue-400">{e.totalMise}m</div>
                            <div className="flex items-center gap-1 justify-end">
                              <div className={`w-2 h-2 rounded-full ${acheteurColor}`}></div>
                              <span className="text-xs text-slate-500 dark:text-slate-400">{e.acheteur}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
                  <ShareBtn contextText="Enchères perdues les plus chères — Mercato MPG" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Enchères perdues les plus chères</h3>
                  <div className="space-y-3">
                    {mercatoStats.podiumEncheresPerduees.map((ep, i) => {
                      const medals = ['🥇', '🥈', '🥉'];
                      const acheteurColor = { Paul: 'bg-blue-600', Adrien: 'bg-green-600', Tiago: 'bg-purple-600', Roman: 'bg-orange-600' }[ep.acheteur];
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-lg w-6 flex-shrink-0">{medals[i]}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{ep.prenom && !ep.joueur.toLowerCase().startsWith(ep.prenom.toLowerCase()) ? `${ep.prenom} ` : ''}{ep.joueur}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{ep.ligue} · champ. {ep.championnat} · perdu face à <span className="inline-flex items-center gap-1"><span className={`inline-block w-2 h-2 rounded-full ${acheteurColor}`}></span>{ep.acheteur} ({ep.prixGagnant}m)</span></div>
                          </div>
                          <div className="font-bold text-red-500 flex-shrink-0">{ep.prixPerdu}m</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* CURIOSITÉS */}
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Curiosités</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
                  <ShareBtn contextText="Chasseur solitaire — Mercato MPG" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Chasseur solitaire</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Recrute le plus sans aucune concurrence</p>
                  <div className="space-y-2">
                    {Object.entries(mercatoStats.chasseurSolitaire.counts).sort((a, b) => b[1] - a[1]).map(([joueur, count], i) => {
                      const maxC = Math.max(...Object.values(mercatoStats.chasseurSolitaire.counts));
                      const colorBg = { Paul: 'bg-blue-600', Adrien: 'bg-green-600', Tiago: 'bg-purple-600', Roman: 'bg-orange-600' }[joueur];
                      return (
                        <div key={joueur} className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${colorBg} flex-shrink-0`}></div>
                          <span className="text-sm text-slate-600 dark:text-slate-300 w-16">{joueur}</span>
                          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                            <div className={`${colorBg} h-2 rounded-full`} style={{ width: `${maxC > 0 ? (count / maxC) * 100 : 0}%` }}></div>
                          </div>
                          <span className="text-sm text-slate-800 dark:text-slate-100 w-16 text-right">{count}{i === 0 ? ' 👑' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
                  <ShareBtn contextText="Surenchérisseur — Mercato MPG" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Surenchérisseur</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Écart moyen entre sa mise gagnante et la 2e enchère</p>
                  <div className="space-y-2">
                    {Object.entries(mercatoStats.surencherisseur.avgSpreads).sort((a, b) => b[1] - a[1]).map(([joueur, avg], i) => {
                      const maxAvg = Math.max(...Object.values(mercatoStats.surencherisseur.avgSpreads));
                      const colorBg = { Paul: 'bg-blue-600', Adrien: 'bg-green-600', Tiago: 'bg-purple-600', Roman: 'bg-orange-600' }[joueur];
                      return (
                        <div key={joueur} className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${colorBg} flex-shrink-0`}></div>
                          <span className="text-sm text-slate-600 dark:text-slate-300 w-16">{joueur}</span>
                          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                            <div className={`${colorBg} h-2 rounded-full`} style={{ width: `${maxAvg > 0 ? (avg / maxAvg) * 100 : 0}%` }}></div>
                          </div>
                          <span className="text-sm text-slate-800 dark:text-slate-100 w-20 text-right">+{avg}m{i === 0 ? ' 👑' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

            {/* ANALYSE DES LIGUES */}
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Analyse des ligues</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
                  <ShareBtn contextText="Ligues les plus chères — Mercato MPG" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Ligues les plus chères</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Enchère médiane par ligue</p>
                  <div className="space-y-2">
                    {mercatoStats.ligueRanking.map(({ ligue, mediane }, i) => {
                      const maxMed = mercatoStats.ligueRanking[0]?.mediane || 1;
                      const medals = ['🥇', '🥈', '🥉'];
                      return (
                        <div key={ligue} className="flex items-center gap-2">
                          <span className="text-sm w-5 flex-shrink-0">{medals[i] || ''}</span>
                          <span className="text-sm text-slate-600 dark:text-slate-300 w-28 truncate">{ligue}</span>
                          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(mediane / maxMed) * 100}%` }}></div>
                          </div>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 w-12 text-right">{mediane}m</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
                  <ShareBtn contextText="Poste le plus valorisé — Mercato MPG" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Poste le plus valorisé</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Nb d'enchères sérieuses (&gt;30m) par poste</p>
                  <div className="space-y-2">
                    {Object.entries(mercatoStats.posteValeur).sort((a, b) => b[1] - a[1]).map(([poste, count], i) => {
                      const maxVal = Math.max(...Object.values(mercatoStats.posteValeur));
                      const colors = ['bg-blue-600', 'bg-slate-400', 'bg-slate-300'];
                      return (
                        <div key={poste} className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300 w-20">{POSTE_LABEL[poste]}</span>
                          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                            <div className={`${colors[i]} h-2 rounded-full`} style={{ width: `${maxVal > 0 ? (count / maxVal) * 100 : 0}%` }}></div>
                          </div>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 w-10 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div data-card className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
                  <ShareBtn contextText="Nationalité la plus disputée — Mercato MPG" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Nationalité la plus disputée</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Nationalités avec le plus d'enchères concurrentes</p>
                  <div className="space-y-2">
                    {mercatoStats.natPlusDisputee.map(([nat, count], i) => {
                      const medals = ['🥇', '🥈', '🥉'];
                      const maxC = mercatoStats.natPlusDisputee[0]?.[1] || 1;
                      return (
                        <div key={nat} className="flex items-center gap-2">
                          <span className="text-sm w-5 flex-shrink-0">{medals[i]}</span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">{nat}</span>
                          <div className="w-16 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(count / maxC) * 100}%` }}></div>
                          </div>
                          <span className="text-sm text-slate-600 dark:text-slate-300 w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
