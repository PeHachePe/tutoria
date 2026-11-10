import { keepaliveFetch } from './keepalive-fetch';

describe('keepaliveFetch', () => {
  const fetchSpy = vi.fn<typeof fetch>(() => Promise.resolve(new Response()));
  let visibility: DocumentVisibilityState;
  const page = {
    get visibilityState() {
      return visibility;
    },
  } as Document;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    fetchSpy.mockClear();
    visibility = 'visible';
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends a write with keepalive while the page is hidden', async () => {
    visibility = 'hidden';

    await keepaliveFetch(page)('https://api.test/rest/v1/process_event', { method: 'POST' });

    expect(fetchSpy).toHaveBeenCalledWith('https://api.test/rest/v1/process_event', {
      method: 'POST',
      keepalive: true,
    });
  });

  it('leaves a write alone while the page is visible', async () => {
    const init = { method: 'PATCH' };

    await keepaliveFetch(page)('https://api.test/rest/v1/attempt', init);

    expect(fetchSpy).toHaveBeenCalledWith('https://api.test/rest/v1/attempt', init);
  });

  it('leaves a read alone even while the page is hidden', async () => {
    visibility = 'hidden';

    await keepaliveFetch(page)('https://api.test/rest/v1/exercise');

    expect(fetchSpy).toHaveBeenCalledWith('https://api.test/rest/v1/exercise', undefined);
  });
});
