import { render, screen } from '@testing-library/angular';

import { StatementZone } from './statement-zone';

// The workspace page tests the zone with its exercise (workspace-page.spec.ts); this covers it alone.
describe('StatementZone', () => {
  it('shows only its heading while there is no exercise', async () => {
    await render(StatementZone);

    expect(screen.getByRole('region', { name: 'Enunciado' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
