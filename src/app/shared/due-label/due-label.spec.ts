import { render } from '@testing-library/angular';

import { DueLabel } from './due-label';

describe('DueLabel', () => {
  // Local dates, whatever the time zone of the machine
  const now = new Date(2026, 10, 15, 10, 0);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
  });

  afterEach(() => vi.useRealTimers());

  async function label(dueAt: Date): Promise<string> {
    const { container } = await render(DueLabel, { inputs: { dueAt: dueAt.toISOString() } });
    return container.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it.each([
    [new Date(2026, 10, 15, 23, 59), /15 nov.*hoy$/],
    [new Date(2026, 10, 16, 23, 59), /16 nov.*mañana$/],
    [new Date(2026, 10, 20, 23, 59), /20 nov.*en 5 días$/],
    [new Date(2026, 10, 14, 23, 59), /14 nov.*ayer$/],
    [new Date(2026, 10, 6, 23, 59), /6 nov.*hace 9 días$/],
  ])('describes %s', async (dueAt, expected) => {
    expect(await label(dueAt)).toMatch(expected);
  });
});
