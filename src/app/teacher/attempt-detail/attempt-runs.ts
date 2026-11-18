import type { ProcessEvent } from '../../data/process-event';
import type { HintLevel } from '../../data/tutor';

/** What the evolution draws, in the order it happened. */
export type EvolutionItem =
  | {
      readonly kind: 'run';
      /** The id of its event. */
      readonly id: string;
      readonly at: number;
      readonly passed: number;
      readonly total: number;
    }
  | { readonly kind: 'hint'; readonly id: string; readonly at: number; readonly level: HintLevel }
  | { readonly kind: 'paste'; readonly id: string; readonly at: number; readonly length: number };

export interface AttemptRuns {
  /** Empty without runs: the chart does not show. */
  readonly items: readonly EvolutionItem[];
  readonly runs: number;
  readonly hints: number;
  readonly pastes: number;
}

const NO_RUNS: AttemptRuns = { items: [], runs: 0, hints: 0, pastes: 0 };

/** The runs of an attempt, with its hints and pastes between them: the evolution of ficha 07. */
export function attemptRuns(events: readonly ProcessEvent[]): AttemptRuns {
  const items = events
    .flatMap((event): EvolutionItem[] => {
      const at = Date.parse(event.timestamp);
      switch (event.type) {
        case 'run':
          return [
            {
              kind: 'run',
              id: event.id,
              at,
              passed: event.detail.passed,
              total: event.detail.passed + event.detail.failed,
            },
          ];
        case 'hint_requested':
          return [{ kind: 'hint', id: event.id, at, level: event.detail.level }];
        case 'paste':
          return [{ kind: 'paste', id: event.id, at, length: event.detail.length }];
        default:
          return [];
      }
    })
    // Stable: what happened at the same time keeps its order
    .sort((a, b) => a.at - b.at);
  const count = (kind: EvolutionItem['kind']) => items.filter((item) => item.kind === kind).length;
  const runs = count('run');
  return runs === 0 ? NO_RUNS : { items, runs, hints: count('hint'), pastes: count('paste') };
}
