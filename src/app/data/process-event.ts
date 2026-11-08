import type { HintLevel } from './tutor';

interface ProcessEventBase<Type extends string, Detail> {
  readonly id: string;
  readonly attemptId: string;
  readonly type: Type;
  readonly timestamp: string;
  readonly detail: Detail;
}

/** Table `process_event`: what the student did, read with a formative purpose (2.8). */
export type ProcessEvent =
  | ProcessEventBase<'run', RunDetail>
  | ProcessEventBase<'submit', null>
  | ProcessEventBase<'hint_requested', { readonly level: HintLevel }>
  | ProcessEventBase<'proactive_intervention', { readonly silent: boolean }>
  | ProcessEventBase<'paste', { readonly length: number }>
  | ProcessEventBase<'focus_lost', null>
  /** `awayMs`: how long the student was out of the window, since its `focus_lost`. */
  | ProcessEventBase<'focus_gained', { readonly awayMs: number }>;

export type ProcessEventType = ProcessEvent['type'];

export interface RunDetail {
  readonly passed: number;
  readonly failed: number;
  /** Tests that failed, timed out or threw an error. */
  readonly failedTestIds: readonly string[];
}

/** The only events the browser records: the server records the rest (2.8). */
export type ClientProcessEvent = Extract<
  ProcessEvent,
  { type: 'paste' | 'focus_lost' | 'focus_gained' }
>;

/** Omit applied to each member of a union, so every `type` keeps its own `detail`. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A client event before it is stored: the database assigns its id. */
export type NewProcessEvent = DistributiveOmit<ClientProcessEvent, 'id'>;
