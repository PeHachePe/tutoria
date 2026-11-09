import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { DOCUMENT } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatButtonToggleHarness } from '@angular/material/button-toggle/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { provideRouter } from '@angular/router';
import { within } from '@testing-library/angular';

import { provideSessionOf } from '../../auth/auth-testing';
import { ThemeService } from '../../core/theme-service';
import { ShowcasePage } from './showcase-page';

describe('ShowcasePage', () => {
  let fixture: ComponentFixture<ShowcasePage>;
  let loader: HarnessLoader;
  let overlays: HarnessLoader;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideSessionOf(null),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(ShowcasePage);
    loader = TestbedHarnessEnvironment.loader(fixture);
    overlays = TestbedHarnessEnvironment.documentRootLoader(fixture);
    await fixture.whenStable();
  });

  afterEach(() => localStorage.clear());

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows the page title and one heading per section', () => {
    const element = fixture.nativeElement as HTMLElement;
    const headings = [...element.querySelectorAll('h2')].map((h) => h.textContent?.trim());

    expect(element.querySelector('h1')?.textContent).toContain('Muestrario de la interfaz');
    expect(headings).toEqual([
      'Colores',
      'Tipografía',
      'Botones',
      'Piezas propias con Tailwind',
      'Mascota',
      'Reacciones',
      'Tarjetas y pestañas',
      'Formulario con Signal Forms',
      'Tabla con ordenación y paginación',
      'Progreso, avisos y diálogos',
      'Editor de código',
      'Resultados de las pruebas',
      'Carga, vacío y error',
    ]);
  });

  it('shows a zone with scroll shadows that the keyboard can reach and scroll', () => {
    const element = fixture.nativeElement as HTMLElement;
    const zone = element.querySelector<HTMLElement>('.scroll-shadows');

    expect(zone?.getAttribute('tabindex')).toBe('0');
    expect(zone?.getAttribute('aria-label')).toBe('Ejemplo de zona con sombras de desplazamiento');
    expect(zone?.querySelectorAll('p')).toHaveLength(8);
  });

  it('shows the code editor, editable and read only, and the states of the save indicator', () => {
    const page = within(fixture.nativeElement as HTMLElement);
    const editable = page.getByRole('textbox', { name: 'Código de ejemplo editable' });
    const readonly = page.getByRole('textbox', { name: 'Código de ejemplo de solo lectura' });

    expect(editable.textContent).toContain('function suma(vector)');
    expect(editable.getAttribute('aria-readonly')).toBeNull();
    expect(readonly.getAttribute('aria-readonly')).toBe('true');
    expect(text()).toContain('Guardando…');
    expect(text()).toContain('Guardado');
    expect(text()).toContain('No se ha guardado');
  });

  it('offers the language menu of the app, to see the pieces in each language', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('button[aria-label="Cambiar el idioma"]')).toBeTruthy();
  });

  it('shows the brand of the shells in its bar', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('header a app-mascot')?.parentElement?.textContent).toContain(
      'TutorIA',
    );
  });

  it('switches the colour mode from the toggle group', async () => {
    const root = TestBed.inject(DOCUMENT).documentElement;
    const dark = await loader.getHarness(MatButtonToggleHarness.with({ text: /Oscuro/ }));

    await dark.check();

    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
    expect(await dark.isChecked()).toBe(true);
  });

  it('shows the mascot in each mood and with each accessory', async () => {
    const element = fixture.nativeElement as HTMLElement;
    // Only those of its section: the brand of the bar has another one
    const section = element.querySelector('[aria-labelledby="mascot-title"]') as HTMLElement;
    const mascots = () => [...section.querySelectorAll('app-mascot')];
    // The mascot is decorative (aria-hidden), so its accessories are found by data-testid (4.8)
    const count = (testId: string) => section.querySelectorAll(`[data-testid="${testId}"]`).length;

    expect(mascots()).toHaveLength(2);
    expect(count('mascot-headset')).toBe(2);
    expect(count('mascot-bow-tie')).toBe(0);

    await (await loader.getHarness(MatButtonToggleHarness.with({ text: 'Pensando' }))).check();
    expect(mascots().every((mascot) => mascot.classList.contains('mascot-thinking'))).toBe(true);

    await (await loader.getHarness(MatSlideToggleHarness.with({ label: 'Auriculares' }))).toggle();
    await (await loader.getHarness(MatSlideToggleHarness.with({ label: 'Pajarita' }))).toggle();
    expect(count('mascot-headset')).toBe(0);
    expect(count('mascot-bow-tie')).toBe(2);
  });

  it('plays each reaction of the catalog with the real overlay, and turns them off', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const section = element.querySelector('[aria-labelledby="reactions-title"]') as HTMLElement;
    const mascot = section.querySelector('app-mascot') as HTMLElement;
    // The overlay is decorative (aria-hidden): only its data-testid finds it (4.8)
    const pieces = () =>
      section.querySelectorAll('[data-testid="reaction-overlay"] .reaction-piece').length;
    const play = async (label: string) => {
      await (await loader.getHarness(MatButtonHarness.with({ text: new RegExp(label) }))).click();
      await fixture.whenStable();
    };

    for (const label of ['Corazones', 'Bola de papel', 'Ojos vigilantes', 'Enfado de broma']) {
      expect(
        await loader.getHarness(MatButtonHarness.with({ text: new RegExp(label) })),
      ).toBeTruthy();
    }
    await (await loader.getHarness(MatButtonToggleHarness.with({ text: 'Intensidad 1' }))).check();
    await play('Trofeo');
    const playing = pieces();
    expect(playing).toBeGreaterThan(0);
    expect(mascot.classList).toContain('mascot-move-cheer');

    // Turned off: the reaction on screen finishes, but no new one comes, nor does the mascot move
    await (await loader.getHarness(MatButtonToggleHarness.with({ text: 'Desactivadas' }))).check();
    await play('Ánimo');
    expect(pieces()).toBe(playing);
    expect(mascot.classList).not.toContain('mascot-move-hop');
  });

  it('confirms the submission in the dialog', async () => {
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Entregar…' }))).click();
    const dialog = await overlays.getHarness(MatDialogHarness);

    expect(await dialog.getTitleText()).toBe('¿Entregar el ejercicio?');
    await (await dialog.getHarness(MatButtonHarness.with({ text: 'Entregar' }))).click();

    await vi.waitFor(() => expect(text()).toContain('Ejercicio entregado'));
  });

  it('reports a cancelled submission', async () => {
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Entregar…' }))).click();
    const dialog = await overlays.getHarness(MatDialogHarness);

    await (await dialog.getHarness(MatButtonHarness.with({ text: 'Cancelar' }))).click();

    await vi.waitFor(() => expect(text()).toContain('Entrega cancelada'));
  });

  it('shows the loading, empty and error states, and replays the loading', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const before = element.querySelector('app-loading-skeleton');

    await (await loader.getHarness(MatButtonHarness.with({ text: 'Repetir la carga' }))).click();
    const retry = MatButtonHarness.with({
      text: 'Reintentar',
      ancestor: '[aria-labelledby="states-title"]',
    });
    await (await loader.getHarness(retry)).click();

    expect(element.querySelector('app-loading-skeleton')).not.toBe(before);
    expect(text()).toContain('Aún no tienes ejercicios asignados');
    expect(text()).toContain('No hay conexión');
    expect(text()).toContain('Reintentos: 1');
  });

  it('shows a snack bar notice', async () => {
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Mostrar aviso' }))).click();
    const snackBar = await overlays.getHarness(MatSnackBarHarness);

    expect(await snackBar.getMessage()).toBe('Código guardado');
    expect(await snackBar.getActionDescription()).toBe('Cerrar');
  });
});
