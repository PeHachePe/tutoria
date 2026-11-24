import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  DestroyRef,
  EnvironmentInjector,
  inject,
  Service,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { NavigationStart, Router } from '@angular/router';
import type { DestroyReason, Driver, DriveStep, PopoverDOM } from 'driver.js';
import type { Hints } from 'driver.js/hints';
import { filter, firstValueFrom } from 'rxjs';

import { Mascot, type MascotMood } from '../../shared/mascot/mascot';
import { prefersReducedMotion } from '../../shared/reduced-motion';
import { type GuideAnchorId, guideAnchorSelector } from './guide-anchor';
import type { GuideBeacon, GuideSideMenu, GuideStep } from './guide-task';

/**
 * How a tour ended: finished, finished choosing the next first step («Siguiente: …»), closed by the
 * user (also when its action was not possible yet) or cut short by leaving the page.
 */
export type TourEnd = 'done' | 'next' | 'closed' | 'interrupted';

export interface TourOptions {
  /** Title of the next first step, offered on the last globe. */
  readonly next?: string;
  /** Name of the button that closes it: «Saltar la bienvenida» in the welcome. */
  readonly closeLabel?: string;
  /** The side menu of the area, for the steps that point at its entries (D-094). */
  readonly sideMenu?: GuideSideMenu;
}

/** driver.js and its beacons, downloaded apart and only the first time the help is used (2.12). */
@Service()
export class GuideLibrary {
  driver(): Promise<typeof import('driver.js').driver> {
    return import('driver.js').then((file) => file.driver);
  }

  hints(): Promise<typeof import('driver.js/hints').hints> {
    return import('driver.js/hints').then((file) => file.hints);
  }
}

/** A piece of the next page, or of a dialog that opens, has this long to show. */
const WAIT_FOR_PIECE_MS = 8000;
/** A piece that is drawn again goes away for a moment: only after this long is it gone. */
const WAIT_FOR_REMOVED_MS = 300;
/** The room around the piece and its corners, as the shapes of Material (guide.css). */
const STAGE_PADDING = 6;
const STAGE_RADIUS = 12;
/** Dialogs, menus and tooltips of Material stay over the dark layer and can be used. */
const MATERIAL_OVERLAYS = '.cdk-overlay-container';
/** What a step inside a menu or a dialog of Material lights: the whole menu or dialog. */
const MATERIAL_SURFACES = '[role="menu"], .mat-mdc-dialog-surface';
/** The look of the globes and the beacons, in src/styles/guide.css. */
const POPOVER_CLASS = 'app-guide-popover';
const BEACON_CLASS = 'app-guide-beacon';
/** The globe of a step inside a dialog or a menu of Material. */
const IN_OVERLAY_CLASS = 'app-guide-in-overlay';
/**
 * driver.js tells assistive technology that the piece opens the globe, unless it has these already;
 * only some roles admit them (axe, `aria-allowed-attr`), so the others lose them again.
 */
const POPUP_ATTRIBUTES = ['aria-haspopup', 'aria-expanded', 'aria-controls'];
const POPUP_ROLES = new Set(['button', 'link', 'tab', 'combobox', 'menuitem', 'textbox']);
const POPUP_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT']);
/** A switch of Material that is off, inside a piece (`mat-slide-toggle`). */
const SWITCH_OFF = '[role="switch"][aria-checked="false"]';
/** Time for the choices a switch shows to be drawn before the tour looks for them. */
const AFTER_SWITCH_MS = 150;
/** The id of the globe, which driver.js points the piece to: it tells its attributes apart. */
const DRIVER_POPOVER_ID = 'driver-popover-content';

const TEXTS = {
  next: $localize`:@@guide.next:Siguiente`,
  previous: $localize`:@@guide.previous:Anterior`,
  finish: $localize`:@@guide.finish:Terminar`,
  close: $localize`:@@guide.close:Cerrar`,
  /** Counting only the steps that show at this width (D-093). */
  progress: (current: number, total: number) =>
    $localize`:@@guide.progress:Paso ${current}:current: de ${total}:total:`,
  gotIt: $localize`:@@guide.gotIt:Entendido`,
  hideBeacons: $localize`:@@guide.hideBeacons:Ocultar la ayuda`,
  nextTask: (title: string) => $localize`:@@guide.nextTask:Siguiente: ${title}:title:`,
  beacon: (title: string) => $localize`:@@guide.beacon:Ayuda: ${title}:title:`,
};

/**
 * The only piece that knows driver.js (D-080): it turns the steps of a guided task into a tour of
 * driver.js, and the beacons of a screen into its hints. driver.js is downloaded the first time.
 *
 * A tour waits for each piece (after a navigation, or a dialog that opens), skips the optional ones
 * that do not show at this width, goes on by itself when an action is done, and ends if the user
 * leaves the page, unless the step itself leads there. The side menu of the staff opens for the
 * steps on its entries, also if it closes in the middle, and closes after them (D-094). In a dialog of Material, the dialog keeps the
 * focus and driver.js says the globe aloud; if the dialog closes, the tour goes back to the step that
 * opened it (ficha 13, 7.0a).
 */
@Service()
export class TourRunner {
  private readonly library = inject(GuideLibrary);
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);

  private tour: Driver | undefined;
  private hints: Hints | undefined;
  private stopHintKeys: (() => void) | undefined;
  private mascot: ComponentRef<Mascot> | undefined;
  private readonly beaconsShownState = signal(false);
  /** The app has ended (a test, a reload): what was downloading must not start. */
  private ended = false;

  /** «Ayuda de esta pantalla» is on. */
  readonly beaconsShown = this.beaconsShownState.asReadonly();

  constructor() {
    // The beacons belong to a page: leaving it hides them (a tour decides for itself, in run)
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.hideBeacons());
    inject(DestroyRef).onDestroy(() => {
      this.ended = true;
      this.tour?.destroy();
      this.hideBeacons();
    });
  }

  /** Runs a tour after any open dialog closes (the help panel itself); resolves with how it ended. */
  async run(steps: readonly GuideStep[], options: TourOptions = {}): Promise<TourEnd> {
    this.tour?.destroy();
    this.hideBeacons();
    await this.afterDialogs();
    const createDriver = await this.library.driver();
    if (this.ended) return 'interrupted';
    const returnFocus = this.document.activeElement;
    const reducedMotion = prefersReducedMotion(this.document.defaultView);

    return new Promise<TourEnd>((resolve) => {
      /** Set by whoever ends the tour on purpose, before destroying it. */
      let end: TourEnd | undefined;
      const finish = (how: TourEnd) => {
        end = how;
        tour.destroy();
      };
      const leaving = this.router.events
        .pipe(filter((event) => event instanceof NavigationStart))
        .subscribe(({ url }) => {
          const step = activeStep(tour);
          if (pathOf(url) !== pathOf(this.router.url) && !step?.navigates) finish('interrupted');
        });

      const tour = createDriver({
        // The entry is measured again once the menu has slid in, not halfway
        steps: steps.map((step) => this.toDriveStep(step, options.sideMenu, () => tour.refresh())),
        animate: !reducedMotion,
        smoothScroll: !reducedMotion,
        allowedElements: MATERIAL_OVERLAYS,
        overlayClickBehavior: 'none',
        stagePadding: STAGE_PADDING,
        stageRadius: STAGE_RADIUS,
        popoverClass: POPOVER_CLASS,
        showProgress: steps.length > 1,
        nextBtnText: TEXTS.next,
        prevBtnText: TEXTS.previous,
        doneBtnText: TEXTS.finish,
        closeBtnLabel: options.closeLabel ?? TEXTS.close,
        onPopoverRender: (popover) => {
          const step = activeStep(tour);
          if (step) {
            raiseToTopLayer(popover.wrapper);
            // Over a tall dialog, guide.css moves it out of the way of its buttons
            popover.wrapper.classList.toggle(IN_OVERLAY_CLASS, !!step.inOverlay);
            popover.progress.textContent = this.progressOf(steps, tour.getActiveIndex()!);
            if (!step.inSideMenu) options.sideMenu?.close();
            this.decorate(popover, step, tour.isLastStep(), options, finish, () => tour.moveNext());
          }
        },
        onHighlighted: (element, driveStep) => {
          if (element) dropPopupAttributes(element);
          const step = driveStep.data?.['step'] as GuideStep | undefined;
          const sideMenu = options.sideMenu;
          // driver.js does not notice that Esc or the backdrop closed the menu under its entry
          if (step?.inSideMenu && sideMenu) {
            void sideMenu.closed().then(() => {
              if (activeStep(tour) === step) void sideMenu.open()?.then(() => tour.refresh());
            });
          }
        },
        onDestroyed: (_element, _step, { reason }) => {
          leaving.unsubscribe();
          options.sideMenu?.close();
          this.dropMascot();
          this.tour = undefined;
          const how = end ?? endOf(reason);
          // «Siguiente» starts another tour at once, which takes the focus itself
          if (how !== 'next' && returnFocus instanceof HTMLElement && returnFocus.isConnected) {
            returnFocus.focus();
          }
          resolve(how);
        },
      });
      this.tour = tour;
      tour.drive();
    });
  }

  /** Ends the tour in course, if any, as interrupted. */
  stop(): void {
    this.tour?.destroy();
  }

  /**
   * «Ayuda de esta pantalla»: a beacon by each piece of `beacons` that shows now, the focus on the
   * first one. Esc with no globe open, «Ocultar la ayuda» or leaving the page hides them.
   */
  async showBeacons(beacons: readonly GuideBeacon[]): Promise<void> {
    this.hideBeacons();
    await this.afterDialogs();
    const shown = beacons.flatMap((beacon) => {
      const element = this.find(beacon.anchor);
      return element ? [{ beacon, element }] : [];
    });
    if (shown.length === 0) return;
    const createHints = await this.library.hints();
    if (this.ended) return;
    const onPopoverRender = (popover: PopoverDOM) => {
      popover.closeButton.setAttribute('aria-label', TEXTS.close);
      popover.footerButtons.prepend(
        footerButton(this.document, TEXTS.hideBeacons, () => this.hideBeacons()),
      );
    };
    const hints = createHints({
      hints: shown.map(({ beacon, element }, index) => ({
        id: String(index),
        element,
        popover: { title: beacon.title, description: beacon.text, onPopoverRender },
      })),
      buttonText: TEXTS.gotIt,
      popoverClass: POPOVER_CLASS,
      // At the corner where each piece starts, as it is read: at the end, the beacons of the pieces
      // as wide as the screen piled up on its edge
      beacon: {
        side: 'top',
        align: 'start',
        animate: !prefersReducedMotion(this.document.defaultView),
        className: BEACON_CLASS,
      },
    });
    hints.show();
    // Their name says what they are, not only the name of the piece, which a button may share
    const dots = this.document.querySelectorAll<HTMLElement>(`.${BEACON_CLASS}`);
    dots.forEach((dot, index) =>
      dot.setAttribute('aria-label', TEXTS.beacon(shown[index].beacon.title)),
    );
    dots[0]?.focus();
    // Before driver.js, which closes the open globe with the same key
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !hints.getActive()) this.hideBeacons();
    };
    this.document.addEventListener('keyup', onKey, true);
    this.stopHintKeys = () => this.document.removeEventListener('keyup', onKey, true);
    this.hints = hints;
    this.beaconsShownState.set(true);
  }

  hideBeacons(): void {
    this.stopHintKeys?.();
    this.stopHintKeys = undefined;
    this.hints?.hide();
    this.hints = undefined;
    this.beaconsShownState.set(false);
  }

  /** Once no dialog is open (the help panel itself), which would take the focus back. */
  private async afterDialogs(): Promise<void> {
    if (this.dialogs.openDialogs.length > 0) {
      await firstValueFrom(this.dialogs.afterAllClosed);
    }
  }

  private toDriveStep(
    step: GuideStep,
    sideMenu: GuideSideMenu | undefined,
    refresh: () => void,
  ): DriveStep {
    const anchor = step.anchor;
    const find = anchor ? this.findLater(anchor, !!step.inOverlay) : undefined;
    return {
      // driver.js looks for the piece again whenever the page changes: if Esc closed the side menu,
      // it opens once more
      element:
        find && step.inSideMenu
          ? () => {
              void sideMenu?.open()?.then(refresh);
              return find();
            }
          : find,
      data: { step },
      popover: {
        title: step.title,
        description: step.text,
        side: step.side,
        instruction: step.action,
        // A step with an action goes on when it is done, not with «Siguiente»
        showButtons: step.action ? ['previous', 'close'] : ['next', 'previous', 'close'],
      },
      // Only a click on the piece itself counts: in a menu or a dialog the whole surface is lit
      advanceOn: step.action
        ? { event: 'click', when: (_surface, _step, { event }) => this.pressed(anchor, event) }
        : false,
      // In a dialog, its own focus trap rules: both at once leave the Tab key stuck (7.0a)
      allowPageInteraction: !!step.inOverlay,
      // While a step only explains, its piece cannot take the user somewhere else
      disableActiveInteraction:
        !step.action && !step.inOverlay && !step.interactive && !step.turnOn,
      waitForElement: step.optional ? 0 : WAIT_FOR_PIECE_MS,
      waitForRemovedElement: WAIT_FOR_REMOVED_MS,
      skipMissingElement: !!step.optional,
      // A dialog closed with Esc: back to the step that opens it, as the task is not over
      onElementMissing: step.inOverlay ? 'previousAction' : 'stay',
    };
  }

  /**
   * «Paso 2 de 5», counting the steps that show: an optional one counts only if its piece is here,
   * so the count may grow on the next page, never end before its total.
   */
  private progressOf(steps: readonly GuideStep[], active: number): string {
    const counted = steps.map(
      (step, index) =>
        index === active || !step.optional || (!!step.anchor && !!this.find(step.anchor)),
    );
    const current = counted.slice(0, active + 1).filter(Boolean).length;
    return TEXTS.progress(current, counted.filter(Boolean).length);
  }

  /** The globe of the app: the mascot, «Siguiente: …» on the last one, and a disabled action. */
  private decorate(
    popover: PopoverDOM,
    step: GuideStep,
    last: boolean,
    options: TourOptions,
    finish: (how: TourEnd) => void,
    moveNext: () => void,
  ): void {
    const element = step.anchor ? this.find(step.anchor) : undefined;
    const offSwitch = element?.querySelector<HTMLElement>(SWITCH_OFF);
    if (step.whenDisabled && element && isDisabled(element)) {
      // Not possible yet: it says why and the task ends here, not done
      popover.title.textContent = step.whenDisabled.title;
      popover.description.textContent = step.whenDisabled.text;
      popover.instruction?.remove();
      popover.footerButtons.replaceChildren(
        footerButton(this.document, TEXTS.gotIt, () => finish('closed'), true),
      );
    } else if (step.turnOn && offSwitch) {
      // A switch that shows more choices once on (the voice): the globe offers to turn it on, and
      // goes on once they are drawn, so the next steps find them. «Siguiente» goes on without them.
      popover.nextButton.classList.add('app-guide-secondary');
      popover.footerButtons.append(
        footerButton(
          this.document,
          step.turnOn,
          () => {
            offSwitch.click();
            setTimeout(moveNext, AFTER_SWITCH_MS);
          },
          true,
        ),
      );
    } else if (last && options.next) {
      // «Terminar» stays, as the secondary choice, beside the next first step
      popover.nextButton.classList.add('app-guide-secondary');
      popover.footerButtons.append(
        footerButton(this.document, TEXTS.nextTask(options.next), () => finish('next'), true),
      );
    }
    this.showMascot(popover.title, last ? 'joy' : 'idle');
  }

  private showMascot(title: HTMLElement, mood: MascotMood): void {
    this.dropMascot();
    // A box of its own sets the size: the mascot sets the classes of its own element
    const box = this.document.createElement('span');
    box.className = 'app-guide-mascot';
    const host = this.document.createElement('span');
    box.append(host);
    title.prepend(box);
    const mascot = createComponent(Mascot, {
      environmentInjector: this.injector,
      hostElement: host,
    });
    mascot.setInput('mood', mood);
    this.appRef.attachView(mascot.hostView);
    this.mascot = mascot;
  }

  private dropMascot(): void {
    this.mascot?.destroy();
    this.mascot = undefined;
  }

  /**
   * The piece, looked for each time driver.js needs it: it may come with the next page. Inside a
   * menu or a dialog of Material, the whole menu or dialog, so the globe goes beside it and never
   * covers its other choices (the attempts, 7.0a).
   */
  private findLater(anchor: GuideAnchorId, inOverlay: boolean): () => Element {
    return () => {
      const piece = this.find(anchor);
      const surface = inOverlay ? piece?.closest(MATERIAL_SURFACES) : null;
      // driver.js takes a missing piece as undefined, though its type does not say so
      return (surface ?? piece) as Element;
    };
  }

  /** The click was on an enabled piece with the id: what an action step waits for. */
  private pressed(anchor: GuideAnchorId | undefined, event: Event): boolean {
    const target = event.target instanceof Element ? event.target : null;
    const piece = anchor ? target?.closest(guideAnchorSelector(anchor)) : null;
    return !!piece && !isDisabled(piece);
  }

  /**
   * The first piece with the id that shows: lists mark every item, and some pieces exist at one
   * width only. A mark inside the label of a tab stands for the whole tab, which is what is pressed.
   */
  private find(anchor: GuideAnchorId): HTMLElement | undefined {
    const marked = this.document.querySelectorAll<HTMLElement>(guideAnchorSelector(anchor));
    return [...marked]
      .map((element) => element.closest<HTMLElement>('[role="tab"]') ?? element)
      .find(isShown);
  }
}

function activeStep(tour: Driver): GuideStep | undefined {
  return tour.getActiveStep()?.data?.['step'] as GuideStep | undefined;
}

function endOf(reason: DestroyReason | undefined): TourEnd {
  switch (reason) {
    case 'done':
      return 'done';
    case 'close':
    case 'escape':
    case 'overlay':
      return 'closed';
    default:
      // Replaced by another tour or destroyed from code (leaving the page)
      return 'interrupted';
  }
}

/**
 * Material opens its dialogs and menus in the top layer of the browser (`popover`), over any
 * z-index: a dialog as tall as the screen covered the globe (7.0b1). The globe goes up there too,
 * after them, each time it is drawn. Where the browser has no top layer, as in the tests, it stays.
 */
function raiseToTopLayer(globe: HTMLElement): void {
  if (!('togglePopover' in globe)) return;
  globe.setAttribute('popover', 'manual');
  globe.togglePopover(false);
  globe.togglePopover(true);
}

function isDisabled(element: Element): boolean {
  return element.matches(':disabled, [aria-disabled="true"]');
}

/**
 * Shown at this width, and with a size (an empty save indicator is not); where the browser cannot
 * tell, as in the tests, it is taken as shown.
 */
function isShown(element: HTMLElement): boolean {
  if (!element.checkVisibility) return true;
  const { width, height } = element.getBoundingClientRect();
  return element.checkVisibility({ visibilityProperty: true }) && width > 0 && height > 0;
}

/** Removes what driver.js added (never the piece's own attributes) where its role does not admit it. */
function dropPopupAttributes(element: Element): void {
  const role = element.getAttribute('role');
  const admitted = role ? POPUP_ROLES.has(role) : POPUP_TAGS.has(element.tagName);
  if (admitted || element.getAttribute('aria-controls') !== DRIVER_POPOVER_ID) return;
  for (const name of POPUP_ATTRIBUTES) element.removeAttribute(name);
}

/**
 * A button of our own in the footer of a globe. Never with the classes of the buttons of driver.js,
 * which takes every click on them for its own «Siguiente», «Anterior» or «Cerrar».
 */
function footerButton(
  document: Document,
  label: string,
  onClick: () => void,
  primary = false,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = primary ? 'app-guide-button app-guide-primary' : 'app-guide-button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

/** The path of a URL of the app, without its query nor its fragment. */
function pathOf(url: string): string {
  return url.split(/[?#]/)[0];
}
