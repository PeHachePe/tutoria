import { computed, DestroyRef, inject, resource, Service, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, type ParamMap } from '@angular/router';

import { TEACHER_ALL_BLOCKS, TEACHER_PARAMS } from '../../core/app-paths';
import { type LiveGroup, LiveService, type LiveUpdate } from '../../data/live-service';
import { activityByMinute } from './activity-by-minute';
import { defaultBlock } from './default-block';
import { type AttentionReason, ATTENTION_ORDER } from './live-attention';
import { liveFeed } from './live-feed';
import { liveFigures } from './live-figures';
import { exerciseOverview } from './live-overview';
import { liveRow, type LiveRow } from './live-row';
import { applyLiveUpdate, liveState, type LiveState, type StudentActivity } from './live-state';
import { rhythmReading } from './rhythm-reading';

/** How often the clock of the panel moves: the same as the check of the proactive tutor (2.7). */
export const LIVE_CLOCK_MS = 15_000;

/** A row of the queue: always with the reason that brought the student there. */
export type QueuedRow = LiveRow & { readonly reason: AttentionReason };

/** What the panel shows: `blockId` null is the whole class. */
export interface LiveSelection {
  readonly group: LiveGroup;
  readonly blockId: string | null;
}

/** What the URL asks for: `blockId` undefined when it names no block and the store picks one. */
export interface LiveRequest {
  readonly group: LiveGroup;
  readonly blockId: string | null | undefined;
}

/** What the store loads: the state of the group and the block it shows, picked or asked for. */
interface LoadedState {
  readonly state: LiveState;
  readonly blockId: string | null;
}

/** A group nobody has loaded yet: no exercises and no students. */
const EMPTY_STATE: LiveState = { exercises: [], students: new Map() };

/**
 * Live state of a group (RF-11, D-068), shared by the panel and the attempt detail (4.2): provided
 * in the parent route `en-vivo`. It reads the group and the block of the URL, loads their snapshot
 * with `resource()` and applies each live change without mutating it (4.5). The changes that arrive
 * while the snapshot loads are kept and applied after it, so none is lost.
 *
 * The queue and the rows are always of the whole group; the block only decides what «Dónde está la
 * clase» shows. Without a block in the URL, the store picks one when it opens (`defaultBlock()`)
 * and keeps it in the value of its resource, not in the URL: no navigation inside the store, and a
 * single source of truth.
 */
@Service({ autoProvided: false })
export class LiveStore {
  private readonly live = inject(LiveService);
  private readonly nowState = signal(Date.now());
  /** When the teacher marked each student as attended; a newer reason brings them back. */
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

  /** The group and the block of the URL or, without a group, the first one. */
  private readonly request = computed<LiveRequest | undefined>(
    () => pickSelection(this.groups(), this.query()),
    { equal: (a, b) => a?.group.id === b?.group.id && a?.blockId === b?.blockId },
  );

  /** The group followed, as soon as the groups load. */
  readonly group = computed(() => this.request()?.group);
  /** Its blocks in order, hidden ones included. */
  readonly blocks = computed(() => this.group()?.blocks ?? []);

  private readonly stateResource = resource({
    params: () => this.request(),
    loader: async ({ params: { group, blockId } }): Promise<LoadedState> => {
      this.stopWatching();
      const generation = ++this.generation;
      let pending: LiveUpdate[] | null = [];
      this.stopWatching = this.live.watch(group.id, (update) => {
        if (generation !== this.generation) return;
        if (pending) {
          pending.push(update);
        } else {
          this.nowState.set(Date.now());
          this.stateResource.update((loaded) => loaded && withUpdate(loaded, update));
        }
      });
      let snapshot = await this.live.snapshot(group.id, blockId ?? null);
      let shown = blockId ?? null;
      if (blockId === undefined) {
        // Who works now and where decide the block: a second read only when one is picked
        shown = defaultBlock(rowsOf(liveState(snapshot), Date.now()), group);
        if (shown !== null) {
          snapshot = await this.live.snapshot(group.id, shown);
        }
      }
      const state = pending.reduce(applyLiveUpdate, liveState(snapshot));
      // The resource takes the value in this same task: later changes come in other tasks
      pending = null;
      return { state, blockId: shown };
    },
  });

  /** The state, or undefined while it loads or after it failed: reading a failed value throws. */
  private readonly state = computed(() =>
    this.stateResource.hasValue() ? this.stateResource.value().state : undefined,
  );

  /**
   * The group and the block shown: the block of the URL or, without it, the one picked, undefined
   * while it is being picked.
   */
  readonly selection = computed<LiveSelection | undefined>(
    () => {
      const request = this.request();
      if (!request) return undefined;
      if (request.blockId !== undefined) {
        return { group: request.group, blockId: request.blockId };
      }
      return this.stateResource.hasValue()
        ? { group: request.group, blockId: this.stateResource.value().blockId }
        : undefined;
    },
    { equal: (a, b) => a?.group.id === b?.group.id && a?.blockId === b?.blockId },
  );

  /** Every exercise of the group, by block and position. */
  readonly exercises = computed(() => this.state()?.exercises ?? []);

  /** The exercises of the block shown; all of them with the whole class. */
  readonly blockExercises = computed(() => {
    const blockId = this.selection()?.blockId ?? null;
    return blockId === null
      ? this.exercises()
      : this.exercises().filter((exercise) => exercise.blockId === blockId);
  });

  /** Groups or snapshot loading, for the skeletons. */
  readonly isLoading = computed(
    () => this.groupsResource.isLoading() || this.stateResource.isLoading(),
  );
  readonly error = computed(() => this.groupsResource.error() ?? this.stateResource.error());
  /** The groups loaded and there are none: an empty state rather than a table. */
  readonly hasNoGroups = computed(
    () => this.groupsResource.status() === 'resolved' && this.groups().length === 0,
  );

  /** A row per student of the group, in the order of the snapshot (by name). */
  readonly rows = computed<LiveRow[]>(() => rowsOf(this.state() ?? EMPTY_STATE, this.nowState()));

  /**
   * Who to help now (D-068): the students with a reason the teacher has not attended since it
   * appeared, by `ATTENTION_ORDER` and then as a queue of raised hands.
   */
  readonly queue = computed(() => {
    const attended = this.attendedState();
    return this.rows()
      .flatMap((row): QueuedRow[] => {
        const { reason } = row;
        return reason && reason.since > (attended.get(row.student.id) ?? 0)
          ? [{ ...row, reason }]
          : [];
      })
      .sort(
        (a, b) =>
          ATTENTION_ORDER.indexOf(a.reason.kind) - ATTENTION_ORDER.indexOf(b.reason.kind) ||
          a.reason.since - b.reason.since,
      );
  });

  /** The figures of the header, which are also the filters of the table. */
  readonly figures = computed(() =>
    liveFigures(
      this.state() ?? EMPTY_STATE,
      this.rows(),
      this.selection()?.blockId ?? null,
      this.queue().length,
      this.nowState(),
    ),
  );

  /** «Dónde está la clase»: the block, or the exercises in progress of the whole class. */
  readonly overview = computed(() =>
    exerciseOverview(
      this.state() ?? EMPTY_STATE,
      this.rows(),
      this.selection()?.blockId ?? null,
      this.nowState(),
    ),
  );

  /** What just happened in the group, the latest first (4.1b); it goes in the 4.1e. */
  readonly feed = computed(() => {
    const state = this.state();
    return state ? liveFeed(state, this.nowState()) : [];
  });

  /** Runs and hints of the class in the last minutes, for the chart (4.1b). */
  readonly activity = computed(() => {
    const state = this.state();
    return state ? activityByMinute(state, this.nowState()) : [];
  });

  /** The sentence that reads the rhythm of the class, or null without activity. */
  readonly rhythm = computed(() => rhythmReading(this.activity()));

  /**
   * What the group knows of an attempt, live: the activity of its student (their attempts, events
   * and tutor interactions), or undefined if the attempt is not in the snapshot.
   */
  activityOf(attemptId: string): StudentActivity | undefined {
    const state = this.state();
    return state
      ? [...state.students.values()].find(({ attempts }) =>
          attempts.some((a) => a.id === attemptId),
        )
      : undefined;
  }

  /** The row of the queue that leads to this attempt, if its student waits for the teacher. */
  queuedFor(attemptId: string): QueuedRow | undefined {
    return this.queue().find((row) => row.attempt?.id === attemptId);
  }

  constructor() {
    const clock = setInterval(() => this.nowState.set(Date.now()), LIVE_CLOCK_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(clock);
      this.stopWatching();
    });
  }

  /** The teacher went to the student: out of the queue until a new reason appears. */
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

/**
 * What the URL asks for, or undefined without groups: its group (the first one if it names none
 * or an unknown one) and its block. `todos`, or a group without blocks, is the whole class (null);
 * a block of the group, that one; anything else, undefined: the store picks.
 */
export function pickSelection(
  groups: readonly LiveGroup[],
  query: ParamMap | undefined,
): LiveRequest | undefined {
  const groupId = query?.get(TEACHER_PARAMS.group);
  const group = groups.find((candidate) => candidate.id === groupId) ?? groups[0];
  if (!group) return undefined;
  const blockId = query?.get(TEACHER_PARAMS.block);
  if (blockId === TEACHER_ALL_BLOCKS || group.blocks.length === 0) {
    return { group, blockId: null };
  }
  const block = group.blocks.find((candidate) => candidate.id === blockId);
  return { group, blockId: block?.id };
}

/** A row per student of a state, at `now`. */
function rowsOf(state: LiveState, now: number): LiveRow[] {
  return [...state.students.values()].map((activity) => liveRow(activity, state.exercises, now));
}

/** The loaded state after a live change: the very same if the change concerns nothing of it. */
function withUpdate(loaded: LoadedState, update: LiveUpdate): LoadedState {
  const state = applyLiveUpdate(loaded.state, update);
  return state === loaded.state ? loaded : { ...loaded, state };
}
