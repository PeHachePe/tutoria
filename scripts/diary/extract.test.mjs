import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OUTSIDE_PLAN, parseHours, parseNumber, parseSpanishDate, phaseOf } from './extract.mjs';

describe('parseNumber', () => {
  it('reads Spanish thousands and decimals', () => {
    assert.equal(parseNumber('1.234,5'), 1234.5);
    assert.equal(parseNumber('19,53'), 19.53);
  });
});

describe('parseSpanishDate', () => {
  it('turns a date into ISO', () => {
    assert.equal(parseSpanishDate('06/11/2026'), '2026-11-06');
  });

  it('takes the last date of a range', () => {
    assert.equal(parseSpanishDate('24-25/11/2026'), '2026-11-25');
    assert.equal(parseSpanishDate('19/11/2026 y 20/11/2026'), '2026-11-20');
  });

  it('returns null without a date', () => {
    assert.equal(parseSpanishDate('—'), null);
  });
});

describe('parseHours', () => {
  it('reads hours, hours and minutes, and minutes', () => {
    assert.equal(parseHours('≈ 2,5 h'), 2.5);
    assert.equal(parseHours('≈ 1 h 30 min (estimadas)'), 1.5);
    assert.equal(parseHours('45 min (Claude Code)'), 0.75);
  });

  it('counts only the working time when the cell also gives the session time', () => {
    assert.equal(parseHours('13 h 29 min con pausas; ≈ 1 h 30 min de trabajo'), 1.5);
    assert.equal(
      parseHours('41 h 56 min de sesión, ≈ 1 h 25 min de trabajo (Claude Code)'),
      1 + 25 / 60,
    );
  });

  it('is 0 when there is no time', () => {
    assert.equal(parseHours('—'), 0);
  });
});

describe('phaseOf', () => {
  it('is the first digit of a plan step', () => {
    assert.equal(phaseOf('4.1e'), 4);
    assert.equal(phaseOf('5 (plan)'), 5);
  });

  it('groups the work outside the plan', () => {
    assert.equal(phaseOf('auditoría (BD)'), OUTSIDE_PLAN);
  });
});
