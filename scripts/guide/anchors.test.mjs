// Every piece a guided task, a welcome or a beacon points at (2.12) must be marked in some template
// with GuideAnchor: otherwise its step would wait for a piece that never comes. It reads the files,
// as the pieces live in many components and no unit test renders them all at once.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = path.join(ROOT, 'src', 'app');
const GUIDE = path.join(APP, 'core', 'guide');
/** The ids, declared by area: one file each, besides guide-anchor.ts, which joins them. */
const ANCHOR_FILES = [
  path.join(GUIDE, 'guide-anchor.ts'),
  ...readdirSync(path.join(GUIDE, 'anchors')).map((file) => path.join(GUIDE, 'anchors', file)),
];
const TEACHER_GUIDE = path.join(APP, 'teacher', 'teacher-guide');
const ADMIN_GUIDE = path.join(APP, 'admin', 'admin-guide');
/** The profiles of the guided help, each in one or more files: they name the pieces with `A.<key>`. */
const PROFILES = {
  student: [path.join(APP, 'student', 'student-guide.ts')],
  teacher: ['teacher-beacons.ts', 'teacher-tasks.ts', 'teacher-how-tos.ts', 'teacher-guide.ts'].map(
    (file) => path.join(TEACHER_GUIDE, file),
  ),
  admin: ['admin-beacons.ts', 'admin-tasks.ts', 'admin-guide.ts'].map((file) =>
    path.join(ADMIN_GUIDE, file),
  ),
};
const PROFILE_FILES = Object.values(PROFILES).flat();

/** Every .ts and .html of the app, without the tests. */
function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.(ts|html)$/.test(entry.name) && !/\.spec\.ts$|-testing\.ts$/.test(entry.name)
      ? [full]
      : [];
  });
}

/** The keys and ids of every area, as declared: a key or an id repeated would hide another. */
function anchorEntries() {
  return ANCHOR_FILES.flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/^\s+(\w+): '([\w-]+)',$/gm)].map(([, key, id]) => ({
      key,
      id,
    })),
  );
}

/** The keys the files of a profile point at. */
function keysNamedBy(files) {
  return new Set(
    files.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/\bA\.(\w+)/g)].map(([, key]) => key),
    ),
  );
}

/**
 * The keys some template or component marks, with `anchors.<key>`, `GUIDE_ANCHORS.<key>` or, in a
 * list of entries such as the side menu of the staff, `A.<key>`.
 */
function markedKeys() {
  const marked = new Set();
  for (const file of sources(APP)) {
    if (ANCHOR_FILES.includes(file) || PROFILE_FILES.includes(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const [, key] of text.matchAll(/\b(?:anchors|GUIDE_ANCHORS|A)\.(\w+)/g)) marked.add(key);
  }
  return marked;
}

describe('the pieces of the guided help', () => {
  const entries = anchorEntries();
  const keys = entries.map(({ key }) => key);
  const marked = markedKeys();

  it('are declared once each, with an id of their own', () => {
    assert.ok(keys.length > 50);
    const repeated = (list) => list.filter((item, index) => list.indexOf(item) !== index);
    assert.deepEqual(repeated(keys), [], 'keys declared twice');
    assert.deepEqual(repeated(entries.map(({ id }) => id)), [], 'ids declared twice');
  });

  it('are all named by some profile, or marked for one', () => {
    const named = keysNamedBy(PROFILE_FILES);
    assert.deepEqual(
      keys.filter((key) => !named.has(key) && !marked.has(key)),
      [],
      'pieces GUIDE_ANCHORS declares that nobody uses',
    );
  });

  for (const [profile, files] of Object.entries(PROFILES)) {
    it(`are all marked in some template: ${profile}`, () => {
      const named = [...keysNamedBy(files)];
      assert.ok(named.length > 20);
      assert.deepEqual(
        named.filter((key) => !keys.includes(key)),
        [],
        'pieces the profile names that GUIDE_ANCHORS does not declare',
      );
      assert.deepEqual(
        named.filter((key) => !marked.has(key)),
        [],
        'pieces the profile names that no template marks',
      );
    });
  }
});
