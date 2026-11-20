import { TestBed } from '@angular/core/testing';

import { toUserEntry } from '../admin/user-entry';
import { SupabaseAdminService } from './supabase-admin-service';
import { toAppUser, toSubject } from './supabase-rows';
import {
  appUserRow,
  FakeSupabaseServer,
  provideFakeSupabase,
  subjectRow,
} from './supabase-testing';

const USERS = '/rest/v1/app_user';
const ADMIN_USERS = '/functions/v1/admin-users';
const SUBJECTS = '/rest/v1/subject';
const SETTINGS = '/rest/v1/app_setting';
const AI_CHECK = '/functions/v1/ai-check';
const SETTING = { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-4', fallbacks: ['x'] };

describe('SupabaseAdminService', () => {
  let server: FakeSupabaseServer;
  let service: SupabaseAdminService;

  beforeEach(() => {
    server = new FakeSupabaseServer();
    TestBed.configureTestingModule({
      providers: [SupabaseAdminService, provideFakeSupabase(server)],
    });
    service = TestBed.inject(SupabaseAdminService);
  });

  describe('listUsers', () => {
    it('reads every account of app_user, by name, with the groups it teaches and its enrollments', async () => {
      const marta = appUserRow({ id: 'marta', name: 'Marta Ibáñez', role: 'teacher' });
      const alvaro = appUserRow({ id: 'alvaro', name: 'Álvaro Ruiz' });
      server.on('GET', USERS, {
        body: [
          {
            ...marta,
            taught: [
              { label: null, school_class: { name: '1.º DAW A' } },
              { label: 'Desdoble inglés', school_class: { name: '1.º DAW A' } },
            ],
            enrollment: [],
          },
          {
            ...alvaro,
            taught: [],
            enrollment: [{ class_group: { label: null, school_class: { name: '1.º DAW A' } } }],
          },
        ],
      });

      await expect(service.listUsers()).resolves.toEqual([
        toUserEntry(toAppUser(alvaro), [], ['1.º DAW A']),
        toUserEntry(toAppUser(marta), ['1.º DAW A', '1.º DAW A · Desdoble inglés'], []),
      ]);
      // The groups taught by their own key: through enrollment, app_user reaches class_group too
      expect(server.sentTo('GET', USERS)[0].params.get('select')).toBe(
        '*,taught:class_group!class_group_teacher_id_fkey(label,school_class(name)),enrollment(class_group(label,school_class(name)))',
      );
    });

    it('turns a failure into a data error', async () => {
      server.on('GET', USERS, { status: 403, body: { message: 'No', code: '42501' } });

      await expect(service.listUsers()).rejects.toMatchObject({ kind: 'forbidden' });
    });
  });

  describe('createUser', () => {
    it('asks the Edge Function admin-users for the account', async () => {
      const row = appUserRow({ id: 'clara', name: 'Clara Fuentes', role: 'teacher' });
      server.on('POST', ADMIN_USERS, { body: row });
      const user = {
        name: 'Clara Fuentes',
        email: 'clara@tutoria.test',
        role: 'teacher' as const,
        password: 'contraseña segura',
      };

      await expect(service.createUser(user)).resolves.toEqual(toAppUser(row));
      expect(server.sentTo('POST', ADMIN_USERS)[0].body).toEqual({ action: 'create', ...user });
    });

    it('takes an email that already has an account as invalid', async () => {
      server.on('POST', ADMIN_USERS, { status: 409, body: { message: 'Taken' } });

      await expect(
        service.createUser({ name: 'L', email: 'l@tutoria.test', role: 'student', password: 'x' }),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });
  });

  describe('updateUser', () => {
    it('sends the changes of the user to the function', async () => {
      const row = appUserRow({ id: 'lucia', status: 'disabled' });
      server.on('POST', ADMIN_USERS, { body: row });

      await expect(service.updateUser('lucia', { status: 'disabled' })).resolves.toEqual(
        toAppUser(row),
      );
      expect(server.sentTo('POST', ADMIN_USERS)[0].body).toEqual({
        action: 'update',
        userId: 'lucia',
        changes: { status: 'disabled' },
      });
    });

    it.each([
      [403, 'forbidden'],
      [404, 'not_found'],
      [409, 'invalid'],
    ])('turns a %i of the function into %s', async (status, kind) => {
      server.on('POST', ADMIN_USERS, { status, body: { message: 'No' } });

      await expect(service.updateUser('lucia', { role: 'teacher' })).rejects.toMatchObject({
        kind,
      });
    });

    it('does not take an empty answer as a user', async () => {
      server.on('POST', ADMIN_USERS, { body: null });

      await expect(service.updateUser('lucia', { name: 'Lucía' })).rejects.toMatchObject({
        kind: 'unknown',
      });
    });
  });

  describe('subjects', () => {
    it('reads them by name, in Spanish', async () => {
      const web = subjectRow({ id: 'web', name: 'Desarrollo web' });
      const basic = subjectRow({ id: 'basic', name: 'Programación básica' });
      const advanced = subjectRow({ id: 'adv', name: 'Álgebra' });
      server.on('GET', SUBJECTS, { body: [basic, web, advanced] });

      await expect(service.listSubjects()).resolves.toEqual([advanced, web, basic].map(toSubject));
    });

    it('creates a new one, trimmed', async () => {
      const row = subjectRow({ id: 'db', name: 'Bases de datos' });
      server.on('POST', SUBJECTS, { body: row });

      const saved = await service.saveSubject({
        name: ' Bases de datos ',
        sourceLocale: 'es',
        translations: { en: { name: 'Databases' } },
      });

      expect(saved).toEqual(toSubject(row));
      expect(server.sentTo('POST', SUBJECTS)[0].body).toEqual({
        name: 'Bases de datos',
        source_locale: 'es',
        translations: { en: { name: 'Databases' } },
      });
    });

    it('edits the one of its id', async () => {
      const row = subjectRow({ id: 'db', name: 'Bases' });
      server.on('PATCH', SUBJECTS, { body: row });

      await service.saveSubject({ ...toSubject(row) });

      expect(server.sentTo('PATCH', SUBJECTS)[0].params.get('id')).toBe('eq.db');
    });

    it('takes a check of the table as invalid', async () => {
      server.on('POST', SUBJECTS, { status: 400, body: { message: 'No', code: '23514' } });

      await expect(
        service.saveSubject({ name: 'X', sourceLocale: 'es', translations: {} }),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });
  });

  describe('AI provider', () => {
    it('reads the row ai_provider of app_setting', async () => {
      server.on('GET', SETTINGS, { body: { value: SETTING } });

      await expect(service.getAiProvider()).resolves.toEqual(SETTING);
      expect(server.sentTo('GET', SETTINGS)[0].params.get('key')).toBe('eq.ai_provider');
    });

    it('reads null while there is no row ai_provider', async () => {
      server.on('GET', SETTINGS, { body: [] });

      await expect(service.getAiProvider()).resolves.toBeNull();
    });

    it('writes it, and takes its check as invalid', async () => {
      server.on('POST', SETTINGS, { status: 201, body: null });
      await service.setAiProvider(SETTING);
      expect(server.sentTo('POST', SETTINGS)[0].body).toEqual({
        key: 'ai_provider',
        value: SETTING,
      });

      server.on('POST', SETTINGS, { status: 400, body: { message: 'No', code: '23514' } });
      await expect(service.setAiProvider(SETTING)).rejects.toMatchObject({ kind: 'invalid' });
    });

    it('asks the Edge Function ai-check for the check of a setting', async () => {
      const checks = [
        { model: 'llama-4', ms: 300 },
        { model: 'x', problem: 'not_found' },
      ];
      server.on('POST', AI_CHECK, { body: checks });

      await expect(service.checkAiProvider(SETTING)).resolves.toEqual(checks);
      expect(server.sentTo('POST', AI_CHECK)[0].body).toEqual(SETTING);
    });

    it('turns a failure of the check into a data error, and an empty answer too', async () => {
      server.on('POST', AI_CHECK, { status: 429, body: { message: 'Wait' } });
      await expect(service.checkAiProvider(SETTING)).rejects.toMatchObject({
        kind: 'rate_limited',
      });

      server.on('POST', AI_CHECK, { body: null });
      await expect(service.checkAiProvider(SETTING)).rejects.toMatchObject({ kind: 'unknown' });
    });
  });
});
