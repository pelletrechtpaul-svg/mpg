import { describe, it, expect } from 'vitest';
import { calculatePlayerStats, groupMatchesByChampionship, calculateLongestStreak, encodeFirestoreKey, decodeFirestoreKey, medianFn, getPosteGroupe } from '../helpers.js';

const makeMatch = (j1, j2, b1, b2, overrides = {}) => {
  const p1 = b1 > b2 ? 3 : b1 === b2 ? 1 : 0;
  const p2 = b2 > b1 ? 3 : b1 === b2 ? 1 : 0;
  return { joueur1: j1, joueur2: j2, buts_j1: b1, buts_j2: b2, points_j1: p1, points_j2: p2, saison: '2025/2026', ligue: 'L1', championnat: '#1', dateMatch: '2025-01-01', ...overrides };
};

describe('calculatePlayerStats', () => {
  it('counts wins/draws/losses correctly', () => {
    const matches = [makeMatch('Paul', 'Adrien', 2, 1), makeMatch('Paul', 'Adrien', 1, 1), makeMatch('Paul', 'Adrien', 0, 2)];
    const stats = calculatePlayerStats(matches, ['Paul', 'Adrien']);
    expect(stats.Paul.victoires).toBe(1);
    expect(stats.Paul.nuls).toBe(1);
    expect(stats.Paul.defaites).toBe(1);
    expect(stats.Paul.points).toBe(4);
    expect(stats.Adrien.points).toBe(4);
  });

  it('computes goal average', () => {
    const stats = calculatePlayerStats([makeMatch('Paul', 'Adrien', 3, 1)], ['Paul', 'Adrien']);
    expect(stats.Paul.ga).toBe(2);
    expect(stats.Adrien.ga).toBe(-2);
  });

  it('ignores matches for unknown players', () => {
    const stats = calculatePlayerStats([makeMatch('Paul', 'Tiago', 1, 0)], ['Paul']);
    expect(stats.Paul.matchs).toBe(1);
    expect(stats.Tiago).toBeUndefined();
  });

  it('initializes missing players with zeroes', () => {
    const stats = calculatePlayerStats([], ['Roman']);
    expect(stats.Roman).toEqual({ points: 0, matchs: 0, victoires: 0, nuls: 0, defaites: 0, buts_pour: 0, buts_contre: 0, ga: 0 });
  });
});

describe('groupMatchesByChampionship', () => {
  it('groups by saison-ligue-championnat', () => {
    const m1 = makeMatch('Paul', 'Adrien', 1, 0);
    const m2 = makeMatch('Paul', 'Adrien', 2, 1, { championnat: '#2' });
    const groups = groupMatchesByChampionship([m1, m2]);
    expect(Object.keys(groups)).toHaveLength(2);
    expect(groups['2025/2026-L1-#1']).toHaveLength(1);
  });
});

describe('calculateLongestStreak', () => {
  it('finds longest win streak', () => {
    const matches = [
      { result: 'W' }, { result: 'W' }, { result: 'L' },
      { result: 'W' }, { result: 'W' }, { result: 'W' },
    ].map((r, i) => ({ ...r, date: `2025-01-0${i + 1}` }));
    const streak = calculateLongestStreak(matches, m => m.result === 'W');
    expect(streak.length).toBe(3);
  });

  it('returns null when no match found', () => {
    const matches = [{ result: 'L', date: '2025-01-01' }];
    expect(calculateLongestStreak(matches, m => m.result === 'W')).toBeNull();
  });
});

describe('encodeFirestoreKey / decodeFirestoreKey', () => {
  it('round-trips correctly', () => {
    const key = '2025/2026-Ligue 1-#1';
    expect(decodeFirestoreKey(encodeFirestoreKey(key))).toBe(key);
  });
  it('replaces slashes', () => {
    expect(encodeFirestoreKey('a/b')).toBe('a_b');
  });
});

describe('medianFn', () => {
  it('returns median of odd-length array', () => {
    expect(medianFn([1, 3, 2])).toBe(2);
  });
  it('returns average of middle two for even-length', () => {
    expect(medianFn([1, 2, 3, 4])).toBe(Math.round((2 + 3) / 2));
  });
  it('returns 0 for empty array', () => {
    expect(medianFn([])).toBe(0);
  });
});

describe('getPosteGroupe', () => {
  it('maps attaquants', () => { expect(getPosteGroupe('A')).toBe('A'); });
  it('maps milieux', () => { expect(getPosteGroupe('MC')).toBe('M'); });
  it('maps défenseurs', () => { expect(getPosteGroupe('DC')).toBe('D'); });
  it('maps gardiens', () => { expect(getPosteGroupe('G')).toBe('G'); });
  it('returns null for unknown', () => { expect(getPosteGroupe('X')).toBeNull(); });
});
