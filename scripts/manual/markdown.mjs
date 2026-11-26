// The user manuals of docs/manual in Markdown (7.0c, D-080, D-098), to read them on GitHub.
import { ANCHORS, MANUALS, manualSections, stepsOf, TEXTS, WELCOME } from './content.mjs';

/**
 * The Markdown of the manual of a profile: an index and, for the welcome and each task, its steps
 * with the text of each globe and its screenshot. `index` is what the help panel listed and
 * `records` what was done of each task, by its key; `image` gives the path of a screenshot from
 * the manual.
 */
export function manualMarkdown({ profile, index, records, date, image }) {
  const manual = MANUALS[profile];
  const { sections, shared } = manualSections(profile, index);

  return (
    [
      `<!-- ${TEXTS.generated} -->`,
      `# ${manual.title}`,
      manual.intro,
      `_${TEXTS.edition(date)}._`,
      TEXTS.inTheApp,
      `## ${TEXTS.index}`,
      tableOfContents(sections, shared),
      `## <a id="${ANCHORS.welcome}"></a>${TEXTS.welcome}`,
      TEXTS.welcomeIntro,
      stepsMarkdown(stepsOf(WELCOME, records), image, '###'),
      ...sections.flatMap((section) => [
        `## ${section.title}`,
        ...section.tasks.map((task) => taskOf(task, records, image)),
      ]),
      ...(shared ? [sharedMarkdown(shared)] : []),
    ].join('\n\n') + '\n'
  );
}

function tableOfContents(sections, shared) {
  const lines = [`- [${TEXTS.welcome}](#${ANCHORS.welcome})`];
  for (const section of sections) {
    lines.push(`- ${section.title}`);
    for (const task of section.tasks) lines.push(`  - [${task.title}](#${task.id})`);
  }
  if (shared) lines.push(`- [${TEXTS.sharedTitle}](#${ANCHORS.shared})`);
  return lines.join('\n');
}

function taskOf(task, records, image) {
  const heading = `### <a id="${task.id}"></a>${task.title}`;
  if (task.unavailable) return [heading, `_${task.summary}._ ${TEXTS.unavailable}`].join('\n\n');
  return [
    heading,
    `_${task.summary}_`,
    stepsMarkdown(stepsOf(task.id, records), image, '####'),
  ].join('\n\n');
}

function stepsMarkdown(steps, image, level) {
  return steps
    .map((step, position) =>
      [
        `${level} ${position + 1}. ${step.title}`,
        step.text,
        ...(step.action ? [`**${TEXTS.whatYouDo}** ${step.action}`] : []),
        `![${TEXTS.step(position + 1, step.title)}](${image(step.image)})`,
      ].join('\n\n'),
    )
    .join('\n\n');
}

/** The tasks of another profile that this one also has: a link to each in that manual. */
function sharedMarkdown({ manual, tasks }) {
  return [
    `## <a id="${ANCHORS.shared}"></a>${TEXTS.sharedTitle}`,
    TEXTS.sharedIntro(`[${manual.title}](${manual.file}.md)`),
    tasks.map((task) => `- [${task.title}](${manual.file}.md#${task.id})`).join('\n'),
  ].join('\n\n');
}
