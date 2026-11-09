import {
  CODE_SHARE,
  paneShareKey,
  readPaneShare,
  savePaneShare,
  STATEMENT_SHARE,
} from './pane-share';

describe('pane share', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts with the default share', () => {
    expect(readPaneShare(STATEMENT_SHARE, 'u1')).toBe(STATEMENT_SHARE.default);
    expect(readPaneShare(STATEMENT_SHARE, undefined)).toBe(STATEMENT_SHARE.default);
    expect(readPaneShare(CODE_SHARE, 'u1')).toBe(CODE_SHARE.default);
  });

  it('remembers the share of each pane and each user', () => {
    savePaneShare(STATEMENT_SHARE, 'u1', 60);
    savePaneShare(CODE_SHARE, 'u1', 55);

    expect(localStorage.getItem(paneShareKey(STATEMENT_SHARE, 'u1'))).toBe('60');
    expect(readPaneShare(STATEMENT_SHARE, 'u1')).toBe(60);
    expect(readPaneShare(CODE_SHARE, 'u1')).toBe(55);
    expect(readPaneShare(STATEMENT_SHARE, 'u2')).toBe(STATEMENT_SHARE.default);
  });

  it('keeps the key the statement share had before there were other panes', () => {
    expect(paneShareKey(STATEMENT_SHARE, 'u1')).toBe('tutoria.statement-share.u1');
  });

  it('ignores a saved value that is not a share within the limits', () => {
    for (const saved of ['abc', '5', '95', '']) {
      localStorage.setItem(paneShareKey(STATEMENT_SHARE, 'u1'), saved);
      expect(readPaneShare(STATEMENT_SHARE, 'u1')).toBe(STATEMENT_SHARE.default);
    }
  });

  it('keeps working without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => savePaneShare(STATEMENT_SHARE, 'u1', 60)).not.toThrow();
    expect(readPaneShare(STATEMENT_SHARE, 'u1')).toBe(STATEMENT_SHARE.default);
  });

  it('does not save without a user', () => {
    savePaneShare(STATEMENT_SHARE, undefined, 60);

    expect(localStorage.length).toBe(0);
  });
});
