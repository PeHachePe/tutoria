# Los e2e del CI, en el contenedor de Playwright

11/11/2026 · Sesión de Claude Code · Commits `c7813d4` (test de login), `1d64dd3` (CI en el contenedor) y `b6815ce` (documentación)

## Objetivo

Que el CI deje de fallar al instalar Chromium y que no vuelva a depender de lo que GitHub ponga en `ubuntu-latest`, con la solución que dé menos problemas a largo plazo y, si puede ser, más rápida.

## Qué se pidió

- Por qué fallaba `npx playwright install --with-deps chromium` en el CI, si antes funcionaba y si había cambiado algo.
- Cuál es la mejor solución; qué problema tiene el contenedor de Playwright, si fijar una versión antigua de Ubuntu es buena idea, y si Cypress u otras herramientas serían mejores.
- «Haz la mejor solución, pero que sirva a largo plazo y la que menos problemas dé», y más rápida si se puede.
- Al relanzar el CI, la instalación pasó, pero falló el test de las cuentas de demostración del login.

## Qué hizo Claude

1. Diagnóstico: el runner no resolvía por DNS los repositorios de Ubuntu (sí los de Microsoft), y el log decía `resolute`. `ubuntu-latest` había pasado a Ubuntu 26.04; el workflow no cambiaba desde el 1.1e. Que pasara al relanzarlo lo confirmó.
2. Comparó las opciones (relanzar, fijar `ubuntu-24.04`, el Chrome del runner, cachear los navegadores y el contenedor) y las herramientas (Cypress, Selenium/WebdriverIO, Puppeteer, Vitest en modo navegador).
3. Workflow en tres jobs: `check` sin navegador; `playwright-version`, que lee la versión de `@playwright/test` del `package-lock.json`; y `e2e` en `mcr.microsoft.com/playwright:v<versión>-noble` con `--ipc=host`, en paralelo con `check` y sin `apt` ni descarga del navegador.
4. `@playwright/test` fijado en `1.65.0` exacto.
5. El test de login fallaba desde el 2.5c: con Elena hay dos cuentas «Alumna» y el localizador encontraba las dos. Ahora comprueba que hay exactamente dos.
6. D-048 y la fila de pendientes para pasar a la imagen de la siguiente versión de Ubuntu.

## Comandos e instalaciones

| Comando                                                              | Para qué                                         |
| -------------------------------------------------------------------- | ------------------------------------------------ |
| `npm install --save-dev --save-exact @playwright/test@1.65.0`        | Fijar Playwright con versión exacta              |
| `docker manifest inspect mcr.microsoft.com/playwright:v1.65.0-noble` | Comprobar que la imagen existe                   |
| `docker run … mcr.microsoft.com/playwright:v1.65.0-noble …`          | Reproducir el job `e2e` en local (ver problemas) |
| `npx playwright test --project=e2e e2e/login.spec.ts`                | Comprobar el test de login arreglado             |

## Archivos creados o modificados

- `.github/workflows/check.yml`: tres jobs y el contenedor.
- `package.json` y `package-lock.json`: `@playwright/test` exacto.
- `e2e/login.spec.ts`: las dos alumnas del menú.
- `docs/DECISIONES.md` (D-048), `docs/PENDIENTES.md`, `docs/E2E-PENDIENTES.md`, `docs/REGISTRO.md`, esta bitácora y `docs/bitacora/metricas.csv`.

## Problemas y cómo se resolvieron

- **Disco C: lleno:** al descargar la imagen (unos 3,6 GB descomprimida) para reproducir el CI en local, el disco llegó al 100 % y Docker dejó de responder. El autor liberó espacio.
- **Imagen local corrupta:** la extracción se cortó con el disco lleno, y Docker siguió reutilizando esas capas al descargarla de nuevo: 601 de los 678 ficheros de los navegadores estaban vacíos, y Chromium salía sin error. Se borró la copia local. En GitHub la imagen se descarga limpia en cada ejecución, así que la prueba real del contenedor es el primer CI tras el commit.

## Decisiones

- [D-048](../DECISIONES.md): e2e en el contenedor de Playwright, con la etiqueta tomada del lockfile, Playwright fijado y `check` y `e2e` en paralelo.

## Tests

Unitarios: 1070 (nuevos: 0) · e2e: 38 (el de login, corregido). En local, la suite completa dio 35 de 38: `mascot.spec.ts:10`, `shells.spec.ts:110` y `showcase.spec.ts:17` fallaron y pasaron al repetirlos solos (intermitentes con carga, ajenos a este cambio; a E2E-PENDIENTES) · Deno: 101 · scripts: 118. `npm run check` en verde, con cobertura del 100 %.

## Validación humana

- Preguntó por qué fallaba si antes iba y si el agente había cambiado algo: no, el cambio fue de GitHub.
- Preguntó por las alternativas y por Cypress, y pidió la solución más duradera, con menos problemas y más rápida.
- Relanzó el CI: la instalación pasó y destapó el test de login del 2.5c.
- Liberó espacio en C: y preguntó si los e2e en local necesitan Docker ahora: no, solo el CI usa el contenedor.
- **Cierre:** el autor hizo los tres commits; queda ver el primer CI con el contenedor al subirlos.

## Capturas

No aplica.

## Métricas

| Duración   | Tokens de entrada | Tokens de salida | Tokens de caché                    | Coste equivalente | Líneas +/− | Archivos | Horas humanas |
| ---------- | ----------------- | ---------------- | ---------------------------------- | ----------------- | ---------- | -------- | ------------- |
| 5 h 10 min | 121               | 38.793           | 5.675.364 leídos / 86.254 escritos | 2,60 $            | +64 / −5   | 5        | ≈ 1 h 30 min  |

La duración es la de la sesión, con las esperas del autor (entre ellas, liberar espacio); el trabajo de Claude fue de unos 45 min. Las horas humanas son una estimación: el doble de ese tiempo.

## Para la presentación

`ubuntu-latest` cambió de versión y el CI falló sin tocar una línea: un entorno de pruebas que no se fija acaba cambiando solo.
