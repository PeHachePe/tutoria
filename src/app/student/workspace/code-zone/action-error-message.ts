import { DataError } from '../../../data/data-error';
import type { ActionError } from '../attempt-store';

const FAILED: Record<ActionError['action'], string> = {
  run: $localize`:@@workspace.runFailed:No se han podido ejecutar las pruebas.`,
  submit: $localize`:@@workspace.submitFailed:No se ha podido entregar.`,
};

/** What to do about it, from the kind of error (4.2); the code is never lost. */
function advice(error: unknown): string {
  switch (error instanceof DataError ? error.kind : 'unknown') {
    case 'network':
      return $localize`:@@workspace.actionError.network:Comprueba la conexión e inténtalo de nuevo.`;
    case 'rate_limited':
      return $localize`:@@workspace.actionError.rateLimited:Has ejecutado muchas veces seguidas: espera un momento.`;
    case 'unauthorized':
      return $localize`:@@workspace.actionError.unauthorized:Tu sesión ha caducado: vuelve a entrar para continuar.`;
    default:
      return $localize`:@@workspace.actionError.unknown:Inténtalo de nuevo.`;
  }
}

/** Message for a run or a submission that failed (CU-01, 4b): what failed and what to do. */
export function actionErrorMessage({ action, error }: ActionError): string {
  return `${FAILED[action]} ${advice(error)}`;
}
