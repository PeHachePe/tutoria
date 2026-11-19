import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { AuthStore } from '../../auth/auth-store';
import { LanguageService } from '../../core/i18n/language-service';
import { FakeSpeechService, provideFakeSpeech } from '../../core/speech/speech-testing';
import { ThemeService } from '../../core/theme-service';
import { MASCOT_ACCESSORIES } from '../../shared/mascot/mascot-accessories';
import { sampleReaction, SettingsPage, voiceRegion } from './settings-page';
import { SettingsStore } from './settings-store';

describe('SettingsPage', () => {
  const setLocale = vi.fn();
  let fake: FakeSpeechService;

  beforeEach(() => {
    fake = new FakeSpeechService();
    fake.voiceList = [
      { id: 'monica', name: 'Mónica', lang: 'es-ES' },
      { id: 'jorge', name: 'Jorge', lang: 'es-MX' },
      { id: 'eddy', name: 'Eddy (español (España))', lang: 'es-ES' },
    ];
  });

  async function renderPage() {
    await render(SettingsPage, {
      providers: [
        provideRouter([]),
        provideFakeSpeech(fake),
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

  it('lets the student turn the proactive tutor off', async () => {
    const { user, settings } = await renderPage();

    await user.click(screen.getByRole('switch', { name: /por iniciativa propia/ }));
    expect(settings.proactive()).toBe(false);
  });

  describe('voice', () => {
    async function turnVoiceOn() {
      const page = await renderPage();
      const toggle = screen.getByRole('switch', { name: 'Hablar con el tutor por voz' });
      expect(toggle.getAttribute('aria-describedby')).toContain('settings-voice-hint');
      await page.user.click(toggle);
      await screen.findByRole('radiogroup', { name: 'Voz del tutor' });
      return { ...page, toggle };
    }

    it('shows its controls when turned on, without moving the focus, with the most natural voice', async () => {
      const { settings, toggle } = await turnVoiceOn();
      expect(settings.voice()).toBe(true);
      expect(document.activeElement).toBe(toggle);
      expect(screen.getByText(/la que suena más natural en tu navegador/)).toBeTruthy();
      const voices = within(group('Voz del tutor')).getAllByRole('radio');
      expect(voices.map((voice) => (voice as HTMLInputElement).checked)).toEqual([true, false]);
      expect(screen.getByText(/¿Suenan robóticas\?/)).toBeTruthy();
      expect(screen.getByRole('radio', { name: /Jorge · México/ })).toBeTruthy();
      expect(screen.getByText(/Si usas un lector de pantalla/)).toBeTruthy();
    });

    it('says it is looking for the voices', async () => {
      const { user } = await renderPage();
      await user.click(screen.getByRole('switch', { name: 'Hablar con el tutor por voz' }));
      expect(screen.getByText('Buscando las voces de tu navegador…')).toBeTruthy();
    });

    it('saves the chosen voice and tries it', async () => {
      const { user, settings } = await turnVoiceOn();
      await user.click(option('Voz del tutor', 'Jorge'));
      expect(settings.tutorVoice()).toBe('jorge');
      expect(fake.spoken.at(-1)?.options.voiceId).toBe('jorge');
      expect(screen.queryByText(/la que suena más natural/)).toBeNull();
    });

    it('shows a robotic voice if the student chose it', async () => {
      const { user, settings } = await renderPage();
      settings.setTutorVoice('eddy');
      await user.click(screen.getByRole('switch', { name: 'Hablar con el tutor por voz' }));
      expect(await screen.findByRole('radio', { name: /Eddy/ })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Ver todas las voces/ })).toBeNull();
    });

    it('hides the robotic voices until asked for, unless it is the chosen one', async () => {
      const { user, settings } = await turnVoiceOn();
      expect(screen.queryByRole('radio', { name: /Eddy/ })).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Ver todas las voces (1 más)' }));
      await user.click(option('Voz del tutor', 'Eddy'));
      expect(settings.tutorVoice()).toBe('eddy');
      expect(screen.queryByRole('button', { name: /Ver todas las voces/ })).toBeNull();
    });

    it('tries a voice with the chosen speed', async () => {
      const { user, settings } = await turnVoiceOn();
      await user.click(option('Velocidad', 'Rápida'));
      expect(settings.speechRate()).toBe('fast');
      await user.click(screen.getByRole('button', { name: 'Probar la voz Jorge' }));
      expect(fake.spoken.at(-1)).toEqual({
        sentence: 'Hola, soy tu tutor. ¿Seguimos con el ejercicio?',
        options: { voiceId: 'jorge', rate: 'fast' },
      });
    });

    it('says when the browser has no voices of the language', async () => {
      fake.voiceList = [{ id: 'alex', name: 'Alex', lang: 'en-US' }];
      const { user } = await renderPage();
      await user.click(screen.getByRole('switch', { name: 'Hablar con el tutor por voz' }));
      expect(
        await screen.findByText('Tu navegador no tiene voces en español: el tutor te escribirá.'),
      ).toBeTruthy();
    });

    it('saves reading the answers aloud', async () => {
      const { user, settings } = await turnVoiceOn();
      const readAloud = screen.getByRole('switch', { name: 'Leer las respuestas en voz alta' });
      expect(readAloud.getAttribute('aria-describedby')).toBe('settings-read-aloud-hint');
      await user.click(readAloud);
      expect(settings.readAloud()).toBe(true);
    });

    it('folds, silences the tutor and keeps the choice when turned off', async () => {
      const { user, settings, toggle } = await turnVoiceOn();
      await user.click(option('Voz del tutor', 'Jorge'));
      const stops = fake.stops;
      await user.click(toggle);
      expect(settings.voice()).toBe(false);
      expect(fake.stops).toBe(stops + 1);
      expect(screen.queryByRole('radiogroup', { name: 'Voz del tutor' })).toBeNull();
      expect(settings.tutorVoice()).toBe('jorge');
    });

    it('names the region of a voice only when it has one its name does not say', () => {
      const voice = (name: string, lang: string) => ({ id: name, name, lang });
      expect(voiceRegion(voice('Mónica', 'es-ES'), 'es')).toBe('España');
      expect(voiceRegion(voice('Mónica', 'es-ES'), 'en')).toBe('Spain');
      expect(voiceRegion(voice('Eddy (español (España))', 'es-ES'), 'es')).toBeUndefined();
      expect(voiceRegion(voice('Mónica', 'es'), 'es')).toBeUndefined();
      expect(voiceRegion(voice('Mónica', 'es-419'), 'es')).toBeUndefined();
    });
  });

  it('leads to the registered data', async () => {
    await renderPage();

    expect(
      screen.getByRole('link', { name: /Ver los datos registrados/ }).getAttribute('href'),
    ).toBe('/alumno/datos');
  });
});
