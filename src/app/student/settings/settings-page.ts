import { Component, computed, inject, signal } from '@angular/core';
import { MatAnchor, MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';

import { APP_PATHS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { AppLocale, LANGUAGE_OPTIONS } from '../../core/i18n/locale';
import { LOCALE_NAMES } from '../../core/i18n/locale-names';
import type { SpeechRate, SpeechVoice } from '../../core/speech/speech-service';
import { isNoveltyVoice } from '../../core/speech/voice-quality';
import { ThemeMode, ThemeService } from '../../core/theme-service';
import type { Intensity, ReactionKind } from '../../data/tutor';
import { Mascot } from '../../shared/mascot/mascot';
import type { Reaction, ReactionMode } from '../../shared/reactions/reaction';
import { ReactionOverlay } from '../../shared/reactions/reaction-overlay';
import { SettingsStore } from './settings-store';
import { StudentVoice } from './student-voice';

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

const RATE_CHOICES: readonly { readonly rate: SpeechRate; readonly label: string }[] = [
  { rate: 'slow', label: $localize`:@@settings.voice.rate.slow:Lenta` },
  { rate: 'normal', label: $localize`:@@settings.voice.rate.normal:Normal` },
  { rate: 'fast', label: $localize`:@@settings.voice.rate.fast:Rápida` },
];

/**
 * The region of a voice («España» for `es-ES`), to tell apart voices with the same name; none when
 * its name already says it, as Chrome's do («Eddy (español (España))»).
 */
export function voiceRegion(voice: SpeechVoice, locale: AppLocale): string | undefined {
  const region = voice.lang.split('-')[1];
  if (!region || !/^[A-Za-z]{2}$/.test(region)) return undefined;
  const name = new Intl.DisplayNames(locale, { type: 'region' }).of(region.toUpperCase());
  return name && !voice.name.includes(name) ? name : undefined;
}

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

/** From the smallest to the biggest: the tutor picks one for each answer, so the tries show them all. */
const SAMPLE_INTENSITIES: readonly Intensity[] = [1, 2, 3];

/** What the n-th try (from 0) plays: each one another reaction and the next intensity. */
export function sampleReaction(tryIndex: number): Omit<Reaction, 'id'> {
  return {
    kind: SAMPLE_REACTIONS[tryIndex % SAMPLE_REACTIONS.length],
    intensity: SAMPLE_INTENSITIES[tryIndex % SAMPLE_INTENSITIES.length],
  };
}

/**
 * The student's settings (/alumno/ajustes, ficha 05): appearance, the tutor's reactions, the
 * mascot and the tutor, with its voice (2.11). Each choice applies and is saved at once, so there is no form to submit.
 */
@Component({
  selector: 'app-settings-page',
  imports: [
    MatAnchor,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatIcon,
    MatIconButton,
    MatRadioButton,
    MatRadioGroup,
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
  protected readonly voice = inject(StudentVoice);

  protected readonly themeChoices = THEME_CHOICES;
  protected readonly themeMode = this.theme.mode;
  protected readonly languageOptions = LANGUAGE_OPTIONS;
  protected readonly locale = this.language.locale;
  protected readonly reactionChoices = REACTION_CHOICES;
  protected readonly reactionHint = computed(
    () => REACTION_CHOICES.find((choice) => choice.mode === this.settings.reactions())?.hint,
  );
  protected readonly dataPath = APP_PATHS.student.data;
  protected readonly rateChoices = RATE_CHOICES;
  protected readonly localeName = LOCALE_NAMES[this.locale];
  /** The robotic and joke voices of macOS, hidden until asked for, unless it is the tutor's. */
  protected readonly showAllVoices = signal(false);
  private readonly shownVoices = computed(() =>
    this.voice
      .voices()
      .filter(
        (voice) =>
          this.showAllVoices() ||
          !isNoveltyVoice(voice) ||
          voice.id === this.voice.tutorVoice()?.id,
      ),
  );
  protected readonly hiddenVoices = computed(
    () => this.voice.voices().length - this.shownVoices().length,
  );
  protected readonly voiceOptions = computed(() =>
    this.shownVoices().map((voice) => ({
      ...voice,
      region: voiceRegion(voice, this.locale),
      tryLabel: $localize`:@@settings.voice.tryLabel:Probar la voz ${voice.name}:nombre:`,
    })),
  );

  private samples = 0;
  protected readonly sample = signal<Reaction | null>(null);

  protected setTheme(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }

  protected setLocale(locale: AppLocale): void {
    this.language.setLocale(locale);
  }

  protected setVoice(on: boolean): void {
    // Silenced first: without the voice, the speech is unloaded
    if (!on) this.voice.stop();
    this.settings.setVoice(on);
  }

  protected chooseVoice(id: string): void {
    this.settings.setTutorVoice(id);
    void this.voice.sample(id);
  }

  protected tryVoice(id: string): void {
    void this.voice.sample(id);
  }

  protected trySample(): void {
    this.sample.set({ id: crypto.randomUUID(), ...sampleReaction(this.samples++) });
  }
}
