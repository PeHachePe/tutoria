import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../../auth/auth-store';
import { reactionEmojisKey, reactionsKey, SettingsStore } from './settings-store';

describe('SettingsStore', () => {
  let userId: ReturnType<typeof signal<string | undefined>>;
  let store: SettingsStore;

  beforeEach(() => {
    userId = signal<string | undefined>('u1');
    TestBed.configureTestingModule({
      providers: [{ provide: AuthStore, useValue: { userId } }],
    });
    store = TestBed.inject(SettingsStore);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows the reactions in full by default', () => {
    expect(store.reactions()).toBe('full');
  });

  it('remembers the reactions each user chose', () => {
    store.setReactions('reduced');

    expect(store.reactions()).toBe('reduced');
    expect(localStorage.getItem(reactionsKey('u1'))).toBe('reduced');

    userId.set('u2');
    expect(store.reactions()).toBe('full');

    store.setReactions('off');
    userId.set('u1');
    expect(store.reactions()).toBe('reduced');
  });

  it('ignores a saved value that is not a mode', () => {
    localStorage.setItem(reactionsKey('u1'), 'loud');
    userId.set(undefined);
    userId.set('u1');

    expect(store.reactions()).toBe('full');
  });

  it('keeps the choice until the page closes without a user or without storage', () => {
    userId.set(undefined);
    store.setReactions('off');
    expect(store.reactions()).toBe('off');
    expect(localStorage.length).toBe(0);

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    userId.set('u3');
    expect(store.reactions()).toBe('full');
    store.setReactions('reduced');
    expect(store.reactions()).toBe('reduced');
  });

  it('shows the 3D emoji by default, and remembers who prefers the flat ones', () => {
    expect(store.reactionEmojis()).toBe(true);

    store.setReactionEmojis(false);
    expect(store.reactionEmojis()).toBe(false);
    expect(localStorage.getItem(reactionEmojisKey('u1'))).toBe('false');

    userId.set('u2');
    expect(store.reactionEmojis()).toBe(true);
    userId.set('u1');
    expect(store.reactionEmojis()).toBe(false);
  });
});
