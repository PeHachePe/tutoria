import { UnavailableTutorService } from './unavailable-tutor-service';

describe('the service not available yet against Supabase', () => {
  it('the tutor fails as unavailable when its answer is read', async () => {
    const read = async () => {
      for await (const event of new UnavailableTutorService().ask()) void event;
    };

    await expect(read()).rejects.toMatchObject({ kind: 'unavailable' });
  });
});
