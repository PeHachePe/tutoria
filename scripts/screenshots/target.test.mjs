import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseTarget } from './target.mjs';

describe('parseTarget', () => {
  it('captures every finished screen of a delivery, with dark mode, from scratch', () => {
    assert.deepEqual(parseTarget(['pec3']), {
      screens: 'all',
      folder: 'memoria/pec3/{screen}',
      dark: true,
      clean: 'memoria/pec3',
    });
    assert.equal(parseTarget(['pec4']).clean, 'memoria/pec4');
  });

  it('captures the version of a screen when its step closes', () => {
    assert.deepEqual(parseTarget(['1.2', '02-catalogo']), {
      screens: ['02-catalogo'],
      folder: 'evolucion/02-catalogo/1.2',
      dark: false,
      clean: null,
    });
  });

  it('accepts steps added between two others, such as 1.1b', () => {
    assert.equal(parseTarget(['1.1b', '01-acceso']).folder, 'evolucion/01-acceso/1.1b');
  });

  it('accepts screen codes with a letter, such as 05b-datos', () => {
    assert.equal(parseTarget(['1.9', '05b-datos']).folder, 'evolucion/05b-datos/1.9');
  });

  it('puts the screenshots of an iteration in their own folder', () => {
    assert.equal(
      parseTarget(['1.3', '03-trabajo', 'iteracion-2']).folder,
      'evolucion/03-trabajo/1.3/iteracion-2',
    );
  });

  for (const args of [
    [],
    ['pec5'],
    ['pec3', '02-catalogo'],
    ['1.2'],
    ['catalogo', '1.2'],
    ['1.2', 'catalogo'],
    ['1.2', '02-catalogo', 'otra'],
    ['1.2', '02-catalogo', 'iteracion-1', 'mas'],
  ]) {
    it(`rejects "${args.join(' ')}" and explains the usage`, () => {
      assert.throws(() => parseTarget(args), /Uso:/);
    });
  }
});
