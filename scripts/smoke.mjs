// npm run smoke [-- <playwright options>]
//
// The smoke test of the published app (step 3.1, docs/DESPLIEGUE.md, e2e/smoke/): the same on
// macOS and Windows. The URL and the account are public, so they have defaults (SMOKE_URL and
// SMOKE_EMAIL change them); the password is asked for without showing it, unless SMOKE_PASSWORD
// already has it (GitHub Actions), and it never touches a file.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const DEFAULT_URL = 'https://tutoria-rosy.vercel.app';
/** A student of the seed with no history: the smoke test leaves the demo students as they are. */
const DEFAULT_EMAIL = 'lucas.ortiz@tutoria.test';
const CTRL_C = '\u0003';
const BACKSPACE = ['\u0008', '\u007f'];
const ENTER = ['\r', '\n'];

/** Reads a line from the terminal without echoing it. */
function askHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error('Sin terminal: pon la contraseña en SMOKE_PASSWORD.'));
      return;
    }
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let answer = '';
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === CTRL_C) {
          stdout.write('\n');
          process.exit(130);
        } else if (ENTER.includes(char)) {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(answer);
          return;
        } else if (BACKSPACE.includes(char)) {
          answer = answer.slice(0, -1);
        } else {
          answer += char;
        }
      }
    };
    stdin.on('data', onData);
  });
}

const url = process.env['SMOKE_URL'] || DEFAULT_URL;
const email = process.env['SMOKE_EMAIL'] || DEFAULT_EMAIL;
console.log(`Smoke contra ${url} como ${email}`);
let password = process.env['SMOKE_PASSWORD'];
try {
  password ||= await askHidden('Contraseña: ');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const cli = path.join(
  path.dirname(createRequire(import.meta.url).resolve('@playwright/test/package.json')),
  'cli.js',
);
const child = spawn(process.execPath, [cli, 'test', '--project=smoke', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, SMOKE_URL: url, SMOKE_EMAIL: email, SMOKE_PASSWORD: password },
});
child.on('exit', (code) => process.exit(code ?? 1));
