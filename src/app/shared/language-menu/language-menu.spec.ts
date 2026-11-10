import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { LanguageService } from '../../core/i18n/language-service';
import { LanguageMenu } from './language-menu';

describe('LanguageMenu', () => {
  const setLocale = vi.fn();

  async function renderMenu() {
    await render(LanguageMenu, {
      providers: [{ provide: LanguageService, useValue: { locale: 'es', setLocale } }],
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cambiar el idioma' }));
    return user;
  }

  afterEach(() => setLocale.mockReset());

  it('offers each language in its own language, with its lang, and marks the current one', async () => {
    await renderMenu();

    const spanish = screen.getByRole('menuitemradio', { name: /Español/ });
    const catalan = screen.getByRole('menuitemradio', { name: /Català/ });
    expect(spanish.ariaChecked).toBe('true');
    expect(catalan.ariaChecked).toBe('false');
    expect(spanish.textContent).toContain('check');
    expect(catalan.textContent).not.toContain('check');
    expect(catalan.getAttribute('lang')).toBe('ca');
    expect(screen.getByRole('menuitemradio', { name: /English/ }).getAttribute('lang')).toBe('en');
  });

  it('changes the language', async () => {
    const user = await renderMenu();

    await user.click(screen.getByRole('menuitemradio', { name: /English/ }));

    expect(setLocale).toHaveBeenCalledWith('en');
  });
});
