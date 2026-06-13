import { useMemo } from 'react';
import { MANUAL_CHAMPIONSHIPS, groupMatchesByChampionship, calculatePlayerStats } from '../shared.jsx';

export const useChampionshipStats = (filteredData, joueurs, ligueMetadata, selectedSeason, selectedLigue, selectedChampionnat) => {
  const { victoiresChampionnat, medaillesChampionnat, victoiresDetail, medaillesDetail, perduUnPoint } = useMemo(() => {
    const victoires = {}, medailles = {}, victoiresLigues = {}, medaillesLigues = {}, perduUnPt = {};
    joueurs.forEach(j => { victoires[j] = 0; medailles[j] = 0; victoiresLigues[j] = []; medaillesLigues[j] = []; perduUnPt[j] = []; });

    Object.entries(groupMatchesByChampionship(filteredData)).forEach(([key, matches]) => {
      const metadata = ligueMetadata[key];
      if (!metadata || metadata.matchsEntered < metadata.matchsTotal) return;
      const ranking = Object.entries(calculatePlayerStats(matches, joueurs))
        .map(([joueur, data]) => ({ joueur, ...data }))
        .sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
      if (ranking.length === 0 || ranking[0].points === 0) return;
      const winner = ranking[0];
      const entry = { ligue: matches[0].ligue, saison: matches[0].saison };
      if (metadata.matchsTotal >= 6) { victoires[winner.joueur]++; victoiresLigues[winner.joueur].push(entry); } else { medailles[winner.joueur]++; medaillesLigues[winner.joueur].push(entry); }
      if (metadata.matchsTotal >= 6) {
        ranking.slice(1).forEach(p => {
          let raison = null;
          if (winner.points - p.points === 1) raison = '1 pt';
          else if (winner.points === p.points && winner.ga > p.ga) raison = 'goal avg';
          else if (winner.points === p.points && winner.ga === p.ga) raison = 'diff. part.';
          if (raison) perduUnPt[p.joueur].push({ ligue: matches[0].ligue, championnat: matches[0].championnat, saison: matches[0].saison, points: p.points, winnerPoints: winner.points, winnerGa: winner.ga, ga: p.ga, winner: winner.joueur, raison });
        });
      }
    });

    const filteredSeasons = new Set(filteredData.map(m => m.saison));
    MANUAL_CHAMPIONSHIPS.forEach(mc => {
      if (!filteredSeasons.has(mc.saison) && selectedSeason !== 'All-Time') return;
      const sorted = [...mc.standings].sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
      if (sorted.length === 0 || victoires[sorted[0].joueur] === undefined) return;
      const winnerJoueur = sorted[0].joueur;
      const entry = { ligue: mc.ligue, saison: mc.saison };
      if (mc.matchsTotal >= 6) {
        victoires[winnerJoueur]++; victoiresLigues[winnerJoueur].push(entry);
        sorted.slice(1).forEach(p => {
          if (!perduUnPt[p.joueur]) return;
          let raison = null;
          if (sorted[0].points - p.points === 1) raison = '1 pt';
          else if (sorted[0].points === p.points && sorted[0].ga > p.ga) raison = 'goal avg';
          else if (sorted[0].points === p.points && sorted[0].ga === p.ga) raison = 'diff. part.';
          if (raison) perduUnPt[p.joueur].push({ ligue: mc.ligue, championnat: mc.championnat, saison: mc.saison, points: p.points, winnerPoints: sorted[0].points, winnerGa: sorted[0].ga, ga: p.ga, winner: winnerJoueur, raison });
        });
      } else { medailles[winnerJoueur]++; medaillesLigues[winnerJoueur].push(entry); }
    });

    return { victoiresChampionnat: victoires, medaillesChampionnat: medailles, victoiresDetail: victoiresLigues, medaillesDetail: medaillesLigues, perduUnPoint: perduUnPt };
  }, [filteredData, joueurs, ligueMetadata, selectedSeason]);

  const classementGeneral = useMemo(() => {
    const stats = calculatePlayerStats(filteredData, joueurs);
    const filteredSeasons = new Set(filteredData.map(m => m.saison));
    MANUAL_CHAMPIONSHIPS.forEach(mc => {
      if (!filteredSeasons.has(mc.saison) && selectedSeason !== 'All-Time') return;
      mc.standings.forEach(s => {
        if (!stats[s.joueur]) return;
        stats[s.joueur].points += s.points; stats[s.joueur].matchs += s.matchs;
        stats[s.joueur].victoires += s.victoires; stats[s.joueur].nuls += s.nuls;
        stats[s.joueur].defaites += s.defaites; stats[s.joueur].ga += s.ga;
      });
    });
    Object.keys(stats).forEach(joueur => {
      stats[joueur].pointsMatch = stats[joueur].points;
      stats[joueur].points += victoiresChampionnat[joueur] * 3 + medaillesChampionnat[joueur] * 2;
      stats[joueur].victoiresChampionnat = victoiresChampionnat[joueur];
      stats[joueur].medaillesChampionnat = medaillesChampionnat[joueur];
      stats[joueur].victoiresLigues = victoiresDetail[joueur] || [];
      stats[joueur].medaillesLigues = medaillesDetail[joueur] || [];
    });
    return Object.entries(stats).map(([joueur, data]) => ({ joueur, ...data })).sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
  }, [filteredData, joueurs, victoiresChampionnat, medaillesChampionnat, victoiresDetail, medaillesDetail, selectedSeason]);

  const classementParLigue = useMemo(() => {
    if (selectedLigue === 'general') return classementGeneral;
    let matchesToUse = filteredData.filter(m => m.ligue === selectedLigue);
    if (selectedChampionnat !== 'total') matchesToUse = matchesToUse.filter(m => m.championnat === selectedChampionnat);
    const stats = calculatePlayerStats(matchesToUse, joueurs);
    const filteredSeasons = new Set(filteredData.map(m => m.saison));
    const relevantManual = MANUAL_CHAMPIONSHIPS.filter(mc => mc.ligue === selectedLigue && (selectedSeason === 'All-Time' || filteredSeasons.has(mc.saison)) && (selectedChampionnat === 'total' || mc.championnat === selectedChampionnat));
    relevantManual.forEach(mc => { mc.standings.forEach(s => { if (!stats[s.joueur]) return; stats[s.joueur].points += s.points; stats[s.joueur].matchs += s.matchs; stats[s.joueur].victoires += s.victoires; stats[s.joueur].nuls += s.nuls; stats[s.joueur].defaites += s.defaites; stats[s.joueur].ga += s.ga; }); });

    if (selectedChampionnat === 'total') {
      const championnatsMap = {};
      matchesToUse.forEach(match => { const key = `${match.saison}||${match.championnat}`; if (!championnatsMap[key]) championnatsMap[key] = []; championnatsMap[key].push(match); });
      const ligueVictoires = {}, ligueMedailles = {}, ligueVictoiresLigues = {}, ligueMedaillesLigues = {};
      joueurs.forEach(j => { ligueVictoires[j] = 0; ligueMedailles[j] = 0; ligueVictoiresLigues[j] = []; ligueMedaillesLigues[j] = []; });
      Object.entries(championnatsMap).forEach(([, matches]) => {
        const metadataKey = `${matches[0].saison}-${selectedLigue}-${matches[0].championnat}`;
        const metadata = ligueMetadata[metadataKey];
        if (!metadata || metadata.matchsEntered < metadata.matchsTotal) return;
        const ranking = Object.entries(calculatePlayerStats(matches, joueurs)).map(([joueur, data]) => ({ joueur, ...data })).sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
        if (ranking.length > 0 && ranking[0].points > 0) {
          const winner = ranking[0].joueur;
          const entry = { ligue: selectedLigue, saison: matches[0].saison };
          if (metadata.matchsTotal >= 6) { ligueVictoires[winner]++; ligueVictoiresLigues[winner].push(entry); } else { ligueMedailles[winner]++; ligueMedaillesLigues[winner].push(entry); }
        }
      });
      relevantManual.forEach(mc => {
        const sorted = [...mc.standings].sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
        if (sorted.length === 0 || ligueVictoires[sorted[0].joueur] === undefined) return;
        const winner = sorted[0].joueur;
        const entry = { ligue: mc.ligue, saison: mc.saison };
        if (mc.matchsTotal >= 6) { ligueVictoires[winner]++; ligueVictoiresLigues[winner].push(entry); } else { ligueMedailles[winner]++; ligueMedaillesLigues[winner].push(entry); }
      });
      const isAllTime = selectedSeason === 'All-Time';
      Object.keys(stats).forEach(joueur => {
        stats[joueur].pointsMatch = stats[joueur].points;
        if (!isAllTime) { stats[joueur].points += ligueVictoires[joueur] * 3 + ligueMedailles[joueur] * 2; }
        stats[joueur].victoiresChampionnat = ligueVictoires[joueur]; stats[joueur].medaillesChampionnat = ligueMedailles[joueur];
        stats[joueur].victoiresLigues = ligueVictoiresLigues[joueur]; stats[joueur].medaillesLigues = ligueMedaillesLigues[joueur];
      });
    }
    return Object.entries(stats).map(([joueur, data]) => ({ joueur, ...data })).sort((a, b) => b.points !== a.points ? b.points - a.points : b.ga - a.ga);
  }, [selectedLigue, selectedChampionnat, filteredData, joueurs, classementGeneral, ligueMetadata, selectedSeason]);

  return { victoiresChampionnat, medaillesChampionnat, victoiresDetail, medaillesDetail, perduUnPoint, classementGeneral, classementParLigue };
};
