import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import { CopyBlocksDialog, type CopyBlocksDialogData } from './copy-blocks-dialog';

const [basic] = SUBJECTS;

function source(id: string, schoolYear: string) {
  return {
    group: { id, name: '1.º DAW A', label: null, schoolYear, subject: basic },
    label: `1.º DAW A · ${schoolYear}`,
  };
}

describe('CopyBlocksDialog', () => {
  it('says it is copying while it waits for the server', async () => {
    const copy = vi.fn<CopyBlocksDialogData['copy']>(() => new Promise(() => undefined));
    TestBed.inject(MatDialog).open<CopyBlocksDialog, CopyBlocksDialogData, boolean>(
      CopyBlocksDialog,
      {
        data: {
          target: source('next', '2027/28'),
          blockCount: 1,
          sources: [source('last', '2026/27')],
          copy,
        },
      },
    );
    const dialog = await screen.findByRole('dialog');
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(within(dialog).getByText(/después del bloque que ya tiene/)).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Copiar de' }));
    await userEvent.click(await screen.findByRole('option', { name: '1.º DAW A · 2026/27' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copiar los bloques' }));

    expect(await within(dialog).findByText('Copiando…')).toBeTruthy();
    expect(copy).toHaveBeenCalledWith('last', true);
  });
});
