// npm run metrics -- <step> [--session <id>]...
//
// Measures the Claude Code session of a plan step and writes one row per session in
// docs/bitacora/metricas.csv:
// - from the local session logs (~/.claude/projects/<project>/<session>.jsonl and its
//   subagents): duration, model requests, tokens and the equivalent API cost;
// - from git: lines added and deleted and files changed since the commit before the step's
//   oldest commit (subject ending in "(step <step>)"), so it gives the same figures before and
//   after committing the step; uncommitted and new files count too;
// - the unit tests Vitest ran in the last `npm run check` (its JSON report, which counts each row
//   of it.each), or else the it() calls in the specs; and the e2e tests in the specs.
// Without --session it measures the session whose log was written last: the current one.
import { execFileSync } from 'node:child_process';
import { existsSync, globSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { upsertCsvRow } from './metrics/csv.mjs';
import { costUsd } from './metrics/pricing.mjs';
import { projectDirName } from './metrics/project-dir.mjs';
import {
  countLines,
  countTests,
  countVitestTests,
  parseNumstat,
  stepBase,
} from './metrics/repo-stats.mjs';
import { emptyUsage, summarizeTranscript } from './metrics/transcript.mjs';

const CSV_FILE = path.join('docs', 'bitacora', 'metricas.csv');
// Generated or logbook files that would distort the size of the step.
const EXCLUDED = ['docs/bitacora/eventos.jsonl', 'docs/bitacora/metricas.csv', 'package-lock.json'];
const UNIT_TESTS = ['src/**/*.spec.ts', 'scripts/**/*.test.mjs', '.claude/hooks/*.test.mjs'];
// Written by `ng test` (reporters in angular.json); `coverage/` is not in git.
const VITEST_REPORT = path.join('coverage', 'unit-tests.json');
// Git's empty tree: the base of a step that goes back to the first commit.
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const E2E_TESTS = ['e2e/**/*.spec.ts'];
const COLUMNS = [
  'step',
  'session',
  'start',
  'end',
  'duration_min',
  'requests',
  'input_tokens',
  'output_tokens',
  'cache_read_tokens',
  'cache_write_tokens',
  'cost_usd',
  'models',
  'lines_added',
  'lines_deleted',
  'files_changed',
  'unit_tests',
  'e2e_tests',
  'measured_at',
];

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { session: { type: 'string', multiple: true } },
  });
  const step = positionals[0];
  if (!step) {
    throw new Error('Uso: npm run metrics -- <paso> [--session <id>]');
  }

  const projectDir = process.cwd();
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const logsDir = path.join(claudeDir, 'projects', projectDirName(projectDir));
  const sessions = values.session ?? [latestSession(logsDir)];
  const repo = repoStats(step);

  let csv = existsSync(CSV_FILE) ? readFileSync(CSV_FILE, 'utf8') : '';
  for (const session of sessions) {
    const row = { step, session, ...sessionStats(logsDir, session), ...repo };
    row.measured_at = new Date().toISOString();
    csv = upsertCsvRow(csv, COLUMNS, row);
    printSummary(row);
  }
  writeFileSync(CSV_FILE, csv, 'utf8');
  console.log(`\nGuardado en ${CSV_FILE.split(path.sep).join('/')}`);
}

function latestSession(dir) {
  if (!existsSync(dir)) {
    throw new Error(`No hay registros de sesiones en ${dir}`);
  }
  const logs = readdirSync(dir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => ({ name, modified: statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.modified - a.modified);
  if (logs.length === 0) {
    throw new Error(`No hay registros de sesiones en ${dir}`);
  }
  return path.basename(logs[0].name, '.jsonl');
}

function sessionStats(dir, session) {
  const mainLog = path.join(dir, `${session}.jsonl`);
  if (!existsSync(mainLog)) {
    throw new Error(`No existe el registro de la sesión ${session} en ${dir}`);
  }
  // Subagents keep their own logs in a folder named after the session.
  const subagentLogs = globSync('**/*.jsonl', { cwd: path.join(dir, session) }).map((file) =>
    path.join(dir, session, file),
  );
  const lines = [mainLog, ...subagentLogs].flatMap((file) =>
    readFileSync(file, 'utf8').split('\n'),
  );
  const summary = summarizeTranscript(lines);

  const total = emptyUsage();
  let cost = 0;
  const unpriced = [];
  for (const [model, usage] of Object.entries(summary.byModel)) {
    for (const kind of Object.keys(total)) {
      total[kind] += usage[kind];
    }
    const modelCost = costUsd(model, usage);
    if (modelCost === null) {
      unpriced.push(model);
    } else {
      cost += modelCost;
    }
  }
  if (unpriced.length > 0) {
    console.warn(`Aviso: sin precio para ${unpriced.join(', ')}; no suman al coste.`);
  }

  return {
    start: summary.start,
    end: summary.end,
    duration_min: summary.durationMinutes,
    requests: summary.requests,
    input_tokens: total.input,
    output_tokens: total.output,
    cache_read_tokens: total.cacheRead,
    cache_write_tokens: total.cacheWrite5m + total.cacheWrite1h,
    cost_usd: cost.toFixed(2),
    models: Object.keys(summary.byModel).join(' '),
  };
}

function repoStats(step) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
  const base = stepBase(git('log', '--format=%H %s'), step) ?? EMPTY_TREE;
  const tracked = parseNumstat(git('diff', '--numstat', base), EXCLUDED);
  const untracked = git('ls-files', '--others', '--exclude-standard')
    .split('\n')
    .filter((file) => file && !EXCLUDED.includes(file));
  const untrackedLines = untracked
    .map((file) => readFileSync(file, 'utf8'))
    .filter((content) => !content.includes('\0'))
    .reduce((sum, content) => sum + countLines(content), 0);

  return {
    lines_added: tracked.added + untrackedLines,
    lines_deleted: tracked.deleted,
    files_changed: tracked.files.length + untracked.length,
    unit_tests: unitTestCount(),
    e2e_tests: testCount(E2E_TESTS),
  };
}

function unitTestCount() {
  const ran = existsSync(VITEST_REPORT)
    ? countVitestTests(readFileSync(VITEST_REPORT, 'utf8'))
    : null;
  if (ran !== null) {
    return ran;
  }
  console.warn('Aviso: sin informe de Vitest (npm run check); cuento los it() de los ficheros.');
  return testCount(UNIT_TESTS);
}

function testCount(patterns) {
  return globSync(patterns, { exclude: ['node_modules/**'] }).reduce(
    (sum, file) => sum + countTests(readFileSync(file, 'utf8')),
    0,
  );
}

function printSummary(row) {
  const hours = Math.floor(row.duration_min / 60);
  const minutes = row.duration_min % 60;
  const thousands = (n) => n.toLocaleString('es-ES');
  console.log(`Paso ${row.step} · sesión ${row.session}`);
  console.log(`  Duración: ${hours} h ${minutes} min (${row.requests} peticiones al modelo)`);
  console.log(
    `  Tokens: entrada ${thousands(row.input_tokens)} · salida ${thousands(row.output_tokens)} · ` +
      `caché leída ${thousands(row.cache_read_tokens)} · caché escrita ${thousands(row.cache_write_tokens)}`,
  );
  console.log(`  Coste equivalente en API: ${row.cost_usd} $ (${row.models})`);
  console.log(
    `  Repositorio: +${row.lines_added} / −${row.lines_deleted} líneas en ${row.files_changed} archivos · ` +
      `tests unitarios ${row.unit_tests} · e2e ${row.e2e_tests}`,
  );
}
