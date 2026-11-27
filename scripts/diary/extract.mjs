// Reads docs/ (and the dates of the git commits) into the one object the diary renders.
// Nothing comes from outside the repository: no event log, no environment of the author.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { AFTER_PEC3, MANUAL_PROFILES, PHASES, SCREEN_NAMES } from './content.mjs';
import { bullets, inline, markdown, sections } from './markdown.mjs';

/** Steps outside the plan (audits, environment, cleanups) are grouped as one more phase. */
export const OUTSIDE_PLAN = PHASES.length - 1;
const SUMMARY_LENGTH = 220;
const WHY_LENGTH = 300;

/** «1.234,5» → 1234.5 */
export const parseNumber = (text) => Number(String(text).replace(/\./g, '').replace(',', '.'));

/** The last «dd/mm/yyyy» in a text (a range like «24-25/11/2026» gives its end), as an ISO date. */
export function parseSpanishDate(text) {
  const match = String(text).match(/(\d{2})\/(\d{2})\/(\d{4})(?!.*\d{2}\/\d{2}\/\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/** Hours in a register cell: «≈ 1 h 30 min», «2,5 h», «45 min»; with «… de trabajo», only that part counts. */
export function parseHours(text) {
  const work = text.includes('de trabajo')
    ? text.split(/[;,]/).find((part) => part.includes('de trabajo'))
    : text;
  const hours = work.match(/(\d+(?:,\d+)?)\s*h(?:\s*(\d+)\s*min)?/);
  if (hours) return parseNumber(hours[1]) + (hours[2] ? Number(hours[2]) / 60 : 0);
  const minutes = work.match(/(\d+)\s*min/);
  return minutes ? Number(minutes[1]) / 60 : 0;
}

/** The phase of a register id: «4.1e» → 4, «5 (plan)» → 5, «auditoría (BD)» → outside the plan. */
export const phaseOf = (id) => (/^\d/.test(id) ? Number(id[0]) : OUTSIDE_PLAN);

const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0);
const round = (value, digits = 1) => Number(value.toFixed(digits));

function readPlan(read) {
  const plan = read('PLAN.md');
  const phases = [...plan.matchAll(/^#### Fase (\d) · (.+?) \((?:[^≈]*?)≈([\d,]+) h/gm)].map(
    (m) => ({ index: Number(m[1]), name: m[2], estimate: parseNumber(m[3]) }),
  );
  const steps = {};
  for (const m of plan.matchAll(/^\*\*(\d+\.\d+[a-z0-9]*) · (.+?)\*\*/gm)) {
    const estimate = m[2].match(/≈\s*([\d,]+)\s*h/);
    steps[m[1]] = {
      title: m[2].replace(/\s*\(.*\)\s*$/, ''),
      estimate: estimate ? parseNumber(estimate[1]) : null,
    };
  }
  return { phases, steps };
}

function readMetrics(read) {
  const [header, ...lines] = read('bitacora', 'metricas.csv').trim().split('\n');
  const columns = header.split(',');
  const rows = lines.map((line) =>
    Object.fromEntries(line.split(',').map((value, i) => [columns[i], value])),
  );
  const byStep = {};
  for (const row of rows) {
    const step = (byStep[row.step] ??= { usd: 0, lines: 0, unit: 0, e2e: 0 });
    step.usd += Number(row.cost_usd);
    step.lines += Number(row.lines_added);
    step.unit = Math.max(step.unit, Number(row.unit_tests));
    step.e2e = Math.max(step.e2e, Number(row.e2e_tests));
  }
  const tokens = {
    sessions: rows.length,
    requests: sum(rows, (r) => Number(r.requests)),
    output: sum(rows, (r) => Number(r.output_tokens)),
    cacheRead: sum(rows, (r) => Number(r.cache_read_tokens)),
  };
  return { byStep, tokens };
}

function readLogbooks(docs, read) {
  const logs = {};
  for (const file of readdirSync(join(docs, 'bitacora')).filter(
    (f) => f.endsWith('.md') && !f.startsWith('_'),
  )) {
    const text = read('bitacora', file);
    const parts = sections(text);
    const header = text.split('\n').slice(1, 4).join(' ');
    logs[file] = {
      title: (text.match(/^# (?:Paso [^·]+·\s*)?(.+)$/m) || [])[1],
      objective: markdown(parts['Objetivo']),
      problems: bullets(parts['Problemas y cómo se resolvieron']),
      validation: bullets(parts['Validación humana']),
      quotes: bullets(parts['Para la presentación']),
      commits: (header.match(/`[0-9a-f]{7,}`/g) || []).length,
      decisions: text.match(/D-\d{3}/g) || [],
    };
  }
  return logs;
}

function readSteps(read, logs, plan, metrics) {
  const lines = read('REGISTRO.md').split('\n');
  const start = lines.findIndex((line) => line.startsWith('| Fecha'));
  const steps = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const [date, rawId, human, claude, , cost, , what, how, , log] = lines[i]
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const file = (log.match(/\(bitacora\/([^)]+)\)/) || [])[1];
    const logbook = (file && logs[file]) || {};
    const id =
      rawId === '—'
        ? file
          ? file.replace(/\.md$/, '')
          : (what.match(/como `([^`]+)`/) || [null, 'extra'])[1]
        : rawId;
    const planId = id.replace(/\s*\(.*\)$/, '');
    const measured = metrics.byStep[planId] || metrics.byStep[id] || {};
    steps.push({
      id,
      phase: phaseOf(id),
      date: parseSpanishDate(date),
      title: logbook.title || plan.steps[planId]?.title || what.split(/[(:,]/)[0].trim(),
      objective: logbook.objective || '',
      what: markdown(what),
      how: markdown(how),
      problems: logbook.problems || [],
      validation: logbook.validation || [],
      quotes: logbook.quotes || [],
      hHuman: round(parseHours(human), 2),
      hClaude: round(parseHours(claude), 2),
      est: plan.steps[planId]?.estimate ?? null,
      usd: round(measured.usd || parseNumber((cost.match(/[\d.,]+/) || ['0'])[0]) || 0, 2),
      lines: measured.lines || 0,
      unit: measured.unit || 0,
      e2e: measured.e2e || 0,
      commits: logbook.commits || 0,
      decisions: [
        ...new Set([...(what.match(/D-\d{3}/g) || []), ...(logbook.decisions || [])]),
      ].sort(),
    });
  }
  steps.sort((a, b) => a.date.localeCompare(b.date));
  steps.forEach((step, n) => (step.n = n));
  return steps;
}

function readDecisions(read, steps) {
  const decisions = [];
  for (const part of read('DECISIONES.md')
    .split(/^(?=## D-\d{3} )/m)
    .slice(1)) {
    const heading = part.split('\n')[0];
    const match = heading.match(/^## (D-\d{3}) · (.+?)(?: \(([^)]*)\))?\s*$/);
    if (!match) continue;
    const body = part.slice(heading.length);
    const block = (label) =>
      (body.match(
        new RegExp(`\\*\\*${label}:\\*\\*([\\s\\S]*?)(?=\\n\\*\\*[A-ZÁÉÍÓÚ][^*]{2,30}:\\*\\*|$)`),
      ) || [])[1]?.trim() ?? '';
    const context = block('Contexto');
    const decision = block('Decisión');
    const firstLine = (
      decision.replace(/^\s*-\s*/, '').split('\n')[0] ||
      context.split('\n')[0] ||
      ''
    ).replace(/\*\*/g, '');
    decisions.push({
      id: match[1],
      title: match[2],
      date: parseSpanishDate(match[3] || ''),
      status: /propuesta/.test(match[3] || '') ? 'propuesta' : 'aprobada',
      context: markdown(context),
      summary: inline(firstLine.slice(0, SUMMARY_LENGTH)),
      decision: markdown(decision || body.split('\n**Alternativas')[0]),
      alternatives: bullets(block('Alternativas')),
      consequences: markdown(block('Consecuencias')),
      citedBy: [],
    });
  }
  const byId = Object.fromEntries(decisions.map((d) => [d.id, d]));
  for (const step of steps) {
    step.decisions = step.decisions.filter((id) => byId[id]);
    for (const id of step.decisions) byId[id].citedBy.push(step.id);
  }
  for (const d of decisions) d.phase = steps.find((s) => s.id === d.citedBy[0])?.phase ?? null;
  return decisions;
}

function readScreens(docs, read, steps) {
  const folder = join(docs, 'capturas', 'evolucion');
  const names = { ...SCREEN_NAMES };
  for (const file of readdirSync(join(docs, 'screens')).filter((f) => /^\d/.test(f))) {
    names[file.replace(/\.md$/, '')] ??= (read('screens', file).match(/^# [^·]+·\s*(.+)$/m) ||
      [])[1];
  }
  const order = Object.fromEntries(steps.map((s) => [s.id, s.n]));
  const LAST = steps.length;
  return readdirSync(folder).map((key) => ({
    key,
    name: names[key] || key,
    versions: readdirSync(join(folder, key))
      .filter((step) => statSync(join(folder, key, step)).isDirectory())
      .sort((a, b) => (order[a] ?? LAST) - (order[b] ?? LAST))
      .map((step) => ({
        step,
        desktop: join(folder, key, step, 'escritorio.png'),
        phone: join(folder, key, step, 'movil.png'),
      })),
  }));
}

/** The elusion battery: the column with most answers (the reference model and prompt). */
function readElusion(read) {
  const summary = read('elusion-report.md').split('## Resumen')[1].split('\n');
  const rows = summary.filter((line) => /^\| (\d|C\d)/.test(line));
  const columns = summary
    .find((line) => line.startsWith('| Caso'))
    .split('|')
    .slice(2, -1)
    .map((x) => x.trim());
  const tallies = columns.map(() => ({}));
  for (const row of rows) {
    const kind = /^\| C/.test(row) ? 'control' : 'ataque';
    row
      .split('|')
      .slice(2, -1)
      .forEach((cell, i) => {
        for (const m of cell.trim().matchAll(/(\d+) ([a-zá ]+?)(?= ·|$)/g)) {
          const key = `${kind}:${m[2].trim()}`;
          tallies[i][key] = (tallies[i][key] || 0) + Number(m[1]);
        }
      });
  }
  const total = (tally) => sum(Object.values(tally), (v) => v);
  const best = tallies.reduce(
    (bestIndex, tally, i) => (total(tally) > total(tallies[bestIndex]) ? i : bestIndex),
    0,
  );
  return {
    column: columns[best],
    attackCases: rows.filter((r) => /^\| \d/.test(r)).length,
    tally: tallies[best],
    cases: rows.map((r) => r.split('|')[1].trim()),
  };
}

function readPrompts(read) {
  return read('prompt-history.md')
    .split(/^## (?=v\d+ · )/m)
    .slice(1)
    .map((part) => {
      const heading = part.split('\n')[0];
      const m = heading.match(/^(v\d+) · (.+?) \((.+?)\)\s*$/) || [];
      const why = (
        part
          .split('\n')
          .slice(1)
          .map((l) => l.trim())
          .find((l) => l && !l.startsWith('-') && !l.startsWith('|')) || ''
      ).replace(/\s*Cambios respecto a la v\d+:?\s*$/, '');
      return {
        v: m[1],
        title: m[2],
        step: ((m[3] || '').match(/paso ([\d.]+[a-z]?)/) || [])[1] || null,
        decision: ((m[3] || '').match(/D-\d{3}/) || [])[0] || null,
        why: inline(
          why.length > WHY_LENGTH ? `${why.slice(0, WHY_LENGTH).replace(/\s\S*$/, '')}…` : why,
        ),
      };
    });
}

function readCommitsPerDay(root) {
  const perDay = {};
  try {
    for (const day of execSync('git log --date=short --format=%ad', { cwd: root, encoding: 'utf8' })
      .trim()
      .split('\n'))
      perDay[day] = (perDay[day] || 0) + 1;
  } catch {
    // Without git (an exported copy), the calendar of commits is simply empty.
  }
  return perDay;
}

export function extract(root) {
  const docs = join(root, 'docs');
  const read = (...parts) => readFileSync(join(docs, ...parts), 'utf8');

  const plan = readPlan(read);
  const metrics = readMetrics(read);
  const steps = readSteps(read, readLogbooks(docs, read), plan, metrics);
  const decisions = readDecisions(read, steps);
  const screens = readScreens(docs, read, steps);
  const commitsPerDay = readCommitsPerDay(root);

  const pendingRows = read('PENDIENTES.md')
    .split('\n')
    .filter((l) => /^\| [\d.a-z]/.test(l) && !l.startsWith('| Desde'));
  const manual = MANUAL_PROFILES.map((profile) => ({
    profile,
    sections: (read('manual', `${profile}.md`).match(/^### /gm) || []).length,
  }));
  const profiles = [
    ...read('manual', 'README.md').matchAll(/^- \*\*([^*]+)\*\* \(.*?\.pdf\)\): (.+)$/gm),
  ].map((m) => ({ name: m[1], text: inline(m[2]) }));

  const phases = PHASES.map((phase, i) => {
    const own = steps.filter((s) => s.phase === i);
    const planned = plan.phases.find((p) => p.index === i);
    const dates = own.map((s) => s.date).sort();
    return {
      i,
      ...phase,
      name: planned?.name || phase.short,
      est: planned?.estimate ?? null,
      from: dates[0] || null,
      to: dates.at(-1) || null,
      human: round(sum(own, (s) => s.hHuman)),
      claude: round(sum(own, (s) => s.hClaude)),
    };
  });

  const days = [...new Set(steps.map((s) => s.date))].sort();
  return {
    totals: {
      steps: steps.length,
      planSteps: steps.filter((s) => s.phase !== OUTSIDE_PLAN).length,
      days: days.length,
      from: days[0],
      to: days.at(-1),
      human: round(sum(steps, (s) => s.hHuman)),
      claude: round(sum(steps, (s) => s.hClaude)),
      usd: round(
        sum(steps, (s) => s.usd),
        0,
      ),
      lines: sum(steps, (s) => s.lines),
      unit: Math.max(...steps.map((s) => s.unit)),
      e2e: Math.max(...steps.map((s) => s.e2e)),
      decisions: decisions.length,
      commits: sum(Object.values(commitsPerDay), (v) => v),
      problems: sum(steps, (s) => s.problems.length),
      iterations: sum(steps, (s) => s.validation.filter((v) => /iteración/i.test(v)).length),
      manualShots: sum(
        MANUAL_PROFILES,
        (p) => readdirSync(join(docs, 'manual', 'capturas', p)).length,
      ),
      tokens: metrics.tokens,
    },
    phases,
    steps,
    decisions,
    screens,
    elusion: readElusion(read),
    prompts: readPrompts(read),
    pending: { total: pendingRows.length },
    manual,
    profiles,
    next: AFTER_PEC3.map((id) => ({
      id,
      title: plan.steps[id]?.title || id,
      est: plan.steps[id]?.estimate ?? null,
    })),
    commitsPerDay,
  };
}
