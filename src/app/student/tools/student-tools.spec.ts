import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthStore } from '../../auth/auth-store';
import { LanguageService } from '../../core/i18n/language-service';
import { ThemeService, type ThemeMode } from '../../core/theme-service';
import { type AppTool, runTool } from '../../core/tools/app-tool';
import type { AssignedExercise, AssignedGroup } from '../../data/exercise';
import { ExerciseService } from '../../data/exercise-service';
import { SettingsStore } from '../settings/settings-store';
import { studentTools } from './student-tools';

const GROUP: AssignedGroup = {
  id: 'dam',
  name: '1.º DAM B',
  subject: { id: 'basic', name: 'Programación básica', sourceLocale: 'es', translations: {} },
};

function entry(id: string, title: string, status: AssignedExercise['status']): AssignedExercise {
  return {
    exercise: {
      id,
      title,
      statement: '',
      topics: [],
      sourceLocale: 'es',
      translations: {},
      difficulty: 'initial',
    } as unknown as AssignedExercise['exercise'],
    assignmentId: `a-${id}`,
    group: GROUP,
    block: {
      id: 'b1',
      groupId: GROUP.id,
      position: 1,
      title: 'Tema 2: Bucles',
      sourceLocale: 'es',
      translations: {},
      isHidden: false,
    },
    updatedAt: null,
    status,
    hintCount: 0,
    hintLevel: null,
    practice: null,
    repetitions: 0,
  };
}

const ENTRIES = [entry('1', 'Suma', 'submitted'), entry('2', 'Contar los pares', 'not_started')];

describe('studentTools', () => {
  let userId: ReturnType<typeof signal<string | undefined>>;
  let mode: ReturnType<typeof signal<ThemeMode>>;
  let setLocale: ReturnType<typeof vi.fn>;
  let listAssigned: ReturnType<typeof vi.fn>;
  let tools: AppTool[];

  const run = (name: string, args: unknown) =>
    runTool(
      tools.find((tool) => tool.name === name)!,
      args,
    );

  beforeEach(() => {
    userId = signal<string | undefined>('u1');
    mode = signal<ThemeMode>('light');
    setLocale = vi.fn();
    listAssigned = vi.fn(() => Promise.resolve(ENTRIES));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { userId } },
        { provide: ExerciseService, useValue: { listAssigned } },
        { provide: LanguageService, useValue: { locale: 'es', setLocale } },
        {
          provide: ThemeService,
          useValue: { mode, setMode: (value: ThemeMode) => mode.set(value) },
        },
      ],
    });
    tools = TestBed.runInInjectionContext(() => studentTools());
  });

  afterEach(() => localStorage.clear());

  it('are the tools of the area, all open to WebMCP', () => {
    expect(tools.map((tool) => tool.name)).toEqual([
      'getMyProgress',
      'searchExercises',
      'getSettings',
      'openExercise',
      'navigate',
      'updateSettings',
    ]);
    expect(tools.every((tool) => tool.webMcp)).toBe(true);
  });

  it('count the exercises of the student', async () => {
    const progress = await run('getMyProgress', {});
    expect(progress).toEqual({
      ok: true,
      result: expect.objectContaining({
        total: expect.objectContaining({ assigned: 2, pending: 1, submitted: 1 }),
      }),
    });
    expect(listAssigned).toHaveBeenCalledWith('u1');
  });

  it('search the exercises of the student', async () => {
    expect(await run('searchExercises', { status: 'pending' })).toEqual({
      ok: true,
      result: {
        exercises: [
          {
            id: 'a-2',
            title: 'Contar los pares',
            block: 'Tema 2: Bucles',
            subject: 'Programación básica',
            status: 'not_started',
            difficulty: 'initial',
          },
        ],
      },
    });
  });

  it('know nothing without a student', async () => {
    userId.set(undefined);
    expect(await run('getMyProgress', {})).toEqual({
      ok: false,
      error: 'The student is not signed in',
    });
  });

  it('open an exercise, or an earlier attempt of it', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    expect(await run('openExercise', { exercise: 'next' })).toEqual({
      ok: true,
      result: { opened: 'Contar los pares' },
    });
    expect(navigate).toHaveBeenCalledWith(['/alumno/ejercicio/a-2'], { queryParams: {} });

    await run('openExercise', { exercise: 'suma', attempt: 2 });
    expect(navigate).toHaveBeenLastCalledWith(['/alumno/ejercicio/a-1'], {
      queryParams: { intento: 2 },
    });

    expect(await run('openExercise', { exercise: 'química' })).toEqual({
      ok: false,
      error: 'No assigned exercise matches «química»',
    });
  });

  it('go to the pages of the area, the catalog on the tab of a subject', async () => {
    const router = TestBed.inject(Router);
    const byUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    expect(await run('navigate', { to: 'settings' })).toEqual({
      ok: true,
      result: { opened: 'settings' },
    });
    expect(byUrl).toHaveBeenCalledWith('/alumno/ajustes');
    await run('navigate', { to: 'data' });
    expect(byUrl).toHaveBeenLastCalledWith('/alumno/datos');

    await run('navigate', { to: 'catalog' });
    expect(navigate).toHaveBeenCalledWith(['/alumno'], { queryParams: {} });
    await run('navigate', { to: 'catalog', subject: 'BÁSICA' });
    expect(navigate).toHaveBeenLastCalledWith(['/alumno'], { queryParams: { grupo: 'dam' } });
    expect(await run('navigate', { to: 'catalog', subject: 'Química' })).toEqual({
      ok: false,
      error: 'The student has no subject called «Química»',
    });
  });

  it('read the settings by the names of the contract', async () => {
    expect(await run('getSettings', {})).toEqual({
      ok: true,
      result: {
        theme: 'light',
        language: 'es',
        reactions: 'full',
        animatedEmojis: true,
        proactive: true,
        mascotHeadset: true,
        mascotBowTie: true,
        mascotBoneCursor: true,
      },
    });
  });

  it('change only what differs, saying how it was, and the language last', async () => {
    const store = TestBed.inject(SettingsStore);
    const change = await run('updateSettings', {
      language: 'en',
      theme: 'dark',
      reactions: 'full',
      animatedEmojis: false,
      proactive: false,
      mascotHeadset: false,
      mascotBowTie: false,
      mascotBoneCursor: false,
    });
    expect(change).toEqual({
      ok: true,
      result: {
        changed: {
          theme: 'dark',
          animatedEmojis: false,
          proactive: false,
          mascotHeadset: false,
          mascotBowTie: false,
          mascotBoneCursor: false,
          language: 'en',
        },
        previous: {
          theme: 'light',
          animatedEmojis: true,
          proactive: true,
          mascotHeadset: true,
          mascotBowTie: true,
          mascotBoneCursor: true,
          language: 'es',
        },
      },
    });
    expect(mode()).toBe('dark');
    expect(store.reactionEmojis()).toBe(false);
    expect(store.mascotBoneCursor()).toBe(false);
    expect(setLocale).toHaveBeenCalledWith('en');

    await run('updateSettings', { reactions: 'off' });
    expect(store.reactions()).toBe('off');
  });
});
