import { Router, UrlTree } from '@angular/router';

import { APP_PATHS, REDIRECT_PARAM } from '../core/app-paths';

/** The login, with the page to come back to after signing in (`?redirect=`, afterSignInPath). */
export function loginRedirect(router: Router, returnUrl: string): UrlTree {
  return router.createUrlTree([APP_PATHS.login], {
    queryParams: { [REDIRECT_PARAM]: returnUrl },
  });
}
