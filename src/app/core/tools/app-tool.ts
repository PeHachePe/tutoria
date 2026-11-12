import {
  declareExperimentalWebMcpTool,
  DestroyRef,
  type EnvironmentProviders,
  ErrorHandler,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  Service,
  type WebMcpClient,
  type WebMcpToolDescriptor,
  type WebMcpToolExecute,
} from '@angular/core';

import {
  checkToolArguments,
  type ObjectSchema,
  type TutorToolDefinition,
} from '../../data/tutor/tutor-tools';

/**
 * A tool of the app (2.5e, D-051) in the format of Angular's WebMCP (`WebMcpToolDescriptor`) and
 * whether it is open to any agent of the browser. Our tutor runs every tool through the
 * `ToolRegistry`; only the open ones are registered with WebMCP. Its `execute` takes the arguments
 * its schema describes (`appTool` types them), so here they are `never`: every call goes through
 * `runTool`, which checks them first.
 */
export interface AppTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ObjectSchema;
  readonly annotations?: WebMcpToolDescriptor<ObjectSchema>['annotations'];
  readonly webMcp: boolean;
  readonly execute: (args: never, client: WebMcpClient) => unknown;
}

/** What running a tool gave: its result, or why it could not run. */
export type ToolRun =
  { readonly ok: true; readonly result: unknown } | { readonly ok: false; readonly error: string };

/** A failure the tool explains to whoever called it: the model, an agent or the student. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

/**
 * A tool of the contract (`tutor-tools.ts`) with what it does here. The arguments are typed from its
 * schema, and the annotations tell the agents which tools only read.
 */
export function appTool<const Definition extends TutorToolDefinition>(
  definition: Definition,
  execute: WebMcpToolExecute<Definition['inputSchema']>,
): AppTool {
  return {
    name: definition.name,
    description: definition.description,
    inputSchema: definition.inputSchema,
    annotations: { readOnlyHint: definition.use === 'query' },
    webMcp: definition.webMcp,
    execute,
  };
}

/**
 * Runs a tool with arguments that may be anything: neither Angular nor WebMCP check them against the
 * schema, so they are checked here first. A failure is an answer, never an exception.
 */
export async function runTool(
  tool: AppTool,
  args: unknown,
  signal: AbortSignal = new AbortController().signal,
): Promise<ToolRun> {
  const check = checkToolArguments(tool.inputSchema, args);
  if (!check.ok) return { ok: false, error: check.error };
  try {
    // The arguments were just checked against the schema the type is inferred from
    const execute = tool.execute as (args: unknown, client: WebMcpClient) => unknown;
    return { ok: true, result: await execute(check.value, { signal }) };
  } catch (error) {
    return { ok: false, error: error instanceof ToolError ? error.message : 'The tool failed' };
  }
}

/**
 * The tools the screens open now, by name: what our tutor can run. Each one leaves with the screen
 * that declared it (its route or its component), as WebMCP does with its own.
 */
@Service()
export class ToolRegistry {
  private readonly tools = new Map<string, AppTool>();

  register(tool: AppTool, destroyRef: DestroyRef): void {
    this.tools.set(tool.name, tool);
    destroyRef.onDestroy(() => {
      if (this.tools.get(tool.name) === tool) this.tools.delete(tool.name);
    });
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  run(name: string, args: unknown): Promise<ToolRun> {
    const tool = this.tools.get(name);
    return tool
      ? runTool(tool, args)
      : Promise.resolve({ ok: false, error: `The tool ${name} is not available here` });
  }
}

/**
 * Declares a tool in the current injection context, for as long as it lives: in the registry of our
 * tutor and, when it is open, with WebMCP (`declareExperimentalWebMcpTool`), which checks nothing,
 * so the agent's arguments go through `runTool` too. It gives the tool back, so a component can keep
 * it in a field.
 */
export function declareAppTool(tool: AppTool): AppTool {
  inject(ToolRegistry).register(tool, inject(DestroyRef));
  if (!tool.webMcp) return tool;
  const errors = inject(ErrorHandler);
  const { name, description, inputSchema, annotations } = tool;
  declareExperimentalWebMcpTool({
    name,
    description,
    inputSchema,
    ...(annotations ? { annotations } : {}),
    execute: async (args, client) => {
      const run = await runTool(tool, args, client.signal);
      return run.ok ? run.result : { error: run.error };
    },
  }).catch((error: unknown) => errors.handleError(error));
  return tool;
}

/** The tools of a route, declared when it opens and removed when it closes (4.5). */
export function provideAppTools(tools: () => readonly AppTool[]): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      for (const tool of tools()) declareAppTool(tool);
    }),
  ]);
}
