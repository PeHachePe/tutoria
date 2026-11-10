import { Component, computed, inject, signal } from '@angular/core';
import { MatAnchor, MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';

import { APP_PATHS } from '../../core/app-paths';
import { LanguageService } from '../../core/language-service';
import { AppLocale, LANGUAGE_OPTIONS } from '../../core/locale';
import { ThemeMode, ThemeService } from '../../core/theme-service';
import type { ReactionKind } from '../../data/tutor';
import { Mascot } from '../../shared/mascot/mascot';
import type { Reaction, ReactionMode } from '../../shared/reactions/reaction';
import { ReactionOverlay } from '../../shared/reactions/reaction-overlay';
import { SettingsStore } from './settings-store';

/** Short labels for the toggle: the heading already says it is the theme. */
const THEME_CHOICES: readonly {
  readonly mode: ThemeMode;
  readonly label: string;
  readonly icon: string;
}[] = [
  { mode: 'light', label: $localize`:@@settings.theme.light:Claro`, icon: 'light_mode' },
  { mode: 'dark', label: $localize`:@@settings.theme.dark:Oscuro`, icon: 'dark_mode' },
  { mode: 'system', label: $localize`:@@settings.theme.system:Sistema`, icon: 'contrast' },
];

const REACTION_CHOICES: readonly {
  readonly mode: ReactionMode;
  readonly label: string;
  readonly hint: string;
}[] = [
  {
    mode: 'full',
    label: $localize`:@@settings.reactions.full:Completas`,
    hint: $localize`:@@settings.reactions.full.hint:Emojis, confeti y efectos de 2 a 3 segundos.`,
  },
  {
    mode: 'reduced',
    label: $localize`:@@settings.reactions.reduced:Reducidas`,
    hint: $localize`:@@settings.reactions.reduced.hint:Solo un emoji pequeño, sin efectos alrededor.`,
  },
  {
    mode: 'off',
    label: $localize`:@@settings.reactions.off:Desactivadas`,
    hint: $localize`:@@settings.reactions.off.hint:El tutor responde sin reacciones.`,
  },
];

/** Cheerful reactions for «Probar», one after another so each try shows a different one. */
const SAMPLE_REACTIONS: readonly ReactionKind[] = [
  'party',
  'hearts',
  'rocket',
  'applause',
  'lightbulb',
];

/** The middle intensity: a try shows what a usual reaction looks like, not the biggest one. */
const SAMPLE_INTENSITY = 2;

/**
 * The student's settings (/alumno/ajustes, ficha 05): appearance, the tutor's reactions, the
 * mascot and the tutor. Each choice applies and is saved at once, so there is no form to submit.
 */
@Component({
  selector: 'app-settings-page',
  imports: [
    MatAnchor,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatIcon,
    MatSlideToggle,
    RouterLink,
    Mascot,
    ReactionOverlay,
  ],
  templateUrl: './settings-page.html',
})
export class SettingsPage {
  protected readonly settings = inject(SettingsStore);
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);

  protected readonly themeChoices = THEME_CHOICES;
  protected readonly themeMode = this.theme.mode;
  protected readonly languageOptions = LANGUAGE_OPTIONS;
  protected readonly locale = this.language.locale;
  protected readonly reactionChoices = REACTION_CHOICES;
  protected readonly reactionHint = computed(
    () => REACTION_CHOICES.find((choice) => choice.mode === this.settings.reactions())?.hint,
  );
  protected readonly dataPath = APP_PATHS.student.data;

  private samples = 0;
  protected readonly sample = signal<Reaction | null>(null);

  protected setTheme(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }

  protected setLocale(locale: AppLocale): void {
    this.language.setLocale(locale);
  }

  protected trySample(): void {
    const kind = SAMPLE_REACTIONS[this.samples++ % SAMPLE_REACTIONS.length];
    this.sample.set({ id: crypto.randomUUID(), kind, intensity: SAMPLE_INTENSITY });
  }
}
