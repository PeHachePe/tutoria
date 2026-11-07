import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';

import { LOADING_INDICATOR_DELAY_MS, LoadingSkeleton } from './loading-skeleton';
import { Skeleton } from './skeleton';

@Component({
  imports: [LoadingSkeleton, Skeleton],
  template: `
    <app-loading-skeleton label="Cargando los ejercicios…">
      <app-skeleton class="h-6" />
    </app-loading-skeleton>
  `,
})
class Host {}

describe('LoadingSkeleton', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows nothing while the wait is shorter than the threshold', async () => {
    const { container, fixture } = await render(Host);

    vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS - 1);
    fixture.detectChanges();

    expect(container.querySelector('app-skeleton')).toBeNull();
    expect(screen.getByRole('status').textContent?.trim()).toBe('');
  });

  it('shows the skeleton and tells screen readers it is loading once past the threshold', async () => {
    const { container, fixture } = await render(Host);

    vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS);
    fixture.detectChanges();

    const skeleton = container.querySelector('app-skeleton');
    expect(skeleton?.getAttribute('aria-hidden')).toBe('true');
    expect(skeleton?.classList).toContain('motion-reduce:animate-none');
    expect(screen.getByRole('status').textContent?.trim()).toBe('Cargando los ejercicios…');
  });

  it('stops waiting when it is removed before the threshold', async () => {
    const { fixture } = await render(Host);

    fixture.destroy();

    expect(vi.getTimerCount()).toBe(0);
  });
});
