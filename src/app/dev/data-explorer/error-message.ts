import { DataError, DataErrorKind } from '../../data/data-error';

const MESSAGES: Record<DataErrorKind, string> = {
  network: 'Sin conexión con el servidor.',
  unauthorized: 'No hay sesión o ha caducado.',
  forbidden: 'No tienes permiso para hacer esto.',
  not_found: 'No existe o no tienes acceso.',
  rate_limited: 'Demasiadas peticiones: espera un momento.',
  invalid: 'La operación no está permitida en el estado actual.',
  unknown: 'Error desconocido.',
};

/** Spanish message for an error of a data service, with its kind for the developer. */
export function errorMessage(error: unknown): string {
  return error instanceof DataError
    ? `${MESSAGES[error.kind]} (${error.kind})`
    : 'Error inesperado.';
}
