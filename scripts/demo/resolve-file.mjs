// Which file of the `demo` build answers each request (scripts/serve-demo.mjs, D-025).
import { extname, isAbsolute, join, relative } from 'node:path';

const INDEX = 'index.html';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

/**
 * The file that answers `url`, or null for a 404. A file of the build is served as it is; any other
 * path without an extension is a route of the app and gets index.html, as a single-page app needs.
 * A missing file with an extension (a chunk, a font) gets a 404 rather than the page, so it fails
 * loudly, and nothing outside `root` is ever served.
 *
 * @param {string} root Folder of the build.
 * @param {string} url Path of the request, with its query string if any.
 * @param {(path: string) => boolean} isFile Whether a file exists at that path.
 * @returns {string | null}
 */
export function resolveFile(root, url, isFile) {
  let path;
  try {
    path = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return null;
  }

  const file = join(root, path);
  const inside = relative(root, file);
  if (inside.startsWith('..') || isAbsolute(inside)) return null;

  if (isFile(file)) return file;
  return extname(path) ? null : join(root, INDEX);
}

/**
 * The Content-Type of a file of the build.
 *
 * @param {string} file
 * @returns {string}
 */
export function contentType(file) {
  return CONTENT_TYPES[extname(file)] ?? 'application/octet-stream';
}
