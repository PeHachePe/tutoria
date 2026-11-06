import path from 'node:path';

const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
const FILE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);

/**
 * Turns the JSON that Claude Code sends to a hook into one line of the logbook,
 * or `null` when the event is not logged. Command output is never kept.
 *
 * @param {Record<string, any>} input hook input read from stdin
 * @param {{ projectDir: string, homeDir: string, now: Date }} context
 */
export function toEventEntry(input, { projectDir, homeDir, now }) {
  const common = { ts: now.toISOString(), session: input.session_id };
  if (input.agent_id) {
    common.agent = input.agent_id;
  }

  switch (input.hook_event_name) {
    case 'SessionStart':
      return {
        ...common,
        event: 'session_start',
        source: input.source,
        ...(input.model ? { model: input.model } : {}),
      };
    case 'SessionEnd':
      return { ...common, event: 'session_end', reason: input.reason };
    case 'UserPromptSubmit':
      // Only the time of each prompt: the text of the conversation never goes to the repository.
      return { ...common, event: 'prompt' };
    case 'PostToolUse':
    case 'PostToolUseFailure':
      return toolEntry(input, common, projectDir, homeDir);
    default:
      return null;
  }
}

function toolEntry(input, common, projectDir, homeDir) {
  const tool = input.tool_name;
  const ok = input.hook_event_name === 'PostToolUse';

  if (SHELL_TOOLS.has(tool)) {
    const command = hideUserFolders(input.tool_input?.command);
    const entry = { ...common, event: 'command', tool, command, ok };
    const exitCode = /^Exit code (\d+)/.exec(input.error ?? '')?.[1];
    return exitCode === undefined ? entry : { ...entry, exitCode: Number(exitCode) };
  }

  if (FILE_TOOLS.has(tool) && ok) {
    const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
    const action = input.tool_response?.type === 'create' ? 'create' : 'update';
    return {
      ...common,
      event: 'file',
      tool,
      path: displayPath(filePath, projectDir, homeDir),
      action,
    };
  }

  return null;
}

/**
 * Replaces any user folder in free text (`C:\Users\name`, `C:/Users/NAME~1.X`, `/c/Users/name`)
 * with `~`, so commands and prompts never reveal the account name of the machine.
 *
 * @param {string | undefined} text
 */
export function hideUserFolders(text) {
  return text?.replace(/(?:[A-Za-z]:|\/[A-Za-z])?[\\/]+Users[\\/]+[^\\/\s"'`]+/gi, '~');
}

/** Path relative to the project, or to the user folder (`~`) so the user name stays out. */
function displayPath(filePath, projectDir, homeDir) {
  const absolute = path.win32.normalize(filePath);
  for (const [root, prefix] of [
    [projectDir, ''],
    [homeDir, '~/'],
  ]) {
    const relative = path.win32.relative(path.win32.normalize(root), absolute);
    if (relative && !relative.startsWith('..') && !path.win32.isAbsolute(relative)) {
      return prefix + relative.split(path.win32.sep).join('/');
    }
  }
  return hideUserFolders(absolute.split(path.win32.sep).join('/'));
}
