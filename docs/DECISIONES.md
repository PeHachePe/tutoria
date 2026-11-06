# Decisiones técnicas

Cada decisión nueva, o cada cambio sobre una anterior, va en su propia entrada. Las propone el agente y las aprueba el humano.

## D-001 · Decisiones de partida (06/11/2026)

Las decisiones iniciales del proyecto están en `docs/PLAN.md`, sección 3, con su motivo y las alternativas descartadas.

## D-002 · Accesibilidad: axe sin ninguna infracción en cada pantalla (06/11/2026)

**Contexto:** el plan v4.1 pedía pasar axe «sin infracciones graves» y solo en el paso 7.1. La sección de Angular del `CLAUDE.md` exige pasar todas las comprobaciones de axe («It MUST pass all AXE checks») y los mínimos de WCAG AA, incluida la gestión del foco.

**Decisión:** prevalece Angular. Cada pantalla pasa axe, con todas sus reglas, sin ninguna infracción, en modo claro y oscuro. Lo comprueba su e2e desde el paso 0.6, que añade un helper reutilizable, y forma parte de la definición de terminado. Desde el 0.6, cada ruta tiene `title` y el foco va al encabezado principal al cambiar de ruta. El 7.1 queda como repaso final con axe, teclado y lector de pantalla (NVDA).

**Alternativas:** solo infracciones graves, que incumple el `CLAUDE.md`; o comprobarlo solo al final, cuando los fallos se han acumulado y cuesta más corregirlos.

**Consecuencias:** cada e2e de pantalla incluye la comprobación de axe. Cambian `docs/PLAN.md` (§3, §4.8, §5.4, pasos 0.6 y 7.1) y el bloque del proyecto en `CLAUDE.md`.

**Aprobación:** el autor, que delegó la decisión en el agente siguiendo las buenas prácticas de Angular.

## D-003 · Estructura y nombres según la guía de estilo de Angular (06/11/2026)

**Contexto:** la [guía de estilo de Angular](https://angular.dev/style-guide) pide organizar el proyecto por funcionalidad o tema y evitar carpetas por tipo (cita `components/` y `services/`), nombrar cada fichero como lo que contiene y evitar nombres genéricos como `utils.ts`. Para TypeScript remite a la guía de Google, que no admite prefijos ni sufijos `_` en miembros privados. El plan v4.1 tenía `features/`, `layouts/`, `shared/components/`, `shared/utils/` y signals privados `_nombre`.

**Decisión:**

- Carpetas por funcionalidad en la raíz de `src/app` (`auth/`, `student/`, `teacher/`, `admin/`) y por tema (`core/`, `data/`, `shared/`, `dev/`).
- El layout y las rutas de cada rol, en la carpeta del rol.
- Cada store, junto a la pantalla que lo provee; `AuthStore` y los guards, en `auth/`.
- `shared/` con una carpeta o un fichero por concepto (`shared/status-chip/`, `shared/is-stuck.ts`, `shared/create-debouncer.ts`).
- Estado privado de los stores en signals con el sufijo `State`, expuesto con `asReadonly()`, como en los ejemplos de angular.dev.

**Alternativas:** mantener la estructura v4.1, habitual en proyectos Angular antiguos pero contraria a la guía actual.

**Consecuencias:** cambian `docs/PLAN.md` (§4.1, §4.5, §4.8 y pasos 0.4 y 0.6) y el bloque del proyecto en `CLAUDE.md`. Todavía no hay código afectado. El CLI de Angular 22 ya genera los nombres así (`exercise-service.ts`, `status-chip.ts`, `role-guard.ts`), comprobado con `--dry-run`.

**Aprobación:** el autor, que delegó la decisión en el agente siguiendo las buenas prácticas de Angular.

## D-004 · Formularios con FormRoot (06/11/2026)

**Contexto:** el ejemplo de formulario del plan v4.1 manejaba el evento `submit` a mano, con `event.preventDefault()` y `submit()`. La [guía de envío de Signal Forms](https://angular.dev/guide/forms/signals/form-submission) presenta la directiva `FormRoot` como la forma habitual.

**Decisión:** `<form [formRoot]>` con la opción `submission` de `form()`. `onInvalid` lleva el foco al primer campo con error, y el error del servidor se anuncia con `role="alert"`. `submit()` se llama a mano solo cuando no hay un `<form>`, como en un asistente de varios pasos.

**Alternativas:** manejar el envío a mano, con más código y con la posibilidad de olvidar `preventDefault()` o `novalidate`.

**Consecuencias:** cambian `docs/PLAN.md` (§3 y §4.6) y el bloque del proyecto en `CLAUDE.md`. Se aplica en los pasos 1.1 (acceso) y 4.3 (gestión de ejercicios).

**Aprobación:** el autor, que delegó la decisión en el agente siguiendo las buenas prácticas de Angular.

## D-005 · Servicios de datos abstractos sin decorador (06/11/2026)

**Contexto:** el plan no decía qué decorador llevan los servicios de datos. Si la clase abstracta llevara `@Service()`, que la provee en la raíz, un entorno que olvidara registrar su versión crearía en silencio la clase abstracta y fallaría más tarde con un error confuso.

**Decisión:** la clase abstracta no lleva decorador: es el token de inyección. Cada versión lleva `@Service({ autoProvided: false })` y la registran `provideMockData()` o `provideSupabaseData()` con `useClass`.

**Alternativas:** `@Service()` en la clase abstracta, que oculta el olvido de un proveedor; o `InjectionToken`, que añade código sin aportar nada aquí.

**Consecuencias:** si falta un proveedor, Angular avisa de inmediato con un error de inyección. Cambian `docs/PLAN.md` (§4.2) y el bloque del proyecto en `CLAUDE.md`. Se aplica desde el paso 0.4.

**Aprobación:** el autor, que delegó la decisión en el agente siguiendo las buenas prácticas de Angular.

## D-006 · Lint y CLI que hacen cumplir las buenas prácticas de Angular (06/11/2026)

**Contexto:** las normas de Angular del `CLAUDE.md` dependían de que el agente las recordara. Además, el CLI creaba un `.css` con cada componente, en contra de la regla de no tener CSS por componente.

**Decisión:**

- `eslint.config.js` activa reglas de angular-eslint que comprueban esas normas: `prefer-signals`, `prefer-signal-model`, `prefer-output-emitter-ref`, `prefer-output-readonly`, `prefer-host-metadata-property`, `prefer-service-decorator`, `relative-url-prefix`, `no-experimental`, `no-developer-preview` y `prefer-on-push-component-change-detection` con `allowExplicitOnPush: false`. En plantillas: `prefer-ngsrc`, `prefer-class-binding` y `prefer-style-binding`.
- El lint usa información de tipos (`projectService`), que necesitan algunas de esas reglas.
- `angular.json` genera los componentes sin hoja de estilos (`"style": "none"`), y se quita el `app.css` vacío que creó `ng new`.

**Alternativas:** revisarlo a mano en cada paso, que depende de la memoria del agente y del revisor.

**Consecuencias:** `npm run check` falla si se incumple alguna de esas normas. El lint tarda algo más por la información de tipos. Si algún día hiciera falta una API experimental o en developer preview, se desactiva la regla solo en esa línea, con un comentario y una entrada en este fichero.

**Aprobación:** el autor, que delegó la decisión en el agente siguiendo las buenas prácticas de Angular.

## D-007 · Capturas: memoria al final y evolución por pantalla (06/11/2026)

**Contexto:** el plan v4.1 guardaba capturas de cada paso y de cada iteración en `docs/capturas/<paso>/`. Como las pantallas cambian hasta el final, las de la memoria habría que repetirlas, y las de todas las iteraciones se acumularían mezcladas.

**Decisión:** un script, `npm run screenshots`, desde el paso 0.6. Las de la memoria se regeneran en cada entrega en `memoria/<entrega>/<pantalla>/`: tres anchos en claro y escritorio en oscuro. La evolución guarda solo la versión de cada pantalla al cerrar su paso, en `evolucion/<pantalla>/<paso>/` (tres anchos en claro), y las de una iteración solo si el autor lo pide. Mientras se trabaja, la pantalla se comprueba a los tres anchos y en los dos modos, sin guardar nada.

**Alternativas:** guardarlo todo (repetitivo y desordenado) o hacerlo todo al final (se pierde cómo evolucionó cada pantalla, porque las iteraciones no quedan en git).

**Consecuencias:** cambian `docs/PLAN.md` (§5.1, §5.2, §5.5, §5.6 y pasos 0.6, 3.2, 7.1 y 7.4), la plantilla de la bitácora y el bloque del proyecto en `CLAUDE.md`.

**Aprobación:** el autor, que eligió este enfoque.

<!--
Plantilla para las siguientes:

## D-00N · Título corto (dd/mm/aaaa)

**Contexto:** qué problema o situación obliga a decidir.
**Decisión:** qué se hace.
**Alternativas:** qué otras opciones había y por qué se descartan.
**Consecuencias:** qué implica (código, memoria, plazos).
-->

## D-008 · Destruir los stores de pantalla al salir de ella (06/11/2026)

**Contexto:** los stores de pantalla llevan `@Service({ autoProvided: false })` y se proveen en su ruta. Por defecto, Angular no destruye lo que se provee en una ruta al salir de ella: el store se crearía al entrar por primera vez y seguiría vivo, con el último intento en memoria y, en el panel en vivo, la suscripción de Realtime abierta.

**Decisión:** `provideRouter` lleva `withAutoCleanupInjectors()`, estable desde Angular 22.2. Al salir de una pantalla, el router destruye el injector de su ruta, y con él el store, cuyo `DestroyRef` cierra temporizadores y suscripciones. Si una pantalla tiene rutas hijas (el panel en vivo y su detalle), el store se provee en la ruta padre.

**Alternativas:** proveer los stores en el componente de cada pantalla, que también los destruye al salir, pero obliga a colgar las rutas hijas de ese componente para compartirlos; o cerrar cada suscripción a mano, fácil de olvidar.

**Consecuencias:** una línea en `app.config.ts` en el paso 0.6. Cambian `docs/PLAN.md` (§4.5 y paso 0.6).

**Aprobación:** el autor (06/11/2026).

## D-009 · Métricas leyendo los registros de Claude Code, sin `ccusage` (06/11/2026)

**Contexto:** el paso 0.2 permite calcular los tokens y el coste de cada sesión con `ccusage` o leyendo directamente los JSONL de `~/.claude/projects/`. `ccusage` es una dependencia más y toma los precios de una lista externa que puede no tener todavía los modelos recientes, como `claude-opus-5-5`. Además, en esos JSONL cada respuesta del modelo aparece en varias líneas con el mismo consumo (en la sesión del 0.1, 401 líneas para 150 respuestas), y hay que contarlas una sola vez.

**Decisión:**

- `npm run metrics` lee directamente el JSONL de la sesión y los de sus subagentes, cuenta cada respuesta una vez por `message.id` y `requestId`, y calcula el coste con una tabla de precios por modelo en `scripts/metrics/pricing.mjs`, comprobada con la referencia oficial de la API.
- Las líneas, los archivos y los tests salen de los cambios sin confirmar (`git diff HEAD` y los archivos nuevos), que son los del paso porque el commit se hace al cerrarlo. No cuentan `eventos.jsonl`, `metricas.csv` ni `package-lock.json`.
- El hook de la bitácora y el script se lanzan con `node`, sin shell (forma `args` de los hooks), para que funcionen igual en Windows.
- La lógica pura de ambos tiene tests con `node:test`, que ejecuta `npm run test:scripts` dentro de `npm run check`.

**Alternativas:** `ccusage`, que añade una dependencia y depende de que su lista de precios esté al día; o apuntar los tokens a mano desde `/cost`, que no deja rastro reproducible.

**Consecuencias:** si se usa un modelo nuevo, hay que añadir su precio a la tabla; mientras no esté, el script avisa y no lo suma al coste. Si Claude Code cambia el formato de sus registros, hay que ajustar `scripts/metrics/transcript.mjs`.

## D-010 · Cobertura del 100 % en la app Angular (06/11/2026)

**Contexto:** el plan pide TDD solo en la lógica (stores, servicios simulados y funciones compartidas) y tests de componente solo donde hay lógica (§3, §4.8, §5.2 y §5.4). El autor ha fijado una regla más estricta: todo el código de la app Angular debe tener tests, con una cobertura del 100 %, salvo lo que no depende de nosotros. La regla no se aplica a los scripts auxiliares (`scripts/` y los hooks de `.claude/`).

**Decisión:**

- `ng test` mide la cobertura con `@vitest/coverage-v8` (versión 5.1, la misma que `vitest`). La cobertura cuenta todo `src/**/*.ts`, aunque ningún test lo importe, y exige un 100 % de sentencias, ramas, funciones y líneas. Si no se llega, falla `npm run check`.
- Quedan fuera de la cobertura `src/main.ts` (solo arranca la aplicación), `src/environments/**` (constantes de configuración) y los propios tests y sus helpers.
- Lo que depende de algo externo (Supabase, CodeMirror, Web Speech, la Prompt API de Chrome) se aísla en una clase pequeña que se prueba con un doble del servicio externo, como ya prevé el plan. Solo si una línea no se puede ejecutar en un test se marca con `/* v8 ignore next */`, con un comentario que explique por qué, y se anota en la bitácora del paso.
- La TDD (primero el test) se mantiene en la lógica. En plantillas y componentes, los tests pueden escribirse después, pero el paso no se cierra sin el 100 %.
- No aplica a las Edge Functions (Deno) ni a SQL, que siguen con los tests que indica el plan (Deno y pgTAP), ni a los e2e, que comprueban flujos y accesibilidad, no cobertura.

**Alternativas:** mantener los tests solo donde hay lógica, que deja sin probar las plantillas y los componentes sencillos; o un umbral más bajo (80-90 %), que permite dejar partes sin probar sin justificarlo.

**Consecuencias:**

- Cada componente lleva su test de componente con Testing Library (desde el 0.6) o con `TestBed`.
- `ng test` tarda algo más por la cobertura.
- Hay que instalar `@vitest/coverage-v8` y configurar en `angular.json` las opciones `coverage`, `coverageInclude`, `coverageExclude` y `coverageThresholds` del target `test`.
- Cambian `docs/PLAN.md` (§3, fila «Tests»; §4.8, viñeta «Tests»; §5.2, paso 3; §5.4, punto 8) y la regla de TDD del bloque del proyecto en `CLAUDE.md`.
- Se aplica desde el paso en el que se apruebe. El código actual (`app.ts`) debe quedar al 100 % al activarla.

**Aprobación:** el autor (06/11/2026). Aplicada en la iteración 2 del paso 0.2.

## D-011 · Integración continua con GitHub Actions (06/11/2026)

**Contexto:** hoy, que el código que llega al repositorio pase `npm run check` depende de que el agente lo ejecute al cerrar cada paso y de que el autor lo revise antes del commit. Nada lo comprueba de forma independiente, y todo se prueba solo en el equipo del autor, con Windows. El repositorio está en GitHub (`PeHachePe/tutoria`).

**Decisión:**

- Un workflow, `.github/workflows/check.yml`, se ejecuta en cada push a `master` y en cada pull request.
- Usa Ubuntu y Node 24 (la versión local), instala las dependencias con `npm ci` y ejecuta `npm run check`: formato, lint, tests de la app con cobertura del 100 % (D-010) y tests de los scripts.
- Desde el paso 0.6 ejecuta también los e2e con Playwright (Chromium) contra los datos simulados.
- No se añade ningún hook de pre-commit.

**Alternativas:**

- Un hook de pre-commit con Husky: otra dependencia, se salta con `--no-verify`, ralentiza cada commit a medida que crecen los tests y solo comprueba el equipo del autor.
- Las dos cosas: el hook duplicaría lo que ya hace el CI, sin aportar nada más.
- Nada: la comprobación seguiría dependiendo de la disciplina del agente y del autor.

**Consecuencias:**

- Cada commit queda en verde o en rojo en GitHub. Sirve de evidencia para la memoria y la tutora, y descubre fallos que en Windows no se ven (mayúsculas en las rutas, saltos de línea, dependencias que solo están en el equipo local).
- Consume minutos de Actions, que son gratuitos en los repositorios públicos y limitados en los privados.
- Cambian `docs/PLAN.md` (§3, fila nueva «Integración continua»; §5.1, el workflow en la tabla de ficheros; paso 0.6, los e2e en el CI).

**Aprobación:** el autor (06/11/2026). Aplicada en la iteración 3 del paso 0.2, con `actions/checkout@v7` y `actions/setup-node@v7`, las versiones vigentes. Para que no se pueda fusionar en `master` sin pasar el check, el autor activa en GitHub una regla de protección de la rama que lo exija.

## D-012 · La bitácora de eventos no guarda el texto de las peticiones (06/11/2026)

**Contexto:** desde el paso 0.2, el hook de Claude Code guardaba en `docs/bitacora/eventos.jsonl` el texto completo de cada petición del autor. Ese fichero se sube a un repositorio público, así que la conversación quedaba publicada tal cual.

**Decisión:**

- De cada petición solo se registra la hora y la sesión (`"event": "prompt"`), nunca su texto. Se borró el texto de todas las peticiones ya registradas.
- Los comandos y los archivos se siguen registrando, sin la salida de los comandos y sin la carpeta de usuario del equipo.
- `eventos.jsonl` deja de subirse al repositorio: está en `.gitignore` y se queda en el equipo del autor. Las métricas no lo necesitan, porque se calculan con los registros locales de Claude Code.

**Alternativas:** guardar el texto truncado o resumido, que seguiría publicando parte de la conversación.

**Consecuencias:** la bitácora del paso resume lo que se pidió, y `eventos.jsonl` solo aporta cuándo. Cambian `docs/PLAN.md` (paso 0.2 y §5.6) y `.claude/hooks/event-entry.mjs`, con su test. Las versiones anteriores de `eventos.jsonl` siguen en el historial de git hasta que se reescriba.

**Aprobación:** el autor (06/11/2026).
