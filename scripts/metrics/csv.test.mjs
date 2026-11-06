import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { upsertCsvRow } from './csv.mjs';

const columns = ['step', 'session', 'cost_usd'];

describe('upsertCsvRow', () => {
  it('creates the file with its header', () => {
    const csv = upsertCsvRow('', columns, { step: '0.2', session: 'a', cost_usd: 1.5 });
    assert.equal(csv, 'step,session,cost_usd\n0.2,a,1.5\n');
  });

  it('appends a row for a new step or session', () => {
    const csv = upsertCsvRow('step,session,cost_usd\n0.2,a,1.5\n', columns, {
      step: '0.2',
      session: 'b',
      cost_usd: 2,
    });
    assert.equal(csv, 'step,session,cost_usd\n0.2,a,1.5\n0.2,b,2\n');
  });

  it('replaces the row of the same step and session', () => {
    const csv = upsertCsvRow('step,session,cost_usd\n0.2,a,1.5\n0.3,c,4\n', columns, {
      step: '0.2',
      session: 'a',
      cost_usd: 3,
    });
    assert.equal(csv, 'step,session,cost_usd\n0.2,a,3\n0.3,c,4\n');
  });

  it('quotes values with commas, quotes or line breaks', () => {
    const csv = upsertCsvRow('', columns, { step: '0.2', session: 'a,"b"', cost_usd: '' });
    assert.equal(csv, 'step,session,cost_usd\n0.2,"a,""b""",\n');
  });

  it('keeps quoted rows when it rewrites the file', () => {
    const existing = 'step,session,cost_usd\n0.1,"x,y",1\n';
    const csv = upsertCsvRow(existing, columns, { step: '0.2', session: 'a', cost_usd: 2 });
    assert.equal(csv, 'step,session,cost_usd\n0.1,"x,y",1\n0.2,a,2\n');
  });
});
