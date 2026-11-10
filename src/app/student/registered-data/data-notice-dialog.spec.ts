import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { AuthStore } from '../../auth/auth-store';
import { SettingsStore } from '../settings/settings-store';
import { DataNoticeDialog } from './data-notice-dialog';

@Component({ template: '' })
class Page {}

describe('DataNoticeDialog', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'alumno/datos', component: Page }]),
        { provide: AuthStore, useValue: { userId: signal('u1') } },
      ],
    });
    TestBed.inject(MatDialog).open(DataNoticeDialog);
  });

  afterEach(() => localStorage.clear());

  it('sums up the registered data, who sees it and what reaches the AI provider', async () => {
    const notice = await screen.findByRole('dialog', { name: 'Antes de empezar: tus datos' });

    expect(notice.textContent).toContain('Nunca graba el audio');
    expect(notice.textContent).toContain('tu docente y la administración');
    expect(notice.textContent).toContain('un proveedor externo de inteligencia artificial');
    expect(screen.getByRole('link', { name: 'Ver los detalles' }).getAttribute('href')).toBe(
      '/alumno/datos',
    );
  });

  it('counts as seen when the student goes to the details', async () => {
    await userEvent.setup().click(await screen.findByRole('link', { name: 'Ver los detalles' }));

    expect(TestBed.inject(SettingsStore).dataNoticeSeen()).toBe(true);
  });
});
