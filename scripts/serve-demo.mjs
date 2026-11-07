// npm run serve:demo -- [port]
// Serves the `demo` build (npm run build:demo) as static files, as a static host such as Vercel
// would: the e2e tests and the screenshots run against it (step 1.1e, D-025).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

import { contentType, resolveFile } from './demo/resolve-file.mjs';

const DEFAULT_PORT = 4200;
const ROOT = join(process.cwd(), 'dist', 'demo', 'browser');

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error('No está el build demo: compílalo antes con «npm run build:demo».');
  process.exit(1);
}

const port = Number(process.argv[2] ?? DEFAULT_PORT);
const isFile = (path) => existsSync(path) && statSync(path).isFile();

createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const file = resolveFile(ROOT, request.url ?? '/', isFile);
  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': 'no-cache' });
  if (request.method === 'HEAD') response.end();
  else createReadStream(file).pipe(response);
}).listen(port, () => {
  console.log(`Build demo en http://localhost:${port}`);
});
