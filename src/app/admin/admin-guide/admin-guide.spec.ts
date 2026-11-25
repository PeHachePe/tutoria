import { EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthStore } from '../../auth/auth-store';
import { userWith } from '../../auth/auth-testing';
import type { GuideBeacon } from '../../core/guide/guide-task';
import { BlockService } from '../../data/block-service';
import { ExerciseService } from '../../data/exercise-service';
import { GroupService } from '../../data/group-service';
import type { ManagedClass } from '../../data/group-service';
import type { Role } from '../../data/user';
import { adminBeacons } from './admin-beacons';
import { adminGuide, adminTours, adminWelcome } from './admin-guide';

const SIDE_MENU = {
  open: () => undefined,
  close: () => undefined,
  closed: () => Promise.resolve(),
};

describe('admin guide', () => {
  describe('adminWelcome', () => {
    it('welcomes in Usuarios, with the bar and the whole menu in its order', () => {
      const welcome = adminWelcome('Laura');

      expect(welcome).toMatchObject({ version: 1, screen: 'users', place: 'users' });
      expect(welcome.steps[0].title).toBe('¡Hola, Laura!');
      expect(welcome.steps.map((step) => step.anchor)).toEqual([
        undefined,
        'help',
        'theme-menu',
        'language-menu',
        'user-menu',
        'side-menu',
        'nav-teaching',
        'nav-live',
        'nav-history',
        'nav-bank',
        'nav-blocks',
        'nav-groups',
        'nav-users',
        'nav-system',
        'nav-showcase',
        undefined,
      ]);
      expect(welcome.steps.filter((step) => step.inSideMenu)).toHaveLength(10);
    });
  });

  describe('adminBeacons', () => {
    it('has the bars of the staff, its entries, its screens and every one of the teacher', () => {
      const beacons = adminBeacons();
      const anchors = beacons.map((beacon) => beacon.anchor);

      expect(anchors.indexOf('nav-users')).toBe(anchors.indexOf('nav-groups') + 1);
      expect(anchors).toContain('users-menu');
      expect(anchors).toContain('system-check');
      expect(anchors).toContain('live-state');
      expect(new Set(anchors).size).toBe(anchors.length);
      expect(beacons.find((beacon) => beacon.anchor === 'brand')?.text).toBe(
        'Desde cualquier pantalla, te lleva a Usuarios.',
      );
    });
  });

  describe('adminTours', () => {
    const beacons: GuideBeacon[] = [
      { anchor: 'help', title: 'Ayuda', text: 'a' },
      { anchor: 'nav-users', title: 'Usuarios', text: 'b', inSideMenu: true },
      { screen: 'users', anchor: 'users-new', title: 'Nuevo', text: 'c' },
      { screen: 'system', anchor: 'system-check', title: 'Probar', text: 'd' },
      { screen: 'live', anchor: 'live-state', title: 'Estado', text: 'e' },
    ];

    it('takes the bars and the menu with Usuarios, and Sistema alone', () => {
      const [users, system] = adminTours(beacons);

      expect(users).toMatchObject({ id: 'tour-users', tourOf: 'users', place: 'users' });
      expect(users.steps.map((step) => step.anchor)).toEqual(['users-new', 'help', 'nav-users']);
      expect(users.steps[2]).toMatchObject({ inSideMenu: true, optional: false });
      expect(system).toMatchObject({ id: 'tour-system', tourOf: 'system', place: 'system' });
      expect(system.steps.map((step) => step.anchor)).toEqual(['system-check']);
    });
  });

  describe('the profile', () => {
    const listClasses = vi.fn<GroupService['listClasses']>();

    function configure(role: Role | null, name = 'Laura Herrera Molina') {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: '**', children: [] }]),
          {
            provide: AuthStore,
            useValue: {
              user: signal(role ? { ...userWith(role), name } : null),
              userId: signal('laura'),
              role: signal(role),
            },
          },
          { provide: GroupService, useValue: { listClasses } },
          {
            provide: ExerciseService,
            useValue: {
              listBank: () => Promise.resolve({ exercises: [], subjects: [], mySubjectIds: [] }),
            },
          },
          {
            provide: BlockService,
            useValue: { listGroups: () => Promise.resolve([]), listBlocks: vi.fn() },
          },
        ],
      });
    }

    beforeEach(() => listClasses.mockResolvedValue([]));

    it('has its first steps, its tasks and every one of the teacher, done only by finishing', () => {
      configure('admin');

      const profile = TestBed.runInInjectionContext(() => adminGuide(SIDE_MENU));
      const ids = profile.tasks.map((task) => task.id);

      expect(profile.id).toBe('admin');
      expect(profile.firstSteps).toEqual([
        'add-user',
        'create-class',
        'test-provider',
        'follow-live',
      ]);
      for (const id of [...profile.firstSteps, 'reset-password', 'tour-users', 'edit-class']) {
        expect(ids).toContain(id);
      }
      expect(new Set(ids).size).toBe(ids.length);
      expect(profile.tasks.filter((task) => task.doneBy)).toEqual([]);
      expect(profile.tasks.find((task) => task.id === 'create-class')?.title).toBe(
        'Crear una clase y matricular a su alumnado',
      );
      // The live session takes no bars: Usuarios has them
      expect(profile.tasks.find((task) => task.id === 'tour-live')?.steps).not.toContainEqual(
        expect.objectContaining({ anchor: 'help' }),
      );
      expect(profile.welcome.steps[0].title).toBe('¡Hola, Laura!');
      expect(profile.sideMenu).toBe(SIDE_MENU);
      expect(profile.injector).toBe(TestBed.inject(EnvironmentInjector));
      expect(profile.screenOf('/admin/sistema')).toBe('system');
    });

    it('reads the facts of the whole centre', async () => {
      configure('admin');
      listClasses.mockResolvedValue([
        {
          schoolClass: { createdBy: 'marta' },
          groups: [{ studentCount: 2 }],
          open: true,
        } as unknown as ManagedClass,
      ]);

      const facts = await TestBed.runInInjectionContext(() => adminGuide(SIDE_MENU)).loadFacts();

      expect([...facts.known]).toEqual(['hasClass', 'hasStudents']);
      expect(facts.places.users).toEqual(['/admin/usuarios']);
    });

    it('welcomes without a name if there is no user', () => {
      configure(null);

      expect(
        TestBed.runInInjectionContext(() => adminGuide(SIDE_MENU)).welcome.steps[0].title,
      ).toBe('¡Hola!');
    });
  });
});
