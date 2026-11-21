import { DataError } from '../../data/data-error';

/** What the screen of the groups asks the server (5.2b). */
/** `evaluate`: the final evaluation of a student (5.2g). */
export type GroupAction = 'save' | 'remove' | 'enroll' | 'unenroll' | 'evaluate';

/**
 * The message of an action that failed. `invalid` is what the server refused (5.2a): removing a
 * group somebody started, or enrolling someone who stopped being an active student meanwhile;
 * `forbidden`, a class that closed while it was shown (5.2e).
 */
export function groupActionMessage(action: GroupAction, error: unknown): string {
  const kind = error instanceof DataError ? error.kind : 'unknown';
  if (kind === 'network') {
    return $localize`:@@groups.error.network:Sin conexión: comprueba la red e inténtalo de nuevo.`;
  }
  if (kind === 'forbidden') {
    // A class of a past year (5.2e): the screen offers nothing, unless it closed while open
    return $localize`:@@groups.error.closed:Esta clase es de un curso que ya terminó: no se puede cambiar.`;
  }
  if (kind === 'invalid' && action === 'remove') {
    return $localize`:@@groups.remove.started:No se puede eliminar: ya hay alumnos con trabajo en este grupo.`;
  }
  if (kind === 'invalid' && action === 'enroll') {
    // A disabled account, or one class a year (5.2g): another teacher put them in theirs meanwhile
    return $localize`:@@groups.error.enroll:Alguno ya no se puede matricular: puede que tenga ya otra clase este curso o que su cuenta esté desactivada. Vuelve a buscarlo.`;
  }
  return $localize`:@@groups.error.generic:No se ha podido guardar. Inténtalo de nuevo.`;
}
