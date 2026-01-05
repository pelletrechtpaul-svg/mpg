# Tableau de Bord MonPetitGazon

Application web pour visualiser et analyser les statistiques de vos ligues MonPetitGazon entre amis.

## Fonctionnalités

- **Classements** : Visualisez le classement général ou par championnat
- **Statistiques** : Analysez les performances de chaque joueur avec des graphiques interactifs
- **Face à Face** : Comparez les confrontations directes entre joueurs
- **Import/Export CSV** : Mettez facilement à jour vos données via des fichiers CSV

## Installation

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev

# Build pour la production
npm run build
```

## Mise à jour des données

### Méthode 1 : Import CSV (Recommandé)

1. Cliquez sur "Exporter données principales" pour télécharger un template CSV
2. Modifiez le fichier avec vos données
3. Cliquez sur "Importer données principales (CSV)" pour charger vos données

#### Format CSV pour les données principales

```csv
championnat,edition,joueur,matchs,buts_pour,buts_contre,ga,points,rang
Ligue 1,01/09/24-15/10/24,Paul,6,12,8,4,78,2
Ligue 1,01/09/24-15/10/24,Adrien,6,10,9,1,65,3
...
```

#### Format CSV pour le face-à-face

```csv
joueur1,joueur2,buts_j1,buts_j2,ga_j1,victoires_j1,victoires_j2,nuls
Paul,Adrien,24,19,5,8,6,2
Paul,Tiago,22,26,-4,6,9,1
...
```

### Méthode 2 : Modification directe du code

Éditez les variables `defaultSampleData` et `defaultVsData` dans `src/App.jsx`.

## Structure du projet

```
mpg/
├── src/
│   ├── App.jsx          # Composant principal avec toute la logique
│   ├── index.css        # Styles Tailwind CSS
│   └── main.jsx         # Point d'entrée React
├── package.json
├── tailwind.config.js
└── vite.config.js
```

## Technologies utilisées

- **React** - Framework UI
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Recharts** - Graphiques
- **Lucide React** - Icônes
- **PapaParse** - Import/export CSV

## Système de points

Le classement général utilise le système suivant :
- Points gagnés dans chaque édition de championnat
- +3 points bonus pour chaque victoire d'édition (1ère place)

## Déploiement

Pour déployer l'application, plusieurs options gratuites :

### Vercel (Recommandé)

```bash
npm install -g vercel
vercel
```

### Netlify

```bash
npm run build
# Glissez-déposez le dossier dist/ sur netlify.com
```

### GitHub Pages

1. Ajoutez dans `vite.config.js` :
   ```js
   base: '/nom-du-repo/'
   ```
2. `npm run build`
3. Déployez le dossier `dist/`

## Support

Pour toute question ou problème, créez une issue sur GitHub.
