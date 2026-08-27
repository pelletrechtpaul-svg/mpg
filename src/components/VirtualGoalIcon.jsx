// Ballon utilisé pour marquer un but virtuel/MPG (bonification de note comptée
// comme un but) - même forme qu'un ballon de foot classique, mais les
// pentagones normalement noirs sont en vert pour le distinguer d'un but réel.
export function VirtualGoalIcon({ className = 'w-4 h-4 inline-block align-[-3px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="white" stroke="#16a34a" strokeWidth="1.1" />
      <path d="M12 7.4l3.1 2.25-1.2 3.65h-3.8l-1.2-3.65z" fill="#16a34a" />
      <path d="M12 7.4V4.3M15.1 9.65l3.05-1.35M13.9 13.3l2.15 2.75M10.1 13.3l-2.15 2.75M8.9 9.65L5.85 8.3"
        stroke="#16a34a" strokeWidth="1" strokeLinecap="round" fill="none" />
    </svg>
  );
}
