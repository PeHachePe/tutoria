// The user manuals of docs/manual as a page to print (7.0c, D-098): scripts/manual.mjs turns it
// into a PDF with Playwright. The same content as the Markdown, laid out for paper: a cover, an
// index with links, each part on a page of its own and each step kept together with its screenshot.
import { ANCHORS, MANUALS, manualSections, stepsOf, TEXTS, WELCOME } from './content.mjs';

/** The colours of the brand (src/theme.scss), on paper. */
const STYLE = `
  :root {
    --primary: #03473a;
    --primary-container: #d6eee5;
    --on-surface: #1a1c1b;
    --muted: #4a5551;
    --outline: #c6d1cc;
  }
  * { box-sizing: border-box; }
  html { font: 10.5pt/1.5 Roboto, system-ui, sans-serif; color: var(--on-surface); }
  body { margin: 0; }
  h1, h2, h3, h4 { color: var(--primary); line-height: 1.25; break-after: avoid; }
  a { color: inherit; text-decoration: none; }
  code { font-family: ui-monospace, Consolas, monospace; font-size: 0.92em; }
  .cover { min-height: 245mm; display: flex; flex-direction: column; justify-content: center; gap: 5mm; break-after: page; }
  .cover img { width: 38mm; height: 38mm; }
  .brand { font-size: 14pt; font-weight: 700; letter-spacing: 0.04em; color: var(--primary); margin: 0; }
  .cover h1 { font-size: 30pt; margin: 0; }
  .intro { font-size: 13pt; margin: 0; }
  .edition { color: var(--muted); font-size: 11pt; margin: 0; }
  .note { color: var(--muted); font-size: 9.5pt; border-left: 3px solid var(--primary); padding-left: 3mm; margin: 0; }
  .toc { break-after: page; }
  .toc ol { list-style: none; padding: 0; margin: 0; }
  .toc > ol > li { margin-top: 3mm; font-weight: 500; }
  .toc ol ol { padding-left: 6mm; font-weight: 400; }
  .part { break-before: page; font-size: 20pt; border-bottom: 2px solid var(--primary); padding-bottom: 2mm; margin: 0 0 4mm; }
  .task { margin-top: 8mm; }
  .task h3 { font-size: 15pt; margin: 0 0 1mm; }
  .summary { color: var(--muted); font-style: italic; margin: 0 0 4mm; break-after: avoid; }
  .step { break-inside: avoid; margin: 0 0 6mm; }
  .step h4 { font-size: 11.5pt; margin: 0 0 1mm; }
  .step p { margin: 0 0 2mm; }
  .action { background: var(--primary-container); border-radius: 2mm; padding: 1.5mm 3mm; display: inline-block; }
  .step img { display: block; width: 100%; max-height: 120mm; object-fit: contain; object-position: left top; border: 1px solid var(--outline); border-radius: 2mm; }
`;

/**
 * The page to print of the manual of a profile, from the same `index` and `records` as the
 * Markdown. `image` gives the URL of a screenshot; `assets`, those of the mascot and the font.
 */
export function manualHtml({ profile, index, records, date, image, assets }) {
  const manual = MANUALS[profile];
  const { sections, shared } = manualSections(profile, index);
  const font = `@font-face { font-family: Roboto; src: url("${assets.font}") format("woff2"); font-weight: 100 900; }`;

  return `<!doctype html>
<html lang="es">
<!-- ${TEXTS.generated} -->
<head>
<meta charset="utf-8">
<title>${escape(manual.title)} · TutorIA</title>
<style>${font}${STYLE}</style>
</head>
<body>
<section class="cover">
<img src="${assets.logo}" alt="">
<p class="brand">TutorIA</p>
<h1>${escape(manual.title)}</h1>
<p class="intro">${inline(manual.intro)}</p>
<p class="edition">${escape(TEXTS.edition(date))}</p>
<p class="note">${inline(TEXTS.inTheApp)}</p>
</section>
${tableOfContents(sections, shared)}
<h2 class="part" id="${ANCHORS.welcome}">${TEXTS.welcome}</h2>
<p class="summary">${inline(TEXTS.welcomeIntro)}</p>
${stepsHtml(stepsOf(WELCOME, records), image)}
${sections
  .map(
    (section) =>
      `<h2 class="part">${escape(section.title)}</h2>\n${section.tasks.map((task) => taskOf(task, records, image)).join('\n')}`,
  )
  .join('\n')}
${shared ? sharedHtml(shared) : ''}
</body>
</html>
`;
}

function tableOfContents(sections, shared) {
  const link = (anchor, title) => `<a href="#${anchor}">${escape(title)}</a>`;
  const items = [
    `<li>${link(ANCHORS.welcome, TEXTS.welcome)}</li>`,
    ...sections.map(
      (section) =>
        `<li>${escape(section.title)}<ol>${section.tasks.map((task) => `<li>${link(task.id, task.title)}</li>`).join('')}</ol></li>`,
    ),
    ...(shared ? [`<li>${link(ANCHORS.shared, TEXTS.sharedTitle)}</li>`] : []),
  ];
  return `<nav class="toc">\n<h2>${TEXTS.index}</h2>\n<ol>${items.join('\n')}</ol>\n</nav>`;
}

function taskOf(task, records, image) {
  const heading = `<h3>${escape(task.title)}</h3>`;
  const body = task.unavailable
    ? `<p class="summary">${inline(task.summary)}. ${inline(TEXTS.unavailable)}</p>`
    : `<p class="summary">${inline(task.summary)}</p>\n${stepsHtml(stepsOf(task.id, records), image)}`;
  return `<article class="task" id="${task.id}">\n${heading}\n${body}\n</article>`;
}

function stepsHtml(steps, image) {
  return steps
    .map((step, position) =>
      [
        '<div class="step">',
        `<h4>${position + 1}. ${escape(step.title)}</h4>`,
        `<p>${inline(step.text)}</p>`,
        ...(step.action
          ? [`<p class="action"><strong>${TEXTS.whatYouDo}</strong> ${inline(step.action)}</p>`]
          : []),
        `<img src="${image(step.image)}" alt="${escape(TEXTS.step(position + 1, step.title))}">`,
        '</div>',
      ].join('\n'),
    )
    .join('\n');
}

/** The tasks of another profile that this one also has, by name: a PDF cannot link to another. */
function sharedHtml({ manual, tasks }) {
  return [
    `<h2 class="part" id="${ANCHORS.shared}">${TEXTS.sharedTitle}</h2>`,
    `<p>${inline(TEXTS.sharedIntro(manual.title))}</p>`,
    `<ul>${tasks.map((task) => `<li>${escape(task.title)}</li>`).join('')}</ul>`,
  ].join('\n');
}

function escape(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Escaped, with the code between backticks as code, as in the Markdown. */
function inline(text) {
  return escape(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}
