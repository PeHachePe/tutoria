import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatButtonToggleHarness } from '@angular/material/button-toggle/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideRouter } from '@angular/router';

import { SEED } from '../../data/mock/fixtures/seed';
import { DAW_STUDENT_IDS, TEACHER_ID } from '../../data/mock/fixtures/users';
import { MockDb } from '../../data/mock/mock-db';
import { MockNetwork } from '../../data/mock/mock-network';
import { DevToolbar } from './dev-toolbar';
import { PageReloader } from '../../core/page-reloader';

describe('DevToolbar', () => {
  let fixture: ComponentFixture<DevToolbar>;
  let loader: HarnessLoader;
  let db: MockDb;
  const reload = vi.fn();
  const openHome = vi.fn();

  beforeEach(async () => {
    localStorage.clear();
    reload.mockReset();
    openHome.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: PageReloader, useValue: { reload, openHome } },
        provideRouter([]),
      ],
    });
    db = TestBed.inject(MockDb);
    fixture = TestBed.createComponent(DevToolbar);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  afterEach(() => localStorage.clear());

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function toggleButton(): HTMLButtonElement {
    return element().querySelector('button[aria-label="Herramientas de desarrollo"]')!;
  }

  async function openPanel(): Promise<void> {
    toggleButton().click();
    await fixture.whenStable();
  }

  function select(label: string): Promise<MatSelectHarness> {
    return loader.getHarness(MatSelectHarness.with({ label }));
  }

  it('starts closed, as a disclosure button inside its own landmark', () => {
    expect(element().querySelector('aside')?.getAttribute('aria-label')).toBe(
      'Herramientas de desarrollo',
    );
    expect(toggleButton().getAttribute('aria-expanded')).toBe('false');
    expect(toggleButton().getAttribute('aria-controls')).toBe('dev-toolbar-panel');
    expect(element().querySelector('#dev-toolbar-panel')).toBeNull();
  });

  it('opens the panel with its sections', async () => {
    await openPanel();

    expect(toggleButton().getAttribute('aria-expanded')).toBe('true');
    expect(element().querySelector('#dev-toolbar-panel h2')?.textContent).toBe(
      'Herramientas de desarrollo',
    );
    expect([...element().querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'Páginas de desarrollo',
      'Sesión',
      'Red simulada',
      'Datos simulados',
      'Herramientas del tutor y WebMCP',
      'Últimos eventos',
    ]);
    expect(element().textContent).toContain('Sin sesión');
  });

  it('links to the development pages', async () => {
    await openPanel();

    const links = [...element().querySelectorAll('nav a')].map((a) => [
      a.textContent?.trim(),
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([['Muestrario', '/dev/ui']]);
  });

  it('closes with the close button or Escape, giving the focus back to the toggle', async () => {
    await openPanel();
    const close = await loader.getHarness(
      MatButtonHarness.with({ selector: '[aria-label="Cerrar las herramientas de desarrollo"]' }),
    );
    await close.click();
    expect(element().querySelector('#dev-toolbar-panel')).toBeNull();
    expect(document.activeElement).toBe(toggleButton());

    await openPanel();
    element()
      .querySelector('#dev-toolbar-panel')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(element().querySelector('#dev-toolbar-panel')).toBeNull();
    expect(document.activeElement).toBe(toggleButton());
  });

  it('ignores Escape while the panel is closed', async () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();

    toggleButton().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  describe('session', () => {
    it('lists the active users by role and group', async () => {
      await openPanel();
      const users = await select('Entrar como');
      await users.open();

      const groups = await users.getOptionGroups();
      const labels = await Promise.all(groups.map((group) => group.getLabelText()));
      expect(labels).toEqual([
        'Administración',
        'Profesorado',
        'Alumnado de 1.º DAW A',
        'Alumnado de 1.º DAM B',
      ]);
      const options = await users.getOptions();
      expect(options).toHaveLength(1 + 1 + 2 + 24 + 6);
      expect(await options[0].getText()).toBe('Sin sesión');
      const names = await Promise.all(options.map((option) => option.getText()));
      expect(names).not.toContain('Raúl Medina Cortés');
    });

    it('signs in as the chosen user and opens the home of their role from scratch', async () => {
      await openPanel();

      await (await select('Entrar como')).clickOptions({ text: 'Lucía Martín Gómez' });

      expect(db.sessionUserId()).toBe(DAW_STUDENT_IDS[0]);
      expect(openHome).toHaveBeenCalledOnce();
      expect(reload).not.toHaveBeenCalled();
      expect(element().textContent).toContain('lucia.martin@tutoria.test');
    });

    it('shows "Sin sesión" in the selector when nobody is signed in', async () => {
      await openPanel();

      expect(await (await select('Entrar como')).getValueText()).toBe('Sin sesión');
    });

    it('signs out and opens the home, which leads to the login', async () => {
      db.setSession(TEACHER_ID);
      await openPanel();
      expect(await (await select('Entrar como')).getValueText()).toBe('Marta Ibáñez Soler');

      await (await select('Entrar como')).clickOptions({ text: 'Sin sesión' });

      expect(db.sessionUserId()).toBeNull();
      expect(openHome).toHaveBeenCalledOnce();
    });
  });

  describe('simulated network', () => {
    it('marks the current latency and changes it', async () => {
      await openPanel();
      const normal = await loader.getHarness(MatButtonToggleHarness.with({ text: 'Normal' }));
      const none = await loader.getHarness(MatButtonToggleHarness.with({ text: 'Sin espera' }));
      expect(await normal.isChecked()).toBe(true);

      await none.check();

      expect(TestBed.inject(MockNetwork).latency()).toEqual({ min: 0, max: 0 });
      expect(await normal.isChecked()).toBe(false);
    });

    it('marks no latency option when the latency is a custom one', async () => {
      TestBed.inject(MockNetwork).setLatency({ min: 10, max: 20 });
      await openPanel();

      const toggles = await loader.getAllHarnesses(MatButtonToggleHarness);
      const checked = await Promise.all(toggles.map((toggle) => toggle.isChecked()));
      expect(checked).toEqual([false, false, false]);
    });

    it('makes the next request fail with the chosen kind of error', async () => {
      const network = TestBed.inject(MockNetwork);
      await openPanel();
      const failure = await select('Fallar la siguiente petición');
      expect(await failure.getValueText()).toBe('No');

      await failure.clickOptions({ text: 'No encontrado' });
      expect(network.failNext()).toBe('not_found');

      await failure.clickOptions({ text: 'No' });
      expect(network.failNext()).toBeNull();
    });
  });

  it('resets the mock data and reloads the page', async () => {
    db.update('attempts', () => []);
    await openPanel();
    const reset = await loader.getHarness(MatButtonHarness.with({ text: /Reiniciar datos/ }));

    await reset.click();

    expect(db.tables()).toEqual(SEED);
    expect(reload).toHaveBeenCalledOnce();
  });

  describe('latest events', () => {
    function items(): string[] {
      return [...element().querySelectorAll('ol li')].map((li) =>
        (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
      );
    }

    it('shows the eight most recent events with the student and the time', async () => {
      await openPanel();

      const latest = [...SEED.events].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      const attempt = SEED.attempts.find((a) => a.id === latest.attemptId);
      const student = SEED.users.find((u) => u.id === attempt?.userId);
      expect(items()).toHaveLength(8);
      expect(items()[0]).toContain(student!.name);
      expect(element().querySelector('ol time')?.getAttribute('datetime')).toBe(latest.timestamp);
    });

    it('shows new events as they arrive, even for an unknown attempt', async () => {
      await openPanel();

      db.update('events', (events) => [
        ...events,
        {
          id: 'new',
          attemptId: 'missing',
          type: 'paste',
          timestamp: '2026-12-01T10:00:00.000Z',
          detail: { length: 12 },
        },
      ]);
      await fixture.whenStable();

      expect(items()[0]).toMatch(
        /^Pegado de 12 caracteres · Intento desconocido 01\/12 \d\d:00:00$/,
      );
    });

    it('says when there are no events', async () => {
      db.update('events', () => []);
      await openPanel();

      expect(items()).toEqual(['Todavía no hay eventos.']);
    });
  });
});
