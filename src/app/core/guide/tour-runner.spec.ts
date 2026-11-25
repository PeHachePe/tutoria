import { Component, createEnvironmentInjector, EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import type { Config, DestroyReason, DriveStep, Driver, PopoverDOM } from 'driver.js';
import type { DriverHint, Hints, HintsConfig } from 'driver.js/hints';

import { MASCOT_ACCESSORIES } from '../../shared/mascot/mascot-accessories';
import type { GuideAnchorId } from './guide-anchor';
import type { GuideBeacon, GuideStep } from './guide-task';
import { GuideLibrary, type TourEnd, TourRunner } from './tour-runner';

@Component({ template: '' })
class EmptyPage {}

@Component({ template: '<p>Diálogo</p>' })
class SomeDialog {}

/** The DOM of a globe, as driver.js hands it to onPopoverRender. */
function popoverDom(): PopoverDOM {
  const element = (tag = 'div') => document.createElement(tag);
  const wrapper = element();
  const title = element('header');
  title.textContent = 'Título';
  const footerButtons = element('span');
  const nextButton = element('button') as HTMLButtonElement;
  footerButtons.append(nextButton);
  const instruction = element();
  wrapper.append(title, instruction, footerButtons);
  return {
    wrapper,
    arrow: element(),
    title,
    description: element(),
    footer: element(),
    progress: element(),
    previousButton: element('button') as HTMLButtonElement,
    nextButton,
    closeButton: element('button') as HTMLButtonElement,
    footerButtons,
    instruction,
  };
}

/** driver.js as the tests drive it: each step is drawn and highlighted when the test says so. */
class FakeDriver {
  index = 0;
  popover: PopoverDOM | undefined;
  readonly refresh = vi.fn();
  readonly moveNext = vi.fn(() => {
    this.index++;
    this.render();
  });

  constructor(readonly config: Config) {}

  get steps(): DriveStep[] {
    return this.config.steps ?? [];
  }

  drive(): void {
    this.render();
  }

  render(): void {
    this.popover = popoverDom();
    this.config.onPopoverRender?.(this.popover, {} as never);
    const step = this.steps[this.index];
    const target = typeof step.element === 'function' ? step.element() : undefined;
    this.config.onHighlighted?.(target, step, {} as never);
  }

  getActiveIndex(): number {
    return this.index;
  }

  getActiveStep(): DriveStep | undefined {
    return this.steps[this.index];
  }

  isLastStep(): boolean {
    return this.index === this.steps.length - 1;
  }

  destroy(reason: DestroyReason = 'api'): void {
    this.config.onDestroyed?.(undefined, this.steps[this.index], { reason } as never);
  }
}

/** The beacons of driver.js: one button per hint, appended to the page. */
class FakeHints {
  active: DriverHint | undefined;
  readonly dots: HTMLButtonElement[] = [];

  constructor(readonly config: HintsConfig) {}

  show(): void {
    for (let index = 0; index < (this.config.hints?.length ?? 0); index++) {
      const dot = document.createElement('button');
      dot.className = `driver-hint ${this.config.beacon?.className ?? ''}`;
      document.body.append(dot);
      this.dots.push(dot);
    }
  }

  hide(): void {
    this.dots.forEach((dot) => dot.remove());
  }

  /** Opens the globe of a hint, as a click on its beacon does. */
  open(index: number): PopoverDOM {
    this.active = this.config.hints?.[index];
    const popover = popoverDom();
    this.active?.popover?.onPopoverRender?.(popover, { hint: this.active, hints: {} as Hints });
    return popover;
  }

  getActive(): DriverHint | undefined {
    return this.active;
  }
}

const STEP: GuideStep = { title: 'Paso', text: 'Texto' };

describe('TourRunner', () => {
  let runner: TourRunner;
  let router: Router;
  let tour: FakeDriver;
  let hints: FakeHints;
  let library: { driver: ReturnType<typeof vi.fn>; hints: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    library = {
      driver: vi.fn(() =>
        Promise.resolve((config: Config) => {
          tour = new FakeDriver(config);
          return tour as unknown as Driver;
        }),
      ),
      hints: vi.fn(() =>
        Promise.resolve((config: HintsConfig) => {
          hints = new FakeHints(config);
          return hints as unknown as Hints;
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: EmptyPage }]),
        { provide: GuideLibrary, useValue: library },
      ],
    });
    router = TestBed.inject(Router);
    await router.navigateByUrl('/alumno');
    runner = TestBed.inject(TourRunner);
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** A piece of the page marked with an id of the guided help. */
  function piece(
    anchor: GuideAnchorId,
    html = '<button type="button">Pieza</button>',
  ): HTMLElement {
    const box = document.createElement('div');
    box.innerHTML = html;
    const element = box.firstElementChild as HTMLElement;
    element.setAttribute('data-guide', anchor);
    document.body.append(element);
    return element;
  }

  /** A piece that shows, with a size: jsdom gives none. */
  function shownPiece(anchor: GuideAnchorId): HTMLElement {
    const element = piece(anchor);
    element.checkVisibility = () => true;
    element.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect;
    return element;
  }

  /**
   * Starts a tour and waits until driver.js is running it. The end comes in an object: an async
   * function that returned the promise itself would wait for it.
   */
  async function start(
    steps: readonly GuideStep[],
    options = {},
  ): Promise<{ end: Promise<TourEnd> }> {
    const end = runner.run(steps, options);
    await vi.waitFor(() => expect(library.driver).toHaveBeenCalled());
    await Promise.resolve();
    return { end };
  }

  describe('a tour', () => {
    it('turns the steps into those of driver.js, with the texts of the app', async () => {
      const { end } = await start(
        [
          { anchor: 'help', title: 'Ayuda', text: 'Aquí', side: 'left' },
          { anchor: 'run-tests', title: 'Pruebas', text: 'Pulsa', action: 'Pulsa «Ejecutar»' },
          { anchor: 'hint', title: 'Pista', text: '', optional: true },
          { anchor: 'submit-dialog', title: 'Diálogo', text: '', inOverlay: true },
        ],
        { closeLabel: 'Saltar la bienvenida' },
      );
      const { config } = tour;

      expect(config).toMatchObject({
        animate: true,
        allowedElements: '.cdk-overlay-container',
        overlayClickBehavior: 'none',
        showProgress: true,
        nextBtnText: 'Siguiente',
        prevBtnText: 'Anterior',
        doneBtnText: 'Terminar',
        closeBtnLabel: 'Saltar la bienvenida',
      });
      const [explain, action, optional, overlay] = tour.steps;
      expect(explain).toMatchObject({
        popover: { title: 'Ayuda', description: 'Aquí', side: 'left' },
        advanceOn: false,
        disableActiveInteraction: true,
        allowPageInteraction: false,
        waitForElement: 8000,
        skipMissingElement: false,
        onElementMissing: 'stay',
      });
      expect(explain.popover?.showButtons).toEqual(['next', 'previous', 'close']);
      expect(action.popover?.instruction).toBe('Pulsa «Ejecutar»');
      expect(action.popover?.showButtons).toEqual(['previous', 'close']);
      expect(action).toMatchObject({ disableActiveInteraction: false });
      expect(optional).toMatchObject({ waitForElement: 0, skipMissingElement: true });
      expect(overlay).toMatchObject({
        allowPageInteraction: true,
        disableActiveInteraction: false,
        onElementMissing: 'previousAction',
      });
      tour.destroy('done');
      await expect(end).resolves.toBe('done');
    });

    it('has no progress with a single step, and no animations if the user reduced them', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true }));

      void (await start([STEP]));

      expect(tour.config).toMatchObject({
        showProgress: false,
        animate: false,
        smoothScroll: false,
      });
      expect(tour.config.closeBtnLabel).toBe('Cerrar');
    });

    it('finds each piece when it is needed: the first that shows, a whole tab, a whole menu', async () => {
      void (await start([
        { anchor: 'hint', ...STEP },
        { anchor: 'workspace-tab-code', ...STEP },
        { anchor: 'attempt-choices', ...STEP, inOverlay: true },
        { anchor: 'submit', ...STEP },
        STEP,
      ]));
      const find = (index: number) => (tour.steps[index].element as () => Element)();

      expect(find(0)).toBeUndefined();
      const hidden = piece('hint');
      const shown = piece('hint');
      hidden.checkVisibility = () => false;
      shown.checkVisibility = () => true;
      shown.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect;
      expect(find(0)).toBe(shown);

      const tab = piece('workspace-tab-code', '<div role="tab"><span>Código</span></div>');
      tab.removeAttribute('data-guide');
      tab.querySelector('span')?.setAttribute('data-guide', 'workspace-tab-code');
      expect(find(1)).toBe(tab);

      const menu = piece('attempt-choices', '<div role="menu"><a>Intento 1</a></div>');
      menu.removeAttribute('data-guide');
      menu.querySelector('a')?.setAttribute('data-guide', 'attempt-choices');
      expect(find(2)).toBe(menu);

      // Outside a menu or a dialog step, the piece itself even inside a dialog
      const surface = piece(
        'submit',
        '<div class="mat-mdc-dialog-surface"><button>Sí</button></div>',
      );
      surface.removeAttribute('data-guide');
      surface.querySelector('button')?.setAttribute('data-guide', 'submit');
      expect(find(3)?.tagName).toBe('BUTTON');
      expect(tour.steps[4].element).toBeUndefined();
    });

    it('goes on with an action only when the piece itself is pressed, and while enabled', async () => {
      void (await start([
        { anchor: 'run-tests', ...STEP, action: 'Pulsa' },
        { ...STEP, action: 'X' },
      ]));
      const button = piece('run-tests', '<button><span>Ejecutar</span></button>');
      const outside = piece('help');
      const advanceOn = tour.steps[0].advanceOn as { when: (...args: unknown[]) => boolean };
      const pressed = (target: unknown) =>
        advanceOn.when(button, tour.steps[0], { event: { target } });

      expect(pressed(button.querySelector('span'))).toBe(true);
      expect(pressed(outside)).toBe(false);
      expect(pressed(null)).toBe(false);
      button.setAttribute('aria-disabled', 'true');
      expect(pressed(button)).toBe(false);
      // A mark inside the label of a tab stands for the whole tab
      const tab = piece(
        'run-tests',
        '<div role="tab"><span class="pad"></span><b>Inglés</b></div>',
      );
      tab.removeAttribute('data-guide');
      tab.querySelector('b')?.setAttribute('data-guide', 'run-tests');
      expect(pressed(tab.querySelector('.pad'))).toBe(true);
      // A step without a piece never goes on by itself
      const noPiece = tour.steps[1].advanceOn as { when: (...args: unknown[]) => boolean };
      expect(noPiece.when(button, tour.steps[1], { event: { target: button } })).toBe(false);
    });

    it.each([
      ['done', 'done'],
      ['close', 'closed'],
      ['escape', 'closed'],
      ['overlay', 'closed'],
      ['api', 'interrupted'],
      [undefined, 'interrupted'],
    ] as const)('ends as %s → %s', async (reason, expected) => {
      const { end } = await start([STEP]);

      tour.config.onDestroyed?.(undefined, tour.steps[0], { reason } as never);

      await expect(end).resolves.toBe(expected);
    });

    it('gives the focus back to where it was', async () => {
      const button = piece('help');
      button.focus();
      const { end } = await start([STEP]);
      piece('hint').focus();

      tour.destroy('done');
      await end;

      expect(document.activeElement).toBe(button);
    });

    it('ends as interrupted when the user leaves the page, unless the step leads there', async () => {
      const { end } = await start([{ ...STEP, navigates: true }, STEP]);

      await router.navigateByUrl('/alumno/ejercicio/a');
      tour.index = 1;
      await router.navigateByUrl('/alumno/ejercicio/a?intento=2');
      expect(tour.getActiveStep()).toBeDefined();
      vi.spyOn(tour, 'destroy');
      await router.navigateByUrl('/alumno/ajustes');

      expect(tour.destroy).toHaveBeenCalled();
      await expect(end).resolves.toBe('interrupted');
    });

    it('starts once the dialogs open are closed, as the help panel', async () => {
      const dialog = TestBed.inject(MatDialog).open(SomeDialog);
      const end = runner.run([STEP]);
      await new Promise((resolve) => setTimeout(resolve));
      expect(library.driver).not.toHaveBeenCalled();

      dialog.close();
      await vi.waitFor(() => expect(library.driver).toHaveBeenCalled());
      await Promise.resolve();
      tour.destroy('done');
      await expect(end).resolves.toBe('done');
    });

    it('counts in its progress only the steps that show: not the optional ones missing', async () => {
      piece('help');
      void (await start([
        STEP,
        { anchor: 'hint', ...STEP, optional: true },
        { anchor: 'run-tests', ...STEP },
        { anchor: 'help', ...STEP, optional: true },
        { ...STEP, optional: true },
      ]));
      const progress = () => tour.popover?.progress.textContent;

      expect(progress()).toBe('Paso 1 de 3');
      tour.index = 2;
      tour.render();
      expect(progress()).toBe('Paso 2 de 3');
      tour.index = 1;
      tour.render();
      expect(progress()).toBe('Paso 2 de 4');
    });

    it('opens the side menu for its entries, again if it closes, and closes it after them', async () => {
      const sideMenu = {
        open: vi.fn(() => undefined),
        close: vi.fn(),
        closed: () => new Promise(() => undefined),
      };
      const entry = piece('help');
      const { end } = await start(
        [
          { anchor: 'help', ...STEP, inSideMenu: true },
          { anchor: 'hint', ...STEP },
        ],
        { sideMenu },
      );
      const find = (index: number) => (tour.steps[index].element as () => Element)();

      // driver.js looked for it when drawing the step, and looks again whenever the page changes
      expect(sideMenu.open).toHaveBeenCalledOnce();
      sideMenu.open.mockClear();
      expect(find(0)).toBe(entry);
      expect(find(0)).toBe(entry);
      expect(sideMenu.open).toHaveBeenCalledTimes(2);
      expect(sideMenu.close).not.toHaveBeenCalled();
      expect(tour.steps[0]).toMatchObject({
        allowPageInteraction: false,
        onElementMissing: 'stay',
      });

      tour.moveNext();
      void find(1);
      expect(sideMenu.open).toHaveBeenCalledTimes(2);
      expect(sideMenu.close).toHaveBeenCalledOnce();
      tour.destroy('close');
      await end;
      expect(sideMenu.close).toHaveBeenCalledTimes(2);
    });

    it('puts the globe in the top layer, over the dialogs of Material, each time it is drawn', async () => {
      const toggle = vi.fn();
      Object.defineProperty(HTMLElement.prototype, 'togglePopover', {
        value: toggle,
        configurable: true,
      });
      try {
        void (await start([STEP]));

        expect(tour.popover?.wrapper.getAttribute('popover')).toBe('manual');
        expect(toggle.mock.calls).toEqual([[false], [true]]);
      } finally {
        delete (HTMLElement.prototype as Partial<HTMLElement>).togglePopover;
      }
    });

    it('marks the globe of a step inside a dialog, so it moves out of the way of its buttons', async () => {
      void (await start([STEP, { anchor: 'submit-dialog', ...STEP, inOverlay: true }]));

      expect(tour.popover?.wrapper.classList).not.toContain('app-guide-in-overlay');
      tour.moveNext();
      expect(tour.popover?.wrapper.classList).toContain('app-guide-in-overlay');
    });

    it('measures the entry again once the side menu has slid in', async () => {
      piece('help');
      const sideMenu = {
        open: vi.fn(() => Promise.resolve()),
        close: vi.fn(),
        closed: () => new Promise(() => undefined),
      };
      void (await start([{ anchor: 'help', ...STEP, inSideMenu: true }], { sideMenu }));

      await vi.waitFor(() => expect(tour.refresh).toHaveBeenCalled());
    });

    it('opens the side menu again if Esc closes it under its entry, not once the tour left it', async () => {
      piece('help');
      const closings: (() => void)[] = [];
      const sideMenu = {
        open: vi.fn(() => Promise.resolve()),
        close: vi.fn(),
        closed: () => new Promise<void>((resolve) => closings.push(resolve)),
      };
      void (await start([{ anchor: 'help', ...STEP, inSideMenu: true }, STEP], { sideMenu }));
      sideMenu.open.mockClear();

      closings[0]();
      await vi.waitFor(() => expect(sideMenu.open).toHaveBeenCalledOnce());
      await vi.waitFor(() => expect(tour.refresh).toHaveBeenCalled());

      void (await start([{ anchor: 'help', ...STEP, inSideMenu: true }, STEP], { sideMenu }));
      tour.moveNext();
      sideMenu.open.mockClear();
      closings[1]();
      await Promise.resolve();
      await Promise.resolve();
      expect(sideMenu.open).not.toHaveBeenCalled();
    });

    it('leaves a globe as it is when driver.js has no step of ours in it', async () => {
      void (await start([STEP]));
      const popover = popoverDom();
      tour.index = 5;

      tour.config.onPopoverRender?.(popover, {} as never);

      expect(popover.title.querySelector('.app-guide-mascot')).toBeNull();
    });

    it('puts the mascot by the title, celebrating on the last globe', async () => {
      void (await start([STEP, STEP]));
      const mascot = () => {
        TestBed.tick();
        return tour.popover?.title.querySelector('.app-guide-mascot > *');
      };

      expect(mascot()?.querySelector('svg')).toBeTruthy();
      // By default, the accessories of every mascot
      expect(mascot()?.classList).toContain('mascot-bone');
      expect(mascot()?.classList).not.toContain('mascot-joy');
      tour.moveNext();
      expect(mascot()?.classList).toContain('mascot-joy');
    });

    it('dresses the mascot with what the area provides: the accessories of the student', async () => {
      const bare = signal(false);
      const area = createEnvironmentInjector(
        [
          {
            provide: MASCOT_ACCESSORIES,
            useValue: { headset: bare, bowTie: bare, boneCursor: bare },
          },
        ],
        TestBed.inject(EnvironmentInjector),
      );

      void (await start([STEP], { injector: () => area }));
      TestBed.tick();

      const mascot = tour.popover?.title.querySelector('.app-guide-mascot > *');
      expect(mascot?.classList).not.toContain('mascot-bone');
    });

    it('explains why an action is not possible yet, and ends there', async () => {
      piece('submit', '<button aria-disabled="true">Entregar</button>');
      const { end } = await start([
        {
          anchor: 'submit',
          ...STEP,
          action: 'Pulsa «Entregar»',
          whenDisabled: { title: 'Aún no', text: 'Supera las pruebas' },
        },
      ]);
      const popover = tour.popover as PopoverDOM;

      expect(popover.title.textContent).toContain('Aún no');
      expect(popover.description.textContent).toBe('Supera las pruebas');
      expect(popover.instruction?.isConnected).toBe(false);
      const ok = popover.footerButtons.querySelector('button');
      expect(ok?.textContent).toBe('Entendido');
      expect(ok?.className).not.toContain('driver-popover');
      ok?.click();

      await expect(end).resolves.toBe('closed');
    });

    /** The button of the next first step in the globe drawn last, once it is known. */
    const nextTaskButton = () =>
      [...(tour.popover?.footerButtons.querySelectorAll('button') ?? [])].find((button) =>
        button.textContent?.startsWith('Siguiente: '),
      );

    it('offers the next first step on its last globe, without taking the focus back', async () => {
      const before = piece('help');
      before.focus();
      const next = vi.fn(() => Promise.resolve<string | undefined>('Ejecutar las pruebas'));
      const { end } = await start([STEP, STEP], { next });
      expect(next).not.toHaveBeenCalled();
      tour.moveNext();
      const popover = tour.popover as PopoverDOM;
      document.body.append(popover.wrapper);
      piece('hint').focus();

      await vi.waitFor(() => expect(nextTaskButton()).toBeDefined());
      expect(popover.nextButton.classList).toContain('app-guide-secondary');
      expect(nextTaskButton()?.textContent).toBe('Siguiente: Ejecutar las pruebas');
      // Drawn again, as driver.js does when the page changes: asked once, offered once
      tour.config.onPopoverRender?.(popover, {} as never);
      await Promise.resolve();
      expect(next).toHaveBeenCalledOnce();
      expect(popover.footerButtons.querySelectorAll('.app-guide-next-task')).toHaveLength(1);
      nextTaskButton()?.click();

      await expect(end).resolves.toBe('next');
      expect(document.activeElement).not.toBe(before);
    });

    it('offers no next first step in a globe no longer shown, or once the tour left the last one', async () => {
      let answer: (title: string | undefined) => void = () => undefined;
      void (await start([STEP, STEP], {
        next: () => new Promise<string | undefined>((resolve) => (answer = resolve)),
      }));
      tour.moveNext();
      const gone = tour.popover as PopoverDOM;
      const shown = popoverDom();
      document.body.append(shown.wrapper);
      tour.config.onPopoverRender?.(shown, {} as never);

      tour.index = 0;
      answer('Ejecutar las pruebas');
      await vi.waitFor(() => expect(shown.nextButton.classList).not.toContain('x'));

      for (const popover of [gone, shown]) {
        expect(popover.footerButtons.querySelector('.app-guide-next-task')).toBeNull();
      }
    });

    it('offers no next first step when the profile has none to offer', async () => {
      void (await start([STEP], { next: () => Promise.resolve(undefined) }));
      await Promise.resolve();

      expect(nextTaskButton()).toBeUndefined();
      expect(tour.popover?.nextButton.classList).not.toContain('app-guide-secondary');
    });

    it('goes on from a dialog that saves once it closes saving, not with the click (7.0b2)', async () => {
      const dialogs = TestBed.inject(MatDialog);
      const step = {
        anchor: 'class-dialog-save' as const,
        ...STEP,
        action: 'Crear',
        inOverlay: true,
      };
      void (await start([
        { anchor: 'groups-add-class', ...STEP },
        { ...step, savesDialog: true },
        STEP,
      ]));
      expect(tour.steps[1].advanceOn).toBe(false);

      // Cancelled: nothing; the tour goes back by itself when the piece goes away
      let ref = dialogs.open(SomeDialog, { id: 'clase' });
      await vi.waitFor(() => expect(document.getElementById('clase')).not.toBeNull());
      document.getElementById('clase')?.append(shownPiece('class-dialog-save'));
      tour.moveNext();
      ref.close();
      await vi.waitFor(() => expect(document.getElementById('clase')).toBeNull());
      expect(tour.index).toBe(1);

      // Saved: the next step
      ref = dialogs.open(SomeDialog, { id: 'otra' });
      await vi.waitFor(() => expect(document.getElementById('otra')).not.toBeNull());
      document.getElementById('otra')?.append(shownPiece('class-dialog-save'));
      tour.render();
      ref.close(true);
      await vi.waitFor(() => expect(tour.index).toBe(2));
    });

    it('waits for no dialog when the piece is in none, or the tour has moved on', async () => {
      const dialogs = TestBed.inject(MatDialog);
      const outside = shownPiece('class-dialog-save');
      void (await start([{ anchor: 'class-dialog-save', ...STEP, savesDialog: true }, STEP]));
      expect(tour.moveNext).not.toHaveBeenCalled();
      outside.remove();

      const ref = dialogs.open(SomeDialog, { id: 'clase' });
      await vi.waitFor(() => expect(document.getElementById('clase')).not.toBeNull());
      document.getElementById('clase')?.append(shownPiece('class-dialog-save'));
      tour.render();
      tour.index = 1;
      ref.close(true);
      await vi.waitFor(() => expect(dialogs.openDialogs).toHaveLength(0));

      expect(tour.moveNext).not.toHaveBeenCalled();
    });

    it('leaves the focus alone when where it was is gone', async () => {
      const button = piece('help');
      button.focus();
      const { end } = await start([STEP]);
      const other = piece('hint');
      other.focus();
      button.remove();

      tour.destroy('done');
      await end;

      expect(document.activeElement).toBe(other);
    });

    it('leaves the focus in the menu or the dialog the task ends by opening', async () => {
      piece('help').focus();
      const { end } = await start([STEP]);
      const menu = piece('hint', '<div role="menu"><button role="menuitem">Editar</button></div>');

      tour.destroy('done');
      await end;

      expect(document.activeElement).toBe(menu.querySelector('button'));
    });

    it('offers to turn on a switch that is off, and goes on once its choices are drawn', async () => {
      vi.useFakeTimers();
      const voice = piece(
        'settings-voice',
        '<div><button role="switch" aria-checked="false">Voz</button></div>',
      );
      const toggle = voice.querySelector('button') as HTMLButtonElement;
      const clicked = vi.fn();
      toggle.addEventListener('click', clicked);
      const run = runner.run([
        { anchor: 'settings-voice', ...STEP, turnOn: 'Activar la voz' },
        STEP,
      ]);
      await vi.waitFor(() => expect(library.driver).toHaveBeenCalled());
      await Promise.resolve();
      const popover = tour.popover as PopoverDOM;

      const turnOn = [...popover.footerButtons.querySelectorAll('button')].find(
        (button) => button.textContent === 'Activar la voz',
      );
      expect(popover.nextButton.classList).toContain('app-guide-secondary');
      turnOn?.click();
      expect(clicked).toHaveBeenCalled();
      expect(tour.moveNext).not.toHaveBeenCalled();
      vi.advanceTimersByTime(150);
      expect(tour.moveNext).toHaveBeenCalled();

      tour.destroy('done');
      await expect(run).resolves.toBe('done');
    });

    it('does not offer to turn on a switch that is on already', async () => {
      piece('settings-voice', '<div><button role="switch" aria-checked="true">Voz</button></div>');

      void (await start([{ anchor: 'settings-voice', ...STEP, turnOn: 'Activar la voz' }]));

      expect(tour.popover?.footerButtons.textContent).not.toContain('Activar la voz');
    });

    it('takes from a piece the attributes of a popup that its role does not admit', async () => {
      const popupOf = (element: Element) =>
        ['aria-haspopup', 'aria-expanded', 'aria-controls'].map((name) =>
          element.getAttribute(name),
        );
      const added = (element: HTMLElement) => {
        element.setAttribute('aria-haspopup', 'dialog');
        element.setAttribute('aria-expanded', 'true');
        element.setAttribute('aria-controls', 'driver-popover-content');
        return element;
      };
      const dialog = added(piece('submit-dialog', '<div role="dialog"></div>'));
      const button = added(piece('run-tests'));
      const own = piece('statement', '<div aria-controls="statement-body"></div>');
      void (await start([STEP]));

      tour.config.onHighlighted?.(dialog, tour.steps[0], {} as never);
      tour.config.onHighlighted?.(button, tour.steps[0], {} as never);
      tour.config.onHighlighted?.(own, tour.steps[0], {} as never);

      expect(popupOf(dialog)).toEqual([null, null, null]);
      expect(popupOf(button)).toEqual(['dialog', 'true', 'driver-popover-content']);
      expect(own.getAttribute('aria-controls')).toBe('statement-body');
    });

    it('ends the tour in course when another starts, or when asked', async () => {
      const { end: first } = await start([STEP]);
      const firstTour = tour;
      const second = runner.run([STEP]);
      await expect(first).resolves.toBe('interrupted');
      await vi.waitFor(() => expect(tour).not.toBe(firstTour));

      runner.stop();
      await expect(second).resolves.toBe('interrupted');
    });

    it('starts nothing once the app has ended, though driver.js was still downloading', async () => {
      let downloaded: (driver: unknown) => void = () => undefined;
      library.driver.mockReturnValueOnce(new Promise((resolve) => (downloaded = resolve)));
      const end = runner.run([STEP]);
      await vi.waitFor(() => expect(library.driver).toHaveBeenCalled());

      TestBed.resetTestingModule();
      downloaded(() => {
        throw new Error('driver.js must not start');
      });

      await expect(end).resolves.toBe('interrupted');
    });

    it('lights no beacon once the app has ended, though they were still downloading', async () => {
      piece('run-tests');
      let downloaded: (hints: unknown) => void = () => undefined;
      library.hints.mockReturnValueOnce(new Promise((resolve) => (downloaded = resolve)));
      const shown = runner.showBeacons([{ anchor: 'run-tests', title: 'Ejecutar', text: '' }]);
      await vi.waitFor(() => expect(library.hints).toHaveBeenCalled());

      TestBed.resetTestingModule();
      downloaded(() => {
        throw new Error('the beacons must not start');
      });

      await expect(shown).resolves.toBeUndefined();
    });

    it('ends with the app', async () => {
      const { end } = await start([STEP]);

      TestBed.resetTestingModule();

      await expect(end).resolves.toBe('interrupted');
    });
  });

  describe('the beacons', () => {
    const BEACONS: readonly GuideBeacon[] = [
      { anchor: 'run-tests', title: 'Ejecutar las pruebas', text: 'Comprueban tu código' },
      { anchor: 'hint', title: 'Pedir pista', text: 'Sin la solución' },
      { anchor: 'submit', title: 'Entregar', text: 'Definitivo' },
    ];

    async function show(): Promise<void> {
      piece('run-tests');
      piece('submit');
      await runner.showBeacons(BEACONS);
    }

    it('lights one by each piece that shows, named as help, the focus on the first', async () => {
      await show();

      expect(hints.config).toMatchObject({
        buttonText: 'Entendido',
        popoverClass: 'app-guide-popover',
        overlay: true,
        overlayColor: 'var(--mat-sys-scrim)',
        beacon: { side: 'top', align: 'start', animate: true, className: 'app-guide-beacon' },
      });
      expect(hints.config.hints?.map((hint) => hint.popover?.title)).toEqual([
        'Ejecutar las pruebas',
        'Entregar',
      ]);
      expect(hints.dots.map((dot) => dot.getAttribute('aria-label'))).toEqual([
        'Ayuda: Ejecutar las pruebas',
        'Ayuda: Entregar',
      ]);
      expect(document.activeElement).toBe(hints.dots[0]);
      expect(runner.beaconsShown()).toBe(true);
    });

    it('lights nothing on a screen without its pieces', async () => {
      await runner.showBeacons(BEACONS);

      expect(library.hints).not.toHaveBeenCalled();
      expect(runner.beaconsShown()).toBe(false);
    });

    it('does not move while reduced', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true }));

      await show();

      expect(hints.config.beacon?.animate).toBe(false);
    });

    it('go away with Esc when no globe is open, which Esc closes first', async () => {
      await show();
      const escape = () =>
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));

      hints.open(0);
      escape();
      expect(runner.beaconsShown()).toBe(true);
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      hints.active = undefined;
      escape();

      expect(runner.beaconsShown()).toBe(false);
      expect(hints.dots[0].isConnected).toBe(false);
    });

    it('go away with «Ocultar la ayuda» of a globe, whose close button is named', async () => {
      await show();

      const popover = hints.open(1);
      expect(popover.closeButton.getAttribute('aria-label')).toBe('Cerrar');
      const hide = popover.footerButtons.firstElementChild as HTMLButtonElement;
      expect(hide.textContent).toBe('Ocultar la ayuda');
      hide.click();

      expect(runner.beaconsShown()).toBe(false);
    });

    it('go away when the user leaves the page, or a tour starts', async () => {
      await show();
      await router.navigateByUrl('/alumno/ajustes');
      expect(runner.beaconsShown()).toBe(false);

      await show();
      void (await start([STEP]));
      expect(runner.beaconsShown()).toBe(false);
    });
  });

  describe('GuideLibrary', () => {
    it('downloads driver.js and its beacons when asked', async () => {
      const real = new GuideLibrary();

      await expect(real.driver()).resolves.toEqual(expect.any(Function));
      await expect(real.hints()).resolves.toEqual(expect.any(Function));
    });
  });
});
