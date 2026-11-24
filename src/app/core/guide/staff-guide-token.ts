import { InjectionToken } from '@angular/core';

import type { GuideProfile, GuideSideMenu } from './guide-task';

/**
 * The guided help of the staff (2.12, D-093), given by the routes of each area to the shared
 * StaffLayout, which cannot import the areas. It is chosen by the role, not by the area, and called
 * in the injection context of the layout with its side menu; undefined while a role has none.
 */
export const STAFF_GUIDE = new InjectionToken<
  (sideMenu: GuideSideMenu) => GuideProfile | undefined
>('STAFF_GUIDE');
