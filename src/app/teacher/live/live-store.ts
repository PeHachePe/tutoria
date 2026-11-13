import { computed, DestroyRef, inject, resource, Service, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, type ParamMap } from '@angular/router';

import { TEACHER_PARAMS } from '../../core/app-paths';
import { type LiveGroup, LiveService, type LiveUpdate } from '../../data/live-service';
import { exerciseOverview } from './live-overview';
import { liveRow, type LiveRow, type LiveSignal } from './live-row';
import { applyLiveUpdate, liveState } from './live-state';

/**
 * Order of the queue: whoever struggles with the code before whoever is idle or away, who may
 * not even be there (D-054). Within a tier, whoever has waited longest.
 */
const QUEUE_TIERS: Record<LiveSignal['kind'], number> = {
  hints_exhausted: 0,
  stuck_failures: 0,
  hint_rush: 1,
  stuck_idle: 2,
  away: 3,
};

/** How often the clock of the panel moves: the same as the check of the proactive tutor (2.7). */
export const LIVE_CLOCK_MS = 15_000;

/** The group and the block the panel follows. */
export interface LiveSelection {
  readonly group: LiveGroup;
  readonly blockId: string;
}

/** How the class goes now; the cards say who needs help. */
export interface LiveSummary {
  /** Students who did something in the session window. */
  readonly inSession: number;
  /** Students with every exercise of the block submitted. */
  readonly finished: number;
}

/**
 * Live state of a block of a group (RF-11), shared by the panel and the attempt detail (4.2):
 * provided in the parent route `en-vivo`. It reads the group and the block from the URL, loads
 * their snapshot with `resource()` and applies each live change without mutating it (4.5). The
 * changes that arrive while the snapshot loads are kept and applied after it, so none is lost.
 */
@Service({ autoProvided: false })
export class LiveStore {
  private readonly live = inject(LiveService);
  private readonly nowState = signal(Date.now());
  /** When the teacher marked each student as attended; a newer signal brings them back. */
  private readonly attendedState = signal<ReadonlyMap<string, number>>(new Map());
  private stopWatching: () => void = () => undefined;
  /** Each load of a snapshot; a change for an older one is ignored. */
  private generation = 0;

  /** The query parameters, from the root route: the store lives outside the components. */
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);

  private readonly groupsResource = resource({
    loader: () => this.live.listGroups(),
    defaultValue: [],
  });

  readonly groups = this.groupsResource.value.asReadonly();
  readonly now = this.nowState.asReadonly();

  /** The group and block of the URL or, without them, the first group and its latest block. */
  readonly selection = computed<LiveSelection | undefined>(
    () => pickSelection(this.groups(), this.query()),
    { equal: (a, b) => a?.group.id === b?.group.id && a?.blockId === b?.blockId },
  );

  private readonly stateResource = resource({
    params: () => this.selection(),
    loader: async ({ params: { group, blockId } }) => {
      this.stopWatching();
      const generation = ++this.generation;
      let pending: LiveUpdate[] | null = [];
      this.stopWatching = this.live.watch(group.id, (update) => {
        if (generation !== this.generation) return;
        if (pending) {
          pending.push(update);
        } else {
          this.nowState.set(Date.now());
          this.stateResource.update((state) => state && applyLiveUpdate(state, update));
        }
      });
      const snapshot = await this.live.snapshot(group.id, blockId);
      const state = pending.reduce(applyLiveUpdate, liveState(snapshot));
      // The resource takes the value in this same task: later changes come in other tasks
      pending = null;
      return state;
    },
  });

  /** The state, or undefined while it loads or after it failed: reading a failed value throws. */
  private readonly state = computed(() =>
    this.stateResource.hasValue() ? this.stateResource.value() : undefined,
  );

  readonly exercises = computed(() => this.state()?.exercises ?? []);

  /** Groups or snapshot loading, for the skeletons. */
  readonly isLoading = computed(
    () => this.groupsResource.isLoading() || this.stateResource.isLoading(),
  );
  readonly error = computed(() => this.groupsResource.error() ?? this.stateResource.error());
  /** The groups loaded and there are none: an empty state rather than a table. */
  readonly hasNoGroups = computed(
    () => this.groupsResource.status() === 'resolved' && this.groups().length === 0,
  );

  /** A row per student, in the order of the snapshot (by name). */
  readonly rows = computed<LiveRow[]>(() => {
    const state = this.state();
    if (!state) return [];
    const now = this.nowState();
    const build = (classActive: boolean) =>
      [...state.students.values()].map((activity) =>
        liveRow(activity, state.exercises, now, classActive),
      );
    const quiet = build(false);
    return quiet.some((row) => row.active) ? build(true) : quiet;
  });

  readonly summary = computed<LiveSummary>(() => {
    const rows = this.rows();
    const exerciseCount = this.exercises().length;
    return {
      inSession: rows.filter((row) => row.active).length,
      finished: rows.filter((row) => exerciseCount > 0 && row.submitted === exerciseCount).length,
    };
  });

  /**
   * Who to help now (D-054): the students with a signal the teacher has not attended since it
   * appeared, by `QUEUE_TIERS` and then as a queue of raised hands.
   */
  readonly queue = computed(() => {
    const attended = this.attendedState();
    return this.rows()
      .flatMap((row) => {
        const { signal } = row;
        return signal && signal.since > (attended.get(row.student.id) ?? 0)
          ? [{ row, signal }]
          : [];
      })
      .sort(
        (a, b) =>
          QUEUE_TIERS[a.signal.kind] - QUEUE_TIERS[b.signal.kind] ||
          a.signal.since - b.signal.since,
      )
      .map(({ row }) => row);
  });

  /** The class exercise by exercise, with the test that fails most. */
  readonly overview = computed(() => {
    const state = this.state();
    return state ? exerciseOverview(state) : [];
  });

  constructor() {
    const clock = setInterval(() => this.nowState.set(Date.now()), LIVE_CLOCK_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(clock);
      this.stopWatching();
    });
  }

  /** The teacher went to the student: out of the queue until a new signal appears. */
  attend(studentId: string): void {
    this.attendedState.update((attended) => new Map(attended).set(studentId, Date.now()));
  }

  /** Loads again what failed: the groups or the snapshot. */
  reload(): void {
    if (this.groupsResource.error()) {
      this.groupsResource.reload();
    } else {
      this.stateResource.reload();
    }
  }
}

/** The selection of the URL, if it exists; otherwise the first group and its latest block. */
export function pickSelection(
  groups: readonly LiveGroup[],
  query: ParamMap | undefined,
): LiveSelection | undefined {
  const groupId = query?.get(TEACHER_PARAMS.group);
  const group = groups.find((candidate) => candidate.id === groupId) ?? groups[0];
  if (!group) return undefined;
  const blockId = query?.get(TEACHER_PARAMS.block);
  const block =
    group.blocks.find((candidate) => candidate.id === blockId) ??
    group.blocks.find((candidate) => candidate.id === group.latestBlockId) ??
    group.blocks[0];
  return block ? { group, blockId: block.id } : undefined;
}
