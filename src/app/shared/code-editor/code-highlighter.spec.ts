import { highlightJavaScript } from './code-highlighter';

describe('highlightJavaScript', () => {
  it('gives each piece of the code the colour of what it is', () => {
    const pieces = highlightJavaScript("function greet(name) {\n  return 'Hi ' + name; // 1\n}");
    const classesOf = (text: string) => pieces.find((piece) => piece.text === text)?.classes;

    expect(classesOf('function')).toBe('font-semibold text-primary');
    expect(classesOf('greet')).toBe('font-semibold text-on-surface');
    expect(classesOf("'Hi '")).toBe('text-tertiary');
    expect(classesOf('// 1')).toBe('italic text-on-surface-variant');
  });

  it('keeps all the text, line breaks included', () => {
    const code = 'Math.floor(7.8);\nconst ok = true;';

    const pieces = highlightJavaScript(code);

    expect(pieces.map((piece) => piece.text).join('')).toBe(code);
    expect(pieces.find((piece) => piece.text === '7.8')?.classes).toBe('text-info');
    expect(pieces.find((piece) => piece.text === 'floor')?.classes).toBe('text-secondary');
  });
});
