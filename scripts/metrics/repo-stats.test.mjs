import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { countLines, countTests, countVitestTests, parseNumstat, stepBase } from './repo-stats.mjs';

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

  it('skips the groups and hooks of Playwright, which also hang from test', () => {
    const source = `
      test.describe('x', () => {
        test.beforeEach(async () => {});
        test.afterAll(async () => {});
        test('a', async () => {});
        test.only('b', async () => {});
        test.fixme('c', async () => {});
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

describe('stepBase', () => {
  // `git log --format=%H %s`, newest first
  const log = [
    'c3 docs: record step 1.4 commits (step 1.4)',
    'c2 feat(workspace): code editor (step 1.4)',
    'c1 docs: update step 1.3 metrics (step 1.3)',
    'c0 feat(workspace): layout (step 1.3)',
  ].join('\n');

  it('starts the step at the commit before its oldest one', () => {
    assert.equal(stepBase(log, '1.4'), 'c1');
  });

  it('starts at the last commit while the step has none', () => {
    assert.equal(stepBase(log, '1.5'), 'c3');
  });

  it('does not take a step for another that starts the same (1.1 and 1.1b)', () => {
    const steps = [
      'b2 fix: mascot (step 1.1b)',
      'b1 feat: access (step 1.1)',
      'b0 chore: base',
    ].join('\n');
    assert.equal(stepBase(steps, '1.1'), 'b0');
    assert.equal(stepBase(steps, '1.1b'), 'b1');
  });

  it('measures from the start of history when every commit is of the step', () => {
    assert.equal(stepBase('a1 feat: x (step 0.1)\na0 chore: y (step 0.1)', '0.1'), null);
  });

  it('has no base in a repository without commits', () => {
    assert.equal(stepBase('', '0.1'), null);
  });
});

describe('countVitestTests', () => {
  it('reads the number of tests Vitest ran from its JSON report', () => {
    assert.equal(
      countVitestTests(JSON.stringify({ numTotalTests: 524, numPassedTests: 524 })),
      524,
    );
  });

  it('gives null for a missing or unreadable report', () => {
    assert.equal(countVitestTests(''), null);
    assert.equal(countVitestTests('{'), null);
    assert.equal(countVitestTests('{}'), null);
  });
});
