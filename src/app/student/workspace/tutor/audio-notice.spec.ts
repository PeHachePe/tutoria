import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { AudioNotice } from './audio-notice';

describe('AudioNotice', () => {
  it('says where the audio goes, and «Entendido» accepts it', async () => {
    const accepted = vi.fn();
    await render(AudioNotice, { on: { accepted } });

    expect(screen.getByRole('status').textContent).toContain(
      'Tu navegador envía el audio a su servicio de reconocimiento para transcribirlo. TutorIA no lo graba.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(accepted).toHaveBeenCalledOnce();
  });
});
