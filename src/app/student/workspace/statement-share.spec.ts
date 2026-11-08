import {
  readStatementShare,
  saveStatementShare,
  STATEMENT_SHARE,
  statementShareKey,
} from './statement-share';

describe('statement share', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts with the default share', () => {
    expect(readStatementShare('u1')).toBe(STATEMENT_SHARE.default);
    expect(readStatementShare(undefined)).toBe(STATEMENT_SHARE.default);
  });

  it('remembers the share of each user', () => {
    saveStatementShare('u1', 60);

    expect(localStorage.getItem(statementShareKey('u1'))).toBe('60');
    expect(readStatementShare('u1')).toBe(60);
    expect(readStatementShare('u2')).toBe(STATEMENT_SHARE.default);
  });

  it('ignores a saved value that is not a share within the limits', () => {
    for (const saved of ['abc', '5', '95', '']) {
      localStorage.setItem(statementShareKey('u1'), saved);
      expect(readStatementShare('u1')).toBe(STATEMENT_SHARE.default);
    }
  });

  it('keeps working without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => saveStatementShare('u1', 60)).not.toThrow();
    expect(readStatementShare('u1')).toBe(STATEMENT_SHARE.default);
  });

  it('does not save without a user', () => {
    saveStatementShare(undefined, 60);

    expect(localStorage.length).toBe(0);
  });
});
