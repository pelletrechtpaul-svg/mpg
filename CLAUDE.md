# MPG Project Notes

## Branche de déploiement

La webapp déploie depuis `claude/fantasy-football-dashboard-89253`.  
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

1. **Générer un JSON** au format attendu par `scripts/import-mercato.cjs` :
   ```json
   {
     "ligue": "Liga",
     "championnat": "next",
     "tour": 1,
     "saison": "2026/2027",
     "joueurs": [
       {
         "joueur": "Yamal",
         "poste": "A",
         "club": "Barcelona",
         "prix": 45,
         "acheteur": "Paul",
         "equipe_acheteur": "Tout en Miam",
         "encheres_perdues": [{ "equipe": "Les ananas", "prix": 40 }]
       }
     ]
   }
   ```
2. **Lancer le dry-run** : `node scripts/import-mercato.cjs <fichier.json>`
3. **Résoudre les ❓ INCONNU** : recherche web pour prenom/nationalite des nouveaux joueurs
4. **Écrire en DB** : `DRY_RUN=false node scripts/import-mercato.cjs <fichier.json>`
5. Le registre `scripts/players-registry.json` est mis à jour automatiquement.

Ligues valides : `"Ligue 1"`, `"Liga"`, `"Premier League"`, `"Serie A"`, `"Champions League"`  
`"championnat": "next"` = auto-incrémente le dernier championnat connu pour cette ligue.  
Chaque championnat = mini-saison de ≤6 matchs. Les numéros sont indépendants par ligue.
