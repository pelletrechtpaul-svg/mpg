import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChampionshipStats } from '../hooks/useChampionshipStats.js';
import { useRecords } from '../hooks/useRecords.js';
import { useSeasonData } from '../hooks/useSeasonData.js';
import { useEvolutionData } from '../hooks/useEvolutionData.js';
import { champNum, compareChampionnats, nomCourt } from '../helpers.js';
import { LIGUES } from '../constants.js';

// Mini-championnat fictif, résultat connu à la main :
//   Paul 7 pts (V, V, N) — champion à 1 point d'Adrien
//   Adrien 6 pts, Roman 2 pts, Tiago 1 pt
const SAISON = '2026/2027';
const JOUEURS = ['Paul', 'Adrien', 'Tiago', 'Roman'];

function match(j1, j2, b1, b2, jour, overrides = {}) {
  const resultat = b1 > b2 ? 'victoire_j1' : b2 > b1 ? 'victoire_j2' : 'nul';
  return {
    saison: SAISON, ligue: 'Liga', championnat: '#1',
    joueur1: j1, joueur2: j2, buts_j1: b1, buts_j2: b2,
    points_j1: b1 > b2 ? 3 : b1 === b2 ? 1 : 0,
    points_j2: b2 > b1 ? 3 : b1 === b2 ? 1 : 0,
    resultat, dateMatch: `2026-09-${String(jour).padStart(2, '0')}`,
    ...overrides,
  };
}

const CHAMPIONNAT = [
  match('Paul', 'Adrien', 2, 1, 1),
  match('Tiago', 'Roman', 0, 0, 2),
  match('Paul', 'Tiago', 6, 0, 3),
  match('Adrien', 'Roman', 3, 1, 4),
  match('Paul', 'Roman', 1, 1, 5),
  match('Adrien', 'Tiago', 2, 0, 6),
];
const complet = { [`${SAISON}-Liga-#1`]: { matchsTotal: 6, matchsEntered: 6 } };

const classement = (matches, metadata) =>
  renderHook(() => useChampionshipStats(matches, JOUEURS, metadata, SAISON, 'general', 'total')).result.current;
const ligne = (stats, joueur) => stats.classementGeneral.find(c => c.joueur === joueur);

describe('useChampionshipStats', () => {
  it('compte chaque match une seule fois et ajoute +3 au champion d\'un championnat de 6 matchs', () => {
    const stats = classement(CHAMPIONNAT, complet);
    expect(ligne(stats, 'Paul').pointsMatch).toBe(7);
    expect(ligne(stats, 'Paul').matchs).toBe(3);
    expect(ligne(stats, 'Paul').victoiresChampionnat).toBe(1);
    expect(ligne(stats, 'Paul').points).toBe(10);
    expect(ligne(stats, 'Adrien').points).toBe(6);
    expect(stats.classementGeneral.map(c => c.joueur)).toEqual(['Paul', 'Adrien', 'Roman', 'Tiago']);
  });

  it('n\'attribue pas de titre tant que le championnat n\'est pas complet', () => {
    const stats = classement(CHAMPIONNAT, { [`${SAISON}-Liga-#1`]: { matchsTotal: 6, matchsEntered: 5 } });
    expect(ligne(stats, 'Paul').victoiresChampionnat).toBe(0);
    expect(ligne(stats, 'Paul').points).toBe(7);
  });

  it('donne une médaille (+2) et pas un titre pour un championnat de moins de 6 matchs', () => {
    const stats = classement(CHAMPIONNAT, { [`${SAISON}-Liga-#1`]: { matchsTotal: 5, matchsEntered: 5 } });
    expect(ligne(stats, 'Paul').victoiresChampionnat).toBe(0);
    expect(ligne(stats, 'Paul').medaillesChampionnat).toBe(1);
    expect(ligne(stats, 'Paul').points).toBe(9);
  });

  it('repère un championnat perdu à 1 point', () => {
    const stats = classement(CHAMPIONNAT, complet);
    expect(stats.perduUnPoint.Adrien).toHaveLength(1);
    expect(stats.perduUnPoint.Adrien[0]).toMatchObject({ raison: '1 pt', winner: 'Paul' });
    expect(stats.perduUnPoint.Roman).toHaveLength(0);
  });

  it('classement d\'une ligue sur "total" : titre compté, mais pas ajouté aux points en All-Time', () => {
    const saison = renderHook(() => useChampionshipStats(CHAMPIONNAT, JOUEURS, complet, SAISON, 'Liga', 'total')).result.current;
    expect(saison.classementParLigue.find(c => c.joueur === 'Paul').points).toBe(10);
    const allTime = renderHook(() => useChampionshipStats(CHAMPIONNAT, JOUEURS, complet, 'All-Time', 'Liga', 'total')).result.current;
    const paul = allTime.classementParLigue.find(c => c.joueur === 'Paul');
    expect(paul.points).toBe(7);
    expect(paul.victoiresChampionnat).toBe(1);
  });
});

describe('useRecords — records entraîneurs', () => {
  const records = () => renderHook(() => useRecords(CHAMPIONNAT, JOUEURS, complet, CHAMPIONNAT, SAISON, [], [])).result.current;

  it('compte victoires serrées, berserk et clutch', () => {
    const { seasonRecords } = records();
    expect(seasonRecords.closeWinsKing[0]).toEqual({ joueur: 'Paul', count: 1 });
    expect(seasonRecords.berserkKing[0]).toEqual({ joueur: 'Paul', count: 1 });
    expect(seasonRecords.clutchChampion[0]).toEqual({ joueur: 'Paul', count: 1 });
    expect(seasonRecords.clutchChampion.find(e => e.joueur === 'Adrien').count).toBe(0);
  });

  it('calcule les séries dans l\'ordre chronologique', () => {
    const { seasonRecords } = records();
    expect(seasonRecords.longestWinStreak.Paul.length).toBe(2);
    expect(seasonRecords.longestUnbeatenStreak.Paul.length).toBe(3);
    expect(seasonRecords.longestWinStreak.Adrien.length).toBe(2);
  });

  it('trouve la plus grosse victoire', () => {
    const { seasonRecords } = records();
    expect(seasonRecords.biggestWinMargin[0]).toMatchObject({ joueur: 'Paul', margin: 6 });
  });
});

describe('useRecords — records mercato', () => {
  const achat = (ligue, prix, acheteur, extra = {}) => ({
    saison: SAISON, ligue, championnat: 1, tour: 1, joueur: `J${prix}${ligue}`, poste: 'A', club: 'X',
    prix, acheteur, encheres_perdues: [], ...extra,
  });
  const mercato = [
    achat('Liga', 45, 'Paul'),
    achat('Liga', 90, 'Adrien', { encheres_perdues: [{ equipe: 'Z', prix: 80 }] }),
    achat('Liga', 130, 'Tiago'),
    achat('Ligue 1', 50, 'Roman'),
  ];

  it('compte les gros transferts par ligue selon le seuil, en cumulé', () => {
    const { mercatoRecordsSeason } = renderHook(() => useRecords(CHAMPIONNAT, JOUEURS, complet, CHAMPIONNAT, SAISON, mercato, mercato)).result.current;
    const au = (seuil, ligue) => mercatoRecordsSeason.bigTransfersByLigue[seuil].find(l => l.ligue === ligue).count;
    expect(au(40, 'Liga')).toBe(3);
    expect(au(40, 'Ligue 1')).toBe(1);
    expect(au(80, 'Liga')).toBe(2);
    expect(au(120, 'Liga')).toBe(1);
    expect(mercatoRecordsSeason.bidWarsByLigue.find(l => l.ligue === 'Liga').count).toBe(1);
  });

  it('n\'affiche pas de records mercato sur une saison sans données détaillées', () => {
    const { mercatoRecordsSeason } = renderHook(() => useRecords(CHAMPIONNAT, JOUEURS, complet, CHAMPIONNAT, '2025/2026', mercato, mercato)).result.current;
    expect(mercatoRecordsSeason).toBeNull();
  });
});

describe('useSeasonData', () => {
  it('filtre la saison et trie les championnats numériquement (#2 avant #10)', () => {
    const data = [
      match('Paul', 'Adrien', 1, 0, 1, { championnat: '#10' }),
      match('Paul', 'Adrien', 1, 0, 2, { championnat: '#2' }),
      match('Paul', 'Adrien', 1, 0, 3, { saison: '2025/2026' }),
    ];
    const { result } = renderHook(() => useSeasonData(data, SAISON));
    expect(result.current.filteredData).toHaveLength(2);
    expect(result.current.championnatsByLigue.Liga).toEqual(['#2', '#10']);
  });
});

describe('useEvolutionData', () => {
  it('sur "total", garde les matchs de tous les championnats de la ligue', () => {
    const data = [...CHAMPIONNAT, match('Paul', 'Adrien', 1, 0, 20, { championnat: '#2' }), match('Paul', 'Adrien', 1, 0, 21, { ligue: 'Serie A' })];
    const total = renderHook(() => useEvolutionData(data, JOUEURS, 'Liga', 'total', complet)).result.current;
    expect(total.matchesListForChampionnat).toHaveLength(7);
    const un = renderHook(() => useEvolutionData(data, JOUEURS, 'Liga', '#1', complet)).result.current;
    expect(un.matchesListForChampionnat).toHaveLength(6);
  });
});

describe('helpers — championnats et noms', () => {
  it('compare "#2" (matches) et 2 (mercato) et trie numériquement', () => {
    expect(champNum('#2')).toBe(champNum(2));
    expect(champNum('total')).toBeNull();
    expect(['#10', '#2', '#1'].sort(compareChampionnats)).toEqual(['#1', '#2', '#10']);
  });

  it('nomCourt garde le nom de famille quand le prénom est connu', () => {
    expect(nomCourt({ joueur: 'Federico Valverde', prenom: 'Federico' })).toBe('Valverde');
    expect(nomCourt({ joueur: 'Pedri' })).toBe('Pedri');
    expect(nomCourt({ joueur: 'Valverde', prenom: 'Federico' })).toBe('Valverde');
  });

  it('la liste des ligues contient les chaînes exactes utilisées en base', () => {
    expect(LIGUES).toContain('Ligue des Champions');
    expect(LIGUES).not.toContain('Champions League');
  });
});
