import { APP_PATHS } from '../core/app-paths';

/** One slash and then anything but another slash or a backslash, which browsers read as `//`. */
const APP_PATH_PATTERN = /^\/(?![/\\])/;

/**
 * Where the login goes after signing in: back to the page that sent the visitor to the login
 * (`?redirect=`, set by the role guard), or to the root, which leads to the home of their role.
 *
 * The redirect comes from the URL, so anyone can craft it: only a path of the app is accepted
 * (`/…`), never another origin (`//host`, `/\host`, `https:`) or the login itself.
 */
export function afterSignInPath(redirect: string | undefined): string {
  if (!redirect || !APP_PATH_PATTERN.test(redirect)) {
    return APP_PATHS.root;
  }
  const [path] = redirect.split(/[?#]/);
  const isLogin = path === APP_PATHS.login || path.startsWith(`${APP_PATHS.login}/`);
  return isLogin ? APP_PATHS.root : redirect;
}
