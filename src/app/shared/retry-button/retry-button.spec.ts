import { formatDate } from '@angular/common';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DataError } from '../../data/data-error';
import { RetryButton } from './retry-button';

describe('RetryButton', () => {
  afterEach(() => vi.useRealTimers());

  async function renderButton(error: unknown) {
    const retry = vi.fn();
    const view = await render(RetryButton, { inputs: { error }, on: { retry } });
    return { retry, view };
  }

  it('retries at once after an error that needs no waiting', async () => {
    const { retry } = await renderButton(new DataError('network'));

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it('counts down the wait the server asked for, and then lets retry', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-10T10:00:00Z') });
    const { retry, view } = await renderButton(
      new DataError('rate_limited', 'Too many', { retryAfterSeconds: 3 }),
    );

    const waiting = screen.getByRole('button', { name: 'Reintentar en 3 s' });
    expect(waiting).toHaveProperty('disabled', true);

    await vi.advanceTimersByTimeAsync(1000);
    view.fixture.detectChanges();
    expect(screen.getByRole('button', { name: 'Reintentar en 2 s' })).toHaveProperty(
      'disabled',
      true,
    );

    await vi.advanceTimersByTimeAsync(2000);
    view.fixture.detectChanges();
    const ready = screen.getByRole('button', { name: 'Reintentar' });
    expect(ready).toHaveProperty('disabled', false);
    ready.click();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('tells a long wait as the time it ends, instead of counting it down', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-10T10:00:00Z') });
    const error = new DataError('rate_limited', 'Too many', { retryAfterSeconds: 3600 });
    await renderButton(error);

    const time = formatDate(error.retryAt ?? 0, 'shortTime', TestBed.inject(LOCALE_ID));
    expect(screen.getByRole('button', { name: `Reintentar a las ${time}` })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('does not wait for an error that is not a DataError', async () => {
    await renderButton(new Error('boom'));

    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveProperty('disabled', false);
  });
});
