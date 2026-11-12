import {
  createEnvironmentInjector,
  EnvironmentInjector,
  ErrorHandler,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TUTOR_TOOL } from '../../data/tutor/tutor-tools';
import {
  type AppTool,
  appTool,
  declareAppTool,
  provideAppTools,
  runTool,
  ToolError,
  ToolRegistry,
} from './app-tool';

interface RegisteredTool {
  name: string;
  annotations?: object;
  execute: (args: unknown, client: { signal: AbortSignal }) => Promise<unknown>;
}

/** A WebMCP of the browser for the tests: what is registered, and removed when its signal aborts. */
function fakeModelContext() {
  const tools = new Map<string, RegisteredTool>();
  const registerTool = vi.fn((tool: RegisteredTool, { signal }: { signal: AbortSignal }) => {
    if (tools.has(tool.name)) return Promise.reject(new Error(`${tool.name} already registered`));
    tools.set(tool.name, tool);
    signal.addEventListener('abort', () => tools.delete(tool.name));
    return Promise.resolve();
  });
  Object.defineProperty(document, 'modelContext', {
    value: { registerTool },
    configurable: true,
  });
  return { tools, registerTool };
}

const settled = () => new Promise((resolve) => setTimeout(resolve));

const settings = (execute = vi.fn((): unknown => 'Listo')) =>
  appTool(TUTOR_TOOL.updateSettings, execute);

describe('appTool', () => {
  it('describes a tool of the contract with what it does here', () => {
    const execute = vi.fn();
    const tool = appTool(TUTOR_TOOL.getSettings, execute);
    expect(tool).toEqual({
      name: 'getSettings',
      description: TUTOR_TOOL.getSettings.description,
      inputSchema: TUTOR_TOOL.getSettings.inputSchema,
      annotations: { readOnlyHint: true },
      webMcp: true,
      execute,
    });
    expect(settings().annotations).toEqual({ readOnlyHint: false });
  });
});

describe('runTool', () => {
  it('runs the tool with arguments that fit its schema', async () => {
    const execute = vi.fn((): unknown => Promise.resolve('Listo: modo oscuro'));
    expect(await runTool(settings(execute), { theme: 'dark' })).toEqual({
      ok: true,
      result: 'Listo: modo oscuro',
    });
    expect(execute).toHaveBeenCalledWith({ theme: 'dark' }, { signal: expect.any(AbortSignal) });
  });

  it('says why without running it when the arguments do not fit', async () => {
    const execute = vi.fn();
    expect(await runTool(settings(execute), { theme: 'pink' })).toEqual({
      ok: false,
      error: 'arguments.theme: one of light, dark, system',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('turns a failure into an answer: its own words, or a generic one', async () => {
    const explained = settings(
      vi.fn((): unknown => {
        throw new ToolError('No such exercise');
      }),
    );
    expect(await runTool(explained, { theme: 'dark' })).toEqual({
      ok: false,
      error: 'No such exercise',
    });
    const broken = settings(vi.fn((): unknown => Promise.reject(new Error('secret detail'))));
    expect(await runTool(broken, { theme: 'dark' })).toEqual({
      ok: false,
      error: 'The tool failed',
    });
  });
});

describe('declareAppTool', () => {
  let injector: EnvironmentInjector;

  beforeEach(() => {
    injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
  });

  afterEach(() => {
    Reflect.deleteProperty(document, 'modelContext');
  });

  it('opens the tool to our tutor while its injector lives', async () => {
    const registry = TestBed.inject(ToolRegistry);
    runInInjectionContext(injector, () => declareAppTool(settings()));

    expect(registry.has('updateSettings')).toBe(true);
    expect(await registry.run('updateSettings', { theme: 'dark' })).toEqual({
      ok: true,
      result: 'Listo',
    });

    injector.destroy();
    expect(registry.has('updateSettings')).toBe(false);
    expect(await registry.run('updateSettings', { theme: 'dark' })).toEqual({
      ok: false,
      error: 'The tool updateSettings is not available here',
    });
  });

  it('keeps the tool a newer screen declared with the same name', () => {
    const registry = TestBed.inject(ToolRegistry);
    const newer = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    runInInjectionContext(injector, () => declareAppTool(settings()));
    runInInjectionContext(newer, () => declareAppTool(settings()));

    injector.destroy();
    expect(registry.has('updateSettings')).toBe(true);
  });

  it('registers the open tools with WebMCP, checking the arguments of the agents', async () => {
    const { tools } = fakeModelContext();
    runInInjectionContext(injector, () => declareAppTool(settings()));
    await settled();

    const registered = tools.get('updateSettings')!;
    expect(registered.annotations).toEqual({ readOnlyHint: false });
    const client = { signal: new AbortController().signal };
    expect(await registered.execute({ theme: 'dark' }, client)).toBe('Listo');
    expect(await registered.execute({ theme: 'pink' }, client)).toEqual({
      error: 'arguments.theme: one of light, dark, system',
    });

    injector.destroy();
    expect(tools.has('updateSettings')).toBe(false);
  });

  it('registers a tool without annotations as it is', async () => {
    const { tools } = fakeModelContext();
    runInInjectionContext(injector, () =>
      declareAppTool({ ...settings(), annotations: undefined }),
    );
    await settled();

    expect(tools.get('updateSettings')).not.toHaveProperty('annotations');
  });

  it('never registers with WebMCP what only our tutor may use', async () => {
    const { registerTool } = fakeModelContext();
    const internal: AppTool = { ...settings(), annotations: undefined, webMcp: false };
    runInInjectionContext(injector, () => declareAppTool(internal));
    await settled();

    expect(registerTool).not.toHaveBeenCalled();
    expect(TestBed.inject(ToolRegistry).has('updateSettings')).toBe(true);
  });

  it('reports a tool WebMCP turned down, such as a repeated name', async () => {
    fakeModelContext();
    const handleError = vi.fn();
    const withErrors = createEnvironmentInjector(
      [{ provide: ErrorHandler, useValue: { handleError } }],
      injector,
    );
    runInInjectionContext(injector, () => declareAppTool(settings()));
    runInInjectionContext(withErrors, () => declareAppTool(settings()));
    await settled();

    expect(handleError).toHaveBeenCalledWith(new Error('updateSettings already registered'));
  });
});

describe('provideAppTools', () => {
  it('declares the tools of a route when it opens and removes them when it closes', () => {
    const route = createEnvironmentInjector(
      [provideAppTools(() => [settings()])],
      TestBed.inject(EnvironmentInjector),
    );
    const registry = TestBed.inject(ToolRegistry);
    expect(registry.has('updateSettings')).toBe(true);

    route.destroy();
    expect(registry.has('updateSettings')).toBe(false);
  });
});
