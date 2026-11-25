import { inject } from '@angular/core';

import { AuthStore } from '../../auth/auth-store';
import type { GuideProfile, GuideSideMenu } from '../../core/guide/guide-task';
import { teacherGuide } from '../../teacher/teacher-guide/teacher-guide';
import { adminGuide } from './admin-guide';

/**
 * The guided help of the staff, chosen by the role, not by the area (D-093): the routes of both
 * areas give it to StaffLayout (STAFF_GUIDE), so the administration keeps its own on the screens
 * of the teacher.
 */
export function staffGuide(sideMenu: GuideSideMenu): GuideProfile | undefined {
  switch (inject(AuthStore).role()) {
    case 'teacher':
      return teacherGuide(sideMenu);
    case 'admin':
      return adminGuide(sideMenu);
    default:
      return undefined;
  }
}
