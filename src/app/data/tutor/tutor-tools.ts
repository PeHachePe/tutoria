/**
 * The tools of the tutor (2.5e, D-051), in the format of WebMCP: a name, what it does and a JSON
 * Schema of its arguments. One registry with two uses: our tutor asks for them in its answers, and
 * the open ones are registered with WebMCP for any agent of the browser. The app implements each
 * one (`execute`); the Edge Function `tutor` hands them to the model and drops any call that is not
 * here or has wrong arguments. The Edge Function imports this file as it is, so it must not import
 * anything (D-042).
 */

/** The subset of JSON Schema the tools use, which `checkToolArguments` understands. */
export type ToolSchema =
  | {
      readonly type: 'string';
      readonly description?: string;
      readonly enum?: readonly string[];
      readonly minLength?: number;
      readonly maxLength?: number;
    }
  | {
      readonly type: 'integer';
      readonly description?: string;
      readonly minimum?: number;
      readonly maximum?: number;
    }
  | { readonly type: 'boolean'; readonly description?: string }
  | {
      readonly type: 'array';
      readonly description?: string;
      readonly items: ToolSchema;
      readonly minItems?: number;
      readonly maxItems?: number;
    }
  | ObjectSchema;

export interface ObjectSchema {
  readonly type: 'object';
  readonly description?: string;
  readonly properties: Readonly<Record<string, ToolSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: false;
  readonly minProperties?: number;
}

/**
 * How our tutor uses a tool: a query gives it data and the model answers with it (the browser runs
 * it and sends the result back); a view changes only what the screen shows, so it runs at once; the
 * rest change something (another page, a setting), so the student confirms them with a button.
 */
export type ToolUse = 'query' | 'view' | 'confirm';

export interface TutorToolDefinition {
  readonly name: string;
  /** For the model and for the agents of WebMCP, in English like the rest of the contract. */
  readonly description: string;
  readonly inputSchema: ObjectSchema;
  readonly use: ToolUse;
  /** Open to any agent of the browser: never what touches the code, runs or submits (D-047). */
  readonly webMcp: boolean;
  /** The server adds it from another field of the answer; the model never asks for it (2.5f). */
  readonly fromServer?: true;
}

/** The statuses of an exercise the student can ask about; `pending` is any not submitted yet. */
export const TOOL_STATUSES = [
  'pending',
  'not_started',
  'in_progress',
  'tests_failed',
  'passed',
  'submitted',
] as const;

/** A few words of a title, a topic or a subject: enough to find it, never a text to process. */
const SEARCH_TEXT = { type: 'string', minLength: 1, maxLength: 80 } as const;

/** The most lines the tutor marks at once: more would point at nothing. */
export const MAX_HIGHLIGHTS = 5;

/** A note next to a highlighted line: a few words, like «revisa esta condición». */
export const MAX_NOTE_LENGTH = 80;

const GET_MY_PROGRESS = {
  name: 'getMyProgress',
  description:
    "The student's subjects and groups, and how many of their assigned exercises are not started, in progress, failing, passed and submitted, per subject. Optionally only the subjects whose name contains `subject`.",
  use: 'query',
  webMcp: true,
  inputSchema: {
    type: 'object',
    properties: { subject: { ...SEARCH_TEXT, description: 'Words of the name of a subject.' } },
    additionalProperties: false,
  },
} as const satisfies TutorToolDefinition;

const SEARCH_EXERCISES = {
  name: 'searchExercises',
  description:
    "The student's assigned exercises that match: words of their title, topics, block or subject, a status (`pending` is any not submitted yet) and a difficulty. Each with its id, title, block, subject, status and difficulty. Not for counting: getMyProgress counts them all.",
  use: 'query',
  webMcp: true,
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        ...SEARCH_TEXT,
        description: 'Words of the title, a topic, the block or the subject.',
      },
      status: { type: 'string', enum: TOOL_STATUSES },
      difficulty: { type: 'string', enum: ['initial', 'medium', 'advanced', 'extension'] },
      limit: { type: 'integer', minimum: 1, maximum: 10, description: '5 if not given.' },
    },
    additionalProperties: false,
  },
} as const satisfies TutorToolDefinition;

const GET_EXERCISE_STATS = {
  name: 'getExerciseStats',
  description:
    'How the student is doing with an exercise: their attempts, how many times they ran the tests and how many of those runs failed, which tests fail now, the hints they asked for and the level reached. The exercise open now if `exercise` is not given.',
  use: 'query',
  webMcp: true,
  inputSchema: {
    type: 'object',
    properties: {
      exercise: {
        ...SEARCH_TEXT,
        description: 'The id of an assigned exercise or words of its title.',
      },
    },
    additionalProperties: false,
  },
} as const satisfies TutorToolDefinition;

const GET_SETTINGS = {
  name: 'getSettings',
  description:
    "The student's settings: colour theme, language of the interface, tutor reactions, animated emojis, proactive tutor and the mascot's accessories.",
  use: 'query',
  webMcp: true,
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
} as const satisfies TutorToolDefinition;

const OPEN_EXERCISE = {
  name: 'openExercise',
  description:
    "Opens one of the student's assigned exercises: by its id, by words of its title (the pending ones first), or `next` for the one the catalog suggests. Optionally an earlier attempt, by its number.",
  use: 'confirm',
  webMcp: true,
  inputSchema: {
    type: 'object',
    properties: {
      exercise: {
        ...SEARCH_TEXT,
        description: 'The id of an assigned exercise, words of its title, or `next`.',
      },
      attempt: { type: 'integer', minimum: 1, maximum: 50 },
    },
    required: ['exercise'],
    additionalProperties: false,
  },
} as const satisfies TutorToolDefinition;

const NAVIGATE = {
  name: 'navigate',
  description:
    "Goes to a page of the student's area: the catalog of exercises (optionally the tab of a subject), the settings or the data recorded about them.",
  use: 'confirm',
  webMcp: true,
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', enum: ['catalog', 'settings', 'data'] },
      subject: { ...SEARCH_TEXT, description: 'For the catalog: words of the name of a subject.' },
    },
    required: ['to'],
    additionalProperties: false,
  },
} as const satisfies TutorToolDefinition;

const HIGHLIGHT_LINES = {
  name: 'highlightLines',
  description:
    "Marks lines of the student's code in the editor, each with an optional short note next to it in words (never code), such as «check this condition». An empty list clears the marks.",
  use: 'view',
  webMcp: true,
  inputSchema: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        maxItems: MAX_HIGHLIGHTS,
        items: {
          type: 'object',
          properties: {
            line: { type: 'integer', minimum: 1, maximum: 999 },
            note: { type: 'string', minLength: 1, maxLength: MAX_NOTE_LENGTH },
          },
          required: ['line'],
          additionalProperties: false,
        },
      },
    },
    required: ['lines'],
    additionalProperties: false,
  },
} as const satisfies TutorToolDefinition;

const POINT_AT = {
  name: 'pointAt',
  description:
    'Draws attention to a part of the screen of the exercise: an example of the statement (by its number, from 1), the first test that fails in the results, or the hidden tests.',
  use: 'view',
  webMcp: true,
  inputSchema: {
    type: 'object',
    properties: {
      target: { type: 'string', enum: ['example', 'failingTest', 'hiddenTests'] },
      example: { type: 'integer', minimum: 1, maximum: 20 },
    },
    required: ['target'],
    additionalProperties: false,
  },
} as const satisfies TutorToolDefinition;

const SET_LAYOUT = {
  name: 'setLayout',
  description:
    'Changes the layout of the screen of the exercise: the code expanded or not, the tutor docked to the right or floating, or, on a phone, the tab shown.',
  use: 'view',
  webMcp: true,
  inputSchema: {
    type: 'object',
    properties: {
      codeExpanded: { type: 'boolean' },
      tutor: { type: 'string', enum: ['docked', 'floating'] },
      tab: { type: 'string', enum: ['exercise', 'code', 'tutor'] },
    },
    minProperties: 1,
    additionalProperties: false,
  },
} as const satisfies TutorToolDefinition;

const UPDATE_SETTINGS = {
  name: 'updateSettings',
  description:
    "Changes the student's settings at once, only the ones given, and the student can undo it. Changing the language reloads the page, so it waits for the student to press a button.",
  use: 'view',
  webMcp: true,
  inputSchema: {
    type: 'object',
    properties: {
      theme: { type: 'string', enum: ['light', 'dark', 'system'] },
      language: { type: 'string', enum: ['es', 'en', 'ca'] },
      reactions: { type: 'string', enum: ['full', 'reduced', 'off'] },
      animatedEmojis: { type: 'boolean' },
      proactive: { type: 'boolean' },
      mascotHeadset: { type: 'boolean' },
      mascotBowTie: { type: 'boolean' },
      mascotBoneCursor: { type: 'boolean' },
    },
    minProperties: 1,
    additionalProperties: false,
  },
} as const satisfies TutorToolDefinition;

/** The longest line a fix may write, which is far more than a line of a first-year exercise. */
export const MAX_FIX_LINE_LENGTH = 200;

/** No arguments: what it does depends only on the screen of the exercise. */
const NO_ARGUMENTS = { type: 'object', properties: {}, additionalProperties: false } as const;

/**
 * The tools only our tutor has (2.5f, D-047): they touch the code or the submission, so they pass
 * through our validator and our rules, never through WebMCP, and the student presses their button.
 */
const INSERT_SKELETON = {
  name: 'insertSkeleton',
  description:
    'Puts the empty skeleton of the function of the exercise in the editor, with these names for its parameters. The server adds it with the skeleton of the answer.',
  use: 'confirm',
  webMcp: false,
  fromServer: true,
  inputSchema: {
    type: 'object',
    properties: {
      parameters: {
        type: 'array',
        maxItems: 8,
        items: { type: 'string', minLength: 1, maxLength: 30 },
      },
    },
    required: ['parameters'],
    additionalProperties: false,
  },
} as const satisfies TutorToolDefinition;

const FORMAT_CODE = {
  name: 'formatCode',
  description: "Puts the student's code in order: indentation, spaces, semicolons and braces.",
  use: 'confirm',
  webMcp: false,
  inputSchema: NO_ARGUMENTS,
} as const satisfies TutorToolDefinition;

const RUN_TESTS = {
  name: 'runTests',
  description: "Runs every test of the exercise with the student's code, as «Ejecutar» does.",
  use: 'confirm',
  webMcp: false,
  inputSchema: NO_ARGUMENTS,
} as const satisfies TutorToolDefinition;

const SUBMIT_ATTEMPT = {
  name: 'submitAttempt',
  description:
    'Submits the exercise, only when it passes every test: the student confirms it in the usual dialog, and then the code cannot change.',
  use: 'confirm',
  webMcp: false,
  inputSchema: NO_ARGUMENTS,
} as const satisfies TutorToolDefinition;

const PROPOSE_FIX = {
  name: 'proposeFix',
  description:
    'Fixes a slip of writing that keeps the code from running: a bracket, a semicolon, a comma or a quote missing or left over, or a misspelt name (`retrun`, `lenght`, `Math.flor`). One line, as it should be (`code`), or a new line with only what closes (`insert`). Never what makes the tests fail: the server turns down any other change.',
  use: 'confirm',
  webMcp: false,
  inputSchema: {
    type: 'object',
    properties: {
      line: { type: 'integer', minimum: 1, maximum: 999 },
      code: { type: 'string', maxLength: MAX_FIX_LINE_LENGTH },
      insert: { type: 'boolean', description: 'Adds `code` as a new line before `line`.' },
    },
    required: ['line', 'code'],
    additionalProperties: false,
  },
} as const satisfies TutorToolDefinition;

/** Every tool, by name, with the literal types of its schema (Angular infers the arguments). */
export const TUTOR_TOOL = {
  getMyProgress: GET_MY_PROGRESS,
  searchExercises: SEARCH_EXERCISES,
  getExerciseStats: GET_EXERCISE_STATS,
  getSettings: GET_SETTINGS,
  openExercise: OPEN_EXERCISE,
  navigate: NAVIGATE,
  highlightLines: HIGHLIGHT_LINES,
  pointAt: POINT_AT,
  setLayout: SET_LAYOUT,
  updateSettings: UPDATE_SETTINGS,
  insertSkeleton: INSERT_SKELETON,
  formatCode: FORMAT_CODE,
  runTests: RUN_TESTS,
  submitAttempt: SUBMIT_ATTEMPT,
  proposeFix: PROPOSE_FIX,
} as const;

export type TutorToolName = keyof typeof TUTOR_TOOL;

/** Every tool, in the order the model sees them and the calls are kept. */
export const TUTOR_TOOLS: readonly TutorToolDefinition[] = Object.values(TUTOR_TOOL);

/** A call of the model to a tool, once checked. */
export interface ToolCall {
  readonly name: TutorToolName;
  readonly arguments: Readonly<Record<string, unknown>>;
}

/** The queries the model asks for, or the actions it takes, in one answer: more would be noise. */
export const MAX_TOOL_CALLS = 3;

export type ToolCheck =
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly error: string };

/**
 * Checks the arguments of a call against the schema of its tool. Neither Angular nor WebMCP do it,
 * and the model or an agent may send anything: every `execute` and the Edge Function call this.
 */
export function checkToolArguments(schema: ToolSchema, value: unknown): ToolCheck {
  const error = problemOf(schema, value, 'arguments');
  return error
    ? { ok: false, error }
    : { ok: true, value: value as Readonly<Record<string, unknown>> };
}

function problemOf(schema: ToolSchema, value: unknown, path: string): string | null {
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') return `${path}: expected a string`;
      if (schema.enum && !schema.enum.includes(value)) {
        return `${path}: one of ${schema.enum.join(', ')}`;
      }
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return `${path}: at least ${schema.minLength} characters`;
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return `${path}: at most ${schema.maxLength} characters`;
      }
      return null;
    case 'integer':
      if (!Number.isInteger(value)) return `${path}: expected an integer`;
      if (schema.minimum !== undefined && (value as number) < schema.minimum) {
        return `${path}: at least ${schema.minimum}`;
      }
      if (schema.maximum !== undefined && (value as number) > schema.maximum) {
        return `${path}: at most ${schema.maximum}`;
      }
      return null;
    case 'boolean':
      return typeof value === 'boolean' ? null : `${path}: expected true or false`;
    case 'array':
      return arrayProblem(schema, value, path);
    case 'object':
      return objectProblem(schema, value, path);
  }
}

function arrayProblem(
  schema: Extract<ToolSchema, { type: 'array' }>,
  value: unknown,
  path: string,
): string | null {
  if (!Array.isArray(value)) return `${path}: expected a list`;
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    return `${path}: at least ${schema.minItems} items`;
  }
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    return `${path}: at most ${schema.maxItems} items`;
  }
  for (const [index, item] of value.entries()) {
    const problem = problemOf(schema.items, item, `${path}[${index}]`);
    if (problem) return problem;
  }
  return null;
}

function objectProblem(schema: ObjectSchema, value: unknown, path: string): string | null {
  if (!isRecord(value)) return `${path}: expected an object`;
  for (const name of schema.required ?? []) {
    if (value[name] === undefined) return `${path}.${name}: required`;
  }
  const present = Object.entries(value).filter(([, property]) => property !== undefined);
  if (schema.minProperties !== undefined && present.length < schema.minProperties) {
    return `${path}: at least ${schema.minProperties} properties`;
  }
  for (const [name, property] of present) {
    const propertySchema = schema.properties[name];
    if (!propertySchema) return `${path}.${name}: not expected`;
    const problem = problemOf(propertySchema, property, `${path}.${name}`);
    if (problem) return problem;
  }
  return null;
}

/** The calls of one kind: the queries, or the actions (views and those the student confirms). */
export type ToolCallKind = 'query' | 'action';

/**
 * The calls the model asked for, as an object with the arguments of each tool by its name: those of
 * the kind asked for, in the order of the contract and no more than MAX_TOOL_CALLS. What is not in
 * the contract, is of the other kind or has wrong arguments is dropped, and said, never run.
 */
export function toolCallsOf(
  asked: unknown,
  kind: ToolCallKind,
): { readonly calls: readonly ToolCall[]; readonly dropped: readonly string[] } {
  if (!isRecord(asked)) return { calls: [], dropped: [] };
  const named = Object.entries(asked).filter(([, value]) => value !== null);
  const dropped = named
    .filter(([name, value]) => {
      const tool = TUTOR_TOOLS.find((candidate) => candidate.name === name);
      return !tool || kindOf(tool.use) !== kind || !checkToolArguments(tool.inputSchema, value).ok;
    })
    .map(([name]) => name);
  const calls = TUTOR_TOOLS.filter(
    (tool) => kindOf(tool.use) === kind && asked[tool.name] != null && !dropped.includes(tool.name),
  )
    .slice(0, MAX_TOOL_CALLS)
    .map((tool) => ({
      name: tool.name as TutorToolName,
      arguments: asked[tool.name] as Readonly<Record<string, unknown>>,
    }));
  return { calls, dropped };
}

function kindOf(use: ToolUse): ToolCallKind {
  return use === 'query' ? 'query' : 'action';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
