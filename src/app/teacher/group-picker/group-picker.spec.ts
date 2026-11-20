import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { type GroupChoice, GroupPicker, pickGroup } from './group-picker';

/** As the services give them: the most recent year first. */
const GROUPS: GroupChoice[] = [
  { id: 'next-web', label: '1.º DAW A · Desarrollo web', schoolYear: '2027/28' },
  { id: 'web', label: '1.º DAW A · Desarrollo web', schoolYear: '2026/27' },
  { id: 'basic', label: '1.º DAW A · Programación básica', schoolYear: '2026/27' },
  { id: 'old', label: '1.º DAW A · Programación básica', schoolYear: '2021/22' },
];
const AUTUMN_2026 = new Date(2026, 10, 20);

describe('pickGroup', () => {
  it('takes the group of the URL, of whatever year', () => {
    expect(pickGroup(GROUPS, 'old', AUTUMN_2026)?.id).toBe('old');
  });

  it('opens on the first group of the current year without one, or with an unknown one', () => {
    expect(pickGroup(GROUPS, undefined, AUTUMN_2026)?.id).toBe('web');
    expect(pickGroup(GROUPS, 'gone', AUTUMN_2026)?.id).toBe('web');
  });

  it('takes the nearest later year without groups this year, then the most recent', () => {
    const later = [
      { id: 'far', schoolYear: '2028/29' },
      { id: 'near', schoolYear: '2027/28' },
      { id: 'old', schoolYear: '2021/22' },
    ];

    expect(pickGroup(later, undefined, AUTUMN_2026)?.id).toBe('near');
    expect(pickGroup(later.slice(2), undefined, AUTUMN_2026)?.id).toBe('old');
    expect(pickGroup([], undefined, AUTUMN_2026)).toBeNull();
  });
});

describe('GroupPicker', () => {
  async function renderPicker(selectedId: string, groups = GROUPS, nameAlone = true) {
    const choose = vi.fn<(groupId: string) => void>();
    await render(GroupPicker, {
      inputs: { groups, selectedId, nameAlone },
      on: { choose },
    });
    return choose;
  }

  it('chooses the year and, in it, the group by its name alone', async () => {
    const choose = await renderPicker('web');

    await userEvent.click(screen.getByRole('combobox', { name: 'Curso' }));
    expect(
      (await screen.findAllByRole('option')).map((option) => option.textContent?.trim()),
    ).toEqual(['2027/28', '2026/27', '2021/22']);
    await userEvent.click(screen.getByRole('option', { name: '2021/22' }));
    expect(choose).toHaveBeenLastCalledWith('old');

    // The panel of the year may still be closing: the options of the group, in its own
    await userEvent.click(screen.getByRole('combobox', { name: 'Grupo' }));
    const groups = await screen.findByRole('listbox', { name: 'Grupo' });
    expect(
      within(groups)
        .getAllByRole('option')
        .map((option) => option.textContent?.trim()),
    ).toEqual(['1.º DAW A · Desarrollo web', '1.º DAW A · Programación básica']);
    await userEvent.click(
      within(groups).getByRole('option', { name: '1.º DAW A · Programación básica' }),
    );
    expect(choose).toHaveBeenLastCalledWith('basic');
  });

  it('shows the name of the only group of the year, without a selector', async () => {
    await renderPicker('old');

    expect(screen.queryByRole('combobox', { name: 'Grupo' })).toBeNull();
    expect(screen.getByText('1.º DAW A · Programación básica')).toBeTruthy();
  });

  it('shows nothing for a single group of a single year, if its name is elsewhere', async () => {
    await renderPicker('old', GROUPS.slice(3), false);

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('1.º DAW A · Programación básica')).toBeNull();
  });
});
