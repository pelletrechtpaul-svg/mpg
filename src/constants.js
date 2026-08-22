export const JOUEURS_MERCATO = ['Roman', 'Paul', 'Adrien', 'Tiago'];

export const LIGUE_NAT_EXCLUE = {
  'Ligue 1': 'Français',
  'Liga': 'Espagnol',
  'Serie A': 'Italien',
  'Premier League': 'Anglais',
  'Bundesliga': 'Allemand',
};

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

// Fond transparent (opacité sur la teinte vive plutôt qu'une famille
// pastel-50, sinon trop délavé) pour teinter une ligne/carte selon le coach
// sans nuire à la lisibilité du texte par-dessus.
export const playerColorBg = {
  Paul: 'bg-blue-500/10 dark:bg-blue-400/15',
  Adrien: 'bg-green-500/10 dark:bg-green-400/15',
  Tiago: 'bg-purple-500/10 dark:bg-purple-400/15',
  Roman: 'bg-orange-500/10 dark:bg-orange-400/15',
};

// Playlist SoundCloud lue par le mini-player (piloté via la Widget API).
// Laisser '' pour retomber sur les MP3 locaux (PLAYLIST ci-dessous).
export const SOUNDCLOUD_PLAYLIST_URL = 'https://soundcloud.com/paul-610524335/sets/mpg';

export const PLAYLIST = [
  { title: "Baby c'est MPG",  src: "/audio/Baby c'est MPG.mp3" },
  { title: 'Cette fusion',    src: '/audio/Cette fusion.mp3' },
  { title: 'Communiqué',      src: '/audio/Communiqué.mp3' },
  { title: 'Déni',            src: '/audio/Déni.mp3' },
  { title: 'Faut doser',      src: '/audio/Faut doser.mp3' },
  { title: 'Greenwood',       src: '/audio/Greenwood.mp3' },
  { title: 'Jeanette',        src: '/audio/Jeanette.mp3' },
  { title: 'Looser',          src: '/audio/Looser.mp3' },
  { title: 'Mercato',         src: '/audio/Mercato.mp3' },
  { title: "J'm'en vais d'ici", src: "/audio/J'm'en vais d'ici.mp3" },
  { title: 'Merci',           src: '/audio/Merci .mp3' },
  { title: "Sur la route d'Auxerre", src: "/audio/Sur la route d'Auxerre .mp3" },
];

export const MANUAL_CHAMPIONSHIPS = [
  {
    saison: '2024/2025',
    ligue: 'Ligue des Champions',
    championnat: '#1',
    matchsTotal: 6,
    standings: [
      { joueur: 'Paul',   points: 15, ga: 8,   matchs: 6, victoires: 5, nuls: 0, defaites: 1 },
      { joueur: 'Roman',  points: 12, ga: 4,   matchs: 6, victoires: 4, nuls: 0, defaites: 2 },
      { joueur: 'Adrien', points: 7,  ga: -2,  matchs: 6, victoires: 2, nuls: 1, defaites: 3 },
      { joueur: 'Tiago',  points: 1,  ga: -10, matchs: 6, victoires: 0, nuls: 1, defaites: 5 },
    ]
  }
];
