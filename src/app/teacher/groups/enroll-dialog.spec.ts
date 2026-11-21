import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DataError } from '../../data/data-error';
import {
  type ClassCandidate,
  MAX_PASTED_LINES,
  type PreviousClass,
  type StudentMatch,
  type UserRef,
} from '../../data/group-service';
import { EnrollDialog, type EnrollDialogData } from './enroll-dialog';

const TARGET = 'Matricular en 1.º DAW A · 2026/27';

const STUDENTS: UserRef[] = [
  { id: 'a', name: 'Ana Ruiz', email: 'ana@tutoria.test' },
  { id: 'b', name: 'Bruno Sanz', email: 'bruno@tutoria.test' },
];

const CANDIDATES: UserRef[] = [
  ...STUDENTS,
  { id: 'c', name: 'Carla Núñez', email: 'carla@tutoria.test' },
];

/** A student and where they come from (5.2g): nowhere, unless it is said. */
function fresh(student: UserRef, previous: PreviousClass | null = null): ClassCandidate {
  return { student, previous };
}

const FOUND = STUDENTS.map((student) => fresh(student));

const NO_CLASS = 'Sin clase este curso';
const ALL_HAVE_CLASS = 'Todo el alumnado activo tiene ya una clase este curso.';

/** Those without a class this year, as for a class. */
function candidates(load: () => Promise<readonly UserRef[]>): EnrollDialogData['candidates'] {
  return {
    label: NO_CLASS,
    empty: ALL_HAVE_CLASS,
    load: async () => (await load()).map((student) => fresh(student)),
  };
}

function open(overrides: Partial<EnrollDialogData> = {}) {
  const data: EnrollDialogData = {
    targetName: '1.º DAW A · 2026/27',
    intro: 'Entran en todas sus asignaturas.',
    enrolledIds: new Set(),
    schoolYear: '2026/27',
    sources: [],
    studentsOf: () => Promise.resolve([]),
    candidates: candidates(() => Promise.resolve([])),
    search: vi.fn(() => Promise.resolve(FOUND)),
    match: vi.fn(() => Promise.resolve<StudentMatch[]>([])),
    enroll: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  TestBed.inject(MatDialog).open<EnrollDialog, EnrollDialogData, boolean>(EnrollDialog, { data });
  return data;
}

/** The dialog, once it has the focus: typing before that loses the keys after the move. */
async function opened(): Promise<HTMLElement> {
  const dialog = await screen.findByRole('dialog', { name: TARGET });
  await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return dialog;
}

async function tab(dialog: HTMLElement, name: string): Promise<void> {
  const label = within(dialog).getByRole('tab', { name });
  await userEvent.click(label);
  await vi.waitFor(() => expect(label.getAttribute('aria-selected')).toBe('true'));
}

async function typeSearch(text: string): Promise<HTMLElement> {
  const dialog = await opened();
  await tab(dialog, 'Buscar');
  if (text) await userEvent.type(within(dialog).getByRole('searchbox'), text);
  return dialog;
}

/** Pastes a list in its tab, as from a spreadsheet. */
async function paste(dialog: HTMLElement, list: string): Promise<void> {
  await tab(dialog, 'Pegar una lista');
  const field = within(dialog).getByRole('textbox', { name: 'Correos o nombres, uno por línea' });
  await userEvent.clear(field);
  await userEvent.click(field);
  await userEvent.paste(list);
}

/** The students chosen, in order, as the buttons of their chips name them. */
function chosen(dialog: HTMLElement): string[] {
  return within(dialog)
    .queryAllByRole('button', { name: /^Quitar a / })
    .map((button) => button.getAttribute('aria-label')!.replace('Quitar a ', ''));
}

describe('EnrollDialog', () => {
  it('says what enrolling there does, and does not search below the minimum', async () => {
    const data = open();
    const dialog = await typeSearch('a');
    expect(within(dialog).getByText('Entran en todas sus asignaturas.')).toBeTruthy();
    // Defensive: the template reads the results only once they arrive
    const instance = TestBed.inject(MatDialog).openDialogs[0].componentInstance as EnrollDialog;
    expect(instance['foundStudents']()).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(data.search).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Escribe al menos dos letras')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Matricular (0)' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('offers first those to choose from with one click, under the name it is given', async () => {
    open({
      candidates: {
        label: 'De esta clase',
        empty: 'Toda la clase está ya en este grupo.',
        load: () => Promise.resolve([]),
      },
    });
    const dialog = await opened();

    expect(
      within(dialog)
        .getAllByRole('tab')
        .map((label) => label.textContent?.trim()),
    ).toEqual(['De esta clase', 'Pegar una lista', 'Buscar']);
    expect(within(dialog).getByRole('tab', { name: 'De esta clase' })).toHaveProperty(
      'ariaSelected',
      'true',
    );
    expect(await within(dialog).findByText('Toda la clase está ya en este grupo.')).toBeTruthy();
  });

  it('chooses and removes, and enrolls the two chosen', async () => {
    let fail!: (error: unknown) => void;
    const data = open({
      enroll: vi.fn(() => new Promise<void>((_, reject) => (fail = reject))),
    });
    const dialog = await typeSearch('an');
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /Ana Ruiz/ }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Bruno Sanz/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Quitar a Bruno Sanz' }));
    expect(within(dialog).getByRole('checkbox', { name: /Bruno Sanz/ })).toHaveProperty(
      'checked',
      false,
    );
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Bruno Sanz/ }));
    expect(within(dialog).getByText('Elegidos (2)')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matricular (2)' }));

    expect(data.search).toHaveBeenCalledWith('an');
    expect(data.enroll).toHaveBeenCalledWith([STUDENTS[0], STUDENTS[1]]);
    expect(await within(dialog).findByText('Matriculando…')).toBeTruthy();
    fail(new DataError('invalid'));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Vuelve a buscarlo');
  });

  it('takes all the chosen out at once', async () => {
    open();
    const dialog = await typeSearch('an');
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /Ana Ruiz/ }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Bruno Sanz/ }));

    await userEvent.click(within(dialog).getByRole('button', { name: 'Quitar todos' }));

    expect(within(dialog).queryByText(/Elegidos/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Matricular (0)' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('says nobody matches, and that the search failed', async () => {
    let calls = 0;
    open({
      search: () => (calls++ === 0 ? Promise.resolve([]) : Promise.reject(new Error('boom'))),
    });
    const dialog = await typeSearch('zz');
    // The visible text, not the count announced to screen readers, which starts the same
    expect(
      await within(dialog).findByText(
        'Ningún alumno activo coincide. Las cuentas las crea y las vuelve a activar la administración.',
      ),
    ).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('searchbox'), 'z');
    expect(await within(dialog).findByText(/No se ha podido buscar/)).toBeTruthy();
  });

  describe('without a class this year', () => {
    it('lists those not there yet, first, and chooses them all or some', async () => {
      open({
        enrolledIds: new Set(['b']),
        candidates: candidates(() => Promise.resolve(CANDIDATES)),
      });
      const dialog = await opened();
      expect(within(dialog).getByRole('tab', { name: NO_CLASS })).toHaveProperty(
        'ariaSelected',
        'true',
      );
      const all = await within(dialog).findByRole('checkbox', { name: 'Seleccionar todos (2)' });
      expect(within(dialog).queryByRole('checkbox', { name: /Bruno Sanz/ })).toBeNull();

      // One of them: the box of all says so, half chosen
      await userEvent.click(within(dialog).getByRole('checkbox', { name: /Ana Ruiz/ }));
      expect(all).toHaveProperty('indeterminate', true);
      expect(all).toHaveProperty('checked', false);

      await userEvent.click(all);
      expect(all).toHaveProperty('checked', true);
      expect(all).toHaveProperty('indeterminate', false);
      expect(chosen(dialog)).toEqual(['Ana Ruiz', 'Carla Núñez']);
      expect(within(dialog).getByRole('button', { name: 'Matricular (2)' })).toBeTruthy();

      await userEvent.click(all);
      expect(all).toHaveProperty('checked', false);
      expect(chosen(dialog)).toEqual([]);
    });

    it('chooses all those the filter shows only, keeping the others chosen', async () => {
      open({ candidates: candidates(() => Promise.resolve(CANDIDATES)) });
      const dialog = await opened();
      await userEvent.click(await within(dialog).findByRole('checkbox', { name: /Bruno Sanz/ }));

      const filter = within(dialog).getByRole('searchbox', { name: 'Filtrar' });
      await userEvent.type(filter, 'CARLA');
      expect(within(dialog).queryByRole('checkbox', { name: /Ana Ruiz/ })).toBeNull();
      await userEvent.click(
        within(dialog).getByRole('checkbox', { name: 'Seleccionar todos (1)' }),
      );
      expect(chosen(dialog)).toEqual(['Bruno Sanz', 'Carla Núñez']);

      // Nobody shown: nothing to choose
      await userEvent.type(filter, 'zz');
      expect(within(dialog).getByText('Nadie coincide')).toBeTruthy();
      const all = within(dialog).getByRole('checkbox', { name: 'Seleccionar todos (0)' });
      expect(all).toHaveProperty('disabled', true);
      expect(all).toHaveProperty('checked', false);
    });

    it('waits for them, and says when all have a class or they could not be read', async () => {
      let arrive!: (students: readonly UserRef[]) => void;
      open({
        enrolledIds: new Set(['a', 'b']),
        candidates: candidates(
          () => new Promise<readonly UserRef[]>((resolve) => (arrive = resolve)),
        ),
      });
      const dialog = await opened();
      expect(within(dialog).getByRole('progressbar')).toBeTruthy();
      // Defensive: the template reads them only once they arrive
      const instance = TestBed.inject(MatDialog).openDialogs[0].componentInstance as EnrollDialog;
      expect(instance['freeCandidates']()).toEqual([]);
      arrive(STUDENTS);
      expect(await within(dialog).findByText(ALL_HAVE_CLASS)).toBeTruthy();
      TestBed.inject(MatDialog).closeAll();
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      open({ candidates: candidates(() => Promise.reject(new Error('boom'))) });
      const failed = await opened();
      expect(
        await within(failed).findByText('No se ha podido leer el alumnado. Inténtalo de nuevo.'),
      ).toBeTruthy();
    });
  });

  describe('a pasted list', () => {
    it('chooses those its lines name and says which named nobody', async () => {
      const data = open({
        enrolledIds: new Set(['b']),
        match: vi.fn(() =>
          Promise.resolve([
            { entry: 'ana@tutoria.test', ...fresh(STUDENTS[0]) },
            { entry: 'bruno sanz', ...fresh(STUDENTS[1]) },
          ]),
        ),
      });
      const dialog = await opened();
      await tab(dialog, 'Pegar una lista');
      const find = within(dialog).getByRole('button', { name: 'Buscar en la lista' });
      expect(find).toHaveProperty('disabled', true);

      await paste(dialog, ' ANA@tutoria.test \r\n\nBruno Sanz\nNadie Nunca\n');
      await userEvent.click(find);

      expect(data.match).toHaveBeenCalledWith(['ANA@tutoria.test', 'Bruno Sanz', 'Nadie Nunca']);
      // Bruno is there already
      const result = await within(dialog).findByRole('status');
      expect(result.textContent).toContain('1 elegido');
      expect(result.textContent).toContain('Sin una cuenta de alumno (o con más de una):');
      expect(within(dialog).getByRole('listitem').textContent).toBe('Nadie Nunca');
      expect(chosen(dialog)).toEqual(['Ana Ruiz']);

      // A new list leaves the result of the last one
      await paste(dialog, 'Bruno Sanz');
      expect(within(dialog).queryByRole('status')).toBeNull();
    });

    it('says how many it chose, none new among them', async () => {
      const data = open({
        match: (entries) =>
          Promise.resolve(entries.map((entry, index) => ({ entry, ...fresh(CANDIDATES[index]) }))),
      });
      const dialog = await opened();

      await paste(dialog, 'ana@tutoria.test\nbruno@tutoria.test');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar en la lista' }));
      const result = await within(dialog).findByRole('status');
      expect(result.textContent?.trim()).toBe('2 elegidos');
      expect(within(dialog).queryByText(/Sin una cuenta/)).toBeNull();

      await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar en la lista' }));
      expect((await within(dialog).findByRole('status')).textContent?.trim()).toBe(
        'Ninguno nuevo elegido',
      );
      expect(data.enroll).not.toHaveBeenCalled();
      expect(chosen(dialog)).toEqual(['Ana Ruiz', 'Bruno Sanz']);
    });

    it('reads no more than the lines it takes, and says when it could not', async () => {
      let calls = 0;
      const match = vi.fn(() =>
        calls++ === 0
          ? Promise.reject(new DataError('network'))
          : Promise.resolve<StudentMatch[]>([]),
      );
      open({ match });
      const dialog = await opened();

      await paste(dialog, 'Ana Ruiz');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar en la lista' }));
      expect((await within(dialog).findByRole('alert')).textContent).toContain('Sin conexión');

      const lines = Array.from({ length: MAX_PASTED_LINES + 1 }, (_, index) => `s${index}`);
      await paste(dialog, lines.join('\n'));
      expect(
        within(dialog).getByText(`Como mucho ${MAX_PASTED_LINES} líneas de una vez.`),
      ).toBeTruthy();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar en la lista' }));
      expect(match).toHaveBeenCalledTimes(1);
    });
  });

  it('chooses the students of another class who are not here, or says it could not', async () => {
    let calls = 0;
    open({
      enrolledIds: new Set(['a']),
      sources: [{ id: 'dam', label: '1.º DAM B · 2026/27' }],
      studentsOf: () =>
        calls++ === 0 ? Promise.resolve(FOUND) : Promise.reject(new Error('boom')),
    });
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce');
    const dialog = await opened();
    await tab(dialog, 'De otra clase');
    const copy = () =>
      userEvent.click(
        within(dialog).getByRole('button', { name: 'Añadir los de 1.º DAM B · 2026/27' }),
      );

    await copy();
    expect(await within(dialog).findByRole('button', { name: 'Matricular (1)' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Quitar a Bruno Sanz' })).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('1 elegidos de 1.º DAM B · 2026/27');
    expect(within(dialog).getByRole('status').textContent?.trim()).toBe(
      '1 elegido de 1.º DAM B · 2026/27',
    );

    await copy();
    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'No se ha podido leer esa clase',
    );
  });

  describe('where each comes from (5.2g)', () => {
    const LAST_YEAR = (outcome: PreviousClass['outcome']): PreviousClass => ({
      name: '1.º DAW A',
      schoolYear: '2025/26',
      outcome,
    });
    const THIS_YEAR: PreviousClass = { name: '1.º DAM B', schoolYear: '2026/27', outcome: null };
    const DANI = { id: 'd', name: 'Dani Gil', email: 'dani@tutoria.test' };
    const ELSA = { id: 'e', name: 'Elsa Mora', email: 'elsa@tutoria.test' };

    it('lists those without a class by the class they come from, each with its box', async () => {
      open({
        candidates: {
          label: NO_CLASS,
          empty: ALL_HAVE_CLASS,
          load: () =>
            Promise.resolve([
              fresh(STUDENTS[0], LAST_YEAR('promotes')),
              fresh(STUDENTS[1], LAST_YEAR('promotes')),
              fresh(CANDIDATES[2]),
            ]),
        },
      });
      const dialog = await opened();
      const promoted = await within(dialog).findByRole('checkbox', {
        name: 'Promocionan de 1.º DAW A · 2025/26 (2)',
      });
      expect(within(dialog).getByRole('checkbox', { name: 'Sin clase anterior (1)' })).toBeTruthy();

      await userEvent.click(within(dialog).getByRole('checkbox', { name: /Ana Ruiz/ }));
      expect(promoted).toHaveProperty('indeterminate', true);
      await userEvent.click(promoted);
      expect(promoted).toHaveProperty('checked', true);
      expect(chosen(dialog)).toEqual(['Ana Ruiz', 'Bruno Sanz']);
      await userEvent.click(promoted);
      expect(chosen(dialog)).toEqual([]);
    });

    it('says in a search where each is, and does not choose who is in another class of the year', async () => {
      open({
        search: () =>
          Promise.resolve([
            fresh(STUDENTS[0], LAST_YEAR('leaves')),
            fresh(STUDENTS[1], THIS_YEAR),
            fresh(DANI, LAST_YEAR(null)),
          ]),
      });
      const dialog = await typeSearch('ru');

      // Who left can come back: chosen, with the warning at sight
      const ana = await within(dialog).findByRole('checkbox', { name: /Ana Ruiz/ });
      expect(within(dialog).getByText(/Baja · 1\.º DAW A · 2025\/26/)).toBeTruthy();
      expect(ana).toHaveProperty('disabled', false);
      expect(within(dialog).getByRole('checkbox', { name: /Bruno Sanz/ })).toHaveProperty(
        'disabled',
        true,
      );
      expect(within(dialog).getByText(/Ya está en 1\.º DAM B · 2026\/27/)).toBeTruthy();
      expect(within(dialog).getByText(/^\s*1\.º DAW A · 2025\/26\s*$/)).toBeTruthy();
    });

    it('lets a group take a student of any class', async () => {
      open({ schoolYear: null, search: () => Promise.resolve([fresh(STUDENTS[1], THIS_YEAR)]) });
      const dialog = await typeSearch('br');

      expect(await within(dialog).findByRole('checkbox', { name: /Bruno Sanz/ })).toHaveProperty(
        'disabled',
        false,
      );
      expect(within(dialog).getByText(/^\s*1\.º DAM B · 2026\/27\s*$/)).toBeTruthy();
    });

    it('leaves out of a pasted list who finished or has a class, and says why', async () => {
      open({
        enrolledIds: new Set(['e']),
        match: () =>
          Promise.resolve([
            { entry: 'ana', ...fresh(STUDENTS[0], LAST_YEAR('graduates')) },
            { entry: 'bruno', ...fresh(STUDENTS[1], THIS_YEAR) },
            { entry: 'dani', ...fresh(DANI, LAST_YEAR('repeats')) },
            // In this class already: neither chosen nor said to be in another
            { entry: 'elsa', ...fresh(ELSA, { ...THIS_YEAR, name: '1.º DAW A' }) },
          ]),
      });
      const dialog = await opened();
      await paste(dialog, 'ana\nbruno\ndani\nelsa');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Buscar en la lista' }));

      expect((await within(dialog).findByRole('status')).textContent).toContain('1 elegido');
      expect(chosen(dialog)).toEqual(['Dani Gil']);
      expect(within(dialog).getByText(/No se añaden/)).toBeTruthy();
      expect(
        within(dialog)
          .getAllByRole('listitem')
          .map((item) => item.textContent?.trim()),
      ).toEqual([
        'Ana Ruiz · Titula · 1.º DAW A · 2025/26',
        'Bruno Sanz · Ya está en 1.º DAM B · 2026/27',
      ]);
    });

    it('leaves out of another class who finished in their last class', async () => {
      open({
        schoolYear: '2027/28',
        sources: [{ id: 'old', label: '1.º DAW A · 2024/25' }],
        studentsOf: () =>
          Promise.resolve([
            // Promoted in the class copied, and left the school the year after
            fresh(STUDENTS[0], { name: '2.º DAW A', schoolYear: '2025/26', outcome: 'leaves' }),
            fresh(STUDENTS[1], LAST_YEAR('promotes')),
          ]),
      });
      const dialog = await opened();
      await tab(dialog, 'De otra clase');
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Añadir los de 1.º DAW A · 2024/25' }),
      );

      expect((await within(dialog).findByRole('status')).textContent?.trim()).toBe(
        '1 elegido de 1.º DAW A · 2024/25',
      );
      expect(chosen(dialog)).toEqual(['Bruno Sanz']);
      expect(within(dialog).getByText('Ana Ruiz · Baja · 2.º DAW A · 2025/26')).toBeTruthy();
    });
  });

  it('closes once they are enrolled', async () => {
    const data = open();
    const ref = TestBed.inject(MatDialog).openDialogs[0];
    const closed = vi.fn();
    ref.afterClosed().subscribe(closed);
    const dialog = await typeSearch('an');
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /Ana Ruiz/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matricular (1)' }));

    await vi.waitFor(() => expect(closed).toHaveBeenCalledWith(true));
    expect(data.enroll).toHaveBeenCalledWith([STUDENTS[0]]);
  });
});
