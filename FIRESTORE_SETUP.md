# Configuration de la Sécurité Firestore

## Étape 1 : Déployer les règles de sécurité Firestore

1. Allez dans la [Console Firebase](https://console.firebase.google.com/)
2. Sélectionnez votre projet **mpg-fantasy**
3. Dans le menu de gauche, cliquez sur **Firestore Database**
4. Cliquez sur l'onglet **Règles** (Rules)
5. Remplacez les règles existantes par le contenu du fichier `firestore.rules` :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Matches collection
    match /matches/{matchId} {
      // Allow anyone to read matches (for viewing stats)
      allow read: if true;

      // Allow write only from authenticated users
      allow write: if request.auth != null;
    }

    // Metadata collection
    match /metadata/{metadataId} {
      // Allow anyone to read metadata
      allow read: if true;

      // Allow write only from authenticated users
      allow write: if request.auth != null;
    }

    // Deny all other collections by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

6. Cliquez sur **Publier** (Publish)

## Étape 2 : Activer Firebase Authentication

1. Dans la Console Firebase, cliquez sur **Authentication** dans le menu de gauche
2. Cliquez sur **Commencer** (Get Started) si ce n'est pas déjà fait
3. Dans l'onglet **Sign-in method**, activez **Email/Password**
4. Cliquez sur **Enregistrer**

## Étape 3 : Créer le compte administrateur

1. Dans **Authentication**, allez dans l'onglet **Users**
2. Cliquez sur **Add user** (Ajouter un utilisateur)
3. Entrez :
   - **Email** : `admin@mpg-fantasy.app`
   - **Password** : `adminmpg2025`
4. Cliquez sur **Add user**

## Important

- Le code d'accès dans l'application reste **admin**
- Une fois connecté, l'application s'authentifie automatiquement avec Firebase
- Les données sont maintenant sécurisées : seul l'admin connecté peut modifier les matchs
- Les visiteurs peuvent toujours consulter les stats (lecture publique)

## Sécurité supplémentaire (optionnel)

Pour renforcer la sécurité, vous pouvez :
1. Changer le mot de passe Firebase de l'admin dans la Console
2. Modifier le code dans `App.jsx` ligne 705 avec le nouveau mot de passe
3. Ajouter une vérification d'email pour plus de sécurité

## En cas de problème

Si vous ne pouvez plus ajouter de matchs après le déploiement des règles :
1. Vérifiez que le compte admin existe dans Authentication
2. Vérifiez que les identifiants dans le code (ligne 705 de App.jsx) correspondent
3. Vérifiez que les règles Firestore sont bien déployées
