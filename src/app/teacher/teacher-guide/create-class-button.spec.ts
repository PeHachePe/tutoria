import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { GuideStore } from '../../core/guide/guide-store';
import { FakeGuideStore, guideTask } from '../../core/guide/guide-testing';
import { CreateClassButton } from './create-class-button';

describe('CreateClassButton', () => {
  let guide: FakeGuideStore;

  async function renderButton() {
    await render(CreateClassButton, {
      providers: [provideRouter([]), { provide: GuideStore, useValue: guide }],
    });
  }

  beforeEach(() => {
    guide = new FakeGuideStore();
  });

  it('starts the guided task that creates the class, marked for the help', async () => {
    const task = guideTask('create-class');
    guide.tasks.set([guideTask('other'), task]);
    await renderButton();

    const button = screen.getByRole('button', { name: 'Crear tu clase' });
    await userEvent.click(button);

    expect(guide.startTask).toHaveBeenCalledExactlyOnceWith(task);
    expect(button.getAttribute('data-guide')).toBe('create-class');
  });

  it('leads to Grupos where the area has no guided help', async () => {
    await renderButton();

    expect(screen.getByRole('link', { name: 'Crear tu clase' }).getAttribute('href')).toBe(
      '/docente/grupos',
    );
  });
});
