import html2canvas from 'html2canvas';
import { Share2 } from 'lucide-react';

export const JOUEURS_MERCATO = ['Roman', 'Paul', 'Adrien', 'Tiago'];

export const LIGUE_NAT_EXCLUE = {
  'Ligue 1': 'Français',
  'Liga': 'Espagnol',
  'Serie A': 'Italien',
  'Premier League': 'Anglais',
  'Bundesliga': 'Allemand',
};

export const getPosteGroupe = (poste) => {
  if (poste === 'A') return 'A';
  if (['MD', 'MO', 'MC', 'M'].includes(poste)) return 'M';
  if (['DC', 'DL', 'DG', 'DD', 'D'].includes(poste)) return 'D';
  if (poste === 'G') return 'G';
  return null;
};

export const medianFn = (arr) => {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

export const POSTE_LABEL = { A: 'Attaquants', M: 'Milieux', D: 'Défenseurs', G: 'Gardiens' };

export const playerImages = {
  'Roman': '/images/1.png',
  'Adrien': '/images/2.png',
  'Paul': '/images/3.png',
  'Tiago': '/images/4.png',
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

export const encodeFirestoreKey = (key) => key.replace(/\//g, '_');
export const decodeFirestoreKey = (key) => key.replace(/_/g, '/');

export const groupMatchesByChampionship = (matches) => {
  const map = {};
  matches.forEach(match => {
    const key = `${match.saison}-${match.ligue}-${match.championnat}`;
    if (!map[key]) map[key] = [];
    map[key].push(match);
  });
  return map;
};

export const calculateLongestStreak = (playerMatches, conditionFn) => {
  let current = 0, max = 0, maxEnd = null;
  playerMatches.forEach((match, idx) => {
    if (conditionFn(match)) {
      current++;
      if (current > max) { max = current; maxEnd = idx; }
    } else {
      current = 0;
    }
  });
  if (max === 0) return null;
  const startDate = playerMatches[maxEnd - max + 1]?.date;
  const endDate = playerMatches[maxEnd]?.date;
  return { length: max, startDate, endDate };
};

export const calculatePlayerStats = (matches, joueursList) => {
  const stats = {};
  joueursList.forEach(joueur => {
    stats[joueur] = { points: 0, matchs: 0, victoires: 0, nuls: 0, defaites: 0, buts_pour: 0, buts_contre: 0, ga: 0 };
  });
  matches.forEach(match => {
    const { joueur1, joueur2, buts_j1, buts_j2, points_j1, points_j2 } = match;
    if (stats[joueur1]) {
      stats[joueur1].points += points_j1; stats[joueur1].matchs++;
      stats[joueur1].buts_pour += buts_j1; stats[joueur1].buts_contre += buts_j2;
      if (buts_j1 > buts_j2) stats[joueur1].victoires++;
      else if (buts_j1 === buts_j2) stats[joueur1].nuls++;
      else stats[joueur1].defaites++;
    }
    if (stats[joueur2]) {
      stats[joueur2].points += points_j2; stats[joueur2].matchs++;
      stats[joueur2].buts_pour += buts_j2; stats[joueur2].buts_contre += buts_j1;
      if (buts_j2 > buts_j1) stats[joueur2].victoires++;
      else if (buts_j1 === buts_j2) stats[joueur2].nuls++;
      else stats[joueur2].defaites++;
    }
  });
  Object.keys(stats).forEach(j => { stats[j].ga = stats[j].buts_pour - stats[j].buts_contre; });
  return stats;
};

export const shareCard = async (element, contextText) => {
  let footer = null;
  if (contextText) {
    footer = document.createElement('div');
    footer.style.cssText = 'padding:6px 16px 12px;font-size:11px;color:#94a3b8;border-top:1px solid rgba(148,163,184,0.3);margin-top:6px;font-family:sans-serif;';
    footer.textContent = contextText;
    element.appendChild(footer);
  }
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: null,
      logging: false,
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'mpg-stats.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'MPG Stats' });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mpg-stats.png';
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    if (err?.name !== 'AbortError') console.error('Share failed:', err);
  } finally {
    if (footer?.parentNode) footer.parentNode.removeChild(footer);
  }
};

export const ShareBtn = ({ contextText }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      const card = e.currentTarget.closest('[data-card]');
      if (card) shareCard(card, contextText || null);
    }}
    className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/80 dark:bg-slate-700/80 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all shadow-sm"
    title="Partager"
  >
    <Share2 size={13} />
  </button>
);
