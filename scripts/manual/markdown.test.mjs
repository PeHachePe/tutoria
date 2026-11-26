import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MANUALS, parseProfiles } from './content.mjs';
import { manualMarkdown } from './markdown.mjs';

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

/** A profile with a first step, a how-to, a tour of a screen and a task not possible. */
const INDEX = {
  firstSteps: ['create-block'],
  tasks: [
    task('find-exercise', 'Buscar un ejercicio'),
    task('create-block', 'Crear un bloque'),
    task('tour-live', 'Conocer En vivo'),
    task('talk', 'Hablar con el tutor', {
      summary: 'No disponible: Si tu navegador puede',
      unavailable: true,
    }),
  ],
  shared: [],
};

const RECORDS = {
  welcome: { steps: [step('¡Hola!'), step('La barra')] },
  'create-block': {
    steps: [
      step('Bloques', { action: 'Pulsa «Bloques»', image: 'create-block-01.png' }),
      step('Tus bloques', { image: 'create-block-02.png' }),
    ],
  },
  'find-exercise': { steps: [step('El buscador')] },
  'tour-live': { steps: [step('Grupo y bloque')] },
};

const write = (overrides = {}) =>
  manualMarkdown({
    profile: 'teacher',
    index: INDEX,
    records: RECORDS,
    date: '26/11/2026',
    image: (name) => `capturas/docente/${name.replace('.png', '.webp')}`,
    ...overrides,
  });

describe('manualMarkdown', () => {
  it('says what it is and its edition, and only out of sight how it is made', () => {
    const markdown = write();

    assert.match(
      markdown,
      /^<!-- Generado con npm run manual[^>]*-->\n\n# Manual del profesorado\n/,
    );
    assert.match(markdown, /_Edición del 26\/11\/2026\._/);
    assert.equal(markdown.match(/npm run manual/g).length, 1);
  });

  it('puts the welcome first, then the first steps in their order, the how-tos and the tours', () => {
    const markdown = write();
    const order = [
      '## <a id="bienvenida"></a>Bienvenida',
      '## Primeros pasos',
      '## ¿Cómo se hace…?',
      '## Recorridos',
    ];

    const positions = order.map((heading) => markdown.indexOf(heading));
    assert.ok(positions.every((position) => position > 0));
    assert.deepEqual(
      positions,
      [...positions].sort((a, b) => a - b),
    );
    const heading = (title) => markdown.indexOf(`</a>${title}\n`);
    assert.ok(heading('Crear un bloque') < heading('Buscar un ejercicio'));
    assert.ok(heading('Buscar un ejercicio') < heading('Conocer En vivo'));
  });

  it('lists every task in the index, linked to its own anchor', () => {
    const markdown = write();

    assert.match(markdown, /- \[Crear un bloque\]\(#create-block\)/);
    assert.match(markdown, /### <a id="create-block"><\/a>Crear un bloque/);
    assert.match(markdown, /- \[Bienvenida\]\(#bienvenida\)/);
  });

  it('tells each step with the text of its globe, what to do and its screenshot', () => {
    const markdown = write();

    assert.match(markdown, /Resumen de Crear un bloque/);
    assert.match(
      markdown,
      /#### 1\. Bloques\n\nTexto de Bloques\n\n\*\*Qué haces:\*\* Pulsa «Bloques»/,
    );
    assert.match(markdown, /!\[Paso 1: Bloques\]\(capturas\/docente\/create-block-01\.webp\)/);
    assert.match(markdown, /#### 2\. Tus bloques\n\nTexto de Tus bloques\n\n!\[/);
  });

  it('says why a task that was not possible is not told, with its reason', () => {
    const markdown = write();

    assert.match(markdown, /Hablar con el tutor/);
    assert.match(markdown, /No disponible: Si tu navegador puede/);
  });

  it('fails if a task that was possible has no steps: the manual would lie', () => {
    const records = { ...RECORDS, 'find-exercise': undefined };

    assert.throws(() => write({ records }), /find-exercise/);
  });

  it('links the tasks shared with another profile to its manual, without repeating them', () => {
    const index = { ...INDEX, shared: [task('copy-blocks', 'Copiar los bloques de otro grupo')] };
    const markdown = write({ profile: 'admin', index });

    assert.match(markdown, /\n# Manual de la administración\n/);
    assert.match(markdown, /\[Copiar los bloques de otro grupo\]\(docente\.md#copy-blocks\)/);
    assert.doesNotMatch(markdown, /### <a id="copy-blocks">/);
  });
});

describe('parseProfiles', () => {
  it('makes the three manuals by default', () => {
    assert.deepEqual(parseProfiles([]), ['student', 'teacher', 'admin']);
  });

  it('makes only those named, by the name of their file', () => {
    assert.deepEqual(parseProfiles(['alumno']), ['student']);
    assert.deepEqual(parseProfiles(['docente', 'administracion']), ['teacher', 'admin']);
  });

  it('says which names there are when one is wrong', () => {
    assert.throws(() => parseProfiles(['profesor']), /alumno, docente, administracion/);
  });

  it('names a file for each manual', () => {
    assert.deepEqual(
      Object.values(MANUALS).map(({ file }) => file),
      ['alumno', 'docente', 'administracion'],
    );
  });
});
