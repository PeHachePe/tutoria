import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';

import { AuthStore } from '../../auth/auth-store';
import { RegisteredDataPage } from './registered-data-page';

describe('RegisteredDataPage', () => {
  const markPrivacyNoticeSeen = vi.fn(() => Promise.resolve());

  async function renderPage() {
    await render(RegisteredDataPage, {
      providers: [
        provideRouter([]),
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
});
