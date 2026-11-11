// npm run elusion [-- --models a,b] [--base-url URL [--key-secret AI_X_API_KEY]] [--response-format json_object]
//                  [--timeout 60] [--runs 3 | --quick] [--only 1,8b,C2] [--report]
//
// The elusion battery of the tutor (step 2.5, docs/PLAN.md §2.9, D-044): sends every case of
// scripts/elusion/cases.mjs to the local Edge Function `tutor`, as the app would, and writes
// docs/elusion-report.md with a verdict for each one.
//
// - It needs the local Supabase running (`npm run db:start`) with the key of the AI provider in
//   supabase/functions/.env, as the real tutor does.
// - It signs in as a student of the seed and, with the local `service_role` (from `supabase status`,
//   never in the app), assigns their group an exercise of its own (`BATTERY_EXERCISE`, a frozen copy
//   of exercise 3) and gives them a fresh attempt at it before each run, so every case starts with an
//   empty conversation. It removes the exercise at the end, so the seed is left as it was and changes
//   to the exercises of the seed never touch the battery (D-045).
// - --models: the models to compare, of the provider in `app_setting.ai_provider` (by default, the
//   one there), with no fallback, so each answer is of the model under test; the setting is restored
//   at the end. --runs: how many times each case is sent (3; --quick, 1, as a regression check
//   after changing the prompt, which prints the verdicts and saves nothing). --only: some cases. --report: only rebuild the report.
// - Another provider, or a local model (Ollama, LM Studio…): --base-url (from Docker, with
//   host.docker.internal), --key-secret with the name of its secret (none by default: the key of
//   the main provider never goes to another one, D-044), --response-format if it does not take the
//   JSON schema and --timeout, in seconds, if it needs more than the 15 s of the tutor.
// - The results of each model and version of the prompt are kept in docs/elusion/*.json; the
//   report is built from all of them, plus the conclusions written by hand in
//   docs/elusion/conclusiones.md.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

import { createClient } from '@supabase/supabase-js';

import { BATTERY_ASSIGNMENT_ID, BATTERY_BLOCK, BATTERY_EXERCISE, CASES } from './elusion/cases.mjs';
import { buildReport, resultFileName } from './elusion/report.mjs';
import { runVerdict } from './elusion/verdict.mjs';
import { importAppTs } from './import-app-ts.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const RESULTS_DIR = path.join(ROOT, 'docs', 'elusion');
const REPORT_FILE = path.join(ROOT, 'docs', 'elusion-report.md');
const CONCLUSIONS_FILE = path.join(RESULTS_DIR, 'conclusiones.md');

/** A student of the seed, enrolled in a group. */
const STUDENT_EMAIL = 'daniel.mendoza@tutoria.test';
const AI_PROVIDER_KEY = 'ai_provider';
const DEFAULT_RUNS = 3;
/**
 * Pause between two calls to the tutor: the free tier of Gemini allows about ten requests a minute
 * per model, and a request may need two calls to the model.
 */
const PACE_MS = 8_000;
/** Waits for a provider that is down for a moment (503) before trying the request once more. */
const UNAVAILABLE_WAIT_MS = 20_000;
const MAX_TRIES = 3;

const { values } = parseArgs({
  options: {
    models: { type: 'string' },
    runs: { type: 'string', default: String(DEFAULT_RUNS) },
    quick: { type: 'boolean', default: false },
    only: { type: 'string' },
    report: { type: 'boolean', default: false },
    'base-url': { type: 'string' },
    'key-secret': { type: 'string' },
    'response-format': { type: 'string' },
    timeout: { type: 'string' },
  },
});

if (!values.report) await withLock(runBattery);
writeReport();

/**
 * One battery at a time: two would clear each other's attempt (the same student) and double the
 * calls to the provider. The lock keeps the id of the process; one left by a process that ended is
 * taken over.
 */
async function withLock(task) {
  const lock = path.join(os.tmpdir(), 'tutoria-elusion.lock');
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, 'utf8'));
    if (isRunning(pid)) throw new Error(`Another battery is running (process ${pid})`);
  }
  writeFileSync(lock, String(process.pid));
  try {
    await task();
  } finally {
    rmSync(lock, { force: true });
  }
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function runBattery() {
  const runs = values.quick ? 1 : Number(values.runs);
  const only = values.only?.split(',').map((id) => id.trim());
  const cases = only ? CASES.filter((each) => only.includes(each.id)) : CASES;
  if (cases.length === 0) throw new Error(`No case is called ${values.only}`);

  const local = localSupabase();
  const admin = createClient(local.url, local.secretKey, { auth: { persistSession: false } });
  const student = createClient(local.url, local.publishableKey, {
    auth: { persistSession: false },
  });
  // The test password of every account of the seed, which only exists in local Supabase
  const { MOCK_PASSWORD } = await importAppTs(
    path.join(ROOT, 'src', 'app', 'data', 'mock', 'fixtures', 'users.ts'),
  );
  const session = await student.auth.signInWithPassword({
    email: STUDENT_EMAIL,
    password: MOCK_PASSWORD,
  });
  if (session.error) throw new Error(`Signing in failed: ${session.error.message}`);
  const userId = session.data.user.id;
  const exercise = await createExercise(admin, userId);
  const original = await providerSetting(admin);
  const models = values.models?.split(',').map((model) => model.trim()) ?? [original.model];

  const battery = {
    url: local.url,
    publishableKey: local.publishableKey,
    userId,
    admin,
    student,
    exercise,
  };
  try {
    for (const model of models) {
      await setProvider(admin, testedModel(original, model));
      console.log(`\n${model}: ${cases.length} casos × ${runs} pasadas`);
      const results = {};
      for (const each of cases) {
        results[each.id] = [];
        for (let run = 1; run <= runs; run++) {
          const answers = await runCase(battery, each);
          const verdict = runVerdict(each.kind, answers, exercise.hiddenTests, each.check);
          results[each.id].push({ verdict, answers });
          console.log(`  ${each.id} · pasada ${run}: ${verdict}`);
          // Nothing is saved with --quick: the answers are read here
          if (values.quick) console.log(quickAnswers(answers));
        }
      }
      // A quick check after changing the prompt is not data: it never replaces the full runs kept
      if (values.quick) {
        console.log('  --quick: comprobación, no se guarda');
      } else {
        saveResults(model, results);
      }
    }
  } finally {
    await setProvider(admin, original);
    await removeExercise(admin, exercise);
  }
}

/**
 * The setting of the tutor for the model under test: of the provider in the setting, or of another
 * one given by the options. Never with fallbacks, which would hide its failures.
 */
function testedModel(original, model) {
  const baseUrl = values['base-url'] ?? original.baseUrl;
  // Another provider never gets the key of the main one (D-044)
  const base =
    baseUrl === original.baseUrl ? { ...original, model } : { baseUrl, model, keySecret: null };
  delete base.fallbacks;
  return {
    ...base,
    ...(values['key-secret'] ? { keySecret: values['key-secret'] } : {}),
    ...(values['response-format'] ? { responseFormat: values['response-format'] } : {}),
    ...(values.timeout ? { timeoutMs: Number(values.timeout) * 1000 } : {}),
  };
}

/** The addresses and keys of the local Supabase, which are the same in every installation. */
function localSupabase() {
  // A fixed command in a shell, because the binary of node_modules/.bin is a .cmd on Windows
  const status = spawnSync('supabase status -o json', { cwd: ROOT, encoding: 'utf8', shell: true });
  const json = status.stdout?.slice(status.stdout.indexOf('{'));
  if (status.status !== 0 || !json) {
    throw new Error('The local Supabase is not running: npm run db:start');
  }
  const { API_URL, PUBLISHABLE_KEY, ANON_KEY, SECRET_KEY, SERVICE_ROLE_KEY } = JSON.parse(json);
  return {
    url: API_URL,
    publishableKey: PUBLISHABLE_KEY ?? ANON_KEY,
    secretKey: SECRET_KEY ?? SERVICE_ROLE_KEY,
  };
}

/**
 * Creates the exercise of the battery, with its tests, and assigns it to the student's group in a
 * block of its own: open_attempt only opens assigned exercises, as the app does.
 */
async function createExercise(admin, userId) {
  const enrollment = await admin
    .from('enrollment')
    .select('group_id, class_group(teacher_id)')
    .eq('user_id', userId)
    .limit(1)
    .single();
  if (enrollment.error) throw new Error(`Reading the group failed: ${enrollment.error.message}`);
  const groupId = enrollment.data.group_id;
  const { id, title, statement, difficulty, topics, functionName, tests } = BATTERY_EXERCISE;
  const steps = [
    () =>
      admin.from('exercise').upsert({
        id,
        title,
        statement,
        difficulty,
        topics,
        function_name: functionName,
        created_by: enrollment.data.class_group.teacher_id,
      }),
    () => admin.from('test').delete().eq('exercise_id', id),
    () =>
      admin.from('test').insert(
        tests.map(([input, expectedOutput, isHidden], position) => ({
          exercise_id: id,
          input,
          expected_output: expectedOutput,
          is_hidden: isHidden,
          position,
        })),
      ),
    () =>
      admin
        .from('class_block')
        .upsert({ group_id: groupId, ...BATTERY_BLOCK }, { onConflict: 'id' }),
    () =>
      admin.from('exercise_assignment').upsert(
        {
          id: BATTERY_ASSIGNMENT_ID,
          group_id: groupId,
          block_id: BATTERY_BLOCK.id,
          exercise_id: id,
        },
        { onConflict: 'id' },
      ),
  ];
  for (const step of steps) {
    const { error } = await step();
    if (error) throw new Error(`Creating the exercise of the battery failed: ${error.message}`);
  }
  return {
    id,
    groupId,
    hiddenTests: tests
      .filter(([, , isHidden]) => isHidden)
      .map(([input, expectedOutput]) => ({ input, expectedOutput })),
  };
}

/** Removes the exercise of the battery with its attempts, tests, assignment and block. */
async function removeExercise(admin, exercise) {
  const steps = [
    // An exercise with attempts cannot be deleted (`on delete restrict`); their turns go with them
    () => admin.from('attempt').delete().eq('exercise_id', exercise.id),
    () => admin.from('exercise').delete().eq('id', exercise.id),
    () => admin.from('class_block').delete().eq('id', BATTERY_BLOCK.id),
  ];
  for (const step of steps) {
    const { error } = await step();
    if (error) throw new Error(`Removing the exercise of the battery failed: ${error.message}`);
  }
}

async function providerSetting(admin) {
  const { data, error } = await admin
    .from('app_setting')
    .select('value')
    .eq('key', AI_PROVIDER_KEY)
    .single();
  if (error) throw new Error(`Reading the AI provider failed: ${error.message}`);
  return data.value;
}

async function setProvider(admin, value) {
  const { error } = await admin.from('app_setting').update({ value }).eq('key', AI_PROVIDER_KEY);
  if (error) throw new Error(`Changing the AI provider failed: ${error.message}`);
}

/** A new attempt at the exercise: no conversation, no runs, in progress. */
async function freshAttempt({ admin, student, userId, exercise }) {
  const removed = await admin
    .from('attempt')
    .delete()
    .eq('user_id', userId)
    .eq('exercise_id', exercise.id);
  if (removed.error) throw new Error(`Clearing the attempt failed: ${removed.error.message}`);
  const opened = await student.rpc('open_attempt', { target_assignment_id: BATTERY_ASSIGNMENT_ID });
  if (opened.error) throw new Error(`Opening the attempt failed: ${opened.error.message}`);
  return opened.data.id;
}

/** Sends the turns of a case on a fresh attempt; `null` for an answer that never came. */
/** The answers of a run, indented under its verdict, with their emotion, intensity and reaction. */
function quickAnswers(answers) {
  return answers
    .map((answer, index) =>
      answer
        ? `    ${index + 1}. [${answer.emotion}/${answer.intensity} ${answer.reaction ?? '-'}] ${answer.message.replaceAll('\n', '\n       ')}`
        : `    ${index + 1}. (sin respuesta)`,
    )
    .join('\n');
}

async function runCase(battery, each) {
  const attemptId = await freshAttempt(battery);
  const answers = [];
  for (const turn of each.turns) {
    const answer = await ask(battery, {
      requestId: randomUUID(),
      attemptId,
      kind: turn.hint ? 'hint' : 'question',
      ...(turn.hint ? {} : { message: turn.message }),
      code: each.code,
      language: turn.language ?? 'es',
    });
    answers.push(answer);
    await sleep(PACE_MS);
    if (!answer) break;
  }
  return answers;
}

/** One request to the tutor, waiting when it asks to; what it recorded, read back. */
async function ask(battery, request) {
  for (let tries = 1; tries <= MAX_TRIES; tries++) {
    const started = performance.now();
    const response = await fetch(`${battery.url}/functions/v1/tutor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: battery.publishableKey,
        Authorization: `Bearer ${await accessToken(battery.student)}`,
      },
      body: JSON.stringify(request),
    });
    const latencyMs = Math.round(performance.now() - started);
    if (response.ok) {
      const { events } = await response.json();
      return recordedAnswer(battery, events, latencyMs);
    }
    const reason = await response.text();
    console.warn(`    ${response.status}: ${reason.slice(0, 200)}`);
    if (response.status === 429) {
      await sleep((Number(response.headers.get('Retry-After')) || 10) * 1000);
    } else if (response.status === 503) {
      await sleep(UNAVAILABLE_WAIT_MS);
    } else {
      return null;
    }
  }
  return null;
}

/** The token of the session, renewed when it is about to expire: a battery lasts longer than it. */
async function accessToken(student) {
  const { data, error } = await student.auth.getSession();
  if (error || !data.session) throw new Error(`The session was lost: ${error?.message}`);
  return data.session.access_token;
}

async function recordedAnswer({ admin }, events, latencyMs) {
  const meta = events.find((event) => event.type === 'meta');
  const done = events.find((event) => event.type === 'done');
  const message = events
    .filter((event) => event.type === 'delta')
    .map((event) => event.text)
    .join('');
  if (!meta || !done?.interactionId) return null;
  const { data, error } = await admin
    .from('tutor_interaction')
    .select('elusion, rejected_answers, model, prompt_version')
    .eq('id', done.interactionId)
    .single();
  if (error) throw new Error(`Reading the answer failed: ${error.message}`);
  return {
    message,
    elusion: data.elusion,
    rejected: data.rejected_answers,
    emotion: meta.emotion,
    intensity: meta.intensity,
    hintLevel: meta.hintLevel,
    ...(meta.reaction ? { reaction: meta.reaction } : {}),
    model: data.model,
    promptVersion: data.prompt_version,
    latencyMs,
  };
}

/**
 * Keeps the results of a model by version of the prompt, the one the answers say. The cases run
 * now replace those of an earlier run of the same model and version; the rest stay.
 */
function saveResults(model, results) {
  const answers = Object.values(results).flatMap((runs) => runs.flatMap((run) => run.answers));
  const promptVersion = answers.find(Boolean)?.promptVersion;
  if (!promptVersion) {
    console.warn(`  ${model}: ninguna respuesta, no se guarda nada`);
    return;
  }
  mkdirSync(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, resultFileName(promptVersion, model));
  const earlier = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { cases: {} };
  const saved = {
    model,
    promptVersion,
    date: new Date().toISOString().slice(0, 10),
    cases: { ...earlier.cases, ...results },
  };
  writeFileSync(file, `${JSON.stringify(saved, null, 2)}\n`);
  prettier(file);
}

function writeReport() {
  const results = existsSync(RESULTS_DIR)
    ? readdirSync(RESULTS_DIR)
        .filter((name) => name.endsWith('.json'))
        .map((name) => JSON.parse(readFileSync(path.join(RESULTS_DIR, name), 'utf8')))
        .toSorted((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model))
    : [];
  const conclusions = existsSync(CONCLUSIONS_FILE) ? readFileSync(CONCLUSIONS_FILE, 'utf8') : '';
  writeFileSync(REPORT_FILE, buildReport(results, CASES, conclusions));
  prettier(REPORT_FILE);
  console.log(`Informe: ${path.relative(ROOT, REPORT_FILE)}`);
}

/** The project's Prettier, run with this same Node, so the files pass `npm run check`. */
function prettier(file) {
  const bin = createRequire(import.meta.url).resolve('prettier/bin/prettier.cjs');
  spawnSync(process.execPath, [bin, '--write', '--log-level', 'warn', file], { cwd: ROOT });
}
