import { DestroyRef, inject, InjectionToken, Service, signal } from '@angular/core';

/** What the tabs of this browser tell each other: this tab now edits the attempt. */
interface ClaimMessage {
  readonly attemptId: string;
  readonly tabId: string;
}

/** The channel between the tabs of this browser, replaced in the tests. */
export const EDITING_TAB_CHANNEL = new InjectionToken<BroadcastChannel>('EDITING_TAB_CHANNEL', {
  factory: () => new BroadcastChannel('tutoria.editing-tab'),
});

/**
 * Only one tab edits an attempt at a time (D-041). The autosave of two tabs would overwrite each
 * other and the last one would win, losing code without warning; so the tab that opens an attempt
 * takes it, and any other tab with it open stops editing until the student continues there.
 * Provided by the workspace route with AttemptStore.
 */
@Service({ autoProvided: false })
export class EditingTab {
  private readonly channel = inject(EDITING_TAB_CHANNEL);
  private readonly tabId = crypto.randomUUID();
  private attemptId: string | undefined;
  private onTaken: (() => void) | undefined;

  private readonly elsewhereState = signal(false);

  /** Another tab took the attempt open here. */
  readonly elsewhere = this.elsewhereState.asReadonly();

  constructor() {
    const onMessage = ({ data }: MessageEvent<ClaimMessage>) => {
      if (data.attemptId === this.attemptId && data.tabId !== this.tabId) {
        this.elsewhereState.set(true);
        this.onTaken?.();
      }
    };
    this.channel.addEventListener('message', onMessage);
    inject(DestroyRef).onDestroy(() => {
      this.channel.removeEventListener('message', onMessage);
      this.channel.close();
    });
  }

  /**
   * This tab edits the attempt from now on: the others with it open stop. `onTaken` runs when
   * another tab takes it, for instance to save what this one still had.
   */
  claim(attemptId: string, onTaken?: () => void): void {
    this.attemptId = attemptId;
    this.onTaken = onTaken;
    this.elsewhereState.set(false);
    this.channel.postMessage({ attemptId, tabId: this.tabId } satisfies ClaimMessage);
  }
}
