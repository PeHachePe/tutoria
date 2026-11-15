/**
 * The names of the code of an exercise (4.3, D-057): its function and its parameters are plain
 * identifiers in ASCII, like the check of `exercise.function_name`, so they read the same in every
 * language and never mix Spanish and English («Spanglish»). The form recommends English.
 */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Words JavaScript keeps for itself: a function or a parameter with one of them fails to parse. */
const RESERVED_WORDS: ReadonlySet<string> = new Set(
  (
    'break case catch class const continue debugger default delete do else enum export extends ' +
    'false finally for function if import in instanceof let new null return static super switch ' +
    'this throw true try typeof var void while with yield await implements interface package ' +
    'private protected public arguments eval'
  ).split(' '),
);

/** Whether `name` can name the function of an exercise or one of its parameters. */
export function isIdentifier(name: string): boolean {
  return IDENTIFIER.test(name) && !RESERVED_WORDS.has(name);
}
