import { Component, computed, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import {
  MatCard,
  MatCardActions,
  MatCardContent,
  MatCardHeader,
  MatCardSubtitle,
  MatCardTitle,
} from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { MatToolbar } from '@angular/material/toolbar';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { ThemeMode, ThemeService } from '../../core/theme-service';
import type { AttemptStatus } from '../../data/attempt';
import { DataError } from '../../data/data-error';
import type { Difficulty } from '../../data/exercise';
import type { Intensity, ReactionKind } from '../../data/tutor';
import type { RunResult } from '../../data/attempt';
import { Splitter } from '../../shared/splitter/splitter';
import type { SaveStatus } from '../../student/workspace/attempt-store';
import { RunResults } from '../../student/workspace/code-zone/run-results';
import { SaveIndicator } from '../../student/workspace/code-zone/save-indicator';
import { Brand } from '../../shared/brand/brand';
import { CodeEditor } from '../../shared/code-editor/code-editor';
import { DifficultyChip } from '../../shared/difficulty-chip/difficulty-chip';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LanguageMenu } from '../../shared/language-menu/language-menu';
import { LoadError } from '../../shared/load-error/load-error';
import { Mascot, MascotMood } from '../../shared/mascot/mascot';
import type { Reaction, ReactionMode } from '../../shared/reactions/reaction';
import { ReactionOverlay } from '../../shared/reactions/reaction-overlay';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { StatusChip } from '../../shared/status-chip/status-chip';
import { SettingsStore } from '../../student/settings/settings-store';
import { ShowcaseDialog } from './showcase-dialog';
import { ShowcaseForm } from './showcase-form';
import { ShowcaseTable } from './showcase-table';

/** Development-only page (/dev/ui) with the Material components and Tailwind pieces the app uses. */
@Component({
  selector: 'app-showcase-page',
  imports: [
    MatToolbar,
    MatButton,
    MatIconButton,
    MatIcon,
    MatTooltip,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatButtonToggleGroup,
    MatButtonToggle,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardSubtitle,
    MatCardContent,
    MatCardActions,
    MatTabGroup,
    MatTab,
    MatProgressBar,
    MatProgressSpinner,
    MatSlideToggle,
    ShowcaseForm,
    ShowcaseTable,
    StatusChip,
    DifficultyChip,
    Brand,
    LanguageMenu,
    Mascot,
    ReactionOverlay,
    EmptyState,
    LoadError,
    LoadingSkeleton,
    Skeleton,
    CodeEditor,
    SaveIndicator,
    RunResults,
    Splitter,
  ],
  templateUrl: './showcase-page.html',
})
export class ShowcasePage {
  protected readonly theme = inject(ThemeService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly settings = inject(SettingsStore);

  protected readonly modes: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'light', label: 'Claro', icon: 'light_mode' },
    { value: 'dark', label: 'Oscuro', icon: 'dark_mode' },
    { value: 'system', label: 'Sistema', icon: 'contrast' },
  ];

  protected readonly colorRoles = [
    { name: 'primary', classes: 'bg-primary text-on-primary' },
    { name: 'primary-container', classes: 'bg-primary-container text-on-primary-container' },
    { name: 'secondary', classes: 'bg-secondary text-on-secondary' },
    { name: 'secondary-container', classes: 'bg-secondary-container text-on-secondary-container' },
    { name: 'tertiary', classes: 'bg-tertiary text-on-tertiary' },
    { name: 'tertiary-container', classes: 'bg-tertiary-container text-on-tertiary-container' },
    { name: 'error', classes: 'bg-error text-on-error' },
    { name: 'error-container', classes: 'bg-error-container text-on-error-container' },
    { name: 'success', classes: 'bg-success text-on-success' },
    { name: 'success-container', classes: 'bg-success-container text-on-success-container' },
    { name: 'warning', classes: 'bg-warning text-on-warning' },
    { name: 'warning-container', classes: 'bg-warning-container text-on-warning-container' },
    { name: 'info', classes: 'bg-info text-on-info' },
    { name: 'info-container', classes: 'bg-info-container text-on-info-container' },
    { name: 'canvas', classes: 'bg-canvas text-on-surface border border-outline-variant' },
    { name: 'panel', classes: 'bg-panel text-on-surface border border-outline-variant' },
  ];

  protected readonly typeScale = [
    { name: 'headline-medium', classes: 'text-headline-medium' },
    { name: 'headline-small', classes: 'text-headline-small' },
    { name: 'title-large', classes: 'text-title-large' },
    { name: 'title-medium', classes: 'text-title-medium' },
    { name: 'body-large', classes: 'text-body-large' },
    { name: 'body-medium', classes: 'text-body-medium' },
    { name: 'body-small', classes: 'text-body-small text-on-surface-variant' },
    { name: 'label-large', classes: 'text-label-large' },
    { name: 'eyebrow', classes: 'eyebrow' },
  ];

  /** Lines of the scroll-shadows example: more than its height, so it scrolls. */
  protected readonly scrollLines = [1, 2, 3, 4, 5, 6, 7, 8];
  protected readonly sampleCode = [
    '// Suma de los elementos de un vector',
    'function suma(vector) {',
    '  let total = 0;',
    '  for (const n of vector) {',
    '    total += n; // acumulador',
    '  }',
    '  return total;',
    '}',
    '',
    "const vacio = suma([]) === 0 ? 'sí' : 'no';",
  ].join('\n');
  protected readonly saveStatuses: readonly SaveStatus[] = ['saving', 'saved', 'error'];

  /** The results panel of the workspace (step 1.5) in its cases, with exercise 3. */
  protected readonly runSamples: readonly { title: string; result: RunResult }[] = [
    {
      title: 'Con fallos: valor, error y tiempo agotado',
      result: {
        status: 'tests_failed',
        results: [
          {
            testId: 's1',
            passed: true,
            timeout: false,
            input: [[1, 2, 3]],
            expected: 6,
            actual: 6,
          },
          { testId: 's2', passed: false, timeout: false, input: [[]], expected: 0, actual: NaN },
          {
            testId: 's3',
            passed: false,
            timeout: false,
            input: [[5]],
            expected: 5,
            error: "TypeError: Cannot read properties of undefined (reading 'length')",
          },
          { testId: 's4', passed: false, timeout: true, input: [[-2, 2, 10]], expected: 10 },
          { testId: 's5', passed: false, timeout: true },
        ],
      },
    },
    {
      title: 'Todas superadas',
      result: {
        status: 'passed',
        results: [
          {
            testId: 'p1',
            passed: true,
            timeout: false,
            input: [[1, 2, 3]],
            expected: 6,
            actual: 6,
          },
          { testId: 'p2', passed: true, timeout: false, input: [[]], expected: 0, actual: 0 },
          { testId: 'p3', passed: true, timeout: false },
        ],
      },
    },
    {
      title: 'Sin la función',
      result: {
        status: 'tests_failed',
        results: [{ testId: 'm1', passed: false, timeout: false }],
        loadError: { kind: 'missing_function' },
      },
    },
  ];

  protected readonly splitShare = signal(45);

  protected readonly statuses: readonly AttemptStatus[] = [
    'not_started',
    'in_progress',
    'tests_failed',
    'passed',
    'submitted',
  ];
  protected readonly difficulties: readonly Difficulty[] = [
    'initial',
    'medium',
    'advanced',
    'extension',
  ];

  protected readonly mascotMoods: { value: MascotMood; label: string }[] = [
    { value: 'idle', label: 'Reposo' },
    { value: 'chat', label: 'Chat abierto' },
    { value: 'thinking', label: 'Pensando' },
    { value: 'joy', label: 'Alegría' },
  ];
  protected readonly mascotMood = signal<MascotMood>('idle');
  protected readonly mascotHeadset = signal(true);
  protected readonly mascotBowTie = signal(false);

  protected readonly reactionKinds: { value: ReactionKind; label: string; icon: string }[] = [
    { value: 'hearts', label: 'Corazones', icon: 'favorite' },
    { value: 'cheer', label: 'Ánimo', icon: 'thumb_up' },
    { value: 'trophy', label: 'Trofeo', icon: 'trophy' },
    { value: 'lightbulb', label: 'Bombilla', icon: 'lightbulb' },
    { value: 'rocket', label: 'Cohete', icon: 'rocket_launch' },
    { value: 'fire', label: 'Fuego', icon: 'local_fire_department' },
    { value: 'applause', label: 'Aplausos', icon: 'cheer' },
    { value: 'mind-blown', label: 'Mente explotando', icon: 'psychology' },
    { value: 'paper-ball', label: 'Bola de papel', icon: 'sports_baseball' },
    { value: 'eyes', label: 'Ojos vigilantes', icon: 'visibility' },
    { value: 'laugh', label: 'Risas', icon: 'sentiment_excited' },
    { value: 'grumpy', label: 'Enfado de broma', icon: 'sentiment_frustrated' },
  ];
  protected readonly intensities: Intensity[] = [1, 2, 3];
  protected readonly reactionModes: { value: ReactionMode; label: string }[] = [
    { value: 'full', label: 'Completas' },
    { value: 'reduced', label: 'Reducidas' },
    { value: 'off', label: 'Desactivadas' },
  ];
  protected readonly reactionIntensity = signal<Intensity>(2);
  /** Each button plays a new reaction, even the same emotion again. */
  protected readonly reaction = signal<Reaction | null>(null);
  protected readonly mascotReaction = computed(() =>
    this.settings.reactions() === 'off' ? null : this.reaction(),
  );

  protected react(kind: ReactionKind): void {
    this.reaction.set({ id: crypto.randomUUID(), kind, intensity: this.reactionIntensity() });
  }

  protected readonly dialogResult = signal<string | undefined>(undefined);

  protected async openDialog(): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open(ShowcaseDialog).afterClosed());
    this.dialogResult.set(confirmed ? 'Ejercicio entregado' : 'Entrega cancelada');
  }

  /** Changing the key creates the loading skeleton again, to replay its wait. */
  protected readonly loadingKey = signal(0);
  protected readonly sampleError = new DataError('network');
  protected readonly retries = signal(0);

  protected replayLoading(): void {
    this.loadingKey.update((key) => key + 1);
  }

  protected showSnackBar(): void {
    this.snackBar.open('Código guardado', 'Cerrar', { duration: 4000 });
  }
}
