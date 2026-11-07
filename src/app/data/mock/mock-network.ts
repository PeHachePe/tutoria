import { Service, signal } from '@angular/core';

import { DataError, DataErrorKind } from '../data-error';

/** Wait before each simulated answer, in milliseconds. */
export interface LatencyRange {
  readonly min: number;
  readonly max: number;
}

export const DEFAULT_LATENCY: LatencyRange = { min: 200, max: 600 };

export const MOCK_NETWORK_STORAGE_KEY = 'tutoria.mock-latency';

/**
 * The simulated network every mock service goes through (4.3): a random latency, saved in localStorage
 * so it survives a reload, and a switch that fails the next request to design the error states.
 */
@Service()
export class MockNetwork {
  private readonly latencyState = signal(readSavedLatency());
  private readonly failNextState = signal<DataErrorKind | null>(null);

  readonly latency = this.latencyState.asReadonly();
  /** Kind of error the next request will throw, or null. */
  readonly failNext = this.failNextState.asReadonly();

  setLatency(range: LatencyRange): void {
    const { min, max } = range;
    if (!isLatencyRange(range)) {
      throw new RangeError(`Invalid latency: ${min}-${max} ms`);
    }
    this.latencyState.set(range);
    try {
      localStorage.setItem(MOCK_NETWORK_STORAGE_KEY, JSON.stringify(range));
    } catch {
      // Storage unavailable: the latency still applies until the page is closed.
    }
  }

  failNextRequest(kind: DataErrorKind | null): void {
    this.failNextState.set(kind);
  }

  /** Waits for the latency and then runs `operation`, or throws the pending failure without running it. */
  async request<T>(operation: () => T): Promise<T> {
    const failure = this.failNextState();
    this.failNextState.set(null);
    await wait(this.latencyState());
    if (failure) {
      throw new DataError(failure, `Simulated failure: ${failure}`);
    }
    return operation();
  }
}

function wait({ min, max }: LatencyRange): Promise<void> {
  const ms = Math.round(min + Math.random() * (max - min));
  if (ms === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readSavedLatency(): LatencyRange {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(MOCK_NETWORK_STORAGE_KEY) ?? 'null');
    return isLatencyRange(saved) ? saved : DEFAULT_LATENCY;
  } catch {
    return DEFAULT_LATENCY;
  }
}

function isLatencyRange(value: unknown): value is LatencyRange {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { min, max } = value as Record<string, unknown>;
  return typeof min === 'number' && typeof max === 'number' && min >= 0 && min <= max;
}
