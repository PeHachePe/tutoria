import { render, screen } from '@testing-library/angular';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('shows its title, its text and what it projects', async () => {
    await render(
      `<app-empty-state heading="Nada por aquí" text="Vuelve más tarde."><span>🐶</span></app-empty-state>`,
      { imports: [EmptyState] },
    );

    expect(screen.getByText('Nada por aquí')).toBeTruthy();
    expect(screen.getByText('Vuelve más tarde.')).toBeTruthy();
    expect(screen.getByText('🐶')).toBeTruthy();
  });

  it('can go without a text', async () => {
    const { container } = await render(`<app-empty-state heading="Nada por aquí" />`, {
      imports: [EmptyState],
    });

    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});
