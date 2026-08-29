// Ballon utilisé pour marquer un but virtuel/MPG (bonification de note comptée
// comme un but) : le vrai emoji ⚽ (même dessin que pour un but réel), teinté
// en vert via un filtre CSS plutôt que redessiné à la main.
export function VirtualGoalIcon({ className = 'inline-block' }) {
  return (
    <span
      role="img"
      aria-label="but virtuel"
      className={className}
      style={{ filter: 'sepia(1) saturate(6) hue-rotate(70deg) brightness(0.9)' }}
    >
      ⚽
    </span>
  );
}
