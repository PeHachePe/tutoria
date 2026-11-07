// Compares a translation file with the messages extracted from the app (npm run i18n, D-023).

const PLACEHOLDER = /\{\$([^}]+)\}/g;

/** Names of the `{$name}` placeholders of a message, sorted, to compare them in any order. */
export function placeholders(text) {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1]).sort();
}

/**
 * What is wrong with a translation: source messages it lacks, messages the app no longer has, and
 * messages whose placeholders differ from the source (a lost `{$end}` would hide a number).
 */
export function compareTranslations(source, translation) {
  const missing = Object.keys(source).filter((id) => !(id in translation));
  const stale = Object.keys(translation).filter((id) => !(id in source));
  const changed = Object.keys(source).filter(
    (id) =>
      id in translation && placeholders(source[id]).join() !== placeholders(translation[id]).join(),
  );
  return { missing, stale, placeholders: changed };
}

const DESCRIPTIONS = {
  missing: 'without translation',
  stale: 'no longer in the app',
  placeholders: 'placeholders differ from the source',
};

/** One line per kind of problem and language; empty when every translation is complete. */
export function reportProblems(problemsByLocale) {
  return Object.entries(problemsByLocale).flatMap(([locale, problems]) =>
    Object.entries(DESCRIPTIONS)
      .filter(([kind]) => problems[kind].length > 0)
      .map(
        ([kind, description]) =>
          `messages.${locale}.json: ${description}: ${problems[kind].join(', ')}`,
      ),
  );
}
