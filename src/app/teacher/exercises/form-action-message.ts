import { DataError } from '../../data/data-error';

/** What the form asks of the server besides saving (4.3c): checking a solution or translating. */
export type FormAction = 'check' | 'translate';

const FAILED: Record<FormAction, string> = {
  check: $localize`:@@exerciseForm.checkFailed:No se han podido ejecutar las pruebas.`,
  translate: $localize`:@@exerciseForm.translateFailed:No se ha podido traducir.`,
};

/** What to do about it, from the kind of error (4.2). */
function advice(action: FormAction, error: unknown): string {
  switch (error instanceof DataError ? error.kind : 'unknown') {
    case 'network':
      return $localize`:@@exerciseForm.actionError.network:Comprueba la conexión e inténtalo de nuevo.`;
    case 'rate_limited':
      return $localize`:@@exerciseForm.actionError.rateLimited:Muchas peticiones seguidas: espera un momento.`;
    case 'unauthorized':
      return $localize`:@@exerciseForm.actionError.unauthorized:Tu sesión ha caducado: vuelve a entrar.`;
    case 'forbidden':
      return $localize`:@@exerciseForm.actionError.forbidden:Solo los docentes pueden hacerlo.`;
    case 'unavailable':
      return action === 'translate'
        ? $localize`:@@exerciseForm.actionError.translateUnavailable:La IA no está disponible ahora o no ha respetado el código del enunciado: inténtalo más tarde o tradúcelo a mano.`
        : $localize`:@@exerciseForm.actionError.unavailable:Este servicio no está disponible ahora mismo: inténtalo más tarde.`;
    default:
      return $localize`:@@exerciseForm.actionError.unknown:Inténtalo de nuevo.`;
  }
}

/** The message of a check or a translation that failed: what failed and what to do. */
export function formActionMessage(action: FormAction, error: unknown): string {
  return `${FAILED[action]} ${advice(action, error)}`;
}
