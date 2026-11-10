import { DataError } from '../../../data/data-error';

/** What to do about it, from the kind of error (4.2); what the student asked is never lost. */
function advice(error: unknown): string {
  switch (error instanceof DataError ? error.kind : 'unknown') {
    case 'network':
      return $localize`:@@tutor.error.network:Comprueba la conexión e inténtalo de nuevo.`;
    case 'rate_limited':
      return $localize`:@@tutor.error.rateLimited:Has preguntado muchas veces seguidas: espera un momento.`;
    case 'unauthorized':
      return $localize`:@@tutor.error.unauthorized:Tu sesión ha caducado: vuelve a entrar para continuar.`;
    case 'unavailable':
      return $localize`:@@tutor.error.unavailable:Ahora mismo no está disponible: inténtalo más tarde.`;
    default:
      return $localize`:@@tutor.error.unknown:Inténtalo de nuevo.`;
  }
}

/** Message for an answer of the tutor that did not arrive (CU-02): what failed and what to do. */
export function tutorErrorMessage(error: unknown): string {
  return `${$localize`:@@tutor.error:El tutor no ha podido responder.`} ${advice(error)}`;
}
