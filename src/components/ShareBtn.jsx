import React from 'react';
import { toBlob } from 'html-to-image';
import { Share2 } from 'lucide-react';

// Rendu via html-to-image (SVG foreignObject) : c'est le navigateur lui-même
// qui fait la mise en page, donc la capture est identique à l'écran. L'ancien
// html2canvas réimplémentait son propre moteur et déformait la carte Effectif
// (cercles écrasés, libellés décalés, texte du reste de l'effectif coupé).
const renderBlob = (element) => toBlob(element, {
  pixelRatio: 2,
  // Le fond transparent laisserait WhatsApp composer sur du blanc : on reprend
  // celui de la carte telle qu'elle est affichée (clair ou sombre).
  backgroundColor: getComputedStyle(element).backgroundColor,
  cacheBust: true,
  // OBLIGATOIRE ici : sans ça, html-to-image calcule sa clé de cache avec
  // `url.replace(/\?.*/, '')`. Nos avatars passent tous par le proxy
  // `https://wsrv.nl/?url=...` — seule la query string les distingue — donc
  // toutes les photos se réduisaient à la clé `https://wsrv.nl/` et la carte
  // partagée affichait le premier visage téléchargé pour TOUS les joueurs.
  includeQueryParams: true,
});

export const shareCard = async (element, contextText) => {
  let footer = null;
  if (contextText) {
    footer = document.createElement('div');
    footer.style.cssText = 'padding:6px 16px 12px;font-size:11px;color:#94a3b8;border-top:1px solid rgba(148,163,184,0.3);margin-top:6px;font-family:sans-serif;';
    footer.textContent = contextText;
    element.appendChild(footer);
  }
  // Le bouton de partage ne doit pas se retrouver dans l'image partagée.
  const hidden = [...element.querySelectorAll('[data-share-hide]')];
  hidden.forEach(el => { el.style.visibility = 'hidden'; });
  try {
    // Premier rendu souvent incomplet (polices/images encore en cours
    // d'inlining) : on le jette et on garde le second.
    await renderBlob(element);
    const blob = await renderBlob(element);
    const file = new File([blob], 'mpg-stats.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'MPG Stats' });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'mpg-stats.png'; a.click();
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    if (err?.name !== 'AbortError') console.error('Share failed:', err);
  } finally {
    hidden.forEach(el => { el.style.visibility = ''; });
    if (footer?.parentNode) footer.parentNode.removeChild(footer);
  }
};

const ShareBtn = ({ contextText }) => (
  <button
    data-share-hide
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

export default ShareBtn;
