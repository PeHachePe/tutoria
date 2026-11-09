import { Routes } from '@angular/router';

import { AttemptStore } from './attempt-store';
import { BrowserSignals } from './browser-signals';
import { TutorStore } from './tutor-store';
import { WorkspacePage } from './workspace-page';

/**
 * The workspace, loaded on its own when the student opens an exercise, so the catalog does not
 * download it. Its stores live here: the attempt and the conversation shared by its zones, and the
 * browser signals (2.8), all destroyed on leaving and kept while moving between exercises (4.5).
 */
export const workspaceRoutes: Routes = [
  {
    path: '',
    component: WorkspacePage,
    providers: [AttemptStore, TutorStore, BrowserSignals],
  },
];
