import { TestBed } from '@angular/core/testing';

import { DataError } from '../data-error';
import { DEFAULT_LATENCY, MOCK_NETWORK_STORAGE_KEY, MockNetwork } from './mock-network';

describe('MockNetwork', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function create(): MockNetwork {
    return TestBed.inject(MockNetwork);
  }

  it('starts with the default latency of 200 to 600 ms', () => {
    expect(DEFAULT_LATENCY).toEqual({ min: 200, max: 600 });
    expect(create().latency()).toEqual(DEFAULT_LATENCY);
  });

  it('restores a saved latency', () => {
    localStorage.setItem(MOCK_NETWORK_STORAGE_KEY, JSON.stringify({ min: 0, max: 0 }));

    expect(create().latency()).toEqual({ min: 0, max: 0 });
  });

  it.each([
    ['not JSON', '{'],
    ['not an object', '3'],
    ['null', 'null'],
    ['negative', JSON.stringify({ min: -1, max: 5 })],
    ['reversed', JSON.stringify({ min: 9, max: 5 })],
    ['not numbers', JSON.stringify({ min: '1', max: 5 })],
  ])('ignores a saved latency that is %s', (_case, saved) => {
    localStorage.setItem(MOCK_NETWORK_STORAGE_KEY, saved);

    expect(create().latency()).toEqual(DEFAULT_LATENCY);
  });

  it('falls back to the default latency when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(create().latency()).toEqual(DEFAULT_LATENCY);
  });

  it('saves a new latency', () => {
    const network = create();

    network.setLatency({ min: 1000, max: 3000 });

    expect(network.latency()).toEqual({ min: 1000, max: 3000 });
    expect(JSON.parse(localStorage.getItem(MOCK_NETWORK_STORAGE_KEY) ?? '')).toEqual({
      min: 1000,
      max: 3000,
    });
  });

  it('keeps a new latency for the session when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    const network = create();

    network.setLatency({ min: 0, max: 0 });

    expect(network.latency()).toEqual({ min: 0, max: 0 });
  });

  it('rejects an invalid latency', () => {
    const network = create();

    expect(() => network.setLatency({ min: 10, max: 5 })).toThrow(RangeError);
    expect(() => network.setLatency({ min: -1, max: 5 })).toThrow(RangeError);
    expect(network.latency()).toEqual(DEFAULT_LATENCY);
  });

  it('answers after a random wait inside the latency range', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const network = create();
    let answered = false;

    const answer = network
      .request(() => 'ok')
      .then((value) => {
        answered = true;
        return value;
      });
    await vi.advanceTimersByTimeAsync(399);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(answer).resolves.toBe('ok');
  });

  it('answers without a timer when the latency is zero', async () => {
    const network = create();
    network.setLatency({ min: 0, max: 0 });
    const timeout = vi.spyOn(globalThis, 'setTimeout');

    await expect(network.request(() => 42)).resolves.toBe(42);
    expect(timeout).not.toHaveBeenCalled();
  });

  it('turns an error of the operation into a rejection', async () => {
    const network = create();
    network.setLatency({ min: 0, max: 0 });

    await expect(
      network.request(() => {
        throw new DataError('not_found');
      }),
    ).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('fails only the next request, with the chosen kind, without running it', async () => {
    const network = create();
    network.setLatency({ min: 0, max: 0 });
    const operation = vi.fn(() => 'ok');

    network.failNextRequest('rate_limited');
    expect(network.failNext()).toBe('rate_limited');

    await expect(network.request(operation)).rejects.toEqual(
      new DataError('rate_limited', 'Simulated failure: rate_limited'),
    );
    expect(operation).not.toHaveBeenCalled();
    expect(network.failNext()).toBeNull();
    await expect(network.request(operation)).resolves.toBe('ok');
  });

  it('cancels a pending failure', async () => {
    const network = create();
    network.setLatency({ min: 0, max: 0 });

    network.failNextRequest('network');
    network.failNextRequest(null);

    await expect(network.request(() => 'ok')).resolves.toBe('ok');
  });
});
