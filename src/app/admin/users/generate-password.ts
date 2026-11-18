/** Long enough to resist guessing and short enough to dictate or copy by hand. */
export const GENERATED_PASSWORD_LENGTH = 12;

/** Letters and digits without those that look alike when handed over on paper: 0 O, 1 l I. */
export const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/**
 * A random password for a new account or a reset (5.1b), which the administration hands over in
 * person (D-072). The values come from the browser's cryptographic generator; the bias of the modulo
 * over 2³² values is negligible.
 */
export function generatePassword(
  fillRandom: (array: Uint32Array<ArrayBuffer>) => void = (array) => crypto.getRandomValues(array),
): string {
  const values = new Uint32Array(GENERATED_PASSWORD_LENGTH);
  fillRandom(values);
  return Array.from(values, (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join(
    '',
  );
}
