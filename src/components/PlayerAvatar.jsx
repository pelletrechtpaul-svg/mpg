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
  formation: 'w-11 h-11 sm:w-14 sm:h-14 text-xs',
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
  // wsrv.nl refuse le domaine sofascore ("Domain or TLD blocked by policy") :
  // on sert ces URLs telles quelles. Ce sont déjà des portraits carrés serrés,
  // le pré-crop à 65% leur couperait le visage de toute façon.
  if (url.includes('img.sofascore.com')) return url;
  // Recadrage carré par saillance (libvips « attention », qui pondère les tons
  // chair) : il suit le visage quelle que soit la source — portrait posé
  // TheSportsDB comme photo d'action large.
  //
  // Ne PAS revenir à un pré-crop cx/cy/cw/ch : wsrv applique ces paramètres
  // APRÈS le redimensionnement, donc `ch=65%` renvoyait du 160x104 au lieu du
  // carré demandé. `object-cover` re-recadrait ensuite ce rectangle, ce qui
  // zoomait ~1,5x et coupait le haut du crâne.
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${px}&h=${px}&fit=cover&a=attention&output=webp&q=80`;
}

const AVATAR_PX = { lg: 128, md: 80, sm: 64, formation: 112 };

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
      // Sofascore renvoie 403 dès qu'un Referer est présent (anti-hotlink).
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover flex-shrink-0 bg-slate-200 dark:bg-slate-600`}
    />
  );
}
