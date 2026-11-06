import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { projectDirName } from './project-dir.mjs';

describe('projectDirName', () => {
  it('turns a Windows path into the folder name Claude Code uses', () => {
    assert.equal(projectDirName('D:\\TutorIA\\tutoria'), 'D--TutorIA-tutoria');
  });

  it('turns a POSIX path into the folder name Claude Code uses', () => {
    assert.equal(projectDirName('/home/me/my.project'), '-home-me-my-project');
  });
});
