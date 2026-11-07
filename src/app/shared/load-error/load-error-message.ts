import { DataError } from '../../data/data-error';

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
    default:
      return $localize`:@@loadError.unknown:No se ha podido cargar. Inténtalo de nuevo.`;
  }
}
