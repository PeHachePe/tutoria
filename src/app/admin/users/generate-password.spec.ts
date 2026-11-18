import {
  GENERATED_PASSWORD_LENGTH,
  generatePassword,
  PASSWORD_ALPHABET,
} from './generate-password';

describe('generatePassword', () => {
  it('is as long as it should, from the alphabet without the characters that look alike', () => {
    const password = generatePassword();

    expect(password).toHaveLength(GENERATED_PASSWORD_LENGTH);
    expect([...password].every((character) => PASSWORD_ALPHABET.includes(character))).toBe(true);
    for (const lookalike of ['0', 'O', '1', 'l', 'I']) {
      expect(PASSWORD_ALPHABET).not.toContain(lookalike);
    }
  });

  it('takes its characters from the random values it is given', () => {
    const random = (array: Uint32Array) => void array.fill(PASSWORD_ALPHABET.length + 2);

    expect(generatePassword(random)).toBe(PASSWORD_ALPHABET[2].repeat(GENERATED_PASSWORD_LENGTH));
  });
});
