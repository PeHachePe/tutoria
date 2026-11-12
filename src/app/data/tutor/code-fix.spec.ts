import { checkFix, declaresFunction, MAX_FIX_EDITS, previewFix, suggestFix } from './code-fix';

const LOOP = [
  'function sum(numbers) {',
  '  let total = 0;',
  '  for (let i = 0; i < numbers.length; i++) {',
  '    total += numbers[i];',
  '  }',
  '  return total;',
  '}',
];

/** The code of LOOP with one of its lines replaced. */
function withLine(line: number, text: string, lines: readonly string[] = LOOP): string {
  return lines.map((each, index) => (index === line - 1 ? text : each)).join('\n');
}

describe('checkFix', () => {
  it('accepts a misspelt keyword, and gives the code with it fixed', () => {
    const source = withLine(6, '  retrun total;');
    const check = checkFix(source, { line: 6, code: '  return total;' });
    expect(check).toEqual({
      ok: true,
      code: LOOP.join('\n'),
      line: 6,
      changes: [{ before: 'retrun', after: 'return' }],
      namesOnly: true,
    });
  });

  it('accepts a bracket that is missing or left over', () => {
    const missing = withLine(3, '  for (let i = 0; i < numbers.length; i++ {');
    expect(checkFix(missing, { line: 3, code: LOOP[2] })).toEqual(
      expect.objectContaining({
        ok: true,
        changes: [{ before: '', after: ')' }],
        namesOnly: false,
      }),
    );
    const extra = withLine(2, '  let total = 0;;');
    expect(checkFix(extra, { line: 2, code: LOOP[1] })).toEqual(
      expect.objectContaining({ ok: true, changes: [{ before: ';', after: '' }] }),
    );
  });

  it('accepts a misspelt property or method of the language, which may throw nothing', () => {
    const length = withLine(3, '  for (let i = 0; i < numbers.lenght; i++) {');
    expect(checkFix(length, { line: 3, code: LOOP[2] })).toEqual(
      expect.objectContaining({ ok: true, changes: [{ before: 'lenght', after: 'length' }] }),
    );
    const floor = 'function half(n) {\n  return Math.flor(n / 2);\n}';
    expect(checkFix(floor, { line: 2, code: '  return Math.floor(n / 2);' }).ok).toBe(true);
  });

  it('accepts a misspelt name of the code into the one declared', () => {
    const source = withLine(4, '    totla += numbers[i];');
    expect(checkFix(source, { line: 4, code: LOOP[3] }).ok).toBe(true);
  });

  it('accepts a function renamed to the one the exercise asks for', () => {
    const source = withLine(1, 'function suma(numbers) {');
    expect(checkFix(source, { line: 1, code: LOOP[0] }, { functionName: 'sum' }).ok).toBe(true);
    // Without the exercise, the name declared is as good as any other
    expect(checkFix(source, { line: 1, code: LOOP[0] })).toEqual({
      ok: false,
      problem: 'not_a_slip',
    });
  });

  it('accepts a new line with only what closes, such as a missing brace', () => {
    const source = LOOP.slice(0, -1).join('\n');
    expect(checkFix(source, { line: 7, code: '}', insert: true })).toEqual({
      ok: true,
      code: LOOP.join('\n'),
      line: 7,
      changes: [{ before: '', after: '}' }],
      namesOnly: false,
    });
  });

  it('turns down what changes the logic, however small', () => {
    const source = LOOP.join('\n');
    // One character, and the solution
    expect(checkFix(source, { line: 3, code: LOOP[2].replace('<', '<=') })).toEqual({
      ok: false,
      problem: 'not_a_slip',
    });
    // A missing bracket does not let anything else through
    const missing = withLine(3, '  for (let i = 0; i < numbers.length; i++ {');
    expect(
      checkFix(missing, { line: 3, code: '  for (let i = 0; i <= numbers.length; i++) {' }).ok,
    ).toBe(false);
    // Numbers, a name that exists for another and another operator
    expect(checkFix(source, { line: 2, code: '  let total = 1;' }).ok).toBe(false);
    expect(checkFix(source, { line: 4, code: '    total += numbers[0];' }).ok).toBe(false);
    expect(checkFix(source, { line: 4, code: '    total += numbers[total];' }).ok).toBe(false);
    expect(checkFix(source, { line: 4, code: '    total -= numbers[i];' }).ok).toBe(false);
  });

  it('turns down a name too far from the one written, or a name not known', () => {
    const source = withLine(6, '  retrun total;');
    expect(checkFix(source, { line: 6, code: '  result total;' }).ok).toBe(false);
    const short = withLine(6, '  return tt;');
    expect(checkFix(short, { line: 6, code: '  return total;' }).ok).toBe(false);
  });

  it('turns down more than a few changes', () => {
    const source = withLine(4, '    total += numbers[i]');
    expect(checkFix(source, { line: 4, code: '    total += ((numbers[i]));' })).toEqual({
      ok: false,
      problem: 'too_big',
    });
    expect(MAX_FIX_EDITS).toBe(3);
  });

  it('turns down a line that is not there, or a change that changes nothing', () => {
    const source = LOOP.join('\n');
    expect(checkFix(source, { line: 9, code: '}' })).toEqual({ ok: false, problem: 'line' });
    expect(checkFix(source, { line: 9, code: '}', insert: true }).ok).toBe(false);
    expect(checkFix(source, { line: 2, code: 'let total = 0;' })).toEqual({
      ok: false,
      problem: 'unchanged',
    });
  });

  it('turns down a new line with code, or with nothing', () => {
    const source = LOOP.slice(0, -1).join('\n');
    expect(checkFix(source, { line: 7, code: 'return 0;', insert: true }).ok).toBe(false);
    expect(checkFix(source, { line: 7, code: '  ', insert: true }).ok).toBe(false);
    expect(checkFix(source, { line: 7, code: '}}}}', insert: true }).ok).toBe(false);
  });

  it('knows the names declared in any form: arrows, destructuring and catch', () => {
    const source = [
      'const half = (n) => n / 2;',
      'const twice = m => m * 2;',
      'const [first, second] = [1, 2];',
      'try { half(first); } catch (problem) { console.log(problm); }',
    ].join('\n');
    const fixed = 'try { half(first); } catch (problem) { console.log(problem); }';
    expect(checkFix(source, { line: 4, code: fixed }).ok).toBe(true);
    expect(checkFix(source, { line: 2, code: 'const twice = m => n * 2;' }).ok).toBe(false);
  });

  it('turns down a name removed, and checks each name changed on its own', () => {
    const source = LOOP.join('\n');
    expect(checkFix(source, { line: 2, code: '  total = 0;' }).ok).toBe(false);
    const two = withLine(4, '    totla += numbres[i];');
    expect(checkFix(two, { line: 4, code: '    total+=numbers[i];' }).ok).toBe(true);
    expect(checkFix(two, { line: 4, code: '    total+numbers[i];' }).ok).toBe(false);
  });

  it('turns down changes in the comments', () => {
    const source = withLine(2, '  let total = 0; // the sum');
    expect(checkFix(source, { line: 2, code: '  let total = 0; // the sum;' }).ok).toBe(false);
  });
});

describe('previewFix', () => {
  it('says what a fix changes, slip or not, or that the code no longer needs it', () => {
    const source = withLine(6, '  retrun total;');
    expect(previewFix(source, { line: 6, code: '  return total;' })).toEqual({
      ok: true,
      changes: [{ before: 'retrun', after: 'return' }],
    });
    expect(previewFix(LOOP.join('\n'), { line: 3, code: LOOP[2].replace('<', '<=') })).toEqual({
      ok: true,
      changes: [{ before: '', after: '=' }],
    });
    expect(previewFix(LOOP.join('\n'), { line: 6, code: '  return total;' })).toEqual({
      ok: false,
      problem: 'unchanged',
    });
    expect(previewFix('', { line: 0, code: '}' })).toEqual({ ok: false, problem: 'line' });
  });
});

describe('suggestFix', () => {
  it('finds a misspelt keyword, method or name', () => {
    expect(suggestFix(withLine(6, '  retrun total;'))).toEqual({
      line: 6,
      code: '  return total;',
    });
    expect(suggestFix('function half(n) {\n  return Math.flor(n / 2);\n}')).toEqual({
      line: 2,
      code: '  return Math.floor(n / 2);',
    });
    expect(suggestFix(withLine(4, '    totla += numbers[i];'))).toEqual({
      line: 4,
      code: LOOP[3],
    });
  });

  it('finds nothing in code without slips, in texts or with two names as close', () => {
    expect(suggestFix(LOOP.join('\n'))).toBeNull();
    expect(suggestFix("function hi() {\n  return 'retrun';\n}")).toBeNull();
    expect(suggestFix('function big(a, b) {\n  return Math.mix(a, b);\n}')).toBeNull();
    expect(suggestFix('// retrun\nfunction one() {\n  return 1;\n}')).toBeNull();
  });
});

describe('declaresFunction', () => {
  it('says whether the code declares the function, in any of its forms', () => {
    expect(declaresFunction('function sum(numbers) {}', 'sum')).toBe(true);
    expect(declaresFunction('const sum = (numbers) => 0;', 'sum')).toBe(true);
    expect(declaresFunction('let sum = function (numbers) {};', 'sum')).toBe(true);
    expect(declaresFunction('function summary() {}', 'sum')).toBe(false);
    expect(declaresFunction('', 'sum')).toBe(false);
  });
});
