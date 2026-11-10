import { UnavailableCodeRunnerService } from './unavailable-code-runner-service';
import { UnavailableTutorService } from './unavailable-tutor-service';

describe('the services not available yet against Supabase', () => {
  it('the runner fails as unavailable', async () => {
    await expect(new UnavailableCodeRunnerService().run()).rejects.toMatchObject({
      kind: 'unavailable',
    });
  });

  it('the tutor fails as unavailable when its answer is read', async () => {
    const read = async () => {
      for await (const event of new UnavailableTutorService().ask()) void event;
    };

    await expect(read()).rejects.toMatchObject({ kind: 'unavailable' });
  });
});
