import { isNoveltyVoice, byQuality } from './voice-quality';

const voice = (name: string, local = true) => ({ id: name, name, lang: 'es-ES', local });

describe('voice quality', () => {
  it('puts the natural and network voices first, then the system ones, then the novelty ones', () => {
    const voices = [
      voice('Grandma (español (España))'),
      voice('Mónica'),
      voice('Google español', false),
      voice('Eddy (español (España))'),
      voice('Microsoft Elvira Online (Natural) - Spanish (Spain)', false),
      voice('Paulina (mejorada)'),
      voice('Jorge'),
    ];
    expect([...voices].sort(byQuality('es')).map((each) => each.name)).toEqual([
      'Google español',
      'Microsoft Elvira Online (Natural) - Spanish (Spain)',
      'Paulina (mejorada)',
      'Jorge',
      'Mónica',
      'Eddy (español (España))',
      'Grandma (español (España))',
    ]);
  });

  it('tells the novelty voices of macOS', () => {
    for (const name of [
      'Eddy',
      'Flo (español (México))',
      'Grandpa',
      'Reed',
      'Rocko',
      'Sandy',
      'Shelley',
      'Bells',
      'Zarvox',
    ]) {
      expect(isNoveltyVoice(voice(name))).toBe(true);
    }
    expect(isNoveltyVoice(voice('Mónica'))).toBe(false);
    expect(isNoveltyVoice(voice('Floriana'))).toBe(false);
  });
});
