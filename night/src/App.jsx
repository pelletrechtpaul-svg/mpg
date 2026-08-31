import React, { useMemo, useState } from 'react';

// Bundled at build time from data/*.json
const leagueModules = import.meta.glob('../../data/*.json', { eager: true });

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLAYER_COLORS = {
  Paul:   '#2563eb',
  Adrien: '#16a34a',
  Tiago:  '#9333ea',
  Roman:  '#ea580c',
};

// Map team name → player (à adapter si les noms d'équipes changent)
const TEAM_TO_PLAYER = {
  'Tout en Miam': 'Paul',
  'Kiwis':        'Adrien',
  'Raids Débiles':'Tiago',
  'The Champion': 'Roman',
};

function playerOf(teamName) {
  return TEAM_TO_PLAYER[teamName] ?? null;
}

function colorOf(teamName) {
  const p = playerOf(teamName);
  return p ? PLAYER_COLORS[p] : '#64748b';
}

// ─── Formatage date ───────────────────────────────────────────────────────────

function formatFetch(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Composants ───────────────────────────────────────────────────────────────

const s = {
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '24px 16px 48px',
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 'auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 20,
  },
  card: {
    background: '#1e293b',
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid #334155',
  },
  cardHeader: {
    padding: '14px 18px 10px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  leagueName: {
    fontWeight: 700,
    fontSize: 15,
    color: '#f1f5f9',
    lineHeight: 1.2,
  },
  gwBadge: {
    fontSize: 11,
    color: '#94a3b8',
    background: '#0f172a',
    padding: '2px 8px',
    borderRadius: 99,
    whiteSpace: 'nowrap',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    padding: '6px 10px',
    textAlign: 'right',
    color: '#64748b',
    fontWeight: 600,
    fontSize: 11,
    background: '#151f2e',
  },
  thLeft: {
    textAlign: 'left',
  },
  td: {
    padding: '8px 10px',
    textAlign: 'right',
    borderTop: '1px solid #1e293b',
    color: '#cbd5e1',
    background: '#1e293b',
  },
  tdLeft: {
    textAlign: 'left',
  },
  posNum: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    marginRight: 6,
    color: '#fff',
    flexShrink: 0,
  },
  teamCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
  },
  teamName: {
    fontWeight: 600,
    color: '#f1f5f9',
  },
  playerTag: {
    fontSize: 10,
    marginLeft: 6,
    opacity: 0.7,
    fontWeight: 400,
    color: '#94a3b8',
  },
  sectionLabel: {
    padding: '8px 18px 4px',
    fontSize: 11,
    color: '#475569',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontWeight: 700,
    background: '#151f2e',
  },
  matchRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 18px',
    borderTop: '1px solid #0f172a',
    gap: 8,
    fontSize: 13,
  },
  matchTeam: {
    flex: 1,
    fontWeight: 600,
    color: '#f1f5f9',
    fontSize: 12,
  },
  matchTeamRight: {
    textAlign: 'right',
  },
  scoreBox: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
    minWidth: 68,
    justifyContent: 'center',
  },
  score: {
    width: 28,
    textAlign: 'center',
    fontWeight: 800,
    fontSize: 15,
    color: '#f8fafc',
  },
  scoreSep: {
    color: '#475569',
    fontWeight: 300,
  },
  noData: {
    padding: '18px',
    color: '#475569',
    fontSize: 13,
    fontStyle: 'italic',
  },
  tabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    padding: '10px 14px 0',
    background: '#151f2e',
    borderBottom: '1px solid #334155',
  },
  tab: {
    padding: '4px 10px',
    borderRadius: '6px 6px 0 0',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    border: '1px solid transparent',
    borderBottom: 'none',
    marginBottom: '-1px',
    color: '#64748b',
    background: 'transparent',
  },
  tabActive: {
    color: '#93c5fd',
    background: '#1e293b',
    border: '1px solid #334155',
    borderBottom: '1px solid #1e293b',
  },
  emptyPage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: 12,
    color: '#475569',
  },
};

function PositionBadge({ pos, color }) {
  return (
    <span style={{ ...s.posNum, background: color + '33', color }}>
      {pos}
    </span>
  );
}

function RankingTable({ ranking }) {
  if (!ranking?.length) return <p style={s.noData}>Pas de classement disponible</p>;
  return (
    <table style={s.table}>
      <thead>
        <tr>
          <th style={{ ...s.th, ...s.thLeft }}>Équipe</th>
          <th style={s.th}>J</th>
          <th style={s.th}>V</th>
          <th style={s.th}>N</th>
          <th style={s.th}>D</th>
          <th style={s.th}>GA</th>
          <th style={{ ...s.th, color: '#93c5fd' }}>Pts</th>
        </tr>
      </thead>
      <tbody>
        {ranking.map((t, i) => {
          const color = colorOf(t.teamName);
          const player = playerOf(t.teamName);
          const ga = (t.goalsFor ?? 0) - (t.goalsAgainst ?? 0);
          return (
            <tr key={t.teamId || i} style={{ background: i % 2 === 0 ? '#1a2744' : '#1e293b' }}>
              <td style={{ ...s.td, ...s.tdLeft, background: 'inherit' }}>
                <div style={s.teamCell}>
                  <PositionBadge pos={t.position ?? i + 1} color={color} />
                  <span style={{ ...s.teamName, color }}>{t.teamName}</span>
                  {player && <span style={s.playerTag}>{player}</span>}
                </div>
              </td>
              <td style={{ ...s.td, background: 'inherit' }}>{t.played ?? '—'}</td>
              <td style={{ ...s.td, background: 'inherit', color: '#4ade80' }}>{t.won ?? '—'}</td>
              <td style={{ ...s.td, background: 'inherit' }}>{t.drawn ?? '—'}</td>
              <td style={{ ...s.td, background: 'inherit', color: '#f87171' }}>{t.lost ?? '—'}</td>
              <td style={{ ...s.td, background: 'inherit', color: ga >= 0 ? '#4ade80' : '#f87171' }}>
                {ga >= 0 ? `+${ga}` : ga}
              </td>
              <td style={{ ...s.td, background: 'inherit', fontWeight: 800, color: '#93c5fd', fontSize: 14 }}>
                {t.points ?? '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function GameWeekResults({ gw, label }) {
  if (!gw?.games?.length) return null;

  return (
    <>
      <p style={s.sectionLabel}>
        {label ?? `Journée ${gw.number ?? '?'}`}
      </p>
      {gw.games.map((g, i) => {
        const homeColor = colorOf(g.homeTeamName);
        const awayColor = colorOf(g.awayTeamName);
        const hScore = g.homeScore !== null && g.homeScore !== undefined ? Math.round(g.homeScore * 10) / 10 : '?';
        const aScore = g.awayScore !== null && g.awayScore !== undefined ? Math.round(g.awayScore * 10) / 10 : '?';
        const homeWin = g.homeScore != null && g.awayScore != null && g.homeScore > g.awayScore;
        const awayWin = g.homeScore != null && g.awayScore != null && g.awayScore > g.homeScore;

        return (
          <div key={i} style={s.matchRow}>
            <span style={{ ...s.matchTeam, color: homeColor, opacity: awayWin ? 0.55 : 1 }}>
              {g.homeTeamName || '—'}
            </span>
            <div style={s.scoreBox}>
              <span style={{ ...s.score, opacity: awayWin ? 0.55 : 1 }}>{hScore}</span>
              <span style={s.scoreSep}>–</span>
              <span style={{ ...s.score, opacity: homeWin ? 0.55 : 1 }}>{aScore}</span>
            </div>
            <span style={{ ...s.matchTeam, ...s.matchTeamRight, color: awayColor, opacity: homeWin ? 0.55 : 1 }}>
              {g.awayTeamName || '—'}
            </span>
          </div>
        );
      })}
    </>
  );
}

function ChampionnatTabs({ championnats, selected, onSelect }) {
  if (!championnats?.length) return null;
  return (
    <div style={s.tabs}>
      <button
        style={{ ...s.tab, ...(selected === 'general' ? s.tabActive : {}) }}
        onClick={() => onSelect('general')}
      >
        Général
      </button>
      {championnats.map(c => (
        <button
          key={c.number}
          style={{ ...s.tab, ...(selected === c.number ? s.tabActive : {}) }}
          onClick={() => onSelect(c.number)}
        >
          #{c.number}
        </button>
      ))}
    </div>
  );
}

function LeagueCard({ data }) {
  const hasChampionnats = data.championnats?.length > 0;
  const [selectedChamp, setSelectedChamp] = useState(hasChampionnats ? 'general' : null);

  const gwLabel = data.currentGameWeek != null && data.totalGameWeeks != null
    ? `GJ ${data.currentGameWeek} / ${data.totalGameWeeks}`
    : data.currentGameWeek != null
    ? `GJ ${data.currentGameWeek}`
    : null;

  const ranking = useMemo(() => {
    if (!hasChampionnats || selectedChamp === 'general') return data.ranking;
    return data.championnats.find(c => c.number === selectedChamp)?.ranking ?? data.ranking;
  }, [selectedChamp, data, hasChampionnats]);

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.leagueName}>{data.leagueName || data.leagueCode}</span>
        {gwLabel && <span style={s.gwBadge}>{gwLabel}</span>}
      </div>

      {hasChampionnats && (
        <ChampionnatTabs
          championnats={data.championnats}
          selected={selectedChamp}
          onSelect={setSelectedChamp}
        />
      )}

      <RankingTable ranking={ranking} />

      {data.lastGameWeek && (
        <GameWeekResults
          gw={data.lastGameWeek}
          label={`Journée ${data.lastGameWeek.number ?? '?'} — résultats`}
        />
      )}

      {data.previousGameWeeks?.map(gw => (
        <GameWeekResults key={gw.number} gw={gw} label={`Journée ${gw.number}`} />
      ))}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const leagues = useMemo(() => {
    return Object.values(leagueModules)
      .map(m => m.default ?? m)
      .filter(d => d?.leagueCode)
      .sort((a, b) => (a.leagueName ?? '').localeCompare(b.leagueName ?? '', 'fr'));
  }, []);

  const lastFetch = useMemo(() => {
    const dates = leagues.map(l => l.fetchedAt).filter(Boolean);
    if (!dates.length) return null;
    return dates.sort().at(-1);
  }, [leagues]);

  if (!leagues.length) {
    return (
      <div style={s.emptyPage}>
        <span style={{ fontSize: 40 }}>🌙</span>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>MPG vit la nuit</p>
        <p style={{ fontSize: 13 }}>Aucune donnée disponible. Lance le workflow de fetch.</p>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>🌙 MPG vit la nuit</h1>
        {lastFetch && (
          <span style={s.subtitle}>Mis à jour le {formatFetch(lastFetch)}</span>
        )}
      </div>

      <div style={s.grid}>
        {leagues.map(d => (
          <LeagueCard key={d.leagueCode} data={d} />
        ))}
      </div>
    </div>
  );
}
