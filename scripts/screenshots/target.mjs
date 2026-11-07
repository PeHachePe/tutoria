// What `npm run screenshots` captures and where (docs/PLAN.md 5.6), from its arguments.

const DELIVERIES = ['pec3', 'pec4'];
const STEP = /^\d+\.\d+$/;
const SCREEN = /^\d{2}[a-z]?-[a-z0-9-]+$/;
const ITERATION = /^iteracion-\d+$/;

export const USAGE = [
  'Uso:',
  '  npm run screenshots -- <entrega>                  pec3 o pec4: todas las pantallas terminadas',
  '  npm run screenshots -- <paso> <pantalla>          versión de una pantalla al cerrar su paso',
  '  npm run screenshots -- <paso> <pantalla> iteracion-N   capturas de una iteración (si se piden)',
  'Ejemplo: npm run screenshots -- 1.2 02-catalogo',
].join('\n');

/**
 * Turns the arguments into the target of e2e/screenshots/capture.spec.ts, plus the folder to empty
 * first (a delivery is regenerated from scratch), both relative to docs/capturas.
 *
 * @param {string[]} args
 * @returns {{ screens: string[] | 'all', folder: string, dark: boolean, clean: string | null }}
 */
export function parseTarget(args) {
  const [first, second, third, ...rest] = args;

  if (DELIVERIES.includes(first) && second === undefined) {
    return {
      screens: 'all',
      folder: `memoria/${first}/{screen}`,
      dark: true,
      clean: `memoria/${first}`,
    };
  }

  if (
    STEP.test(first ?? '') &&
    SCREEN.test(second ?? '') &&
    (third === undefined || ITERATION.test(third)) &&
    rest.length === 0
  ) {
    const folder = `evolucion/${second}/${first}` + (third ? `/${third}` : '');
    return { screens: [second], folder, dark: false, clean: null };
  }

  throw new Error(`Argumentos no válidos: ${args.join(' ') || '(ninguno)'}\n${USAGE}`);
}
