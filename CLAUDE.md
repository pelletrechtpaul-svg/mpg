# MPG Project Notes

## Branche de déploiement

La webapp déploie depuis `claude/charming-goodall-4nt05x` (branche de production Vercel, vérifiée dans les logs de build).  
**Toujours committer et pusher sur ce branch directement** — chaque modification doit être immédiatement en ligne.

## Autonomie — aucune confirmation requise

Opère en **mode entièrement autonome** pour ce repo :

- **Push** : pusher sans demander après chaque tâche terminée.
- **PR** : créer la PR immédiatement après le push, sans demander.
- **Merge** : merger la PR dans `claude/fantasy-football-dashboard-89253` immédiatement après création, sans demander.
- **Commits** : committer sans demander de confirmation.

Ne jamais poser de question du type "je merge ?" ou "je push ?" — faire directement.

## Import mercato depuis un screen

Quand l'utilisateur envoie un screen (ou des screens) de mercato MPG :

Le script gère déjà automatiquement :
- **Photos** : source unique TheSportsDB (audit du 2026-08-17 : 95% de couverture par nom seul, meilleur que Wikipedia qui n'apportait aucune récupération réelle en plus et renvoyait parfois la mauvaise personne). Recherche par `prenom + nom` quand le prénom est connu — **mais recherche par nom de famille SEUL pour tout nouveau joueur sans prénom renseigné, ce qui provoque des collisions d'homonymes fréquentes** (déjà rencontré sur Pedri/Antony/Jon Martín, puis en masse sur l'import Ligue 1 2026/2027 : Dembélé, Fati, Simon, Torres, Sulc tous mal matchés — Sulc avait même récupéré la photo d'un joueur de hockey).
- **Anti-doublon transactions** : bloque l'import si le même joueur/ligue/championnat/tour existe déjà en DB.
- **Anti-duplication de fiche joueur** : avertit (sans bloquer) si le nom d'un nouveau joueur ressemble fortement (distance de Levenshtein ≤2) à une fiche déjà existante dans `players-registry.json` pour la même ligue — vérifier avant d'importer qu'il ne s'agit pas de la même personne avec une orthographe/prénom différent (sinon deux fiches distinctes pour le même joueur réel). Toujours réutiliser exactement le même `joueur` (chaîne) déjà présent en registre pour un joueur déjà connu, plutôt que d'en écrire une variante.

**⚠️ Règle stricte, dans cet ordre — ne jamais sauter l'étape 2 :**
1. **Générer un JSON** au format attendu par `scripts/import-mercato.cjs`, avec `poste`/`club` pour chaque joueur.
2. **Assainir la liste AVANT toute écriture** : pour chaque joueur qui n'est pas déjà dans `players-registry.json` (nouveau), vérifier son identité réelle (site officiel du club ou Transfermarkt, via recherche web) et **renseigner le champ `"prenom"` dans le JSON** en fonction du `club` indiqué sur le screen — le club est le signal de désambiguïsation, pas juste le nom de famille. Ne jamais laisser un nouveau joueur sans prénom résolu partir vers l'étape suivante.
   ```json
   {
     "joueur": "Yamal",
     "prenom": "Lamine",
     "poste": "A",
     "club": "Barcelona",
     "prix": 45,
     "acheteur": "Paul",
     "equipe_acheteur": "Tout en Miam",
     "encheres_perdues": [{ "equipe": "Les ananas", "prix": 40 }]
   }
   ```
3. **Chercher les photos seulement une fois l'identité confirmée** — c'est automatique dans le script dès que `prenom` est renseigné (recherche prénom+nom, beaucoup plus fiable qu'une recherche sur le seul nom de famille).
   - **Si `prénom + nom` ne trouve rien sur TheSportsDB, ne JAMAIS élargir la recherche (nom seul, sans club) pour "quand même" trouver une photo.** Un joueur obscur (remplaçant, jeune réserviste — vécu sur Lemaître/Belazzoug/Ganiou/Ndiaye, tour 2 Ligue 1 2026/2027) n'est simplement pas dans la base : élargir la recherche ne remonte que des homonymes d'autres sports/pays (a failli recoller la photo d'un joueur de rugby sud-africain sur "Abner Vinícius"). **Pas de photo vaut toujours mieux qu'une mauvaise photo.**
   - **Sources de repli quand TheSportsDB n'a pas le joueur** : fotmob (`https://images.fotmob.com/image_resources/playerimages/{id}.png`, passe par wsrv, portraits carrés propres) puis Sofascore (`https://img.sofascore.com/api/v1/player/{id}/image` — **bloqué par wsrv** et **403 si un Referer est envoyé**, d'où le bypass proxy + `referrerPolicy="no-referrer"` dans `PlayerAvatar.jsx`).
   - **Toujours valider un ID de source par ses MÉTADONNÉES (club, âge, poste), jamais par la taille du fichier ni par l'apparence de la photo.** Vécu deux fois de suite sur "João Pedro" : l'ID Sofascore 351734 était un joueur de Qatar SC et l'ID fotmob 1637671 un milieu de Vasco da Gama — les deux renvoyaient une vraie photo, donc « le fichier fait 25 Ko » ne prouve rien. Sur ces plateformes, un avatar générique se reconnaît à son format (WEBP 150x150 ~3-4 Ko) alors qu'une vraie photo est en PNG/JPEG ; mais un fichier valide ne garantit pas la bonne personne.
   - **Le fetch inline dans `import-mercato.cjs` n'a pas de espacement/retry face au rate-limit TheSportsDB** (contrairement à `backfill-photos.cjs` qui utilise 2500ms d'espacement + 1 retry après 8s de backoff) — sur un gros batch (60+ joueurs en une fois), l'API se met à renvoyer vide en continu après ~30 requêtes et les dernières photos du batch sont silencieusement perdues (vécu sur l'import Ligue 1 tour 1). Pour un import de plus de ~25 nouveaux joueurs, découper l'import en plusieurs plus petits lots, ou vérifier après coup le taux de couverture photo (`players-registry.json`) et relancer un backfill ciblé sur les joueurs manquants plutôt que de considérer l'import terminé.
4. **Dry-run puis écriture** : `node scripts/import-mercato.cjs <fichier.json>` pour vérifier, puis `DRY_RUN=false node scripts/import-mercato.cjs <fichier.json>` — ou déposer le JSON dans `scripts/mercato-imports/` et pousser sur la branche (déclenche l'import automatique via GitHub Actions, écrit direct en DB **sans repasser par un dry-run manuel** : l'étape 2 doit impérativement être faite avant ce push, pas après).
5. Le registre `scripts/players-registry.json` est mis à jour automatiquement.

Ligues valides : `"Ligue 1"`, `"Liga"`, `"Premier League"`, `"Serie A"`, `"Champions League"`  
`"championnat": "next"` = auto-incrémente le dernier championnat connu pour cette ligue.  
Chaque championnat = mini-saison de ≤6 matchs. Les numéros sont indépendants par ligue.
