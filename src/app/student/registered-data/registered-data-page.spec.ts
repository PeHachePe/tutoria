import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';

import { AuthStore } from '../../auth/auth-store';
import type { RecognitionPlace } from '../../core/speech/speech-service';
import { FakeSpeechService, provideFakeSpeech } from '../../core/speech/speech-testing';
import { settingKey } from '../settings/settings-store';
import { RegisteredDataPage } from './registered-data-page';

describe('RegisteredDataPage', () => {
  const markPrivacyNoticeSeen = vi.fn(() => Promise.resolve());

  const fake = new FakeSpeechService();

  async function renderPage() {
    await render(RegisteredDataPage, {
      providers: [
        provideRouter([]),
        provideFakeSpeech(fake),
        { provide: AuthStore, useValue: { userId: signal('u1'), markPrivacyNoticeSeen } },
      ],
    });
  }

  afterEach(() => localStorage.clear());

  it('says what is recorded, what never is, what for, who sees it and which services take part', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Datos registrados' })).toBeTruthy();
    const recorded = screen.getByRole('region', { name: 'Se registra' });
    expect(within(recorded).getAllByRole('listitem')).toHaveLength(7);
    expect(within(recorded).getByText('Cuándo sales de la pantalla de trabajo')).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Nunca se registra' })).getByText(/El audio/),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Para qué' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Quién lo ve' })).toBeTruthy();
    const services = screen.getByRole('region', { name: 'Servicios externos' });
    expect(within(services).getAllByRole('listitem')).toHaveLength(2);
    expect(within(services).getByText('El modelo de IA del tutor')).toBeTruthy();
  });

  it('leads to the settings, where the student decides, and to the exercises', async () => {
    await renderPage();

    const choices = within(screen.getByRole('region', { name: 'Tú decides' }));
    expect(choices.getByRole('link', { name: 'Ir a los ajustes' }).getAttribute('href')).toBe(
      '/alumno/ajustes',
    );
    expect(choices.getByRole('link', { name: 'Ir a los ejercicios' }).getAttribute('href')).toBe(
      '/alumno',
    );
  });

  it('counts as seeing the notice on the registered data', async () => {
    await renderPage();

    expect(markPrivacyNoticeSeen).toHaveBeenCalled();
  });

  it('says what any browser may do with the voice off', async () => {
    await renderPage();

    const services = screen.getByRole('region', { name: 'Servicios externos' });
    expect(within(services).getByText(/puede enviar el audio a un servicio externo/)).toBeTruthy();
  });

  it.each([
    ['device', 'la transcribe en tu equipo: el audio no sale de él'],
    ['server', 'envía el audio a su servicio de reconocimiento'],
    ['downloadable', 'envía el audio a su servicio de reconocimiento'],
    ['none', 'Este navegador no reconoce la voz'],
  ] as const)('says what this browser does with the voice on, in %s', async (place, text) => {
    fake.place = place satisfies RecognitionPlace;
    localStorage.setItem(settingKey('voice', 'u1'), 'true');
    await renderPage();

    const services = screen.getByRole('region', { name: 'Servicios externos' });
    expect(await within(services).findByText(new RegExp(text))).toBeTruthy();
  });
});
