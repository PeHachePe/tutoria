import type { DataErrorKind } from '../data/data-error';

/**
 * Message of the login form for a failed sign-in. A wrong password, a disabled account and an
 * unknown email share one message, so the form never reveals which accounts exist.
 */
export function signInErrorMessage(kind: DataErrorKind): string {
  switch (kind) {
    case 'unauthorized':
      return $localize`:@@login.errors.unauthorized:Correo o contraseña incorrectos`;
    case 'network':
      return $localize`:@@login.errors.network:No hay conexión. Comprueba la red e inténtalo de nuevo`;
    case 'rate_limited':
      return $localize`:@@login.errors.rateLimited:Demasiados intentos. Espera un momento e inténtalo de nuevo`;
    default:
      return $localize`:@@login.errors.unknown:No se ha podido entrar. Inténtalo de nuevo`;
  }
}
