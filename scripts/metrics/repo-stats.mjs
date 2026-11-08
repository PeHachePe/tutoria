/**
 * Adds up the output of `git diff --numstat`, leaving out the excluded paths.
 * Binary files count as changed files without lines.
 *
 * @param {string} numstat
 * @param {string[]} excluded
 */
export function parseNumstat(numstat, excluded) {
  const stats = { added: 0, deleted: 0, files: [] };
  for (const line of numstat.split('\n')) {
    const [added, deleted, file] = line.split('\t');
    if (!file || excluded.includes(file)) {
      continue;
    }
    stats.added += Number(added) || 0;
    stats.deleted += Number(deleted) || 0;
    stats.files.push(file);
  }
  return stats;
}

/** @param {string} content */
export function countLines(content) {
  if (!content) {
    return 0;
  }
  const breaks = content.split('\n').length - 1;
  return content.endsWith('\n') ? breaks : breaks + 1;
}

/**
 * Counts the test cases of a spec file: calls to `it()` and `test()`, also with
 * modifiers such as `it.skip()`, but not the groups and hooks that also hang from
 * them in Playwright (`test.describe()`, `test.beforeEach()`…). Strings and comments
 * are blanked out first, so examples written inside them (as in the tests of this
 * very counter) do not count.
 *
 * @param {string} source
 */
export function countTests(source) {
  const code = source.replace(
    /\/\/.*$|\/\*[\s\S]*?\*\/|`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/gm,
    '""',
  );
  return (
    code.match(
      /(?<![\w.$])(?:it|test)(?:\.(?:skip|only|todo|fixme|fail|failing|each|concurrent|sequential))?\s*\(/g,
    )?.length ?? 0
  );
}

/**
 * The commit a step starts from, read from `git log --format='%H %s'` (newest first): the one
 * before the oldest commit of the step, whose subject ends with `(step <step>)`. While the step has
 * no commits yet, that is the last commit. Null when the step goes back to the first commit, or
 * there are none: then it is measured from the start of history. Meant for the step being closed:
 * for an older step, the changes of the later ones would count too.
 *
 * @param {string} log
 * @param {string} step
 */
export function stepBase(log, step) {
  const suffix = `(step ${step})`;
  const commits = log
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const space = line.indexOf(' ');
      return { hash: line.slice(0, space), subject: line.slice(space + 1) };
    });
  const oldestOfStep = commits.findLastIndex(({ subject }) => subject.trimEnd().endsWith(suffix));
  const base = oldestOfStep === -1 ? commits[0] : commits[oldestOfStep + 1];
  return base?.hash ?? null;
}

/**
 * Number of tests Vitest ran, from its JSON report (`numTotalTests`). It counts each row of
 * `it.each()` and each test written in a loop, which reading the sources cannot. Null without a
 * readable report.
 *
 * @param {string} report
 */
export function countVitestTests(report) {
  try {
    const total = JSON.parse(report).numTotalTests;
    return Number.isInteger(total) ? total : null;
  } catch {
    return null;
  }
}
