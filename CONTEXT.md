# MPG Dashboard — Contexte projet

Ce document est destiné à être lu par Claude Code au démarrage de chaque nouvelle session, pour la webapp existante **ou** la future app grand public.

---

## Webapp actuelle (ce repo)

Dashboard privé pour un groupe de 4 amis jouant à MonPetitGazon (MPG), fantasy football français. Toutes les données sont saisies manuellement par un admin via un onglet dédié.

**Stack** : React 19 + Vite, Tailwind CSS, Firebase Firestore + Auth, Recharts, lucide-react.  
**Déploiement** : Vercel (auto-deploy sur push).  
**Branch de dev** : `claude/fantasy-football-dashboard-89253`

---

## Modèle de données Firestore

### Collection `matches`
```js
{
  saison: '2025/2026',          // ex: '2024/2025'
  ligue: 'Ligue 1',            // ex: 'Premier League', 'Ligue des Champions'
  championnat: '#3',            // numérotation #1, #2, #3...
  dateMatch: '2025-03-15',
  joueur1: 'Paul',
  joueur2: 'Roman',
  buts_j1: 3,
  buts_j2: 1,
  points_j1: 3,                 // inclut la valise (voir règles métier)
  points_j2: 0,
  valise_j1: false,             // true si valise posée par j1
  valise_j2: false,
  resultat: 'victoire_j1'       // 'victoire_j1' | 'victoire_j2' | 'nul' (source de vérité)
}
```

### Collection `ligueMetadata`
Clé Firestore : `${saison}-${ligue}-${championnat}` avec `/` → `_`
```js
{
  matchsTotal: 6,               // nb de matchs prévus dans ce championnat
  matchsEntered: 5              // nb de matchs saisis
}
```

---

## Règles métier

### Système de points
- Victoire : 3 pts
- Nul : 1 pt
- Défaite : 0 pt

### Valise (mécanique spéciale MPG)
Un joueur peut poser une "valise" sur son adversaire. Si le joueur qui reçoit la valise perd, il perd des points supplémentaires. Les points_j1/points_j2 dans Firestore incluent déjà cet effet. Le champ `resultat` est la source de vérité pour V/N/D (ne pas recalculer depuis buts_j1 vs buts_j2).

### Classement général
`points_total = points_matchs + (titres × 3) + (médailles × 2)`

**Titres** : 1er d'un championnat à 6 matchs → +3 pts bonus  
**Médailles** : 1er d'un championnat à moins de 6 matchs → +2 pts bonus  
**Tie-breaker** : goal average (buts_pour - buts_contre)

### Saisons et ligues
- Chaque saison contient plusieurs ligues (Ligue 1, Premier League, Liga, Serie A, Ligue des Champions)
- Chaque ligue contient plusieurs championnats numérotés #1, #2, #3...
- Un championnat = round-robin de 6 matchs (ou moins pour les petits formats)
- Clé unique d'un championnat : `${saison}-${ligue}-${championnat}`

### Championnats manuels (sans détail de matchs)
Certains championnats n'ont pas de données de matchs (scores perdus). Ils sont hardcodés dans `MANUAL_CHAMPIONSHIPS` (array en dehors du composant) avec le classement final (points, GA, V/N/D). Injectés dans `classementGeneral` et `classementParLigue` sans générer de faux matchs.

---

## Architecture du code (App.jsx)

Tout est dans un seul fichier `src/App.jsx` (~4200 lignes). Les calculs sont dans des `useMemo` enchaînés :

```
matchData (Firestore)
  └── filteredData (filtré par selectedSeason)
        ├── classementGeneral (points matchs + titres/médailles)
        ├── classementParLigue (idem, filtré par ligue/championnat)
        ├── victoiresChampionnat / medaillesChampionnat (+ victoiresDetail / medaillesDetail)
        ├── statsDetaillees (buteurs, loosers)
        ├── cleanSheetsStats (clean sheets + pannes offensives)
        ├── scoreDistribution (distribution des scores)
        ├── seasonRecords (tous les records)
        ├── versusStats + versusMatchHistory (face à face)
        ├── heureDeGloire (meilleur championnat par joueur)
        └── advancedStats (forme récente)
```

### Fonctions utilitaires clés
- `calculatePlayerStats(matches, joueurs)` → stats brutes {points, matchs, victoires, nuls, defaites, buts_pour, buts_contre, ga}
- `groupMatchesByChampionship(matches)` → map `{key: matches[]}` avec clé `${saison}-${ligue}-${championnat}`
- `calculateLongestStreak(playerMatches, conditionFn)` → {length, endDate}

---

## Onglets de l'interface

| Tab ID | Nom affiché | Contenu |
|---|---|---|
| `classements` | Classements | Général + par ligue/championnat, évolution graphique |
| `statistiques` | Statistiques | Buteurs, loosers, clean sheets, pannes offensives, distribution scores |
| `records` | Records | Records individuels, de match, de championnat, séries, régularité |
| `versus` | Face à Face | H2H entre 2 joueurs + thermomètre + heure de gloire |
| `stats-avancees` | Forme | Forme récente (10 derniers matchs) par joueur |
| `valises` | Valises | Stats valises posées/reçues/efficaces |
| `admin` | Admin | Saisie des matchs, édition, suppression |

---

## Joueurs (groupe actuel)
- **Paul** — couleur blue-600 / #2563eb
- **Adrien** — couleur green-600 / #16a34a
- **Tiago** — couleur purple-600 / #9333ea
- **Roman** — couleur orange-600 / #ea580c

---

## Points d'attention / pièges connus

1. **`resultat` vs comparaison de buts** : toujours utiliser `m.resultat` pour déterminer V/N/D, jamais `buts_j1 > buts_j2` (la valise peut inverser)
2. **All-Time** : `filteredData` = tous les matchs. Les useMemos fonctionnent déjà en All-Time sans garde-fou supplémentaire
3. **Classement par championnat en All-Time** : les points bonus (titres) ne sont PAS ajoutés pour éviter le double comptage
4. **ligueMetadata clé** : les `/` dans les noms sont encodés en `_` dans Firestore
5. **adminChampionnatsByLigue** : distinct de `championnatsByLigue` — filtré par `adminFormData.saison` pour éviter d'afficher les championnats d'une autre saison dans le formulaire admin
