import { inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthStore } from '../../auth/auth-store';
import { APP_PATHS, STUDENT_PARAMS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { ThemeService } from '../../core/theme-service';
import { type AppTool, appTool, ToolError } from '../../core/tools/app-tool';
import { ExerciseService } from '../../data/exercise-service';
import { exerciseText, subjectName } from '../../data/localized-text';
import { TUTOR_TOOL } from '../../data/tutor/tutor-tools';
import { SettingsStore } from '../settings/settings-store';
import { findAssigned, progressSummary, searchAssigned } from './assigned-queries';

/** Every setting a tool can read or change (2.5e), by the names of the contract. */
export interface StudentSettings {
  readonly theme: 'light' | 'dark' | 'system';
  readonly language: 'es' | 'en' | 'ca';
  readonly reactions: 'full' | 'reduced' | 'off';
  readonly animatedEmojis: boolean;
  readonly proactive: boolean;
  readonly mascotHeadset: boolean;
  readonly mascotBowTie: boolean;
  readonly mascotBoneCursor: boolean;
}

/** What `updateSettings` did: the settings it changed and how they were, to undo it. */
export interface SettingsChange {
  readonly changed: Partial<StudentSettings>;
  readonly previous: Partial<StudentSettings>;
}

/**
 * The tools of the student's area (2.5e), provided by its route: the queries of their exercises and
 * settings, opening an exercise, going to another page and changing the settings. Open to WebMCP as
 * the contract says; none of them touches the code (D-047).
 */
export function studentTools(): AppTool[] {
  const exercises = inject(ExerciseService);
  const userId = inject(AuthStore).userId;
  const locale = inject(LanguageService).locale;
  const router = inject(Router);
  const settings = studentSettings();

  const assigned = () => {
    const id = userId();
    if (!id) throw new ToolError('The student is not signed in');
    return exercises.listAssigned(id);
  };

  return [
    appTool(TUTOR_TOOL.getMyProgress, async ({ subject }) =>
      progressSummary(await assigned(), locale, subject),
    ),
    appTool(TUTOR_TOOL.searchExercises, async (filters) => ({
      exercises: searchAssigned(await assigned(), filters, locale),
    })),
    appTool(TUTOR_TOOL.getSettings, () => settings.read()),
    appTool(TUTOR_TOOL.openExercise, async ({ exercise, attempt }) => {
      const entry = findAssigned(await assigned(), exercise, locale);
      if (!entry) throw new ToolError(`No assigned exercise matches «${exercise}»`);
      await router.navigate([APP_PATHS.student.exercise(entry.assignmentId)], {
        queryParams: attempt ? { [STUDENT_PARAMS.attempt]: attempt } : {},
      });
      return { opened: exerciseText(entry.exercise, locale).title };
    }),
    appTool(TUTOR_TOOL.navigate, async ({ to, subject }) => {
      if (to !== 'catalog') {
        await router.navigateByUrl(
          to === 'settings' ? APP_PATHS.student.settings : APP_PATHS.student.data,
        );
        return { opened: to };
      }
      const group = subject ? await groupOf(subject) : undefined;
      await router.navigate([APP_PATHS.student.catalog], {
        queryParams: group ? { [STUDENT_PARAMS.group]: group } : {},
      });
      return { opened: to };
    }),
    appTool(TUTOR_TOOL.updateSettings, (changes) => settings.apply(changes)),
  ];

  /** The group of the subject named, for the tab of the catalog. */
  async function groupOf(subject: string): Promise<string> {
    const wanted = subject.toLocaleLowerCase(locale);
    const entry = (await assigned()).find((each) =>
      subjectName(each.group.subject, locale).name.toLocaleLowerCase(locale).includes(wanted),
    );
    if (!entry) throw new ToolError(`The student has no subject called «${subject}»`);
    return entry.group.id;
  }
}

/**
 * Reads and changes the settings of the student by the names of the contract: the colour mode
 * (ThemeService), the language (LanguageService, which reloads the page) and the rest (SettingsStore).
 */
export function studentSettings() {
  const theme = inject(ThemeService);
  const language = inject(LanguageService);
  const store = inject(SettingsStore);

  const read = (): StudentSettings => ({
    theme: theme.mode(),
    language: language.locale,
    reactions: store.reactions(),
    animatedEmojis: store.reactionEmojis(),
    proactive: store.proactive(),
    mascotHeadset: store.mascotHeadset(),
    mascotBowTie: store.mascotBowTie(),
    mascotBoneCursor: store.mascotBoneCursor(),
  });

  const setters: { [Key in keyof StudentSettings]: (value: StudentSettings[Key]) => void } = {
    theme: (mode) => theme.setMode(mode),
    language: (locale) => language.setLocale(locale),
    reactions: (mode) => store.setReactions(mode),
    animatedEmojis: (on) => store.setReactionEmojis(on),
    proactive: (on) => store.setProactive(on),
    mascotHeadset: (on) => store.setMascotHeadset(on),
    mascotBowTie: (on) => store.setMascotBowTie(on),
    mascotBoneCursor: (on) => store.setMascotBoneCursor(on),
  };

  /** Changes what differs; the language last, because it reloads the page. */
  const apply = (changes: Partial<StudentSettings>): SettingsChange => {
    const before = read();
    const keys = (Object.keys(changes) as (keyof StudentSettings)[])
      .filter((key) => changes[key] !== undefined && changes[key] !== before[key])
      .sort((a, b) => Number(a === 'language') - Number(b === 'language'));
    const changed: Record<string, unknown> = {};
    const previous: Record<string, unknown> = {};
    for (const key of keys) {
      changed[key] = changes[key];
      previous[key] = before[key];
      (setters[key] as (value: unknown) => void)(changes[key]);
    }
    return { changed, previous } as SettingsChange;
  };

  return { read, apply };
}
