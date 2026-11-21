import {
  PRINTING_CLASS,
  printCredentials,
  type PrintWindow,
  SHEET_CLASS,
} from './credentials-sheet';

const CREDENTIALS = [
  { name: 'Ana Pérez', email: 'ana@x.es', password: 'abcDEF234567' },
  { name: '<b>Raro</b>', email: 'raro@x.es', password: 'xyzXYZ234567' },
];

describe('printCredentials', () => {
  it('prints a strip a student, under the title of the files, and then leaves the page as it was', () => {
    document.title = 'Usuarios · TutorIA';
    let afterPrint: (() => void) | undefined;
    const view: PrintWindow = {
      print: vi.fn(() => {
        const sheet = document.querySelector(`.${SHEET_CLASS}`);
        expect(sheet?.getAttribute('aria-hidden')).toBe('true');
        expect(sheet?.querySelectorAll('article')).toHaveLength(2);
        expect(document.documentElement.classList.contains(PRINTING_CLASS)).toBe(true);
        expect(document.title).toBe('Credenciales 1.º DAW A 2026-27');
      }),
      addEventListener: vi.fn((_type: string, listener: () => void) => (afterPrint = listener)),
    } as unknown as PrintWindow;

    printCredentials(
      document,
      CREDENTIALS,
      { title: 'Credenciales 1.º DAW A 2026-27', signInUrl: 'https://tutoria.test/login' },
      view,
    );

    expect(view.print).toHaveBeenCalledOnce();
    const strip = document.querySelector(`.${SHEET_CLASS} article`) as HTMLElement;
    expect(strip.textContent).toBe(
      'Tu cuenta de TutorIAAna PérezCorreo: ana@x.esContraseña: abcDEF234567' +
        'Entra en: https://tutoria.test/login',
    );
    expect(strip.querySelectorAll('code')).toHaveLength(3);
    // A name is text, never markup
    expect(document.querySelector(`.${SHEET_CLASS} b`)).toBeNull();

    afterPrint?.();
    expect(document.querySelector(`.${SHEET_CLASS}`)).toBeNull();
    expect(document.documentElement.classList.contains(PRINTING_CLASS)).toBe(false);
    expect(document.title).toBe('Usuarios · TutorIA');
  });
});
