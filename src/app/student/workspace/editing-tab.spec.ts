import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { EditingTab } from './editing-tab';
import { FakeTabChannel, provideTestEditingTab, takenByOtherTab } from './editing-tab-testing';

describe('EditingTab', () => {
  let channel: FakeTabChannel;
  let tab: EditingTab;

  beforeEach(() => {
    channel = new FakeTabChannel();
    TestBed.configureTestingModule({ providers: provideTestEditingTab(channel) });
    tab = TestBed.inject(EditingTab);
  });

  it('tells the other tabs it takes the attempt', () => {
    tab.claim('attempt-1');

    expect(channel.sent).toEqual([{ attemptId: 'attempt-1', tabId: expect.any(String) }]);
    expect(tab.elsewhere()).toBe(false);
  });

  it('stops editing when another tab takes the same attempt, until it takes it back', () => {
    const taken = vi.fn();
    tab.claim('attempt-1', taken);

    channel.fromOtherTab(takenByOtherTab('attempt-1'));
    expect(tab.elsewhere()).toBe(true);
    expect(taken).toHaveBeenCalledOnce();

    tab.claim('attempt-1');
    expect(tab.elsewhere()).toBe(false);
  });

  it('ignores another attempt and its own messages', () => {
    tab.claim('attempt-1');
    const [own] = channel.sent;

    channel.fromOtherTab(takenByOtherTab('attempt-2'));
    channel.fromOtherTab(own);

    expect(tab.elsewhere()).toBe(false);
  });

  it('closes the channel when the workspace is left', () => {
    tab.claim('attempt-1');
    TestBed.resetTestingModule();

    expect(channel.closed).toBe(true);
    channel.fromOtherTab(takenByOtherTab('attempt-1'));
    expect(tab.elsewhere()).toBe(false);
  });

  it('opens a BroadcastChannel of its own outside the tests', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [EditingTab] });

    expect(() => TestBed.inject(EditingTab).claim('attempt-1')).not.toThrow();
  });

  it('opens a new channel each time the workspace opens, as the last one closed on leaving', () => {
    TestBed.resetTestingModule();
    const root = TestBed.inject(EnvironmentInjector);
    const first = createEnvironmentInjector([EditingTab], root);
    first.get(EditingTab).claim('attempt-1');
    first.destroy();

    const second = createEnvironmentInjector([EditingTab], root);

    expect(() => second.get(EditingTab).claim('attempt-2')).not.toThrow();
    second.destroy();
  });
});
