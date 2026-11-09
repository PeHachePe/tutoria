import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../../auth/auth-store';
import { SettingsStore, settingKey } from './settings-store';

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

  it('starts with the defaults', () => {
    expect(store.reactions()).toBe('full');
    expect(store.reactionEmojis()).toBe(true);
    expect(store.proactive()).toBe(true);
    expect(store.mascotHeadset()).toBe(true);
    expect(store.mascotBowTie()).toBe(true);
    expect(store.mascotBoneCursor()).toBe(true);
    expect(store.dataNoticeSeen()).toBe(false);
  });

  it('remembers the reactions each user chose', () => {
    store.setReactions('reduced');

    expect(store.reactions()).toBe('reduced');
    expect(localStorage.getItem(settingKey('reactions', 'u1'))).toBe('reduced');

    userId.set('u2');
    expect(store.reactions()).toBe('full');

    store.setReactions('off');
    userId.set('u1');
    expect(store.reactions()).toBe('reduced');
  });

  it('ignores a saved value that is not a mode', () => {
    localStorage.setItem(settingKey('reactions', 'u1'), 'loud');
    userId.set(undefined);
    userId.set('u1');

    expect(store.reactions()).toBe('full');
  });

  it('keeps the choice until the page closes without a user or without storage', () => {
    userId.set(undefined);
    store.setReactions('off');
    store.setProactive(false);
    expect(store.reactions()).toBe('off');
    expect(store.proactive()).toBe(false);
    expect(localStorage.length).toBe(0);

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    userId.set('u3');
    expect(store.reactions()).toBe('full');
    expect(store.proactive()).toBe(true);
    store.setReactions('reduced');
    store.setMascotBowTie(false);
    expect(store.reactions()).toBe('reduced');
    expect(store.mascotBowTie()).toBe(false);
  });

  it.each([
    ['reactionEmojis', (on: boolean) => store.setReactionEmojis(on), () => store.reactionEmojis()],
    ['proactive', (on: boolean) => store.setProactive(on), () => store.proactive()],
    ['mascotHeadset', (on: boolean) => store.setMascotHeadset(on), () => store.mascotHeadset()],
    ['mascotBowTie', (on: boolean) => store.setMascotBowTie(on), () => store.mascotBowTie()],
    [
      'mascotBoneCursor',
      (on: boolean) => store.setMascotBoneCursor(on),
      () => store.mascotBoneCursor(),
    ],
  ] as const)('remembers per user who turns %s off', (name, set, get) => {
    set(false);
    expect(get()).toBe(false);
    expect(localStorage.getItem(settingKey(name, 'u1'))).toBe('false');

    userId.set('u2');
    expect(get()).toBe(true);
    userId.set('u1');
    expect(get()).toBe(false);

    set(true);
    expect(get()).toBe(true);
  });

  it('remembers per user that the notice on the registered data was seen', () => {
    store.markDataNoticeSeen();
    expect(store.dataNoticeSeen()).toBe(true);

    userId.set('u2');
    expect(store.dataNoticeSeen()).toBe(false);
    userId.set('u1');
    expect(store.dataNoticeSeen()).toBe(true);
  });
});
