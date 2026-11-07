import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { compareTranslations, placeholders, reportProblems } from './compare.mjs';

describe('placeholders', () => {
  it('lists the placeholders of a message, sorted', () => {
    assert.deepEqual(placeholders('{$start} – {$end} de {$length}'), ['end', 'length', 'start']);
    assert.deepEqual(placeholders('Sin huecos'), []);
  });
});

describe('compareTranslations', () => {
  const source = {
    'login.title': 'Acceso',
    'paginator.range': '{$start} – {$end} de {$length}',
  };

  it('finds nothing wrong in a complete translation', () => {
    const problems = compareTranslations(source, {
      'login.title': 'Sign in',
      'paginator.range': '{$start} – {$end} of {$length}',
    });

    assert.deepEqual(problems, { missing: [], stale: [], placeholders: [] });
  });

  it('reports the messages without translation, the leftovers and the broken placeholders', () => {
    const problems = compareTranslations(source, {
      'paginator.range': '{$start} of {$length}',
      'login.old': 'Old text',
    });

    assert.deepEqual(problems, {
      missing: ['login.title'],
      stale: ['login.old'],
      placeholders: ['paginator.range'],
    });
  });
});

describe('reportProblems', () => {
  it('describes each problem of each language, or nothing when all is well', () => {
    const lines = reportProblems({
      en: { missing: ['login.title'], stale: [], placeholders: [] },
      ca: { missing: [], stale: ['login.old'], placeholders: ['paginator.range'] },
    });

    assert.deepEqual(lines, [
      'messages.en.json: without translation: login.title',
      'messages.ca.json: no longer in the app: login.old',
      'messages.ca.json: placeholders differ from the source: paginator.range',
    ]);
    assert.deepEqual(reportProblems({ en: { missing: [], stale: [], placeholders: [] } }), []);
  });
});
