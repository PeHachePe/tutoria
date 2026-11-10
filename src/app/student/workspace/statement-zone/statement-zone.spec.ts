import { render, screen } from '@testing-library/angular';

import { StatementZone } from './statement-zone';

// The workspace page tests the zone with its exercise (workspace-page.spec.ts); this covers it alone.
describe('StatementZone', () => {
  it('shows only its heading while there is no exercise', async () => {
    // Inside a template: as the root of the test, the id the zone gives its host would replace the
    // one TestBed uses to remove it afterwards, and it would stay in the page for the next tests
    await render('<app-statement-zone />', { imports: [StatementZone] });

    expect(screen.getByRole('region', { name: 'Enunciado' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
