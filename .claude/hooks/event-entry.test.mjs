import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hideUserFolders, toEventEntry } from './event-entry.mjs';

describe('hideUserFolders', () => {
  it('hides the user folder in Windows, short and Git Bash forms', () => {
    assert.equal(hideUserFolders('cat C:\\Users\\some.one\\x.txt'), 'cat ~\\x.txt');
    assert.equal(hideUserFolders('cd "C:/Users/SOME~1.ONE/AppData/Temp"'), 'cd "~/AppData/Temp"');
    assert.equal(hideUserFolders('ls /c/Users/some.one/.claude'), 'ls ~/.claude');
  });

  it('leaves other paths and missing text untouched', () => {
    assert.equal(hideUserFolders('npm run check'), 'npm run check');
    assert.equal(hideUserFolders(undefined), undefined);
  });
});

const context = {
  projectDir: 'D:\\TutorIA\\tutoria',
  homeDir: 'C:\\Users\\someone',
  now: new Date('2026-11-06T20:00:00.000Z'),
};

const base = { session_id: 'abc-123', cwd: 'D:\\TutorIA\\tutoria' };

describe('toEventEntry', () => {
  it('records the start of a session with its source and model', () => {
    const entry = toEventEntry(
      { ...base, hook_event_name: 'SessionStart', source: 'startup', model: 'claude-opus-5-5' },
      context,
    );
    assert.deepEqual(entry, {
      ts: '2026-11-06T20:00:00.000Z',
      session: 'abc-123',
      event: 'session_start',
      source: 'startup',
      model: 'claude-opus-5-5',
    });
  });

  it('omits the model when the hook does not send it', () => {
    const entry = toEventEntry(
      { ...base, hook_event_name: 'SessionStart', source: 'clear' },
      context,
    );
    assert.equal('model' in entry, false);
  });

  it('records the end of a session with its reason', () => {
    const entry = toEventEntry(
      { ...base, hook_event_name: 'SessionEnd', reason: 'other' },
      context,
    );
    assert.equal(entry.event, 'session_end');
    assert.equal(entry.reason, 'other');
  });

  it('records the time of each prompt but never its text', () => {
    const entry = toEventEntry(
      { ...base, hook_event_name: 'UserPromptSubmit', prompt: 'Paso 0.2' },
      context,
    );
    assert.deepEqual(entry, {
      ts: '2026-11-06T20:00:00.000Z',
      session: 'abc-123',
      event: 'prompt',
    });
  });

  it('records a successful command without its output', () => {
    const entry = toEventEntry(
      {
        ...base,
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'npm run check', description: 'Run checks' },
        tool_response: { stdout: 'secret output', stderr: '' },
      },
      context,
    );
    assert.deepEqual(entry, {
      ts: '2026-11-06T20:00:00.000Z',
      session: 'abc-123',
      event: 'command',
      tool: 'Bash',
      command: 'npm run check',
      ok: true,
    });
  });

  it('records a failed command with its exit code', () => {
    const entry = toEventEntry(
      {
        ...base,
        hook_event_name: 'PostToolUseFailure',
        tool_name: 'PowerShell',
        tool_input: { command: 'ng lint' },
        error: 'Exit code 2\nLint errors found',
      },
      context,
    );
    assert.equal(entry.event, 'command');
    assert.equal(entry.ok, false);
    assert.equal(entry.exitCode, 2);
    assert.equal(JSON.stringify(entry).includes('Lint errors found'), false);
  });

  it('records a created file with a path relative to the project', () => {
    const entry = toEventEntry(
      {
        ...base,
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: 'D:\\TutorIA\\tutoria\\src\\app\\app.ts', content: 'x' },
        tool_response: { filePath: 'D:\\TutorIA\\tutoria\\src\\app\\app.ts', type: 'create' },
      },
      context,
    );
    assert.deepEqual(entry, {
      ts: '2026-11-06T20:00:00.000Z',
      session: 'abc-123',
      event: 'file',
      tool: 'Write',
      path: 'src/app/app.ts',
      action: 'create',
    });
  });

  it('records an edited file as an update', () => {
    const entry = toEventEntry(
      {
        ...base,
        hook_event_name: 'PostToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: 'D:/TutorIA/tutoria/docs/PLAN.md' },
      },
      context,
    );
    assert.equal(entry.path, 'docs/PLAN.md');
    assert.equal(entry.action, 'update');
  });

  it('reads the path of an edited notebook', () => {
    const entry = toEventEntry(
      {
        ...base,
        hook_event_name: 'PostToolUse',
        tool_name: 'NotebookEdit',
        tool_input: { notebook_path: 'D:\\TutorIA\\tutoria\\notes.ipynb' },
      },
      context,
    );
    assert.equal(entry.path, 'notes.ipynb');
  });

  it('hides the user folder for files outside the project', () => {
    const entry = toEventEntry(
      {
        ...base,
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: 'C:\\Users\\someone\\.claude\\memory\\note.md' },
        tool_response: { type: 'update' },
      },
      context,
    );
    assert.equal(entry.path, '~/.claude/memory/note.md');
  });

  it('hides the user folder when it is written with its short name', () => {
    const entry = toEventEntry(
      {
        ...base,
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: 'C:\\Users\\SOMEON~1\\AppData\\Local\\Temp\\a.mjs' },
      },
      context,
    );
    assert.equal(entry.path, '~/AppData/Local/Temp/a.mjs');
  });

  it('marks the events of a subagent', () => {
    const entry = toEventEntry(
      {
        ...base,
        agent_id: 'agent-1',
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      },
      context,
    );
    assert.equal(entry.agent, 'agent-1');
  });

  it('ignores other tools and events', () => {
    assert.equal(
      toEventEntry({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Read' }, context),
      null,
    );
    assert.equal(toEventEntry({ ...base, hook_event_name: 'Stop' }, context), null);
  });
});
