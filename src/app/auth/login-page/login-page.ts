import { Component, inject, input, signal } from '@angular/core';
import { email, form, FormField, FormRoot, required, submit } from '@angular/forms/signals';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCard } from '@angular/material/card';
import { MatError, MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { Router } from '@angular/router';

import { provideFormFieldDefaults } from '../../core/form-field-defaults';
import { Mascot } from '../../shared/mascot/mascot';
import { ThemeMenu } from '../../shared/theme-menu/theme-menu';
import { afterSignInPath } from '../after-sign-in-path';
import { AuthStore } from '../auth-store';
import { DEMO_ACCOUNTS, DemoAccount } from '../demo-accounts';
import { signInErrorMessage } from '../sign-in-error-message';

/**
 * Login (ficha 01-acceso, RF-01): email and password with Signal Forms (4.6). After signing in it
 * goes back to the page asked for without a session, or to the home of the role (D-019, D-021).
 * During development it also offers the demo accounts in a menu; only the dev environments provide them.
 */
@Component({
  selector: 'app-login-page',
  imports: [
    FormRoot,
    FormField,
    MatCard,
    MatFormField,
    MatLabel,
    MatError,
    MatSuffix,
    MatInput,
    MatButton,
    MatIconButton,
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    Mascot,
    ThemeMenu,
  ],
  templateUrl: './login-page.html',
  // Loaded on its own, outside the areas: it brings the defaults of its fields (D-021)
  providers: [provideFormFieldDefaults()],
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  /**
   * `?redirect=` (REDIRECT_PARAM), set by the role guard: the page to come back to. The router binds
   * query params to inputs by name, and Angular only accepts a literal as an input alias, so the
   * name must match the constant; the e2e test of the redirect checks that it does.
   */
  readonly redirect = input<string>();

  protected readonly demoAccounts = inject(DEMO_ACCOUNTS);
  protected readonly passwordVisible = signal(false);

  protected readonly model = signal({ email: '', password: '' });
  protected readonly loginForm = form(
    this.model,
    (path) => {
      required(path.email, { message: 'Introduce tu correo' });
      email(path.email, { message: 'El correo no es válido' });
      required(path.password, { message: 'Introduce tu contraseña' });
    },
    {
      submission: {
        action: async (field) => {
          const result = await this.auth.signIn(field().value());
          if (!result.ok) {
            return { kind: 'server', message: signInErrorMessage(result.error) };
          }
          // Still submitting until the next page shows, so the button keeps saying "Entrando…"
          await this.router.navigateByUrl(afterSignInPath(this.redirect()));
          return undefined;
        },
        // Focus management: move the focus to the first invalid field
        onInvalid: (field) => field().errorSummary()[0]?.fieldTree().focusBoundControl(),
      },
    },
  );

  protected togglePassword(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  /** Fills the form with a demo account and sends it, as if typed: same "Entrando…" and errors. */
  protected async signInAs(account: DemoAccount): Promise<void> {
    this.model.set({ email: account.email, password: account.password });
    await submit(this.loginForm);
  }
}
