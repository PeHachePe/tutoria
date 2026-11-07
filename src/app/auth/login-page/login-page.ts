import { Component } from '@angular/core';

/**
 * Login screen. Until step 1.1 builds its form, it only explains how to sign in during development:
 * with the dev toolbar, which is drawn over every page.
 */
@Component({
  selector: 'app-login-page',
  template: `
    <main
      id="contenido"
      tabindex="-1"
      class="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 px-4 py-6 outline-none"
    >
      <p class="text-title-large font-bold text-primary">TutorIA</p>
      <h1 class="text-headline-medium">Acceso</h1>
      <p class="text-body-large text-on-surface-variant">
        El formulario de acceso se construye en el paso 1.1. Mientras tanto, en desarrollo, entra
        con cualquier usuario desde las herramientas de desarrollo (abajo a la izquierda).
      </p>
    </main>
  `,
})
export class LoginPage {}
