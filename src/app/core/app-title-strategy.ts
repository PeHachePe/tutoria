import { inject, Service } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const APP_NAME = 'TutorIA';

/**
 * Tab title of each screen: the `title` of its route followed by the name of the app
 * («Acceso · TutorIA»), so no route has to repeat it. A route without a title shows the name alone.
 *
 * A navigation that only changes the query or the fragment stays on the same screen, as for
 * `HeadingFocus`: it keeps the title, which may be the one the screen set from what it loaded (the
 * group of the live panel when the teacher changes its block or its filter).
 */
@Service()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  /** The path of the screen, without query nor fragment; null before the first navigation. */
  private path: string | null = null;

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const path = snapshot.url.split(/[?#]/)[0];
    if (path === this.path) return;
    this.path = path;
    this.setScreenTitle(this.buildTitle(snapshot));
  }

  /**
   * For a screen whose title depends on what it loads, such as the exercise of the workspace: it
   * replaces the generic title of its route once the data arrives. The next navigation to another
   * screen sets it again.
   */
  setScreenTitle(title: string | undefined): void {
    this.title.setTitle(title ? `${title} · ${APP_NAME}` : APP_NAME);
  }
}
