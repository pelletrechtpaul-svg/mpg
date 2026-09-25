# MesPetitsBavons ⚽

Tableau de bord privé de nos ligues **MPG** (Mon Petit Gazon) — stats, classements,
records et mercato pour les 4 entraîneurs : Paul, Adrien, Tiago et Roman.

🌐 **En ligne** : [mespetitsbavons.vercel.app](https://mespetitsbavons.vercel.app)

## ✨ Onglets

- **Classement** — général et par ligue (L1, Liga, PL, Serie A, LDC) :
  tableau, graphique d'évolution, buts (marqués/encaissés), clean sheets, pannes,
  valises ; par ligue : matchs, effectifs, buteurs, notes, étude de banc
- **Entraîneurs** — carte par coach (rang, forme), puis fiche détaillée : effectifs
  actuels, confrontations, tops joueurs, records détenus
- **Records** — entraîneurs, exploits, ligues, mercato (saison ou all-time)
- **Joueurs** — recherche multi-critères (nom, club, nationalité, coach) avec filtres
  par chips, complétion prédictive et historique mercato de chaque joueur
- **Admin** 🔒 — saisie des journées : scores, buteurs (+/- et CSC), valises,
  création de championnats, gestion des saisons

Bonus : mode sombre 🌙 et mini-player audio branché sur notre
[playlist SoundCloud](https://soundcloud.com/paul-610524335/sets/mpg) 🎵

## 🛠 Stack

| Couche | Techno |
|---|---|
| Front | React 19 + Vite |
| Styles | Tailwind CSS |
| Data | Firebase Firestore (synchro temps réel) |
| Graphiques | Recharts |
| Audio | SoundCloud Widget API |
| Déploiement | Vercel |

## 🚀 Développement

```bash
npm install
npm run dev        # serveur local
npm run build      # build de production
npm run test       # tests (vitest)
```

**Déploiement** : Vercel déploie automatiquement la branche de production
(voir `CLAUDE.md`) — chaque push est en ligne en ~1 minute.

## 📥 Import mercato

Les résultats de mercato s'importent depuis un JSON via :

```bash
node scripts/import-mercato.cjs mercato.json                 # dry-run
DRY_RUN=false node scripts/import-mercato.cjs mercato.json   # écriture en base
```

Le registre des joueurs (`scripts/players-registry.json`) est mis à jour
automatiquement. Le workflow complet (format JSON, résolution des joueurs
inconnus) est documenté dans `CLAUDE.md`.

## 🛡️ Base de données

- Règles Firestore : `firestore.rules`, publiées automatiquement à chaque push
  (workflow `deploy-firestore-rules`).
- Sauvegarde automatique chaque lundi (workflow `backup-firestore`, gardée 90 jours),
  restauration via `restore-firestore`. Détails dans `CLAUDE.md`.

## 📐 Règles du jeu

- Une **ligue** contient des **championnats** = mini-saisons de ≤ 6 journées,
  numérotées indépendamment par ligue
- Victoire d'un championnat de 6 journées = 🏆 (+3 pts au classement général) ;
  championnat plus court = 🥇 (+2 pts)
- Une **valise** 💼 par joueur et par championnat
- Départage : points, puis goal average

## 📁 Structure

```
src/
├── App.jsx                  # Shell : header, navigation, player, dark mode
├── components/              # Un composant par onglet + admin
│   ├── ClassementsTab.jsx
│   ├── EntraineursTab.jsx
│   ├── RecordsTab.jsx
│   ├── JoueursTab.jsx
│   ├── AdminTab.jsx / AdminAddMatchForm.jsx / AdminScorerSection.jsx …
├── hooks/                   # Toute la logique de calcul
│   ├── useFirestoreSync.js  # Synchro temps réel Firestore
│   ├── useChampionshipStats.js, usePlayerStats.js, useRecords.js …
├── constants.js             # Entraîneurs, couleurs, abréviations de ligues, playlist
├── firebase.js              # Config Firebase
└── test/                    # Tests (vitest) : helpers + classements/records
scripts/                     # Import mercato, photos, sauvegarde/restauration,
                             # publication des règles, contrôles de la base
```
