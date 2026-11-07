import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { contentType, resolveFile } from './resolve-file.mjs';

const ROOT = join('dist', 'demo', 'browser');
const INDEX = join(ROOT, 'index.html');
const FILES = new Set([
  INDEX,
  join(ROOT, 'main-ABC123.js'),
  join(ROOT, 'favicon.svg'),
  join(ROOT, 'media', 'roboto-latin.woff2'),
]);
const isFile = (path) => FILES.has(path);

describe('resolveFile', () => {
  it('serves the files of the build', () => {
    assert.equal(resolveFile(ROOT, '/main-ABC123.js', isFile), join(ROOT, 'main-ABC123.js'));
    assert.equal(
      resolveFile(ROOT, '/media/roboto-latin.woff2', isFile),
      join(ROOT, 'media', 'roboto-latin.woff2'),
    );
  });

  it('serves index.html at the root', () => {
    assert.equal(resolveFile(ROOT, '/', isFile), INDEX);
  });

  it('serves index.html for the routes of the app, as a single-page app needs', () => {
    assert.equal(resolveFile(ROOT, '/login', isFile), INDEX);
    assert.equal(resolveFile(ROOT, '/docente/en-vivo', isFile), INDEX);
  });

  it('ignores the query string and the fragment', () => {
    assert.equal(resolveFile(ROOT, '/favicon.svg?v=2', isFile), join(ROOT, 'favicon.svg'));
    assert.equal(resolveFile(ROOT, '/login?redirect=%2Falumno', isFile), INDEX);
  });

  it('decodes the path', () => {
    assert.equal(resolveFile(ROOT, '/docente/hist%C3%B3rico', isFile), INDEX);
  });

  it('answers a missing file with nothing rather than with the page, so it fails loudly', () => {
    assert.equal(resolveFile(ROOT, '/chunk-MISSING.js', isFile), null);
    assert.equal(resolveFile(ROOT, '/media/missing.woff2', isFile), null);
  });

  it('never leaves the folder of the build', () => {
    assert.equal(resolveFile(ROOT, '/../../package.json', isFile), null);
    assert.equal(resolveFile(ROOT, '/%2e%2e/%2e%2e/package.json', isFile), null);
    assert.equal(resolveFile(ROOT, '/..%5C..%5Cpackage.json', isFile), null);
  });

  it('answers a path that cannot be decoded with nothing', () => {
    assert.equal(resolveFile(ROOT, '/%E0%A4%A', isFile), null);
  });
});

describe('contentType', () => {
  for (const [file, type] of [
    ['index.html', 'text/html; charset=utf-8'],
    ['main-ABC123.js', 'text/javascript; charset=utf-8'],
    ['styles-ABC123.css', 'text/css; charset=utf-8'],
    ['favicon.svg', 'image/svg+xml'],
    ['favicon.ico', 'image/x-icon'],
    ['roboto-latin.woff2', 'font/woff2'],
    ['material-symbols.woff', 'font/woff'],
    ['3rdpartylicenses.txt', 'text/plain; charset=utf-8'],
    ['data.json', 'application/json; charset=utf-8'],
    ['logo.png', 'image/png'],
  ]) {
    it(`gives ${file} the type ${type}`, () => {
      assert.equal(contentType(file), type);
    });
  }

  it('gives unknown files a generic type', () => {
    assert.equal(contentType('archive.xyz'), 'application/octet-stream');
  });
});
