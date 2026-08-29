// Ballon utilisé pour marquer un but virtuel/MPG (bonification de note comptée
// comme un but) : le vrai emoji ⚽, teinté en vert via un filtre CSS.
//
// sepia()/saturate()/hue-rotate() sont des transformations linéaires : sur du
// noir pur (0,0,0) elles ne changent rien (matrice × 0 = 0), et c'est le
// blanc qui se retrouve fortement teinté - d'où le résultat inversé de la
// première tentative (blanc → vert, noir resté noir). En encadrant la
// teinte de deux invert(1), le noir passe par blanc (donc SE fait teinter)
// et le blanc passe par noir (donc reste inchangé par la teinte, puis
// redevient blanc au 2e invert) : le blanc reste garanti blanc, seul le
// noir est recoloré.
export function VirtualGoalIcon({ className = 'inline-block' }) {
  return (
    <span
      role="img"
      aria-label="but virtuel"
      className={className}
      style={{ filter: 'invert(1) sepia(1) saturate(6) hue-rotate(260deg) invert(1)' }}
    >
      ⚽
    </span>
  );
}
