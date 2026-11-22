import { isFormatKey } from './format-key';

const FORMAT = { code: 'KeyF', shiftKey: true, altKey: true, ctrlKey: false, metaKey: false };

describe('isFormatKey', () => {
  it('is Mayús + Alt + F by the key, whatever character it types', () => {
    expect(isFormatKey(FORMAT)).toBe(true);
  });

  it.each([
    ['another key', { code: 'KeyG' }],
    ['without Mayús', { shiftKey: false }],
    ['without Alt', { altKey: false }],
    ['with Ctrl', { ctrlKey: true }],
    ['with ⌘', { metaKey: true }],
  ])('is not %s', (_, change) => {
    expect(isFormatKey({ ...FORMAT, ...change })).toBe(false);
  });
});
