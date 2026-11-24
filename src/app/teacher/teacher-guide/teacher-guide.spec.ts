import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthStore } from '../../auth/auth-store';
import { userWith } from '../../auth/auth-testing';
import type { GuideBeacon } from '../../core/guide/guide-task';
import { BlockService } from '../../data/block-service';
import type { PlannedBlock, PlannedGroup } from '../../data/block-service';
import { ExerciseService } from '../../data/exercise-service';
import type { BankExercise } from '../../data/exercise-service';
import { GroupService } from '../../data/group-service';
import type { ManagedClass } from '../../data/group-service';
import type { Role } from '../../data/user';
import { staffGuide, teacherGuide, teacherTours, teacherWelcome } from './teacher-guide';

const SIDE_MENU = {
  open: () => undefined,
  close: () => undefined,
  closed: () => Promise.resolve(),
};

describe('teacher guide', () => {
  describe('teacherTours', () => {
    const beacons: GuideBeacon[] = [
      { anchor: 'help', title: 'Ayuda', text: 'a' },
      { anchor: 'nav-live', title: 'En vivo', text: 'b', inSideMenu: true },
      { screen: 'live', anchor: 'live-state', title: 'Estado', text: 'c' },
      { screen: 'blocks', anchor: 'blocks-new', title: 'Nuevo', text: 'd' },
    ];

    it('makes a tour of each screen from its beacons, the bars and the menu with the live session', () => {
      const tours = teacherTours(beacons);
      const live = tours.find((tour) => tour.tourOf === 'live');
      const blocks = tours.find((tour) => tour.tourOf === 'blocks');

      expect(tours.map((tour) => tour.id)).toEqual([
        'tour-live',
        'tour-attempt',
        'tour-exercise-bank',
        'tour-exercise-form',
        'tour-blocks',
        'tour-groups',
        'tour-history',
      ]);
      expect(live?.place).toBe('live');
      expect(live?.steps.map((step) => step.anchor)).toEqual(['live-state', 'help', 'nav-live']);
      expect(blocks?.steps).toEqual([
        { anchor: 'blocks-new', title: 'Nuevo', text: 'd', inSideMenu: undefined, optional: true },
      ]);
    });

    it('opens the side menu for its entries instead of skipping them', () => {
      const [live] = teacherTours(beacons);

      expect(live.steps[2]).toMatchObject({ inSideMenu: true, optional: false });
      expect(live.steps[1]).toMatchObject({ optional: true });
    });

    it('has the detail of an attempt only where one is open', () => {
      const attempt = teacherTours(beacons).find((tour) => tour.tourOf === 'attempt');

      expect(attempt).toMatchObject({ place: 'attempt' });
      expect(attempt?.unavailable).toBe('Abre el detalle de un alumno desde En vivo');
    });
  });

  describe('teacherWelcome', () => {
    it('welcomes by first name, with the bar in its order, the menu and where to go on', () => {
      const welcome = teacherWelcome('Marta');

      expect(welcome).toMatchObject({ version: 1, screen: 'live', place: 'live' });
      expect(welcome.steps[0].title).toBe('¡Hola, Marta!');
      expect(welcome.steps.map((step) => step.anchor)).toEqual([
        undefined,
        'help',
        'theme-menu',
        'language-menu',
        'user-menu',
        'side-menu',
        'nav-live',
        'nav-bank',
        'nav-groups',
        undefined,
      ]);
      expect(welcome.steps.filter((step) => step.inSideMenu)).toHaveLength(4);
    });

    it('welcomes without a name', () => {
      expect(teacherWelcome('').steps[0].title).toBe('¡Hola!');
    });
  });

  describe('the profile', () => {
    const listClasses = vi.fn<GroupService['listClasses']>();
    const listBank = vi.fn<ExerciseService['listBank']>();
    const listGroups = vi.fn<BlockService['listGroups']>();
    const listBlocks = vi.fn<BlockService['listBlocks']>();

    function configure(role: Role, name = 'Marta Ibáñez Soler') {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: '**', children: [] }]),
          {
            provide: AuthStore,
            useValue: {
              user: signal(role ? { ...userWith(role), name } : null),
              userId: signal('marta'),
              role: signal(role),
            },
          },
          { provide: GroupService, useValue: { listClasses } },
          { provide: ExerciseService, useValue: { listBank } },
          { provide: BlockService, useValue: { listGroups, listBlocks } },
        ],
      });
    }

    beforeEach(() => {
      listClasses.mockResolvedValue([]);
      listBank.mockResolvedValue({ exercises: [], subjects: [], mySubjectIds: [] });
      listGroups.mockResolvedValue([]);
      listBlocks.mockResolvedValue([]);
    });

    it('is the teacher, with the first steps first and the side menu of the layout', () => {
      configure('teacher');

      const profile = TestBed.runInInjectionContext(() => teacherGuide(SIDE_MENU));

      expect(profile.id).toBe('teacher');
      expect(profile.firstSteps).toEqual([
        'create-class',
        'create-block',
        'add-exercise',
        'assign-exercise',
        'follow-live',
      ]);
      expect(profile.tasks.slice(0, 5).map((task) => task.id)).toEqual(profile.firstSteps);
      expect(new Set(profile.tasks.map((task) => task.id)).size).toBe(profile.tasks.length);
      expect(profile.welcome.steps[0].title).toBe('¡Hola, Marta!');
      expect(profile.sideMenu).toBe(SIDE_MENU);
      expect(profile.screenOf('/docente/grupos')).toBe('groups');
      expect(profile.beacons.length).toBeGreaterThan(60);
    });

    it('reads the facts from their classes, the bank and the blocks of their open groups', async () => {
      configure('teacher');
      const open = { id: 'daw', open: true } as PlannedGroup;
      const closed = { id: 'old', open: false } as PlannedGroup;
      listClasses.mockResolvedValue([
        {
          schoolClass: { createdBy: 'marta' },
          groups: [],
          open: true,
        } as unknown as ManagedClass,
      ]);
      listBank.mockResolvedValue({
        exercises: [{ exercise: { createdBy: 'marta', archivedAt: null } } as BankExercise],
        subjects: [],
        mySubjectIds: [],
      });
      listGroups.mockResolvedValue([open, closed]);
      listBlocks.mockResolvedValue([{ assignments: [] } as unknown as PlannedBlock]);
      await TestBed.inject(Router).navigateByUrl('/docente/en-vivo/intento-1');

      const facts = await TestBed.runInInjectionContext(() => teacherGuide(SIDE_MENU)).loadFacts();

      expect([...facts.known]).toEqual(['hasClass', 'hasBlock', 'hasOwnExercise']);
      expect(listBank).toHaveBeenCalledWith({ kind: 'all' });
      expect(listBlocks).toHaveBeenCalledExactlyOnceWith('daw');
      expect(facts.places.attempt).toEqual(['/docente/en-vivo/intento-1']);
    });

    it('welcomes without a name if there is no user', () => {
      configure(null as unknown as Role);

      const profile = TestBed.runInInjectionContext(() => teacherGuide(SIDE_MENU));

      expect(profile.welcome.steps[0].title).toBe('¡Hola!');
    });

    it('is chosen by the role: the teacher has it, the administration not yet (7.0b2)', () => {
      configure('teacher');
      expect(TestBed.runInInjectionContext(() => staffGuide(SIDE_MENU))?.id).toBe('teacher');

      TestBed.resetTestingModule();
      configure('admin');
      expect(TestBed.runInInjectionContext(() => staffGuide(SIDE_MENU))).toBeUndefined();
    });
  });
});
