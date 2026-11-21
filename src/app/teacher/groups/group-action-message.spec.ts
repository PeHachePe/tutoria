import { DataError } from '../../data/data-error';
import { groupActionMessage } from './group-action-message';

describe('groupActionMessage', () => {
  it('says there is no connection', () => {
    expect(groupActionMessage('save', new DataError('network'))).toMatch(/Sin conexión/);
  });

  it('says why a started group is not removed', () => {
    expect(groupActionMessage('remove', new DataError('invalid'))).toMatch(/No se puede eliminar/);
  });

  it('says somebody cannot be enrolled', () => {
    expect(groupActionMessage('enroll', new DataError('invalid'))).toMatch(/Vuelve a buscarlo/);
  });

  it('says the class closed while it was shown', () => {
    expect(groupActionMessage('enroll', new DataError('forbidden'))).toMatch(/ya terminó/);
  });

  it('is generic otherwise', () => {
    expect(groupActionMessage('unenroll', new Error('boom'))).toMatch(/No se ha podido guardar/);
    expect(groupActionMessage('save', new DataError('invalid'))).toMatch(/No se ha podido guardar/);
  });
});
