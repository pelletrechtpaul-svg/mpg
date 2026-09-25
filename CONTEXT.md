# MesPetitsBavons — Contexte projet

À lire au démarrage d'une session. Décrit l'app telle qu'elle est (mis à jour le 2026-09-25). Les règles de travail (branche, import mercato, règles Firestore, sauvegardes) sont dans `CLAUDE.md` ; l'identité visuelle dans `DESIGN.md`.

---

## L'app

Dashboard privé de 4 amis (Paul, Adrien, Tiago, Roman) qui jouent à MonPetitGazon (MPG). Les matchs sont saisis à la main dans l'onglet Admin ; le mercato est importé depuis des captures d'écran (voir `CLAUDE.md`).

**Stack** : React 19 + Vite, Tailwind CSS 3, Firebase Firestore + Auth, Recharts, lucide-react, tests Vitest.
**Déploiement** : Vercel, depuis `claude/charming-goodall-4nt05x` (chaque push part en ligne).

---

## Vocabulaire

- **Entraîneur / coach** : l'un des 4 amis. Repéré par son prénom (`joueurs`, `joueur1`, `acheteur`…) — attention, dans le code la variable `joueurs` désigne les entraîneurs.
- **Joueur** : un footballeur réel recruté au mercato, repéré par le champ `joueur` (nom complet, ou nom seul s'il n'y a pas d'ambiguïté).
- **Ligue** : `Ligue 1`, `Liga`, `Premier League`, `Serie A`, `Ligue des Champions` — chaînes exactes, utilisées telles quelles partout.
- **Championnat** : mini-saison de 6 matchs maximum dans une ligue, numérotée `#1`, `#2`… indépendamment par ligue.
- **Compte / banc / loft** : statut d'un joueur sur un match (a compté, est resté sur le banc, n'était pas dans les 18).

---

## Données Firestore

### `matches`
```js
{
  saison: '2026/2027', ligue: 'Liga', championnat: '#2',   // ⚠️ chaîne "#N"
  dateMatch: '2026-09-20', dateEntree: '…ISO…',
  joueur1: 'Paul', joueur2: 'Roman', buts_j1: 3, buts_j2: 1,
  points_j1: 3, points_j2: 0,
  resultat: 'victoire_j1',            // 'victoire_j1' | 'victoire_j2' | 'nul'
  valise_j1: false, valise_j2: false,
  notes:   [{ joueur, acheteur, note, statut }],             // statut 'banc' ou absent (= compte)
  buteurs: [{ joueur, acheteur, buts, csc, virtuel, statut }],
}
```

### `mercato`
```js
{
  saison: '2026/2027', ligue: 'Liga', championnat: 2, tour: 1,   // ⚠️ nombre, pas "#N"
  joueur: 'Yamal', prenom: 'Lamine', poste: 'A', club: 'Barcelona', nationalite: '…',
  prix: 45, acheteur: 'Paul', equipe_acheteur: 'Tout en Miam',
  encheres_perdues: [{ equipe, prix }],
}
```

### `metadata`
Clé `${saison}-${ligue}-${championnat}` avec `/` encodés en `_` : `{ matchsTotal, matchsEntered }`. Un titre ou une médaille n'est attribué que quand `matchsEntered >= matchsTotal`.

### `config`
- `saisons` : `{ list: ['2026/2027', …] }`, lisible par tous.
- `adminRoles` : `{ email: 'full' | 'matches' }`, lisible seulement par un admin listé.

---

## Règles métier

- Victoire 3 pts, nul 1, défaite 0 — calculés depuis le score seul ; la valise est purement indicative.
- Classement général = points de match + 3 par titre (championnat de 6 matchs) + 2 par médaille (championnat plus court).
- Départage : points, puis goal average.
- Saisons sans données détaillées (notes, buteurs, mercato) : `SEASONS_SANS_DONNEES_DETAILLEES` dans `constants.js` ; les vues qui en dépendent sont masquées (`hasDetailedData`).

---

## Code

```
src/
├── App.jsx            # en-tête, navigation (état dans le hash de l'URL), lecteur, dark mode
├── components/        # un composant par onglet (Classements, Entraineurs, Records, Joueurs, Admin…)
├── hooks/             # tous les calculs (useChampionshipStats, useRecords, usePlayerStats, useEvolutionData…)
├── constants.js       # ligues (LIGUES, ligueAbbr), couleurs des entraîneurs, saisons sans détail
├── helpers.js         # champNum, compareChampionnats, nomCourt, calculatePlayerStats, isCompte…
└── test/              # tests Vitest (npm test)
```

Navigation : tout l'état visible (onglet, saison, ligue, championnat, vues et sous-onglets) est dans le hash de l'URL (`parseNavFromHash` / `serializeNav` dans `App.jsx`). Un nouvel onglet ou sous-onglet doit y être ajouté.

---

## Pièges connus

1. **Championnat : `"#2"` dans `matches`, `2` dans `mercato`.** Toujours comparer via `champNum()` et trier via `compareChampionnats()` (`helpers.js`) — source de plusieurs bugs.
2. **Noms de ligue** : chaînes exactes, liste unique `LIGUES` dans `constants.js`. L'import mercato refuse une ligue hors liste ; ne jamais réécrire une liste de ligues dans un composant.
3. **Homonymes de joueurs** : deux footballeurs réels de même nom fusionnent en une seule fiche. Procédure de vérification dans `CLAUDE.md`.
4. **Joueur d'un coach** : un joueur peut changer de coach d'un championnat à l'autre ; toute stat « par coach » doit se limiter aux championnats où il lui appartenait (clé joueur + ligue + championnat).
5. **Après un changement de calcul** : lancer `npm test`.
