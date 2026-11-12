import { z } from 'zod';

import {
  EMOTIONS,
  type Emotion,
  type Intensity,
  REACTION_KINDS,
  type ReactionKind,
  skeletonBlock,
  skeletonParameters,
} from '../../../src/app/data/tutor/tutor-contract.ts';
import {
  type ObjectSchema,
  type ToolCall,
  type ToolCallKind,
  type ToolSchema,
  toolCallsOf,
  TUTOR_TOOLS,
} from '../../../src/app/data/tutor/tutor-tools.ts';
import { SYNTAX_TOPICS, syntaxBlocks } from '../../../src/app/data/tutor/syntax-examples.ts';
import type { AnswerFormat, FormatTool } from './llm-provider.ts';

/** What the model answers (2.6), once checked. */
export interface ModelAnswer {
  readonly message: string;
  readonly emotion: Emotion;
  readonly intensity: Intensity;
  /** Only one of the catalog; any other is dropped and the app uses the one of the emotion. */
  readonly reaction?: ReactionKind;
  /** The student tried to get the solution. */
  readonly elusion: boolean;
  /** What the tutor does with its tools (2.5e): only calls of the contract, checked. */
  readonly actions?: readonly ToolCall[];
}

/** Why an answer of the model is not good enough, which decides how to ask again. */
export type AnswerProblem = 'invalid' | 'code';

export type AnswerCheck =
  | { readonly ok: true; readonly answer: ModelAnswer }
  | {
      readonly ok: false;
      readonly problem: AnswerProblem;
      /** An answer turned down for its code still says whether the student asked for the solution. */
      readonly elusion?: boolean;
    };

const answerSchema = z.object({
  message: z.string(),
  emotion: z.enum(EMOTIONS),
  intensity: z.number().int().min(1).max(3),
  reaction: z.string().optional(),
  elusion: z.boolean().default(false),
  // A wrong one is dropped, never a reason to ask again: the answer is still good without it
  skeleton: z.array(z.string()).optional().catch(undefined),
  syntax: z.array(z.string()).optional().catch(undefined),
  // Checked one by one against the contract (toolCallsOf): a wrong call is dropped, never asked again
  query: z.unknown().optional(),
  actions: z.unknown().optional(),
});

/**
 * The calls of one kind as the model writes them: an object with the arguments of each tool by its
 * name, all optional. `minProperties` stays out: not every provider takes it, and the contract
 * checks it anyway.
 */
function toolsFormat(kind: ToolCallKind): Record<string, unknown> {
  return {
    type: 'object',
    properties: Object.fromEntries(
      FORMAT_TOOLS.filter((tool) => tool.group === groupOf(kind)).map((tool) => [
        tool.name,
        tool.parameters,
      ]),
    ),
  };
}

function groupOf(kind: ToolCallKind): FormatTool['group'] {
  return kind === 'query' ? 'query' : 'actions';
}

/**
 * The tools of the contract as the provider gets them (D-051): not those the server adds from
 * another field, such as the skeleton (2.5f).
 */
const FORMAT_TOOLS: readonly FormatTool[] = TUTOR_TOOLS.filter((tool) => !tool.fromServer).map(
  (tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: modelSchema(tool.inputSchema) as Record<string, unknown>,
    group: groupOf(tool.use === 'query' ? 'query' : 'action'),
  }),
);

function modelSchema(schema: ToolSchema): ToolSchema {
  if (schema.type === 'array') return { ...schema, items: modelSchema(schema.items) };
  if (schema.type !== 'object') return schema;
  const { minProperties: _ignored, ...rest } = schema;
  return {
    ...rest,
    properties: Object.fromEntries(
      Object.entries(schema.properties).map(([name, property]) => [name, modelSchema(property)]),
    ),
  } satisfies ObjectSchema;
}

/** The shape the provider is asked to follow, when it can (`response_format`). */
export const ANSWER_FORMAT: AnswerFormat = {
  name: 'tutor_answer',
  schema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      emotion: { type: 'string', enum: [...EMOTIONS] },
      intensity: { type: 'integer', minimum: 1, maximum: 3 },
      reaction: { type: 'string', enum: [...REACTION_KINDS] },
      elusion: { type: 'boolean' },
      // The names of the parameters of the empty skeleton, which the server writes (2.5d)
      skeleton: { type: 'array', items: { type: 'string' } },
      // The topics of the examples of syntax, which the server writes from its catalog (2.5d)
      syntax: { type: 'array', items: { type: 'string', enum: [...SYNTAX_TOPICS] } },
      // The data of the student the model needs before answering, and what it does (2.5e)
      query: toolsFormat('query'),
      actions: toolsFormat('action'),
    },
    required: ['message', 'emotion', 'intensity', 'reaction', 'elusion'],
  },
  tools: FORMAT_TOOLS,
};

/**
 * Lines that look like code rather than words: a declaration or a statement, an assignment, a lone
 * brace or a line ending in `;`. Words that talk about the code («fíjate en el bucle») are fine.
 */
const CODE_LINES: readonly RegExp[] = [
  /^\s*(?:function|const|let|var|return|for|while|if|else|switch|class|do)\b[^.!?¿¡]*[({;=]/,
  /^\s*[\w$.[\]]+\s*(?:[+\-*/%]?=|\+\+|--)(?!=)/,
  /^\s*[{}][\s;)]*$/,
  /=>/,
  /;\s*$/,
];

/** The function an exercise asks for: its name and how many parameters it takes. */
export interface FunctionSignature {
  readonly functionName: string;
  /** Unknown without tests: then any number will do. */
  readonly parameters: number | undefined;
}

/** The signature of the function of an exercise, with as many parameters as its tests pass. */
export function signatureOf({
  functionName,
  tests,
}: {
  readonly functionName: string;
  readonly tests: readonly { readonly input: readonly unknown[] }[];
}): FunctionSignature {
  return { functionName, parameters: tests[0]?.input.length };
}

/** A fenced block, with or without its language: ```js … ```. */
const FENCED_BLOCK = /```[\w-]*\n?([\s\S]*?)```/g;

/** The empty function: `function name(a, b) {` and its closing brace, with nothing between. */
const EMPTY_FUNCTION = /^function\s+([\w$]+)\s*\(([^)]*)\)\s*\{\s*\}$/;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Whether the message carries code: a fenced block, or a line that looks like code (2.6). With the
 * signature of the exercise, a block with only its empty function is fine (2.5d): the skeleton is
 * for a student who does not know how to start, and its body is where the logic would go.
 */
export function containsCode(message: string, skeleton?: FunctionSignature): boolean {
  const words = skeleton
    ? message.replace(FENCED_BLOCK, (block, body: string) =>
        isEmptySkeleton(body, skeleton) ? '' : block,
      )
    : message;
  return words.includes('```') || words.split('\n').some((line) => looksLikeCode(line));
}

function looksLikeCode(line: string): boolean {
  return CODE_LINES.some((pattern) => pattern.test(line));
}

/** The function of the exercise with its name, plain parameters (no defaults) and an empty body. */
function isEmptySkeleton(block: string, { functionName, parameters }: FunctionSignature): boolean {
  const match = EMPTY_FUNCTION.exec(block.trim());
  if (match?.[1] !== functionName) return false;
  const names = match[2].trim() ? match[2].split(',').map((name) => name.trim()) : [];
  return (
    names.every((name) => IDENTIFIER.test(name)) &&
    (parameters === undefined || names.length === parameters)
  );
}

/** What an answer may have, which depends on the request. */
export interface AnswerRules {
  /** An intervention of the tutor may say nothing; anything else needs a message. */
  readonly mayKeepQuiet?: boolean;
  /** The function of the exercise: its empty skeleton is the only code allowed (2.5d). */
  readonly skeleton?: FunctionSignature;
  /** Whether the examples of syntax the model asks for are added: only to a question (2.5d). */
  readonly examples?: boolean;
}

/**
 * Checks what the model wrote: JSON with the shape of 2.6, a message unless the tutor chose to keep
 * quiet when it steps in on its own, and no code but the empty skeleton of the exercise's function,
 * when its signature is given (2.5d). When the model asks for the skeleton (`skeleton`, with the
 * names of its parameters), the server writes it under the message: the model does not have to get
 * a block of code right inside a JSON string, and nothing but the empty function can come out of it.
 * The same with the examples of syntax (`syntax`), taken from a fixed catalog, only for a question:
 * a hint is about the student's code, not about how something is written. A reaction outside the
 * catalog is dropped, not asked again (D-035). Models often wrap the JSON in a fenced block: it is
 * read from the outer braces.
 */
export function checkAnswer(
  raw: string,
  { mayKeepQuiet = false, skeleton, examples = false }: AnswerRules = {},
): AnswerCheck {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { ok: false, problem: 'invalid' };
  }
  const result = answerSchema.safeParse(parsed);
  if (!result.success) return { ok: false, problem: 'invalid' };
  const { message, emotion, intensity, reaction, elusion, skeleton: names, syntax } = result.data;
  const text = message.trim();
  if (!text && !mayKeepQuiet) return { ok: false, problem: 'invalid' };
  if (containsCode(text, skeleton)) return { ok: false, problem: 'code', elusion };
  // The skeleton the model asks for, which the server writes, if it did not write one itself (2.5d)
  const parameters =
    text && skeleton && names?.length && !text.includes('```')
      ? skeletonParameters(skeleton.parameters ?? names.length, names)
      : undefined;
  const blocks = text ? serverBlocks(skeleton, parameters, examples ? syntax : undefined) : [];
  return {
    ok: true,
    answer: {
      message: [text, ...blocks].join('\n'),
      emotion,
      intensity: intensity as Intensity,
      reaction: isReactionKind(reaction) ? reaction : undefined,
      elusion,
      ...withActions([
        ...(text ? actionsOf(result.data.actions) : []),
        // «Insertar» goes with the skeleton (2.5f)
        ...(parameters ? [{ name: 'insertSkeleton' as const, arguments: { parameters } }] : []),
      ]),
    },
  };
}

/**
 * The queries of the contract the model asked for, checked: the data of the student it needs before
 * answering (2.5e). Whatever it said meanwhile waits: it answers once it has the data. None if the
 * answer is not JSON or asks for none.
 */
export function queriesIn(raw: string): ToolCall[] {
  try {
    const parsed: unknown = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    const asked =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { query?: unknown }).query
        : undefined;
    return [...toolCallsOf(asked, 'query').calls];
  } catch {
    return [];
  }
}

/**
 * The actions of the contract the model took, checked. A note next to a line is words, never code:
 * a mark with code in its note is dropped, as the validator would turn down the message (2.6).
 */
function actionsOf(asked: unknown): ToolCall[] {
  const { calls, dropped } = toolCallsOf(asked, 'action');
  if (dropped.length > 0) console.warn(`Tool calls dropped: ${dropped.join(', ')}`);
  return calls.filter(
    (call) =>
      // The server adds those itself, never because the model asks (2.5f)
      !TUTOR_TOOLS.some((tool) => tool.name === call.name && tool.fromServer) &&
      (call.name !== 'highlightLines' ||
        !(call.arguments.lines as readonly { readonly note?: string }[]).some(
          (line) => line.note !== undefined && containsCode(line.note),
        )),
  );
}

/** Only an answer that does something says so: the rest keep the shape they had before 2.5e. */
function withActions(actions: readonly ToolCall[]): Pick<ModelAnswer, 'actions'> {
  return actions.length > 0 ? { actions } : {};
}

/**
 * The code the server writes under the message, never the model (2.5d): the empty skeleton, if asked
 * for and not written already (the validator let only that through), and the examples of syntax of
 * the catalog it asked for.
 */
function serverBlocks(
  skeleton: FunctionSignature | undefined,
  parameters: readonly string[] | undefined,
  syntax: readonly string[] | undefined,
): string[] {
  const blocks: string[] = [];
  if (skeleton && parameters) {
    blocks.push(skeletonBlock(skeleton.functionName, parameters.length, parameters));
  }
  const examples = syntaxBlocks(syntax ?? []);
  if (examples) blocks.push(examples);
  return blocks;
}

function isReactionKind(reaction: string | undefined): reaction is ReactionKind {
  return (REACTION_KINDS as readonly string[]).includes(reaction ?? '');
}
