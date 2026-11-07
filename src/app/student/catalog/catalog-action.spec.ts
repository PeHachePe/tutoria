import type { AttemptStatus } from '../../data/attempt';
import { catalogAction } from './catalog-action';

describe('catalogAction', () => {
  it.each<[AttemptStatus, string, string]>([
    ['not_started', 'Empezar', 'tonal'],
    ['in_progress', 'Continuar', 'filled'],
    ['tests_failed', 'Continuar', 'filled'],
    ['passed', 'Continuar', 'filled'],
    ['submitted', 'Repasar', 'outlined'],
  ])('offers %s as "%s" with a %s button', (status, label, appearance) => {
    expect(catalogAction(status)).toEqual({ label, appearance });
  });
});
