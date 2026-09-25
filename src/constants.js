export const JOUEURS_MERCATO = ['Roman', 'Paul', 'Adrien', 'Tiago'];

// Saisons jouées avant qu'on ne se mette à saisir les données détaillées par
// match (buteurs, notes, valises) et le mercato : les stats qui en dépendent
// (étude de banc, buteurs/CSC par joueur, effectifs, records mercato...)
// seraient vides ou trompeuses sur ces saisons, donc masquées plutôt
// qu'affichées à 0 comme si la donnée existait et valait zéro.
export const SEASONS_SANS_DONNEES_DETAILLEES = ['2024/2025', '2025/2026'];
export const hasDetailedData = (selectedSeason) =>
  selectedSeason !== 'All-Time' && !SEASONS_SANS_DONNEES_DETAILLEES.includes(selectedSeason);

export const LIGUE_NAT_EXCLUE = {
  'Ligue 1': 'Français',
  'Liga': 'Espagnol',
  'Serie A': 'Italien',
  'Premier League': 'Anglais',
  'Bundesliga': 'Allemand',
};

// Liste officielle des ligues, dans l'ordre d'affichage. Ces chaînes exactes
// servent de clé partout (matches, mercato, metadata) : l'import mercato
// refuse tout autre nom.
export const LIGUES = ['Ligue 1', 'Premier League', 'Liga', 'Serie A', 'Ligue des Champions'];

// Règle unique d'abréviation des ligues ; Liga et Serie A restent en entier.
const LIGUE_ABBR = { 'Premier League': 'PL', 'Ligue des Champions': 'LDC', 'Ligue 1': 'L1' };
export const ligueAbbr = ligue => LIGUE_ABBR[ligue] || ligue;

export const POSTE_LABEL = { A: 'Attaquants', M: 'Milieux', D: 'Défenseurs', G: 'Gardiens' };

export const playerImages = {
  'Roman': '/images/Roman.png',
  'Adrien': '/images/Adrien.png',
  'Paul': '/images/Paul.png',
  'Tiago': '/images/Tiago.png',
};

export const playerColors = {
  Paul: 'bg-blue-600',
  Adrien: 'bg-green-600',
  Tiago: 'bg-purple-600',
  Roman: 'bg-orange-600',
};

export const playerColorHex = {
  Paul: '#2563eb',
  Adrien: '#16a34a',
  Tiago: '#9333ea',
  Roman: '#ea580c',
};

// Variantes text-*/border-* dérivées des mêmes teintes que playerColors/
// playerColorHex ci-dessus — source unique pour éviter que chaque écran
// recopie sa propre table de couleurs par coach (source de désync si un
// jour une couleur change).
export const playerColorText = {
  Paul: 'text-blue-600 dark:text-blue-400',
  Adrien: 'text-green-600 dark:text-green-400',
  Tiago: 'text-purple-600 dark:text-purple-400',
  Roman: 'text-orange-600 dark:text-orange-400',
};

export const playerColorBorder = {
  Paul: 'border-blue-200 dark:border-blue-800',
  Adrien: 'border-green-200 dark:border-green-800',
  Tiago: 'border-purple-200 dark:border-purple-800',
  Roman: 'border-orange-200 dark:border-orange-800',
};

// Fond transparent pour teinter une ligne/carte selon le coach, sans nuire à
// la lisibilité du texte par-dessus. Utilise le même hex que playerColorHex
// (via la syntaxe Tailwind bg-[#xxxxxx+alpha]) plutôt qu'une teinte de la
// palette Tailwind standard (bg-blue-500 etc.) pour être visuellement la
// même couleur que les autres badges coach de l'app, pas une approximation.
// NB : Tailwind scanne des chaînes de classe statiques dans le code source
// pour générer le CSS - ces valeurs ne peuvent pas être dérivées de
// playerColorHex par du JS à l'exécution, elles doivent rester recopiées
// ici en dur et synchronisées à la main si playerColorHex change.
export const playerColorBg = {
  Paul: 'bg-[#2563eb40] dark:bg-[#2563eb59]',
  Adrien: 'bg-[#16a34a40] dark:bg-[#16a34a59]',
  Tiago: 'bg-[#9333ea40] dark:bg-[#9333ea59]',
  Roman: 'bg-[#ea580c40] dark:bg-[#ea580c59]',
};

// Playlist SoundCloud lue par le mini-player (piloté via la Widget API).
export const SOUNDCLOUD_PLAYLIST_URL = 'https://soundcloud.com/paul-610524335/sets/mpg';
