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
const ANCHORS_FILE = path.join(APP, 'core', 'guide', 'guide-anchor.ts');
/** The profiles of the guided help: they name the pieces with `A.<key>`. */
const PROFILES = [path.join(APP, 'student', 'student-guide.ts')];

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

/** The keys of GUIDE_ANCHORS. */
function anchorKeys() {
  const text = readFileSync(ANCHORS_FILE, 'utf8');
  const block = text.slice(text.indexOf('GUIDE_ANCHORS = {'), text.indexOf('} as const'));
  return [...block.matchAll(/^\s+(\w+): '/gm)].map(([, key]) => key);
}

/** The keys a profile points at. */
function keysNamedBy(file) {
  return new Set([...readFileSync(file, 'utf8').matchAll(/\bA\.(\w+)/g)].map(([, key]) => key));
}

/** The keys some template or component marks, with `anchors.<key>` or `GUIDE_ANCHORS.<key>`. */
function markedKeys() {
  const marked = new Set();
  for (const file of sources(APP)) {
    if (file === ANCHORS_FILE || PROFILES.includes(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const [, key] of text.matchAll(/\b(?:anchors|GUIDE_ANCHORS)\.(\w+)/g)) marked.add(key);
  }
  return marked;
}

describe('the pieces of the guided help', () => {
  const keys = anchorKeys();
  const marked = markedKeys();

  it('are declared once each', () => {
    assert.ok(keys.length > 50);
    assert.equal(new Set(keys).size, keys.length);
  });

  for (const profile of PROFILES) {
    it(`are all marked in some template: ${path.basename(profile)}`, () => {
      const named = [...keysNamedBy(profile)];
      assert.ok(named.length > 50);
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
