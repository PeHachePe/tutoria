import type { AttemptStatus } from '../attempt';
import type { Difficulty } from '../exercise';
import {
  checkToolArguments,
  MAX_TOOL_CALLS,
  TOOL_STATUSES,
  toolCallsOf,
  TUTOR_TOOL,
  TUTOR_TOOLS,
  type ToolSchema,
} from './tutor-tools';

describe('tutor tools', () => {
  it('have unique names, each one under its own key', () => {
    const names = TUTOR_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const [key, tool] of Object.entries(TUTOR_TOOL)) {
      expect(tool.name).toBe(key);
    }
  });

  it('take an object without other properties', () => {
    for (const tool of TUTOR_TOOLS) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.additionalProperties).toBe(false);
    }
  });

  it('use the statuses and difficulties of the app', () => {
    // Compiles only while the contract and the app agree
    const statuses: readonly (AttemptStatus | 'pending')[] = TOOL_STATUSES;
    const difficulties: readonly Difficulty[] =
      TUTOR_TOOL.searchExercises.inputSchema.properties.difficulty.enum;
    expect(statuses).toContain('pending');
    expect(difficulties).toEqual(['initial', 'medium', 'advanced', 'extension']);
  });
});

describe('checkToolArguments', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 5 },
      mode: { type: 'string', enum: ['a', 'b'] },
      count: { type: 'integer', minimum: 1, maximum: 3 },
      on: { type: 'boolean' },
      items: {
        type: 'array',
        maxItems: 2,
        items: {
          type: 'object',
          properties: { line: { type: 'integer', minimum: 1 } },
          required: ['line'],
          additionalProperties: false,
        },
      },
    },
    required: ['name'],
    additionalProperties: false,
  } as const satisfies ToolSchema;

  it('accepts what the schema describes', () => {
    const value = { name: 'abc', mode: 'b', count: 3, on: false, items: [{ line: 2 }] };
    expect(checkToolArguments(schema, value)).toEqual({ ok: true, value });
  });

  it('says what is wrong and where', () => {
    const cases: [unknown, string][] = [
      [null, 'arguments: expected an object'],
      [[], 'arguments: expected an object'],
      [{}, 'arguments.name: required'],
      [{ name: '' }, 'arguments.name: at least 1 characters'],
      [{ name: 'toolong' }, 'arguments.name: at most 5 characters'],
      [{ name: 3 }, 'arguments.name: expected a string'],
      [{ name: 'a', mode: 'c' }, 'arguments.mode: one of a, b'],
      [{ name: 'a', count: 1.5 }, 'arguments.count: expected an integer'],
      [{ name: 'a', count: 0 }, 'arguments.count: at least 1'],
      [{ name: 'a', count: 4 }, 'arguments.count: at most 3'],
      [{ name: 'a', on: 'yes' }, 'arguments.on: expected true or false'],
      [{ name: 'a', items: {} }, 'arguments.items: expected a list'],
      [
        { name: 'a', items: [{ line: 1 }, { line: 2 }, { line: 3 }] },
        'arguments.items: at most 2 items',
      ],
      [{ name: 'a', items: [{ line: 0 }] }, 'arguments.items[0].line: at least 1'],
      [{ name: 'a', items: [{ line: 1, x: 1 }] }, 'arguments.items[0].x: not expected'],
      [{ name: 'a', extra: true }, 'arguments.extra: not expected'],
    ];
    for (const [value, error] of cases) {
      expect(checkToolArguments(schema, value)).toEqual({ ok: false, error });
    }
  });

  it('checks the size of lists and objects', () => {
    const list = { type: 'array', minItems: 1, items: { type: 'boolean' } } as const;
    expect(checkToolArguments(list, [])).toEqual({
      ok: false,
      error: 'arguments: at least 1 items',
    });
    const some = {
      type: 'object',
      properties: { a: { type: 'boolean' } },
      minProperties: 1,
      additionalProperties: false,
    } as const;
    expect(checkToolArguments(some, {})).toEqual({
      ok: false,
      error: 'arguments: at least 1 properties',
    });
  });

  it('checks the arguments of every tool', () => {
    expect(checkToolArguments(TUTOR_TOOL.getSettings.inputSchema, {}).ok).toBe(true);
    expect(
      checkToolArguments(TUTOR_TOOL.highlightLines.inputSchema, {
        lines: [{ line: 3, note: 'Revisa la condición' }],
      }).ok,
    ).toBe(true);
    expect(checkToolArguments(TUTOR_TOOL.updateSettings.inputSchema, {}).ok).toBe(false);
    expect(checkToolArguments(TUTOR_TOOL.updateSettings.inputSchema, { theme: 'pink' }).ok).toBe(
      false,
    );
  });
});

describe('toolCallsOf', () => {
  it('keeps the valid calls of the kind asked for, in the order of the contract', () => {
    const asked = {
      setLayout: { codeExpanded: true },
      highlightLines: { lines: [{ line: 2 }] },
      getMyProgress: {},
    };
    expect(toolCallsOf(asked, 'action')).toEqual({
      calls: [
        { name: 'highlightLines', arguments: { lines: [{ line: 2 }] } },
        { name: 'setLayout', arguments: { codeExpanded: true } },
      ],
      dropped: ['getMyProgress'],
    });
    expect(toolCallsOf(asked, 'query')).toEqual({
      calls: [{ name: 'getMyProgress', arguments: {} }],
      dropped: ['setLayout', 'highlightLines'],
    });
  });

  it('drops what is not in the contract, has wrong arguments or is null', () => {
    expect(
      toolCallsOf(
        {
          writeCode: { code: 'return 1' },
          navigate: { to: 'admin' },
          pointAt: null,
          openExercise: { exercise: 'next' },
        },
        'action',
      ),
    ).toEqual({
      calls: [{ name: 'openExercise', arguments: { exercise: 'next' } }],
      dropped: ['writeCode', 'navigate'],
    });
  });

  it('takes nothing from what is not an object, and no more calls than the limit', () => {
    expect(toolCallsOf(undefined, 'action')).toEqual({ calls: [], dropped: [] });
    expect(toolCallsOf(['navigate'], 'action')).toEqual({ calls: [], dropped: [] });
    const many = {
      openExercise: { exercise: 'next' },
      navigate: { to: 'settings' },
      highlightLines: { lines: [] },
      pointAt: { target: 'hiddenTests' },
      setLayout: { tab: 'code' },
    };
    expect(toolCallsOf(many, 'action').calls).toHaveLength(MAX_TOOL_CALLS);
  });
});
