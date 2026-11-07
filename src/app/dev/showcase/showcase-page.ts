import { Component, inject, signal } from '@angular/core';
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
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
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
import type { Difficulty } from '../../data/exercise';
import { DifficultyChip } from '../../shared/difficulty-chip/difficulty-chip';
import { LanguageMenu } from '../../shared/language-menu/language-menu';
import { Mascot, MascotMood } from '../../shared/mascot/mascot';
import { StatusChip } from '../../shared/status-chip/status-chip';
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
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatProgressBar,
    MatProgressSpinner,
    MatSlideToggle,
    ShowcaseForm,
    ShowcaseTable,
    StatusChip,
    DifficultyChip,
    LanguageMenu,
    Mascot,
  ],
  templateUrl: './showcase-page.html',
})
export class ShowcasePage {
  protected readonly theme = inject(ThemeService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

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

  protected readonly dialogResult = signal<string | undefined>(undefined);

  protected async openDialog(): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open(ShowcaseDialog).afterClosed());
    this.dialogResult.set(confirmed ? 'Ejercicio entregado' : 'Entrega cancelada');
  }

  protected showSnackBar(): void {
    this.snackBar.open('Código guardado', 'Cerrar', { duration: 4000 });
  }
}
