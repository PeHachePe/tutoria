import { Routes } from '@angular/router';

import { provideAppTools } from '../../core/tools/app-tool';

import { AttemptStore } from './attempt-store';
import { BrowserSignals } from './browser-signals';
import { EditingTab } from './editing-tab';
import { TutorStore } from './tutor-store';
import { WorkspacePage } from './workspace-page';
import { workspaceTools } from './workspace-tools';

/**
 * The workspace, loaded on its own when the student opens an exercise, so the catalog does not
 * download it. Its stores live here: the attempt and the conversation shared by its zones, and the
 * browser signals (2.8) and the tab that edits the attempt (D-041), all destroyed on leaving and kept while moving between exercises (4.5), and the tools of the screen (2.5e).
 */
export const workspaceRoutes: Routes = [
  {
    path: '',
    component: WorkspacePage,
    providers: [
      AttemptStore,
      EditingTab,
      TutorStore,
      BrowserSignals,
      // Its tools, for our tutor and for the agents of the browser while it is open (2.5e)
      provideAppTools(workspaceTools),
    ],
  },
];
