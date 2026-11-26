import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { manualHtml } from './html.mjs';

const step = (title, extra = {}) => ({
  title,
  text: `Texto de ${title}`,
  image: 'x.png',
  ...extra,
});
const task = (id, title, extra = {}) => ({
  id,
  title,
  summary: `Resumen de ${title}`,
  unavailable: false,
  ...extra,
});

const INDEX = {
  firstSteps: ['create-block'],
  tasks: [
    task('find-exercise', 'Buscar un ejercicio'),
    task('create-block', 'Crear un bloque'),
    task('tour-live', 'Conocer En vivo'),
  ],
  shared: [],
};

const RECORDS = {
  welcome: { steps: [step('¡Hola!')] },
  'create-block': {
    steps: [step('Bloques', { action: 'Pulsa «Bloques»', image: 'create-block-01.png' })],
  },
  'find-exercise': { steps: [step('El <buscador> & más')] },
  'tour-live': { steps: [step('Grupo y bloque')] },
};

const write = (overrides = {}) =>
  manualHtml({
    profile: 'teacher',
    index: INDEX,
    records: RECORDS,
    date: '26/11/2026',
    image: (name) => `file:///capturas/${name}`,
    assets: { logo: 'file:///favicon.svg', font: 'file:///roboto.woff2' },
    ...overrides,
  });

describe('manualHtml', () => {
  it('is a whole page in Spanish, with the title of the manual', () => {
    const html = write();

    assert.match(html, /^<!doctype html>\n<html lang="es">/);
    assert.match(html, /<title>Manual del profesorado · TutorIA<\/title>/);
    assert.match(html, /<h1>Manual del profesorado<\/h1>/);
  });

  it('opens with a cover with the mascot and its edition, not how it is made', () => {
    const html = write();
    const cover = html.slice(html.indexOf('<section class="cover">'), html.indexOf('</section>'));

    assert.match(cover, /<img src="file:\/\/\/favicon\.svg" alt=""/);
    assert.match(cover, /<p class="edition">Edición del 26\/11\/2026<\/p>/);
    assert.doesNotMatch(cover, /npm run manual/);
    assert.match(html, /url\("file:\/\/\/roboto\.woff2"\)/);
  });

  it('has an index that links to the welcome and to every task', () => {
    const html = write();

    assert.match(html, /<a href="#bienvenida">Bienvenida<\/a>/);
    assert.match(html, /<a href="#create-block">Crear un bloque<\/a>/);
    assert.match(html, /<article class="task" id="create-block">/);
  });

  it('starts each part on a page of its own, the first steps before the how-tos and the tours', () => {
    const html = write();
    const parts = [...html.matchAll(/<h2 class="part">([^<]+)<\/h2>/g)].map((match) => match[1]);

    assert.deepEqual(parts, ['Primeros pasos', '¿Cómo se hace…?', 'Recorridos de pantalla']);
    assert.match(html, /\.part \{[^}]*break-before: page/);
  });

  it('tells each step with its text, what to do and its screenshot, kept together', () => {
    const html = write();

    assert.match(html, /<h4>1\. Bloques<\/h4>/);
    assert.match(html, /<p class="action"><strong>Qué haces:<\/strong> Pulsa «Bloques»<\/p>/);
    assert.match(
      html,
      /<img src="file:\/\/\/capturas\/create-block-01\.png" alt="Paso 1: Bloques"/,
    );
    assert.match(html, /\.step \{[^}]*break-inside: avoid/);
  });

  it('escapes what the globes say', () => {
    const html = write();

    assert.match(html, /El &lt;buscador&gt; &amp; más/);
    assert.doesNotMatch(html, /<buscador>/);
  });

  it('names the manual of the shared tasks without links, which a PDF could not follow', () => {
    const index = { ...INDEX, shared: [task('copy-blocks', 'Copiar los bloques de otro grupo')] };
    const html = write({ profile: 'admin', index });

    assert.match(html, /<h2 class="part" id="tareas-compartidas">Las tareas del docente<\/h2>/);
    assert.match(html, /<li>Copiar los bloques de otro grupo<\/li>/);
    assert.doesNotMatch(html, /docente\.md/);
  });

  it('fails if a task that was possible has no steps', () => {
    const records = { ...RECORDS, 'find-exercise': undefined };

    assert.throws(() => write({ records }), /find-exercise/);
  });
});
