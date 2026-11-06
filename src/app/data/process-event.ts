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
  | ProcessEventBase<'focus_lost' | 'focus_gained', null>;

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

/** A client event before it is stored: the database assigns its id. */
export type NewProcessEvent = Omit<ClientProcessEvent, 'id'>;
