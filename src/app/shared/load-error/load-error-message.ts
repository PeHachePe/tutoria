import { DataError, type DataErrorKind } from '../../data/data-error';

/** Message for a screen whose data could not be loaded, from the error a data service threw (4.2). */
export function loadErrorMessage(error: unknown): string {
  switch (error instanceof DataError ? error.kind : 'unknown') {
    case 'network':
      return $localize`:@@loadError.network:No hay conexión. Comprueba la red e inténtalo de nuevo.`;
    case 'unauthorized':
      return $localize`:@@loadError.unauthorized:Tu sesión ha caducado. Vuelve a entrar para continuar.`;
    case 'forbidden':
    case 'not_found':
      return $localize`:@@loadError.noAccess:No tienes acceso a este contenido.`;
    case 'rate_limited':
      return $localize`:@@loadError.rateLimited:Demasiadas peticiones. Espera un momento e inténtalo de nuevo.`;
    case 'unavailable':
      return $localize`:@@loadError.unavailable:Este servicio no está disponible ahora mismo. Inténtalo más tarde.`;
    default:
      return $localize`:@@loadError.unknown:No se ha podido cargar. Inténtalo de nuevo.`;
  }
}

/** Kinds of error that trying again cannot fix: the user has no access to what they asked for. */
const NO_ACCESS_KINDS: readonly DataErrorKind[] = ['forbidden', 'not_found'];

/** Whether «Reintentar» can help: without access, the screen offers a way out instead. */
export function isRetryable(error: unknown): boolean {
  return !(error instanceof DataError && NO_ACCESS_KINDS.includes(error.kind));
}
