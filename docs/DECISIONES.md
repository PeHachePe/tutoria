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

**Aclaración del autor (06/11/2026, paso 0.3):** «lo que no depende de nosotros» incluye las ramas internas que genera Angular (por ejemplo, el código que produce el compilador para las plantillas) y que no se pueden ejecutar desde un test. No hace falta forzarlas: se excluyen con `/* v8 ignore */` y un comentario, o se explica en la bitácora por qué no llegan al 100 %.

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

## D-013 · Tema: tokens propios y Tailwind limitado a los tokens (06/11/2026)

**Contexto:** los prototipos de la memoria usan colores de estado (superado, en curso, atascado, pendiente) que Material 3 no tiene: solo trae primary, secondary, tertiary y error. Además, con la paleta por defecto de Tailwind nada impide escribir `bg-red-500` y saltarse la regla de «solo tokens» (§4.8).

**Decisión:**

- `src/theme.scss` define tokens propios con `light-dark()`, así que cambian solos con el modo:
  - `--app-success`, `--app-warning` e `--app-info`, cada uno con su `on-*`, su `*-container` y su `on-*-container`. Salen de paletas tonales generadas con `ng generate @angular/material:theme-color` y siguen los mismos tonos que los roles de Material (40 y 80, 90 y 30, 10 y 90).
  - `--app-canvas` (fondo de la página) y `--app-panel` (paneles y tarjetas): gris verdoso con paneles blancos en claro y, en oscuro, paneles más claros que el fondo.
- En claro, `primary` es el verde de marca `#03473A` en lugar del tono 40 generado, más apagado.
- `src/styles.css` quita la paleta, la escala de tamaños y las familias de fuente de Tailwind (`--color-*: initial`, `--text-*: initial`, `--font-*: initial`). Solo existen las clases enlazadas a los tokens (`bg-primary`, `bg-success-container`, `text-title-medium`…).
- Ajustes de componentes en el tema: barra superior verde en los dos modos, y tarjetas, tablas, paginador y paneles desplegables con el color de los paneles.
- En `app.config.ts`: campos de formulario con apariencia `outline`, más cercanos a los prototipos, y textos del paginador en español.

**Alternativas:**

- Usar las paletas que trae Material (`$green-palette`…), demasiado saturadas para los chips.
- Colores fijos para los chips, sin modo oscuro.
- Mantener la paleta de Tailwind y confiar en la revisión.

**Consecuencias:** el chip de estado y las piezas propias se pintan solo con tokens, y el modo oscuro no necesita utilidades `dark:`. Si hace falta un tamaño o un color nuevo, se añade como token en `theme.scss` y `styles.css`. Si se aprueba, conviene citar los tokens propios en `docs/PLAN.md` §4.8.

**Aprobación:** el autor (06/11/2026).

## D-014 · Páginas de desarrollo registradas por el entorno (06/11/2026)

**Contexto:** el muestrario `/dev/ui` (y en el 0.5, la barra de desarrollo) solo debe existir en desarrollo, y su código no debería llegar al build de producción.

**Decisión:** cada entorno declara sus rutas de desarrollo en `environment.devRoutes`, igual que declarará sus servicios de datos (§4.4). `environment.development.ts` importa `dev/dev.routes.ts`; `environment.ts` (producción) no importa nada de `dev/`, así que el muestrario no llega a su build. Se comprobó buscando el texto del muestrario en el JavaScript de producción.

**Alternativas:** un indicador `devTools` y una condición en las rutas. Depende de que el minificador elimine el código muerto, y deja una rama que solo se ejecuta en uno de los dos entornos.

**Consecuencias:** el paso 0.5 puede añadir `devTools` y `dataProviders` a los mismos ficheros de entorno.

**Aprobación:** el autor (06/11/2026). Le parece bien, aunque no le importaría que el muestrario llegara a producción: si hace falta enseñarlo en la web pública, se puede publicar en una ruta como `/demo`.

## D-015 · Reglas de la señal «atascado» (07/11/2026)

**Contexto:** el plan (§2.7) y la memoria (CU-03 y RF-17) dan los dos umbrales del tutor proactivo, «fallos repetidos de la misma prueba» (3 por defecto) e «inactividad» (4 minutos por defecto), pero no dicen cómo se cuentan. `isStuck()` es la misma función para el panel docente y para el tutor proactivo, así que su regla tiene que quedar fijada antes de usarla en los dos sitios.

**Decisión:** `isStuck(attempt, events, thresholds, now)`, función pura en `shared/is-stuck.ts`:

- Solo puede estar atascado un intento en `in_progress` o `tests_failed`. En `passed` o `submitted`, nunca.
- **Fallos repetidos:** una misma prueba ha fallado (por fallo, error o tiempo agotado) en las últimas N ejecuciones seguidas. Si la supera una vez, su cuenta vuelve a cero, y no se suman fallos de pruebas distintas.
- **Inactividad:** han pasado N minutos desde la última actividad del alumno, que es lo más reciente de:
  - `attempt.updatedAt`, que cambia con cada guardado del código, porque editar no genera ningún evento;
  - los eventos `run`, `submit`, `hint_requested`, `paste` y `focus_gained`.

  `focus_lost` y `proactive_intervention` no cuentan, porque no son acciones del alumno.

- Basta con llegar al umbral: exactamente 3 fallos o exactamente 4 minutos ya cuentan.
- Los eventos se ordenan por hora dentro de la función, así que pueden llegar en cualquier orden (por ejemplo, desde Realtime).

**Alternativas:**

- Contar los fallos totales de una prueba en todo el intento: un alumno que ya la superó seguiría marcado.
- Medir la inactividad solo con los eventos: sin `updatedAt`, un alumno que escribe sin ejecutar parecería parado.
- Devolver el motivo (fallos o inactividad) en lugar de un booleano: se puede añadir cuando una pantalla lo necesite.

**Consecuencias:** el panel docente necesita, de cada intento, su `status`, su `updatedAt` y sus eventos, y el tutor proactivo lo mismo del intento en curso. El cooldown entre intervenciones (§2.7) no forma parte de la función: lo aplica quien la llama. La regla se resume en `docs/PLAN.md` §2.7.

**Aprobación:** el autor, que delegó la decisión en el agente (07/11/2026).

## D-016 · Tipos de datos del cliente (07/11/2026)

**Contexto:** el plan da el modelo de datos con los nombres de las columnas (snake_case) y los tipos `RunResult` y `TutorEvent`, pero no cómo se representan en TypeScript ni dónde viven los tipos de entrada de cada servicio.

**Decisión:**

- Los tipos de las 10 entidades y los de §2.6 y §4.2 van en `data/`, en un fichero por concepto con el nombre de lo que contiene, como pide la guía de estilo de Angular:
  - `user.ts`: usuarios, grupos y matrículas;
  - `exercise.ts`: ejercicios, pruebas, asignaciones y lo que leen el catálogo y la pantalla de trabajo;
  - `attempt.ts`: intentos, resultados de una ejecución e historial;
  - `process-event.ts`: eventos de proceso;
  - `tutor.ts`: petición, eventos de respuesta e interacciones con el tutor;
  - `ai-provider-setting.ts`: el ajuste del adaptador de IA.
- Los campos van en camelCase, como pide la guía de TypeScript, y todos son `readonly`. Las versiones de cada servicio traducen desde snake_case.
- Las fechas son cadenas ISO 8601, como las devuelve Supabase. Quien necesita operar con ellas usa `Date.parse`.
- `AttemptStatus` incluye `not_started` para las vistas, y `Attempt.status` usa `StoredAttemptStatus`, sin él, porque ese estado no se guarda (§2.4).
- `ProcessEvent` es una unión discriminada por `type`, con el `detail` de cada tipo de §2.8. `ClientProcessEvent` limita a los que registra el navegador lo que acepta `EventService`.
- Los tipos que solo usa un servicio (`Credentials`, `ExerciseDraft`, `LiveUpdate`, `SessionStats`…) viven en el fichero de ese servicio: lo relacionado, junto.
- Las firmas de `LiveService`, `StatsService` y `AdminService` son provisionales. Se ajustan en los pasos que los implementan (4.1, 4.2 y fase 5).
- `DataError` lleva un `kind` y un `cause` opcional, y las pantallas eligen su mensaje según el `kind`.

**Alternativas:**

- Usar los nombres de las columnas en el cliente, sin traducir, o generar los tipos solo a partir del esquema de Supabase (paso 2.1). En los dos casos, las pantallas dependerían de la base de datos, y los datos simulados existen antes que el esquema.
- Un único `models.ts`, como decía el plan. Fue la primera versión: un nombre genérico que mezcla todos los temas y crecería con cada fase.
- Un fichero por tipo, que deja unos 25 ficheros minúsculos (`role.ts`, `difficulty.ts`…) que siempre se usan juntos.

**Consecuencias:** en el paso 2.1, los tipos generados por Supabase se quedan en `data/supabase/` y se traducen a estos. Cambian `docs/PLAN.md` (§4.1 y paso 0.4).

**Aprobación:** el autor, que delegó la decisión en el agente (07/11/2026).

## D-017 · Ajustes del plan tras contrastarlo con la memoria (07/11/2026)

**Contexto:** al empezar el paso 0.5, el autor pasó la memoria del TFM y pidió proponer mejoras siempre que se vean. Al comparar sus requisitos (RF y casos de uso) con el plan v4.2 aparecieron huecos: cosas que la memoria promete y que el plan no construía.

**Decisión:** el plan pasa a la v4.3 con estos cambios:

- **Datos registrados (RF-07):** pantalla `/alumno/datos` y aviso la primera vez que el alumno entra, antes de trabajar. La memoria la justifica con el RGPD (transparencia e información previa) y tiene boceto y prototipo (figuras 14 y 23). Se añade al paso 1.9.
- **Grupos del docente (RF-16):** el docente gestiona sus grupos y su matrícula en `/docente/grupos`, que sustituye a `/admin/grupos`; el administrador entra con acceso a todos, como en el resto del área docente. Las cuentas las sigue creando solo el administrador.
- **Intervenciones ante logros (RF-09, CU-03):** el tutor proactivo celebra cuando el alumno supera una prueba que llevaba `max_repeated_failures` ejecuciones fallando. Es una función pura hermana de `isStuck()`. Los otros dos disparadores del CU-03 («alejamiento sostenido de la solución» y «prueba difícil») no se construyen: no hay forma fiable de medir el primero, y el segundo queda cubierto por este.
- **Streaming (RF-23):** la memoria lo pone en la capa 1 y el plan lo dejaba fuera de la v1. El cliente ya consume una secuencia de eventos, así que el coste está en el servidor: validar el JSON y la ausencia de código mientras llega. Se decide en el paso 2.4 con la función ya hecha. Si no se activa, se corrige la memoria.
- **Voz del tutor elegible** (perspectiva de género de la memoria) en el paso 6.1, y **protección del propio rol del administrador** (CU-06, 3b) en el 5.1.

Ya estaban en el plan y no cambian: «probar la conexión» del proveedor de IA (CU-07, paso 5.3).

**Alternativas:** dejar el plan como estaba y recortar la memoria. Se descarta porque RF-07 y RF-16 tienen prioridad alta en la memoria y RF-07 responde a una obligación legal.

**Consecuencias:** unas 3 horas más entre los pasos 1.9, 5.2 y 6.2. Cambian `docs/PLAN.md` (§2.2, §2.6, §2.7 y pasos 1.9, 5.1, 5.2, 6.1 y 6.2). En la memoria, la nueva ruta del docente y la decisión sobre el streaming se reflejan cuando se tomen.

**Aprobación:** el autor (07/11/2026), que aprobó la propuesta en la sesión del paso 0.5.

## D-018 · Diseño de los datos simulados y de la barra de desarrollo (07/11/2026)

**Contexto:** el paso 0.5 construye MockDb, las fixtures, las versiones simuladas de cuatro servicios, la barra de desarrollo y el script de `seed.sql`. El plan (§4.3 y §4.4) dice qué hacen, pero no cómo.

**Decisión:**

- **Un seed realista:** un grupo de 24 alumnos (el tamaño de aula de la memoria), un segundo grupo con otro docente y un alumno desactivado. La actividad se genera con guiones fijos, sin azar, para que `seed.sql` salga siempre igual. Un test comprueba que es coherente: cada solución de ejemplo supera sus pruebas, cada intento cuadra con sus eventos y las pistas por intento bajan sesión a sesión.
- **MockDb guarda todas las tablas en un único signal inmutable**, con `update(tabla, fn)`, en lugar de un signal por tabla: cada cambio se guarda entero en localStorage y el tipo es más sencillo. También guarda la sesión, en su propia clave, porque la sesión de Supabase Auth también es independiente de los datos, y así sobrevive a «Reiniciar datos».
- **Los servicios simulados imitan la RLS** (`mock-access.ts`): lo ajeno da `not_found`, como en Supabase, donde una fila oculta simplemente no aparece; lo que no se puede gestionar da `forbidden`. Las reglas de borrado que tendrá el esquema se aplican ya: un ejercicio con intentos no se borra (`invalid`) y quitar una asignación deja los intentos sin ella.
- **Un intento nuevo empieza vacío**, y el editor muestra como texto de ayuda (_placeholder_) «Escribe aquí la función `suma`», que desaparece al escribir. Así el alumno sabe qué nombre esperan las pruebas y no tiene nada que borrar. En la primera versión el intento empezaba con ese comentario dentro del código; el autor señaló que obligaba a borrarlo a mano (iteración 2).
- **`MockNetwork`** reúne la latencia, que se guarda en localStorage para que sobreviva a las recargas, y «fallar la siguiente petición», que lanza el tipo de `DataError` elegido.
- **La barra cambia de usuario y reinicia los datos recargando la página**, en lugar de avisar a cada pantalla: así todo se vuelve a leer como lo haría un usuario real. La recarga está en una clase pequeña (`PageReloader`) que los tests sustituyen. La barra es código de desarrollo y puede hablar con MockDb; las pantallas no.
- **La barra llega a la app mediante el token `DEV_TOOLBAR`**, que solo provee `environment.development.ts` con `provideDevToolbar()`. `App` lo pinta con `NgComponentOutlet` si existe. Los entornos ganan `dataProviders` y `devProviders`, igual que `devRoutes` (D-014). Se comprobó que el JavaScript de producción no contiene ni las fixtures ni la barra ni el muestrario.
- **Explorador `/dev/datos`** (iteración 1, a petición del autor, para poder probar los datos a mano antes de que existan las pantallas): usa los servicios abstractos, con sus estados de carga y de error, salvo dos ayudas que solo existen con datos simulados y tocan MockDb: la ejecución simulada, hasta el paso 1.5, y la lista de ejercicios no asignados de un alumno, para probar la regla de acceso. La barra enlaza las dos páginas de desarrollo.
- **Estado y dificultad como piezas compartidas** (iteración 2): `<app-status-chip>` (color e icono por estado; el icono repite el significado para no depender solo del color) y `<app-difficulty-chip>` (neutro, con contorno, para no confundirse con el estado). En la interfaz del alumno, las pruebas visibles se llaman «Ejemplos» y las ocultas, «comprobaciones ocultas» (§2.5).
- **Los controles de la barra no usan Signal Forms:** se aplican al momento y no hay nada que enviar, así que `mat-select` y `mat-button-toggle` llaman a sus métodos.
- **`npm run seed`** ejecuta las fixtures `.ts` directamente con Node 24 (type stripping) y un hook que resuelve los `import` sin extensión de Angular, sin añadir dependencias como `tsx`. `npm run check` comprueba con `--check` que `seed.sql` está al día. Las cuentas de `auth.users` se añaden en el paso 2.1, cuando haya esquema con el que probarlas.
- **Corrección del paso 0.4:** `NewProcessEvent` usaba `Omit` sobre una unión, que no se reparte y perdía la relación entre `type` y `detail`. Ahora usa un `Omit` que se reparte por cada tipo.

**Alternativas:**

- Cuatro alumnos, como decía el plan: la tabla en vivo y el histórico no se podrían diseñar con un tamaño realista.
- Avisar a los stores del cambio de usuario sin recargar: cada store tendría que escuchar a la barra, que es código de desarrollo.
- Leer `environment.devToolbar` dentro de `App`: no se pueden probar las dos ramas, porque los tests usan un único entorno.
- Generar `seed.sql` a mano o con `tsx`: el primero se desincroniza y el segundo es una dependencia más para un script.

**Consecuencias:** el paso 2.1 añade `auth.users` al generador y convierte las inserciones de `app_user` en _upserts_, porque el trigger de alta ya crea esas filas. Las fixtures solo pueden usar sintaxis de TypeScript que Node sabe borrar. Cambian `docs/PLAN.md` (§4.3, §4.4 y pasos 0.5 y 2.1).

**Aprobación:** el autor, que delegó la decisión en el agente (07/11/2026).
