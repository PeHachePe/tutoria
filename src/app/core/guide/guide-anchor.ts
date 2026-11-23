import { Directive, input } from '@angular/core';

/**
 * The pieces the guided help points at (2.12), one id per piece. Each one is marked in its template
 * with GuideAnchor, never found by a style class or a `data-testid`, so moving or restyling a piece
 * keeps its help.
 */
export const GUIDE_ANCHORS = {
  // Bars of every area
  brand: 'brand',
  navExercises: 'nav-exercises',
  help: 'help',
  themeMenu: 'theme-menu',
  languageMenu: 'language-menu',
  userMenu: 'user-menu',
  menuSettings: 'menu-settings',
  menuRegisteredData: 'menu-registered-data',
  menuSignOut: 'menu-sign-out',
  // Catalog
  catalogNextCard: 'catalog-next-card',
  catalogNext: 'catalog-next',
  catalogDone: 'catalog-done',
  catalogSubjects: 'catalog-subjects',
  catalogProgress: 'catalog-progress',
  catalogCounts: 'catalog-counts',
  catalogBlock: 'catalog-block',
  catalogMarker: 'catalog-marker',
  catalogDifficulty: 'catalog-difficulty',
  catalogStatus: 'catalog-status',
  catalogDue: 'catalog-due',
  catalogReady: 'catalog-ready',
  catalogHints: 'catalog-hints',
  catalogRepetitions: 'catalog-repetitions',
  catalogExercise: 'catalog-exercise',
  // Workspace
  workspaceBack: 'workspace-back',
  workspacePlace: 'workspace-place',
  workspaceDifficulty: 'workspace-difficulty',
  workspaceStatus: 'workspace-status',
  attemptMenu: 'attempt-menu',
  attemptChoices: 'attempt-choices',
  workspaceTabCode: 'workspace-tab-code',
  workspaceTabTutor: 'workspace-tab-tutor',
  statement: 'statement',
  statementToggle: 'statement-toggle',
  statementExamples: 'statement-examples',
  statementSplitter: 'statement-splitter',
  codeSplitter: 'code-splitter',
  editor: 'editor',
  formatCode: 'format-code',
  expandCode: 'expand-code',
  saveIndicator: 'save-indicator',
  runTests: 'run-tests',
  runResults: 'run-results',
  resultsAskTutor: 'results-ask-tutor',
  submit: 'submit',
  submitDialog: 'submit-dialog',
  submittedNote: 'submitted-note',
  practiseAgain: 'practise-again',
  practiceNote: 'practice-note',
  nextExercise: 'next-exercise',
  // Tutor
  tutorToggle: 'tutor-toggle',
  hint: 'hint',
  hintLevel: 'hint-level',
  tutorCall: 'tutor-call',
  tutorDock: 'tutor-dock',
  tutorMinimize: 'tutor-minimize',
  tutorConversation: 'tutor-conversation',
  tutorSuggestions: 'tutor-suggestions',
  tutorListen: 'tutor-listen',
  tutorQuestion: 'tutor-question',
  tutorDictate: 'tutor-dictate',
  tutorSend: 'tutor-send',
  // Settings
  settingsTheme: 'settings-theme',
  settingsLanguage: 'settings-language',
  settingsMascot: 'settings-mascot',
  settingsReactions: 'settings-reactions',
  settingsEmojis: 'settings-emojis',
  settingsTryReaction: 'settings-try-reaction',
  settingsProactive: 'settings-proactive',
  settingsVoice: 'settings-voice',
  settingsTutorVoice: 'settings-tutor-voice',
  settingsSpeechRate: 'settings-speech-rate',
  settingsReadAloud: 'settings-read-aloud',
  settingsInterrupt: 'settings-interrupt',
  settingsRecognition: 'settings-recognition',
  settingsPrivacy: 'settings-privacy',
  // Registered data
  dataRecorded: 'data-recorded',
  dataNever: 'data-never',
  dataPurpose: 'data-purpose',
  dataViewers: 'data-viewers',
  dataServices: 'data-services',
  dataChoices: 'data-choices',
} as const;

export type GuideAnchorId = (typeof GUIDE_ANCHORS)[keyof typeof GUIDE_ANCHORS];

/** The attribute that carries the id in the page, for TourRunner to find the piece. */
export const GUIDE_ANCHOR_ATTRIBUTE = 'data-guide';

/** CSS selector of the pieces marked with an id. */
export function guideAnchorSelector(anchor: GuideAnchorId): string {
  return `[${GUIDE_ANCHOR_ATTRIBUTE}="${anchor}"]`;
}

/**
 * Marks a piece the guided help can point at: `[appGuideAnchor]="anchors.runTests"`. With null,
 * the element is not marked (only the first of a list, for example).
 */
@Directive({
  selector: '[appGuideAnchor]',
  host: { '[attr.data-guide]': 'appGuideAnchor()' },
})
export class GuideAnchor {
  readonly appGuideAnchor = input.required<GuideAnchorId | null>();
}
