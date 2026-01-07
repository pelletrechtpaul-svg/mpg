# 🔐 Configuration de la Sécurité Firestore - Guide Complet

## ⚠️ IMPORTANT - À faire dans l'ordre !

**NE PAS** sauter d'étapes ! Faire les 3 étapes dans l'ordre ci-dessous pour éviter de perdre l'accès à votre base de données.

---

## 📋 ÉTAPE 1 : Créer le compte administrateur AVANT tout

> ⚡ **À FAIRE EN PREMIER** pour éviter de vous retrouver bloqué !

### 1.1 Ouvrir Firebase Console

1. Allez sur [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Connectez-vous avec votre compte Google
3. Cliquez sur votre projet **mpg-fantasy**

### 1.2 Activer Authentication

1. Dans le menu de gauche, cherchez et cliquez sur **🔑 Authentication**
2. Si c'est la première fois :
   - Vous verrez un bouton **"Commencer"** ou **"Get Started"**
   - Cliquez dessus
3. Vous arrivez sur la page Authentication

### 1.3 Activer la méthode Email/Password

1. Cliquez sur l'onglet **"Sign-in method"** (Méthode de connexion)
2. Vous voyez une liste de fournisseurs (Google, Facebook, Email/Password, etc.)
3. Trouvez la ligne **"Email/Password"** (devrait être en haut)
4. Cliquez sur cette ligne pour l'éditer
5. Activez le premier bouton (Enable) - **NE PAS** activer "Email link"
6. Cliquez sur **"Enregistrer"** ou **"Save"**

### 1.4 Créer le compte admin

1. Toujours dans **Authentication**, cliquez sur l'onglet **"Users"** (Utilisateurs)
2. Cliquez sur le bouton **"Add user"** (Ajouter un utilisateur) en haut à droite
3. Une popup s'ouvre, remplissez :
   ```
   Email: admin@mpg-fantasy.app
   Password: adminmpg2025
   ```
4. Cliquez sur **"Add user"**
5. ✅ Vous devez voir le compte apparaître dans la liste avec l'email `admin@mpg-fantasy.app`

> ✅ **CHECKPOINT 1** : Vous devez voir 1 utilisateur dans la liste avec l'email admin@mpg-fantasy.app

---

## 📋 ÉTAPE 2 : Déployer les règles de sécurité Firestore

> ⚠️ Ne faites cette étape QU'APRÈS avoir créé le compte admin !

### 2.1 Aller dans Firestore Database

1. Dans le menu de gauche, cliquez sur **Firestore Database**
2. Vous voyez vos données (collections "matches" et "metadata")

### 2.2 Ouvrir l'éditeur de règles

1. En haut de la page, cliquez sur l'onglet **"Règles"** ou **"Rules"**
2. Vous voyez un éditeur de code avec les règles actuelles

### 2.3 Identifier les règles actuelles

Vos règles actuelles ressemblent probablement à :
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // ⚠️ Dangereux - tout le monde peut écrire !
    }
  }
}
```

### 2.4 Remplacer par les nouvelles règles

1. **SÉLECTIONNEZ TOUT** le contenu de l'éditeur (Ctrl+A ou Cmd+A)
2. **SUPPRIMEZ** le contenu sélectionné
3. **COPIEZ** exactement ce texte :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Collection matches : lecture publique, écriture authentifiée
    match /matches/{matchId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Collection metadata : lecture publique, écriture authentifiée
    match /metadata/{metadataId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Bloquer tout le reste par défaut
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

4. **COLLEZ** ce texte dans l'éditeur

### 2.5 Publier les règles

1. Cliquez sur le bouton **"Publier"** ou **"Publish"** en haut à droite
2. Une confirmation apparaît
3. Attendez 5-10 secondes que les règles se propagent

> ✅ **CHECKPOINT 2** : Les règles sont publiées, vous devez voir le texte que vous avez collé dans l'éditeur

---

## 📋 ÉTAPE 3 : Tester la connexion admin

### 3.1 Ouvrir votre application

1. Allez sur votre application web MonPetitGazon
2. Cliquez sur le bouton **Admin** (rouge avec un cadenas) en haut à droite

### 3.2 Se connecter

1. Entrez le code : **admin**
2. Cliquez sur **"Se connecter"**
3. L'application va maintenant se connecter à Firebase avec votre compte admin

### 3.3 Vérifier que ça fonctionne

1. Essayez d'ajouter un match test
2. Si ça fonctionne : ✅ **C'EST BON !**
3. Si vous avez une erreur : voir section "En cas de problème" ci-dessous

---

## 🔍 Comprendre ce qui a changé

### Avant (DANGEREUX ⚠️)
- N'importe qui pouvait lire ET modifier votre base de données
- Aucune authentification requise
- Vulnérable aux attaques

### Après (SÉCURISÉ ✅)
- **Lecture** : Tout le monde peut consulter les stats (public)
- **Écriture** : Uniquement vous (admin authentifié)
- Les visiteurs ne peuvent pas modifier les données

### Comment ça marche ?

1. Vous entrez le code "admin" dans l'appli
2. L'appli se connecte à Firebase avec `admin@mpg-fantasy.app`
3. Firebase vérifie que le compte existe et que le mot de passe est bon
4. Firebase donne un "token" d'authentification à l'appli
5. Quand vous ajoutez un match, Firestore vérifie le token
6. Si le token est valide, l'écriture est autorisée

---

## ❌ En cas de problème

### Problème 1 : "Erreur de connexion"

**Symptôme** : Message "Erreur de connexion. Assurez-vous que le compte admin existe"

**Solution** :
1. Retournez dans Firebase Console > Authentication > Users
2. Vérifiez que l'email est exactement : `admin@mpg-fantasy.app`
3. Si le compte n'existe pas, recréez-le (Étape 1.4)

### Problème 2 : "Permission denied" ou "Accès refusé"

**Symptôme** : Erreur lors de l'ajout d'un match même connecté

**Causes possibles** :
1. Les règles Firestore ne sont pas publiées
   - Solution : Refaire l'Étape 2
2. Vous n'êtes pas connecté avec le bon compte
   - Solution : Déconnectez-vous (bouton dans Admin) et reconnectez-vous

### Problème 3 : Je ne peux plus ajouter de matchs ET je n'arrive pas à me connecter

**Symptôme** : Bloqué, impossible d'ajouter des matchs

**Solution d'urgence** :
1. Allez dans Firebase Console > Firestore Database > Règles
2. Remettez temporairement les anciennes règles :
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
3. Publiez
4. Créez le compte admin (Étape 1)
5. Remettez les nouvelles règles sécurisées (Étape 2)

---

## 🔐 Sécurité supplémentaire (Optionnel)

### Changer le mot de passe Firebase

1. Dans Firebase Console > Authentication > Users
2. Cliquez sur le compte admin
3. Cliquez sur "Reset password" ou l'icône de réinitialisation
4. Entrez un nouveau mot de passe fort
5. **IMPORTANT** : Changez aussi le mot de passe dans votre code :
   - Ouvrez `src/App.jsx`
   - Ligne 705, changez `'adminmpg2025'` par votre nouveau mot de passe
   - Sauvegardez et redéployez

### Utiliser un vrai email

Si vous voulez utiliser votre vrai email au lieu de `admin@mpg-fantasy.app` :

1. Dans Authentication > Users, créez un compte avec votre email
2. Modifiez `src/App.jsx` ligne 705 :
   ```javascript
   await signInWithEmailAndPassword(auth, 'votre@email.com', 'votremotdepasse');
   ```
3. Redéployez l'application

---

## 📝 Récapitulatif des identifiants

| Où | Identifiant | Valeur par défaut |
|---|---|---|
| **Application web** (code d'accès) | Code | `admin` |
| **Firebase Auth** (email) | Email | `admin@mpg-fantasy.app` |
| **Firebase Auth** (mot de passe) | Password | `adminmpg2025` |

> ⚠️ Le code "admin" dans l'application déclenche la connexion Firebase avec les identifiants email/password

---

## ✅ Checklist finale

- [ ] Compte admin créé dans Authentication
- [ ] L'email est exactement `admin@mpg-fantasy.app`
- [ ] Règles Firestore publiées avec le nouveau code
- [ ] Test de connexion réussi dans l'application
- [ ] Test d'ajout de match réussi

Si toutes les cases sont cochées : **🎉 Votre base de données est maintenant sécurisée !**
