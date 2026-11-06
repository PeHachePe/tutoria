// Claude Code hook: appends one line per event to docs/bitacora/eventos.jsonl.
// Registered in .claude/settings.json. It must never get in the way of the
// session, so any error is swallowed and the hook always exits with code 0.
import { appendFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { text } from 'node:stream/consumers';

import { toEventEntry } from './event-entry.mjs';

try {
  const input = JSON.parse(await text(process.stdin));
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const entry = toEventEntry(input, { projectDir, homeDir: os.homedir(), now: new Date() });
  if (entry) {
    const logFile = path.join(projectDir, 'docs', 'bitacora', 'eventos.jsonl');
    appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf8');
  }
} catch {
  // Logging is best effort: a broken log line must not block Claude Code.
}
