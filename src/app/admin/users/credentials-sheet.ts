import type { Credential } from './student-list';

/** The sheet, put at the end of the page while it prints (`credentials-sheet.css`). */
export const SHEET_CLASS = 'credentials-sheet';
/** On the root while the sheet prints: only the sheet is printed. */
export const PRINTING_CLASS = 'printing-credentials';

/** What printing needs of the window: its dialog and the event when it closes. */
export type PrintWindow = Pick<Window, 'print' | 'addEventListener'>;

/**
 * Prints the accounts created (5.2h) as strips to cut, one a student, to hand each their own in
 * person (D-072): their name, email, password and where to sign in. The sheet is built in the page
 * itself, not in a frame, as the security policy allows no frames (`frame-src 'none'`), and goes
 * away when the print dialog closes. It is hidden from screen readers: on screen it never shows.
 * Meanwhile the page takes `title`, which the browser proposes as the name of the PDF.
 */
export function printCredentials(
  document: Document,
  credentials: readonly Credential[],
  { title, signInUrl }: { readonly title: string; readonly signInUrl: string },
  view: PrintWindow = window,
): void {
  const sheet = document.createElement('section');
  sheet.className = SHEET_CLASS;
  sheet.setAttribute('aria-hidden', 'true');
  for (const { name, email, password } of credentials) {
    const strip = document.createElement('article');
    strip.append(
      line(document, 'h2', $localize`:@@credentialsSheet.title:Tu cuenta de TutorIA`),
      line(document, 'p', name),
      field(document, $localize`:@@credentialsSheet.email:Correo`, email),
      field(document, $localize`:@@credentialsSheet.password:Contraseña`, password),
      field(document, $localize`:@@credentialsSheet.signIn:Entra en`, signInUrl),
    );
    sheet.append(strip);
  }
  const pageTitle = document.title;
  document.body.append(sheet);
  document.documentElement.classList.add(PRINTING_CLASS);
  document.title = title;
  view.addEventListener(
    'afterprint',
    () => {
      sheet.remove();
      document.documentElement.classList.remove(PRINTING_CLASS);
      document.title = pageTitle;
    },
    { once: true },
  );
  view.print();
}

function line(document: Document, tag: 'h2' | 'p', text: string): HTMLElement {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

/** «Contraseña: abcDEF234567», the value in a code font: an l and a 1 do not look alike. */
function field(document: Document, label: string, value: string): HTMLElement {
  const element = document.createElement('p');
  const code = document.createElement('code');
  code.textContent = value;
  element.append(`${label}: `, code);
  return element;
}
