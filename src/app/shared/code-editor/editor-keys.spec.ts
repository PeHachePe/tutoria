import { editorKeys } from './editor-keys';

describe('editorKeys', () => {
  it('names the keys as on a PC', () => {
    expect(editorKeys(false)).toEqual({ format: 'Mayús + Alt + F', run: 'Ctrl + Intro' });
  });

  it('names them with the symbols of a Mac', () => {
    expect(editorKeys(true)).toEqual({ format: 'Mayús + ⌥ + F', run: '⌘ + Intro' });
  });
});
