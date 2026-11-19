import { TestBed } from '@angular/core/testing';

import { MAX_PASSWORD_LENGTH, MAX_USER_NAME_LENGTH } from '../admin/user-rules';
import type { NewUser } from '../admin-service';
import {
  ADMIN_ID,
  DAW_STUDENT_IDS,
  DISABLED_STUDENT_ID,
  OTHER_TEACHER_ID,
  TEACHER_ID,
} from './fixtures/users';
import { MockAdminService } from './mock-admin-service';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

const NEW_USER: NewUser = {
  name: '  Clara Fuentes Ibarra ',
  email: ' Clara.Fuentes@Tutoria.test',
  role: 'teacher',
  password: 'contraseña segura',
};

describe('MockAdminService', () => {
  let service: MockAdminService;
  let db: MockDb;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [MockAdminService] });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    db = TestBed.inject(MockDb);
    service = TestBed.inject(MockAdminService);
    db.setSession(ADMIN_ID);
  });

  afterEach(() => localStorage.clear());

  describe('access', () => {
    it('is only for the administration', async () => {
      db.setSession(TEACHER_ID);
      await expect(service.listUsers()).rejects.toMatchObject({ kind: 'forbidden' });
      await expect(service.createUser(NEW_USER)).rejects.toMatchObject({ kind: 'forbidden' });
      await expect(service.updateUser(TEACHER_ID, { name: 'Marta' })).rejects.toMatchObject({
        kind: 'forbidden',
      });

      db.setSession(null);
      await expect(service.listUsers()).rejects.toMatchObject({ kind: 'unauthorized' });
    });
  });

  describe('listUsers', () => {
    it('lists every account by name', async () => {
      const users = await service.listUsers();

      expect(users).toHaveLength(db.tables().users.length);
      const names = users.map(({ user }) => user.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
      expect(names.slice(0, 2)).toEqual(['Administración TutorIA', 'Adrián López Vidal']);
    });

    it('tells the groups of each account and what ties it to them', async () => {
      const users = await service.listUsers();
      const entry = (id: string) => users.find(({ user }) => user.id === id);

      // Two groups with the same name, in two subjects: the name once
      expect(entry(TEACHER_ID)).toMatchObject({
        groupNames: ['1.º DAW A'],
        links: { groups: 2, enrollments: 0 },
      });
      expect(entry(DAW_STUDENT_IDS[0])).toMatchObject({
        groupNames: ['1.º DAW A'],
        links: { groups: 0, enrollments: 2 },
      });
      expect(entry(ADMIN_ID)).toMatchObject({
        groupNames: [],
        links: { groups: 0, enrollments: 0 },
      });
    });
  });

  describe('createUser', () => {
    it('creates an active account with the email normalized and its password', async () => {
      const user = await service.createUser(NEW_USER);

      expect(user).toMatchObject({
        name: 'Clara Fuentes Ibarra',
        email: 'clara.fuentes@tutoria.test',
        role: 'teacher',
        status: 'active',
        privacyNoticeSeenAt: null,
      });
      expect(user.createdAt).toBe(user.updatedAt);
      expect(db.tables().users).toContainEqual(user);
      expect(db.tables().passwords[user.id]).toBe(NEW_USER.password);
    });

    it('turns down an email that already has an account, whatever its case', async () => {
      await expect(
        service.createUser({ ...NEW_USER, email: 'Lucia.Martin@tutoria.test' }),
      ).rejects.toMatchObject({ kind: 'invalid' });
      expect(
        db.tables().users.filter((user) => user.email === 'lucia.martin@tutoria.test'),
      ).toHaveLength(1);
    });

    it.each([
      ['an empty name', { name: '  ' }],
      ['a name too long', { name: 'a'.repeat(MAX_USER_NAME_LENGTH + 1) }],
      ['an email too long', { email: `${'a'.repeat(250)}@tutoria.test` }],
      ['a short password', { password: 'corta' }],
      ['a password too long', { password: 'a'.repeat(MAX_PASSWORD_LENGTH + 1) }],
    ])('turns down %s, as the function does', async (_case, change) => {
      const before = db.tables().users.length;

      await expect(service.createUser({ ...NEW_USER, ...change })).rejects.toMatchObject({
        kind: 'invalid',
      });
      expect(db.tables().users).toHaveLength(before);
    });
  });

  describe('updateUser', () => {
    it('changes the name, trimmed, and the date of the change', async () => {
      const user = await service.updateUser(TEACHER_ID, { name: ' Marta Ibáñez ' });

      expect(user).toMatchObject({ id: TEACHER_ID, name: 'Marta Ibáñez', role: 'teacher' });
      expect(user.updatedAt > user.createdAt).toBe(true);
      expect(db.tables().users.find(({ id }) => id === TEACHER_ID)).toEqual(user);
    });

    it('changes the role of someone without groups nor enrollments', async () => {
      const user = await service.updateUser(DISABLED_STUDENT_ID, { role: 'teacher' });

      expect(user.role).toBe('teacher');
    });

    it('disables and activates an account', async () => {
      await expect(
        service.updateUser(DAW_STUDENT_IDS[0], { status: 'disabled' }),
      ).resolves.toMatchObject({ status: 'disabled' });

      await expect(
        service.updateUser(DAW_STUDENT_IDS[0], { status: 'active' }),
      ).resolves.toMatchObject({ status: 'active' });
    });

    it('resets the password without changing anything else', async () => {
      const before = db.tables().users.find(({ id }) => id === OTHER_TEACHER_ID);

      const user = await service.updateUser(OTHER_TEACHER_ID, { password: 'nueva contraseña' });

      expect(user).toEqual({ ...before, updatedAt: user.updatedAt });
      expect(db.tables().passwords[OTHER_TEACHER_ID]).toBe('nueva contraseña');
    });

    it.each([
      ['their own role', ADMIN_ID, { role: 'teacher' as const }],
      ['their own account', ADMIN_ID, { status: 'disabled' as const }],
      ['the role of a teacher with groups', TEACHER_ID, { role: 'student' as const }],
      ['the role of an enrolled student', DAW_STUDENT_IDS[0], { role: 'teacher' as const }],
      ['an empty name', TEACHER_ID, { name: ' ' }],
      ['a short password', TEACHER_ID, { password: 'corta' }],
    ])('turns down %s as invalid', async (_case, userId, changes) => {
      const before = db.tables();

      await expect(service.updateUser(userId, changes)).rejects.toMatchObject({
        kind: 'invalid',
      });
      expect(db.tables()).toBe(before);
    });

    it('does not find a user that does not exist', async () => {
      await expect(service.updateUser('nadie', { name: 'Nadie' })).rejects.toMatchObject({
        kind: 'not_found',
      });
    });
  });

  describe('subjects', () => {
    const DRAFT = {
      name: '  Bases de datos ',
      sourceLocale: 'es',
      translations: { en: { name: 'Databases' } },
    } as const;

    it('lists them by name', async () => {
      const names = (await service.listSubjects()).map((subject) => subject.name);

      expect(names).toEqual([
        'Desarrollo web en entorno cliente',
        'Programación avanzada',
        'Programación básica',
      ]);
    });

    it('creates one, trimmed, and edits it', async () => {
      const created = await service.saveSubject(DRAFT);
      expect(created).toMatchObject({ name: 'Bases de datos', translations: DRAFT.translations });
      expect(created.id).toEqual(expect.any(String));

      const edited = await service.saveSubject({ ...created, translations: {} });
      expect(edited).toEqual({ ...created, translations: {} });
      expect(await service.listSubjects()).toContainEqual(edited);
    });

    it('turns down a blank name, a blank translation and one in the source language', async () => {
      const drafts = [
        { ...DRAFT, name: ' ' },
        { ...DRAFT, translations: { en: { name: ' ' } } },
        { ...DRAFT, translations: { es: { name: 'Otra' } } },
      ];
      for (const draft of drafts) {
        await expect(service.saveSubject(draft)).rejects.toMatchObject({ kind: 'invalid' });
      }
    });

    it('does not edit a subject that does not exist', async () => {
      await expect(service.saveSubject({ ...DRAFT, id: 'nada' })).rejects.toMatchObject({
        kind: 'not_found',
      });
    });
  });

  describe('AI provider', () => {
    const GROQ = {
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-4',
      keySecret: 'AI_GROQ_API_KEY',
      fallbacks: ['llama-fail', { baseUrl: 'https://openrouter.ai/api/v1', model: 'qwen' }],
    };

    it('reads and saves the setting', async () => {
      await expect(service.getAiProvider()).resolves.toEqual(db.tables().aiProvider);

      await service.setAiProvider(GROQ);

      await expect(service.getAiProvider()).resolves.toEqual(GROQ);
    });

    it('does not save a setting without the shape of a provider', async () => {
      await expect(service.setAiProvider({ ...GROQ, baseUrl: 'file:///' })).rejects.toMatchObject({
        kind: 'invalid',
      });
    });

    it('checks every model in order: one whose name has «fail» is not found', async () => {
      await expect(service.checkAiProvider(GROQ)).resolves.toEqual([
        { model: 'llama-4', ms: expect.any(Number) },
        { model: 'llama-fail', problem: 'not_found' },
        { model: 'qwen', ms: expect.any(Number) },
      ]);
      await expect(
        service.checkAiProvider({ ...GROQ, fallbacks: ['llama-4', 'otro', { model: 'otro' }] }),
      ).resolves.toEqual([
        { model: 'llama-4', ms: expect.any(Number) },
        { model: 'llama-4', problem: 'invalid' },
        { model: 'otro', ms: expect.any(Number) },
        { model: 'otro', problem: 'invalid' },
      ]);
      await expect(service.checkAiProvider({ ...GROQ, fallbacks: undefined })).resolves.toEqual([
        { model: 'llama-4', ms: expect.any(Number) },
      ]);
    });

    it('checks a setting without its shape as one invalid result, and saves nothing', async () => {
      const before = db.tables();

      await expect(service.checkAiProvider({ ...GROQ, model: '' })).resolves.toEqual([
        { model: '', problem: 'invalid' },
      ]);
      expect(db.tables()).toBe(before);
    });

    it('is only for the administration', async () => {
      db.setSession(TEACHER_ID);
      const calls = [
        service.listSubjects(),
        service.saveSubject({ name: 'X', sourceLocale: 'es', translations: {} }),
        service.getAiProvider(),
        service.setAiProvider(GROQ),
        service.checkAiProvider(GROQ),
      ];
      for (const call of calls) await expect(call).rejects.toMatchObject({ kind: 'forbidden' });
    });
  });
});
