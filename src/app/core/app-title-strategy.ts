import { inject, Service } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const APP_NAME = 'TutorIA';

/**
 * Tab title of each screen: the `title` of its route followed by the name of the app
 * («Acceso · TutorIA»), so no route has to repeat it. A route without a title shows the name alone.
 */
@Service()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.setScreenTitle(this.buildTitle(snapshot));
  }

  /**
   * For a screen whose title depends on what it loads, such as the exercise of the workspace: it
   * replaces the generic title of its route once the data arrives. The next navigation sets it again.
   */
  setScreenTitle(title: string | undefined): void {
    this.title.setTitle(title ? `${title} · ${APP_NAME}` : APP_NAME);
  }
}
