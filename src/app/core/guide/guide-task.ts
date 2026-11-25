import type { EnvironmentInjector } from '@angular/core';

import type { GuideAnchorId } from './guide-anchor';

/**
 * The guided help as data (2.12, D-080): the tasks, the welcome and the beacons of each profile are
 * plain objects, not the configuration of a library, so TourRunner is the only piece that knows
 * driver.js. The texts are already translated with `$localize`.
 */

/** Where the globe goes beside its piece; by default, where it fits. */
export type GuideSide = 'top' | 'right' | 'bottom' | 'left';

/** A screen of the app, to put first the tasks of the open one and to know its beacons. */
export type GuideScreen =
  // The student
  | 'catalog'
  | 'workspace'
  | 'settings'
  | 'registered-data'
  // The teacher, and the administration in the teacher's screens
  | 'live'
  | 'attempt'
  | 'exercise-bank'
  | 'exercise-form'
  | 'blocks'
  | 'groups'
  | 'history'
  // The administration
  | 'users'
  | 'system';

/**
 * Something the data says about the user, such as having submitted an exercise: it marks a task as
 * done, or makes it possible.
 */
export type GuideFact =
  // The student
  | 'started'
  | 'ran'
  | 'askedHint'
  | 'submitted'
  | 'hasOpenExercise'
  | 'hasSeveralSubjects'
  // The teacher, counting only what is theirs (D-093)
  | 'hasClass'
  | 'hasStudents'
  | 'hasBlock'
  | 'hasOwnExercise'
  | 'hasAssignment';

/**
 * Where a task starts: a fixed page or one the data gives (the next exercise, one already
 * submitted).
 */
export type GuidePlace =
  // The student
  | 'catalog'
  | 'settings'
  | 'registeredData'
  | 'openExercise'
  | 'submittedExercise'
  | 'exerciseWithAttempts'
  // The teacher
  | 'live'
  | 'attempt'
  | 'exercises'
  | 'newExercise'
  | 'blocks'
  | 'groups'
  | 'history'
  // The administration
  | 'users'
  | 'system';

/** One step of a tour: a piece of the screen with its globe, or the globe alone in the middle. */
export interface GuideStep {
  /** The piece it explains; without one, the globe shows in the middle of the screen. */
  readonly anchor?: GuideAnchorId;
  readonly title: string;
  readonly text: string;
  readonly side?: GuideSide;
  /**
   * What the user has to do on the piece to go on: the globe says it («Pulsa «Entregar»») and the
   * tour goes on by itself once it is done.
   */
  readonly action?: string;
  /** The action opens another page: that navigation does not end the tour. */
  readonly navigates?: boolean;
  /**
   * Only where its piece shows, such as the tabs of the workspace on phones: skipped elsewhere
   * instead of ending the tour.
   */
  readonly optional?: boolean;
  /**
   * The piece is in a dialog or a menu of Material, which keeps the focus (7.0a, ficha 13): the
   * whole dialog or menu is lit, and only the piece itself does the action.
   */
  readonly inOverlay?: boolean;
  /**
   * The action is the button that saves a dialog («Crear», «Matricular»): the tour goes on when the
   * dialog closes saving, not with the click, which may find an error and leave it open (7.0b2).
   * Closed without saving, the tour goes back to the step that opened it, as any dialog.
   */
  readonly savesDialog?: boolean;
  /**
   * The piece is an entry of the side menu of the staff, which is closed on phones: the tour opens
   * it first, and again if it closes in the middle (D-094).
   */
  readonly inSideMenu?: boolean;
  /** The piece can be used while it is explained, without waiting for it: a switch to try. */
  readonly interactive?: boolean;
  /**
   * The piece holds a switch that, once on, shows more choices (the voice): while it is off, the
   * globe offers this button, which turns it on and goes on to them.
   */
  readonly turnOn?: string;
  /**
   * If the piece is disabled, the globe explains why with this text and the tour ends there, not
   * done: «Entregar» before passing every test.
   */
  readonly whenDisabled?: { readonly title: string; readonly text: string };
}

/** A guided task: what the user learns by doing it on the real screens, with their own data. */
export interface GuideTask {
  /** Stable and in English: it is saved in `user_guide_state` and must never change. */
  readonly id: string;
  readonly title: string;
  /** What it achieves, in one line. */
  readonly summary: string;
  /** Other words to find it with the filter of the panel. */
  readonly keywords: readonly string[];
  /** Where it happens, to list first the tasks of the open screen. */
  readonly screen: GuideScreen;
  /**
   * Where it starts: the tour goes there first unless the user is already in one of its pages.
   * Without one, where the user is (a task that opens the user menu).
   */
  readonly place?: GuidePlace;
  readonly steps: readonly GuideStep[];
  /** Done according to the data, besides having finished its tour. */
  readonly doneBy?: GuideFact;
  /** Possible only with this fact, or with a page for its place; otherwise the panel says why. */
  readonly needs?: GuideFact;
  /** Why it is not possible yet: «Cuando hayas entregado un ejercicio». */
  readonly unavailable?: string;
  /** The tour of every piece of this screen («Recorrer esta pantalla»), made of its beacons. */
  readonly tourOf?: GuideScreen;
}

/** The welcome of an area: a short tour the first time, shown again only if its version goes up. */
export interface GuideWelcome {
  readonly version: number;
  readonly screen: GuideScreen;
  readonly place: GuidePlace;
  readonly steps: readonly GuideStep[];
  /** What it waits for besides its screen, read as a signal: the data notice, for the student. */
  readonly when?: () => boolean;
}

/** A beacon of «Ayuda de esta pantalla»: a dot by a piece that opens its explanation. */
export interface GuideBeacon {
  /** Without one, a piece of the bars, on every screen of the area. */
  readonly screen?: GuideScreen;
  readonly anchor: GuideAnchorId;
  readonly title: string;
  readonly text: string;
  /** In the tour of the screen, the button that turns on its switch (GuideStep.turnOn). */
  readonly turnOn?: string;
  /** An entry of the side menu of the staff: its step in the tour opens it (GuideStep.inSideMenu). */
  readonly inSideMenu?: boolean;
}

/** What the data says about the user, read again when the panel opens and after each task. */
export interface GuideFacts {
  readonly known: ReadonlySet<GuideFact>;
  /** The pages where each place is, the one to go first; a place without pages is not possible. */
  readonly places: Readonly<Partial<Record<GuidePlace, readonly string[]>>>;
}

/** The side menu of the staff, for the steps that point at its entries (D-094). */
export interface GuideSideMenu {
  /**
   * Opens it where it slides over the content, resolving once its animation ends; nothing to wait
   * for when it is open already, or docked.
   */
  readonly open: () => Promise<unknown> | undefined;
  /** Closes it where it slides over the content, once the tour leaves it. */
  readonly close: () => void;
  /** Resolves the next time it closes over the content: with Esc, its backdrop or an entry. */
  readonly closed: () => Promise<unknown>;
}

/** Who a profile is for: what is saved does not depend on it, only the facts read again. */
export type GuideProfileId = 'student' | 'teacher' | 'admin';

/** The guided help of an area, given to GuideStore by its layout. */
export interface GuideProfile {
  readonly id: GuideProfileId;
  readonly tasks: readonly GuideTask[];
  /**
   * The ids of its first steps, in their order (D-093): a task can be a first step of two profiles,
   * in another order, and is done once.
   */
  readonly firstSteps: readonly string[];
  readonly welcome: GuideWelcome;
  readonly beacons: readonly GuideBeacon[];
  /** The screen a URL belongs to, if it has guided help. */
  readonly screenOf: (url: string) => GuideScreen | undefined;
  readonly loadFacts: () => Promise<GuideFacts>;
  /** The side menu of its layout, if it has one. */
  readonly sideMenu?: GuideSideMenu;
  /**
   * The injector of the routes of its area, for the mascot of the globes to wear what the area
   * provides: the accessories the student chose (7.0b2).
   */
  readonly injector?: EnvironmentInjector;
}
