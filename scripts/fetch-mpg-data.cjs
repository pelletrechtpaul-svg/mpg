#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://api.mpg.football';
const DATA_DIR = path.join(__dirname, '..', 'data');

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpGet(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get(
      { hostname: u.hostname, path: u.pathname + u.search, headers: { Authorization: token } },
      res => {
        let body = '';
        res.on('data', c => (body += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(body)); }
            catch (e) { reject(new Error(`JSON parse: ${e.message} — ${body.slice(0, 120)}`)); }
          } else {
            reject(new Error(`HTTP ${res.statusCode} on ${url}: ${body.slice(0, 200)}`));
          }
        });
      }
    ).on('error', reject);
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(new Error(`JSON parse: ${e.message}`)); }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getToken() {
  const refreshToken = process.env.MPG_REFRESH_TOKEN;
  const staticToken = process.env.MPG_TOKEN;

  if (refreshToken) {
    try {
      console.log('Refreshing MPG token…');
      const res = await httpPost(`${BASE}/api/data/user-signin`, { token: refreshToken });
      const token = res?.data?.token || res?.token;
      if (token) { console.log('Token refreshed ✓'); return token; }
    } catch (e) {
      console.warn(`Token refresh failed (${e.message}), falling back to MPG_TOKEN`);
    }
  }

  if (staticToken) { console.log('Using MPG_TOKEN'); return staticToken; }
  throw new Error('No token: set MPG_TOKEN or MPG_REFRESH_TOKEN');
}

// ─── Championship ID parsing ──────────────────────────────────────────────────
// IDs follow pattern: mpg_championship_{CODE}_{SEASON}_{PHASE}

function parseChampId(id) {
  if (!id) return { season: null, phase: null, prefix: null };
  const parts = id.split('_');
  if (parts.length < 2) return { season: null, phase: null, prefix: null };
  const phase = parseInt(parts[parts.length - 1], 10);
  const season = parseInt(parts[parts.length - 2], 10);
  const prefix = parts.slice(0, -1).join('_');
  return {
    season: isNaN(season) ? null : season,
    phase: isNaN(phase) ? null : phase,
    prefix,
  };
}

// ─── Ranking extraction (handles various API response shapes) ─────────────────

function extractRanking(data) {
  const candidates = [
    data?.data?.ranking,
    data?.ranking,
    data?.data?.league?.championship?.teamStatus,
    data?.data?.league?.teams,
  ].filter(Array.isArray);

  if (!candidates.length) return [];
  const raw = candidates[0];

  return raw.map((t, i) => ({
    position: t.rank ?? t.position ?? i + 1,
    teamId: t.teamId || t.id || '',
    teamName: t.teamName || t.name || `Équipe ${i + 1}`,
    points: t.points ?? t.matchPoints ?? 0,
    played: t.played ?? t.matchPlayed ?? t.numberOfMatchPlayed ?? 0,
    won: t.won ?? t.matchWon ?? t.numberOfMatchWon ?? 0,
    drawn: t.drawn ?? t.matchDrawn ?? t.numberOfMatchDrawn ?? 0,
    lost: t.lost ?? t.matchLost ?? t.numberOfMatchLost ?? 0,
    goalsFor: t.goalsFor ?? t.goalFor ?? t.numberOfGoalFor ?? 0,
    goalsAgainst: t.goalsAgainst ?? t.goalAgainst ?? t.numberOfGoalAgainst ?? 0,
  }));
}

// ─── Per-league fetch ─────────────────────────────────────────────────────────

async function fetchLeague(code, token) {
  const leagueId = `mpg_league_${code}`;
  console.log(`  GET /api/data/league/${leagueId}`);

  let leagueResp;
  try {
    leagueResp = await httpGet(`${BASE}/api/data/league/${leagueId}`, token);
  } catch (e) {
    console.warn(`  Retry without prefix…`);
    leagueResp = await httpGet(`${BASE}/api/data/league/${code}`, token);
  }

  const league = leagueResp?.data?.league ?? leagueResp?.league ?? leagueResp;
  const championship = league?.championship ?? {};
  const championshipId = championship?.id ?? null;
  const currentDay = championship?.numberOfDay ?? championship?.currentDay ?? null;

  // Build teamId → teamName map
  const teamMap = {};
  for (const t of [
    ...(league?.teams ?? []),
    ...(league?.users ?? []),
    ...(championship?.teams ?? []),
  ]) {
    const id = t.teamId ?? t.id;
    const name = t.teamName ?? t.name ?? t.login ?? t.firstName ?? '';
    if (id && name) teamMap[id] = name;
  }

  // Ranking — try dedicated endpoint first, fall back to inline
  let ranking = extractRanking(leagueResp);
  if (ranking.length === 0 && championshipId) {
    try {
      console.log(`  GET /api/data/championship-ranking/${championshipId}`);
      const r = await httpGet(`${BASE}/api/data/championship-ranking/${championshipId}`, token);
      ranking = extractRanking(r);
    } catch (e) {
      console.warn(`  Ranking endpoint failed: ${e.message}`);
    }
  }

  // Enrich team names from map
  ranking = ranking.map(r => ({ ...r, teamName: teamMap[r.teamId] || r.teamName }));

  // Sort by points desc, then goal diff
  ranking.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
  });
  ranking = ranking.map((r, i) => ({ ...r, position: i + 1 }));

  // Last game week
  let lastGameWeek = null;
  const gwId = championship?.gameWeekId ?? championship?.currentGameWeekId ?? null;
  if (gwId) {
    try {
      console.log(`  GET /api/data/championship-game/${gwId}`);
      const gwResp = await httpGet(`${BASE}/api/data/championship-game/${gwId}`, token);
      const game = gwResp?.data?.game ?? gwResp?.game ?? gwResp;
      const games = game?.leagues ?? game?.games ?? game?.matches ?? [];
      lastGameWeek = {
        number: currentDay,
        id: gwId,
        games: games.map(g => {
          const homeId = g.homeTeamId ?? g.home?.id;
          const awayId = g.awayTeamId ?? g.away?.id;
          return {
            homeTeamId: homeId,
            homeTeamName: teamMap[homeId] ?? g.home?.name ?? homeId ?? '',
            awayTeamId: awayId,
            awayTeamName: teamMap[awayId] ?? g.away?.name ?? awayId ?? '',
            homeScore: g.homeScore ?? g.home?.score ?? null,
            awayScore: g.awayScore ?? g.away?.score ?? null,
            status: g.status ?? 'unknown',
          };
        }),
      };
    } catch (e) {
      console.warn(`  Game week fetch failed: ${e.message}`);
    }
  }

  // All championnats of the current season
  const championnats = [];
  const { season: currentSeason, phase: currentPhase, prefix: champPrefix } = parseChampId(championshipId);
  if (champPrefix && currentPhase !== null) {
    for (let p = 1; p <= currentPhase; p++) {
      const champId = `${champPrefix}_${p}`;
      try {
        console.log(`  GET /api/data/championship-ranking/${champId} (championnat ${p})`);
        const r = await httpGet(`${BASE}/api/data/championship-ranking/${champId}`, token);
        let champRanking = extractRanking(r);
        champRanking = champRanking.map(r => ({ ...r, teamName: teamMap[r.teamId] || r.teamName }));
        champRanking.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
        });
        champRanking = champRanking.map((r, i) => ({ ...r, position: i + 1 }));
        championnats.push({ id: champId, number: p, ranking: champRanking });
      } catch (e) {
        console.warn(`  Championnat ${p} failed: ${e.message}`);
        break;
      }
    }
  }

  // Previous game weeks (up to last 3)
  const previousGameWeeks = [];
  if (championshipId && currentDay && currentDay > 1) {
    for (let day = currentDay - 1; day >= Math.max(1, currentDay - 3); day--) {
      const prevGwId = gwId
        ? gwId.replace(/_\d+$/, `_${day}`)
        : `${championshipId}_${day}`;
      try {
        console.log(`  GET /api/data/championship-game/${prevGwId}`);
        const gwResp = await httpGet(`${BASE}/api/data/championship-game/${prevGwId}`, token);
        const game = gwResp?.data?.game ?? gwResp?.game ?? gwResp;
        const games = game?.leagues ?? game?.games ?? game?.matches ?? [];
        previousGameWeeks.unshift({
          number: day,
          id: prevGwId,
          games: games.map(g => {
            const homeId = g.homeTeamId ?? g.home?.id;
            const awayId = g.awayTeamId ?? g.away?.id;
            return {
              homeTeamId: homeId,
              homeTeamName: teamMap[homeId] ?? g.home?.name ?? homeId ?? '',
              awayTeamId: awayId,
              awayTeamName: teamMap[awayId] ?? g.away?.name ?? awayId ?? '',
              homeScore: g.homeScore ?? g.home?.score ?? null,
              awayScore: g.awayScore ?? g.away?.score ?? null,
              status: g.status ?? 'unknown',
            };
          }),
        });
      } catch (_) {
        break;
      }
    }
  }

  return {
    leagueCode: code,
    leagueName: league?.name ?? code,
    fetchedAt: new Date().toISOString(),
    currentGameWeek: currentDay,
    totalGameWeeks: championship?.numberOfTeams
      ? (championship.numberOfTeams - 1) * 2
      : null,
    ranking,
    championnats,
    lastGameWeek,
    previousGameWeeks,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const codes = (process.env.MPG_LEAGUE_CODES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (!codes.length) {
    console.error('MPG_LEAGUE_CODES is empty');
    process.exit(1);
  }

  const token = await getToken();
  fs.mkdirSync(DATA_DIR, { recursive: true });

  let ok = 0;
  for (const code of codes) {
    console.log(`\n── ${code} ─────────────────────────`);
    try {
      const data = await fetchLeague(code, token);
      const outPath = path.join(DATA_DIR, `${code}.json`);
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
      console.log(`✅ ${code} → ${data.leagueName} | GJ${data.currentGameWeek} | ${data.ranking.length} équipes`);
      ok++;
    } catch (e) {
      console.error(`❌ ${code}: ${e.message}`);
    }
  }

  console.log(`\n══ ${ok}/${codes.length} ligues récupérées ══`);
  if (ok === 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
