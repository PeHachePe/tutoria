import { DOCUMENT, inject, InjectionToken } from '@angular/core';

/** What is read of the browser: `navigator`, with `userAgentData` where the browser has it. */
export interface PlatformInfo {
  readonly platform?: string;
  readonly userAgentData?: { readonly platform: string };
}

/**
 * Whether the browser runs on an Apple system, whose keyboards say ⌘ and ⌥ instead of Ctrl and
 * Alt: a Mac, and an iPad or iPhone with a keyboard. `userAgentData` first, where the browser has
 * it; `platform` otherwise (Safari, Firefox).
 */
export function isApplePlatform(navigator: PlatformInfo | undefined): boolean {
  const platform = navigator?.userAgentData?.platform || navigator?.platform || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Whether the shortcuts are named as on a Mac (⌘, ⌥). */
export const IS_MAC = new InjectionToken<boolean>('IS_MAC', {
  providedIn: 'root',
  factory: () => isApplePlatform(inject(DOCUMENT).defaultView?.navigator),
});
