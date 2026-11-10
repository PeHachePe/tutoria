import { clearDraft, readDraft, saveDraft } from './code-draft';

describe('code drafts', () => {
  const DRAFT = { code: 'return 1;', base: '' };

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps a draft per attempt until it is cleared', () => {
    saveDraft('attempt-1', DRAFT);

    expect(readDraft('attempt-1')).toEqual(DRAFT);
    expect(readDraft('attempt-2')).toBeUndefined();
    clearDraft('attempt-1');
    expect(readDraft('attempt-1')).toBeUndefined();
  });

  it.each(['{', '"text"', '{"code":1,"base":"x"}', '{"code":"x"}'])(
    'ignores a broken value (%s)',
    (value) => {
      localStorage.setItem('tutoria.code-draft.attempt-1', value);

      expect(readDraft('attempt-1')).toBeUndefined();
    },
  );

  it('works without storage, as without drafts', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => saveDraft('attempt-1', DRAFT)).not.toThrow();
    expect(readDraft('attempt-1')).toBeUndefined();
    expect(() => clearDraft('attempt-1')).not.toThrow();
  });
});
