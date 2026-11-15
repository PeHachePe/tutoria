import { DataError, type DataErrorKind } from '../../data/data-error';
import { formActionMessage } from './form-action-message';

describe('formActionMessage', () => {
  it.each<[DataErrorKind, string]>([
    ['network', 'conexión'],
    ['rate_limited', 'espera'],
    ['unauthorized', 'sesión'],
    ['forbidden', 'docentes'],
    ['unavailable', 'no está disponible'],
    ['unknown', 'Inténtalo de nuevo'],
  ])('says what failed and what to do for %s', (kind, advice) => {
    const message = formActionMessage('check', new DataError(kind));

    expect(message).toContain('No se han podido ejecutar las pruebas.');
    expect(message).toContain(advice);
  });

  it('suggests translating by hand when the AI cannot', () => {
    expect(formActionMessage('translate', new DataError('unavailable'))).toContain('a mano');
    expect(formActionMessage('translate', new Error('boom'))).toContain(
      'No se ha podido traducir.',
    );
  });
});
