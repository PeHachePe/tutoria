import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { countLines, countTests, parseNumstat } from './repo-stats.mjs';

describe('parseNumstat', () => {
  it('adds the lines of each changed file', () => {
    const stats = parseNumstat('10\t2\tsrc/app/app.ts\n3\t0\tpackage.json\n', []);
    assert.deepEqual(stats, { added: 13, deleted: 2, files: ['src/app/app.ts', 'package.json'] });
  });

  it('counts binary files without lines', () => {
    const stats = parseNumstat('-\t-\tdocs/capturas/a.png\n', []);
    assert.deepEqual(stats, { added: 0, deleted: 0, files: ['docs/capturas/a.png'] });
  });

  it('leaves out excluded files', () => {
    const stats = parseNumstat('5\t1\tpackage-lock.json\n1\t1\tREADME.md\n', ['package-lock.json']);
    assert.deepEqual(stats, { added: 1, deleted: 1, files: ['README.md'] });
  });
});

describe('countLines', () => {
  it('counts the lines of a text with or without a final newline', () => {
    assert.equal(countLines('a\nb\n'), 2);
    assert.equal(countLines('a\nb'), 2);
    assert.equal(countLines(''), 0);
  });
});

describe('countTests', () => {
  it('counts it() and test() calls, skipping describe()', () => {
    const source = `
      describe('x', () => {
        it('a', () => {});
        it.skip('b', () => {});
        test('c', async () => {});
      });
    `;
    assert.equal(countTests(source), 3);
  });

  it('does not count words that only end in it or test', () => {
    assert.equal(countTests('submit(); latest(); contest()'), 0);
  });

  it('ignores calls written inside strings and comments', () => {
    const source = [
      "it('real one', () => {",
      "  const example = `it('fake', () => {})`;",
      '  const other = "test(\'fake\')";',
      "  // it('commented out')",
      '});',
    ].join('\n');
    assert.equal(countTests(source), 1);
  });
});
