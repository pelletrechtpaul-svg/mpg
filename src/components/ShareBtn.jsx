import React from 'react';
import html2canvas from 'html2canvas';
import { Share2 } from 'lucide-react';

export const shareCard = async (element, contextText) => {
  let footer = null;
  if (contextText) {
    footer = document.createElement('div');
    footer.style.cssText = 'padding:6px 16px 12px;font-size:11px;color:#94a3b8;border-top:1px solid rgba(148,163,184,0.3);margin-top:6px;font-family:sans-serif;';
    footer.textContent = contextText;
    element.appendChild(footer);
  }
  try {
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, allowTaint: false, backgroundColor: null, logging: false });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
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
    if (footer?.parentNode) footer.parentNode.removeChild(footer);
  }
};

const ShareBtn = ({ contextText }) => (
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

export default ShareBtn;
