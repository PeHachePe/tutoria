import { TestBed } from '@angular/core/testing';

import { DAW_STUDENT_IDS, DISABLED_STUDENT_ID, TEACHER_ID } from './fixtures/users';
import { SEED, SEED_VERSION } from './fixtures/seed';
import { MOCK_DB_STORAGE_KEY, MOCK_SESSION_STORAGE_KEY, MockDb } from './mock-db';

describe('MockDb', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function create(): MockDb {
    return TestBed.inject(MockDb);
  }

  function saved(): unknown {
    return JSON.parse(localStorage.getItem(MOCK_DB_STORAGE_KEY) ?? 'null');
  }

  describe('listeners', () => {
    it('hear every change with the new and the previous tables, until they stop', () => {
      const db = create();
      const listener = vi.fn();
      const stop = db.onChange(listener);

      db.update('groups', () => []);
      db.reset();
      stop();
      db.update('groups', () => []);

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener.mock.calls[0][0].groups).toEqual([]);
      expect(listener.mock.calls[0][1]).toBe(SEED);
      expect(listener.mock.calls[1][0]).toBe(SEED);
    });

    it('hear the changes another tab saves, and only those of the tables', () => {
      const db = create();
      const listener = vi.fn();
      db.onChange(listener);
      const otherTab = { version: SEED_VERSION, tables: { ...SEED, groups: [] } };
      localStorage.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(otherTab));

      window.dispatchEvent(new StorageEvent('storage', { key: 'another-key' }));
      window.dispatchEvent(new StorageEvent('storage', { key: MOCK_DB_STORAGE_KEY }));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(db.tables().groups).toEqual([]);
    });

    it('stop hearing other tabs once destroyed', () => {
      const db = create();
      const listener = vi.fn();
      db.onChange(listener);
      TestBed.resetTestingModule();

      window.dispatchEvent(new StorageEvent('storage', { key: MOCK_DB_STORAGE_KEY }));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('tables', () => {
    it('start with the seed when nothing is saved', () => {
      expect(create().tables()).toEqual(SEED);
    });

    it('save every change with the seed version', () => {
      const db = create();

      db.update('groups', (groups) => groups.slice(0, 1));

      expect(db.tables().groups).toEqual([SEED.groups[0]]);
      expect(db.tables().users).toBe(SEED.users);
      expect(saved()).toEqual({ version: SEED_VERSION, tables: db.tables() });
    });

    it('restore the saved data of the same seed version', () => {
      create().update('groups', () => []);
      TestBed.resetTestingModule();

      expect(create().tables().groups).toEqual([]);
    });

    it.each([
      ['another seed version', JSON.stringify({ version: SEED_VERSION + 1, tables: {} })],
      ['no tables', JSON.stringify({ version: SEED_VERSION })],
      ['not JSON', '{'],
      ['null', 'null'],
    ])('discard saved data with %s', (_case, data) => {
      localStorage.setItem(MOCK_DB_STORAGE_KEY, data);

      expect(create().tables()).toEqual(SEED);
    });

    it('keep working in memory when storage is unavailable', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('full');
      });
      const db = create();

      db.update('groups', () => []);

      expect(db.tables().groups).toEqual([]);
    });

    it('go back to the seed on reset', () => {
      const db = create();
      db.update('attempts', () => []);

      db.reset();

      expect(db.tables()).toEqual(SEED);
      expect(saved()).toEqual({ version: SEED_VERSION, tables: SEED });
    });
  });

  describe('session', () => {
    it('starts signed out', () => {
      const db = create();

      expect(db.sessionUserId()).toBeNull();
      expect(db.currentUser()).toBeNull();
    });

    it('saves the signed-in user and restores it', () => {
      create().setSession(TEACHER_ID);
      TestBed.resetTestingModule();
      const db = create();

      expect(localStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBe(TEACHER_ID);
      expect(db.currentUser()?.name).toBe('Marta Ibáñez Soler');
    });

    it('signs out', () => {
      const db = create();
      db.setSession(TEACHER_ID);

      db.setSession(null);

      expect(db.currentUser()).toBeNull();
      expect(localStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('has no current user when the session user is disabled or unknown', () => {
      const db = create();

      db.setSession(DISABLED_STUDENT_ID);
      expect(db.currentUser()).toBeNull();
      db.setSession('missing');
      expect(db.currentUser()).toBeNull();
    });

    it('survives a reset of the data', () => {
      const db = create();
      db.setSession(DAW_STUDENT_IDS[0]);

      db.reset();

      expect(db.currentUser()?.id).toBe(DAW_STUDENT_IDS[0]);
    });

    it('keeps working in memory when storage is unavailable', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('full');
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      const db = create();

      db.setSession(TEACHER_ID);
      expect(db.currentUser()?.id).toBe(TEACHER_ID);
      db.setSession(null);
      expect(db.currentUser()).toBeNull();
    });
  });

  describe('requireUser', () => {
    it('returns the current user when no role is required', () => {
      const db = create();
      db.setSession(DAW_STUDENT_IDS[0]);

      expect(db.requireUser().id).toBe(DAW_STUDENT_IDS[0]);
    });

    it('throws unauthorized when nobody is signed in', () => {
      expect(() => create().requireUser()).toThrowError(
        expect.objectContaining({ kind: 'unauthorized' }),
      );
    });

    it('throws forbidden when the user has none of the roles', () => {
      const db = create();
      db.setSession(DAW_STUDENT_IDS[0]);

      expect(() => db.requireUser('teacher', 'admin')).toThrowError(
        expect.objectContaining({ kind: 'forbidden' }),
      );
      db.setSession(TEACHER_ID);
      expect(db.requireUser('teacher', 'admin').role).toBe('teacher');
    });
  });
});
