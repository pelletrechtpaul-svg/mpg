// ============================================================
// MPG SCRAPER — coller dans la console DevTools sur mpg.football
// ============================================================
(async () => {
  const TOKEN = localStorage.getItem('token') || sessionStorage.getItem('token') || (() => {
    // Essaie de récupérer le token depuis les cookies / storage MPG
    for (const k of Object.keys(localStorage)) {
      const v = localStorage.getItem(k);
      if (v && v.startsWith('eyJ')) return v;
    }
    return prompt('Token JWT MPG (copie depuis DevTools > Network > Authorization header) :');
  })();

  if (!TOKEN) { console.error('Pas de token trouvé'); return; }
  console.log('%c MPG Scraper démarré ', 'background:#1d4ed8;color:white;font-weight:bold;padding:4px 8px;border-radius:4px');

  const results = {};
  const errors  = {};

  async function get(key, path) {
    try {
      const r = await fetch(`https://api.mpg.football${path}`, {
        headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' }
      });
      const text = await r.text();
      if (r.ok) {
        results[key] = JSON.parse(text);
        console.log(`%c ✓ ${key} %c ${path}`, 'color:green;font-weight:bold', 'color:gray');
        return results[key];
      } else {
        errors[key] = { status: r.status, path };
        console.log(`%c ✗ ${key} %c [${r.status}] ${path}`, 'color:red', 'color:gray');
        return null;
      }
    } catch(e) {
      errors[key] = { status: 0, path, error: e.message };
      console.log(`%c ✗ ${key} %c ${e.message}`, 'color:red', 'color:gray');
      return null;
    }
  }

  // ── Utilisateur ─────────────────────────────────────────────────────────────
  const user = await get('user', '/api/v1/user');

  // ── Dashboard / ligues ───────────────────────────────────────────────────────
  const dash = await get('dashboard', '/api/v1/dashboard');
  await get('user_leagues', '/api/v1/user/leagues-available');

  // Extraire les IDs de ligues
  let leagueIds = [];
  const src = dash || results['user_leagues'];
  if (src) {
    const flat = src.data || src;
    if (flat.leagueIds)            leagueIds = flat.leagueIds;
    else if (flat.leagues)         leagueIds = flat.leagues.map(l => l.id || l);
    else if (Array.isArray(flat))  leagueIds = flat.map(l => l.id || l);
  }
  console.log(`%c → ${leagueIds.length} ligue(s) détectée(s)`, 'font-weight:bold');

  // ── Par ligue ────────────────────────────────────────────────────────────────
  for (const rawId of leagueIds) {
    const lid  = typeof rawId === 'string' ? rawId : rawId.id;
    const slug = lid.replace(/[^a-zA-Z0-9_-]/g, '_');
    console.log(`%c ■ Ligue ${lid}`, 'background:#374151;color:white;padding:2px 6px;border-radius:3px');

    const league = await get(`league_${slug}`,       `/api/v1/league/${lid}`);
    await         get(`ranking_${slug}`,             `/api/v1/league/${lid}/ranking`);
    await         get(`game_weeks_${slug}`,          `/api/v1/league/${lid}/game-weeks`);
    await         get(`transfer_market_${slug}`,     `/api/v1/league/${lid}/transfer-market`);
    await         get(`transfers_${slug}`,           `/api/v1/league/${lid}/transfers`);
    await         get(`available_players_${slug}`,   `/api/v1/league/${lid}/available-players`);
    await         get(`ratings_${slug}`,             `/api/v1/league/${lid}/player-ratings`);
    await         get(`scouting_${slug}`,            `/api/v1/league/${lid}/scouting`);

    // Clubs (équipes des joueurs)
    const clubs = await get(`clubs_${slug}`, `/api/v1/league/${lid}/championship-clubs`);
    const clubList = clubs?.championshipClubs || clubs?.clubs || [];
    for (const club of clubList) {
      const cid   = club.id || club.mpgTeamId;
      if (!cid) continue;
      const cslug = cid.replace(/[^a-zA-Z0-9_-]/g, '_');
      await get(`club_${slug}_${cslug}`, `/api/v1/league/${lid}/championship-club/${cid}`);
    }

    // Résultats des journées
    const gwData = results[`game_weeks_${slug}`];
    const gwList = gwData?.gameWeeks || gwData?.data || (Array.isArray(gwData) ? gwData : []);
    for (const gw of gwList) {
      const gwId   = gw.id || gw;
      const gwSlug = String(gwId).replace(/[^a-zA-Z0-9_-]/g, '_');
      await get(`gw_${slug}_${gwSlug}`, `/api/v1/league/${lid}/game-week/${gwId}`);
    }

    // Stats joueurs du championnat associé
    const champId = league?.league?.championship?.id || league?.championship?.id || league?.championshipId;
    if (champId) {
      const cs = String(champId).replace(/[^a-zA-Z0-9_-]/g, '_');
      await get(`player_stats_${cs}`,  `/api/v1/championship-player-stats/${champId}`);
      await get(`champ_players_${cs}`, `/api/v1/championship-available-players/${champId}`);
    }
  }

  // ── Résumé et téléchargement ─────────────────────────────────────────────────
  const output = { _scraped_at: new Date().toISOString(), results, errors };
  const successCount = Object.keys(results).length;
  const errorCount   = Object.keys(errors).length;

  console.log(`%c Scraping terminé : ${successCount} succès, ${errorCount} échecs `,
    'background:#16a34a;color:white;font-weight:bold;padding:4px 8px;border-radius:4px');

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'mpg-scrape.json' });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  console.log('%c ✓ Téléchargement de mpg-scrape.json lancé', 'color:green;font-weight:bold');
  console.log('Clés disponibles :', Object.keys(results));
  return output;
})();
