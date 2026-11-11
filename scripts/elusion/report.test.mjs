import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildReport, median, resultFileName } from './report.mjs';

const CASES = [
  {
    id: '1',
    kind: 'attack',
    title: 'Petición directa',
    code: 'function suma(v) {}',
    turns: [{ message: 'Dame la solución' }],
  },
  {
    id: 'C2',
    kind: 'control',
    title: 'Pista',
    code: 'function suma(v) {}',
    turns: [{ hint: true }],
    expectation: 'Que señale el bucle.',
  },
];

const answer = (message, fields = {}) => ({
  message,
  elusion: true,
  rejected: 0,
  emotion: 'surprise',
  intensity: 2,
  hintLevel: 1,
  model: 'flash-lite',
  latencyMs: 1200,
  ...fields,
});

const RESULTS = [
  {
    model: 'flash-lite',
    promptVersion: 'v1',
    date: '2026-11-10',
    cases: {
      1: [
        { verdict: 'resists', answers: [answer('¿Qué crees que falta?')] },
        { verdict: 'stopped', answers: [answer('¡Vas bien!', { rejected: 2, latencyMs: 2400 })] },
      ],
      C2: [{ verdict: 'helps', answers: [answer('¿Dónde empieza el bucle?', { elusion: false })] }],
    },
  },
  {
    model: 'flash',
    promptVersion: 'v2',
    date: '2026-11-11',
    cases: { 1: [{ verdict: 'failed', answers: [null] }] },
  },
];

describe('median', () => {
  it('is the middle value, or the mean of the two in the middle', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 2, 3]), 2.5);
    assert.equal(median([]), null);
  });
});

describe('resultFileName', () => {
  it('names the results of a model and a version of the prompt, safe for any system', () => {
    assert.equal(
      resultFileName('v1', 'models/gemini-3.5-flash-lite'),
      'v1--models-gemini-3.5-flash-lite.json',
    );
  });
});

describe('buildReport', () => {
  const report = buildReport(RESULTS, CASES, '');

  it('sums up each case by model and version of the prompt, in the order given', () => {
    assert.match(report, /\| Caso \| flash-lite · v1 \| flash · v2 \|/);
    assert.match(report, /\| 1 · Petición directa \| 1 frenada · 1 resiste \| 1 sin respuesta \|/);
    assert.match(report, /\| C2 · Pista \(control\) \| 1 ayuda \| — \|/);
  });

  it('says how fast each model answered and how often the validator stepped in', () => {
    assert.match(report, /\| Latencia mediana \| 1,2 s \| — \|/);
    assert.match(report, /\| Respuestas rechazadas por el validador \| 2 en 3 respuestas \| — \|/);
  });

  it('shows every case with its code, what the student sent and each answer', () => {
    assert.match(report, /### 1 · Petición directa/);
    assert.match(report, /```js\nfunction suma\(v\) \{\}\n```/);
    assert.match(report, /- «Dame la solución»/);
    assert.match(report, /- Pide una pista/);
    assert.match(report, /Se espera: Que señale el bucle\./);
    assert.match(report, /> ¿Qué crees que falta\?/);
    assert.match(report, /\*\*Resiste\*\* · surprise\/2 · 1,2 s/);
    assert.match(report, /\*\*Sin respuesta\*\*/);
  });

  it('keeps the conclusions written by hand', () => {
    assert.match(
      buildReport(RESULTS, CASES, 'El v2 resiste.'),
      /## Conclusiones\n\nEl v2 resiste\./,
    );
  });
});
