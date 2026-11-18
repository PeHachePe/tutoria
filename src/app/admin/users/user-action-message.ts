import { DataError } from '../../data/data-error';

/** What the screen of the users asks the server (5.1b). */
export type UserAction = 'create' | 'edit' | 'password' | 'status';

/**
 * The message of an action that failed. `invalid` is what the server refused (D-072): in an edit,
 * the role of someone with groups; in a new account, an email taken meanwhile or a password Auth
 * does not take (too many accents or emoji for its 72 bytes); in a reset, that password.
 */
export function userActionMessage(action: UserAction, error: unknown): string {
  const kind = error instanceof DataError ? error.kind : 'unknown';
  if (kind === 'network') {
    return $localize`:@@users.error.network:Sin conexión: comprueba la red e inténtalo de nuevo.`;
  }
  if (kind === 'invalid') {
    switch (action) {
      case 'edit':
        return $localize`:@@users.role.linked:No se puede cambiar el rol de quien tiene grupos a su cargo o matrículas: quítaselos antes.`;
      case 'create':
        return $localize`:@@users.error.create:No se ha creado: ese correo ya tiene una cuenta o la contraseña no se admite. Prueba con otra con menos tildes o emojis.`;
      case 'password':
        return $localize`:@@users.error.password:Esa contraseña no se admite: prueba con otra con menos tildes o emojis.`;
    }
  }
  return $localize`:@@users.error.generic:No se ha podido guardar. Inténtalo de nuevo.`;
}
