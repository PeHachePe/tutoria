import { MatDialogRef } from '@angular/material/dialog';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { GuideStore } from '../guide-store';
import { FakeGuideStore, guideTask } from '../guide-testing';
import type { GuideTask } from '../guide-task';
import { HelpPanel } from './help-panel';

const START = guideTask('Empezar un ejercicio', {
  firstStep: true,
  doneBy: 'started',
  screen: 'catalog',
  place: 'catalog',
});
const RUN = guideTask('Ejecutar las pruebas', { firstStep: true, screen: 'workspace' });
const THEME = guideTask('Cambiar el tema', { keywords: ['oscuro'], screen: 'catalog' });
const PRACTISE = guideTask('Practicar de nuevo', {
  screen: 'workspace',
  place: 'submittedExercise',
  unavailable: 'Cuando hayas entregado un ejercicio',
});
const TOUR = guideTask('Conocer tus ejercicios', { tourOf: 'catalog', screen: 'catalog' });

describe('HelpPanel', () => {
  let guide: FakeGuideStore;
  let close: ReturnType<typeof vi.fn>;

  async function renderPanel(tasks: readonly GuideTask[] = [START, RUN, THEME, PRACTISE]) {
    guide.tasks.set(tasks);
    close = vi.fn();
    await render(HelpPanel, {
      providers: [
        { provide: GuideStore, useValue: guide },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
  }

  const region = (name: string) => screen.getByRole('region', { name });

  beforeEach(() => {
    guide = new FakeGuideStore();
    guide.facts.set({ known: new Set(['started']), places: { catalog: ['/alumno'] } });
  });

  it('reads the facts again when it opens, and has a title and a way to close', async () => {
    await renderPanel();

    expect(guide.refreshFacts).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Ayuda', level: 2 }).id).toBe('help-panel-title');
    expect(screen.getByRole('button', { name: 'Cerrar la ayuda' })).toBeTruthy();
  });

  describe('first steps', () => {
    it('show their progress and which are done', async () => {
      await renderPanel();

      const steps = region('Primeros pasos');
      expect(within(steps).getByText('1 de 2')).toBeTruthy();
      expect(
        within(steps)
          .getByRole('progressbar', { name: 'Primeros pasos hechos' })
          .getAttribute('aria-valuenow'),
      ).toBe('50');
      expect(
        within(steps).getByRole('button', { name: 'Empezar un ejercicio , hecha' }),
      ).toBeTruthy();
      expect(within(steps).getByRole('button', { name: 'Ejecutar las pruebas' })).toBeTruthy();
    });

    it('start one, closing the panel', async () => {
      await renderPanel();

      await userEvent.click(
        within(region('Primeros pasos')).getByRole('button', { name: 'Ejecutar las pruebas' }),
      );

      expect(close).toHaveBeenCalled();
      expect(guide.startTask).toHaveBeenCalledWith(RUN);
    });

    it('hide with «Ya sé usarla»', async () => {
      await renderPanel();

      await userEvent.click(screen.getByRole('button', { name: 'Ya sé usarla' }));

      expect(guide.hideFirstSteps).toHaveBeenCalled();
    });

    it('make way for a celebration once all are done, until it is acknowledged', async () => {
      guide.facts.set({ known: new Set(['started']), places: {} });
      guide.state.set({ done: { [RUN.id]: 'ayer' } });
      await renderPanel();

      expect(screen.queryByRole('region', { name: 'Primeros pasos' })).toBeNull();
      const done = region('¡Ya sabes lo básico!');
      await userEvent.click(within(done).getByRole('button', { name: 'Entendido' }));
      expect(guide.hideFirstSteps).toHaveBeenCalled();

      guide.state.set({ done: { [RUN.id]: 'ayer' }, firstStepsHidden: true });
      await screen.findByRole('region', { name: '¿Cómo se hace…?' });
      expect(screen.queryByRole('region', { name: '¡Ya sabes lo básico!' })).toBeNull();
    });

    it('do not show without any', async () => {
      await renderPanel([THEME]);

      expect(screen.queryByRole('region', { name: 'Primeros pasos' })).toBeNull();
      expect(screen.queryByRole('region', { name: '¡Ya sabes lo básico!' })).toBeNull();
    });
  });

  describe('how is it done', () => {
    it('lists the tasks of the open screen first, without the first steps above', async () => {
      guide.screen.set('workspace');
      await renderPanel();

      const buttons = within(region('¿Cómo se hace…?')).getAllByRole('button');
      expect(buttons).toHaveLength(2);
      expect(buttons[0].textContent).toContain('Practicar de nuevo');
      expect(buttons[1].textContent).toContain('Cambiar el tema');
    });

    it('says what each task achieves, or why it is not possible yet', async () => {
      await renderPanel();
      const howTo = region('¿Cómo se hace…?');

      const theme = within(howTo).getByRole('button', { name: 'Cambiar el tema' });
      expect(theme.getAttribute('aria-describedby')).toBe('help-task-Cambiar el tema');
      expect(within(howTo).getByText('Resumen de Cambiar el tema')).toBeTruthy();
      const practise = within(howTo).getByRole('button', { name: 'Practicar de nuevo' });
      expect(practise.getAttribute('aria-disabled')).toBe('true');
      expect(
        within(howTo).getByText('No disponible: Cuando hayas entregado un ejercicio'),
      ).toBeTruthy();

      await userEvent.click(practise);
      expect(guide.startTask).not.toHaveBeenCalled();
      await userEvent.click(theme);
      expect(guide.startTask).toHaveBeenCalledWith(THEME);
    });

    it('marks a task done, and says why a first step cannot start yet', async () => {
      guide.state.set({ firstStepsHidden: true, done: { [THEME.id]: 'ayer' } });
      guide.facts.set({ known: new Set(), places: {} });
      await renderPanel([
        guideTask('Entregar', {
          firstStep: true,
          place: 'openExercise',
          unavailable: 'Sin ejercicios',
        }),
        THEME,
      ]);

      expect(screen.getByRole('button', { name: 'Cambiar el tema , hecha' })).toBeTruthy();
      expect(screen.getByText('No disponible: Sin ejercicios')).toBeTruthy();
    });

    it('filters them by title and keywords, every task included, and says when none matches', async () => {
      await renderPanel();
      const filter = screen.getByRole('searchbox', { name: 'Busca una tarea' });

      await userEvent.type(filter, 'OSCURO');
      expect(within(region('¿Cómo se hace…?')).getAllByRole('button')).toHaveLength(1);

      await userEvent.clear(filter);
      await userEvent.type(filter, 'ejecutar');
      expect(
        within(region('¿Cómo se hace…?')).getByRole('button', { name: 'Ejecutar las pruebas' }),
      ).toBeTruthy();

      await userEvent.clear(filter);
      await userEvent.type(filter, 'nada');
      expect(screen.getByText('Ninguna tarea coincide con «nada».')).toBeTruthy();
    });
  });

  describe('this screen', () => {
    it('tours it, piece by piece', async () => {
      guide.screenTour.set(TOUR);
      await renderPanel();

      await userEvent.click(screen.getByRole('button', { name: /Recorrer esta pantalla/ }));

      expect(close).toHaveBeenCalled();
      expect(guide.startTask).toHaveBeenCalledWith(TOUR);
    });

    it('shows its beacons, and hides them once shown', async () => {
      guide.hasBeacons.set(true);
      await renderPanel();

      await userEvent.click(screen.getByRole('button', { name: /Ayuda de esta pantalla/ }));
      expect(guide.showBeacons).toHaveBeenCalled();

      guide.beaconsShown.set(true);
      await userEvent.click(
        await screen.findByRole('button', { name: /Ocultar la ayuda de esta pantalla/ }),
      );
      expect(guide.hideBeacons).toHaveBeenCalled();
      expect(close).toHaveBeenCalledTimes(2);
    });

    it('has no tiles on a screen without them, and always the welcome', async () => {
      await renderPanel();

      expect(screen.queryByRole('button', { name: /Recorrer esta pantalla/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Ayuda de esta pantalla/ })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Ver la bienvenida' }));

      expect(close).toHaveBeenCalled();
      expect(guide.startWelcome).toHaveBeenCalled();
    });
  });
});
