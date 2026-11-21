import { Component, computed, DOCUMENT, inject, resource, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';

import { APP_PATHS } from '../../core/app-paths';
import { MAX_CREATE_BATCH } from '../../data/admin/user-rules';
import { AdminService, type NewStudent } from '../../data/admin-service';
import { GroupService, MAX_ENROLLMENT_BATCH, MAX_PASTED_LINES } from '../../data/group-service';
import { schoolYearOf } from '../../data/school-year';
import type { AppUser } from '../../data/user';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';
import { downloadCsv } from '../../shared/download-text';
import { printCredentials } from './credentials-sheet';
import { generatePassword } from './generate-password';
import {
  type Credential,
  credentialsCsv,
  credentialsTitle,
  reviewStudentList,
  studentListLines,
  type StudentRow,
  type StudentRowStatus,
} from './student-list';
import { userActionMessage } from './user-action-message';

/** The accounts already loaded, to tell apart before creating anything the emails that have one. */
export interface NewStudentsDialogData {
  readonly users: readonly AppUser[];
}

/** A class to enroll the new students in: open, of this year or a later one. */
interface ClassChoice {
  readonly id: string;
  readonly name: string;
  readonly schoolYear: string;
  /** «1.º DAW A · 2026/27». */
  readonly label: string;
}

type Phase = 'paste' | 'review' | 'saving' | 'done';

/** No class chosen: the students are only created. */
const NO_CLASS = '';

/** Why a line is not created, under it. */
const SKIP_REASONS: Readonly<Record<Exclude<StudentRowStatus, 'new'>, string>> = {
  existing: $localize`:@@newStudents.skip.existing:Ya tiene una cuenta`,
  disabled: $localize`:@@newStudents.skip.disabled:Tiene una cuenta desactivada: actívala en la lista`,
  repeated: $localize`:@@newStudents.skip.repeated:Repetido en la lista`,
  no_email: $localize`:@@newStudents.skip.noEmail:Sin un correo válido`,
  no_name: $localize`:@@newStudents.skip.noName:Sin nombre`,
  name_too_long: $localize`:@@newStudents.skip.nameTooLong:Nombre demasiado largo`,
  email_too_long: $localize`:@@newStudents.skip.emailTooLong:Correo demasiado largo`,
};

/**
 * The accounts of a list from secretaría at once (5.2h): pasted as it comes, checked before creating
 * anything, created with random passwords and, if chosen, enrolled in a class. The passwords are
 * shown only here, to download or print and hand over in person (D-072): closing without either
 * asks first. It closes with how many accounts it created.
 */
@Component({
  selector: 'app-new-students-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    MatSelect,
    MatOption,
    MatIcon,
    MatProgressBar,
  ],
  templateUrl: './new-students-dialog.html',
})
export class NewStudentsDialog {
  private readonly data = inject<NewStudentsDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<NewStudentsDialog, number>>(MatDialogRef);
  private readonly admin = inject(AdminService);
  private readonly groups = inject(GroupService);
  private readonly dialog = inject(MatDialog);
  private readonly document = inject(DOCUMENT);

  protected readonly maxLines = MAX_PASTED_LINES;
  protected readonly noClass = NO_CLASS;
  protected readonly phase = signal<Phase>('paste');

  protected readonly text = signal('');
  private readonly lineCount = computed(() => studentListLines(this.text()).length);
  protected readonly canCheck = computed(
    () => this.lineCount() > 0 && this.lineCount() <= MAX_PASTED_LINES,
  );
  protected readonly tooMany = computed(() => this.lineCount() > MAX_PASTED_LINES);

  /** The lines checked against the accounts: those to create and those left out, with why. */
  private readonly rows = signal<StudentRow[]>([]);
  protected readonly toCreate = computed(() =>
    this.rows().filter(({ status }) => status === 'new'),
  );
  protected readonly skipped = computed(() =>
    this.rows()
      .filter(
        (row): row is StudentRow & { status: Exclude<StudentRowStatus, 'new'> } =>
          row.status !== 'new',
      )
      .map((row) => ({
        row,
        // A line not understood as it was pasted; one with an email, as it was read
        text: row.problem ? row.text : `${row.name} · ${row.email}`,
        icon: row.account ? 'person' : 'block',
        reason: SKIP_REASONS[row.status],
      })),
  );

  /** Open classes of this year or later, by year and name. A failure only hides the choice. */
  protected readonly classes = resource({
    loader: async (): Promise<ClassChoice[]> => {
      const year = schoolYearOf(new Date());
      return (await this.groups.listClasses())
        .filter(({ open, schoolClass }) => open && schoolClass.schoolYear >= year)
        .map(({ schoolClass: { id, name, schoolYear } }) => ({
          id,
          name,
          schoolYear,
          label: `${name} · ${schoolYear}`,
        }))
        .sort(
          (a, b) => a.schoolYear.localeCompare(b.schoolYear) || a.name.localeCompare(b.name, 'es'),
        );
    },
  });
  protected readonly classChoices = computed(() =>
    this.classes.hasValue() ? this.classes.value() : [],
  );
  protected readonly classId = signal(NO_CLASS);
  protected readonly chosenClass = computed(
    () => this.classChoices().find(({ id }) => id === this.classId()) ?? null,
  );

  /** What is left to create, the accounts created with their passwords and those not created. */
  private readonly pending = signal<NewStudent[]>([]);
  protected readonly total = signal(0);
  protected readonly credentials = signal<Credential[]>([]);
  private readonly createdIds = signal<string[]>([]);
  protected readonly existing = signal<string[]>([]);
  protected readonly failed = signal<string[]>([]);
  protected readonly done = computed(() => this.total() - this.pending().length);
  /** Only shown while creating, when there is at least one. */
  protected readonly progress = computed(() => (100 * this.done()) / this.total());
  protected readonly left = computed(() => this.pending().length);

  /** A request that failed: the error, and whether the creation or the enrollment is retried. */
  protected readonly failure = signal<string | null>(null);
  protected readonly enrolled = signal<'no' | 'yes' | 'failed'>('no');

  /** Downloaded or printed: closing does not ask any more. */
  private readonly saved = signal(false);

  constructor() {
    // Escape and the backdrop close as the button does: asking first if the passwords are not saved
    this.ref.disableClose = true;
    this.ref.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') void this.close();
    });
    this.ref.backdropClick().subscribe(() => void this.close());
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLTextAreaElement).value);
  }

  protected selectClass(classId: string): void {
    this.classId.set(classId);
  }

  protected check(): void {
    this.rows.set(reviewStudentList(this.text(), this.data.users));
    this.phase.set('review');
  }

  protected back(): void {
    this.phase.set('paste');
  }

  /** Each new student gets a random password, kept only in this dialog. */
  protected async create(): Promise<void> {
    const students = this.toCreate().map(({ name, email }) => ({
      name,
      email,
      password: generatePassword(),
    }));
    this.pending.set(students);
    this.total.set(students.length);
    await this.createPending();
  }

  /**
   * In parts of `MAX_CREATE_BATCH`, to answer in time and tell how far it got. A part that fails
   * stops there: what was created stays, and the rest can be retried.
   */
  protected async createPending(): Promise<void> {
    this.phase.set('saving');
    this.failure.set(null);
    while (this.pending().length > 0) {
      const part = this.pending().slice(0, MAX_CREATE_BATCH);
      try {
        const result = await this.admin.createStudents(part);
        const created = new Set(result.created.map(({ email }) => email));
        this.credentials.update((list) => [
          ...list,
          ...part.filter(({ email }) => created.has(email)),
        ]);
        this.createdIds.update((ids) => [...ids, ...result.created.map(({ id }) => id)]);
        this.existing.update((emails) => [...emails, ...result.existing]);
        this.failed.update((emails) => [...emails, ...result.failed]);
        this.pending.update((rest) => rest.slice(part.length));
      } catch (error) {
        this.failure.set(userActionMessage('create', error));
        this.phase.set('done');
        return;
      }
    }
    await this.enroll();
  }

  /** Into the class chosen, in parts of `MAX_ENROLLMENT_BATCH`; enrolling again skips who is in. */
  protected async enroll(): Promise<void> {
    const ids = this.createdIds();
    if (this.classId() !== NO_CLASS && ids.length > 0) {
      this.phase.set('saving');
      try {
        for (let start = 0; start < ids.length; start += MAX_ENROLLMENT_BATCH) {
          await this.groups.enrollInClass(
            this.classId(),
            ids.slice(start, start + MAX_ENROLLMENT_BATCH),
          );
        }
        this.enrolled.set('yes');
      } catch {
        this.enrolled.set('failed');
      }
    }
    this.phase.set('done');
  }

  protected download(): void {
    downloadCsv(this.document, `${this.filesTitle()}.csv`, credentialsCsv(this.credentials()));
    this.saved.set(true);
  }

  protected print(): void {
    printCredentials(this.document, this.credentials(), {
      title: this.filesTitle(),
      signInUrl: new URL(APP_PATHS.login, this.document.baseURI).href,
    });
    this.saved.set(true);
  }

  /** The CSV and the PDF, named alike: after the class, or the day without one. */
  private filesTitle(): string {
    return credentialsTitle(this.chosenClass(), new Date().toISOString().slice(0, 10));
  }

  /** The passwords are not seen again: without saving them, it asks first. */
  protected async close(): Promise<void> {
    if (this.phase() === 'saving') return;
    if (this.credentials().length > 0 && !this.saved()) {
      const confirmed = await confirmAction(this.dialog, {
        title: $localize`:@@newStudents.unsaved.title:¿Cerrar sin guardar las contraseñas?`,
        text: $localize`:@@newStudents.unsaved.text:No se vuelven a ver: para entregarlas tendrías que restablecerlas una a una.`,
        confirm: $localize`:@@newStudents.unsaved.confirm:Cerrar sin guardarlas`,
      });
      if (!confirmed) return;
    }
    this.ref.close(this.credentials().length);
  }
}
