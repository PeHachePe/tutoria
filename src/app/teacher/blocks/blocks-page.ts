import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import {
  afterNextRender,
  Component,
  computed,
  DOCUMENT,
  inject,
  Injector,
  input,
  linkedSignal,
  resource,
} from '@angular/core';
import { MatButton, MatFabButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../auth/auth-store';
import { APP_PATHS, TEACHER_PARAMS } from '../../core/app-paths';
import { LONG_SNACK_BAR_DURATION_MS } from '../../core/snack-bar-defaults';
import { prefersReducedMotion } from '../../shared/reduced-motion';
import { LanguageService } from '../../core/i18n/language-service';
import {
  type AssignmentChanges,
  type BlockDraft,
  BlockService,
  type PlannedAssignment,
  type PlannedBlock,
} from '../../data/block-service';
import type { AssignedGroup, ClassBlock } from '../../data/exercise';
import { blockTitle, exerciseText, subjectName } from '../../data/localized-text';
import { groupTitle } from '../../data/group-name';
import { isPastSchoolYear, schoolYearOf } from '../../data/school-year';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';
import { DifficultyChip } from '../../shared/difficulty-chip/difficulty-chip';
import { DueLabel } from '../../shared/due-label/due-label';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import {
  AddExercisesDialog,
  type AddExercisesData,
  type AddExercisesResult,
} from './add-exercises-dialog';
import { GroupPicker, pickGroup } from '../group-picker/group-picker';
import { BlockDialog, type BlockDialogData } from './block-dialog';
import { CopyBlocksDialog, type CopyBlocksDialogData } from './copy-blocks-dialog';
import { moveItem } from './block-order';
import { DueDateDialog, type DueDateDialogData, type DueDateDialogResult } from './due-date-dialog';

const SKELETON_BLOCKS = [1, 2, 3];

/** No block marked: one constant, as the selection is replaced, never changed. */
const EMPTY_SELECTION: ReadonlySet<string> = new Set();

/**
 * The blocks of a group (/docente/bloques?grupo=, ficha 08, D-046, 4.3b): create, title, translate,
 * reorder, hide, schedule (D-060) and delete them; and in each one, the exercises of the bank
 * assigned there, in their order, with an optional due date (D-054), which move to another block
 * even once started (4.3d). Only what nobody started can be deleted: their attempts keep it, and
 * hiding is the way to take it out of sight. The blocks of a closed class are read only (5.2f): what
 * its students had that year, to look at and to copy into another group. «Seleccionar» deletes
 * several blocks nobody started at once, and a copy is undone (5.2f).
 */
@Component({
  selector: 'app-blocks-page',
  imports: [
    RouterLink,
    NgTemplateOutlet,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    MatButton,
    MatCheckbox,
    MatFabButton,
    MatIconButton,
    MatIcon,
    MatSlideToggle,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatProgressBar,
    MatTooltip,
    DifficultyChip,
    DueLabel,
    EmptyState,
    LoadError,
    LoadingSkeleton,
    Skeleton,
    GroupPicker,
  ],
  templateUrl: './blocks-page.html',
})
export class BlocksPage {
  private readonly service = inject(BlockService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly locale = inject(LanguageService).locale;
  /** The dialogs get the defaults of the area, such as the outlined fields (teacher.routes.ts). */
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  /** The group, from the query parameters of the URL (withComponentInputBinding). */
  readonly grupo = input<string>();

  protected readonly paths = APP_PATHS.teacher;
  protected readonly skeletonBlocks = SKELETON_BLOCKS;

  /** Empty until they arrive: the template tells loading from empty by the status. */
  protected readonly groups = resource({
    loader: () => this.service.listGroups(),
    defaultValue: [],
  });

  /** The groups once loaded; none while they fail, when reading the value would throw. */
  private readonly groupList = computed(() => (this.groups.hasValue() ? this.groups.value() : []));

  /** The group of the URL or, without one (or an unknown one), the first of this year (5.2e). */
  protected readonly group = computed(() => pickGroup(this.groupList(), this.grupo(), new Date()));

  protected readonly isAdmin = computed(() => this.auth.role() === 'admin');

  /** The year the blocks of a closed class are copied into, as the notice says (5.2f). */
  protected readonly currentYear = schoolYearOf(new Date());

  /** Its year is over (5.2f): the page says why its blocks are read only, or that it was reopened. */
  protected readonly pastYear = computed(() => {
    const group = this.group();
    return group !== null && isPastSchoolYear(group.schoolYear, new Date());
  });

  /**
   * «Name · subject», with the year when that is not enough: the same class of another year, as
   * «Copiar de otro grupo» offers them all. The picker shows the year apart, and only the name.
   */
  protected readonly groupOptions = computed(() => {
    const groups = this.groupList();
    const labels = groups.map((group) =>
      groupTitle(group.name, subjectName(group.subject, this.locale).name, group.label),
    );
    return groups.map((group, index) => ({
      group,
      id: group.id,
      label:
        labels.filter((label) => label === labels[index]).length > 1
          ? `${labels[index]} · ${group.schoolYear}`
          : labels[index],
    }));
  });

  /** By year in the picker (5.2e): within one, the name of the group is enough. */
  protected readonly pickerGroups = computed(() =>
    this.groupList().map((group) => ({
      id: group.id,
      label: groupTitle(group.name, subjectName(group.subject, this.locale).name, group.label),
      schoolYear: group.schoolYear,
    })),
  );

  /** Choosing blocks to delete at once (5.2f); another group starts without. */
  protected readonly selecting = linkedSignal({
    source: () => this.group()?.id,
    computation: () => false,
  });

  /** The ids of the blocks marked while choosing. */
  protected readonly selected = linkedSignal<string | undefined, ReadonlySet<string>>({
    source: () => this.group()?.id,
    computation: () => EMPTY_SELECTION,
  });

  protected readonly emptySelection = EMPTY_SELECTION;

  /** Changed in place by every action, so the page answers at once; reloaded only after a failure. */
  protected readonly blocks = resource({
    params: () => this.group()?.id,
    loader: ({ params }) => this.service.listBlocks(params),
    defaultValue: [],
  });

  /** The blocks, ready for the template. */
  protected readonly rows = computed(() => {
    const blocks = this.blocks.value();
    // From the moment it is drawn, as DueLabel: a screen open for days is reloaded long before
    const now = Date.now();
    return blocks.map((planned, index) => {
      const title = blockTitle(planned.block, this.locale);
      const { opensAt } = planned.block;
      return {
        planned,
        id: planned.block.id,
        listId: assignmentListId(planned.block.id),
        /** Until it opens: then the students see it as any other. */
        opening: opensAt !== null && Date.parse(opensAt) > now ? opensAt : null,
        /** The blocks an exercise of this one can move to: all the others of the group. */
        targets: blocks
          .filter((other) => other !== planned)
          .map((other) => {
            const otherTitle = blockTitle(other.block, this.locale);
            return {
              planned: other,
              title: otherTitle.title,
              lang: otherTitle.locale === this.locale ? null : otherTitle.locale,
              has: (exerciseId: string) => hasExercise(other, exerciseId),
            };
          }),
        title: title.title,
        lang: title.locale === this.locale ? null : title.locale,
        headingId: `block-${planned.block.id}`,
        first: index === 0,
        last: index === blocks.length - 1,
        started: planned.assignments.some((entry) => entry.studentCount > 0),
        actionsLabel: $localize`:@@blocks.actions:Acciones del bloque «${title.title}:title:»`,
        selectLabel: $localize`:@@blocks.select.one:Marcar «${title.title}:title:» para borrarlo`,
        dragLabel: $localize`:@@blocks.drag:Arrastrar el bloque «${title.title}:title:»`,
        assignments: planned.assignments.map((entry, position) =>
          this.assignmentRow(entry, position, planned.assignments.length),
        ),
      };
    });
  });

  /** Every block nobody started is marked: the bar offers to unmark them instead. */
  protected readonly allUnstartedSelected = computed(() => {
    const unstarted = this.rows().filter((row) => !row.started);
    return unstarted.length > 0 && unstarted.every((row) => this.selected().has(row.id));
  });

  /** Every list of exercises, so one is dragged from a block to another. */
  protected readonly listIds = computed(() => this.rows().map((row) => row.listId));

  /** A block takes an exercise dragged from another only if it does not have it yet. */
  protected readonly canEnter = (
    drag: CdkDrag<PlannedAssignment>,
    drop: CdkDropList<PlannedBlock>,
  ): boolean =>
    drop.data.block.id === drag.data.assignment.blockId ||
    !hasExercise(drop.data, drag.data.exercise.id);

  protected selectGroup(groupId: string): void {
    void this.router.navigate([], { queryParams: { [TEACHER_PARAMS.group]: groupId } });
  }

  // Blocks ---------------------------------------------------------------------------------------

  protected async newBlock(group: AssignedGroup): Promise<void> {
    let createdId: string | null = null;
    const created = await this.openBlockDialog(null, async (draft) => {
      const block = await this.service.createBlock(group.id, draft);
      createdId = block.id;
      this.blocks.value.update((blocks) => [...blocks, { block, assignments: [] }]);
    });
    if (!created) return;
    this.snackBar.open($localize`:@@blocks.created:Bloque creado`);
    // The new block is the last one, often out of sight
    this.revealBlock(createdId);
  }

  /**
   * The blocks of another group after those of this one (5.2c, D-079): the same class of last year
   * or a parallel group. The server gives them their ids, so they are reloaded.
   */
  protected async copyBlocks(group: AssignedGroup): Promise<void> {
    const options = this.groupOptions();
    // The page offers it only for the group it shows, which is one of the list
    const [target] = options.filter((option) => option.id === group.id);
    const before = this.blocks.value();
    // The copies go after the last block: those are what «Deshacer» deletes
    const lastPosition = Math.max(0, ...before.map((entry) => entry.block.position));
    let copied = 0;
    let sourceLabel = '';
    const ref = this.dialog.open<CopyBlocksDialog, CopyBlocksDialogData, boolean>(
      CopyBlocksDialog,
      {
        data: {
          target,
          blockCount: before.length,
          targetTitles: before.map((entry) => blockTitle(entry.block, this.locale).title),
          titlesOf: async (groupId) =>
            (await this.service.listBlocks(groupId)).map(
              (entry) => blockTitle(entry.block, this.locale).title,
            ),
          // Those of the same subject first, the most recent year first
          sources: options
            .filter((option) => option.id !== group.id)
            .sort(
              (a, b) =>
                Number(b.group.subject.id === group.subject.id) -
                  Number(a.group.subject.id === group.subject.id) ||
                b.group.schoolYear.localeCompare(a.group.schoolYear),
            ),
          copy: async (sourceGroupId, withDates) => {
            copied = await this.service.copyBlocks(sourceGroupId, group.id, withDates);
            // The dialog offers only these options
            sourceLabel = options.find((option) => option.id === sourceGroupId)!.label;
          },
        },
        injector: this.injector,
      },
    );
    if ((await firstValueFrom(ref.afterClosed())) !== true) return;
    if (copied === 0) {
      this.snackBar.open(
        $localize`:@@blocks.copied.none:Ese grupo no tiene bloques: no se ha copiado nada`,
      );
      return;
    }
    this.snackBar
      .open(
        copied === 1
          ? $localize`:@@blocks.copied.one:1 bloque copiado de ${sourceLabel}:group:`
          : $localize`:@@blocks.copied:${copied}:count: bloques copiados de ${sourceLabel}:group:`,
        $localize`:@@blocks.undo:Deshacer`,
        // The copies are at the end of the list: time to look at them before «Deshacer» goes
        { duration: LONG_SNACK_BAR_DURATION_MS },
      )
      .onAction()
      .subscribe(() => void this.undoCopy(group.id, lastPosition));
    await this.showCopies(group.id, lastPosition);
  }

  /**
   * The server gave the copies their ids: the blocks again, and the page goes to the first copy, so
   * what arrived is in sight while «Deshacer» is still there (5.2f).
   */
  private async showCopies(groupId: string, lastPosition: number): Promise<void> {
    try {
      const blocks = await this.service.listBlocks(groupId);
      this.blocks.set(blocks);
      this.revealBlock(blocks.find((entry) => entry.block.position > lastPosition)?.block.id);
    } catch {
      this.blocks.reload();
    }
  }

  /**
   * «Deshacer» of a copy (5.2f): the blocks after those the group had, which the server numbered;
   * nobody has had time to start them, but whatever somebody did start stays.
   */
  private async undoCopy(groupId: string, lastPosition: number): Promise<void> {
    try {
      const copies = (await this.service.listBlocks(groupId)).filter(
        (entry) => entry.block.position > lastPosition,
      );
      const removed = await this.service.removeBlocks(copies.map((entry) => entry.block.id));
      this.snackBar.open(
        removed === copies.length
          ? $localize`:@@blocks.copy.undone:Copia deshecha`
          : $localize`:@@blocks.copy.undone.partly:Copia deshecha, salvo los bloques que alguien ya ha empezado`,
      );
    } catch {
      this.failed();
    }
    this.blocks.reload();
  }

  // Deleting several -----------------------------------------------------------------------------

  protected toggleSelected(blockId: string, selected: boolean): void {
    this.selected.update((ids) => {
      const next = new Set(ids);
      if (selected) next.add(blockId);
      else next.delete(blockId);
      return next;
    });
  }

  /** Every block nobody started: those are the ones that can go. */
  protected selectUnstarted(): void {
    this.selected.set(
      new Set(
        this.rows()
          .filter((row) => !row.started)
          .map((row) => row.id),
      ),
    );
  }

  protected stopSelecting(): void {
    this.selecting.set(false);
    this.selected.set(EMPTY_SELECTION);
  }

  /** Asks first, as deleting one: their exercises go with them, and it cannot be undone. */
  protected async removeSelected(): Promise<void> {
    const ids = [...this.selected()];
    const confirmed = await confirmAction(this.dialog, {
      title:
        ids.length === 1
          ? $localize`:@@blocks.deleteMany.one:¿Borrar 1 bloque?`
          : $localize`:@@blocks.deleteMany.title:¿Borrar ${ids.length}:count: bloques?`,
      text: $localize`:@@blocks.deleteMany.text:Se quitan también sus ejercicios, que siguen en el banco. Nadie los ha empezado. No se puede deshacer.`,
      confirm: $localize`:@@blocks.delete.confirm:Borrar`,
    });
    if (!confirmed) return;
    try {
      const removed = await this.service.removeBlocks(ids);
      this.stopSelecting();
      if (removed === ids.length) {
        this.blocks.value.update((blocks) =>
          blocks.filter((entry) => !ids.includes(entry.block.id)),
        );
        this.snackBar.open($localize`:@@blocks.deletedMany:Bloques borrados: ${removed}:count:`);
      } else {
        this.snackBar.open(
          $localize`:@@blocks.deletedMany.partly:Bloques borrados: ${removed}:count:. Los demás ya tienen intentos.`,
        );
        this.blocks.reload();
      }
    } catch {
      this.failed();
      this.blocks.reload();
    }
  }

  protected async editBlock(planned: PlannedBlock): Promise<void> {
    const saved = await this.openBlockDialog(planned.block, async (draft) => {
      this.replaceBlock(await this.service.updateBlock(planned.block.id, draft));
    });
    if (saved) this.snackBar.open($localize`:@@blocks.saved:Bloque guardado`);
  }

  /** Shown or hidden at once; back as it was if the server says no. */
  protected async setBlockHidden(planned: PlannedBlock, isHidden: boolean): Promise<void> {
    const { title, sourceLocale, translations, opensAt } = planned.block;
    this.replaceBlock({ ...planned.block, isHidden });
    try {
      await this.service.updateBlock(planned.block.id, {
        title,
        sourceLocale,
        translations,
        isHidden,
        opensAt,
      });
    } catch {
      this.replaceBlock(planned.block);
      this.failed();
    }
  }

  protected async moveBlock(group: AssignedGroup, from: number, to: number): Promise<void> {
    const blocks = this.blocks.value();
    const moved = moveItem(blocks, from, to);
    if (moved.every((entry, index) => entry === blocks[index])) return;
    this.blocks.set(moved);
    const position = moved.indexOf(blocks[from]) + 1;
    this.announcer.announce(
      $localize`:@@blocks.moved:Bloque «${blockTitle(blocks[from].block, this.locale).title}:title:» en el lugar ${position}:position: de ${moved.length}:total:`,
    );
    try {
      await this.service.reorderBlocks(
        group.id,
        moved.map((entry) => entry.block.id),
      );
    } catch {
      this.blocks.set(blocks);
      this.failed();
    }
  }

  protected dropBlock(group: AssignedGroup, event: CdkDragDrop<unknown>): void {
    void this.moveBlock(group, event.previousIndex, event.currentIndex);
  }

  /** Asks first: its exercises go with it, and it cannot be undone. */
  protected async removeBlock(planned: PlannedBlock): Promise<void> {
    const title = blockTitle(planned.block, this.locale).title;
    const count = planned.assignments.length;
    const confirmed = await confirmAction(this.dialog, {
      title: $localize`:@@blocks.delete.title:¿Borrar «${title}:title:»?`,
      text:
        count === 0
          ? $localize`:@@blocks.delete.text:Está vacío. No se puede deshacer.`
          : count === 1
            ? $localize`:@@blocks.delete.withExercise:Se quita también su ejercicio, que sigue en el banco. Nadie lo ha empezado. No se puede deshacer.`
            : $localize`:@@blocks.delete.withExercises:Se quitan también sus ${count}:count: ejercicios, que siguen en el banco. Nadie los ha empezado. No se puede deshacer.`,
      confirm: $localize`:@@blocks.delete.confirm:Borrar`,
    });
    if (!confirmed) return;
    try {
      await this.service.removeBlock(planned.block.id);
      this.blocks.value.update((blocks) =>
        blocks.filter((entry) => entry.block.id !== planned.block.id),
      );
      this.snackBar.open($localize`:@@blocks.deleted:Bloque borrado`);
    } catch {
      this.snackBar.open(
        $localize`:@@blocks.delete.failed:No se ha podido borrar: puede que alguien acabe de empezar uno de sus ejercicios.`,
      );
      this.blocks.reload();
    }
  }

  // Assignments ----------------------------------------------------------------------------------

  protected async addExercises(group: AssignedGroup, planned: PlannedBlock): Promise<void> {
    const ref = this.dialog.open<AddExercisesDialog, AddExercisesData, AddExercisesResult>(
      AddExercisesDialog,
      {
        data: {
          blockTitle: blockTitle(planned.block, this.locale).title,
          subjectId: group.subject.id,
          subjectName: subjectName(group.subject, this.locale).name,
          assignedIds: planned.assignments.map((entry) => entry.exercise.id),
          elsewhere: this.blocksOfExercises(planned.block.id),
          locale: this.locale,
          userId: this.auth.userId(),
        },
        width: '42rem',
        injector: this.injector,
      },
    );
    const chosen = await firstValueFrom(ref.afterClosed());
    if (!chosen?.length) return;
    try {
      const created = await this.service.assign(
        planned.block.id,
        chosen.map((exercise) => exercise.id),
      );
      const added = created.map((assignment, index) => ({
        assignment,
        exercise: chosen[index],
        studentCount: 0,
      }));
      this.updateAssignments(planned.block.id, (entries) => [...entries, ...added]);
      // $localize has no plurals: one message for one and another for several
      this.snackBar.open(
        added.length === 1
          ? $localize`:@@blocks.assigned.one:1 ejercicio añadido`
          : $localize`:@@blocks.assigned.other:${added.length}:count: ejercicios añadidos`,
      );
    } catch {
      this.failed();
      this.blocks.reload();
    }
  }

  protected async moveAssignment(planned: PlannedBlock, from: number, to: number): Promise<void> {
    const entries = planned.assignments;
    const moved = moveItem(entries, from, to);
    if (moved.every((entry, index) => entry === entries[index])) return;
    this.updateAssignments(planned.block.id, () => moved);
    const title = exerciseText(entries[from].exercise, this.locale).title;
    this.announcer.announce(
      $localize`:@@blocks.exercise.moved:«${title}:title:» en el lugar ${moved.indexOf(entries[from]) + 1}:position: de ${moved.length}:total:`,
    );
    try {
      await this.service.reorderAssignments(
        planned.block.id,
        moved.map((entry) => entry.assignment.id),
      );
    } catch {
      this.updateAssignments(planned.block.id, () => entries);
      this.failed();
    }
  }

  protected dropAssignment(
    event: CdkDragDrop<PlannedBlock, PlannedBlock, PlannedAssignment>,
  ): void {
    if (event.previousContainer === event.container) {
      void this.moveAssignment(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      void this.moveToBlock(
        event.item.data,
        event.previousContainer.data,
        event.container.data,
        event.currentIndex,
      );
    }
  }

  /**
   * Moves an exercise to another block of the group, at `index` (the end, by default), started or
   * not: its attempts go with it. With «Deshacer», back to where it was.
   */
  protected async moveToBlock(
    entry: PlannedAssignment,
    source: PlannedBlock,
    target: PlannedBlock,
    index = target.assignments.length,
  ): Promise<void> {
    const sourceId = source.block.id;
    const from = source.assignments.indexOf(entry);
    const title = exerciseText(entry.exercise, this.locale).title;
    const blockName = blockTitle(target.block, this.locale).title;
    const before = this.blocks.value();
    this.updateAssignments(sourceId, (entries) => entries.filter((other) => other !== entry));
    const moved = { ...entry, assignment: { ...entry.assignment, blockId: target.block.id } };
    this.updateAssignments(target.block.id, (entries) => [
      ...entries.slice(0, index),
      moved,
      ...entries.slice(index),
    ]);
    this.announcer.announce(
      $localize`:@@blocks.exercise.movedTo:«${title}:title:» en «${blockName}:block:», en el lugar ${index + 1}:position: de ${target.assignments.length + 1}:total:`,
    );
    try {
      const assignment = await this.service.moveAssignment(
        entry.assignment.id,
        target.block.id,
        index + 1,
      );
      this.updateAssignments(target.block.id, (entries) =>
        entries.map((other) => (other === moved ? { ...moved, assignment } : other)),
      );
    } catch {
      this.blocks.set(before);
      this.failed();
      return;
    }
    this.snackBar
      .open(
        $localize`:@@blocks.exercise.movedSnack:«${title}:title:» movido a «${blockName}:block:»`,
        $localize`:@@blocks.undo:Deshacer`,
      )
      .onAction()
      .subscribe(() => void this.moveBack(entry.assignment.id, sourceId, from));
  }

  protected setAssignmentHidden(entry: PlannedAssignment, isHidden: boolean): Promise<void> {
    return this.changeAssignment(entry, { isHidden });
  }

  protected async chooseDueDate(entry: PlannedAssignment): Promise<void> {
    const text = exerciseText(entry.exercise, this.locale);
    const ref = this.dialog.open<DueDateDialog, DueDateDialogData, DueDateDialogResult>(
      DueDateDialog,
      {
        data: {
          title: text.title,
          lang: text.locale === this.locale ? null : text.locale,
          dueAt: entry.assignment.dueAt,
        },
        injector: this.injector,
      },
    );
    const dueAt = await firstValueFrom(ref.afterClosed());
    if (dueAt === undefined || dueAt === entry.assignment.dueAt) return;
    await this.changeAssignment(entry, { dueAt });
    this.snackBar.open(
      dueAt === null
        ? $localize`:@@blocks.due.removed:Fecha de entrega quitada`
        : $localize`:@@blocks.due.saved:Fecha de entrega guardada`,
    );
  }

  /** The same due date for every exercise of the block: the usual case of a topic. */
  protected async chooseBlockDueDate(planned: PlannedBlock): Promise<void> {
    const title = blockTitle(planned.block, this.locale);
    const dates = new Set(planned.assignments.map((entry) => entry.assignment.dueAt));
    const ref = this.dialog.open<DueDateDialog, DueDateDialogData, DueDateDialogResult>(
      DueDateDialog,
      {
        data: {
          title: $localize`:@@blocks.due.every:Todos los ejercicios de «${title.title}:title:»`,
          lang: null,
          // The date they share, if they share one
          dueAt: dates.size === 1 ? [...dates][0] : null,
        },
        injector: this.injector,
      },
    );
    const dueAt = await firstValueFrom(ref.afterClosed());
    if (dueAt === undefined) return;
    await Promise.all(planned.assignments.map((entry) => this.changeAssignment(entry, { dueAt })));
    this.snackBar.open(
      dueAt === null
        ? $localize`:@@blocks.due.removedAll:Fechas de entrega quitadas`
        : $localize`:@@blocks.due.savedAll:Fecha de entrega guardada en todo el bloque`,
    );
  }

  /** Nobody started it: it goes back to the bank, with «Deshacer» to put it back where it was. */
  protected async unassign(planned: PlannedBlock, entry: PlannedAssignment): Promise<void> {
    const order = planned.assignments.map((other) => other.assignment.id);
    try {
      await this.service.unassign(entry.assignment.id);
    } catch {
      this.snackBar.open(
        $localize`:@@blocks.unassign.failed:No se ha podido quitar: puede que alguien acabe de empezarlo.`,
      );
      this.blocks.reload();
      return;
    }
    this.updateAssignments(planned.block.id, (entries) =>
      entries.filter((other) => other.assignment.id !== entry.assignment.id),
    );
    const title = exerciseText(entry.exercise, this.locale).title;
    this.snackBar
      .open(
        $localize`:@@blocks.unassigned:«${title}:title:» quitado del bloque`,
        $localize`:@@blocks.undo:Deshacer`,
      )
      .onAction()
      .subscribe(() => void this.restore(planned.block.id, entry, order));
  }

  /** Assigns the exercise again, in its place and with its due date and visibility. */
  private async restore(
    blockId: string,
    entry: PlannedAssignment,
    order: readonly string[],
  ): Promise<void> {
    try {
      const [created] = await this.service.assign(blockId, [entry.exercise.id]);
      const { isHidden, dueAt } = entry.assignment;
      const assignment =
        isHidden || dueAt
          ? await this.service.updateAssignment(created.id, { isHidden, dueAt })
          : created;
      const ids = order.map((id) => (id === entry.assignment.id ? assignment.id : id));
      let restored: readonly PlannedAssignment[] = [];
      this.updateAssignments(blockId, (entries) => {
        restored = [...entries, { ...entry, assignment }].sort(
          (a, b) => ids.indexOf(a.assignment.id) - ids.indexOf(b.assignment.id),
        );
        return restored;
      });
      await this.service.reorderAssignments(
        blockId,
        restored.map((other) => other.assignment.id),
      );
    } catch {
      this.failed();
      this.blocks.reload();
    }
  }

  /**
   * «Deshacer» of a move: back to its block and place on the server, which knows where everything is
   * by now, and the page reloads from it.
   */
  private async moveBack(assignmentId: string, blockId: string, index: number): Promise<void> {
    try {
      await this.service.moveAssignment(assignmentId, blockId, index + 1);
    } catch {
      this.failed();
    }
    this.blocks.reload();
  }

  // Helpers --------------------------------------------------------------------------------------

  private assignmentRow(entry: PlannedAssignment, index: number, total: number) {
    const text = exerciseText(entry.exercise, this.locale);
    const due = entry.assignment.dueAt;
    return {
      entry,
      id: entry.assignment.id,
      number: index + 1,
      first: index === 0,
      last: index === total - 1,
      title: text.title,
      lang: text.locale === this.locale ? null : text.locale,
      due,
      archived: entry.exercise.archivedAt !== null,
      moveLabel: $localize`:@@blocks.exercise.moveTo:Mover «${text.title}:title:» a otro bloque`,
      actionsLabel: $localize`:@@blocks.exercise.actions:Acciones de «${text.title}:title:»`,
      dragLabel: $localize`:@@blocks.exercise.drag:Arrastrar «${text.title}:title:»`,
      dueLabel: $localize`:@@blocks.exercise.due:Fecha de entrega de «${text.title}:title:»`,
      visibilityLabel: entry.assignment.isHidden
        ? $localize`:@@blocks.exercise.show:Mostrar «${text.title}:title:» a los alumnos`
        : $localize`:@@blocks.exercise.hide:Ocultar «${text.title}:title:» a los alumnos`,
    };
  }

  /**
   * Brings a block to the top of the page with a smooth scroll, at once for whoever asks for less
   * motion, and gives its title the focus without a second jump (5.2f).
   */
  private revealBlock(blockId: string | null | undefined): void {
    afterNextRender(
      () => {
        const heading = this.document.getElementById(`block-${blockId}`);
        heading?.focus({ preventScroll: true });
        heading?.closest('li')?.scrollIntoView({
          behavior: prefersReducedMotion(this.document.defaultView) ? 'auto' : 'smooth',
          block: 'start',
        });
      },
      { injector: this.injector },
    );
  }

  private async openBlockDialog(
    block: ClassBlock | null,
    save: (draft: BlockDraft) => Promise<void>,
  ): Promise<boolean> {
    const ref = this.dialog.open<BlockDialog, BlockDialogData, boolean>(BlockDialog, {
      data: { block, locale: this.locale, save },
      injector: this.injector,
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  private async changeAssignment(
    entry: PlannedAssignment,
    changes: AssignmentChanges,
  ): Promise<void> {
    const blockId = entry.assignment.blockId;
    const replace = (assignment: PlannedAssignment['assignment']) =>
      this.updateAssignments(blockId, (entries) =>
        entries.map((other) =>
          other.assignment.id === assignment.id ? { ...other, assignment } : other,
        ),
      );
    replace({ ...entry.assignment, ...changes });
    try {
      replace(await this.service.updateAssignment(entry.assignment.id, changes));
    } catch {
      replace(entry.assignment);
      this.failed();
    }
  }

  /** The other blocks of the group where each exercise is, by title: «También en Tema 3». */
  private blocksOfExercises(exceptBlockId: string): ReadonlyMap<string, readonly string[]> {
    const titles = new Map<string, string[]>();
    for (const { block, assignments } of this.blocks.value()) {
      if (block.id === exceptBlockId) continue;
      const title = blockTitle(block, this.locale).title;
      for (const { exercise } of assignments) {
        titles.set(exercise.id, [...(titles.get(exercise.id) ?? []), title]);
      }
    }
    return titles;
  }

  private replaceBlock(block: ClassBlock): void {
    this.blocks.value.update((blocks) =>
      blocks.map((entry) => (entry.block.id === block.id ? { ...entry, block } : entry)),
    );
  }

  private updateAssignments(
    blockId: string,
    change: (entries: readonly PlannedAssignment[]) => readonly PlannedAssignment[],
  ): void {
    this.blocks.value.update((blocks) =>
      blocks.map((entry) =>
        entry.block.id === blockId ? { ...entry, assignments: change(entry.assignments) } : entry,
      ),
    );
  }

  private failed(): void {
    this.snackBar.open($localize`:@@blocks.failed:No se ha podido guardar. Inténtalo de nuevo.`);
  }
}

/** The id of the list of exercises of a block, for the drop lists to connect. */
function assignmentListId(blockId: string): string {
  return `assignments-${blockId}`;
}

function hasExercise(planned: PlannedBlock, exerciseId: string): boolean {
  return planned.assignments.some((entry) => entry.exercise.id === exerciseId);
}
