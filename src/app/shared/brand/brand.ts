import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../../auth/auth-store';
import { homeOrLogin } from '../../auth/home-path';
import { APP_NAME } from '../../core/app-title-strategy';
import { Mascot } from '../mascot/mascot';

/**
 * Brand of the app bars (step 1.1d): the mascot and the name, as a link to the home of the role.
 * The mascot is decorative, so the link is read as "TutorIA", also on a phone, where only the
 * mascot is seen.
 */
@Component({
  selector: 'app-brand',
  imports: [RouterLink, Mascot],
  template: `
    <a
      [routerLink]="home()"
      class="flex items-center gap-2 rounded-md pe-1 text-title-large font-bold"
    >
      <app-mascot class="size-10" />
      <!-- On a phone the bar only has room for the mascot: the name stays for screen readers -->
      <span class="sr-only sm:not-sr-only">{{ appName }}</span>
    </a>
  `,
})
export class Brand {
  private readonly role = inject(AuthStore).role;

  protected readonly appName = APP_NAME;
  protected readonly home = computed(() => homeOrLogin(this.role()));
}
