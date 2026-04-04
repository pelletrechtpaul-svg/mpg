# MPG Dashboard — Identité visuelle

Ce document définit l'identité visuelle de l'app. À respecter dans la webapp existante et dans la future app grand public pour garantir la cohérence.

---

## Stack CSS

**Tailwind CSS** avec classe `dark` sur `<html>` pour le mode nuit.  
Pas de design system externe (pas de MUI, shadcn, etc.) — tout est fait à la main avec Tailwind.

---

## Palette de couleurs

### Couleurs principales
| Usage | Light | Dark |
|---|---|---|
| Fond de page | `bg-slate-100` | `bg-slate-900` |
| Fond de carte | `bg-white` | `bg-slate-800` |
| Fond de carte secondaire | `bg-slate-50` | `bg-slate-700` |
| Texte principal | `text-slate-800` | `text-slate-100` |
| Texte secondaire | `text-slate-600` | `text-slate-300` |
| Texte tertiaire | `text-slate-500` | `text-slate-400` |
| Bordure | `border-slate-200` | `border-slate-700` |

### Couleurs d'accentuation
| Signification | Classe | Hex |
|---|---|---|
| Victoire / positif | `text-green-600`, `bg-green-500` | #16a34a |
| Défaite / négatif | `text-red-600`, `bg-red-500` | #dc2626 |
| Nul / neutre | `text-slate-400`, `bg-slate-400` | #94a3b8 |
| Action principale | `bg-blue-600` | #2563eb |
| Points / score | `text-blue-600` | #2563eb |
| Buts marqués | `text-green-600` | #16a34a |
| Buts encaissés | `text-red-600` | #dc2626 |
| Goal average positif | `text-green-600` | #16a34a |
| Goal average négatif | `text-red-600` | #dc2626 |

### Couleurs par joueur (fixes, identitaires)
```js
Paul:   bg-blue-600   / #2563eb
Adrien: bg-green-600  / #16a34a
Tiago:  bg-purple-600 / #9333ea
Roman:  bg-orange-600 / #ea580c
```
Ces couleurs sont utilisées partout : points colorés, graphiques, badges. Dans la future app, chaque joueur d'un groupe choisit sa couleur à l'inscription.

---

## Typographie

Police système : `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

| Élément | Classes |
|---|---|
| Titre de section | `text-2xl font-bold text-slate-800 dark:text-slate-100` |
| Sous-titre de carte | `text-lg font-semibold text-slate-800 dark:text-slate-100` |
| Label de champ | `text-sm font-medium text-slate-700 dark:text-slate-200` |
| Valeur principale (record) | `text-2xl font-bold text-{color}-700 dark:text-{color}-400` |
| Corps de texte | `text-sm text-slate-600 dark:text-slate-300` |
| Texte discret | `text-xs text-slate-500 dark:text-slate-400` |

---

## Composants récurrents

### Carte (container)
```html
<div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
```

### Carte de record (colorée)
```html
<div class="bg-gradient-to-br from-{color}-50 to-{color2}-50
            dark:from-{color}-900/40 dark:to-{color2}-900/40
            rounded-lg p-4 border-2 border-{color}-200 dark:border-{color}-700">
```
Règle : en dark mode, utiliser `/40` d'opacité sur les gradients colorés pour garder la distinction sans écraser le fond.

### Tableau
```html
<table class="w-full">
  <thead class="bg-slate-50 dark:bg-slate-700">
    <tr>
      <th class="px-2 sm:px-6 py-2 sm:py-4 text-left font-semibold
                 text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
  <tbody>
    <tr class="border-t dark:border-slate-700
               hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
```

### Badge de rang (podium)
- 1er : `bg-yellow-400 text-yellow-900` (🥇)
- 2ème : `bg-slate-300 text-slate-700` (🥈)
- 3ème : `bg-amber-600 text-white` (🥉)

### Bouton principal
```html
<button class="px-4 py-2 bg-blue-600 text-white rounded-lg
               hover:bg-blue-700 transition-colors font-medium">
```

### Bouton secondaire / toggle
```html
<button class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all
               bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300
               hover:bg-slate-200 dark:hover:bg-slate-600">
<!-- actif : -->
               bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm
```

### Point coloré (indicateur joueur)
```html
<div class="w-3 h-3 rounded-full bg-{playerColor}">
<!-- sizes utilisées : w-2.5/h-2.5, w-3/h-3, w-4/h-4 selon contexte -->
```

### Carré de résultat (forme récente)
```html
<!-- Victoire -->  bg-green-600
<!-- Défaite -->   bg-red-600
<!-- Nul -->       bg-slate-400
w-10 h-10 rounded text-white font-bold
```

### Bulle thermomètre (face à face)
Cercles sans texte, taille variable selon l'intensité du match :
```js
size = 10 + Math.min(totalGoals, 8) * 2.5  // px
// Victoire J1 : bg-green-500
// Défaite J1 :  bg-red-500
// Nul :         bg-slate-400
```

---

## Navigation (onglets)

Barre de tabs horizontale scrollable sur mobile :
```html
<div class="flex gap-1 overflow-x-auto pb-1">
  <!-- Tab actif -->
  <button class="px-4 py-2 rounded-lg font-medium bg-white dark:bg-slate-700
                 text-slate-800 dark:text-slate-100 shadow-sm whitespace-nowrap">
  <!-- Tab inactif -->
  <button class="px-4 py-2 rounded-lg font-medium
                 text-slate-600 dark:text-slate-400 whitespace-nowrap
                 hover:bg-white/50 dark:hover:bg-slate-700/50">
```

---

## Responsive

Pattern systématique : `text-xs sm:text-sm`, `px-2 sm:px-6`, `py-2 sm:py-4`  
Sur mobile, les tableaux gardent toutes leurs colonnes (pas de scroll horizontal) mais avec padding réduit et texte plus petit.

---

## Graphiques (Recharts)

- `CartesianGrid` : `strokeDasharray="3 3"`
- Couleurs des lignes = `playerColorHex` (hex, pas les classes Tailwind)
- `ResponsiveContainer width="100%"`
- Hauteurs courantes : 300px (camembert, barres), 400px (lignes d'évolution)
- Tooltip : style Recharts par défaut

---

## Animations

```css
/* Texte défilant (player music title) */
@keyframes marquee {
  0%   { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
.animate-marquee {
  display: inline-block;
  animation: marquee 4s linear infinite;
}
```

---

## Mode nuit

Activé par classe `dark` sur `<html>`. Toggle via bouton en haut à droite (icône lune/soleil).  
**Règles impératives** :
- Chaque `text-slate-{n}` a son équivalent `dark:text-slate-{m}`
- Chaque `bg-white` a son `dark:bg-slate-800`
- Chaque `bg-slate-50` a son `dark:bg-slate-700`
- Les gradients colorés utilisent `/40` d'opacité en dark (ex: `dark:from-green-900/40`)
- Ne jamais utiliser de fond `dark:from-slate-800` sur une carte dont le conteneur est aussi `dark:bg-slate-800` (carte invisible)

---

## Photos joueurs

Chaque joueur a une photo portrait, stockée dans `/public/images/`.  
Affichées dans des cercles (`rounded-full overflow-hidden`) avec bordure colorée.  
En cas d'erreur de chargement : fallback sur la couleur du joueur (`onError`).

---

## Philosophie UI

- **Dense mais lisible** : on affiche beaucoup d'info, jamais de page vide
- **La couleur joueur est sacrée** : cohérente partout, jamais interchangée
- **Pas de modal lourd** : les détails s'ouvrent en popup léger (overlay fixe + carte centrée)
- **Mobile first sur les tableaux** : padding adaptatif, jamais de scroll horizontal
- **Émojis fonctionnels** : utilisés pour signifier rapidement (🏆 titre, 💼 valise, 🎯 clutch…)
