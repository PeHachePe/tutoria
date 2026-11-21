import { LiveAnnouncer } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, inject, resource, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatChip, MatChipRemove, MatChipSet } from '@angular/material/chips';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatHint, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatTab, MatTabGroup } from '@angular/material/tabs';

import {
  type ClassCandidate,
  MAX_PASTED_LINES,
  MIN_STUDENT_SEARCH_LENGTH,
  type StudentMatch,
  type UserRef,
} from '../../data/group-service';
import { createDebouncer } from '../../shared/create-debouncer';
import { searchable } from '../../shared/searchable';
import { type CandidateSection, candidateSections } from '../../shared/class-outcome';
import { addToChoice, blockerLine, enrollBlocker, sortOutCandidates } from './enroll-choice';
import { groupActionMessage } from './group-action-message';

/** How long the search waits after the last key before asking the server. */
export const SEARCH_DELAY_MS = 300;

/** Another class of the user, whose students can be taken at once. */
export interface EnrollSource {
  readonly id: string;
  readonly label: string;
}

export interface EnrollDialogData {
  /** The class, or one group of it: «1.º DAW A · 2026/27». */
  readonly targetName: string;
  /** What enrolling there does, under the title. */
  readonly intro: string;
  /** Who is there already: not chosen again. */
  readonly enrolledIds: ReadonlySet<string>;
  /**
   * The year of the class, where a student of another class of that year is not enrolled (5.2g);
   * null for one group, which a student of any class may take.
   */
  readonly schoolYear: string | null;
  /** The other classes of the user, such as last year's. */
  readonly sources: readonly EnrollSource[];
  /** The active students of one of them, with their last class up to the year of this one (5.2g). */
  readonly studentsOf: (classId: string) => Promise<readonly ClassCandidate[]>;
  /**
   * Those to choose from with one click: for a class, the active students without a class this
   * year; for one group, those of its class who are not in it.
   */
  readonly candidates: EnrollCandidates;
  /** Active students who are not there yet, with where they come from (5.2g). */
  readonly search: (text: string) => Promise<readonly ClassCandidate[]>;
  /** The students a pasted list names. */
  readonly match: (entries: readonly string[]) => Promise<StudentMatch[]>;
  /** Enrolls them; the dialog stays open, with the error, if it fails. */
  readonly enroll: (students: readonly UserRef[]) => Promise<void>;
}

/**
 * The first tab: its name, what it says without anybody, and who it lists, with where each comes
 * from (5.2g): when any comes from a class, they are listed by it, each class with its checkbox.
 */
export interface EnrollCandidates {
  readonly label: string;
  readonly empty: string;
  readonly load: () => Promise<readonly ClassCandidate[]>;
}

/** What a pasted list gave: how many it added and the lines that named nobody. */
interface PastedResult {
  readonly added: number;
  readonly unmatched: readonly string[];
  /** «Andrea Peña Iglesias · Baja · 2.º DAM B · 2026/27»: who finished, left out (5.2g). */
  readonly skipped: readonly string[];
}

/**
 * Chooses many students at once and enrolls them (RF-16; 5.2d, D-081): those without a class this
 * year, all with one click; a pasted list of emails or names, as secretaría gives it; the students
 * of another class; or a search by name or email. The accounts are created by the administration
 * (5.1b): here they are only found.
 */
@Component({
  selector: 'app-enroll-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatCheckbox,
    MatChipSet,
    MatChip,
    MatChipRemove,
    MatFormField,
    MatLabel,
    MatHint,
    MatPrefix,
    MatIcon,
    MatInput,
    MatProgressBar,
    MatTabGroup,
    MatTab,
    NgTemplateOutlet,
  ],
  // A column as tall as the dialog: the tabs take what the title, the chosen and the actions leave
  host: { class: 'flex h-full min-h-0 flex-col' },
  template: `
    <h2 mat-dialog-title i18n="@@enrollDialog.title.target">Matricular en {{ data.targetName }}</h2>
    <mat-dialog-content>
      <div class="flex min-h-0 flex-1 flex-col gap-3">
        <p class="text-body-medium text-on-surface-variant">{{ data.intro }}</p>
        <mat-tab-group
          mat-stretch-tabs="false"
          animationDuration="0ms"
          class="app-fill-tabs min-h-0 flex-1"
        >
          <mat-tab [label]="data.candidates.label">
            <div class="flex h-full flex-col gap-2 pt-3">
              @if (candidates.error()) {
                <p class="text-body-medium text-error" i18n="@@enrollDialog.candidates.loadError">
                  No se ha podido leer el alumnado. Inténtalo de nuevo.
                </p>
              } @else if (!candidates.hasValue()) {
                <mat-progress-bar mode="indeterminate" class="rounded-full" />
              } @else if (freeCandidates().length === 0) {
                <!-- In the middle of the room the list would take, as the empty table of the class -->
                <div class="my-auto flex flex-col items-center gap-2 text-center">
                  <mat-icon aria-hidden="true" class="text-on-surface-variant">how_to_reg</mat-icon>
                  <p class="text-body-medium text-on-surface-variant">
                    {{ data.candidates.empty }}
                  </p>
                </div>
              } @else {
                <!-- One row: choosing all of those shown, and the filter that says which -->
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <mat-checkbox
                    [checked]="allShownChosen()"
                    [indeterminate]="someShownChosen()"
                    [disabled]="shownCandidates().length === 0"
                    (change)="toggleShown()"
                  >
                    <span class="text-title-small" i18n="@@enrollDialog.candidates.all"
                      >Seleccionar todos ({{ shownCandidates().length }})</span
                    >
                  </mat-checkbox>
                  <mat-form-field subscriptSizing="dynamic" class="app-dense-field w-full sm:w-64">
                    <mat-label i18n="@@enrollDialog.candidates.filter">Filtrar</mat-label>
                    <mat-icon matPrefix aria-hidden="true">search</mat-icon>
                    <input
                      matInput
                      type="search"
                      autocomplete="off"
                      [value]="candidateFilter()"
                      (input)="onCandidateFilter($event)"
                    />
                  </mat-form-field>
                </div>
                <ul
                  class="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-outline-variant pt-1"
                >
                  @if (byOrigin()) {
                    <!-- By the class they come from (5.2g): a class is chosen with one click -->
                    @for (section of sections(); track section.label) {
                      <li class="mt-2 first:mt-0">
                        <mat-checkbox
                          [checked]="isSectionChosen(section)"
                          [indeterminate]="isSectionPartly(section)"
                          (change)="toggleSection(section)"
                        >
                          <span class="text-title-small"
                            >{{ section.label }} ({{ section.candidates.length }})</span
                          >
                        </mat-checkbox>
                        <ul class="ps-8">
                          @for (candidate of section.candidates; track candidate.student.id) {
                            <li>
                              <ng-container
                                [ngTemplateOutlet]="candidateBox"
                                [ngTemplateOutletContext]="{ $implicit: candidate.student }"
                              />
                            </li>
                          }
                        </ul>
                      </li>
                    }
                  } @else {
                    @for (candidate of shownCandidates(); track candidate.student.id) {
                      <li>
                        <ng-container
                          [ngTemplateOutlet]="candidateBox"
                          [ngTemplateOutletContext]="{ $implicit: candidate.student }"
                        />
                      </li>
                    }
                  }
                  @if (shownCandidates().length === 0) {
                    <li
                      class="py-2 text-body-medium text-on-surface-variant"
                      i18n="@@groups.filter.none"
                    >
                      Nadie coincide
                    </li>
                  }
                </ul>
              }
            </div>
          </mat-tab>
          <mat-tab label="Pegar una lista" i18n-label="@@enrollDialog.tab.paste">
            <div class="flex flex-col gap-2 pt-3">
              <mat-form-field subscriptSizing="dynamic">
                <mat-label i18n="@@enrollDialog.paste.label"
                  >Correos o nombres, uno por línea</mat-label
                >
                <textarea
                  matInput
                  rows="6"
                  spellcheck="false"
                  [value]="pasted()"
                  (input)="onPaste($event)"
                ></textarea>
                <mat-hint i18n="@@enrollDialog.paste.hint"
                  >Como la lista de secretaría o los correos copiados de otra clase.</mat-hint
                >
              </mat-form-field>
              <div>
                <button
                  matButton="outlined"
                  type="button"
                  [disabled]="pastedLines().length === 0 || matching()"
                  (click)="matchPasted()"
                >
                  <mat-icon aria-hidden="true">checklist</mat-icon>
                  <span i18n="@@enrollDialog.paste.find">Buscar en la lista</span>
                </button>
              </div>
              @if (tooManyLines()) {
                <p
                  class="text-body-medium text-error"
                  role="alert"
                  i18n="@@enrollDialog.paste.tooMany"
                >
                  Como mucho {{ maxLines }} líneas de una vez.
                </p>
              }
              @if (pastedResult(); as result) {
                <p class="text-body-medium" role="status">
                  <span i18n="@@enrollDialog.paste.added">{result.added, plural,
                    =0 {Ninguno nuevo elegido}
                    =1 {1 elegido}
                    other {{{ result.added }} elegidos}
                  }</span>
                  @if (result.unmatched.length > 0) {
                    <span aria-hidden="true"> · </span>
                    <span i18n="@@enrollDialog.paste.unmatched"
                      >Sin una cuenta de alumno (o con más de una):</span
                    >
                  }
                </p>
                @if (result.unmatched.length > 0) {
                  <ul class="max-h-24 overflow-y-auto text-body-small text-on-surface-variant">
                    @for (line of result.unmatched; track line) {
                      <li>{{ line }}</li>
                    }
                  </ul>
                }
                <ng-container
                  [ngTemplateOutlet]="skippedList"
                  [ngTemplateOutletContext]="{ $implicit: result.skipped }"
                />
              }
            </div>
          </mat-tab>
          @if (data.sources.length > 0) {
            <mat-tab label="De otra clase" i18n-label="@@enrollDialog.tab.sources">
              <div class="flex h-full flex-col">
                <!-- Above the classes, which can be many: what came of the last one, at sight -->
                @if (copiedResult(); as result) {
                  <div class="flex flex-col gap-1 pt-3">
                    <p class="text-body-medium" role="status">
                      <span i18n="@@enrollDialog.copied.visible">{result.added, plural,
                        =0 {Ninguno nuevo de {{ result.source }}}
                        =1 {1 elegido de {{ result.source }}}
                        other {{{ result.added }} elegidos de {{ result.source }}}
                      }</span>
                    </p>
                    <ng-container
                      [ngTemplateOutlet]="skippedList"
                      [ngTemplateOutletContext]="{ $implicit: result.skipped }"
                    />
                  </div>
                }
                <ul class="flex min-h-0 flex-col gap-1 overflow-y-auto pt-3">
                  @for (source of data.sources; track source.id) {
                    <li>
                      <button
                        matButton
                        type="button"
                        [disabled]="copying()"
                        (click)="copyFrom(source)"
                      >
                        <mat-icon aria-hidden="true">group</mat-icon>
                        <span i18n="@@enrollDialog.copyFrom">Añadir los de {{ source.label }}</span>
                      </button>
                    </li>
                  }
                </ul>
              </div>
            </mat-tab>
          }
          <mat-tab label="Buscar" i18n-label="@@enrollDialog.tab.search">
            <div class="flex h-full flex-col gap-2 pt-3">
              <mat-form-field>
                <mat-label i18n="@@enrollDialog.search"
                  >Buscar alumnos por nombre o correo</mat-label
                >
                <mat-icon matPrefix aria-hidden="true">search</mat-icon>
                <input
                  matInput
                  type="search"
                  autocomplete="off"
                  spellcheck="false"
                  (input)="onInput($event)"
                />
                <mat-hint i18n="@@enrollDialog.search.hint">Escribe al menos dos letras</mat-hint>
              </mat-form-field>
              <div class="h-1">
                @if (results.isLoading()) {
                  <mat-progress-bar mode="indeterminate" class="rounded-full" />
                }
              </div>
              <!-- Says how many were found, not the whole list on every search -->
              <p class="sr-only" aria-live="polite">
                @if (results.hasValue()) {
                  <span i18n="@@enrollDialog.found">{results.value().length, plural,
                    =0 {Ningún alumno coincide}
                    =1 {1 alumno encontrado}
                    other {{{ results.value().length }} alumnos encontrados}
                  }</span>
                }
              </p>
              <div class="min-h-0 flex-1 overflow-y-auto">
                @if (results.error()) {
                  <p class="text-body-medium text-error" i18n="@@enrollDialog.error">
                    No se ha podido buscar. Inténtalo de nuevo.
                  </p>
                } @else if (results.hasValue() && results.value().length === 0) {
                  <p class="text-body-medium text-on-surface-variant" i18n="@@enrollDialog.none">
                    Ningún alumno activo coincide. Las cuentas las crea y las vuelve a activar la
                    administración.
                  </p>
                } @else if (results.hasValue()) {
                  <ul class="flex flex-col">
                    @for (found of foundStudents(); track found.candidate.student.id) {
                      <li>
                        <!-- In another class of the year: not chosen, and it says where (5.2g) -->
                        <mat-checkbox
                          [checked]="isChosen(found.candidate.student)"
                          [disabled]="found.blocker === 'other_class'"
                          (change)="toggle(found.candidate.student)"
                        >
                          <span class="flex flex-col">
                            <span>{{ found.candidate.student.name }}</span>
                            <span class="text-body-small text-on-surface-variant">{{
                              found.candidate.student.email
                            }}</span>
                            <!-- Where they come from (5.2g): who finished, at sight before choosing -->
                            @if (found.origin; as origin) {
                              <span
                                class="flex items-center gap-1 text-body-small"
                                [class]="
                                  found.blocker
                                    ? 'text-on-warning-container'
                                    : 'text-on-surface-variant'
                                "
                              >
                                <mat-icon class="size-4! text-[1rem]!" aria-hidden="true">{{
                                  found.blocker ? 'warning' : 'history'
                                }}</mat-icon>
                                {{ origin }}
                              </span>
                            }
                          </span>
                        </mat-checkbox>
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>

        @if (chosen().length > 0) {
          <div class="flex items-center justify-between gap-2">
            <span class="text-title-small" i18n="@@enrollDialog.chosenCount"
              >Elegidos ({{ chosen().length }})</span
            >
            <button matButton type="button" (click)="clearChosen()">
              <span i18n="@@enrollDialog.clear">Quitar todos</span>
            </button>
          </div>
          <!-- A whole class can be many: they scroll, the dialog does not grow -->
          <mat-chip-set
            class="block max-h-28 shrink-0 overflow-y-auto"
            aria-label="Elegidos"
            i18n-aria-label="@@enrollDialog.chosen"
          >
            @for (student of chosen(); track student.id) {
              <mat-chip (removed)="toggle(student)">
                {{ student.name }}
                <button matChipRemove [attr.aria-label]="removeLabel(student)">
                  <mat-icon aria-hidden="true">cancel</mat-icon>
                </button>
              </mat-chip>
            }
          </mat-chip-set>
        }
        @if (failure(); as message) {
          <p class="text-body-medium text-error" role="alert">{{ message }}</p>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button matButton type="button" mat-dialog-close i18n="@@enrollDialog.cancel">
        Cancelar
      </button>
      <button
        matButton="filled"
        type="button"
        [disabled]="chosen().length === 0 || saving()"
        (click)="submit()"
      >
        @if (saving()) {
          <span i18n="@@enrollDialog.saving">Matriculando…</span>
        } @else {
          <span i18n="@@enrollDialog.submit">Matricular ({{ chosen().length }})</span>
        }
      </button>
    </mat-dialog-actions>
    <!-- Shared by the tabs -->
    <ng-template #skippedList let-skipped>
      @if (skipped.length > 0) {
        <p
          class="flex items-center gap-1 text-body-medium text-on-warning-container"
          i18n="@@enrollDialog.skipped"
        >
          <mat-icon class="size-5! text-[1.25rem]!" aria-hidden="true">warning</mat-icon>
          No se añaden:
        </p>
        <ul class="max-h-24 overflow-y-auto text-body-small text-on-surface-variant">
          @for (line of skipped; track line) {
            <li>{{ line }}</li>
          }
        </ul>
        <p class="text-body-small text-on-surface-variant" i18n="@@enrollDialog.skipped.hint">
          A quien tituló o causó baja se le busca uno a uno si vuelve. Para cambiar a alguien de
          clase, primero se le quita de la suya.
        </p>
      }
    </ng-template>
    <ng-template #candidateBox let-student>
      <mat-checkbox [checked]="isChosen(student)" (change)="toggle(student)">
        <span class="flex flex-col">
          <span>{{ student.name }}</span>
          <span class="text-body-small text-on-surface-variant">{{ student.email }}</span>
        </span>
      </mat-checkbox>
    </ng-template>
  `,
})
export class EnrollDialog {
  protected readonly data = inject<EnrollDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<EnrollDialog, boolean>>(MatDialogRef);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly maxLines = MAX_PASTED_LINES;

  /** In the order they were chosen. */
  protected readonly chosen = signal<readonly UserRef[]>([]);
  protected readonly saving = signal(false);
  protected readonly failure = signal<string | null>(null);

  /** The first tab: read once, when the dialog opens. */
  protected readonly candidates = resource({ loader: () => this.data.candidates.load() });
  protected readonly candidateFilter = signal('');
  /** Those not there yet. */
  protected readonly freeCandidates = computed(() =>
    (this.candidates.hasValue() ? this.candidates.value() : []).filter(
      ({ student }) => !this.data.enrolledIds.has(student.id),
    ),
  );
  protected readonly shownCandidates = computed(() => {
    const wanted = searchable(this.candidateFilter().trim());
    return this.freeCandidates().filter(({ student: { name, email } }) =>
      searchable(`${name} ${email}`).includes(wanted),
    );
  });
  /** Somebody comes from a class: the list goes by class (5.2g). */
  protected readonly byOrigin = computed(() =>
    this.freeCandidates().some(({ previous }) => previous !== null),
  );
  protected readonly sections = computed(() => candidateSections(this.shownCandidates()));
  protected readonly allShownChosen = computed(() => this.allChosen(this.shownCandidates()));
  protected readonly someShownChosen = computed(
    () => !this.allShownChosen() && this.someChosen(this.shownCandidates()),
  );

  /** A pasted list, its lines and what it gave. */
  protected readonly pasted = signal('');
  protected readonly pastedLines = computed(() =>
    this.pasted()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== ''),
  );
  protected readonly tooManyLines = computed(() => this.pastedLines().length > MAX_PASTED_LINES);
  protected readonly matching = signal(false);
  protected readonly pastedResult = signal<PastedResult | null>(null);

  /** Reading the students of another class, and what came of it. */
  protected readonly copying = signal(false);
  protected readonly copiedResult = signal<{
    readonly source: string;
    readonly added: number;
    readonly skipped: readonly string[];
  } | null>(null);

  /** The text searched for, once typing stops. */
  private readonly search = signal('');
  private readonly debouncer = createDebouncer(SEARCH_DELAY_MS);

  /** Idle below the minimum: the hint says why nothing is listed. */
  protected readonly results = resource({
    params: () => {
      const text = this.search().trim();
      return text.length >= MIN_STUDENT_SEARCH_LENGTH ? text : undefined;
    },
    loader: ({ params }) => this.data.search(params),
  });

  /**
   * The results with where each comes from (5.2g), and whether something stands in the way: who
   * finished can still be chosen, as they may come back; who is in another class of the year, not.
   */
  protected readonly foundStudents = computed(() =>
    (this.results.hasValue() ? this.results.value() : []).map((candidate) => {
      const blocker = enrollBlocker(candidate, this.data.schoolYear);
      return {
        candidate,
        blocker,
        origin: candidate.previous && blockerLine(candidate.previous, blocker),
      };
    }),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.debouncer.cancel());
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.debouncer.schedule(() => this.search.set(text));
  }

  protected onCandidateFilter(event: Event): void {
    this.candidateFilter.set((event.target as HTMLInputElement).value);
  }

  protected onPaste(event: Event): void {
    this.pasted.set((event.target as HTMLTextAreaElement).value);
    this.pastedResult.set(null);
  }

  protected isChosen(student: UserRef): boolean {
    return this.chosen().some(({ id }) => id === student.id);
  }

  protected toggle(student: UserRef): void {
    this.chosen.update((chosen) =>
      chosen.some(({ id }) => id === student.id)
        ? chosen.filter(({ id }) => id !== student.id)
        : [...chosen, student],
    );
  }

  /** All those the filter shows, or none of them if they all were chosen. */
  protected toggleShown(): void {
    this.toggleAll(this.shownCandidates());
  }

  protected isSectionChosen(section: CandidateSection<ClassCandidate>): boolean {
    return this.allChosen(section.candidates);
  }

  protected isSectionPartly(section: CandidateSection<ClassCandidate>): boolean {
    return !this.allChosen(section.candidates) && this.someChosen(section.candidates);
  }

  /** Those of a class, as «Seleccionar todos» does with all. */
  protected toggleSection(section: CandidateSection<ClassCandidate>): void {
    this.toggleAll(section.candidates);
  }

  protected clearChosen(): void {
    this.chosen.set([]);
  }

  /** Chooses the students the lines name; says which lines named nobody. */
  protected async matchPasted(): Promise<void> {
    if (this.tooManyLines()) return;
    this.matching.set(true);
    this.failure.set(null);
    try {
      const lines = this.pastedLines();
      const matches = await this.data.match(lines);
      const found = new Set(matches.map(({ entry }) => entry.toLowerCase()));
      // Who finished or is in another class of the year is not taken in a list (5.2g)
      const { kept, skipped } = sortOutCandidates(
        matches,
        this.data.enrolledIds,
        this.data.schoolYear,
      );
      this.pastedResult.set({
        added: this.add(kept),
        unmatched: lines.filter((line) => !found.has(line.toLowerCase())),
        skipped,
      });
    } catch (error) {
      this.failure.set(groupActionMessage('enroll', error));
    } finally {
      this.matching.set(false);
    }
  }

  /** Chooses the students of another class who are not here. */
  protected async copyFrom(source: EnrollSource): Promise<void> {
    this.copying.set(true);
    this.failure.set(null);
    this.copiedResult.set(null);
    try {
      // By their last class, not their evaluation in that one, which may be old (5.2g)
      const { kept, skipped } = sortOutCandidates(
        await this.data.studentsOf(source.id),
        this.data.enrolledIds,
        this.data.schoolYear,
      );
      const added = this.add(kept);
      this.copiedResult.set({ source: source.label, added, skipped });
      void this.announcer.announce(
        $localize`:@@enrollDialog.copied:${added}:count: elegidos de ${source.label}:group:`,
      );
    } catch {
      this.failure.set(
        $localize`:@@enrollDialog.copyClassError:No se ha podido leer esa clase. Inténtalo de nuevo.`,
      );
    } finally {
      this.copying.set(false);
    }
  }

  protected removeLabel(student: UserRef): string {
    return $localize`:@@enrollDialog.remove:Quitar a ${student.name}:name:`;
  }

  protected async submit(): Promise<void> {
    this.saving.set(true);
    this.failure.set(null);
    try {
      await this.data.enroll(this.chosen());
      this.ref.close(true);
    } catch (error) {
      this.failure.set(groupActionMessage('enroll', error));
    } finally {
      this.saving.set(false);
    }
  }

  private allChosen(candidates: readonly ClassCandidate[]): boolean {
    return candidates.length > 0 && candidates.every(({ student }) => this.isChosen(student));
  }

  private someChosen(candidates: readonly ClassCandidate[]): boolean {
    return candidates.some(({ student }) => this.isChosen(student));
  }

  /** All of them, or none if they all were chosen. */
  private toggleAll(candidates: readonly ClassCandidate[]): void {
    if (this.allChosen(candidates)) {
      const ids = new Set(candidates.map(({ student }) => student.id));
      this.chosen.update((chosen) => chosen.filter(({ id }) => !ids.has(id)));
    } else {
      this.add(candidates.map(({ student }) => student));
    }
  }

  /** Adds to the choice who is neither chosen nor there yet; how many. */
  private add(students: readonly UserRef[]): number {
    const { chosen, added } = addToChoice(this.chosen(), students, this.data.enrolledIds);
    this.chosen.set(chosen);
    return added;
  }
}
