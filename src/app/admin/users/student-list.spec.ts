import { MAX_EMAIL_LENGTH, MAX_USER_NAME_LENGTH } from '../../data/admin/user-rules';
import type { AppUser } from '../../data/user';
import {
  credentialsCsv,
  credentialsTitle,
  readStudentList,
  reviewStudentList,
  studentListLines,
} from './student-list';

function account(email: string, changes: Partial<AppUser> = {}): AppUser {
  return {
    id: email,
    name: 'Cuenta',
    email,
    role: 'student',
    status: 'active',
    privacyNoticeSeenAt: null,
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z',
    ...changes,
  };
}

describe('student list', () => {
  describe('studentListLines', () => {
    it('keeps the lines with something, trimmed, with their number in the text', () => {
      expect(studentListLines('  Ana;ana@x.es \r\n\n   \nPablo;pablo@x.es\n')).toEqual([
        { line: 1, text: 'Ana;ana@x.es' },
        { line: 4, text: 'Pablo;pablo@x.es' },
      ]);
    });
  });

  describe('readStudentList', () => {
    it('reads the name and the email separated by «;», a tab or a comma, in any order', () => {
      expect(
        readStudentList('Ana Pérez;ana@x.es\npablo@x.es\tPablo Ruiz\nEva Gil, eva@x.es'),
      ).toEqual([
        {
          line: 1,
          text: 'Ana Pérez;ana@x.es',
          name: 'Ana Pérez',
          email: 'ana@x.es',
          problem: null,
        },
        {
          line: 2,
          text: 'pablo@x.es\tPablo Ruiz',
          name: 'Pablo Ruiz',
          email: 'pablo@x.es',
          problem: null,
        },
        { line: 3, text: 'Eva Gil, eva@x.es', name: 'Eva Gil', email: 'eva@x.es', problem: null },
      ]);
    });

    it('turns «Apellidos, Nombre» into the name first, as the accounts have it', () => {
      expect(readStudentList('García López, Ana;ana@x.es')[0].name).toBe('Ana García López');
      expect(readStudentList('"García López, Ana"\tana@x.es')[0].name).toBe('Ana García López');
    });

    it('joins the name of several columns, as Excel gives the name and the surnames', () => {
      expect(readStudentList('Ana\tGarcía López\tana@x.es')[0].name).toBe('Ana García López');
    });

    it('writes a name in capitals as a name, with the particles in lower case', () => {
      expect(readStudentList('DE LA FUENTE DEL RÍO, MARÍA JOSÉ;mj@x.es')[0].name).toBe(
        'María José de la Fuente del Río',
      );
      // A name written with lower case is left as it is
      expect(readStudentList('Ana de la Fuente;ana@x.es')[0].name).toBe('Ana de la Fuente');
    });

    it('takes the email out of angle brackets and writes it in lower case', () => {
      expect(readStudentList('Ana Pérez <Ana.Perez@X.es>')[0]).toMatchObject({
        name: 'Ana Pérez',
        email: 'ana.perez@x.es',
      });
    });

    it('says what is wrong with a line it cannot take', () => {
      const long = 'a'.repeat(MAX_USER_NAME_LENGTH + 1);
      const longEmail = `${'a'.repeat(MAX_EMAIL_LENGTH)}@x.es`;
      expect(
        readStudentList(`Nombre;Correo\nana@x.es\n${long};b@x.es\nEva;${longEmail}`).map(
          ({ problem }) => problem,
        ),
      ).toEqual(['no_email', 'no_name', 'name_too_long', 'email_too_long']);
    });
  });

  describe('reviewStudentList', () => {
    it('marks each line: new, with an account (active or not), repeated or not valid', () => {
      const users = [
        account('lucia@x.es', { name: 'Lucía Martín' }),
        account('pedro@x.es', { status: 'disabled' }),
      ];
      const rows = reviewStudentList(
        'Ana;ana@x.es\nLucía;LUCIA@x.es\nPedro;pedro@x.es\nAna otra vez;ana@x.es\nSin correo',
        users,
      );

      expect(rows.map(({ status }) => status)).toEqual([
        'new',
        'existing',
        'disabled',
        'repeated',
        'no_email',
      ]);
      expect(rows[1].account?.name).toBe('Lucía Martín');
      expect(rows[0].account).toBeNull();
    });
  });

  describe('credentials', () => {
    it('gives a CSV with the name, the email and the password of each account', () => {
      expect(
        credentialsCsv([
          { name: 'Ana Pérez', email: 'ana@x.es', password: 'abcDEF234567' },
          { name: '=Raro', email: 'raro@x.es', password: 'xyzXYZ234567' },
        ]),
      ).toBe(
        'Nombre;Correo;Contraseña\r\n' +
          'Ana Pérez;ana@x.es;abcDEF234567\r\n' +
          "'=Raro;raro@x.es;xyzXYZ234567\r\n",
      );
    });

    it('names the files after the class, or the day without one', () => {
      expect(credentialsTitle({ name: '1.º DAW A', schoolYear: '2026/27' }, '2026-11-21')).toBe(
        'Credenciales 1.º DAW A 2026-27',
      );
      expect(credentialsTitle(null, '2026-11-21')).toBe('Credenciales 2026-11-21');
    });
  });
});
