// Imports a TypeScript file of the app from a Node script (the fixtures of the mock data, step 4.3).
//
// Node runs TypeScript directly (type stripping), so those files may only use erasable syntax (no
// enums) and must import types with `import type`. Angular imports have no extension, so a resolve
// hook tries `.ts` when a relative import is not found.
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let registered = false;

function registerTypeScriptHooks() {
  if (registered) return;
  registered = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      try {
        return nextResolve(specifier, context);
      } catch (error) {
        if (specifier.startsWith('.') && !path.extname(specifier)) {
          return nextResolve(`${specifier}.ts`, context);
        }
        throw error;
      }
    },
    // The fixtures are ES modules; saying so spares Node from guessing (and warning about it).
    load(url, context, nextLoad) {
      return nextLoad(
        url,
        url.endsWith('.ts') ? { ...context, format: 'module-typescript' } : context,
      );
    },
  });
}

/** The exports of a TypeScript file of the app, by its path. */
export function importAppTs(file) {
  registerTypeScriptHooks();
  return import(pathToFileURL(file).href);
}
