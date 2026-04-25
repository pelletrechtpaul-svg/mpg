#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.argv[2] || process.env.MPG_TOKEN;
if (!TOKEN) {
  console.error('Usage: node scrape-mpg.cjs <TOKEN>');
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

let totalSaved = 0;

function save(name, data) {
  const file = path.join(OUTPUT_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  const size = JSON.stringify(data).length;
  totalSaved += size;
  console.log(`  ✓ data/${name}.json (${(size / 1024).toFixed(1)} KB)`);
}

function get(urlPath) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.mpg.football',
      path: urlPath,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };
    https.get(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    }).on('error', e => resolve({ status: 0, body: e.message }));
  });
}

async function tryGet(label, urlPath) {
  const r = await get(urlPath);
  if (r.status === 200) {
    console.log(`  [${r.status}] ${urlPath}`);
    return r.body;
  } else {
    console.log(`  [${r.status}] ${urlPath}  ← skipped`);
    return null;
  }
}

async function main() {
  console.log('=== MPG Scraper ===\n');

  // ── 1. Profil utilisateur ──────────────────────────────────────────────────
  console.log('■ Utilisateur');
  const user = await tryGet('user', '/api/v1/user');
  if (user) {
    save('user', user);
    const name = user.firstName || user.username || user.userId || '?';
    console.log(`    → connecté en tant que : ${name}`);
  }

  // ── 2. Dashboard (liste des ligues) ────────────────────────────────────────
  console.log('\n■ Dashboard / Ligues');
  let leagues = [];

  const dashboard = await tryGet('dashboard', '/api/v1/dashboard');
  if (dashboard) {
    save('dashboard', dashboard);
    // Extraire les IDs de ligues selon la structure retournée
    if (dashboard.data?.leagueIds) leagues = dashboard.data.leagueIds;
    else if (dashboard.leagueIds) leagues = dashboard.leagueIds;
    else if (Array.isArray(dashboard.leagues)) leagues = dashboard.leagues.map(l => l.id || l);
    else if (dashboard.data?.leagues) leagues = dashboard.data.leagues.map(l => l.id || l);
    console.log(`    → ${leagues.length} ligue(s) trouvée(s)`);
  }

  // Fallback : endpoint user/leagues
  if (!leagues.length) {
    const ul = await tryGet('user/leagues', '/api/v1/user/leagues-available');
    if (ul) {
      save('user-leagues', ul);
      if (Array.isArray(ul)) leagues = ul.map(l => l.id || l);
      else if (ul.leagues) leagues = ul.leagues.map(l => l.id || l);
    }
  }

  if (!leagues.length) {
    console.log('\n  ⚠ Impossible de récupérer les ligues. Dump dashboard complet :');
    console.log(JSON.stringify(dashboard, null, 2)?.slice(0, 2000));
    return;
  }

  // ── 3. Pour chaque ligue ───────────────────────────────────────────────────
  for (const leagueIdRaw of leagues) {
    const leagueId = typeof leagueIdRaw === 'string' ? leagueIdRaw : leagueIdRaw.id;
    const slug = leagueId.replace(/[^a-zA-Z0-9_-]/g, '_');
    console.log(`\n■ Ligue ${leagueId}`);

    // Détails de la ligue
    const leagueInfo = await tryGet('league', `/api/v1/league/${leagueId}`);
    if (leagueInfo) save(`league_${slug}`, leagueInfo);

    // Classement
    const ranking = await tryGet('ranking', `/api/v1/league/${leagueId}/ranking`);
    if (ranking) save(`ranking_${slug}`, ranking);

    // Clubs (équipes des joueurs) dans la ligue
    const clubs = await tryGet('clubs', `/api/v1/league/${leagueId}/championship-clubs`);
    if (clubs) {
      save(`clubs_${slug}`, clubs);

      // Pour chaque club : détail avec l'effectif
      const clubList = clubs.championshipClubs || clubs.clubs || clubs.data || [];
      for (const club of clubList) {
        const clubId = club.id || club.mpgTeamId;
        if (!clubId) continue;
        const clubSlug = clubId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const clubDetail = await tryGet(`club/${clubId}`, `/api/v1/league/${leagueId}/championship-club/${clubId}`);
        if (clubDetail) save(`club_${slug}_${clubSlug}`, clubDetail);
      }
    }

    // Toutes les journées de jeu
    const gameWeeks = await tryGet('game-weeks', `/api/v1/league/${leagueId}/game-weeks`);
    if (gameWeeks) {
      save(`gameweeks_${slug}`, gameWeeks);

      // Résultats de chaque journée
      const gwList = gameWeeks.gameWeeks || gameWeeks.data || gameWeeks || [];
      for (const gw of gwList) {
        const gwId = gw.id || gw;
        if (!gwId) continue;
        const gwSlug = String(gwId).replace(/[^a-zA-Z0-9_-]/g, '_');
        const gwResult = await tryGet(`gw ${gwId}`, `/api/v1/league/${leagueId}/game-week/${gwId}`);
        if (gwResult) save(`gameweek_${slug}_${gwSlug}`, gwResult);
      }
    }

    // Mercato — marché des transferts de la ligue
    const transferMarket = await tryGet('transfer-market', `/api/v1/league/${leagueId}/transfer-market`);
    if (transferMarket) save(`transfer_market_${slug}`, transferMarket);

    // Historique des transferts
    const transfers = await tryGet('transfers', `/api/v1/league/${leagueId}/transfers`);
    if (transfers) save(`transfers_${slug}`, transfers);

    // Joueurs disponibles au mercato
    const availPlayers = await tryGet('available-players', `/api/v1/league/${leagueId}/available-players`);
    if (availPlayers) save(`available_players_${slug}`, availPlayers);

    // Stats des joueurs du championnat associé
    // L'ID du championnat est souvent inclus dans leagueInfo
    const champId = leagueInfo?.league?.championship?.id
      || leagueInfo?.championship?.id
      || leagueInfo?.championshipId;
    if (champId) {
      const champSlug = String(champId).replace(/[^a-zA-Z0-9_-]/g, '_');
      console.log(`    Championship ID : ${champId}`);

      const playerStats = await tryGet('player-stats', `/api/v1/championship-player-stats/${champId}`);
      if (playerStats) save(`player_stats_${champSlug}`, playerStats);

      const champPlayers = await tryGet('champ-players', `/api/v1/championship-available-players/${champId}`);
      if (champPlayers) save(`champ_players_${champSlug}`, champPlayers);
    }

    // Notes des joueurs (ratings) — via mercato/stats
    const ratings = await tryGet('ratings', `/api/v1/league/${leagueId}/player-ratings`);
    if (ratings) save(`ratings_${slug}`, ratings);

    // Scouting / notes individuelles
    const scouting = await tryGet('scouting', `/api/v1/league/${leagueId}/scouting`);
    if (scouting) save(`scouting_${slug}`, scouting);
  }

  // ── 4. Endpoints globaux (hors ligue spécifique) ───────────────────────────
  console.log('\n■ Données globales');

  // Calendrier des journées de tous les championnats réels
  for (const champCode of ['L1', 'PL', 'Liga', 'SerieA', 'BL']) {
    const cal = await tryGet(`calendar ${champCode}`, `/api/v1/championship-calendar/${champCode}`);
    if (cal) save(`calendar_${champCode}`, cal);
  }

  // Cotes / valeurs de marché des joueurs
  const mktValues = await tryGet('market-values', '/api/v1/championship-player-stats');
  if (mktValues) save('market_values', mktValues);

  // ── 5. Résumé ──────────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════`);
  console.log(`Scraping terminé.`);
  console.log(`Fichiers sauvegardés dans : scripts/data/`);
  console.log(`Total : ${(totalSaved / 1024).toFixed(1)} KB`);
  console.log(`\nListe des fichiers :`);
  fs.readdirSync(OUTPUT_DIR).sort().forEach(f => {
    const size = fs.statSync(path.join(OUTPUT_DIR, f)).size;
    console.log(`  ${f.padEnd(60)} ${(size / 1024).toFixed(1)} KB`);
  });
}

main().catch(console.error);
