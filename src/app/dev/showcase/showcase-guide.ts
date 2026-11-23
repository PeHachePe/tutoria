import { Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';

import { GUIDE_ANCHORS, GuideAnchor } from '../../core/guide/guide-anchor';
import { GuideStore } from '../../core/guide/guide-store';
import type { GuideFact, GuideProfile, GuideTask } from '../../core/guide/guide-task';
import { HelpButton } from '../../core/guide/help-button/help-button';
import { AuthService } from '../../data/auth-service';

/** How far the sample student got with the first steps, to see the button and the panel. */
export type SampleProgress = 'none' | 'half' | 'done';

const FACTS_OF: Record<SampleProgress, readonly GuideFact[]> = {
  none: [],
  half: ['ran'],
  done: ['ran', 'submitted'],
};

const STEPS = [
  {
    anchor: GUIDE_ANCHORS.runTests,
    title: 'Ejecutar las pruebas',
    text: 'Un globo de ejemplo: oscurece la pantalla salvo su pieza.',
  },
  {
    anchor: GUIDE_ANCHORS.submit,
    title: 'Entregar',
    text: 'Los pasos de acción esperan a que el usuario pulse la pieza.',
    action: 'Pulsa «Entregar»',
  },
] as const;

/** The showcase neither reads nor saves the help of whoever looks at it. */
const NOTHING_SAVED: Pick<AuthService, 'guideState' | 'saveGuideState'> = {
  guideState: () => Promise.resolve({}),
  saveGuideState: () => Promise.resolve(),
};

const RUN: GuideTask = {
  id: 'sample-run',
  title: 'Ejecutar las pruebas',
  summary: 'Comprobar el código con los ejemplos.',
  keywords: [],
  screen: 'catalog',
  steps: STEPS,
  firstStep: true,
  doneBy: 'ran',
};

/**
 * A guided help of its own for the showcase (7.0a): the real button, panel, globe and beacons, over
 * two sample pieces. It has its own GuideStore, which neither reads nor saves the help of whoever
 * looks at it, and its progress is chosen here.
 */
@Component({
  selector: 'app-showcase-guide',
  imports: [MatButton, MatButtonToggle, MatButtonToggleGroup, MatIcon, GuideAnchor, HelpButton],
  providers: [GuideStore, { provide: AuthService, useValue: NOTHING_SAVED }],
  template: `
    <div class="flex flex-col gap-4 rounded-2xl bg-panel p-4">
      <div class="flex flex-wrap items-center gap-4">
        <span class="flex items-center gap-2 rounded-full bg-primary p-1 text-on-primary">
          <app-help-button />
        </span>
        <mat-button-toggle-group
          aria-label="Primeros pasos del ejemplo"
          hideSingleSelectionIndicator
          [value]="progress()"
          (change)="setProgress($event.value)"
        >
          <mat-button-toggle value="none">Sin empezar</mat-button-toggle>
          <mat-button-toggle value="half">A medias</mat-button-toggle>
          <mat-button-toggle value="done">Terminados</mat-button-toggle>
        </mat-button-toggle-group>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button matButton="tonal" type="button" [appGuideAnchor]="anchors.runTests">
          <mat-icon>play_arrow</mat-icon>
          Ejecutar pruebas
        </button>
        <button matButton="filled" type="button" [appGuideAnchor]="anchors.submit">
          <mat-icon>send</mat-icon>
          Entregar
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button matButton="outlined" type="button" (click)="showGlobe()">Ver un globo</button>
        <button matButton="outlined" type="button" (click)="showBeacons()">Ver las balizas</button>
      </div>
    </div>
  `,
})
export class ShowcaseGuide {
  private readonly guide = inject(GuideStore);

  protected readonly anchors = GUIDE_ANCHORS;
  protected readonly progress = signal<SampleProgress>('half');

  constructor() {
    const profile: GuideProfile = {
      tasks: [
        RUN,
        { ...RUN, id: 'sample-submit', title: 'Entregar', doneBy: 'submitted' },
        {
          ...RUN,
          id: 'sample-tour',
          title: 'Recorrer esta pantalla',
          firstStep: false,
          tourOf: 'catalog',
          doneBy: undefined,
        },
        {
          ...RUN,
          id: 'sample-theme',
          title: 'Cambiar el tema',
          firstStep: false,
          doneBy: undefined,
        },
      ],
      // Seen in every version: the showcase never starts it by itself
      welcome: { version: 0, screen: 'catalog', place: 'catalog', steps: STEPS },
      beacons: STEPS.map(({ anchor, title, text }) => ({ screen: 'catalog', anchor, title, text })),
      screenOf: () => 'catalog',
      loadFacts: () =>
        Promise.resolve({ known: new Set(FACTS_OF[this.progress()]), places: { catalog: [] } }),
    };
    this.guide.use(profile);
  }

  protected setProgress(progress: SampleProgress): void {
    this.progress.set(progress);
    this.guide.refreshFacts();
  }

  protected showGlobe(): void {
    void this.guide.startTask(RUN);
  }

  protected showBeacons(): void {
    void this.guide.showBeacons();
  }
}
