import { APP_PATHS, STUDENT_PARAMS } from './app-paths';

/** The URLs are part of the product (2.2): bookmarks and shared links depend on them. */
describe('APP_PATHS', () => {
  it('keeps the URLs of the specification', () => {
    expect(APP_PATHS.login).toBe('/login');
    expect(APP_PATHS.student.catalog).toBe('/alumno');
    expect(APP_PATHS.student.settings).toBe('/alumno/ajustes');
    expect(APP_PATHS.student.data).toBe('/alumno/datos');
    expect(APP_PATHS.teacher.live).toBe('/docente/en-vivo');
    expect(APP_PATHS.teacher.history).toBe('/docente/historico');
    expect(APP_PATHS.teacher.exercises).toBe('/docente/ejercicios');
    expect(APP_PATHS.teacher.groups).toBe('/docente/grupos');
    expect(APP_PATHS.admin.users).toBe('/admin/usuarios');
    expect(APP_PATHS.admin.system).toBe('/admin/sistema');
  });

  it('builds the paths with an id', () => {
    expect(APP_PATHS.student.exercise('42')).toBe('/alumno/ejercicio/42');
    expect(APP_PATHS.teacher.attempt('7')).toBe('/docente/en-vivo/7');
  });

  it('keeps the query parameters of the student screens', () => {
    expect(STUDENT_PARAMS).toEqual({ group: 'grupo', attempt: 'intento' });
  });
});
