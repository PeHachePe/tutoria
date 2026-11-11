import { formatCode } from './format-code';

describe('formatCode', () => {
  it('indents the code and puts its spaces, semicolons and braces in order', async () => {
    const messy =
      'function sum(numbers){\nlet total=0\n    for(const n of numbers){total=total+n}\nreturn total}';

    expect(await formatCode(messy, 0)).toEqual({
      ok: true,
      code: [
        'function sum(numbers) {',
        '  let total = 0;',
        '  for (const n of numbers) {',
        '    total = total + n;',
        '  }',
        '  return total;',
        '}',
        '',
      ].join('\n'),
      cursor: 0,
    });
  });

  it('keeps the cursor on the same piece of code', async () => {
    const code = 'let  a=1;\nlet b=2;';
    const result = await formatCode(code, code.indexOf('b'));

    expect(result.ok && result.code.slice(result.cursor, result.cursor + 1)).toBe('b');
  });

  it('writes texts with single quotes, as the exercises do', async () => {
    expect(await formatCode('const s = "hi"', 0)).toMatchObject({ code: "const s = 'hi';\n" });
  });

  it('says the line of the error when the code cannot be read', async () => {
    expect(await formatCode('function f() {\n  return (1;\n}', 0)).toEqual({ ok: false, line: 2 });
  });

  it('fails without a line for an error that does not say one', async () => {
    expect(await formatCode('x', 0, () => Promise.reject(new Error('down')))).toEqual({
      ok: false,
    });
  });
});
