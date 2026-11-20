import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import { AdminService } from '../../data/admin-service';
import { DataError } from '../../data/data-error';
import { ADMIN_ID } from '../../data/mock/fixtures/users';
import { MockAdminService } from '../../data/mock/mock-admin-service';
import { MockDb } from '../../data/mock/mock-db';
import { MockNetwork } from '../../data/mock/mock-network';
import { SystemPage } from './system-page';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('SystemPage', () => {
  let service: MockAdminService;
  let harness: RouterTestingHarness;

  async function renderSystem(prepare: (admin: MockAdminService) => void = () => undefined) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'admin/sistema', component: SystemPage }]),
        provideSessionOf('admin', { id: ADMIN_ID }),
        MockAdminService,
        { provide: AdminService, useExisting: MockAdminService },
      ],
    });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    TestBed.inject(MockDb).setSession(ADMIN_ID);
    service = TestBed.inject(MockAdminService);
    prepare(service);
    await restoreSession();
    harness = await RouterTestingHarness.create('/admin/sistema');
    await settle();
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await harness.fixture.whenStable();
    }
  }

  function button(name: string | RegExp): HTMLButtonElement {
    return screen.getByRole('button', { name });
  }

  function isDisabled(element: HTMLElement): boolean {
    return element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('disabled');
  }

  async function checkConnection(): Promise<void> {
    await userEvent.click(button('Probar la conexión'));
    await settle();
  }

  /** The names of the subjects, in their order, as their «Editar» buttons say them. */
  function subjectNames(): string[] {
    return within(screen.getByRole('list', { name: 'Asignaturas' }))
      .getAllByRole('button', { name: /^Editar / })
      .map((edit) => edit.getAttribute('aria-label')!.replace('Editar ', ''));
  }

  afterEach(() => localStorage.clear());

  /** The names given, in the order of the list: by name in Spanish. */
  function byName(names: readonly string[]): string[] {
    return [...names].sort((a, b) => a.localeCompare(b, 'es'));
  }

  it('shows the provider of the seed and its subjects by name', async () => {
    await renderSystem();

    expect(screen.getByRole('heading', { level: 2, name: 'Proveedor de IA' })).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Modelo principal' }).value).toBe(
      'gemini-3.5-flash-lite',
    );
    expect(screen.getByRole('group', { name: 'Respaldo 2' })).toBeTruthy();
    // All of the seed, by name in Spanish
    expect(subjectNames()).toEqual(byName(subjectNames()));
    expect(subjectNames()).toHaveLength(21);
    expect(subjectNames().slice(0, 2)).toEqual(['Acceso a datos', 'Bases de datos']);
    expect(screen.getAllByText('En español, inglés, catalán')).toHaveLength(21);
  });

  it('loads and fails each section on its own, with its retry', async () => {
    await renderSystem((admin) => {
      vi.spyOn(admin, 'getAiProvider').mockRejectedValueOnce(new DataError('unavailable'));
      vi.spyOn(admin, 'listSubjects').mockResolvedValueOnce([]);
    });

    expect(screen.getByText('Aún no hay asignaturas')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Modelo principal' })).toBeNull();
    await userEvent.click(button('Reintentar'));
    await settle();
    expect(screen.getByRole('textbox', { name: 'Modelo principal' })).toBeTruthy();
  });

  it('marks the language of a name that is not the one of the interface', async () => {
    const english = { id: 'db', name: 'Databases', sourceLocale: 'en' as const, translations: {} };
    await renderSystem((admin) => {
      vi.spyOn(admin, 'listSubjects')
        .mockRejectedValueOnce(new DataError('unavailable'))
        .mockResolvedValueOnce([english]);
    });

    expect(screen.getByRole('textbox', { name: 'Modelo principal' })).toBeTruthy();
    await userEvent.click(button('Reintentar'));
    await settle();
    expect(screen.getByText('Databases').getAttribute('lang')).toBe('en');
    expect(screen.getByText('En inglés')).toBeTruthy();
  });

  it('opens Gemini without a model while no provider is saved, to set the first one', async () => {
    await renderSystem((admin) => vi.spyOn(admin, 'getAiProvider').mockResolvedValueOnce(null));

    expect(text(screen.getAllByRole('combobox', { name: 'Proveedor' })[0])).toBe('Gemini');
    const model = screen.getByRole<HTMLInputElement>('textbox', { name: 'Modelo principal' });
    expect(model.value).toBe('');
    expect(screen.queryByRole('group', { name: /^Respaldo/ })).toBeNull();

    await userEvent.type(model, 'gemini-3.5-flash-lite');
    await checkConnection();
    const setProvider = vi.spyOn(service, 'setAiProvider');
    await userEvent.click(button('Guardar'));
    await settle();
    expect(setProvider).toHaveBeenCalledWith({
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      model: 'gemini-3.5-flash-lite',
      timeoutMs: 15000,
    });
  });

  it('fills in a preset, and lets its URL be written only with «Other»', async () => {
    await renderSystem();
    const url = screen.getByRole<HTMLInputElement>('textbox', { name: 'URL base' });
    expect(url.disabled).toBe(true);

    await userEvent.click(screen.getAllByRole('combobox', { name: 'Proveedor' })[0]);
    await userEvent.click(await screen.findByRole('option', { name: 'Groq' }));
    expect(url.value).toBe('https://api.groq.com/openai/v1');
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Nombre del secreto con la clave' })
        .value,
    ).toBe('AI_GROQ_API_KEY');

    await userEvent.click(screen.getAllByRole('combobox', { name: 'Proveedor' })[0]);
    await userEvent.click(await screen.findByRole('option', { name: 'Otro' }));
    expect(url.disabled).toBe(false);
  });

  it('saves only after a check of the draft, and checks again after any change', async () => {
    await renderSystem();
    const save = button('Guardar');
    const model = screen.getByRole('textbox', { name: 'Modelo principal' });
    expect(isDisabled(save)).toBe(true);
    expect(screen.getByText('No hay cambios que guardar')).toBeTruthy();
    const setProvider = vi.spyOn(service, 'setAiProvider');
    await userEvent.click(save);
    expect(setProvider).not.toHaveBeenCalled();

    // What is saved can be tested too, though there is nothing to save
    await checkConnection();
    const status = screen.getByRole('status');
    expect(text(status)).toContain('gemini-3.5-flash-lite: Responde en');
    expect(within(status).getAllByRole('listitem')).toHaveLength(3);
    expect(isDisabled(save)).toBe(true);

    await userEvent.type(model, '-2');
    expect(text(screen.getByRole('status'))).toBe('');
    expect(screen.getByText('Prueba la conexión antes de guardar')).toBeTruthy();
    expect(isDisabled(save)).toBe(true);
    await checkConnection();
    expect(isDisabled(save)).toBe(false);

    // Picking the same provider again saves the same: the check still counts
    await userEvent.click(screen.getAllByRole('combobox', { name: 'Proveedor' })[0]);
    await userEvent.click(await screen.findByRole('option', { name: 'Gemini' }));
    expect(isDisabled(save)).toBe(false);

    const snackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    await userEvent.click(save);
    await settle();
    expect(setProvider).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-3.5-flash-lite-2' }),
    );
    expect(snackBar).toHaveBeenCalledWith('Proveedor de IA guardado');
    // Saved as tested: the results stay, and there is nothing else to save or discard
    expect(text(screen.getByRole('status'))).toContain('gemini-3.5-flash-lite-2: Responde en');
    expect(screen.getByText('No hay cambios que guardar')).toBeTruthy();
    expect(isDisabled(button('Descartar los cambios'))).toBe(true);
  });

  it('marks what is missing instead of testing or saving, and takes the focus there', async () => {
    await renderSystem();
    const checkProvider = vi.spyOn(service, 'checkAiProvider');
    const model = screen.getByRole('textbox', { name: 'Modelo principal' });
    await userEvent.clear(model);
    await userEvent.click(button('Añadir un respaldo'));
    await settle();

    await userEvent.click(button('Probar la conexión'));
    await settle();
    expect(checkProvider).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(model);
    expect(screen.getAllByText('Escribe el modelo')).toHaveLength(2);

    // Enter in a field submits the form: with something missing, the same
    await userEvent.type(screen.getByRole('textbox', { name: 'Modelo principal' }), 'x');
    await userEvent.type(document.activeElement as HTMLElement, '{Enter}');
    await settle();
    expect(document.activeElement?.id).toBe('fallback-model-2');
  });

  it('does not save when the main model fails, and says why', async () => {
    await renderSystem();
    const model = screen.getByRole('textbox', { name: 'Modelo principal' });
    await userEvent.clear(model);
    await userEvent.type(model, 'gemini-fail');

    await checkConnection();
    expect(text(screen.getByRole('status'))).toContain('El proveedor no conoce ese modelo.');
    expect(screen.getByText(/El modelo principal no responde/)).toBeTruthy();
    expect(isDisabled(button('Guardar'))).toBe(true);

    await userEvent.click(button('Descartar los cambios'));
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Modelo principal' }).value).toBe(
      'gemini-3.5-flash-lite',
    );
  });

  it('saves when only a fallback fails, which it says', async () => {
    await renderSystem();
    const fallback = within(screen.getByRole('group', { name: 'Respaldo 1' })).getByRole(
      'textbox',
      {
        name: 'Modelo',
      },
    );
    await userEvent.clear(fallback);
    await userEvent.type(fallback, 'gemma-fail');

    await checkConnection();
    expect(text(screen.getByRole('status'))).toContain(
      'gemma-fail: El proveedor no conoce ese modelo.',
    );
    expect(screen.queryByText(/El modelo principal no responde/)).toBeNull();
    const setProvider = vi.spyOn(service, 'setAiProvider');
    await userEvent.click(button('Guardar'));
    await settle();
    expect(setProvider).toHaveBeenCalled();
  });

  it('says when the check or the save fails', async () => {
    await renderSystem();
    vi.spyOn(service, 'checkAiProvider').mockRejectedValueOnce(new DataError('rate_limited'));
    await checkConnection();
    expect(text(screen.getByRole('alert'))).toContain('No se ha podido probar');

    await userEvent.type(screen.getByRole('textbox', { name: 'Modelo principal' }), '-2');
    await checkConnection();
    vi.spyOn(service, 'setAiProvider').mockRejectedValueOnce(new DataError('unavailable'));
    await userEvent.click(button('Guardar'));
    await settle();
    expect(text(screen.getByRole('alert'))).toContain('No se ha podido guardar');
  });

  it('adds, moves and removes fallbacks, up to the limit', async () => {
    await renderSystem();

    await userEvent.click(button('Añadir un respaldo'));
    await settle();
    expect(document.activeElement?.id).toBe('fallback-model-2');
    await userEvent.type(document.activeElement as HTMLElement, 'tercero');

    await userEvent.click(button('Subir el respaldo 3'));
    await settle();
    const models = () =>
      screen
        .getAllByRole<HTMLInputElement>('textbox', { name: 'Modelo' })
        .map((input) => input.value);
    expect(models()).toEqual(['gemma-4-31b-it', 'tercero', 'gemma-4-26b-a4b-it']);
    expect(document.activeElement?.id).toBe('fallback-up-1');

    await userEvent.click(button('Bajar el respaldo 2'));
    await userEvent.click(button('Quitar el respaldo 1'));
    await settle();
    expect(models()).toEqual(['gemma-4-26b-a4b-it', 'tercero']);
    expect(document.activeElement?.id).toBe('fallback-model-0');

    for (let i = 0; i < 3; i++) await userEvent.click(button('Añadir un respaldo'));
    expect(isDisabled(button('Añadir un respaldo'))).toBe(true);
    await userEvent.click(button('Añadir un respaldo'));
    expect(screen.getAllByRole('group', { name: /^Respaldo/ })).toHaveLength(5);
    await userEvent.click(button('Quitar el respaldo 5'));
    await settle();
    expect(document.activeElement?.id).toBe('add-fallback');
  });

  it('shows the fields of a fallback of «Other», and the URL of one of a preset', async () => {
    await renderSystem();
    const fallback = screen.getByRole('group', { name: 'Respaldo 1' });

    await userEvent.click(within(fallback).getByRole('combobox', { name: 'Proveedor' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Groq' }));
    expect(text(fallback)).toContain('https://api.groq.com/openai/v1 · AI_GROQ_API_KEY');

    await userEvent.click(within(fallback).getByRole('combobox', { name: 'Proveedor' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Ollama (en el servidor)' }));
    expect(text(fallback)).toContain('host.docker.internal:11434/v1 · sin clave');

    await userEvent.click(within(fallback).getByRole('combobox', { name: 'Proveedor' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Otro' }));
    expect(within(fallback).getByRole('textbox', { name: 'URL base' })).toBeTruthy();
  });

  it('creates a subject in its order and edits another', async () => {
    await renderSystem();
    const snackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');

    await userEvent.click(button('Nueva asignatura'));
    const cancelled = await screen.findByRole('dialog');
    await userEvent.click(within(cancelled).getByRole('button', { name: 'Cancelar' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent.click(button('Editar Programación básica'));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }),
    );
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(snackBar).not.toHaveBeenCalled();

    await userEvent.click(button('Nueva asignatura'));
    const dialog = await screen.findByRole('dialog');
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Nombre' }),
      'Física aplicada',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear la asignatura' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // In its place by name
    expect(subjectNames()).toContain('Física aplicada');
    expect(subjectNames()).toEqual(byName(subjectNames()));
    expect(snackBar).toHaveBeenCalledWith('Asignatura creada');

    await userEvent.click(button('Editar Programación básica'));
    const editing = await screen.findByRole('dialog');
    await vi.waitFor(() => expect(editing.contains(document.activeElement)).toBe(true));
    await userEvent.type(within(editing).getByRole('textbox', { name: 'Nombre' }), ' I');
    await userEvent.click(within(editing).getByRole('button', { name: 'Guardar' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(subjectNames()).toContain('Programación básica I');
    expect(snackBar).toHaveBeenCalledWith('Asignatura guardada');
  });
});
