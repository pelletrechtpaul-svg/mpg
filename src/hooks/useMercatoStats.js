import { useMemo } from 'react';
import { JOUEURS_MERCATO, getPosteGroupe, medianFn } from '../shared.jsx';

export const useMercatoStats = (mercatoData) => useMemo(() => {
  if (mercatoData.length === 0) return null;

  const perPlayer = {};
  JOUEURS_MERCATO.forEach(j => {
    const entries = mercatoData.filter(e => e.acheteur === j);
    if (entries.length === 0) { perPlayer[j] = null; return; }
    const mediane = medianFn(entries.map(e => e.prix));
    const liguesMap = {};
    entries.forEach(e => { if (e.prix > 50) liguesMap[e.ligue] = (liguesMap[e.ligue] || 0) + 1; });
    let ligueFolie = null, ligueFolieCount = 0;
    Object.entries(liguesMap).forEach(([l, c]) => { if (c > ligueFolieCount) { ligueFolieCount = c; ligueFolie = l; } });
    const natsMap = {};
    entries.forEach(e => { if (e.nationalite) natsMap[e.nationalite] = (natsMap[e.nationalite] || 0) + 1; });
    let natPref = null, natMax = 0;
    Object.entries(natsMap).forEach(([n, c]) => { if (c > natMax) { natMax = c; natPref = n; } });
    const postesMap = { A: [], M: [], D: [] };
    entries.forEach(e => { const g = getPosteGroupe(e.poste); if (g && g !== 'G') postesMap[g].push(e.prix); });
    const postePref = Object.entries(postesMap).sort((a, b) => b[1].length - a[1].length)[0]?.[0] || null;
    perPlayer[j] = { mediane, ligueFolie, ligueFolieCount, natPref, natMax, natDistinctes: Object.keys(natsMap).length, postePref, postePrefCount: postePref ? postesMap[postePref].length : null, count: entries.length };
  });

  const posteValeur = { A: 0, M: 0, D: 0 };
  mercatoData.forEach(e => { const g = getPosteGroupe(e.poste); if (g && g !== 'G' && e.prix >= 30) posteValeur[g]++; });

  const ligueMedianes = {};
  mercatoData.forEach(e => { if (!ligueMedianes[e.ligue]) ligueMedianes[e.ligue] = []; ligueMedianes[e.ligue].push(e.prix); });
  const ligueRanking = Object.entries(ligueMedianes).map(([ligue, prices]) => ({ ligue, mediane: medianFn(prices), count: prices.length })).sort((a, b) => b.mediane - a.mediane);

  const roiTour = (tourNum) => {
    const champMap = {};
    mercatoData.forEach(e => {
      if (e.tour !== tourNum) return;
      const key = `${e.saison}_${e.ligue}_${e.championnat}`;
      if (!champMap[key]) { champMap[key] = {}; JOUEURS_MERCATO.forEach(j => { champMap[key][j] = 0; }); }
      champMap[key][e.acheteur] = (champMap[key][e.acheteur] || 0) + 1;
    });
    const keys = Object.keys(champMap);
    if (keys.length === 0) return null;
    const totals = {};
    JOUEURS_MERCATO.forEach(j => { totals[j] = 0; });
    keys.forEach(k => JOUEURS_MERCATO.forEach(j => { totals[j] += champMap[k][j] || 0; }));
    const averages = {};
    JOUEURS_MERCATO.forEach(j => { averages[j] = +(totals[j] / keys.length).toFixed(2); });
    const [winner, val] = Object.entries(averages).sort((a, b) => b[1] - a[1])[0];
    return { winner, val, averages };
  };

  const recrutementMoyen = (() => {
    const champMap = {};
    mercatoData.forEach(e => {
      const key = `${e.saison}_${e.ligue}_${e.championnat}`;
      if (!champMap[key]) { champMap[key] = {}; JOUEURS_MERCATO.forEach(j => { champMap[key][j] = 0; }); }
      if (e.acheteur) champMap[key][e.acheteur] = (champMap[key][e.acheteur] || 0) + 1;
    });
    const keys = Object.keys(champMap);
    if (keys.length === 0) return null;
    const totals = {};
    JOUEURS_MERCATO.forEach(j => { totals[j] = 0; });
    keys.forEach(k => JOUEURS_MERCATO.forEach(j => { totals[j] += champMap[k][j] || 0; }));
    const averages = {};
    JOUEURS_MERCATO.forEach(j => { averages[j] = +(totals[j] / keys.length).toFixed(1); });
    const [winner, val] = Object.entries(averages).sort((a, b) => b[1] - a[1])[0];
    return { winner, val, averages };
  })();

  const enchereWins = {};
  JOUEURS_MERCATO.forEach(j => { enchereWins[j] = 0; });
  mercatoData.forEach(e => { if ((e.encheres_perdues || []).length >= 1 && e.acheteur) enchereWins[e.acheteur]++; });
  const [roiEncheresWinner, roiEncheresVal] = Object.entries(enchereWins).sort((a, b) => b[1] - a[1])[0];

  const roiPoste = (posteGroupe) => {
    const shares = {};
    JOUEURS_MERCATO.forEach(j => {
      const entries = mercatoData.filter(e => e.acheteur === j && getPosteGroupe(e.poste) !== null);
      const total = entries.reduce((s, e) => s + e.prix, 0);
      const onPoste = entries.filter(e => getPosteGroupe(e.poste) === posteGroupe).reduce((s, e) => s + e.prix, 0);
      shares[j] = total > 0 ? +(onPoste / total * 100).toFixed(1) : 0;
    });
    const [winner, val] = Object.entries(shares).sort((a, b) => b[1] - a[1])[0];
    return { winner, val, shares };
  };

  const medianeParJoueur = {};
  JOUEURS_MERCATO.forEach(j => { medianeParJoueur[j] = medianFn(mercatoData.filter(e => e.acheteur === j).map(e => e.prix)); });

  return {
    perPlayer, posteValeur, podiumCher: [...mercatoData].sort((a, b) => b.prix - a.prix).slice(0, 3),
    podiumDispute: [...mercatoData].map(e => ({ ...e, totalMise: e.prix + (e.encheres_perdues || []).reduce((s, ep) => s + ep.prix, 0), nbEncheres: 1 + (e.encheres_perdues || []).length })).sort((a, b) => b.totalMise - a.totalMise).slice(0, 3),
    ligueRanking, roiTour1: roiTour(1), recrutementMoyen,
    roiBonnesAffaires: (() => { const counts = {}; JOUEURS_MERCATO.forEach(j => { counts[j] = 0; }); mercatoData.forEach(e => { if (e.prix === 1 && e.acheteur) counts[e.acheteur]++; }); const [winner] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]; return { winner, counts }; })(),
    chasseurSolitaire: (() => { const counts = {}; JOUEURS_MERCATO.forEach(j => { counts[j] = 0; }); mercatoData.forEach(e => { if ((e.encheres_perdues || []).length === 0 && e.acheteur) counts[e.acheteur]++; }); const [winner] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]; return { winner, counts }; })(),
    podiumEncheresPerduees: (() => { const perdues = []; mercatoData.forEach(e => { (e.encheres_perdues || []).forEach(ep => { perdues.push({ joueur: e.joueur, prenom: e.prenom, club: e.club, ligue: e.ligue, championnat: e.championnat, prixPerdu: ep.prix, equipePerdue: ep.equipe, acheteur: e.acheteur, prixGagnant: e.prix }); }); }); return perdues.sort((a, b) => b.prixPerdu - a.prixPerdu).slice(0, 3); })(),
    natPlusDisputee: (() => { const nats = {}; mercatoData.forEach(e => { if (!e.nationalite || (e.encheres_perdues || []).length === 0) return; nats[e.nationalite] = (nats[e.nationalite] || 0) + 1; }); return Object.entries(nats).sort((a, b) => b[1] - a[1]).slice(0, 3); })(),
    surencherisseur: (() => { const spreads = {}; const counts = {}; JOUEURS_MERCATO.forEach(j => { spreads[j] = 0; counts[j] = 0; }); mercatoData.forEach(e => { if (!e.acheteur || !(e.encheres_perdues || []).length) return; const maxLost = Math.max(...e.encheres_perdues.map(ep => ep.prix)); const spread = e.prix - maxLost; if (spread >= 0) { spreads[e.acheteur] += spread; counts[e.acheteur]++; } }); const avgSpreads = {}; JOUEURS_MERCATO.forEach(j => { avgSpreads[j] = counts[j] > 0 ? +(spreads[j] / counts[j]).toFixed(1) : 0; }); return { avgSpreads, counts }; })(),
    rivalites: (() => { const equipeMap = {}; mercatoData.forEach(e => { if (e.equipe_acheteur && e.acheteur) { const key = `${e.saison}_${e.ligue}_${e.championnat}`; if (!equipeMap[key]) equipeMap[key] = {}; equipeMap[key][e.equipe_acheteur] = e.acheteur; } }); const pairCounts = {}; mercatoData.forEach(e => { if (!e.acheteur || !(e.encheres_perdues || []).length) return; const champMap = equipeMap[`${e.saison}_${e.ligue}_${e.championnat}`] || {}; e.encheres_perdues.forEach(ep => { const loser = champMap[ep.equipe]; if (!loser || loser === e.acheteur) return; const pair = [e.acheteur, loser].sort().join(' vs '); pairCounts[pair] = (pairCounts[pair] || 0) + 1; }); }); return Object.entries(pairCounts).sort((a, b) => b[1] - a[1]).slice(0, 3); })(),
    encheresParTour: (() => { const tourData = {}; mercatoData.forEach(e => { if (!tourData[e.tour]) tourData[e.tour] = []; tourData[e.tour].push(e.prix); }); return [1,2,3,4].map(t => ({ tour: `Tour ${t}`, mediane: medianFn(tourData[t] || []), count: (tourData[t] || []).length })); })(),
    roiEncheres: { winner: roiEncheresWinner, val: roiEncheresVal, wins: enchereWins },
    roiAttaquants: roiPoste('A'), roiMilieux: roiPoste('M'), roiDefenseurs: roiPoste('D'), roiGardiens: roiPoste('G'),
    medianeParJoueur,
  };
}, [mercatoData]);
