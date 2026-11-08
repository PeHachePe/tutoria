import type { RunMessage } from './run-protocol';

describe('code runner worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs the request it receives and posts each message back', async () => {
    const posted: RunMessage[] = [];
    vi.stubGlobal('postMessage', (message: RunMessage) => posted.push(message));
    await import('./code-runner.worker');

    dispatchEvent(
      new MessageEvent('message', {
        data: { code: 'function doble(n) { return n * 2; }', functionName: 'doble', inputs: [[4]] },
      }),
    );

    expect(posted).toEqual([
      { type: 'started' },
      { type: 'result', index: 0, outcome: { ok: true, value: 8 } },
      { type: 'done' },
    ]);
  });
});
