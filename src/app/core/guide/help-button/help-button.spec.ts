import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { GuideStore } from '../guide-store';
import { FakeGuideStore, guideTask } from '../guide-testing';
import { HelpPanel } from '../help-panel/help-panel';
import { HelpButton } from './help-button';

describe('HelpButton', () => {
  let guide: FakeGuideStore;
  let open: ReturnType<typeof vi.fn>;
  let phone: boolean;

  async function renderButton() {
    guide = guide ?? new FakeGuideStore();
    open = vi.fn();
    await render(HelpButton, {
      providers: [
        { provide: GuideStore, useValue: guide },
        { provide: MatDialog, useValue: { open } },
        { provide: BreakpointObserver, useValue: { isMatched: () => phone } },
      ],
    });
  }

  beforeEach(() => {
    guide = new FakeGuideStore();
    phone = false;
  });

  it('is called «Ayuda», with no dot once there are no first steps left', async () => {
    await renderButton();

    const button = screen.getByRole('button', { name: 'Ayuda' });
    expect(button.getAttribute('data-guide')).toBe('help');
    expect(button.parentElement?.querySelector('.bg-primary')).toBeNull();
  });

  it('says how many first steps are done, with a dot, while some is left', async () => {
    guide.tasks.set([guideTask('a', { doneBy: 'started' }), guideTask('b')]);
    guide.firstStepIds.set(['a', 'b']);
    guide.facts.set({ known: new Set(['started']), places: {} });

    await renderButton();

    const button = screen.getByRole('button', { name: 'Ayuda: 1 de 2 primeros pasos hechos' });
    expect(button.parentElement?.querySelector('.bg-primary')).toBeTruthy();
  });

  it('opens the panel on the right, over the whole screen on phones', async () => {
    await renderButton();
    await userEvent.click(screen.getByRole('button', { name: 'Ayuda' }));

    expect(open).toHaveBeenCalledWith(
      HelpPanel,
      expect.objectContaining({
        panelClass: 'app-side-panel',
        position: { right: '0', top: '0' },
        width: '26rem',
        ariaLabelledBy: 'help-panel-title',
        autoFocus: '#help-panel-title',
        injector: expect.anything(),
      }),
    );

    phone = true;
    await userEvent.click(screen.getByRole('button', { name: 'Ayuda' }));
    expect(open).toHaveBeenLastCalledWith(HelpPanel, expect.objectContaining({ width: '100vw' }));
  });

  it('starts the welcome when it is due', async () => {
    await renderButton();
    expect(guide.startWelcome).not.toHaveBeenCalled();

    guide.welcomeDue.set(true);
    TestBed.tick();

    expect(guide.startWelcome).toHaveBeenCalledOnce();
  });
});
