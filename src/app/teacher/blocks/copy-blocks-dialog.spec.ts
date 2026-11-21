import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import { CopyBlocksDialog, type CopyBlocksDialogData } from './copy-blocks-dialog';

const [basic] = SUBJECTS;

function source(id: string, schoolYear: string) {
  return {
    group: { id, name: '1.º DAW A', label: null, schoolYear, open: true, subject: basic },
    label: `1.º DAW A · ${schoolYear}`,
  };
}

async function openDialog(data: Partial<CopyBlocksDialogData> = {}): Promise<HTMLElement> {
  TestBed.inject(MatDialog).open<CopyBlocksDialog, CopyBlocksDialogData, boolean>(
    CopyBlocksDialog,
    {
      data: {
        target: source('next', '2027/28'),
        blockCount: 1,
        targetTitles: ['Tema 1: Bucles'],
        titlesOf: () => Promise.resolve([]),
        sources: [source('last', '2026/27')],
        copy: () => Promise.resolve(),
        ...data,
      },
    },
  );
  const dialog = await screen.findByRole('dialog');
  await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return dialog;
}

async function chooseLastYear(dialog: HTMLElement): Promise<void> {
  await userEvent.click(within(dialog).getByRole('combobox', { name: 'Copiar de' }));
  await userEvent.click(await screen.findByRole('option', { name: '1.º DAW A · 2026/27' }));
}

describe('CopyBlocksDialog', () => {
  it('says it is copying while it waits for the server', async () => {
    const copy = vi.fn<CopyBlocksDialogData['copy']>(() => new Promise(() => undefined));
    const dialog = await openDialog({ copy });
    expect(within(dialog).getByText(/después del bloque que ya tiene/)).toBeTruthy();

    await chooseLastYear(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar los bloques' }));

    expect(await within(dialog).findByText('Copiando…')).toBeTruthy();
    expect(copy).toHaveBeenCalledWith('last', true);
  });

  it('warns of the titles the group has already, without stopping the copy (5.2f)', async () => {
    const titlesOf = vi.fn<CopyBlocksDialogData['titlesOf']>(() =>
      Promise.resolve([' tema 1: bucles', 'Tema 2: Vectores', ' tema 1: bucles']),
    );
    const dialog = await openDialog({ titlesOf });
    expect(within(dialog).getByRole('status').textContent?.trim()).toBe('');

    await chooseLastYear(dialog);

    const status = within(dialog).getByRole('status');
    await vi.waitFor(() => expect(status.textContent).toContain('Este grupo ya tiene «tema 1'));
    expect(status.textContent).not.toContain('Vectores');
    expect(titlesOf).toHaveBeenCalledWith('last');
    expect(
      within(dialog).getByRole('button', { name: 'Copiar los bloques' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('warns of nothing when the titles do not arrive: the copy works the same', async () => {
    const dialog = await openDialog({ titlesOf: () => Promise.reject(new Error('offline')) });

    await chooseLastYear(dialog);

    await new Promise((resolve) => setTimeout(resolve));
    expect(within(dialog).getByRole('status').textContent?.trim()).toBe('');
  });
});
