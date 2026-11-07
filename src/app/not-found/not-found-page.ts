import { Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';

import { APP_PATHS } from '../core/app-paths';

/**
 * Any address that does not exist, or that belongs to another role: the role guards do not match it
 * (2.2). "Ir a mi inicio" goes to `/`, which redirects to the home of the role or to the login.
 */
@Component({
  selector: 'app-not-found-page',
  imports: [MatButton, RouterLink],
  template: `
    <main
      id="contenido"
      tabindex="-1"
      class="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 px-4 py-6 outline-none"
    >
      <p class="eyebrow" i18n="@@notFound.eyebrow">Error 404</p>
      <h1 class="text-headline-medium" i18n="@@notFound.title">Página no encontrada</h1>
      <p class="text-body-large text-on-surface-variant" i18n="@@notFound.text">
        La dirección no existe o no tienes acceso a ella con tu cuenta.
      </p>
      <a matButton="filled" [routerLink]="home" i18n="@@notFound.home">Ir a mi inicio</a>
    </main>
  `,
})
export class NotFoundPage {
  protected readonly home = APP_PATHS.root;
}
