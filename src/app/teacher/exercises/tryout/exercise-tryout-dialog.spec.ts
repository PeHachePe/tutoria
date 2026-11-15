import { BreakpointObserver } from '@angular/cdk/layout';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { provideSessionOf, restoreSession } from '../../../auth/auth-testing';
import { PageReloader } from '../../../core/page-reloader';
import { CodeRunnerService } from '../../../data/code-runner-service';
import { ExerciseService } from '../../../data/exercise-service';
import type { TutorEvent, TutorPreviewRequest } from '../../../data/tutor';
import { TutorService } from '../../../data/tutor-service';
import {
  FakeTabChannel,
  provideTestEditingTab,
} from '../../../student/workspace/editing-tab-testing';
import { openTryout } from './exercise-tryout-dialog';
import { TRYOUT_SUM } from './tryout-testing';

const HINT: TutorEvent[] = [
  { type: 'meta', emotion: 'encouragement', intensity: 1, hintLevel: 1 },
  { type: 'delta', text: 'Mira el acumulador.' },
  { type: 'done', interactionId: null, silent: false },
];

describe('ExerciseTryoutDialog', () => {
  let asked: TutorPreviewRequest[];

  async function openDialog(exercise = TRYOUT_SUM) {
    asked = [];
    TestBed.configureTestingModule({
      // The editor is deferred and jsdom has no viewport: it stays as its placeholder
      deferBlockBehavior: DeferBlockBehavior.Manual,
      providers: [
        provideRouter([]),
        ...provideSessionOf('teacher'),
        ...provideTestEditingTab(new FakeTabChannel()),
        { provide: PageReloader, useValue: { reload: vi.fn() } },
        { provide: CodeRunnerService, useValue: { check: vi.fn() } },
        // The tools of the workspace take it; the try never reads the assigned exercises
        { provide: ExerciseService, useValue: {} },
        {
          provide: TutorService,
          useValue: {
            async *tryOut(request: TutorPreviewRequest) {
              asked.push(request);
              yield* HINT;
            },
          },
        },
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: false, breakpoints: {} }) },
        },
      ],
    });
    await restoreSession();
    const ref = openTryout(TestBed.inject(MatDialog), exercise);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByText('En curso')).toBeTruthy());
    return { ref, dialog };
  }

  it('opens the workspace with the exercise of the form, saying nothing is saved', async () => {
    const { dialog } = await openDialog();

    const heading = within(dialog).getByRole('heading', { name: 'Suma' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(within(dialog).getByText(/No se guarda nada/)).toBeTruthy();
    expect(within(dialog).getByRole('region', { name: 'Suma' })).toBeTruthy();
  });

  it('asks the tutor in preview mode, and starts again from nothing', async () => {
    const { dialog } = await openDialog();

    await userEvent.click(within(dialog).getByRole('button', { name: /Pedir pista/ }));
    await waitFor(() =>
      expect(within(dialog).getAllByText('Mira el acumulador.').length).toBeGreaterThan(0),
    );
    expect(asked[0].preview.exercise.functionName).toBe('sum');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Empezar de nuevo' }));

    await waitFor(() => expect(within(dialog).queryAllByText('Mira el acumulador.')).toEqual([]));
    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: 'Suma' })),
    );
  });

  it('closes with its button, not with Esc', async () => {
    const { ref, dialog } = await openDialog();
    const closed = vi.fn();
    ref.afterClosed().subscribe(closed);

    await userEvent.keyboard('{Escape}');
    expect(closed).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar la vista previa' }));

    await waitFor(() => expect(closed).toHaveBeenCalled());
  });

  it('says the language of a title that has no translation', async () => {
    const exercise = TRYOUT_SUM.content.exercise;
    const { dialog } = await openDialog({
      ...TRYOUT_SUM,
      content: {
        ...TRYOUT_SUM.content,
        exercise: { ...exercise, sourceLocale: 'ca', title: 'Suma' },
      },
    });

    expect(within(dialog).getByRole('heading', { name: 'Suma' }).getAttribute('lang')).toBe('ca');
  });
});
