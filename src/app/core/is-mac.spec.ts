import { TestBed } from '@angular/core/testing';

import { IS_MAC, isApplePlatform } from './is-mac';

describe('isApplePlatform', () => {
  it.each([
    ['a Mac, by its user agent data', { userAgentData: { platform: 'macOS' } }, true],
    ['a Mac, by its platform', { platform: 'MacIntel' }, true],
    ['an iPad', { platform: 'iPad' }, true],
    ['an iPhone', { platform: 'iPhone' }, true],
    ['Windows', { userAgentData: { platform: 'Windows' }, platform: 'Win32' }, false],
    ['Linux', { platform: 'Linux x86_64' }, false],
    ['a browser that says nothing', {}, false],
    ['no browser', undefined, false],
  ])('knows %s', (_, navigator, expected) => {
    expect(isApplePlatform(navigator)).toBe(expected);
  });

  it('trusts the user agent data over the platform', () => {
    expect(isApplePlatform({ userAgentData: { platform: 'Windows' }, platform: 'MacIntel' })).toBe(
      false,
    );
  });
});

describe('IS_MAC', () => {
  it('reads the navigator of the page', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');

    expect(TestBed.inject(IS_MAC)).toBe(true);
  });
});
