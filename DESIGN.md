# MesPetitsBavons — Identité visuelle

Décrit l'app telle qu'elle est réellement codée (mis à jour le 2026-09-25). À respecter pour toute nouvelle carte ou vue ; en cas d'écart entre ce document et le code, corriger l'un ou l'autre, ne pas laisser dériver.

---

## Stack CSS

**Tailwind CSS 3**, mode nuit par la classe `dark` sur `<html>`. Pas de design system externe : tout est fait à la main.
Police système (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, …`), définie dans `src/index.css`.

---

## Couleurs

### Fonds et bordures
| Usage | Light | Dark |
|---|---|---|
| Fond de page | `bg-gradient-to-br from-blue-50 to-purple-50` | `dark:from-[#0a0918] dark:to-[#0d0a1a]` |
| Carte | `bg-white` | `dark:bg-[#0f0e1a]` |
| Bordure de carte | `border border-indigo-100` | `dark:border-[#2d2b5e]` |
| En-tête de tableau | `bg-indigo-50/50` | `dark:bg-[#151228]` |
| Séparateur de lignes | `border-indigo-50` | `dark:border-[#1e1c3a]` |
| Tuile de stat secondaire | `bg-slate-50` | `dark:bg-slate-700` |

### Textes
| Usage | Light | Dark |
|---|---|---|
| Principal | `text-slate-800` | `dark:text-slate-100` |
| Secondaire | `text-slate-600` / `text-slate-700` | `dark:text-slate-300` / `dark:text-slate-200` |
| Discret (légendes, dates) | `text-slate-500` | `dark:text-slate-400` |
| Très discret (rang « 1. » des Records, séparateurs) | `text-slate-400` | `dark:text-slate-500` |

`text-slate-400` sur fond blanc est peu contrasté : le réserver à ce qui est vraiment secondaire, jamais à une information qu'on doit lire.

### Couleurs de sens
| Signification | Classe |
|---|---|
| Victoire, buts marqués, GA positif | `text-green-600 dark:text-green-400` |
| Défaite, buts encaissés, GA négatif | `text-red-600 dark:text-red-400` |
| Nul / neutre | `text-slate-400`, `bg-slate-400` |
| Points | `text-indigo-600 dark:text-indigo-400` |
| Note moyenne | `text-amber-600 dark:text-amber-400` |
| Moyennes | `text-blue-600` (buts) / `text-orange-600` (encaissés) |

### Couleurs par entraîneur (identitaires, fixes)
Source unique : `src/constants.js` (`playerColors`, `playerColorHex`, `playerColorText`, `playerColorBorder`, `playerColorBg`). Ne jamais recopier une table de couleurs dans un composant.
```
Paul   #2563eb (bleu)     Adrien #16a34a (vert)
Tiago  #9333ea (violet)   Roman  #ea580c (orange)
```

---

## Navigation et sélecteurs

La différence de style entre niveaux est **voulue** : elle indique où on se trouve.

| Niveau | Actif | Exemple |
|---|---|---|
| Onglets principaux | `bg-violet-600 text-white` | Classement / Entraîneurs / Records / Joueurs |
| Saisons | `bg-indigo-700 text-white` | 2025/2026 / All-Time |
| Sous-onglets (ligues, Records, choix du coach) | `bg-purple-400 text-white` | Général / Ligue 1 … ; Entraîneurs / Exploits … |
| Sous-onglets de la fiche entraîneur | `bg-violet-500 text-white` | Effectifs / Confront. / Tops / Records |
| Vues et stats du Général | `bg-blue-600 text-white` (boutons bordés) | Tableau / Évolution ; Buts / Pannes … |
| Bascule compacte | fond `bg-slate-100`, actif `bg-white shadow-sm` | ⚽ / ⭐ / 🙈 |

Conteneur de barre d'onglets : `bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-1 border border-indigo-100 dark:border-[#2d2b5e]`.
Tout onglet et toute vue doivent être reflétés dans l'URL (hash, voir `App.jsx`), pour que le bouton retour et les liens partagés fonctionnent.

---

## Cartes

- **Carte standard** : `bg-white dark:bg-[#0f0e1a] rounded-2xl border border-indigo-100 dark:border-[#2d2b5e]`, avec `data-card` + `<ShareBtn />` quand elle est partageable. Pas d'effet de soulèvement au survol.
- **Carte de record** (onglet Records uniquement, pour marquer le caractère exceptionnel) : dégradé coloré, `rounded-lg p-4 border-2`, composant `RecordCard`.
- **Jamais de carte dans une carte** : un groupe de cartes a un titre de section (`h3 text-lg font-bold`) posé directement sur le fond, pas un conteneur blanc englobant.
- Les accroches des sous-onglets Records (« Ma question préférée ? »…) sont un `h2 text-sm font-medium text-slate-500`, hors de toute carte.
- `ShareBtn` est positionné en `absolute top-2 right-2` : garder de la marge à droite du contenu en haut de carte (dernière colonne de tableau assez large, `pr-8` sur une ligne de titre + boutons).

---

## Rangs et classements

- **Tableaux** : rang en chiffre `font-bold text-indigo-300 dark:text-indigo-500`, pas de gestion d'ex-aequo.
- **Records** : `RankBadge` « 1. » en `text-slate-400`, largeur fixe ; en cas d'ex-aequo, rang vide et nom aligné sur la ligne du dessus (`withRankLabels`).
- Pas de médailles emoji (🥇🥈🥉) pour les rangs.

---

## Abréviations de ligues

Une seule règle, `ligueAbbr()` dans `src/constants.js` :
`Premier League` → **PL**, `Ligue des Champions` → **LDC**, `Ligue 1` → **L1** ; `Liga` et `Serie A` restent en entier.

---

## Mobile

- Largeur de référence : 360 à 430 px. Aucun chevauchement toléré avec le lecteur et les boutons flottants en haut à droite.
- Les tableaux gardent leurs colonnes, avec `table-fixed`, `text-xs sm:text-sm`, `px-1 sm:px-6`. Un en-tête qui ne tient pas passe en version courte sur mobile (`<span className="sm:hidden">` / `hidden sm:inline`), jamais en retour à la ligne.
- Barres d'onglets à 4 éléments : `flex-nowrap` + libellés courts sous `sm`.

---

## Graphiques (Recharts)

- Couleurs des lignes = `playerColorHex`.
- Pas de grille (`CartesianGrid` retiré), courbes `type="natural"`.
- Tooltip personnalisé, entrées triées par classement à la date survolée.
- Tirette (`Brush`) ouverte par défaut sur toute la saison ; `padding` sur l'axe X pour ne pas rogner les dates.

---

## Mode nuit

- Chaque couleur de texte, fond ou bordure a son équivalent `dark:`.
- Fonds sombres en hex violacés (`#0f0e1a`, `#151228`, `#1e1c3a`, `#2d2b5e`), pas `slate-800`.
- Dégradés colorés en dark : `/30` d'opacité (`dark:from-green-900/30`).

---

## Philosophie

- **Dense mais lisible** : beaucoup d'info, jamais de page vide.
- **La couleur d'un entraîneur est sacrée** : identique partout.
- **Popups légers** (overlay fixe + carte centrée) plutôt que des pages de détail.
- **Émojis pour le ton**, dans les titres et les records ; pas comme seule façon de transmettre une information.
