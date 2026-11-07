import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { SkipLink } from './skip-link';

@Component({
  imports: [SkipLink],
  template: `
    <app-skip-link />
    <nav><a href="/otra">Otra página</a></nav>
    <main id="contenido" tabindex="-1">Contenido</main>
  `,
})
class Shell {}

describe('SkipLink', () => {
  it('is the first stop of the keyboard and moves the focus to the main content', async () => {
    await render(Shell);
    const user = userEvent.setup();

    await user.tab();
    const link = screen.getByRole('link', { name: 'Saltar al contenido' });
    expect(document.activeElement).toBe(link);

    await user.keyboard('{Enter}');

    expect(document.activeElement).toBe(screen.getByRole('main'));
    expect(location.hash).toBe('');
  });
});
