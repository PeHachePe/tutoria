import { TestBed } from '@angular/core/testing';

import { toUserEntry } from '../admin/user-entry';
import { SupabaseAdminService } from './supabase-admin-service';
import { toAppUser } from './supabase-rows';
import { appUserRow, FakeSupabaseServer, provideFakeSupabase } from './supabase-testing';

const USERS = '/rest/v1/app_user';
const ADMIN_USERS = '/functions/v1/admin-users';

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
          { ...marta, taught: [{ name: '1.º DAW A' }, { name: '1.º DAW A' }], enrollment: [] },
          { ...alvaro, taught: [], enrollment: [{ class_group: { name: '1.º DAW A' } }] },
        ],
      });

      await expect(service.listUsers()).resolves.toEqual([
        toUserEntry(toAppUser(alvaro), [], ['1.º DAW A']),
        toUserEntry(toAppUser(marta), ['1.º DAW A', '1.º DAW A'], []),
      ]);
      // The groups taught by their own key: through enrollment, app_user reaches class_group too
      expect(server.sentTo('GET', USERS)[0].params.get('select')).toBe(
        '*,taught:class_group!class_group_teacher_id_fkey(name),enrollment(class_group(name))',
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

  it('leaves the subjects and the provider for 5.3', async () => {
    const pending = [
      service.listSubjects(),
      service.saveSubject(),
      service.getAiProvider(),
      service.setAiProvider(),
    ];

    for (const call of pending) {
      await expect(call).rejects.toMatchObject({ kind: 'unavailable' });
    }
  });
});
