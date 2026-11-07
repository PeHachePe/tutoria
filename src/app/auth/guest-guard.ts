import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';

import { AuthStore } from './auth-store';
import { homePath } from './home-path';

/** The login is only for visitors: a signed-in user goes to the home of their role. */
export const guestGuard: CanMatchFn = () => {
  const role = inject(AuthStore).role();
  return role ? inject(Router).parseUrl(homePath(role)) : true;
};
