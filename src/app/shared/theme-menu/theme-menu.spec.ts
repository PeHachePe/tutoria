import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { ThemeService } from '../../core/theme-service';
import { ThemeMenu } from './theme-menu';

describe('ThemeMenu', () => {
  async function renderMenu() {
    localStorage.clear();
    await render(ThemeMenu);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cambiar el tema' }));
    return user;
  }

  afterEach(() => localStorage.clear());

  it('marks the current mode', async () => {
    await renderMenu();

    expect(screen.getByRole('menuitemradio', { name: /Tema del sistema/ }).ariaChecked).toBe(
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: /Tema oscuro/ }).ariaChecked).toBe('false');
    // Each option keeps its icon; the current one also has a check at the end
    expect(screen.getByRole('menuitemradio', { name: /Tema del sistema/ }).textContent).toMatch(
      /contrast.*check/,
    );
    expect(screen.getByRole('menuitemradio', { name: /Tema oscuro/ }).textContent).not.toContain(
      'check',
    );
  });

  it('changes the mode and shows its icon on the button', async () => {
    const user = await renderMenu();

    await user.click(screen.getByRole('menuitemradio', { name: /Tema oscuro/ }));

    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
    expect(screen.getByRole('button', { name: 'Cambiar el tema' }).textContent).toContain(
      'dark_mode',
    );
  });
});
