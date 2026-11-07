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
    const title = this.buildTitle(snapshot);
    this.title.setTitle(title ? `${title} · ${APP_NAME}` : APP_NAME);
  }
}
