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
