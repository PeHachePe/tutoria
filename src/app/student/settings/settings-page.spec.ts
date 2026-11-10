import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { AuthStore } from '../../auth/auth-store';
import { LanguageService } from '../../core/i18n/language-service';
import { ThemeService } from '../../core/theme-service';
import { MASCOT_ACCESSORIES } from '../../shared/mascot/mascot-accessories';
import { sampleReaction, SettingsPage } from './settings-page';
import { SettingsStore } from './settings-store';

describe('SettingsPage', () => {
  const setLocale = vi.fn();

  async function renderPage() {
    await render(SettingsPage, {
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { userId: signal('u1') } },
        { provide: LanguageService, useValue: { locale: 'es', setLocale } },
        {
          provide: MASCOT_ACCESSORIES,
          useFactory: () => {
            const settings = TestBed.inject(SettingsStore);
            return {
              headset: settings.mascotHeadset,
              bowTie: settings.mascotBowTie,
              boneCursor: settings.mascotBoneCursor,
            };
          },
        },
      ],
    });
    return { user: userEvent.setup(), settings: TestBed.inject(SettingsStore) };
  }

  const group = (name: string) => screen.getByRole('radiogroup', { name });
  const option = (groupName: string, name: string) =>
    within(group(groupName)).getByRole('radio', { name: new RegExp(name) });

  afterEach(() => {
    localStorage.clear();
    setLocale.mockReset();
  });

  it('changes the theme and the language', async () => {
    const { user } = await renderPage();
    const theme = TestBed.inject(ThemeService);

    await user.click(option('Tema', 'Oscuro'));
    expect(theme.mode()).toBe('dark');
    expect(option('Tema', 'Oscuro').ariaChecked).toBe('true');

    expect(option('Idioma', 'Español').ariaChecked).toBe('true');
    await user.click(option('Idioma', 'Català'));
    expect(setLocale).toHaveBeenCalledWith('ca');
  });

  it('chooses how the reactions show, explains each mode and turns the rest off without them', async () => {
    const { user, settings } = await renderPage();
    const emojis = screen.getByRole('switch', { name: 'Emojis animados' });

    expect(screen.getByText('Emojis, confeti y efectos de 2 a 3 segundos.')).toBeTruthy();
    await user.click(emojis);
    expect(settings.reactionEmojis()).toBe(false);

    await user.click(option('Reacciones del tutor', 'Desactivadas'));
    expect(settings.reactions()).toBe('off');
    expect(screen.getByText('El tutor responde sin reacciones.')).toBeTruthy();
    expect(emojis.hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Probar una reacción' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('plays sample reactions, one after another, and says the tutor picks the intensity', async () => {
    const { user } = await renderPage();
    const overlay = document.querySelector('app-reaction-overlay') as HTMLElement;
    const tryIt = screen.getByRole('button', { name: 'Probar una reacción' });

    await user.click(tryIt);
    await user.click(tryIt);

    expect(overlay.childElementCount).toBeGreaterThan(0);
    expect(tryIt.getAttribute('aria-describedby')).toBe('settings-try-hint');
    expect(document.getElementById('settings-try-hint')?.textContent).toContain('intensidad');
  });

  it('goes through every intensity, each with another cheerful reaction', () => {
    const tries = [0, 1, 2, 3].map(sampleReaction);

    expect(tries.map((sample) => sample.intensity)).toEqual([1, 2, 3, 1]);
    expect(new Set(tries.map((sample) => sample.kind)).size).toBe(4);
  });

  it('dresses the mascot, and the preview shows it at once', async () => {
    const { user, settings } = await renderPage();

    await user.click(screen.getByRole('switch', { name: 'Auriculares con micro' }));
    await user.click(screen.getByRole('switch', { name: 'Pajarita de cuadros' }));
    await user.click(screen.getByRole('switch', { name: 'Puntero de hueso al pasar por encima' }));

    expect(settings.mascotHeadset()).toBe(false);
    expect(settings.mascotBowTie()).toBe(false);
    expect(settings.mascotBoneCursor()).toBe(false);
    // The drawing is decorative: its accessories carry a data-testid (4.8)
    expect(screen.queryByTestId('mascot-headset')).toBeNull();
    expect(screen.queryByTestId('mascot-bow-tie')).toBeNull();
    expect(document.querySelector('app-mascot')?.classList).not.toContain('mascot-bone');
  });

  it('lets the student turn the proactive tutor off, and shows the voice as coming soon', async () => {
    const { user, settings } = await renderPage();

    await user.click(screen.getByRole('switch', { name: /por iniciativa propia/ }));
    expect(settings.proactive()).toBe(false);

    const voice = screen.getByRole('switch', { name: 'Hablar con el tutor por voz' });
    expect(voice.hasAttribute('disabled')).toBe(true);
    expect(voice.getAttribute('aria-describedby')).toContain('settings-voice-hint');
  });

  it('leads to the registered data', async () => {
    await renderPage();

    expect(
      screen.getByRole('link', { name: /Ver los datos registrados/ }).getAttribute('href'),
    ).toBe('/alumno/datos');
  });
});
