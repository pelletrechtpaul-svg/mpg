import { useState, useEffect } from 'react';

export function usePlayerPhotos() {
  const [photos, setPhotos] = useState({});
  useEffect(() => {
    let cancelled = false;
    fetch('/players-photos.json')
      .then(r => r.ok ? r.json() : {})
      .then(data => { if (!cancelled) setPhotos(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return photos;
}

const SIZE_CLASS = {
  lg: 'w-16 h-16 text-xl',
  md: 'w-10 h-10 text-sm',
  sm: 'w-8 h-8 text-xs',
  formation: 'w-9 h-9 sm:w-12 sm:h-12 text-xs',
};

export function InitialsAvatar({ displayName, size = 'lg' }) {
  const words = displayName.trim().split(' ');
  const initials = words.length >= 2
    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
    : displayName.slice(0, 2).toUpperCase();
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.lg;
  return (
    <div className={`${sizeClass} rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-bold text-slate-600 dark:text-slate-200 flex-shrink-0`}>
      {initials}
    </div>
  );
}

// Les photos (TheSportsDB/Wikipedia) sont souvent des fichiers bruts pesant
// plusieurs centaines de Ko. On les fait passer par un proxy de redimensionnement
// gratuit pour ne charger que la taille réellement affichée.
export function resizedPhoto(url, px) {
  if (!url) return url;
  // a=top: la plupart des photos de joueurs (têtes/portraits) ont le visage
  // dans le tiers supérieur — "attention" (détection heuristique) recadrait
  // trop souvent sur le torse/maillot.
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${px}&h=${px}&fit=cover&a=top&output=webp&q=80`;
}

const AVATAR_PX = { lg: 128, md: 80, sm: 64, formation: 96 };

export function PlayerAvatar({ joueur, ligue, displayName, photos, size = 'lg' }) {
  const [failed, setFailed] = useState(false);
  const photoUrl = photos[`${joueur}|${ligue}`];
  if (!photoUrl || failed) return <InitialsAvatar displayName={displayName} size={size} />;
  const sizeClass = (SIZE_CLASS[size] || SIZE_CLASS.lg).replace(/text-\S+/, '').trim();
  return (
    <img
      src={resizedPhoto(photoUrl, AVATAR_PX[size] || 128)}
      alt={displayName}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover flex-shrink-0 bg-slate-200 dark:bg-slate-600`}
    />
  );
}
