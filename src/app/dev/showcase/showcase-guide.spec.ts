import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import type { GuideStep } from '../../core/guide/guide-task';
import { type TourEnd, TourRunner } from '../../core/guide/tour-runner';
import { ShowcaseGuide } from './showcase-guide';

describe('ShowcaseGuide', () => {
  let runner: {
    run: ReturnType<typeof vi.fn<(steps: readonly GuideStep[]) => Promise<TourEnd>>>;
    showBeacons: ReturnType<typeof vi.fn>;
    hideBeacons: ReturnType<typeof vi.fn>;
    beaconsShown: ReturnType<typeof signal<boolean>>;
  };

  beforeEach(async () => {
    runner = {
      run: vi.fn(() => Promise.resolve<TourEnd>('closed')),
      showBeacons: vi.fn(() => Promise.resolve()),
      hideBeacons: vi.fn(),
      beaconsShown: signal(false),
    };
    await render(ShowcaseGuide, {
      providers: [
        provideSessionOf('admin'),
        provideRouter([]),
        { provide: TourRunner, useValue: runner },
      ],
    });
    // As in the app: the showcase is for a signed-in user
    await restoreSession();
  });

  it('shows the help button with the first steps of the sample, halfway at first', async () => {
    expect(
      await screen.findByRole('button', { name: 'Ayuda: 1 de 2 primeros pasos hechos' }),
    ).toBeTruthy();

    await userEvent.click(screen.getByRole('radio', { name: 'Sin empezar' }));
    expect(
      await screen.findByRole('button', { name: 'Ayuda: 0 de 2 primeros pasos hechos' }),
    ).toBeTruthy();

    await userEvent.click(screen.getByRole('radio', { name: 'Terminados' }));
    expect(await screen.findByRole('button', { name: 'Ayuda' })).toBeTruthy();
  });

  it('shows a globe over its sample pieces, and their beacons', async () => {
    // Finished, the sample saves nowhere: its store keeps it for the page
    runner.run.mockResolvedValueOnce('done');
    await userEvent.click(screen.getByRole('button', { name: 'Ver un globo' }));
    expect(runner.run).toHaveBeenCalledWith(
      [
        expect.objectContaining({ anchor: 'run-tests' }),
        expect.objectContaining({ anchor: 'submit' }),
      ],
      expect.anything(),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Ver las balizas' }));
    expect(runner.showBeacons).toHaveBeenCalledWith([
      expect.objectContaining({ anchor: 'run-tests' }),
      expect.objectContaining({ anchor: 'submit' }),
    ]);
  });

  it('marks its sample pieces for the guided help', () => {
    expect(
      screen.getByRole('button', { name: /Ejecutar pruebas/ }).getAttribute('data-guide'),
    ).toBe('run-tests');
    expect(screen.getByRole('button', { name: /Entregar/ }).getAttribute('data-guide')).toBe(
      'submit',
    );
  });
});
