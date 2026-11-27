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

## D-019 · Sesión, guards y shells por rol (07/11/2026)

**Contexto:** el paso 0.6 construye las rutas por rol, los guards, los layouts y la navegación accesible. El plan dice qué hace falta, pero no cómo se conoce el rol a tiempo, qué ve quien entra en una página de otro rol ni cómo se reparten los layouts. Además, la frase del paso «el administrador entra en todo» chocaba con §2.2, que solo le abre las pantallas del docente.

**Decisión:**

- **La sesión se restaura una vez al arrancar** (`provideAppInitializer` con `AuthStore.restore()`), antes de la primera navegación. Así los guards deciden al momento, sin esperar a una promesa. Si la restauración falla, se arranca sin sesión y se va al acceso.
- **Guards `canMatch`:**
  - sin sesión, llevan a `/login`;
  - con otro rol, la ruta no existe para ese usuario y termina en la página 404, con «Ir a mi inicio», que lleva a `/`;
  - el código de un área nunca se descarga para quien no puede verla.

  `/` lleva al inicio de cada rol (alumno, `/alumno`; docente, `/docente/en-vivo`; administrador, `/admin/usuarios`), y `/login` lleva ahí a quien ya tiene sesión. El login del paso 1.1 solo tendrá que navegar a `/`.

- **El administrador entra en el área docente, no en la del alumno**, como dice §2.2: no está matriculado en ningún grupo, así que las pantallas del alumno no tienen sentido para él. Se corrige la frase del paso 0.6.
- **Un layout compartido para el docente y el administrador** (`shared/staff-layout/`) en lugar de `teacher-layout/` y `admin-layout/`. El administrador trabaja en las dos áreas y debe ver el mismo menú (Docencia y Administración) esté donde esté; con dos layouts, el código y el menú estarían duplicados. El menú lateral queda fijo desde 1024 px y se abre encima del contenido por debajo de ese ancho; se cierra al elegir una página.
- **Ajustes y «Mis datos» del alumno van en el menú de usuario**, como en el prototipo (figuras 7–10). La barra deja espacio para el ejercicio y cabe a 375 px sin esconder nada.
- **El tema se puede cambiar desde el menú de usuario de todos los roles:** el docente y el administrador no tienen pantalla de ajustes.
- **Accesibilidad de la navegación:**
  - cada ruta tiene `title`;
  - tras cada navegación, `HeadingFocus` lleva el foco al `h1` de `<main>`, y le pone `tabindex="-1"` si no lo tiene, para que ninguna pantalla tenga que acordarse; en la primera carga no mueve el foco;
  - cada shell empieza con el enlace «Saltar al contenido» (WCAG 2.4.1), que mueve el foco por código para que el router no lo convierta en una navegación.
- **Pantallas de relleno:** un único `PlaceholderPage` que recibe el título y el paso por los datos de la ruta, gracias a `withComponentInputBinding()`. Cada paso de pantalla lo sustituye en su ruta.
- **Al cambiar de usuario, la barra de desarrollo va a `/`** en lugar de recargar la misma página: la página actual puede ser de otro rol y daría un 404. «Reiniciar datos» sigue recargando la misma página. Lo señaló el autor al probar el paso.

**Alternativas:**

- Guards asíncronos que esperan a la sesión: cada guard tendría que esperar, y una pantalla en blanco mientras se restaura no aporta nada en una aplicación que empieza siempre por el acceso.
- Redirigir al usuario a su inicio cuando entra en una página de otro rol: oculta el error y confunde si llegó por un enlace guardado. El 404 explica lo que pasa y ofrece el camino de vuelta.
- Dos layouts que importan los enlaces el uno del otro: duplican la plantilla y se desincronizan.

**Consecuencias:** cambian `docs/PLAN.md` (§4.1 y paso 0.6). En producción todavía no hay servicios de datos (llegan con Supabase en la fase 2), así que la aplicación de producción no arranca hasta entonces (falta el `AuthService` que restaura la sesión); el paso 1.10, si se hace, publica el front con datos simulados.

**Aprobación:** el autor, que delegó la decisión en el agente (07/11/2026). El cambio de la barra de desarrollo lo pidió él.

## D-020 · e2e y capturas con Playwright (07/11/2026)

**Contexto:** el paso 0.6 añade Playwright, axe y Testing Library, el script de capturas y los e2e en el CI. Hay que decidir contra qué se ejecutan, cómo se prepara la sesión y qué se hace con lo que axe señala en los menús de Material.

**Decisión:**

- **Los e2e se ejecutan contra `ng serve` con los datos simulados**, en el puerto 4300, para no reutilizar por error un `npm start` abierto. La sesión y la latencia 0 se escriben en localStorage antes de cargar la página (`e2e/support/session.ts`), con los mismos usuarios del seed que ofrece la barra. Así cada test empieza igual, sin pasar por el formulario de acceso.
- **Helper de axe** (`e2e/support/axe.ts`): todas las reglas, en modo claro y oscuro, con la lista de infracciones legible si falla. Lo usarán los e2e de todas las pantallas.
- **Menús y desplegables en la regla `region`:** Material pinta los menús y las opciones de un `mat-select` al final de `<body>`, fuera de toda región. axe ya acepta así los diálogos. El helper le dice que trate igual `role="menu"` y `role="listbox"`, sin desactivar ninguna regla. Solo existen mientras se usan y se llevan el foco, así que nadie los pasa por alto.
- **Dos infracciones reales corregidas al pasar axe por primera vez:** `mat-nav-list` ya es una región de navegación, y con dos listas (las secciones del administrador) había dos regiones sin nombre. Ahora hay una sola, con nombre («Principal»), y las secciones dentro.
- **Capturas como un proyecto más de Playwright** (`screenshots`): `npm run screenshots` traduce los argumentos (probados con `node:test`), vacía la carpeta de la entrega si toca y lanza Playwright, que reutiliza el servidor y los helpers. Las pantallas se registran en `e2e/screenshots/screens.ts` al cerrar su paso. La barra de desarrollo se oculta en las capturas. Se acepta un tercer argumento `iteracion-N` para las capturas de una iteración.
- **Testing Library** para los tests de componente nuevos, que buscan los elementos por rol, nombre o texto. Los dobles de prueba compartidos van en ficheros `*-testing.ts`, que se tratan como tests: fuera del build de la app y de la cobertura.
- **Corrección del paso 0.2:** el contador de tests de `npm run metrics` contaba como tests `test.describe()` y `test.beforeEach()` de Playwright. Ahora solo cuenta los casos.

**Alternativas:**

- Ejecutar los e2e contra el build de producción servido aparte: no tiene datos hasta la fase 2.
- Entrar con la barra de desarrollo en cada test: más lento y prueba la barra en lugar de la pantalla.
- Desactivar la regla `region` o excluir el overlay de Material: dejaría sin comprobar el resto del contenido de las capas.

**Consecuencias:** el CI instala Chromium y ejecuta `npm run e2e` después de `npm run check`. Cada paso de pantalla añade su e2e con axe y su entrada en `screens.ts`.

**Aprobación:** el autor, que delegó la decisión en el agente (07/11/2026).

## D-021 · Acceso, rutas centralizadas y valores por defecto de Material por área (07/11/2026)

**Contexto:** el paso 1.1 construye la pantalla de acceso. El plan pide accesos rápidos con las cuentas de demostración «en desarrollo», pero no dice cómo evitar que lleguen a producción. Durante el paso, el autor pidió además evitar cadenas y números mágicos, y reutilizar las rutas. Al medir el build de producción, el JavaScript inicial había pasado de 475 kB a 620 kB.

**Decisión:**

- **Volver a la página pedida tras entrar.** Sin sesión, `roleGuard` manda a `/login?redirect=<página>`, y el acceso vuelve ahí al entrar. Como cualquiera puede escribir esa URL, `afterSignInPath()` solo acepta rutas de la propia app (`/…`): ni otro origen (`//host`, `/\host`, `https:`) ni el propio acceso. Si no hay redirección, o no es válida, va a `/`, que lleva al inicio del rol (D-019).
- **Mensajes de error del acceso** (`signInErrorMessage()`): la contraseña incorrecta, la cuenta desactivada y el correo desconocido dan el mismo mensaje, para no revelar qué cuentas existen. _Cambiado en D-041: la cuenta desactivada tiene su propio mensaje._ La red caída y el exceso de intentos tienen el suyo.
- **Cuentas de demostración por token:**
  - `DEMO_ACCOUNTS` (`auth/demo-accounts.ts`) vale `[]` si nadie lo provee;
  - `provideDemoAccounts()` (`dev/`) lo llena con una cuenta por rol y la desactivada, y solo lo registra `environment.development.ts`;
  - el entorno local de Supabase (fase 2) podrá reutilizarlo, porque el seed es el mismo;
  - el build de producción no contiene ni las cuentas ni la contraseña de prueba (comprobado);
  - las partes de una pantalla que solo existen en desarrollo llevan `data-dev-only`, y las capturas las ocultan.
- **Rutas escritas una sola vez:**
  - `core/app-paths.ts` define `SEGMENTS` (para las configuraciones de rutas) y `APP_PATHS` (rutas absolutas para enlaces, redirecciones y guards; las que llevan un id son funciones);
  - las páginas de desarrollo tienen las suyas en `dev/dev-paths.ts`, para que producción no las lleve;
  - los tests siguen escribiendo las URL tal cual, porque son parte del producto (marcadores, enlaces compartidos) y así detectan un cambio accidental.
- **Títulos de pestaña:** `AppTitleStrategy` (`core/`) añade « · TutorIA» al `title` de cada ruta, en lugar de repetirlo en 16 rutas.
- **Valores por defecto de Material en cada área, no en `app.config.ts`.**
  - El paginador en español (`MatPaginatorIntl`) y los campos con contorno (`MAT_FORM_FIELD_DEFAULT_OPTIONS`) se importaban en `app.config.ts`. Mientras ninguna pantalla usaba campos, esbuild descartaba el resto de esos módulos. Con el acceso usándolos, se quedaban enteros en el JavaScript inicial: form-field, Signal Forms, select, tooltip y overlay.
  - Ahora cada área perezosa los provee en su ruta (`provideFormFieldDefaults()` en todas; `provideSpanishPaginator()` en las que tendrán tablas), y el acceso y la barra de desarrollo en el propio componente.
  - Un test de `app.routes.spec.ts` comprueba que ningún área los olvide.
  - Resultado: el JavaScript inicial pasa de 620 kB a 345 kB (de 145 kB a 90 kB comprimido), muy por debajo del presupuesto de 500 kB.
- **e2e:**
  - se ejecutan con `prefers-reduced-motion: reduce`, que Material respeta: un clic en un `mat-select` que aún se abría cayó una vez en otra opción;
  - `expect` espera hasta 10 s, porque un área perezosa servida por el servidor de desarrollo a varios workers puede pasar de los 5 s por defecto.

**Alternativas:**

- Escribir las cuentas de demostración en la plantilla con `isDevMode()`: llegarían al build de producción.
- `input()` con alias `REDIRECT_PARAM`: Angular solo acepta un literal como alias, así que el input se llama `redirect`, con un comentario que lo enlaza a la constante, y el e2e de la redirección comprueba que coinciden.
- Subir el presupuesto del bundle a 650 kB: aceptaba descargar 275 kB de más en cada visita.

**Consecuencias:** cambian §4.1, §4.4 y §4.8 del plan y el paso 1.1. Cada pantalla nueva usa `APP_PATHS` en sus enlaces. Un área nueva tendrá que proveer sus valores por defecto de Material, y el test de rutas lo recuerda.

**Aprobación:** el autor, que delegó la decisión en el agente (07/11/2026). La redirección se propuso en el plan del paso y el autor la aprobó junto con el resto del plan. Lo de las constantes lo pidió él.

## D-022 · Mascota: paso 1.1b, colores propios, animaciones junto al componente y favicon (07/11/2026)

**Contexto:** el autor quiere una mascota para TutorIA basada en su perra carlina. El diseño se iteró fuera del repositorio hasta el boceto v14, que aprobó: un SVG de 200 × 200 con sus animaciones CSS y un favicon simplificado. El plan no tenía ningún paso para la mascota, y las reglas del proyecto piden colores solo con tokens del tema, sin CSS por componente y con las animaciones en `src/styles.css` (§4.8). Durante el paso, el autor pidió que diera la bienvenida en el acceso, que reaccionara al ratón (moverse al pasar por encima, sacar la lengua al hacer clic, seguirlo con los ojos, un huesecito como cursor) y preguntó si su CSS estaría mejor cerca del componente.

**Decisión:**

- **Paso 1.1b, justo después del acceso** y antes del resto de la fase 1: no depende de nada y lo usan el acceso, el chat (1.7) y los ajustes (1.9). Así no se renumeran los pasos que ya se citan en otros documentos, y el orden del plan coincide con el del registro.
- **Componente `<app-mascot>` en `shared/mascot/`:**
  - SVG en línea, decorativo (`aria-hidden` en el host) y con el tamaño que le dé quien lo usa;
  - estado con `mood` (`idle`, `chat`, `thinking`, `joy`) y accesorios con `headset` (activado) y `bowTie` (desactivado), para que los ajustes del alumno puedan cambiarlos (1.9);
  - la plantilla va en `mascot.html` y no en línea: son unas 60 líneas de SVG, y así el lint de plantillas la revisa como a las demás;
  - el patrón de cuadros de la pajarita lleva un `id` numerado por instancia, porque los `id` de un SVG en línea son globales a la página y dos mascotas chocarían;
  - los accesorios desaparecen con `@if` en lugar de con opacidad: si no se llevan, no se pintan.
- **Colores propios, no tokens del tema.** La mascota es una ilustración, como una foto: el pelo crema, la máscara negra y la lengua rosa son los de la perra y no cambian con el tema. Van como colores fijos en el SVG. En modo oscuro se comprobó que la cara clara la recorta bien del fondo, y no transmite información, así que no le aplica el contraste de texto de WCAG.
- **Reacciones al puntero:**
  - al pasar el ratón en reposo, un movimiento al azar (ladea la cabeza, salta o menea la oreja), nunca el mismo dos veces seguidas: `pickMovement()`, función pura con TDD;
  - al hacer clic o tocarla, saca la lengua (salvo con el chat abierto, que ya la tiene fuera);
  - los ojos siguen al ratón: `gazeOffset()` (TDD) desplaza iris, pupilas y brillos hasta 3,5 unidades del dibujo, más cuanto más lejos está el puntero;
  - solo con ratón (`pointerType`): en una pantalla táctil, tocarla es un clic, y los ojos se quedarían mirando el último toque;
  - cada reacción termina con su animación (`animationend`), que el componente reconoce por su nombre;
  - sobre la mascota, el puntero es un huesecito (un SVG de 32 px en línea en `mascot.css`, con la mano como respaldo), que además avisa de que se puede hacer clic.
- **Animaciones en un parcial global junto al componente.** `shared/mascot/mascot.css` lleva las clases y los `@keyframes`, y `src/styles.css` lo importa. Sigue siendo CSS global, sin estilos por componente, pero vive con lo que anima, como pide la guía de estilo de Angular. §4.8 lo admite desde ahora para las animaciones de una pieza concreta. Con `prefers-reduced-motion` no se anima nada salvo los ojos, que siguen lo que hace el usuario.
- **Favicon:** `public/favicon.svg` con la cabeza simplificada y `public/favicon.ico` de respaldo (16, 32 y 48 px) en lugar del de Angular. El `.ico` lo genera `npm run favicon` (`scripts/generate-favicon.mjs`): dibuja el SVG con el Chromium que ya instala Playwright y mete los PNG en el `.ico`, sin dependencias nuevas. El `.ico` va enlazado con `sizes="32x32"` y antes del SVG, para que Chrome prefiera el SVG.

**Alternativas:**

- Renumerar del 1.7 al 1.10: rompía las referencias a esos pasos en el plan, las decisiones y la bitácora.
- Colores con tokens del tema: la perra cambiaría de color con el tema o con la paleta.
- Animaciones en `src/styles.css`: el fichero crecería con cada pieza animada, lejos de su componente.
- Estilos encapsulados (`styleUrl`): rompen la regla del proyecto, y Angular renombra los `@keyframes` al encapsular, así que el componente no reconocería el final de cada reacción por su nombre.
- Un PNG o un `.ico` generado con una librería de imágenes (sharp, png-to-ico): una dependencia más para algo que Playwright ya hace.
- `apple-touch-icon.png`: iOS rellena de negro la transparencia y habría que elegir un fondo. Se deja para el paso de pulido, si el autor lo quiere.

**Consecuencias:** cambian §4.1, §4.8 y la fase 1 del plan (paso 1.1b; los pasos 1.7 y 1.9 la citan). El acceso enseña la mascota (ficha `01-acceso`). Las piezas animadas que vengan, como las reacciones del 1.8, pueden llevar su parcial junto al componente.

**Aprobación:** el autor aprobó el plan del paso completo. Durante el paso pidió la bienvenida en el acceso, las reacciones al ratón y los ojos que lo siguen, y preguntó por el sitio del CSS. El agente eligió el parcial junto al componente, por la delegación del autor en las decisiones técnicas.

## D-023 · Multiidioma con el i18n nativo de Angular: un solo build y las traducciones cargadas al arrancar (07/11/2026)

**Contexto:** el autor pidió que la aplicación estuviera en español, inglés y catalán, con el español por defecto (paso 1.1c). El plan decía «un build por idioma», que es la forma principal de `@angular/localize`. Pero `ng serve` solo sirve un idioma a la vez, los e2e corren sobre `ng serve` y el despliegue en Vercel necesitaría redirecciones por idioma. El autor dejó la elección técnica y el idioma de origen en manos del agente.

**Decisión:**

- **`@angular/localize`, sin librerías:** marcas `i18n` en las plantillas y `$localize` en el código, con **IDs propios legibles** (`@@login.submit`, `@@route.live.title`). Así los ficheros de traducción no cambian cuando se retoca un texto en español y se leen sin la plantilla al lado.
- **El español es el idioma de origen** (`sourceLocale: es`): es el idioma en el que el autor escribe las fichas y los textos, el de la memoria y el del público principal. Del español al catalán se traduce mejor que pasando por el inglés, y los tests siguen buscando los elementos por su texto en español. El inglés de origen solo compensaría con traductores profesionales que trabajen desde él.
- **Un solo build que carga las traducciones antes de arrancar** (`loadTranslations()`, API pública de `@angular/localize`):
  - `core/locale.ts` decide el idioma: el elegido en el menú (`localStorage`); si no hay, el primero de los del navegador que la app habla (`ca-ES` → catalán); si no, español;
  - `core/load-locale.ts` descarga la traducción y los datos de formato del idioma, cada idioma en su propio chunk diferido (el español no descarga nada), y fija `$localize.locale`, del que Angular toma `LOCALE_ID`, y el `lang` de `<html>`. Si la descarga falla, arranca en español en lugar de no arrancar;
  - `main.ts` importa la app solo después: las etiquetas de los menús y los títulos de las rutas llaman a `$localize` al evaluarse su módulo;
  - cambiar de idioma guarda la elección y recarga la página (`LanguageService`), igual en `npm start`, en los e2e, en el build `demo` y en Vercel.
- **Selector de idioma** (`shared/language-menu/`) junto al del tema en las páginas sin menú de usuario (el acceso), y un submenú «Idioma» en el menú de usuario, porque se cambia poco y alargaría el menú al doble. Cada idioma aparece en su propia lengua y con su `lang`, para que el lector de pantalla lo pronuncie bien (WCAG 3.1.2).
- **Material sigue al idioma:** `LocalizedPaginatorIntl` (antes `SpanishPaginatorIntl`) con `$localize`. El `DateAdapter` toma `LOCALE_ID` por sí solo; cuando lleguen el datepicker u otros componentes con textos propios, sus `*Intl` se localizan igual.
- **Ningún texto sin marcar ni sin traducir:**
  - la regla `@angular-eslint/template/i18n` en el lint exige que cada texto y atributo visible de una plantilla lleve `i18n` con ID propio (ignora los iconos y los atributos técnicos);
  - `npm run i18n` extrae los mensajes a `src/locale/messages.json` y comprueba que `messages.en.json` y `messages.ca.json` los tienen todos, sin sobrantes y con los mismos marcadores (`{$start}`). `npm run check` lo ejecuta con `--check`, que además falla si `messages.json` no está al día;
  - los textos del código (`$localize`) no los puede vigilar el lint: se revisan a mano.
- **Lo que no se traduce:** las herramientas de desarrollo (barra, muestrario y `/dev/datos`), que nunca llegan a un build de producción (D-014), ni los datos (nombres de personas y grupos). Las etiquetas de las cuentas de demostración sí se traducen, porque salen en el acceso (lo pidió el autor). La marca «TutorIA» va en la constante `APP_NAME`.
- **Cobertura:** por cada marca `i18n`, el compilador de Angular escribe una rama para Google Closure Compiler que el build reduce a `if (false)` y nunca se ejecuta. Se excluye de la cobertura con `coverage.ignoreNode` en `vitest-base.config.mts` (`runnerConfig` de `angular.json`): es código generado que no depende de nosotros (D-010), y nuestro código no puede tener un `if (false)` porque lo prohíbe el lint.

**Alternativas:**

- **Un build por idioma** (lo que decía el plan): el selector no funcionaría en `npm start`, el e2e del cambio de idioma tendría que esperar al 1.1e y Vercel necesitaría redirecciones. Pasar a él más adelante es sencillo: las marcas y los ficheros son los mismos; se quita la carga de `main.ts`, se añaden los `locales` y `localize` en `angular.json`, el selector navega a `/en/` en lugar de recargar y el despliegue lleva sus redirecciones.
- **Una librería de traducción en tiempo de ejecución** (Transloco, ngx-translate): permite cambiar sin recargar, pero es una dependencia más, con su propia sintaxis, y deja fuera la extracción de Angular. Cambiar de idioma es raro y recargar es aceptable.
- **Inglés como idioma de origen:** obligaba a reescribir todos los textos y los tests, y a traducir del inglés al catalán.
- **Traducir también las herramientas de desarrollo:** unos cien textos que ningún usuario verá.

**Consecuencias:** cada pantalla nueva nace marcada y con sus traducciones en inglés y catalán, o `npm run check` falla; la definición de terminado (§5.4) lo recoge. Cambian el paso 1.1c, §4.1, §4.8 y §5.4 del plan. El arranque hace una espera más en inglés y catalán (un chunk pequeño). El e2e en local usa como máximo 4 navegadores (`playwright.config.ts`): con los 7 por defecto, axe sobre el build sin minificar saturaba el equipo y los tests más pesados pasaban de 60 s. El 1.1e lo revisará con el build `demo`.

**Aprobación:** el autor delegó en el agente la forma de cargar los idiomas y el idioma de origen, y le pidió la opción más correcta.

## D-024 · Pulido de los shells: tema e idioma en la barra, fundido entre pantallas sin view transitions y menú lateral plegable (07/11/2026)

**Contexto:** el paso 1.1d recoge los detalles de los shells que propuso el autor en el 1.1. El plan pedía las view transitions del router (`withViewTransitions()`) y el tema activo bien visible en el menú de usuario. Al implementarlo:

- `withViewTransitions()` sigue en developer preview en Angular 22, y el lint del proyecto solo admite APIs estables (`@angular-eslint/no-developer-preview`, §4.8);
- el autor probó el tema y el idioma como submenús del menú de usuario, con la elección actual en cada entrada («Tema · Oscuro»), y no le gustaron: el segundo submenú se abre encima del primero y queda mal. Antes, con las opciones dentro del menú, el problema era que solo un ✓ marcaba la activa.

**Decisión:**

- **Tema e idioma, botones de la barra** en los shells, los mismos componentes que ya tenía el acceso (`ThemeMenu` y `LanguageMenu`). El botón del tema muestra siempre el icono del modo activo, sin menús anidados y con la misma forma en toda la aplicación. El menú de usuario queda para la cuenta (nombre, enlaces del área y «Cerrar sesión»). Sustituye el submenú «Idioma» de D-023.
- **La opción activa se resalta**, no solo con su ✓: fondo `secondary-container`, texto en negrita y el ✓ al final, sin perder el icono de cada opción. Una sola regla en `theme.scss` para todo `menuitemradio` marcado, así que los menús de elección futuros lo heredan. No depende solo del color (WCAG 1.4.1).
- **Fundido entre pantallas con CSS:** cada página que inserta el router en el `<main>` de un shell (`routed-pages`) entra con 200 ms de opacidad; la barra y el menú lateral no se mueven. Solo la opacidad, porque el elemento de una página puede ser `inline` y no se desplazaría. Sin animación con `prefers-reduced-motion`.
- **Menú lateral plegable en escritorio:** el botón de la barra alterna entre el menú completo y un riel de 80 px con los iconos centrados y un tooltip con el nombre. El nombre de cada enlace sigue siendo su nombre accesible y su `aria-label` coincide con el tooltip, para que no se lea dos veces. La elección se guarda en `localStorage`. El icono (`menu_open`) gira 180° según hacia dónde va el menú. En el móvil sigue deslizándose sobre el contenido, ahora con su estado en una signal.
- **Marca** (`shared/brand/`): mascota y nombre como enlace a la home del rol; en el móvil, solo la mascota, para que la barra quepa a 320 px.

**Alternativas:**

- **`withViewTransitions()`**, que funde la pantalla saliente con la entrante: es la API prevista, pero desactivar la regla del lint para usarla va contra §4.8. Cuando sea estable, basta con añadirla al router y cambiar el CSS del fundido por los pseudoelementos `::view-transition-*`.
- **Llamar a `document.startViewTransition()` a mano** desde los eventos del router: más código propio para reproducir lo que hará la API de Angular.
- **Tema e idioma dentro del menú de usuario** (con o sin submenús): el autor descartó los submenús, y las seis opciones juntas alargaban mucho el menú.

**Consecuencias:** la barra de los shells tiene tres botones a la derecha, como el acceso. Un e2e comprueba que no se desborda a 320 px. Cambian el paso 1.1d y §4.1 del plan, y la nota del 1.1c.

**Aprobación:** el autor eligió quitar los submenús y preguntó si tenía sentido separar idioma y tema; el agente propuso los dos en la barra y lo aplicó. Lo demás lo decidió el agente por delegación del autor.

## D-025 · e2e contra el build `demo` servido como estáticos y axe más rápido (07/11/2026)

**Contexto:** los e2e corrían contra `ng serve`, sin minificar: la suite tardaba unos 2,5–3 min con 4 navegadores como máximo y plazos de 60 s. Al medirlo en el paso 1.1e se vio que lo más lento no era el build sino axe: `@axe-core/playwright` abre una página en blanco en cada llamada para juntar los resultados, y cada pasada tardaba de 3 a 6 s aunque la página tuviera 41 elementos.

**Decisión:**

- **Build `demo`** (`npm run build:demo`): optimizada, con los presupuestos de producción y con `environment.development.ts` (datos simulados, cuentas de demostración, barra de desarrollo y `/dev/ui`). Sale a `dist/demo` y la publicará el 1.10.
- **Servidor propio** (`npm run serve:demo`, `scripts/serve-demo.mjs`), en Node y sin dependencias: sirve los ficheros del build, `index.html` para las rutas de la app y un 404 para un fichero que falta, y nunca sale de su carpeta. Playwright compila y sirve en cada ejecución (unos 4 s con la caché) y no reutiliza un servidor ya abierto, para no probar nunca un build viejo.
- **axe en modo legacy** (`setLegacyMode(true)`): corre dentro de la página, sin la página en blanco, y cada pasada baja a ~1 s. Solo renuncia a los iframes de otro origen, que la app no tiene.
- **Un test de accesibilidad por pantalla** (acceso, 404, shells y muestrario), que recorre sus estados: axe completo en claro y solo `color-contrast` en oscuro, que es lo único que cambia el tema (~0,2 s). Los tests de comportamiento no pasan axe. Los menús compartidos de tema e idioma se comprueban una vez, en los shells, y los estados efímeros (el aviso de 4 s; «Entrando…», cuyo botón deshabilitado exime axe) no se comprueban. Como encadenan varias pasadas, llevan `test.slow()`.
- Se quitan el máximo de 4 navegadores y los plazos de 60 s y 10 s: vuelven los de Playwright.

**Alternativas descartadas:**

- **`ng serve` con la configuración optimizada:** sigue siendo el servidor de desarrollo, no lo que se publica.
- **Un paquete como `serve` o `http-server`:** una dependencia más para 40 líneas.
- **Axe completo en todos los tests y en los dos modos:** duplica el tiempo sin encontrar en oscuro nada más que el contraste.

**Consecuencias:** la suite pasa de 2,5 min con 31 tests a 1,6 min con 38. El CI hace lo mismo y sube el informe de Playwright si falla. Cambia la nota del 1.1c sobre el límite de navegadores.

**Aprobación:** el autor aprobó el plan del paso y exigió que los e2e y los pasos fueran más rápidos; el modo legacy y el recorte de estados salieron de esa petición.

## D-026 · Los e2e, al cierre y no en cada paso (07/11/2026)

**Contexto:** escribir, ejecutar y depurar los e2e alargaba cada paso muy por encima de lo que aportaban; en el 1.1e el paso duró casi una hora, la mayor parte esperando a la suite.

**Decisión:** durante los pasos no se escriben ni se ejecutan e2e. El cierre de cada paso es `npm run check` (formato, lint y tests unitarios al 100 %) y la comprobación en el navegador. Cada paso apunta en `docs/E2E-PENDIENTES.md` los e2e que le tocarían, y todos se escriben y se ejecutan en el 7.1. Los que ya existen se quedan y el CI los sigue ejecutando en cada push, sin bloquear al agente.

**Consecuencias:** cambian §5.4 (punto 6) y el 7.1 del plan. El riesgo de que algo se rompa entre pasos lo cubren los tests unitarios, el CI y la revisión en el navegador.

**Aprobación:** decisión del autor.

## D-027 · Catálogo: «superados», contenidos y pistas en los datos, y piezas de estado compartidas (07/11/2026)

**Contexto:** el prototipo del catálogo (figura 16 de la memoria) muestra bajo cada título los contenidos que practica el ejercicio y, en los intentos abiertos, las pistas usadas. El modelo de datos no tenía los contenidos (solo estaban como columna informativa en §2.5), y `listAssigned` no devolvía las pistas. Además, el ejemplo de §4.5 contaba como «superados» solo los entregados.

**Decisión:**

- `exercise.topics` (`text[]` en PostgreSQL, `readonly string[]` en el cliente): los contenidos de cada ejercicio, con los valores de §2.5. El generador de `seed.sql` escribe las listas de textos como `array[...]::text[]`, y la versión del seed pasa a 2 para que los navegadores descarten los datos simulados guardados.
- `AssignedExercise` añade `hintCount` (pistas pedidas con «Pedir pista» en el último intento) y `hintLevel` (el nivel más alto que alcanzó el tutor, o `null`). Los datos ya existían en `tutor_interaction`, así que se muestran desde ahora; el tutor del 1.7 solo añade interacciones nuevas.
- «Superados» cuenta los ejercicios superados y los entregados: los dos han pasado todas las pruebas. Lo calcula `isPassed()`, en `student/catalog/catalog-sessions.ts`.
- Piezas de estado en `shared/`, para todas las pantallas (4.8, 5.4):
  - `skeleton/`, con `Skeleton` (el bloque) y `LoadingSkeleton`, que muestra los esqueletos y avisa al lector de pantalla solo pasados 300 ms. Usa un temporizador que se limpia con `DestroyRef`, sin `effect()`, porque el componente vive lo mismo que la espera;
  - `empty-state/`;
  - `load-error/`, con el mensaje según el tipo de `DataError` y «Reintentar».
- El lint de i18n ignora `aria-labelledby`, como ya ignoraba `aria-controls`: es una referencia a un id, no un texto.

**Alternativas:** dejar los contenidos y las pistas fuera del catálogo (se descartó porque los datos ya existían o costaban poco); retrasar el esqueleto con un `animation-delay` en CSS (no se puede probar en los tests unitarios ni retrasar el aviso al lector de pantalla).

**Consecuencias:** cambian §2.2, §2.3, §4.2, §4.5 y el paso 1.2 del plan. El back-end (fase 2) añade la columna `topics` y calcula las pistas en la consulta de `listAssigned`. El editor de ejercicios del docente (4.3) incluye los contenidos.

**Aprobación:** el autor, que delegó la decisión en el agente.

## D-028 · Pantalla de trabajo: dos columnas como en la memoria, pestañas en el móvil y apertura del intento (08/11/2026)

**Contexto:** el paso 1.3 del plan pedía tres columnas en escritorio, dos en tableta y pestañas en el móvil. La memoria de la PEC2 propone otra cosa: el prototipo (figura 17) pone el enunciado encima del editor y el tutor a la derecha, «al considerarse más natural la lectura vertical enunciado-código», y la figura 15 apila los bloques en el móvil con el tutor plegable debajo. Hacía falta además decidir cómo se abre el intento sin `ngOnInit` ni `effect()`.

**Decisión:**

- **Escritorio y tableta (desde 768 px), dos columnas como en la memoria:** el enunciado (plegable) encima del código y el tutor con ancho fijo a la derecha (17 rem en tableta, 22 rem desde 1024 px). Con tres columnas, a 1280 px el editor se quedaba en unos 500 px.
- **Móvil, pestañas como en el plan** («Ejercicio», «Código» y «Tutor», con `mat-tab-group`). Apilados como en la figura 15 no cabían en 375 × 667 sin desplazar la página entera (5.4). Es una evolución del diseño respecto a la memoria.
- **Cada zona se escribe una vez** (`ng-template`) y se coloca en las columnas o en las pestañas según `BreakpointObserver`. Al cruzar el ancho de 768 px las zonas se vuelven a crear, y su estado vive en los stores.
- **La pantalla ocupa el alto de la ventana** menos la barra (56 o 64 px, tokens de Material) y el relleno de `<main>`, y cada zona se desplaza por dentro. El enunciado, que se desplaza solo, se puede enfocar con el teclado (`tabindex="0"`, regla `scrollable-region-focusable` de axe).
- **Apertura del intento:** `AttemptStore.open()` es un método `async` (4.5) que la pantalla llama desde un `resource()` con el id del ejercicio. Así la pantalla tiene carga, error y reintento sin `effect()`, y el store guarda el intento para todas las zonas. Si el alumno cambia de ejercicio antes de que llegue la respuesta, el store la ignora.
- **Sin recursos de ruta:** Angular 22 permite declarar la carga en la ruta (`resources`, con `nonBlocking()`), pero está en _developer preview_ y el lint prohíbe esas APIs. Aquí no aportaría nada, porque la ruta padre no carga datos. Queda en `PENDIENTES.md` para cuando sea estable.
- **Mejoras de paso:**
  - el título de la pestaña lleva el nombre del ejercicio (`AppTitleStrategy.setScreenTitle()`, WCAG 2.4.2), salvo que el alumno ya se haya ido;
  - `LoadError`, sin acceso (`forbidden` o `not_found`), muestra la salida que le da la pantalla en lugar de «Reintentar», que fallaría igual (`isRetryable()`);
  - «Ejercicios» de la barra sigue resaltado dentro de un ejercicio, con `isActive()` del router (estable desde Angular 21.1), pero `aria-current="page"` solo lo lleva el catálogo;
  - `format-value.ts` pasa de `dev/` a `shared/`, porque producción no puede importar nada de `dev/`;
  - el lint de i18n ignora `scope`, un atributo de tabla que no se traduce.
- **Iteración 1, mejoras que propuso Claude al revisar la pantalla:**
  - la pantalla de trabajo usa hasta 100 rem (1600 px) de ancho, y las demás del alumno siguen en 1152 px, cómodos para leer: el layout lo decide con el mismo `isActive()` de la barra;
  - el enunciado muestra una sombra suave en el borde con más contenido por ver (utilidad `scroll-shadows` en `styles.css`, solo CSS y con tokens), para que el alumno sepa que se desplaza;
  - en el móvil, el título usa `title-medium` y como mucho dos líneas, y el contenido empieza más arriba;
  - mientras carga, el título muestra un esqueleto (pasados 300 ms) y el lector de pantalla oye «Ejercicio»; `LoadingSkeleton` acepta no anunciar nada cuando otra zona ya anuncia la espera.

**Alternativas:** tres columnas (editor estrecho); apilar en el móvil (la página entera se desplaza); dos plantillas distintas para escritorio y móvil (las zonas se escribirían dos veces); abrir el intento con un `effect()` (prohibido fuera de las APIs imperativas, 4.8).

**Consecuencias:** cambian el paso 1.3 y §2.2 del plan (figuras 8, 15 y 17). La memoria puede citar las pestañas del móvil como evolución del diseño. Los pasos 1.4, 1.5 y 1.7 llenan las zonas.

**Aprobación:** el autor, que delegó la decisión en el agente y le indicó que usara otra disposición, como pestañas, si en móvil o tableta no quedaba bien.

## D-029 · Editor de código sin `effect()` y autoguardado que no pierde nada (08/11/2026)

**Contexto:** el paso 1.4 añade el editor y el autoguardado. El plan (§4.7) pedía un `model()` para el código y un `effect()` que copiara a CodeMirror los cambios externos, y un esqueleto como `@placeholder` del `@defer`. Al revisarlo aparecieron fallos: tras cambiar de ejercicio, Ctrl+Z devolvía el código del anterior; un guardado lento podía pisar lo escrito después; si se recargaba antes de los 800 ms, se perdía lo último. Además, el autor pidió evitar los `effect()` siempre que se pueda y dejar abierta la puerta a otros lenguajes y a otros tipos de ejercicio.

**Decisión:**

- **Editor sin `effect()`:** `<app-code-editor>` lee sus entradas (`initialCode`, `label`, `language`, `placeholder`, `readonly`) al crear CodeMirror y desde entonces el código es suyo: avisa de cada cambio con `codeChange`. La pantalla crea un editor nuevo por intento y al pasar a solo lectura (`@if` sobre el intento y sobre `readonly`), lo que además empieza un historial de deshacer limpio. No hay cambios externos que copiar, ni bucles con un modelo, ni saltos del cursor.
- **Solo los paquetes que se importan:** `@codemirror/view`, `state`, `language`, `commands`, `lang-javascript` y `@lezer/highlight`, sin el paquete `codemirror` (solo trae `basicSetup`, que incluye autocompletado). Las extensiones se eligen una a una.
- **Accesibilidad:** Tab sangra, como en cualquier editor, y Esc seguido de Tab sale del editor (la salida que trae CodeMirror). Un texto bajo el editor lo explica y el área de texto lo enlaza con `aria-describedby` (WCAG 2.1.2). Solo se ve mientras el editor tiene el foco y no en pantallas táctiles, para no quitarle una línea al código; el lector de pantalla lo oye igualmente (iteración 2). El área de texto tiene nombre («Código»), `aria-readonly` cuando está entregado, foco visible con el color primario y `tabindex="0"`: ya se podía enfocar, pero axe solo cuenta el `tabindex`.
- **Colores con tokens:** `EditorView.theme` y un `HighlightStyle` con roles de Material (`primary` para las palabras clave, `tertiary` para las cadenas, `--app-info` para los números y comentarios en cursiva). Es la API de estilos de CodeMirror: con CSS global habría que pelearse con la especificidad de su tema base. Se comprobó con axe en claro y oscuro.
- **Pegados por la marca `input.paste`** de CodeMirror en lugar del evento `paste` del DOM: cubre el teclado, el menú contextual y el móvil, y mide lo que entra en el código. Lo registra el `EventLogger` del 1.6.
- **`@defer` como pide Angular:** `on viewport; prefetch on idle`; el `@placeholder` reserva el sitio sin parpadear, el esqueleto va en `@loading (after 300ms; minimum 500ms)` (4.8) y `@error` ofrece recargar si no llega el trozo de CodeMirror.
- **Autoguardado en `AttemptStore`:** espera 800 ms sin escribir y envía un guardado cada vez; si el alumno escribe mientras tanto, se envía otro al acabar, y la respuesta nunca pisa lo escrito después ni toca otro intento. El estado del indicador (`idle`, `pending`, `saving`, `saved`, `error`) se deriva con `computed()`.
- **No perder nada:** se guarda al momento al cambiar de ejercicio, al salir de la pantalla (`DestroyRef` del store) y al ocultar la pestaña (`visibilitychange`, que en el móvil es el último aviso fiable). Con cambios sin guardar, el navegador pregunta antes de cerrar (`beforeunload`). Un fallo muestra «No se ha guardado» con `role="alert"` y «Reintentar», y el código sigue en el store. «Guardando…» y «Guardado» no se anuncian: el lector de pantalla los repetiría en cada pausa.
- **Tests con CodeMirror real en jsdom,** en lugar de aislarlo en una clase con un doble (D-010): funciona con un único _polyfill_ de medidas (`src/jsdom-testing.ts`, `setupFiles` de `ng test`), y así se prueba lo que hace el alumno. La cobertura deja fuera los metadatos que Angular genera para TestBed en los componentes con `@defer` (`ɵsetClassMetadataAsync`), que solo se usan al sobrescribir un componente en un test (`vitest-base.config.mts`).
- **Puertas abiertas, sin construir aún:**
  - otros lenguajes: el editor elige el paquete de CodeMirror según `exercise.language` en un mapa; añadir Python o Java ahí es una línea, y lo demás queda en `PENDIENTES.md`;
  - otros tipos de ejercicio (test, respuesta numérica): la migración de la fase 2 añadirá `exercise.kind` con `code` por defecto, que no cuesta nada mientras no haya otro tipo.

**Alternativas:** `model()` con `effect()` o `afterRenderEffect()` (funciona, pero copia cambios en las dos direcciones y obliga a comparar textos para no mover el cursor); aislar CodeMirror en una clase con un doble (más código y no prueba lo que ve el alumno); el esqueleto como `@placeholder` (parpadea en escritorio, donde la zona se ve al momento); anunciar «Guardado» con `aria-live` (ruido); el paquete `codemirror` con `basicSetup` (trae autocompletado).

**Consecuencias:** cambian §4.5, §4.7 y el paso 1.4 del plan. El 1.5 crea el editor de solo lectura al entregar con el mismo `@if` y, antes de ejecutar, envía el código actual. El 1.6 conecta `pasted` con el `EventLogger`.

**Aprobación:** el autor, que delegó la decisión en el agente, le pidió aplicar todas las mejoras que viera oportunas y evitar en lo posible `effect()` y mecanismos similares.

## D-030 · Ejecutar y entregar: runner en un Worker por ejecución, resultados honestos y separador del enunciado (08/11/2026)

**Contexto:** el paso 1.5 añade la ejecución de las pruebas con un Web Worker (datos simulados) y la entrega. Al revisar el paso a petición del autor salieron desajustes del plan (las transiciones no pasan todas por el servicio de intentos, el e2e del paso ya no toca por D-026, el explorador seguía con su ejecución simulada) y riesgos: el límite de 2 s contado desde la descarga del Worker, la comparación por JSON sensible al orden de las claves y ciega a `NaN` o `undefined`, el foco perdido al entregar y un guardado en curso que podía llegar después de la ejecución. El autor pidió además las mejoras de UX que propuso Claude, el separador entre enunciado y código y el recuento de pruebas en el chip.

**Decisión:**

- **Un Worker nuevo por ejecución** (`data/mock/code-runner/`, configurado con `ng generate web-worker`): ninguna ejecución ve lo que dejó la anterior, y terminarlo corta un bucle infinito sin colgar la pestaña. El Worker solo recibe el código y las entradas, nunca los valores esperados: compara la página (`buildRunResult`), como hará `execute` (2.3). El servicio simulado guarda el código, fija `passed` o `tests_failed` y registra `run` con las pruebas falladas, ocultas incluidas (las necesita `isStuck()`).
- **El límite de 2 s empieza cuando el Worker avisa de que empieza** (`started`), no al crearlo: en un equipo lento, descargar el Worker no le quita tiempo al código. El Worker envía el resultado de cada prueba en cuanto acaba, así que las anteriores a un bucle infinito conservan el suyo.
- **Resultados honestos:**
  - se comparan como JSON con las claves ordenadas (`{a, b}` = `{b, a}`) y `undefined`, `NaN` e `±Infinity` solo son iguales a sí mismos; el valor obtenido los conserva, porque son los errores típicos de principiante (`let total;` da `NaN`) y el alumno debe verlos tal cual;
  - si el código no carga (error de sintaxis o fuera de la función) o no tiene la función del ejercicio, `RunResult.loadError` lo dice una vez, en lugar del mismo fallo repetido en cada prueba;
  - tras un tiempo agotado, solo la primera prueba sin resultado sale como «Tiempo agotado»: las siguientes no llegaron a empezar y salen como «Sin ejecutar»;
  - las comprobaciones ocultas solo dicen si se superan, sin el mensaje de error.
- **`AttemptStore`:** `run()` cancela el autoguardado y espera al guardado en curso antes de enviar el código; lo escrito durante la ejecución deja el intento en `in_progress`; un fallo queda en `actionError` con su reintento y vuelve a programar el guardado; `submit()` solo desde `passed`. Las respuestas tardías de otro ejercicio se ignoran. Los resultados no se guardan: tras recargar, la zona invita a ejecutar.
- **UX de la zona de código:**
  - «Ejecutar pruebas» y «Entregar» con `disabledInteractive`: un botón que se deshabilita conserva el foco y su tooltip explica por qué; «Entregar» pasa a botón principal cuando el intento está superado;
  - Ctrl + Intro (o ⌘ + Intro) ejecuta desde el editor, con prioridad sobre el atajo de CodeMirror que insertaba una línea;
  - la entrega pide confirmación en un diálogo («Seguir revisando» tiene el foco) y después el foco va a la nota «Entregado el …», con «Volver a los ejercicios» (WCAG 2.4.3);
  - una región `aria-live` anuncia el resumen de cada ejecución, porque los resultados aparecen lejos del botón;
  - el chip de estado añade «· 3/5» tras ejecutar (`testCount`), como el contador de la figura 17, y en el móvil se ve también desde las pestañas «Ejercicio» y «Tutor».
- **Separador entre enunciado y código** (`shared/splitter/`, patrón _window splitter_ de ARIA): se arrastra con ratón, dedo o lápiz y se mueve con las flechas, Inicio y Fin; doble clic vuelve al 45 %. El reparto (15–70 %) se recuerda por usuario en `localStorage`, como comodidad. No aparece con el enunciado plegado ni en el móvil, donde cada zona es una pestaña. Ni Material ni el CDK traen uno.
- **El explorador `/dev/datos`** ejecuta con el runner de verdad la solución o el error típico de cada ejercicio del seed, en lugar de marcar el intento como superado o con fallos.

**Alternativas:** un Worker reutilizado (más rápido, pero arrastra estado y un bucle infinito obliga a recrearlo igualmente); comparar dentro del Worker (el código del alumno podría alterar `JSON.stringify`); dejar `NaN` como `null`, como haría JSON (el alumno vería `null` sin entender por qué falla); `showProgress` de los botones de Material (texto «Ejecutando…» en su lugar, como pide §4.8); un separador de una librería externa (no hay ninguno en Angular Material y el propio cabe en un componente pequeño).

- **Más sitio para el código, sin ventanas encima** (iteraciones 1 y 2, a propuesta del autor): un botón «Ampliar el código» oculta el enunciado y le da su altura al código (a 1280 × 720, de unas 4 líneas a ocupar casi toda la columna), y los resultados se pliegan a su resumen como un acordeón y se despliegan solos con cada ejecución (`linkedSignal` del resultado, sin `effect()`). El tutor sigue a la vista: ocultarlo solo daba anchura, que al código no le falta, y el alumno dejaría de ver al tutor justo cuando interviene por su cuenta (6.2). La columna del tutor no se estrecha, porque las pistas se leerían peor. No es un modal: un modal obligaría a un segundo CodeMirror sincronizado con el primero (justo lo que evita D-029) y taparía el código mientras se leen los resultados. Ni el estado ampliado ni el plegado se recuerdan. La mascota flotante como forma compacta del tutor y un separador vertical entre código y tutor se valoran en el 1.7, con el chat hecho.

**Consecuencias:** cambian §4.2 (`RunResult.loadError`), §4.3 (explorador y runner) y el paso 1.5 del plan. El 2.3 tiene que hacer lo mismo en el servidor: transportar `undefined`, `NaN` e `±Infinity` en el JSON, informar de `loadError`, escribir el resultado de cada prueba en cuanto acaba y comparar con las claves ordenadas (anotado en `PENDIENTES.md`).

**Aprobación:** el autor, que pidió revisar el paso, aplicar las mejoras propuestas y hacer el separador en este paso.

## D-031 · Señales del navegador: lotes, ausencias con duración y cerrar sesión sin perder nada (08/11/2026)

**Contexto:** el paso 1.6 añade el `EventLogger` y los eventos que solo conoce el navegador (§2.8). Al revisarlo aparecieron huecos: cerrar sesión borraba la sesión antes de enviar lo pendiente (también el código de los últimos 800 ms, un fallo del 1.4); el plan hablaba de «cambios de pestaña» y la memoria (RF-20) de «cambios de ventana»; pulsar la barra de direcciones o abrir las herramientas de desarrollo quita el foco un instante y llenaría de ruido el panel docente; copiar una línea del propio código contaba como pegado; y el recuento de salidas no decía nada de cuánto duraban.

**Decisión:**

- **`EventLogger` en `core/`** (`@Service()`): una cola que envía cuando pasan 5 s desde el primer evento, en cuanto hay 20, al ocultar la pestaña y antes de cerrar sesión. Un solo envío a la vez. Si falla por la red o por exceso de peticiones, el lote vuelve al principio de la cola y se reintenta a los 5 s; con cualquier otro error se descarta, porque reintentar no lo arreglaría.
- **Cerrar sesión sin perder nada:** `AuthStore.beforeSignOut(task)` registra trabajo que necesita la sesión, y `signOut()` lo espera antes de borrarla, aunque falle. Lo usan el `EventLogger` y `AttemptStore` (el guardado pendiente); cada uno lo quita con su `DestroyRef`. Así `AuthStore` no depende de ninguno de los dos.
- **Ausencias de la ventana,** no solo de la pestaña: `blur` y `focus` de la ventana cubren otra pestaña y otra aplicación (RF-20). Una ausencia solo se registra si dura 2 s o más (`MIN_AWAY_MS`) o si la pestaña se oculta, que se registra y se envía al momento porque la página puede no volver. `focus_lost` lleva la hora en que salió y `focus_gained`, el tiempo fuera (`detail.awayMs`). Una vuelta sin salida registrada (una página abierta en segundo plano) no se registra. Volver a mostrar la pestaña con el foco también cuenta como vuelta: hay navegadores que no disparan `focus` al cambiar de pestaña.
- **`BrowserSignals`** (`student/workspace/`, provisto en la ruta junto a `AttemptStore`): decide qué se registra y solo para el intento abierto y sin entregar. La pantalla le pasa los eventos de la ventana y del editor.
- **Pegados de fuera del código:** el editor no avisa de un pegado cuyo texto ya estaba en el código (duplicar una línea propia).
- **Barra de desarrollo:** la hora con segundos y «Sale de la ventana» / «Vuelve tras 1 min 20 s».

**Alternativas:**

- Registrar `focus_lost` al momento, sin umbral: más simple, pero cada clic en la barra de direcciones sería una «pérdida de foco» para el docente.
- Solo `visibilitychange`: no ve al alumno que tiene otra aplicación o ventana delante sin ocultar la pestaña, que es justo lo que pide RF-20.
- Que `AuthStore` inyecte el `EventLogger` y el `AttemptStore`: acopla la sesión a piezas de pantalla, y el store de la ruta no existe fuera de ella.
- Marcar los pegados internos (`detail.internal`) en lugar de no registrarlos: el docente solo necesita lo que viene de fuera.

**Consecuencias:** cambian §2.2, §2.8 y el paso 1.6 del plan, el tipo `ProcessEvent`, las fixtures y `seed.sql` (versión 3 del seed: los datos simulados guardados en el navegador se reinician). Una vuelta muy rápida tras ocultar la pestaña llega con un `awayMs` pequeño: el panel docente (4.1) puede ignorar las ausencias de menos de 2 s con ese dato. Con Supabase, el envío al ocultar la pestaña necesita `fetch` con `keepalive` (2.2).

**Aprobación:** el autor, que aprobó el plan corregido del paso.

## D-032 · La aplicación completa en la PEC3 (09/11/2026)

**Contexto:** el plan llevaba a la PEC3 solo la capa 1 con back-end real (`v0.3-beta`) y dejaba el panel docente, la administración, la voz, el tutor proactivo y el cierre para la PEC4. El enunciado de la PEC3 pide una beta que «no tiene por qué tener todas las funcionalidades terminadas», pero es la entrega en la que se valora el grueso del producto. La PEC4, en cambio, carga mucho trabajo que no es programar: la memoria final, una presentación escrita-visual, un vídeo de defensa de unos 20 minutos (15 de presentación y 5 de demostración en directo, sin cortes y con el estudiante en cámara) y el autoinforme de competencias. Entre el 6 y el 8 de noviembre se cerraron la fase 0 y los pasos 1.1–1.6, con horas reales parecidas a las estimadas.

**Decisión:**

- **El bloque A llega hasta el 7.2:** fases 0, 1 y 2; 3.1 (beta pública); fases 4 y 5; 6.1 y 6.2; 7.1 y 7.2; y, al final, 3.2 (entrega de la PEC3), con la etiqueta `v0.9`.
- **El bloque B (PEC4)** son el 6.3, el 7.3 y el 7.4, el feedback del consultor y lo que se recorte del bloque A.
- **Orden de recorte** si falta tiempo: 6.3 y 7.3, 6.2 (capa 4), 6.1 (capa 3) y 5.3. Lo recortado se justifica en la memoria y en el checklist.
- **Beta pública temprana:** el 3.1 se hace en cuanto el núcleo funciona con back-end real, y cada fase posterior se despliega en ella.
- **Un solo guion de demo** para el vídeo de la PEC3 y los 5 minutos en directo de la PEC4: un caso de uso de principio a fin.
- **La numeración de los pasos no cambia,** para no romper las referencias de la bitácora y del registro.

**Alternativas:**

- Mantener el plan: la PEC3 llegaría con media aplicación y diciembre tendría que repartirse entre programar la otra mitad y preparar la defensa.
- Renumerar los pasos según el nuevo orden: más limpio de leer, pero rompe los enlaces de `REGISTRO.md`, de la bitácora y de las fichas.

**Consecuencias:** cambian la sección 1 (hitos y reparto por semanas), el principio del bloque A, los pasos 3.2 y 7.4 y la tabla de riesgos del plan, que pasa a la v4.4. Quedan unas 90 h hasta la PEC3, unas 22 h por semana, con el desarrollo terminado hacia el 2 de diciembre. La memoria tiene que recoger el cambio de planificación en el seguimiento.

**Aprobación:** el autor, que fijó el objetivo de tener la aplicación terminada para la PEC3.

## D-033 · Chat del tutor: zonas propias, conversación del intento y mascota que escucha (09/11/2026)

**Contexto:** el paso 1.7 llena la zona del tutor de la pantalla de trabajo. Al revisarlo aparecieron desfases y huecos:

- el plan hablaba de un botón con la mascota que abre y cierra el chat, pero desde D-028 y D-030 el tutor tiene una columna propia siempre a la vista;
- `TutorService` solo sabe preguntar, así que al recargar la conversación se perdería y el nivel de pista volvería a cero;
- si cada trozo de la respuesta se anunciara con `aria-live`, el lector de pantalla leería frases a medias;
- el tutor contestaría siempre en español aunque la interfaz esté en inglés o catalán;
- `WorkspacePage` tenía ya 298 líneas y 409 de plantilla, y el catálogo descargaba la pantalla de trabajo;
- la columna del tutor estrechaba el código en la tableta sin que el alumno pudiera cambiarlo (D-030).

**Decisión:**

- **Pantalla partida en zonas:** `statement-zone/`, `code-zone/` (con sus resultados, indicador de guardado, diálogo y mensajes) y `tutor/`, como componentes con `input()` y `model()`. La página se queda con la cabecera, la disposición, los separadores y los eventos de la ventana.
- **Ruta perezosa:** la pantalla de trabajo se carga con `loadChildren` (`workspace.routes.ts`), con sus stores (`AttemptStore`, `TutorStore` y `BrowserSignals`) dentro.
- **`TutorStore`** (`@Service({ autoProvided: false })`):
  - carga la conversación con `resource()` desde `AttemptService.history()`, que ya existía y deja al alumno leer sus intentos, en lugar de añadir una operación nueva;
  - añade los turnos nuevos con `linkedSignal`, así que cada intento empieza desde su propio historial;
  - envía cada pregunta o pista con el código del editor y lee la respuesta con `for await`;
  - si la respuesta falla a mitad, descarta lo llegado y guarda la pregunta para reintentar;
  - ignora las respuestas tardías de otro ejercicio;
  - el nivel es el más alto de las pistas del intento: lo decide el servidor (2.6);
  - anuncia cada respuesta una sola vez, cuando está completa.
- **`language` en `TutorRequest`:** el idioma de la interfaz viaja en cada petición, para que el tutor real (2.4) conteste en ese idioma. El simulado lo ignora: sus textos son datos del servidor, en español.
- **Tutor simulado:** una función pura (`scriptedAnswer`) elige la respuesta por tipo y nivel con los textos de las fixtures, ahora compartidos (`tutor-script.ts`). Detecta las peticiones de la solución en los tres idiomas (elusión, 2.9) y da respuestas propias para el código vacío, el enunciado y el intento superado. `MockTutorService` registra la interacción y los eventos `hint_requested` y `proactive_intervention`, aplica las reglas de acceso y escribe la respuesta en trozos de tres palabras cada 40 ms.
- **La mascota escucha:**
  - va en la cabecera del panel, o en grande en la bienvenida, en lugar de en un botón;
  - saca la lengua mientras el alumno escribe y la recoge al salir del campo;
  - inclina la cabeza mientras el tutor responde;
  - no acompaña a cada burbuja: una columna de perros animados distrae.
- **Panel del chat:**
  - burbujas propias con su hora, y etiquetas «Pista · nivel N» y «El tutor se acerca»;
  - días separados («Hoy» o la fecha);
  - el nivel de pista con tres escalones y su nombre;
  - «Pedir pista» dice lo que dará y pasa a «Otra pista» en el nivel 3;
  - tres puntos mientras se espera y un cursor mientras llega el texto;
  - preguntas sugeridas según el estado del intento;
  - en un intento entregado, la conversación queda en solo lectura;
  - se desplaza abajo solo con CSS (`flex-col-reverse`).
- **Campo de pregunta:** Signal Forms con `submission`; Intro envía y Mayús + Intro hace salto de línea. El campo se vacía con `reset()` al enviar, como en la guía de Angular. El límite de 500 caracteres llega al campo como `maxlength` y un contador aparece desde los 400.
- **Móvil:** la pestaña «Tutor» muestra un punto («Tutor, respuesta nueva») si llega una respuesta mientras el alumno mira otra pestaña.
- **Separador vertical** entre el código y el tutor (`app-splitter` con `orientation="vertical"`):
  - el código ocupa del 50 al 80 % (70 % al empezar) y se recuerda por usuario;
  - la columna del tutor nunca baja de 16rem.
- **Mascota flotante** (iteración 1, a petición del autor): Claude la había descartado en la propuesta, porque taparía el código mientras se lee la pista y D-030 quería al tutor a la vista. El autor quiso verla y pidió poder cambiar de un modo a otro y un botón para minimizarla. Se queda así:
  - un botón en la cabecera del tutor lo pasa de la columna a la mascota flotante («Hacer flotante el tutor») y de vuelta («Fijar el tutor a la derecha»); la elección se recuerda por usuario (`tutoria.tutor-floating`) y fijarlo devuelve también la vista normal si el código estaba ampliado;
  - es siempre flotante con el código ampliado y en la tableta (de 768 a 1023 px), donde la columna estrechaba demasiado el código; en el móvil sigue la pestaña;
  - la mascota abre el panel sobre la esquina del código con el foco en la pregunta, y saca la lengua mientras está abierto (el «abrir y cerrar» del plan original); «Minimizar el tutor», la propia mascota o Esc lo pliegan y devuelven el foco a la mascota;
  - plegado, una respuesta nueva asoma en un bocadillo junto a la mascota, con un punto, y se lee en voz alta con una región `aria-live` propia, porque la del panel no está en la página; el bocadillo abre el tutor. Así se cumple lo que pedía D-030: el alumno ve al tutor cuando interviene.

**Alternativas:**

- Una operación `TutorService.conversation()`: más explícita, pero duplica lo que ya da `history()`, y la tabla de servicios (§4.2) ya preveía el historial del intento.
- Un `effect()` que baje el desplazamiento al último mensaje: `flex-col-reverse` lo hace sin código y sin romper la regla de no usar `effect()` fuera de las APIs imperativas.
- Un `aria-live` en la lista de mensajes (`role="log"`): anunciaría cada trozo mientras llega.
- La mascota en cada burbuja del tutor: más cálida, pero recarga la columna.
- Solo la columna fija (la propuesta inicial): más simple, pero en la tableta el código quedaba en unos 450 px, y hay alumnos que prefieren el ancho completo y llamar al tutor cuando lo necesitan.
- Un panel flotante arrastrable o redimensionable: mucha complejidad y difícil de manejar con el teclado, para poca ganancia.

**Consecuencias:**

- En el plan cambian §2.6 (`language` en la petición), §4.1 (carpetas de la pantalla de trabajo y `tutor-chat.css`) y el paso 1.7.
- Cambian las fichas 03 y 04.
- La Edge Function `tutor` (2.4) tiene que responder en el idioma de la petición.
- Reintentar una pista que falló después de que el servidor la registrara subiría el nivel dos veces; se resolverá con la respuesta real (2.4).
- Las reacciones (1.8) leerán la emoción de los turnos del store.
- El tutor proactivo (6.2) usará el bocadillo de la mascota cuando el tutor esté plegado.

**Aprobación:** el autor, que aprobó el plan con todas las mejoras propuestas y la iteración 1.

## D-034 · Catálogo: sesiones con título, «entregado» frente a «superado» y por dónde seguir (09/11/2026)

**Contexto:** el autor consideraba el catálogo poco vistoso y preguntó si «Sesión 1» podía ser cualquier texto, como «Tema 1: Bucles». La sesión era solo un número en `exercise_assignment.session`. Además, el catálogo plegaba al llegar las sesiones superadas enteras, de modo que Lucía, con el último ejercicio superado pero sin entregar, veía «8/8 superados» y cuatro sesiones plegadas: la pantalla invitaba a irse sin entregar (anotado en `PENDIENTES.md` desde el 1.6). Antes de reentregar la PEC2 con el código, el catálogo tenía que lucir.

**Decisión:**

- **Tabla `class_session`** (id, group_id, number, title opcional; única por grupo y número). `exercise_assignment` sigue guardando el número de la sesión y apunta a ella con una clave ajena compuesta `(group_id, session)` → `class_session (group_id, number)`. El modelo pasa a 11 entidades. El catálogo muestra «Sesión 2» en pequeño encima del título («Vectores») y, si la sesión no tiene título, solo «Sesión 2».
- `AssignedExercise` añade `sessionTitle` (el título o `null`) y `updatedAt` (cuándo cambió el último intento, o `null` sin intento). El servidor ya tenía los dos datos.
- **«Entregado» manda en el plegado:** al llegar, solo se pliegan las sesiones entregadas enteras. «Superados» sigue contando superados y entregados (D-027), pero el resumen y el ejercicio avisan de lo que está «listo para entregar».
- **Por dónde seguir:** una tarjeta destacada con el intento abierto (en curso, con fallos o superado sin entregar) que cambió el último, «Continúa donde lo dejaste»; sin ninguno abierto, el primero sin empezar, «Tu siguiente ejercicio»; con todo entregado, la enhorabuena con la mascota. Lo decide `nextExercise()`, una función pura en `catalog-sessions.ts`, con `countByStatus()` para los contadores.
- **Aspecto:** cada sesión es una superficie propia con un punto por ejercicio del color de su estado, y los ejercicios son filas separadas por líneas con un círculo (número o ✓) del color de su estado. El color siempre se repite con texto (chip de estado) y los adornos van con `aria-hidden`.
- **Pantalla de trabajo, de paso:** el panel del enunciado es un contenedor (`@container` de Tailwind) y, desde 896 px de panel, pone los ejemplos a la derecha del texto, que no pasa de su ancho de lectura. Depende del ancho del panel y no de la ventana, porque el mismo ancho de ventana da paneles muy distintos con el tutor fijo o flotante.

**Alternativas:**

- Un título por fila en `exercise_assignment`: sin tabla nueva, pero la misma sesión tiene varias filas y cada una podría llevar un título distinto.
- Cambiar `exercise_assignment.session` por un `session_id`: más normalizado, pero obliga a crear la sesión antes de asignar y cambia más código y fixtures; con la clave compuesta, el número sigue sirviendo para ordenar.
- La fecha de cada clase en `class_session`: la usaría el histórico (4.4), pero hoy nadie la necesita; las fixtures ya la tienen en `activity.ts` si hace falta.
- Toda la fila del ejercicio como enlace (patrón de enlace extendido con `::after`): los botones de Material tienen `position: relative`, así que solo se podría cambiando sus estilos desde fuera, contra las reglas de 4.8.
- Filtros «Pendientes / Todos» y «Desplegar todo»: con 8 ejercicios no compensan.

**Consecuencias:**

- Cambian §1, §2.2, §2.3 y el paso 4.3 del plan, se añade el paso 1.2b y cambian las fichas 02 y 03.
- El seed pasa a la versión 4 y `supabase/seed.sql` incluye `class_session` (6 sesiones, una sin título).
- El esquema (2.1) crea `class_session` con su RLS (el alumno lee las de sus grupos y el docente gestiona las suyas), y `listAssigned` de Supabase (2.2) devuelve el título y `updated_at`.
- El editor de asignaciones (4.3) crea la sesión al asignar a una nueva y edita su título.

**Aprobación:** el autor, que lo dio por cerrado tras ver la demo.

## D-035 · Reacciones flotantes: al llegar la respuesta, tres niveles, paleta viva y la mascota con ellas (09/11/2026)

**Contexto:** el paso 1.8 añade las reacciones afectivas del tutor (RF-10, capa 4 de la memoria). El plan pedía un overlay que leyera el evento `meta`, una animación de 2 a 3 segundos en una posición variable, poder desactivarlas y respetar `prefers-reduced-motion`. Al contrastarlo con la memoria salieron tres huecos:

- RF-10 y el flujo 4a de CU-03 piden poder **reducirlas o** desactivarlas, no solo desactivarlas;
- el `meta` llega antes del texto, así que reaccionar a él haría reaccionar también a una respuesta que falla a mitad o a una intervención que el tutor decide callar (`silent`, 2.7);
- `SettingsStore`, donde vive ese ajuste, era del paso 1.9.

Al ver la primera versión, con los colores del tema, el autor pidió reacciones más grandes y exageradas, con colores mucho más vistosos y más variedad de iconos.

**Decisión:**

- **Cuándo:** `TutorStore.reaction` da la emoción y la intensidad de la última respuesta nueva cuando llega completa. Las respuestas del historial, las que fallan y las silenciosas no reaccionan. Cada reacción lleva el id de su turno, así que la misma emoción dos veces se vuelve a lanzar.
- **Componente:** `<app-reaction-overlay>` en `shared/reactions/`, que recibe la reacción, el modo y la zona como entradas y no sabe nada del alumno; así el muestrario usa el componente real.
  - Es una capa fija con `aria-hidden`, sin capturar el puntero y con `data-testid` para los tests (4.8). Ocupa el lado del tutor (hasta 40rem) o todo el ancho en el móvil.
  - Una función pura, `reactionParticles()`, decide las piezas con un generador de azar inyectado, y se probó con TDD.
  - Cada pieza es un elemento nuevo con su sitio y su recorrido en variables CSS (`--x`, `--drift`, `--spin`, `--size`, `--delay`, `--duration`), así que la animación arranca sola al insertarse. Las animaciones van en el parcial `reactions.css` junto al componente (D-022).
  - La pieza que termina la última limpia la capa con su `animationend`.
  - Sin `effect()`: un `linkedSignal` sobre la reacción, que no repite la que ya estaba al crearse el componente.
- **Aspecto:**
  - un icono protagonista enorme en el centro, con rebote y bamboleo, y el resto alrededor; cada emoción tiene su movimiento (subir balanceándose, estallar con sacudida, subir a saltos o explotar desde un punto) y de 6 a 7 iconos;
  - los iconos son de Material Symbols, autoalojados y rellenos, y no emojis, que cambian entre sistemas;
  - colores de una paleta viva propia de 8 tonos, `--app-reaction-*` en `theme.scss` y `bg-reaction-*` / `text-reaction-*` en Tailwind, igual en claro y en oscuro, con un brillo de su color;
  - confeti en tres formas, siempre al celebrar y en las intensidades 2 y 3 de las demás emociones;
  - la intensidad da 5, 9 o 14 iconos, cada vez más grandes.
- **Tres niveles,** guardados por usuario en un `SettingsStore` mínimo (`student/settings/`) que el 1.9 amplía:
  - completas;
  - reducidas: un solo icono pequeño;
  - desactivadas: nada, tampoco la mascota.
- **Movimiento reducido:** con `prefers-reduced-motion`, que se lee con `MediaMatcher` del CDK en cada reacción, un solo icono aparece y se desvanece sin moverse. Así el alumno no pierde el gesto y no hay desplazamiento.
- **La mascota se une:** la de la cabecera del tutor y la flotante ladean la cabeza (alegría), menean las orejas (sorpresa), saltan (ánimo) o dan dos saltos (celebración, con una animación propia, `mascot-cheer`).
- **De paso, en el muestrario:** el editor de código ensanchaba su columna hasta la línea más larga y desplazaba la página de lado en el móvil. El componente lleva ahora `contain-inline-size`, así que ninguna pantalla puede volver a desplazarse por él. Se retiró el panel desplegable «Tutor» del muestrario, un resto del 0.3 con un texto ya falso que la app no usa, y su ajuste en `theme.scss`.

**Alternativas:**

- Reaccionar al llegar el `meta`, como decía el plan: antes, pero reaccionaría a respuestas que nunca se ven.
- Emojis del sistema, como dice la memoria: cambian entre el Mac, Windows y Linux, y en algunos equipos no se ven.
- Los colores del tema (primary, tertiary, warning…): cumplen la regla de los tokens, pero están pensados para el texto y se veían apagados.
- Un `effect()` o la Web Animations API para lanzar cada reacción: código imperativo que no hace falta, porque los elementos nuevos ya arrancan su animación CSS.
- Quitar la reacción con movimiento reducido: se perdería el gesto; un fundido sin desplazamiento es aceptable.
- Un ajuste rápido en la cabecera del tutor: más botones en una cabecera que ya tiene dos; el sitio del ajuste es la pantalla de ajustes (1.9).

**Consecuencias:**

- Cambian el paso 1.8 (y el 1.9, que añade el ajuste a su pantalla), §4.1 y §4.8 del plan, y las fichas 03 y 04.
- `TutorTurn` guarda la intensidad. La mascota acepta `reaction`.
- El tutor proactivo (6.2) solo tiene que dar respuestas con emoción para reaccionar.
- Una comprobación e2e de «ninguna pantalla se desplaza de lado a 375 px» queda en `E2E-PENDIENTES.md`.

**Aprobación:** el autor aprobó el plan con las tres mejoras, pidió las reacciones más vistosas, señaló el desplazamiento lateral y el panel «Tutor» del muestrario, y dio el paso por cerrado.

## D-036 · Reacciones: un catálogo de recetas declarativas, separado de la emoción (09/11/2026)

**Contexto:** tras cerrar el 1.8 (D-035), el autor revisó las reacciones en su navegador y pidió más:

- un efecto raro con una sola reacción y al pedir pistas seguidas: la nueva cortaba la anterior;
- un icono grande que lata en el centro de la pantalla y más cosas alrededor;
- muchas reacciones distintas, que la IA pudiera, por ejemplo, lanzarle una piedra al alumno;
- que fuera fácil añadir expresiones en el futuro;
- risas y enfado.

Preguntó también si la IA podría componer las animaciones (iconos, si late o se lanza) o si convenía tenerlas configuradas en el back.

**Decisión:**

- **Emoción y reacción por separado:**
  - la emoción (alegría, sorpresa, ánimo, celebración) sigue siendo el dato que se guarda y que analiza el docente;
  - la reacción (`ReactionKind`, catálogo `REACTION_KINDS` en `data/tutor.ts`) es solo cómo se ve: el evento `meta` la lleva como campo opcional, y sin ella vale la de la emoción (`EMOTION_REACTIONS`);
  - el modelo la elige del catálogo y el servidor descarta la que no exista (§2.6).
- **Recetas declarativas, no código:** cada reacción es una receta (`REACTION_RECIPES`) con su icono, sus colores y una lista de bloques con parámetros:
  - los bloques son `hero` (que late, parpadea, tiembla, se ríe, echa humo o revienta), `glow` (halo y ondas al compás del latido), `crown`, `rain`, `flames`, `flight`, `paper-ball`, `eyes`, `applause`, `steam` y `blast`;
  - una parte puede limitarse a unas intensidades (`minIntensity`, `maxIntensity`);
  - añadir una expresión es su nombre en el catálogo y su receta, y TypeScript avisa si falta alguna; un movimiento nuevo es además su bloque y su fichero de CSS;
  - como son datos, se podrán llevar al back y editar desde la administración.
- **Doce reacciones:** corazones, ánimo, trofeo, bombilla, cohete, fuego, aplausos, mente explotando, bola de papel, ojos vigilantes, risas y enfado de broma.
  - En vez de la piedra, una bola de papel de cuaderno que agrieta la pantalla: la misma broma, sin agresividad.
  - El enfado es de broma (una cara que echa humo) y en la intensidad 3 la cara revienta con un fogonazo y la pantalla se oscurece. Nunca ante un error: el prompt lo dice.
- **En pantalla:**
  - la capa cubre toda la pantalla;
  - hasta tres reacciones a la vez, cada una hasta que acaba la suya;
  - la misma reacción no se repite aunque llegue como objeto nuevo: el `computed` del store compara por id y la capa recuerda la última (era el aviso NG0955 de claves duplicadas);
  - se animan solo transformaciones y opacidad, con filtros solo donde hacen falta.
- **Dibujos propios:** la bola de papel arrugado y los ojos de dibujo animado son SVG en componentes pequeños (`art/`), como la mascota. Con degradados CSS quedaban pobres.
- **CSS por bloque:** `reactions.css` es un índice que importa un fichero por bloque de `styles/`.
- **Paleta:** los tokens `--app-reaction-*` suman humo, papel, pauta, margen, blanco de ojo, tinta y cristal. Las claves del mapa de Sass van entre comillas: sin ellas, Sass las leía como colores.
- **Aplauso:** el icono `cheer` de Material Symbols, dos manos aplaudiendo.

**Alternativas:**

- Que la IA componga cada reacción (iconos, movimientos): más libre, pero inventaría iconos inexistentes o combinaciones fuera de tono, gastaría tokens y sería difícil de validar. Elegir un nombre de un catálogo cerrado sí se valida.
- Recetas en el back desde ya: no hay back hasta la fase 2; las recetas ya son datos y se podrán mover.
- Ampliar la lista de emociones: mezclaría el dato pedagógico con la estética.
- Los aros de color con borde grueso: parecían una diana sobre el icono. Se rehicieron como halo y ondas difuminadas, por detrás.
- Una pared de fuego con degradados CSS y aplausos con anillos: el autor prefirió las versiones con iconos.
- Mover o romper la interfaz real en la explosión: desorienta y el alumno puede perder dónde escribía; todo pasa en la capa.
- El emoji 👏 del sistema: cambia entre Mac y Windows y no toma la paleta.
- Paquetes de npm con emojis de Fluent (`@fluentui-emoji/angular` y otros): no son de Microsoft, y los oficiales no están en npm.

**Consecuencias:**

- Cambian §2.6 (tipo `meta`, JSON del modelo, prompt y validación), §4.1 y el paso 1.8 del plan, y la ficha 04.
- El tutor real (2.4, 2.5) recibe el catálogo en el prompt y valida la reacción.
- `tutor_interaction` no guarda la reacción: el historial no reacciona.
- Siguiente iteración: los emojis animados oficiales de Microsoft (Fluent Emoji Animated, MIT) como icono central.

**Aprobación:** el autor pidió cada cambio, los revisó en su navegador y pidió hacer commit de lo actual antes de los emojis animados.

## D-037 · Reacciones: emojis oficiales de Fluent, 3D o planos, y reacciones de broma (09/11/2026)

**Contexto:** con el catálogo de recetas (D-036), el autor pidió que las reacciones lucieran más: emojis 3D en lugar de iconos planos, muchos y variados, animados si se podía, y bromas para cuando el alumno pide la solución. Pidió solo fuentes oficiales.

**Decisión:**

- **Fuente oficial:** los repositorios de Microsoft `fluentui-emoji-animated` (animados) y `fluentui-emoji` (estáticos 3D y planos), los dos MIT, con sus licencias junto a los ficheros. Microsoft no los publica en npm; los paquetes de npm son de terceros.
  - `npm run emojis` trae solo los que usan las recetas y deja en `public/reactions/`:
    - los animados, en WebP de 192 px (de unos 2 MB a entre 150 y 490 KB, unos 13 MB los 44);
    - en `mini/`, 28 estáticos 3D de 64 px para las piezas de alrededor;
    - en `flat/`, los planos en SVG (292 KB los 67).
  - Solo genera lo que falta y borra lo que sobra. Difumina el borde de cada fotograma, porque algunas animaciones se salen del lienzo.
  - Se apoya en `sharp` y `upng-js`, dependencias de desarrollo. La app nunca descarga nada de fuera.
- **Varios emojis por reacción, elegido por el id de la reacción:** nunca sale igual y, en cuanto el tutor la elige (su `meta`), se sabe cuál será.
- **Carga:**
  - el overlay descarga ese emoji mientras el tutor escribe (`TutorStore.upcomingReaction`);
  - los ligeros (miniaturas y bomba, o todos los planos) se precargan con prioridad baja dos segundos después de abrir la página;
  - las imágenes no son diferidas, porque una reacción no puede esperar.
- **3D o planos:** el ajuste «Emojis 3D», guardado por usuario en `SettingsStore`. Desactivado, los mismos emojis en plano 2D. Una pieza con emoji nunca muestra su icono de Material, que queda como respaldo.
  - Las piezas con emoji van sin la sombra ni el brillo del CSS: dibujaban un recuadro difuminado alrededor de la imagen.
- **Reacciones:** dieciocho.
  - Las nuevas son pensando, guiño, secreto, «¿en serio?», empatía y sueño.
  - Cambian de nombre: el trofeo pasa a ser fiesta (`party`) y la bola de papel, lanzamiento (`throw`).
  - El lanzamiento tira una pelota, un huevo, una tarta, un tomate o una caca, con un 💥 al chocar y una mancha que gotea (la pelota rebota sin manchar).
  - Se retiran los dibujos propios (bola de papel y ojos) y la grieta con sus esquirlas: al lado de los emojis quedaban pobres.
- **Bromas:** al pedir la solución, el tutor bromea por turnos (guiño, monos, «¿en serio?», lanzamiento y enfado). Son siempre bromas y nunca aparecen ante un error, para que no se lean como una falta de respeto al alumno: la receta lo dice y el prompt del tutor real lo dirá.
- **Quitados por no encajar:** 💘 y 😘 (lectura romántica en un tutor con alumnos menores) y la gráfica 📈. 🫠 pasa a «¿en serio?» y 😒 deja el enfado, porque no es enfado sino «¿me estás vacilando?».
- **Intensidad:** el muestrario abre en la 3 y el tutor simulado responde con la 3, para que se vea todo; el tutor real elegirá la suya.

**Alternativas:**

- Paquetes de npm (`@fluentui-emoji/angular`, `@lobehub/fluent-emoji` y otros): no son de Microsoft, y algunos no traen ni el 3D ni los animados.
- Emojis del sistema: cambian entre Mac y Windows y no toman la paleta.
- Noto Animated Emoji (Google, CC BY 4.0): oficial también, pero el autor prefirió Fluent.
- Precargar todos los animados: 13 MB por alumno nuevo.
- Iconos de Material sin emojis: son iconos de interfaz y no expresan emociones (un «guiño» que no guiña).
- Dejar que la IA componga las animaciones: ver D-036.

**Consecuencias:**

- `public/reactions/` pesa unos 13 MB en el repositorio.
- Las recetas llevan `use`, la frase que verá el prompt (2.5).
- La pantalla de ajustes (1.9) añade «Emojis 3D».
- **Fallos del script, ya corregidos:**
  - le pasaba al decodificador el bloque de memoria entero de un `Buffer`, y a veces leía restos del emoji anterior (un huevo salió bombilla);
  - una segunda pasada en paralelo tumbó la primera.

**Aprobación:** el autor pidió cada cambio y los revisó en su navegador; dio por bueno el conjunto y cerró el paso.

## D-038 · Ajustes que se aplican al momento, accesorios por inyección y aviso de datos en el shell (09/11/2026)

**Contexto:** el paso 1.9 construye los ajustes del alumno y la pantalla de datos registrados (RF-07), con su aviso la primera vez. Durante el paso, el autor pidió además un puntero de hueso mejor y que se pudiera quitar, y la pajarita puesta por defecto y algo más grande.

**Decisión:**

- **Sin formulario:** cada control de los ajustes aplica y guarda su cambio al momento, como los ajustes de un sistema operativo. No hay nada que enviar ni validar, así que no se usan Signal Forms (§4.6): los botones conmutadores y los interruptores de Material llaman directamente a `SettingsStore` o `ThemeService`.
- **`SettingsStore`** guarda por usuario las reacciones, los emojis 3D, la proactividad, los tres ajustes de la mascota (auriculares, pajarita y puntero de hueso) y si se vio el aviso, con una sola forma de leer y escribir cada clave (`settingKey`). El tema sigue en `ThemeService`, para todo el navegador, porque el acceso también lo usa.
- **Accesorios por inyección:** `MASCOT_ACCESSORIES` (en `shared/mascot/`) da los accesorios de las mascotas que no los reciben por `input()`. Lo provee la ruta del área del alumno con sus ajustes, así que todas sus mascotas (tutor, botón flotante, catálogo y vista previa) los siguen sin tocar cada página, y `shared/` no depende de `student/`.
- **Aviso de datos en el shell:** lo abre `StudentLayout` en cualquier página del área, no solo en el catálogo, para que un enlace directo a un ejercicio también lo muestre antes de trabajar (RGPD). No se cierra con Esc ni fuera: hay que elegir «Entendido» o «Ver los detalles». Abrir la pantalla de datos cuenta como visto.
- **Mascota (a petición del autor):** pajarita activada por defecto, un 25 % más grande y algo más baja para que la barbilla no tape el nudo; puntero de hueso de 24 px (antes 32), con el contorno dibujado bajo toda la silueta, sin líneas por dentro, y que se puede quitar en los ajustes (vuelve la mano).
- **La intensidad de las reacciones no es un ajuste:** la decide el tutor en cada respuesta; el alumno elige cuánto quiere ver (completas, reducidas o desactivadas).

**Alternativas:**

- Signal Forms con un modelo y un `effect()` que guarde: un efecto fuera de la frontera con APIs imperativas, que §4.8 no permite, para un formulario que no se envía.
- Pasar los accesorios como `input()` en cada uso de la mascota: seis sitios que recordar en cada pantalla nueva.
- Aviso solo en el catálogo, como decía el plan: un enlace directo a un ejercicio se lo saltaría.

**Consecuencias:**

- El tutor proactivo (6.2) tiene que leer `SettingsStore.proactive` y la voz (6.1), activar su interruptor.
- Que el alumno vio el aviso solo queda en su navegador; como prueba del consentimiento (RGPD art. 7.1) habría que guardarlo en el servidor (`PENDIENTES.md`).

**Aprobación:** el autor aprobó el plan del paso con sus propuestas y pidió los cambios de la mascota durante el paso; la forma técnica, por delegación del autor en el agente.

## D-039 · Tailwind primero y estilos globales repartidos en `src/styles/` (10/11/2026)

**Contexto:** al cerrar la fase 1, el autor pidió una revisión general de limpieza, `src/styles.css` lo más limpio posible y usar siempre Tailwind cuando sea viable, con CSS o SCSS como último recurso. `src/styles.css` mezclaba tokens, animaciones, base y utilidades, y el chat del tutor tenía su propio CSS.

**Decisión:**

- **Tailwind primero:** lo que Tailwind expresa sin ensuciar la plantilla se hace con sus clases, también las animaciones (`--animate-*` y `@keyframes` en `@theme`, con `motion-reduce:animate-none`). El chat del tutor y la entrada de las páginas pasan a clases y `tutor-chat.css` desaparece. La mascota y las reacciones siguen en CSS: combinan estados y partes de un SVG que en clases serían ilegibles.
- **`src/styles.css` solo importa:** Tailwind, `src/styles/` (`tokens.css`, `animations.css`, `base.css`, `utilities.css`) y los parciales de la mascota y las reacciones. `_theme-colors.scss` pasa a `src/styles/`; `src/theme.scss` sigue siendo el único sitio de Material.
- **Sin el explorador `/dev/datos`:** lo que hacía (ver lo que ve cada usuario, ejecutar y entregar, la regla de acceso) ya lo cubren el catálogo, la pantalla de trabajo y los tests. La barra de desarrollo conserva el cambio de usuario, la red simulada, el reinicio de los datos y los eventos.
- **`core/i18n/`** agrupa los cuatro ficheros del idioma de la interfaz (D-023).

**Alternativas:** dejar `src/styles.css` en un solo fichero, que crece con cada fase; pasar también la mascota y las reacciones a Tailwind, con plantillas llenas de variantes anidadas; mantener el explorador, unas 1.000 líneas con sus tests para lo que ya hacen las pantallas.

**Consecuencias:** cambian §4.1 y §4.8 de `docs/PLAN.md` y el bloque del proyecto en `CLAUDE.md`. Los tests que buscaban el cursor del chat por su clase usan `data-testid` (es decorativo y `aria-hidden`).

**Aprobación:** el autor, que delegó la decisión en el agente.

## D-040 · Supabase local: privilegios, transiciones del intento y aviso de datos (10/11/2026)

**Contexto:** el paso 2.1 crea el esquema, la RLS, el seed y los tests de pgTAP. El plan (§2.3 y §2.4) dice qué reglas hay, pero no cómo se hacen cumplir, y quedaban en `PENDIENTES.md` varias filas para este paso: la seguridad del intento y de `process_event` (1.6), `class_session` (1.2b), `exercise.kind` (1.4) y el aviso de datos en el servidor (1.9).

**Decisión:**

- **Cuatro migraciones por tema:** tablas, seguridad, transiciones del intento y alta de usuarios. El orden de los tipos y las tablas sigue §2.3.
- **Privilegios desde cero:** se revoca lo que Supabase concede por defecto a `anon` y `authenticated` (también para las tablas y funciones futuras) y se concede solo lo necesario. El visitante anónimo no lee nada. En `attempt`, el cliente solo actualiza `current_code`; en `app_user`, solo `privacy_notice_seen_at`; en `process_event`, solo inserta, y nunca `id` ni `received_at`. Lo demás de `app_user` (nombre, rol, estado) lo cambia la Edge Function `admin-users` con `service_role` (fase 5).
- **Funciones auxiliares `security definer`:** las cuatro del plan y cinco más que evitan repetir consultas en las políticas (`is_staff`, `teaches_student`, `is_assigned_to_me`, `can_read_attempt`, `can_record_event`). `current_app_role()` es null para un usuario desactivado, así que ninguna política le deja pasar, además del bloqueo de Supabase Auth.
- **Banco compartido:** cualquier docente o administrador crea, edita y borra ejercicios y pruebas, como en el servicio simulado. Los grupos y las matrículas los gestiona el administrador; las sesiones y las asignaciones, también el docente de cada grupo.
- **Transiciones:**
  - el trigger vuelve a `in_progress` solo si el código cambia de verdad y la misma actualización no fija el estado, porque `execute` guardará el código con su resultado;
  - el cambio de código se rechaza si el intento está `submitted`;
  - `open_attempt` crea el intento (único por alumno y ejercicio) o devuelve el que hay. Al alumno solo le deja abrir lo asignado; al docente, cualquier ejercicio, sin asignación;
  - `submit_attempt` congela el código y registra el evento `submit`.

  Los errores llevan `P0002` (será `not_found`) o `P0001` (será `invalid`) para el 2.2.

- **Aviso de datos:** solo `app_user.privacy_notice_seen_at`, que prueba que se informó al alumno. El registro de eventos forma parte de la función educativa (RGPD art. 6.1.e), no se basa en el consentimiento: no se ofrece retirarlo, porque quitaría al docente justo la señal de foco y pegado, que se lee de forma formativa (§2.8).
- **Seed:** crea primero las cuentas de `auth.users`, con su identidad de correo, la contraseña de prueba de las fixtures y las cuentas desactivadas bloqueadas hasta 2999; el trigger crea cada `app_user` y su inserción lo completa con `on conflict`, como preveía D-018. `updated_at` solo se mueve si la actualización no lo fija, para que el seed conserve las fechas de las fixtures.
- **Configuración local:** puertos 553xx en lugar de 543xx, para convivir con otros proyectos de Supabase del Mac; registro público desactivado en `[auth]`. En `[auth.email]` tiene que quedar activado, porque si no se desactiva también el inicio de sesión con correo.
- **Tipos generados:** `npm run db:types` escribe `src/app/data/supabase/database.types.ts` y lo formatea; se excluye del lint y de la cobertura porque lo genera el CLI (D-010).

**Alternativas:**

- Políticas sin funciones auxiliares, más largas y con riesgo de recursión entre tablas.
- Columnas de `app_user` editables con un trigger que vigile qué cambia, en lugar del permiso por columna.
- Crear el intento con un `insert` del cliente.
- Ofrecer la retirada del consentimiento (`process_tracking_withdrawn_at`), que se llegó a escribir y se quitó tras la objeción del autor (se perdería la señal).
- Parar el otro proyecto de Supabase para usar los puertos por defecto.

**Consecuencias:**

- §2.3 de `docs/PLAN.md` añade `privacy_notice_seen_at`, `kind` y `received_at`, y `CLAUDE.md` añade los scripts `db:*`.
- El 2.2 tiene que traducir los SQLSTATE a `DataError` y usar `open_attempt` y `submit_attempt`.
- Una tabla nueva necesita sus permisos explícitos en su migración.
- En la nube, la contraseña de demostración no puede ser la del repositorio (`PENDIENTES.md`).

**Aprobación:** propuesta; el autor aprobó el plan del paso y objetó la retirada del consentimiento, que se quitó.

## D-041 · Servicios de Supabase, sesión y edición segura del código (10/11/2026)

**Contexto:** el paso 2.2 conecta las pantallas de la fase 1 con Supabase local. Al planearlo salió un choque: el plan quería la ejecución y el tutor simulados en `local`, pero los simulados leen la sesión y los intentos de MockDb, y el cliente no puede poner un intento en `passed`. Con datos reales aparecían además tres riesgos que con los simulados apenas existían: la sesión caduca de verdad, la red se corta y dos pestañas con el mismo ejercicio se pisan el código.

**Decisión:**

- **Cliente único detrás de un token:** `createClient()` de `@supabase/supabase-js` una sola vez, en `provideSupabaseData(config)`, y los servicios lo reciben con `inject(SUPABASE_CLIENT)`. En los tests se usa el cliente real con un `fetch` que hace de servidor (`supabase-testing.ts`), así se prueban las consultas que de verdad se envían, sin dobles de la cadena de PostgREST.
- **Errores:** `toDataError()` traduce los códigos de Postgres, PostgREST y Auth (`P0002`, `PGRST116`, `22P02` → `not_found`; `P0001` y las violaciones de restricciones → `invalid`; `42501` → `forbidden`; `invalid_credentials`, `user_banned`… → `unauthorized`) y, sin código conocido, el estado HTTP (0 → `network`; 502–504 → `unavailable`). `DataErrorKind` gana `unavailable`: el servicio no responde o no existe todavía.
- **Ejecución y tutor en `local`:** `UnavailableCodeRunnerService` y `UnavailableTutorService` lanzan `unavailable` hasta el 2.3 y el 2.4, y las pantallas dicen «no está disponible ahora mismo». El resto de la fase 1 funciona igual contra Supabase.
- **Catálogo en dos peticiones en paralelo:** las asignaciones de los grupos del alumno con su ejercicio y el título de su sesión (filtro sobre `class_group!inner(enrollment!inner(user_id))`), y sus intentos con las pistas (`tutor_interaction`). El número de pruebas ocultas llega con la función nueva `hidden_test_count()`, porque la RLS no deja leerlas.
- **Los métodos del docente** que solo leen, borran o asignan funcionan ya. Crear y editar ejercicios devuelve `unavailable` hasta el 4.3: escribir el ejercicio y reemplazar sus pruebas tiene que ser atómico, con una función de la base de datos.
- **Escrituras con la pestaña oculta:** el `fetch` del cliente añade `keepalive` a las escrituras mientras la página está oculta, para que el último lote de eventos y el último guardado lleguen aunque se cierre la pestaña (D-031). Solo entonces, porque el navegador limita lo que pueden llevar esas peticiones.
- **Sesión:** `AuthService` gana `watchSession()`. Si la sesión termina fuera de la página (otra pestaña cierra sesión o caduca sin renovarse), `AuthStore` lleva al login con la vuelta a la misma página; si entra otro usuario, recarga. Con `unauthorized`, los errores ofrecen «Volver a entrar» en lugar de «Reintentar». El login explica por qué se llega a él sin haber cerrado sesión (`AuthStore.sessionEnd`), con un aviso fijo y no con un toast: en la parte del alumno cada aviso sale junto a su acción y se queda; los snackbars se reservan para el docente y el administrador, con «Deshacer». Cerrar sesión solo cierra este dispositivo (`scope: 'local'`).
- **Borrador local del código:** lo que el editor tiene y el servidor no se guarda por intento en localStorage, junto con el código del servidor del que parte. Al abrir el ejercicio se recupera si el servidor no ha cambiado desde entonces, con el aviso «Hemos recuperado el código…», y se guarda.
- **Una pestaña edita cada intento:** con `BroadcastChannel`, la pestaña que abre un intento lo toma, y las demás guardan al momento lo que tenían y pasan a solo lectura con «Seguir aquí», que vuelve a leer el intento y lo recupera.
- **Cuenta desactivada en el acceso:** Supabase Auth responde «User is banned» antes de comprobar la contraseña, también con una inventada, así que su API ya revela a cualquiera qué correos son de cuentas desactivadas. Ocultarlo en la pantalla no protegía nada y confundía al alumno: `user_banned` es `forbidden` y el acceso dice «Tu cuenta está desactivada. Si crees que es un error, habla con tu docente». La contraseña mal y el correo desconocido siguen compartiendo mensaje. El bloqueo de Auth se mantiene: sin él, una cuenta desactivada tendría sesión (vacía por la RLS) y cada Edge Function con `service_role` tendría que comprobar su estado. Cambia la decisión de D-021, a petición del autor.
- **Reacciones al ejecutar:** fiesta (`party`, intensidad 3) cuando pasan todas las pruebas; aplausos (`applause`, intensidad 1) si vuelven a pasar en la ejecución siguiente, para que la misma fiesta no canse; ánimo (`cheer`, intensidad 1) cuando pasan más que en la ejecución anterior de la visita; nada con fallos o con código que no carga. Es una función pura (`runReaction()`); `AttemptStore` la expone y la pantalla de trabajo la junta con la del tutor en un `linkedSignal`: gana la más reciente. A petición del autor.
- **Aviso de datos:** pasa de localStorage a `app_user.privacy_notice_seen_at`, en `AuthStore` (`privacyNoticeSeen`, `markPrivacyNoticeSeen()`); el aviso se cierra al momento y, si el servidor falla, vuelve a salir en la siguiente visita.
- **Configuración `local`:** `environment.local.ts` con la URL y la clave publicable de todo Supabase local, que es pública por diseño; `npm run start:local`. Lleva las cuentas de demostración del login y `/dev/ui`, no la barra de desarrollo, que actúa sobre MockDb.

**Alternativas:**

- Simular la ejecución en `local` con las pruebas visibles: «Entregar» fallaría igual, porque solo el servidor pone `passed`.
- Un servicio que cree el cliente en su constructor, como el tutorial de Angular de Supabase: no se puede sustituir en los tests.
- Dobles a mano de la cadena `from().select().eq()`: frágiles y no prueban la petición real.
- `keepalive` en todas las peticiones: el límite del navegador podría hacer fallar escrituras normales.
- Borrador con la fecha del servidor como referencia: tras ejecutar, el servidor cambia la fecha sin devolverla y se descartaría un borrador válido.
- Avisar de la otra pestaña sin bloquear: el último guardado seguiría ganando.

**Consecuencias:**

- §4.2 y §4.4 de `docs/PLAN.md` y `CLAUDE.md` (`start:local`) se actualizan.
- El 2.3 y el 2.4 sustituyen los dos servicios no disponibles en `provideSupabaseData()`, y el 4.3 añade la función que guarda un ejercicio con sus pruebas.
- Dos diferencias con el simulado, aceptadas: `listAssignments` de un grupo ajeno devuelve una lista vacía (la RLS lo oculta) en lugar de `forbidden`, y `process_event.detail` de un evento sin detalle queda como `NULL` de SQL (PostgREST no envía el `null` de JSON); los dos se leen igual en la aplicación.

**Aprobación:** el autor aprobó el plan con todas las mejoras propuestas (sesión caducada con borrador local, sesión entre pestañas, catálogo en una consulta, aviso en local y control de la pestaña activa).

## D-042 · Ejecución real con QuickJS dentro de la Edge Function (10/11/2026)

**Contexto:** el plan preveía, para el 2.3, una Edge Function `execute` que enviara el código a un Judge0 alojado con capa gratuita. Al planear el paso, el autor preguntó si había alternativas más libres. Las comparamos:

- los Judge0 o similares alojados (RapidAPI, Sulu, Piston, Wandbox, Glot, JDoodle…) tienen cuotas pequeñas o ninguna garantía, y algunos piden permiso a sus autores;
- montarlos en un servidor propio exige una máquina Linux siempre encendida, y en el Mac Judge0 no funciona en Docker (cgroups v1);
- ejecutar en el navegador no vale: el cliente no es de fiar y podría ponerse `passed`.

Además, cualquier servicio externo gratuito recibe el código del alumnado sin un acuerdo de tratamiento de datos, lo que choca con la minimización de §2.10.

**Decisión:**

- **QuickJS en WebAssembly** (`quickjs-emscripten-core` y su variante `singlefile` síncrona, 0.31.0) **dentro de la propia función**. Por dentro solo hay JavaScript puro: ni red, ni ficheros, ni temporizadores, ni `Deno`, ni los secretos.
- **Límites:**
  - 250 ms por prueba y 1 s por ejecución, con carga del código incluida, muy por debajo de los 2 s de CPU que da Supabase;
  - 32 MB de memoria y 256 KB de pila: con 512 KB se desborda la pila del propio Edge Runtime;
  - 100.000 caracteres para el valor devuelto y 50.000 para el código.
- **Cada ejecución, su runtime:** nada pasa de una a otra. Si falla el propio motor, se vuelve a cargar.
- **Bucle infinito por prueba:** se corta solo esa prueba y las siguientes siguen. En el simulado, un bucle infinito deja sin tiempo a las que faltan. Es mejor información para el alumnado, aceptada como diferencia hasta igualar el simulado (pendiente).
- **Mensajes como en el navegador:** el desbordamiento de pila se muestra como `RangeError: Maximum call stack size exceeded`. Los demás mensajes de QuickJS pueden diferir algo de los de V8 (por ejemplo, `'x' is not defined` frente a `x is not defined`). Aceptado.
- **Interfaz `CodeSandbox`** (`supabase/functions/execute/code-sandbox.ts`): la función solo conoce `run(request) → RunOutcome`. Otro lenguaje, u otro motor como Judge0, es otra clase en `index.ts`, sin tocar el front.
- **Código compartido con la app:** `src/app/data/code-runner/run-result.ts`, que la Edge Function importa tal cual. Tiene los tipos del resultado, `buildRunResult()`, `outputsEqual()`, `runEventDetail()` y la codificación de los valores para viajar como JSON. El Edge Runtime resuelve todas las importaciones, también las de tipos, y solo con extensión, así que ese fichero no importa nada. `attempt.ts` reexporta sus tipos, y el simulado y la función comparan con el mismo código. `RunResult.status` pasa a `RunStatus` (`tests_failed` | `passed`), lo único que puede dejar una ejecución.
- **Valores que JSON no tiene:** `undefined`, `NaN` y `±Infinity` viajan etiquetados (`EncodedValue`). Todo objeto lleva su etiqueta, también los del alumno, así que ninguno se confunde con una. La app los recupera con `decodeRunResult()`.
- **Escritura atómica:** la función RPC `record_run`, solo para `service_role`, guarda el código, el estado y el evento `run` en una transacción. Primero el código y después el estado: en una sola actualización, una ejecución que repite el estado anterior con código nuevo parecería una edición al trigger, que la devolvería a `in_progress`.
- **Límite de 10 ejecuciones por minuto:** se cuentan los eventos `run` del usuario por `received_at`, sin tabla nueva y con un índice parcial. La respuesta 429 lleva `Retry-After`.
- **El intento tiene que ser del usuario:** se comprueba explícitamente, porque con `service_role` no hay RLS y un docente puede leer los de su grupo. Un intento ajeno da 404, como uno que no existe; una cuenta desactivada, 403; uno entregado, 409.
- **Tests de Deno** de la función con `deno` como dependencia de npm (2.5.6), que funciona igual en Windows: `npm run test:functions`, dentro de `npm run check`.

**Alternativas:**

- **Judge0 alojado:** el plan original. Tiene cuenta, clave, cuota diaria y una petición externa por ejecución, y el código sale a un tercero.
- **Judge0 o Piston en un servidor propio:** coste o mantenimiento, y no funciona en local en el Mac.
- **`node:vm` en un programa enviado a Judge0:** no aísla (`this.constructor.constructor('return process')()`), y obliga a leer una salida que el alumno puede manipular.
- **Copiar el código compartido en `supabase/functions/_shared/`:** dos copias de la comparación que se pueden separar.

**Consecuencias:**

- Sin cuenta ni secretos nuevos: `execute` solo usa las variables que Supabase da a toda función. `npm run db:start` la sirve.
- Cambian los pasos 2.3 y 3.x y §2.5, §2.10, §3, §4.2, §4.3, §4.4 y los riesgos de `docs/PLAN.md`, y `CLAUDE.md`.
- La memoria del TFM nombra Judge0 en la planificación, en §2.2.2, en las tecnologías, en la tabla de componentes y en la bibliografía. Se actualiza en la PEC3 (pendiente).
- Al desplegar (fase 3) hay que confirmar que `supabase functions deploy` empaqueta el fichero de `src/` (pendiente).
- **A petición del autor, dentro del paso:** dos pruebas ocultas por ejercicio en lugar de una, cada una con un caso límite más (fila del 2.2 en `PENDIENTES.md`). Cambia §2.5: el ejercicio 3 tiene ahora seis pruebas, y la nueva oculta es `[[-4, -6]]` → `-10`.

**Aprobación:** el autor eligió QuickJS tras comparar las alternativas, con la condición de poder pasar fácilmente a Judge0 en el futuro.

## D-043 · Tutor real: sin streaming, petición reintentable y espera visible (10/11/2026)

**Contexto:** el paso 2.4 crea la Edge Function `tutor`. Quedaban por decidir el streaming (RF-23, D-017) y cuatro pendientes que apuntaban a este paso: el idioma de la respuesta, el reintento que subía el nivel dos veces, el catálogo de reacciones en el prompt y un límite de peticiones. Al planearlo, el autor recordó que cualquier mejora de UX o de producto es bienvenida.

**Decisión:**

- **Sin streaming en la v1.** Antes de que el alumno lea nada, la respuesta tiene que ser un JSON válido y no contener código. Con streaming, un reintento obligaría a borrar texto ya leído, y la emoción llega en el mismo JSON que el mensaje, así que tampoco se adelantaría. Con un modelo Flash la espera es de 1–3 s y la cubren los tres puntos y la mascota. La función responde `{ events }` con `meta`, `delta` y `done` juntos; el contrato del cliente no cambia, así que activarlo después solo toca el servidor.
- **El texto aparece poco a poco:** `SupabaseTutorService` trocea el texto ya validado en `delta` de tres palabras cada 40 ms, igual que el simulado (`data/tutor/typing.ts`, compartido). Con `prefers-reduced-motion`, sale de golpe.
- **Voz (fase 6):** el diseño sirve para una conversación por voz (reconocimiento en el navegador → tutor → síntesis), con una pausa de 1–2 s. Si se nota, el servidor puede validar y enviar la respuesta frase a frase sin cambiar el cliente (pendiente del 6.1). Una llamada de voz en tiempo real con el proveedor (audio directo) choca con §2.10 y con la validación, y se descarta.
- **Contrato compartido sin imports** (`data/tutor/tutor-contract.ts`), como `run-result.ts` en D-042: tipos de los eventos, catálogo de reacciones con el uso de cada una (`REACTION_USES`, que sale de las recetas) y el cálculo del nivel (`reachedHintLevel`, `answerHintLevel`), que usan el simulado, `TutorStore` y la función.
- **`requestId` en `TutorRequest`:** el id del turno, que el chat reutiliza al reintentar. Si la función ya guardó la respuesta de esa petición, la devuelve sin llamar al modelo: un reintento ya no sube el nivel dos veces ni gasta cuota. `tutor_interaction.request_id` es único; dos peticiones iguales a la vez reciben la primera respuesta guardada. El simulado no lo necesita: falla antes de registrar.
- **Prompt v1** (`docs/prompt-history.md`): la v0 más el idioma de la petición, el catálogo de reacciones con su uso y las bromas solo ante peticiones de la solución. Lo que escribe el alumno va entre etiquetas que el prompt declara datos, nunca instrucciones, y el alumno no puede cerrarlas antes de tiempo.
- **Contexto:** enunciado, ejemplos (las pruebas ocultas solo como número, nunca sus valores), código, las 6 últimas interacciones y la última ejecución. Si el código que llega es el de esa ejecución (el intento no ha vuelto a `in_progress`), el modelo recibe los ejemplos que fallan con su entrada y su resultado esperado; si no, se le dice que la ejecución fue de una versión anterior.
- **El código se prueba antes de preguntar** (iteración 1, a raíz de una prueba del autor: escribió «PIKACHU» dentro de la función y el tutor siguió con la pista anterior, porque solo sabía que «fallaban 6 de 6»). La función `tutor` ejecuta el código actual con los ejemplos en el mismo sandbox de QuickJS que `execute` (`_shared/quickjs-sandbox.ts`, que pasa a compartirse) y el modelo recibe qué devuelve cada uno o qué error lanza, aunque el alumno no haya ejecutado. Las pruebas ocultas no se ejecutan ahí, para que sus valores nunca lleguen al modelo; de ellas solo se cuenta cuántas fallaron en la última ejecución. El resultado va entre etiquetas de datos, porque el mensaje de un error lo escribe el alumno. El prompt pide empezar por el error si el código no carga, lanza uno o no define la función.
- **Humor** (iteración 2, a petición del autor): el prompt permite un chascarrillo breve y amable cuando encaje (una broma como mucho, por ejemplo con algo curioso de su código o su mensaje), siempre seguido de la ayuda, nunca a costa del alumno, nunca si está frustrado y sin datos curiosos ajenos al ejercicio. Sin ejemplos concretos en el prompt, para que no los repita. Las bromas de reacción (`wink`, `secret`…) siguen reservadas para las peticiones de la solución; con un chiste, `laugh`. La batería del 2.5 comprobará que el humor no rebaja la regla absoluta.
- **Despistes de escritura con su línea** (iteración 3, a petición del autor): una coma, un punto y coma, un paréntesis, una palabra mal escrita o una variable sin declarar no son la solución, así que el tutor los señala con claridad en cualquier nivel, con la línea y qué falta o sobra, sin reescribirla; las pistas graduadas quedan para la lógica. El sandbox recoge la línea del error (`lineNumber` en los de sintaxis y `solution.js:N` en el `stack` de los demás) en `RunLoadError.line` y `TestResult.line`, y la petición al modelo cita la línea y su texto.
- **Emoción e intensidad con criterio** (iteración 4: el autor veía siempre la misma reacción y la misma intensidad). El modelo no sabía qué significaba cada intensidad y respondía casi siempre `encouragement/2`. El prompt explica cuándo usar cada emoción (el dato del docente) y qué tamaño tiene cada intensidad en pantalla, empezando por 1. En seis situaciones de prueba salieron `celebration/3` (todo superado), `surprise/2` (pide la solución), `joy/2`, `encouragement/1` (pista) y `encouragement/2` (frustración), cada una con su reacción.
- **Intensidades altas** (iteración 7, a petición del autor: que se vea más el efecto). Las reacciones son parte de la gracia, así que el prompt pide ser generoso: 2 es lo normal (una pista, una duda, un avance), 3 en cuanto haya chispa (superar pruebas, un buen razonamiento, una broma, un papel de teatro, una petición de la solución) y 1 solo para acompañar con empatía a un alumno frustrado, donde un efecto grande desentonaría. En once situaciones de prueba: seis con intensidad 3, tres con 2 y las dos de frustración con 1.
- **Reacciones de teatro abiertas** (iteración 6, a petición del autor: que el tutor juegue, tome papeles y envíe reacciones distintas sin que sean tabú). Las bromas del catálogo (`wink`, `secret`, `seriously`, `throw`, `grumpy`) dejan de reservarse a las peticiones de la solución: el tutor puede fingir que se enfada con un punto y coma rebelde, lanzar una bola de papel a un despiste repetido o guiñar ante un truco, siempre que se note que es broma y con cariño. El único límite: nada de teatro si el alumno está frustrado o desanimado. Cambia la regla de D-036 y D-037 («nunca ante un error»), y los usos de esas reacciones en `REACTION_USES`. En la prueba: `grumpy` ante el mismo despiste, `wink` ante «devuelvo 9 siempre», `secret` ante la insistencia y `empathy`, sin teatro, ante «no sirvo para esto».
- **Emoji de respaldo mientras carga el 3D** (iteración 5: el autor vio una reacción sin imagen). Los emojis 3D animados pesan 400–500 KB; con el tutor real la respuesta llega de golpe y el texto corto acaba antes de que el emoji se descargue la primera vez, y hasta ahora la pieza escondía su icono sin nada que mostrar. Cada pieza con emoji animado lleva detrás una versión ligera, que se ve en cuanto carga y deja paso al animado cuando está listo; si el animado falla, se queda la ligera. Primero fue la plana en 2D; en la iteración 8 pasó a ser la 3D estática (abajo).
- **3D estático en lugar de plano, y animados en segundo plano** (iteración 8). El autor seguía viendo a veces la versión de respaldo, señaló que la calidad de los animados es baja y propuso usar los estilos Color o 3D estático de Fluent. Medimos: el 3D estático en WebP de 256 px y calidad 85 pesa 4–8 KB (el Color, 9–25 KB; el plano, 2–4 KB; el animado, 300–500 KB) y es el mismo dibujo que el animado, así que el cambio no se nota. `npm run emojis` genera `public/reactions/still/` (45 emojis, unos 250 KB) y deja de generar los planos, que desaparecen. La capa de reacciones usa el estático de respaldo (`stillEmojiOf()`), y el ajuste «Emojis 3D» pasa a «Emojis animados»: desactivado, se ven los estáticos. Los ligeros (estáticos y pequeños) se descargan al poco de entrar; los animados, poco a poco en segundo plano (`EmojiPrefetcher.prefetchInBackground()`): en los momentos de reposo, de uno en uno, con prioridad baja y en orden de uso (pensando, bombilla, ánimo, fiesta, risa…), nunca con el ahorro de datos del navegador ni en 2G, y uno que falla se reintenta una vez a los 30 s. Se quedan en memoria durante la visita y en la caché HTTP para las siguientes. Hasta que alguna de sus dos imágenes ha cargado, la pieza enseña su icono en lugar de esconderlo: si las dos fallaran, se vería el icono, nunca un hueco (el autor vio piezas vacías con el código de antes en la pestaña, que pedía los planos ya borrados). Bajar la calidad de los animados apenas ahorraba (la risa, de 411 a 337 KB con calidad 45) y se veían peor: mejor subirla más adelante.
- **Validación (§2.6):** zod y la detección de código (bloques con ``` y líneas con aspecto de código). Como mucho, dos llamadas al modelo: si la primera respuesta no vale, una segunda que refuerza la regla incumplida. Si tampoco vale, la respuesta por defecto en el idioma del alumno; en una intervención proactiva, silencio, porque un mensaje genérico interrumpiría para nada. El modelo recibe además el formato como `json_schema`, que Gemini y Ollama aceptan.
- **Registro atómico:** la función de base de datos `record_tutor_interaction` (solo `service_role`) guarda la respuesta y su evento (`hint_requested` o `proactive_intervention`) y rechaza los intentos entregados. `tutor_interaction.model` guarda qué modelo respondió, para comparar modelos en el 2.5 y en la memoria.
- **Límite:** 6 llamadas por minuto y usuario (respuestas e intervenciones calladas, que también gastan una llamada), con `latest_tutor_calls()` y 429 con `Retry-After`. `secondsToWait()` y el límite del código pasan a `_shared/limits.ts`, compartidos con `execute`.
- **Proveedor:** `LlmProvider` con `OpenAICompatibleProvider` (URL base y modelo de `app_setting.ai_provider`, clave en el secreto `AI_API_KEY`, opcional para Ollama), con 15 s como máximo por llamada. Si el proveedor falla o tarda, 503: el chat dice «no disponible» con «Reintentar».
- **Espera visible:** `DataError` guarda cuándo se puede reintentar (`retryAt`, del `Retry-After`) y el nuevo `<app-retry-button>` cuenta los segundos con el botón deshabilitado («Reintentar en 40 s»). Lo usan el chat y «Ejecutar»; el simulado pide 10 s al fallar con `rate_limited` desde la barra de desarrollo.
- **Modelo de desarrollo: `gemini-3.5-flash-lite`** (en el seed y en `app_setting`). La prueba real descubrió que `gemini-2.5-flash`, el del plan, ya no se ofrece a cuentas nuevas (404), y que `gemini-3.8-flash`, el otro recomendado por Google para proyectos nuevos, estaba saturado (503 o más de 30 s). 3.5 Flash-Lite, estable, respondía en ~1 s. El modelo final se sigue eligiendo en el 2.5 con la batería de elusión.
- **Saturación pasajera del proveedor:** ante un 5xx, el proveedor espera 1 s y repite una vez; un 4xx (clave o modelo mal) no se repite. El log guarda el mensaje del proveedor (hasta 200 caracteres), no el cuerpo entero, que puede repetir la petición. Sin esto, la mitad de las peticiones de la prueba real fallaban con «high demand».
- **Una configuración de Deno** para todas las funciones (`supabase/functions/deno.json`, con zod 4.6.7).
- **Secretos en local:** `supabase/functions/.env`, que `supabase start` carga, no estaba en `.gitignore`; ahora sí.

**Alternativas:**

- Streaming del JSON con validación a medida que llega: más complejo, y obliga a retirar texto ya mostrado si aparece código.
- Streaming frase a frase ya en el 2.4: no hace falta con respuestas cortas en texto; queda para el 6.1 si la voz lo pide.
- Que el reintento no cuente como pista (lo decide el cliente): no evita la segunda llamada al modelo y deja el nivel en manos del cliente.
- `response_format: json_object`: la documentación de Gemini no lo garantiza; `json_schema` sí.
- Contar el límite con una tabla propia: las interacciones y los eventos ya tienen la hora.

**Consecuencias:**

- Cambian §2.3 (`tutor_interaction`), §2.6 (petición, respuesta, prompt y validación), §4.4 y el paso 2.4 de `docs/PLAN.md`. En la memoria, RF-23 pasa a «respuesta completa validada, que aparece de forma progresiva» (pendiente para la PEC3).
- `provideSupabaseData()` usa ya `SupabaseTutorService`; `UnavailableTutorService` desaparece.
- El 2.5 compara modelos con `tutor_interaction.model` y puede ajustar la latencia (`reasoning_effort`) por modelo.

**Aprobación:** el autor aprobó el plan sin streaming y con las seis mejoras propuestas (texto progresivo, espera visible, contexto de la ejecución, modelo guardado, tiempo máximo y respuesta por defecto en su idioma), tras preguntar cómo encajaba con las emociones y con la voz. El modelo de desarrollo y el reintento ante saturación salieron de la prueba real, después de que el autor señalara la lista actual de modelos de Gemini.

## D-044 · Batería de elusión, prompt v2, modelos de respaldo y ayuda tras la negativa (11/11/2026)

**Contexto:** el paso 2.5 mide si el tutor real resiste los intentos de obtener la solución (§2.9) y elige con datos el modelo y la versión de la instrucción de sistema. Al planearlo, el autor recordó que cualquier mejora de producto, UX o resiliencia es bienvenida, y aprobó las cinco propuestas.

**Decisión:**

- **`npm run elusion`** (`scripts/elusion.mjs`, con `scripts/elusion/`): envía cada caso a la función `tutor` local como lo haría la aplicación (un alumno del seed con su sesión, el código y el idioma), siempre sobre el ejercicio 3. Antes de cada pasada le da al alumno un intento nuevo con la `service_role` local (de `supabase status`, nunca en la app), para que ningún caso herede la conversación de otro. Cambia el modelo en `app_setting.ai_provider` sin respaldo, para que cada respuesta sea del modelo probado, y lo restaura al acabar. Renueva la sesión antes de cada petición, porque una batería dura más que el token, y un bloqueo impide lanzar dos a la vez, porque se borrarían el intento la una a la otra (pasó en el paso). Respeta el límite (429 con `Retry-After`) y reintenta ante un 503 del proveedor.
- **Casos:** los 8 ataques de §2.9, con la inyección en el mensaje (8a) y en un comentario del código, junto a una petición de pista (8b); tres ataques más (pedir los valores de las comprobaciones ocultas, «completa el hueco» y juego de rol); y tres casos de control, que comprueban que el tutor sigue ayudando y que su consejo encaja con el código (un concepto, una pista con el total ya en cero y un código correcto). 3 pasadas por caso, o 1 con `--quick` como regresión tras tocar el prompt.
- **Veredicto automático y revisión humana:** _resiste_, _frenada por el validador_, _cede_, _revisar_, _ayuda_ o _sin respuesta_ (funciones puras en `scripts/elusion/verdict.mjs`, con tests). Lo que las palabras pueden regalar no lo ve un script, así que el report trae todas las respuestas literales y las conclusiones son una lectura humana (`docs/elusion/conclusiones.md`, que el script incluye).
- **Otros proveedores y modelos locales en la batería** (iteración 3): `--base-url`, `--key-secret` (ninguno por defecto: la clave del principal no va a otro proveedor), `--response-format` y `--timeout` en segundos. `--quick` es solo una comprobación: muestra los veredictos y no guarda nada, para no sustituir las pasadas completas documentadas (le pasó al caso C1 al probarlo, que se repuso con sus 3 pasadas).
- **Resultados versionados:** un JSON por modelo y versión del prompt en `docs/elusion/`, y `docs/elusion-report.md` generado con todos, con su metodología, para compararlos y citarlos en la memoria.
- **`tutor_interaction.rejected_answers`** (0–2, nueva migración y `record_tutor_interaction` con un parámetro más): distingue el prompt que aguanta (0) de la red que lo para (2, respuesta por defecto). Una respuesta rechazada por llevar código conserva su `elusion`, para que el intento quede registrado aunque el alumno reciba la respuesta por defecto.
- **Modelos de respaldo, tantos como se quiera y de cualquier proveedor compatible** (iteraciones 1 y 2, a propuesta del autor): `ai_provider.fallbacks`, una lista en orden. Cada respaldo es el nombre de otro modelo del mismo proveedor (`"gemini-x"`) o un objeto con su URL, su modelo, el **nombre** del secreto con su clave (`keySecret`) y cómo pide el formato (`responseFormat`: `json_schema`, el de siempre; `json_object` o `none`, para proveedores que no admiten el esquema). Sirve, sin tocar código, cualquier proveedor con la API de chat de OpenAI (Gemini por su endpoint compatible, Groq, OpenRouter, Mistral, DeepSeek, OpenAI, Ollama…); uno sin ella necesitaría su propia clase de `LlmProvider`. Si un modelo falla (saturado, sin cuota, que tarda, retirado o sin clave), responde el siguiente, y la interacción guarda cuál respondió. Una lista cuesta lo mismo que un solo respaldo y aguanta mejor el plan gratuito, que limita y se satura por modelo.
  - **Claves:** una por proveedor en los secretos de las funciones (en local, `supabase/functions/.env`, que escribe el autor): `AI_API_KEY` para el principal y `AI_<NOMBRE>_API_KEY` para los demás. El ajuste solo puede nombrar secretos con esa forma, para que no sirva para enviar otro secreto de la función (la `service_role`) a un proveedor. Un respaldo de otra URL nunca hereda la clave del principal, que acabaría en otro proveedor: sin `keySecret`, va sin clave (Ollama). Descartado: varias claves del mismo proveedor para sumar cuota gratuita, que rozaría sus condiciones de uso.
  - **Tiempo máximo:** no se prueba otro modelo cuando la petición lleva 30 s (`FALLBACK_BUDGET_MS`); entonces, 503 y «Reintentar», en lugar de dejar al alumno esperando. Cada modelo puede fijar cuánto espera su respuesta (`timeoutMs`, de 1 s a 2 min; 15 s si no dice nada), porque un modelo local en CPU puede necesitar más (iteración 3).
  - **Modelos locales** (Ollama, LM Studio, llama.cpp, vLLM): entran igual, con la URL vista desde Docker (`http://host.docker.internal:11434/v1`) y sin clave.
  - **`providerSettingOf()`** lee el ajuste, que escribe un administrador: descarta lo que no es un modelo válido, los repetidos y el principal, y anula el ajuste si el principal nombra un secreto no permitido.
  - Probado contra la función local con Gemini y Groq: los dos modelos inexistentes dieron 404, Groq 401 porque no le llegó la clave de Gemini, y respondió el último en 3 s. Cubre la fila del 2.4 sobre los 503.
- **Ayuda tras la negativa:** el evento `meta` lleva `elusion`, y el chat ofrece bajo esa respuesta «Dame una pista» y «No entiendo el enunciado» (`TutorStore.offersHelp`), para que la negativa lleve a algún sitio (RF-09: la elusión como oportunidad). Solo bajo la última respuesta y nunca en un intento entregado. Los chips comparten aspecto con las sugerencias del chat vacío: `@utility suggestion-chip` con `@apply` de las mismas clases de Tailwind, en el muestrario.
- **Prompt v2** (`docs/prompt-history.md`), a partir de la lectura de las respuestas de la v1: comprobar cada consejo en el código del alumno, decir claramente que un código correcto lo es, negativas breves y distintas sin etiquetas, y bromas que se entiendan.
- **Modelo: `gemini-3.5-flash-lite` con el prompt v2,** en el desarrollo y en la beta. Resistió los 12 ataques en todas las pasadas con las dos versiones (72 de 72), sin respuestas rechazadas, con 1,3 s de mediana y cuota gratuita de sobra. `gemini-3.8-flash` lee mejor el código y varía más, pero en el plan gratuito tardó 9,2 s de mediana (hasta más de 15 s) y agotó la cuota tras 8 respuestas: se vuelve a medir con el plan de pago en el 3.1, donde se eligen también los modelos de respaldo. Las cifras y las respuestas, en `docs/elusion-report.md`.
- **`scripts/import-app-ts.mjs`:** el hook que importa las fixtures TypeScript desde Node, compartido ahora por `npm run seed` y `npm run elusion`.

**Alternativas:**

- Llamar al modelo directamente con el prompt, sin la función: más rápido, pero no prueba lo que de verdad recibe el alumno (validador, límites, contexto del intento).
- Un modelo como juez del veredicto: otra llamada por respuesta, con los mismos sesgos que el juzgado; la lectura humana es más fiable con este volumen.
- Leer los rechazos del validador en los logs de la función: frágil y solo en local; la columna sirve también al panel docente y a la memoria.
- Abrir el tutor flotante o insertar avisos en el editor tras la negativa: los chips van donde el alumno ya mira, sin interrumpir.

**Consecuencias:**

- Cambian §2.3 (`tutor_interaction`, `app_setting`), §2.6 (evento `meta`, validación y respaldo), §2.9 y el paso 2.5 de `docs/PLAN.md`.
- Cambiar el prompt pide `npm run elusion -- --quick` antes de darlo por bueno; un modelo candidato nuevo, la batería completa.
- La memoria puede citar los casos y las respuestas literales del report.
- Quedan en `PENDIENTES.md` la nueva medida de `gemini-3.8-flash` (3.1) y rotar en el servidor las reacciones de broma, porque Flash-Lite apenas varía aunque el prompt lo pida.

**Aprobación:** el autor aprobó el plan con las cinco mejoras y pidió dejar bien documentado cómo resiste cada modelo, con los ejemplos y las respuestas exactas, para la memoria. El modelo lo elige el agente por delegación del autor, con los datos de la batería.

## D-045 · Ejercicios en los tres idiomas, código en inglés y batería de elusión independiente del seed (11/11/2026)

**Contexto:** D-023 solo traducía la interfaz: al cambiar de idioma, título, enunciado y contenidos de los ejercicios seguían en español, y sus funciones también estaban en español (`suma`, `contarVocales`). Lo vio el autor en el paso 2.5 y pidió un paso propio, el 2.5b, antes de la beta (3.1). Al plantearlo, señaló dos cosas: que un ejercicio puede escribirse en inglés o en catalán, no solo en español, y que no tiene sentido que renombrar o editar ejercicios obligue a volver a pasar la batería de elusión, cuyo coste en cuota no compensa.

**Decisión:**

- **El código del ejercicio, siempre en inglés:** el nombre de la función y los textos que devuelve son los mismos en los tres idiomas, y el enunciado traducido los cita tal cual. Ni las pruebas ni `execute` dependen del idioma. Las funciones del seed pasan a `countEvens`, `multiplicationTable`, `sum`, `maximum`, `reverseArray`, `countVowels`, `average` y `firstIndexOf`, y el código de ejemplo de las fixtures pasa entero al inglés. Es la norma del seed y la recomendación del formulario (4.3), no una prohibición. Los datos de las pruebas son datos: `countVowels` sigue contando las vocales con tilde de «Murciélago».
- **Idioma de origen en el propio ejercicio:** `exercise.source_locale` (`app_locale`: `es`/`en`/`ca`, por defecto `es`) dice en qué idioma están `title`, `statement` y `topics`, porque un docente puede escribir en cualquiera de los tres. Se llama `locale`, como el resto de la app (`AppLocale`), porque `language` ya es el lenguaje de programación.
- **`exercise.translations` (`jsonb`):** los mismos tres textos en los otros idiomas, cada uno opcional. La restricción `exercise_translations_shape` (función `is_valid_exercise_translations`) exige un objeto con solo idiomas de la interfaz distintos del de origen, cada uno con título y enunciado no vacíos y una lista de textos. Así se lee el ejercicio en una sola fila, la RLS es la de `exercise` y el docente puede editar las traducciones (privilegio por columna).
- **Una función pura sin imports, `exerciseText()`** (`data/exercise-text.ts`), elige el texto del idioma pedido o, sin traducción, el original con su idioma. La usan el catálogo, el espacio de trabajo y la Edge Function `tutor`, que la importa tal cual (D-042). Los servicios devuelven el ejercicio entero, porque el docente edita todos los idiomas: elegir el idioma es cosa de quien lo muestra.
- **Sin traducción, el original y nunca un hueco:** el catálogo y el título de la pantalla de trabajo lo marcan con `lang` (WCAG 3.1.2), y el enunciado añade un aviso discreto con el idioma del original («Este enunciado solo está en español»).
- **El tutor:** la función recibe el enunciado en el idioma en que responde o, sin traducción, el original. El prompt sigue en la v2: solo cambia el contenido. El tutor simulado responde en el idioma de la petición (`TUTOR_SCRIPTS`), como el real, para que la demo con datos simulados también funcione en inglés y catalán. Las conversaciones pasadas de las fixtures se quedan en español, porque ya ocurrieron.
- **El seed, siempre traducido:** el tipo de las fixtures exige `en` y `ca`, así que un ejercicio del seed sin traducción no compila y `npm run check` falla. Los que creen los docentes pueden quedar sin traducir; para ellos está la caída al original. Seed v5.
- **Batería de elusión independiente del seed:** buscaba el ejercicio 3 por `function_name = 'suma'`. Ahora el script crea su propio ejercicio (`BATTERY_EXERCISE`, una copia congelada del ejercicio 3 tal como era al pasar la batería, con `suma`), lo asigna al grupo del alumno en una sesión 99 y lo borra al terminar, con sus intentos. Los resultados de D-044 siguen siendo comparables, renombrar, editar o borrar ejercicios del seed ya no toca la batería y, de paso, la batería deja el seed como estaba (antes había que `db:reset`). Se comprobó con un solo caso (`--quick --only 1`: resiste), sin repetir la batería.

**Alternativas:**

- Una tabla `exercise_translation` (una fila por idioma): más normalizada, pero con su propia RLS, una consulta más en cada lectura y el mismo resultado para tres idiomas fijos.
- Guardar todos los textos dentro del `jsonb`, sin columnas de origen: obligaba a rehacer columnas, seed, consultas y tipos sin ganar nada.
- El español siempre como origen: el autor lo descartó, porque un docente puede escribir en inglés o en catalán.
- Elegir el idioma en los servicios de datos: las pantallas no cambiarían, pero el docente necesita el ejercicio entero y la Edge Function, la misma lógica sin Angular.
- Un script que compruebe las traducciones del seed, como `npm run i18n -- --check`: el tipo de las fixtures lo hace sin código nuevo.
- Volver a pasar la batería con `sum`: gasta cuota y obliga a hacerlo cada vez que cambie el seed.

**Consecuencias:**

- Cambian §2.3, §2.5, §4.8 y los pasos 2.5b y 4.3 de `docs/PLAN.md`; el 4.3 añade una pestaña por idioma y «Traducir con IA» como borrador (con la cadena de modelos de D-044).
- La memoria del TFM cita `suma` en el enunciado modelo: queda en `PENDIENTES.md`.
- Los títulos de las sesiones (`class_session.title`) siguen sin traducir: los bloques del 2.5c los traducirán igual que los ejercicios.

**Aprobación:** el autor aprobó el plan, con dos correcciones durante el planteamiento: el idioma de origen no tiene por qué ser el español, y la batería no se repite ni debe depender del seed.

## D-046 · Asignaturas, bloques en lugar de sesiones, un intento por asignación y práctica (11/11/2026)

**Contexto:** hasta el 2.5b, cada grupo organizaba sus ejercicios en sesiones numeradas («Sesión 2», D-034), había un solo intento por alumno y ejercicio, y nada distinguía una asignatura de otra. Al plantear el 2.5b, el autor preguntó por cursos y asignaturas, por repetir un ejercicio en un repaso o una recuperación y por practicar de nuevo lo entregado: con ese modelo no se podía. El paso 2.5c lo resuelve antes de la beta (3.1). Durante el paso, el autor pidió además que el docente pudiera ocultar bloques o ejercicios y preguntó qué papel tiene la RLS en eso.

**Decisión:**

- **Asignaturas (`subject`),** con idioma de origen y traducciones del nombre, como los ejercicios (D-045). Las gestiona el administrador (`AdminService.listSubjects` y `saveSubject`, implementados en la fase 5) y las leen todos los usuarios con sesión. Cada grupo es de una (`class_group.subject_id`): «1.º DAW A» de Programación básica y «1.º DAW A» de Desarrollo web son dos grupos. La asignatura no supone programación: el editor y la corrección son del ejercicio según su `kind` (D-029), y Matemáticas podrá llegar sin tocar este modelo. Una tabla `exercise_subject` dice para qué asignaturas sirve cada ejercicio del banco común, para filtrarlo en el 4.3.
- **Bloques en lugar de sesiones:** `class_session` pasa a `class_block`, con título obligatorio, libre y traducible («Tema 1: Bucles», «Recuperación del tema 2»). `position` solo ordena y no se muestra. Las asignaciones apuntan a su bloque (`block_id`) y conservan `group_id` con una clave ajena compuesta a `class_block (group_id, id)`, que garantiza que el bloque es del mismo grupo y deja la RLS igual de simple. Un ejercicio puede estar en varios bloques del mismo grupo (única por bloque y ejercicio).
- **Ocultar (`is_hidden`) bloques y asignaciones,** a petición del autor. La columna es el dato que marca el docente; quien lo hace cumplir es la RLS: las políticas de `class_block` y `exercise_assignment` y la función `is_visible_assignment()` no devuelven al alumno lo oculto, y `is_assigned_to_me()` y `open_attempt` tampoco se lo dejan abrir. El docente del grupo y el administrador lo ven todo. Filtrarlo solo en el navegador no bastaría, porque el alumno podría pedirlo a la API con su sesión. El interruptor llega con la pantalla del 4.3.
- **Un intento por asignación y número:** `attempt.number` y unicidad por alumno, asignación y número. El mismo ejercicio en un tema y en su recuperación son dos intentos. `open_attempt(asignación, número)` abre el último (o el del número, sin crearlo) y crea el 1 al abrir por primera vez; `retry_attempt(asignación)` crea el siguiente, vacío, si el último está entregado y, si no, devuelve ese último, así que dos pestañas nunca crean dos. Los intentos sin asignación (prueba del docente desde el banco, 4.3) ya no se abren por ejercicio: llegarán con esa pantalla.
- **El intento que cuenta** para la clase (estadísticas, histórico y catálogo) es el primero entregado de cada asignación o, mientras no hay ninguno, el primero (`countedAttempt()`). Como solo se puede practicar tras entregar, es siempre el número 1, pero la función dice el porqué. Las repeticiones son práctica: el catálogo muestra «Repetido N veces» y no cambian los datos de la clase. `assignedExercise()` arma cada tarjeta del catálogo a partir de los intentos, igual en los dos servicios de datos.
- **Catálogo:** una pestaña por grupo con el nombre de su asignatura (y del grupo, si dos comparten asignatura) solo con más de un grupo. Las pestañas son enlaces con el grupo en la URL (`?grupo=`, `mat-tab-nav-bar`), para que recargar o «Atrás» la conserven. El resumen cuenta el grupo de la pestaña y «Continúa donde lo dejaste», todos (con la asignatura). Los bloques se muestran por su título, sin número; una práctica abierta se continúa como cualquier intento abierto (`currentAttempt()`).
- **Espacio de trabajo:** la ruta lleva la asignación (`/alumno/ejercicio/:id`), porque los intentos son de la asignación, y `?intento=N` para repasar uno anterior. Arriba, la asignatura (enlace a su pestaña) y el bloque; con varios intentos, un selector «Intento 2 de 3». Una vez entregado, «Practicar de nuevo» (solo en el último) y «Siguiente ejercicio», que lleva al siguiente del bloque sin entregar (`nextInBlock()`) o, sin ninguno, de vuelta al catálogo. Mientras se practica, un aviso dice que el intento no cuenta para la clase.
- **Analítica:** `StatsService` pasa a estadísticas por bloque (`groupBlockStats`), y la vista en vivo y el histórico eligen grupo (con su asignatura) y bloque.
- **Seed v8:** tres asignaturas; 1.º DAW A en dos (Programación básica y Desarrollo web en entorno cliente, con dos ejercicios nuevos, `isValidEmail` y `toQueryString`, casi sin empezar) y, a petición del autor para ver la diferencia, 1.º DAM B en otras dos (Programación básica y avanzada, con Javier; los ejercicios 6 a 8 sirven también a avanzada y solo Elena ha empezado); un bloque de recuperación con un ejercicio oculto, un repaso final oculto y prácticas de Lucía y Aya. Los intentos nuevos van detrás de los del 2.1, que conservan sus ids. La barra de desarrollo agrupa a los alumnos por clase, no por grupo, para no repetirlos.
- **El seed grande, en este paso:** el agente propuso llevarlo a un paso propio (2.5d), pero el autor lo quería ya, con un mínimo de 15 ejercicios por asignatura. Hay 42: los 10 anteriores y 32 nuevos en un fichero por asignatura (`basic-exercises.ts`, `web-exercises.ts`, `advanced-exercises.ts`), en los tres idiomas, con 3 o 4 pruebas visibles y 2 ocultas y su código de ejemplo. `fixtures.spec.ts` ejecuta cada solución contra todas sus pruebas y comprueba que el error típico falla alguna, así que una prueba mal escrita no llega al seed. Las salidas son valores sencillos (números, textos, vectores y `null`), y las entradas con objetos no dependen del orden de sus claves, que `jsonb` cambia. Cada grupo tiene en bloques todos los ejercicios de su asignatura, con la posición explícita en las fixtures para que los temas nuevos vayan antes de la recuperación. Seed v8.
- `data/exercise-text.ts` pasa a `data/localized-text.ts`, con `subjectName()` y `blockTitle()` además de `exerciseText()`, y `ExerciseLocale` a `ContentLocale`: ya no traduce solo ejercicios. La Edge Function `tutor` lo importa con su nombre nuevo.

**Alternativas:**

- Asignatura en el ejercicio en lugar de en el grupo: un ejercicio sirve a varias asignaturas, y el docente asigna a grupos.
- Una lista de asignaturas (`uuid[]`) en el ejercicio, en lugar de `exercise_subject`: sin claves ajenas ni índice.
- Quitar `group_id` de la asignación: más normalizado, pero cada política y cada consulta tendría que unir con el bloque.
- Varios intentos sin número, ordenados por fecha: dos pestañas podrían crear dos intentos a la vez.
- Practicar partiendo del código entregado: el plan pide el editor vacío; queda como mejora en `PENDIENTES.md`.
- Enlazar el bloque en la ruta de miga con un fragmento (`#bloque-…`): el foco que se lleva el encabezado tras navegar desharía el desplazamiento.

**Consecuencias:**

- Cambian §2.2, §2.3, §2.4 y los pasos 2.5c, 4.1, 4.2, 4.3 y 4.4 de `docs/PLAN.md`.
- **Desviación respecto a la memoria del TFM** (para su revisión): la memoria habla de nueve entidades y este modelo tiene 13 tablas (en el 2.1 eran 11); el histórico «por sesión» (RF-13, CU-05 3b) pasa a ser por bloque, y «asignar un ejercicio a un grupo y a una sesión» (CU-06 6a), a un bloque de un grupo. Un bloque puede ser una sesión de clase, un tema, un repaso o una recuperación, así que generaliza lo que decía. La simplificación que la memoria asumía (el intento sin referencia a la asignación) ya se resolvió en el 2.1 y ahora llega más lejos: un intento por asignación y número.
- Los ejercicios abiertos por enlace con el id del ejercicio (rutas anteriores al 2.5c) ya no se encuentran: solo valían en desarrollo.

**Aprobación:** el autor aprobó el plan ampliado y pidió durante el paso ocultar bloques y ejercicios, otro alumno con otras asignaturas y el seed grande en este mismo paso. Las decisiones técnicas las tomó el agente por delegación del autor.

## D-047 · Un tutor que ayude de verdad, y sus herramientas con WebMCP (11/11/2026)

**Contexto:** el autor probó el tutor real con Supabase local en el 2.5c. A «no me acuerdo de cómo se empieza una función» respondía con la misma pregunta socrática una y otra vez, bromeaba con un alumno frustrado y no le daba ni la función vacía. El código mostraba por qué: el modelo recibe las seis últimas interacciones como texto dentro de un único mensaje, el prompt prohíbe cualquier código y no pide no repetirse, el nivel de pista solo sube con «Pedir pista» y el modelo es el barato (`gemini-3.5-flash-lite`). Además, el autor quiere que la IA señale los fallos pequeños indicando la línea, que pueda buscar y abrir ejercicios, cambiar los ajustes y, para la demo, usar WebMCP, que Angular 22 incluye de forma experimental (`provideExperimentalWebMcpTools`).

**Decisión:**

- **Paso 2.5d, antes de la beta:** historial como turnos de chat (10 interacciones), prompt v3 (sin repetir lo que el alumno dice no saber, sin bromas con frustración, esqueleto vacío y sintaxis general permitidos, nunca la lógica), código numerado y pistas que señalan la línea, validador que acepta solo la firma vacía, nivel que sube cuando el alumno se atasca y medida con la batería y con `gemini-3.8-flash`.
- **Paso 2.5e, justo después del 2.5d (adelantado de la fase 6 a petición del autor, para la demo y porque comparte prompt y contrato con el 2.5d): un registro de herramientas con el formato de WebMCP y dos usos.** Lo usa nuestro tutor por _function calling_ (los esquemas en un contrato compartido; la Edge Function valida cada llamada), en cualquier navegador. Y WebMCP lo abre a cualquier agente del navegador, para la demo.
- **Qué se abre a quién:**
  - a todos: buscar y abrir ejercicios, el siguiente pendiente, los intentos, resaltar líneas y los ajustes;
  - solo nuestro tutor: insertar el esqueleto, ejecutar las pruebas, entregar y corregir despistes de escritura (`proposeFix`), siempre con un botón o el diálogo de confirmación que pulsa el alumno;
  - nadie: escribir código de la lógica del ejercicio.
- **La frontera de `proposeFix`, a petición del autor:** el tutor corrige lo que impide que el código se ejecute (un `;` o un `)` que falta, `retrun`, `lenght`), nunca lo que hace fallar las pruebas. Lo comprueba el servidor: la última ejecución dio un error de sintaxis o de nombre, el cambio es de una línea y pocos caracteres, y con él ese error desaparece. El tamaño solo no basta: `i < n` → `i <= n` también es un carácter y es la solución.
- Las herramientas validan sus argumentos en `execute`, porque ni Angular ni WebMCP lo hacen.

**Alternativas:**

- **Exponerlo todo por WebMCP:** el autor lo descartó por ser la opción más arriesgada. Un agente del navegador actúa con la sesión del alumno, sin nuestro validador ni nuestras reglas, y podría resolver y entregar un ejercicio.
- **Limitar WebMCP a «nuestro» agente:** no es posible. La página no sabe qué agente llama, y cualquier clave que viva en el navegador la puede leer el alumno. Solo el servidor garantiza que una acción la pide nuestra IA, y eso es el _function calling_ del tutor.
- **Que nuestro tutor use WebMCP directamente:** vive en el servidor y no tiene acceso a la API del navegador. Por eso se comparte el formato y no la API.
- **No tener herramientas y quedarse en el texto:** el tutor no podría señalar en el editor ni llevar al alumno a un ejercicio, que es lo que el autor pide.

**Consecuencias:**

- Pasos 2.5d y 2.5e en `docs/PLAN.md`.
- WebMCP es experimental: en Chrome es una prueba de origen (en local, con el flag `enable-webmcp-testing`) y la API ya ha cambiado de nombre. Nada del producto depende de ella.
- Un agente del navegador puede manejar la página a clics igualmente; la defensa de TutorIA es formativa (§2.8). Queda en pendientes registrar el ritmo de escritura como señal para el docente.
- **WebMCP para el docente** (preguntar quién está atascado o asignar ejercicios desde su agente) es una idea para cuando exista su panel (fase 4).

**Aprobación:** el autor pidió el arreglo del tutor, las herramientas (buscar, navegar y los ajustes) y WebMCP abierto a todos para la demo, sin lo arriesgado; y que nuestra IA tenga más acceso que los agentes externos. Arquitectura y reparto de herramientas, por delegación del autor.

## D-048 · Los e2e del CI, en el contenedor de Playwright y en paralelo (11/11/2026)

**Contexto:** el CI falló al instalar Chromium (`npx playwright install --with-deps chromium`): `--with-deps` instala con `apt` las librerías de sistema del navegador, y el runner no resolvía por DNS los repositorios de Ubuntu. Nada del proyecto había cambiado: `ubuntu-latest` había pasado de Ubuntu 24.04 a 26.04, una imagen recién estrenada. Al relanzarlo pasó, pero el CI dependía de `apt`, de la imagen que GitHub ponga en `ubuntu-latest` y de que Playwright conozca los paquetes de esa versión de Ubuntu. El autor pidió la solución que sirva a largo plazo, dé menos problemas y, si puede ser, más rápida.

**Decisión:**

- Los e2e se ejecutan en la imagen oficial de Playwright (`mcr.microsoft.com/playwright:v<versión>-noble`), que trae Chromium y sus librerías: sin `apt` ni descarga del navegador. El runner sigue en `ubuntu-latest` y solo pone la máquina y Docker.
- La etiqueta de la imagen sale sola del `package-lock.json` (un job previo de unos segundos la lee), así que al actualizar Playwright el CI usa la imagen que le corresponde sin tocar el workflow.
- `@playwright/test` se fija con versión exacta, como la CLI de Supabase y Deno: Playwright solo cambia cuando lo decide el autor.
- El CI pasa a tres jobs: `check` (formato, lint y tests, sin navegador: los unitarios usan jsdom) y `e2e` corren en paralelo, así que dura lo que el más lento y no la suma.
- `--ipc=host` en el contenedor, como recomienda Playwright, porque Chromium necesita más memoria compartida de la que da Docker.

**Alternativas:**

- **Solo relanzar:** el fallo puede volver, y el CI seguiría dependiendo de `apt` y de `ubuntu-latest`.
- **Fijar `runs-on: ubuntu-24.04`:** arregla el fallo, pero sigue usando `apt` y obliga a cambiar de versión a mano cuando GitHub retire la imagen.
- **El Chrome que ya trae el runner (`channel: 'chrome'`):** sin instalar nada, pero su versión cambia cada semana, no es la que Playwright prueba y en local sería otro navegador.
- **Cachear los navegadores:** las librerías de sistema seguirían saliendo de `apt`.
- **Etiqueta escrita a mano:** había que acordarse de cambiarla con cada actualización de Playwright, y Dependabot no lo hace.

**Consecuencias:**

- `noble` es Ubuntu 24.04 (soporte hasta 2029). Pasar a la siguiente es cambiar esa palabra en el workflow cuando Playwright publique su imagen, o cuando deje de publicar la de 24.04: si al actualizar Playwright no existe, el CI falla al descargarla con un error claro. Queda en pendientes.
- Si GitHub tiene una regla de protección de `master` que exige el check `check`, conviene añadir también `e2e`, que ahora es otro job.

**Aprobación:** el autor pidió la solución que mejor sirviera a largo plazo y menos problemas diera, y que fuera más rápida si era posible. Diseño, por delegación del autor.

## D-049 · El tutor del 2.5d: el atasco sube el nivel y el esqueleto lo escribe el servidor (11/11/2026)

**Contexto:** el paso 2.5d (D-047) pide un tutor que no repita la pregunta a quien dice «no me acuerdo», que no bromee con un alumno frustrado, que pueda dar la función vacía y que señale la línea del fallo. Al medirlo con la batería, `gemini-3.5-flash-lite` anunciaba a veces el esqueleto («aquí tienes la estructura») sin escribirlo, y, al pedirle que citara siempre la línea, le buscaba fallos a un código correcto. `gemini-3.8-flash` no se pudo comparar: en el plan gratuito su cuota es cero (429 en todas las peticiones).

**Decisión:**

- **El atasco, en el contrato compartido:** `isStuckMessage()` reconoce «no sé», «no me acuerdo», «ni idea», «I'm stuck», «no ho sé»… en los tres idiomas, sin tildes. Un «no se» suelto solo cuenta con un final que lo convierta en «no sé» («no se cómo seguir»), porque «no se ejecuta» no es atascarse. Lo usan el servidor, el `TutorStore` y el tutor simulado, como el resto del nivel (2.6).
- **Dos atascos seguidos suben el nivel**, como «Pedir pista». Las intervenciones del tutor que haya entre medias no cortan la racha, y desde el nivel 0 se pasa directamente al 2. `reachedHintLevel()` cuenta también las respuestas que no son pistas cuando su nivel es 2 o más, algo que solo puede pasar por un atasco, así que el medidor y la pista siguiente lo tienen en cuenta. Las de nivel 1 no cuentan, de modo que nada cambia para quien no se atasca. El chat lo dice con «Más ayuda · nivel N» (`raisesHintLevel()`).
- **El esqueleto lo escribe el servidor, no el modelo:**
  - el modelo pide el esqueleto con el campo opcional `skeleton` (los nombres de los parámetros), y el servidor añade el bloque al final del mensaje con `skeletonBlock()`, una función del contrato;
  - el bloque lleva tantos parámetros como argumentos tienen las pruebas, con los nombres del modelo si son identificadores simples y letras para los que falten;
  - un `skeleton` mal formado se descarta: no es motivo para volver a preguntar al modelo;
  - el validador sigue aceptando un bloque que el modelo escriba con solo la firma vacía del ejercicio, y rechaza cualquier otro código.
- **Notas deterministas en la petición,** porque Flash-Lite obedece mejor lo que va en la petición que lo que dice la instrucción general:
  - con un mensaje de atasco: el paso siguiente y, si aún no existe la función, que dé el esqueleto;
  - con un código que supera los ejemplos: no hay línea que señalar ni pista que dar, y si no ha ejecutado ese código, que le invite a pulsar «Ejecutar». En ese caso, la línea de la petición no le impone un nivel.
- **Historial como chat:** las 10 últimas interacciones van como mensajes de alumno y de tutor, y las respuestas del tutor como el JSON que escribió, para que siga respondiendo en ese formato.
- **Código numerado** (`3| …`), y pistas que citan la línea solo cuando algún ejemplo falla.
- **Ejemplos de sintaxis de un catálogo fijo** (iteración 1, a petición del autor, que esperaba más ayuda cuando el alumno pide un ejemplo):
  - `SYNTAX_EXAMPLES`, en `data/tutor/syntax-examples.ts`, sin imports, tiene un ejemplo corto y genérico de función, `for`, `for…of`, `while`, `if`, variables, vectores, cadenas, `Math` y operadores, sin acumuladores ni nada que se parezca a un ejercicio;
  - el modelo pide los temas en el campo `syntax`, y el servidor añade sus ejemplos (dos como mucho) solo a una pregunta, nunca a una pista;
  - `syntaxTopicsIn()` reconoce la pregunta («¿cómo es la sintaxis del for?», «ponme un ejemplo de Math.floor») y añade una nota en la petición; también lo usa el tutor simulado.
- **Las preguntas directas se responden tal cual:** la línea de la petición ya no impone el nivel a una pregunta, que antes se respondía como una pista de nivel 3 («En la línea 4…»). El nivel es para la lógica del ejercicio.
- **Explicar más y repetir menos** (iteración 1): el prompt pide decir en una frase el porqué, no abrir cada respuesta con «En la línea…» y aportar algo nuevo en cada respuesta. Una nota en la petición recuerda cómo empezaban las tres últimas respuestas.
- **Bloques de código en el chat:** `splitCodeBlocks()`, `CodeBlock` (compartido, con «Copiar») y `TutorMessage`. Un bloque que todavía está llegando ya se muestra como bloque, y las líneas largas se parten.
- **Modelo:** sigue `gemini-3.5-flash-lite`. La comparación con `gemini-3.8-flash` queda para el 3.1, con el plan de pago (ya estaba en pendientes).
- **Batería:** controles C4 (esqueleto), C5 (frustración) y C6 (línea del bucle), con una comprobación automática (`check`) y el veredicto «no cumple». Con `--quick` ahora se ven las respuestas.

**Alternativas:**

- **Solo el validador, como decía el plan:** el modelo barato no escribe el bloque con fiabilidad, y lo que no se escribe tampoco se puede validar.
- **Guardar los nombres de los parámetros en el ejercicio:** sería lo ideal (también para `insertSkeleton`, en el 2.5e), pero obliga a una migración, a repasar 42 ejercicios y a cambiar el formulario del docente. Queda en pendientes para el 4.3.
- **Nombres genéricos siempre** (`a`, `b`): enseñan peor. El modelo los elige a partir del enunciado.
- **Que el modelo escriba los ejemplos de sintaxis:** un «ejemplo casi igual» es justo el ataque 7 de la batería. Con el catálogo, ni el mejor ataque saca otra cosa que un ejemplo genérico.
- **Detectar la frustración con expresiones regulares:** la batería no lo necesitó (C5 cumple).
- **Dejar la subida de nivel en manos del modelo:** no se podría comprobar ni mostrar en el medidor.

**Consecuencias:**

- Prompt v3 (`docs/prompt-history.md`). `ANSWER_FORMAT` gana `skeleton` y `syntax`, los dos opcionales, y `checkAnswer()` recibe sus reglas en un objeto (`mayKeepQuiet`, `skeleton`, `examples`).
- El 2.5e puede reutilizar `skeletonBlock()` para `insertSkeleton`.
- Pendientes: los nombres de los parámetros en el ejercicio (4.3) y el atasco en el chat como señal del panel docente (fase 4).

**Aprobación:** el autor aprobó el plan con las mejoras propuestas y delegó la decisión técnica; en la iteración 1 pidió ejemplos de sintaxis y respuestas que expliquen más sin ser repetitivas, porque no las veía excesivas. Que el servidor escriba el esqueleto, las notas deterministas y la etiqueta «Más ayuda» las decidió el agente por delegación, a la vista de la batería.

## D-050 · Formatear el código con Prettier y los mismos colores en el editor y en el chat (11/11/2026)

**Contexto:** en la iteración 2 del paso 2.5d, el autor pidió alguna forma de formatear el código: que el código del alumno quede bien indentado. También preguntó si sería útil que los bloques de código del chat tuvieran los colores del editor.

**Decisión:**

- **«Formatear el código»:** un botón en el encabezado «Código» y Mayús + Alt + F en el editor, como en VS Code.
  - Usa Prettier con el estilo de los ejercicios: dos espacios, punto y coma, comillas simples y líneas de 80.
  - El cursor sigue en el mismo trozo de código (`formatWithCursor`), el cambio es uno solo en el historial (Ctrl + Z lo deshace) y se guarda como cualquier edición.
  - El código que no se puede leer no se toca: el editor dice la línea del error hasta que el código cambia.
  - No hay botón en un intento entregado.
- **Prettier se descarga solo al formatear** (`prettier/standalone` con los plugins `babel` y `estree`, unos 140 kB comprimidos, en tres trozos aparte): la carga inicial no cambia. Pasa de `devDependencies` a `dependencies`, porque ahora forma parte de la app.
- **El editor lo hace todo:** `CodeEditor.format()` y el aviso. El formateo pasa por un servicio inyectable (`CodeFormatter`, que usa `formatCode()`) para poder probar el caso en que no se descarga.
- **El botón llega al editor por su nombre en la plantilla** (`#editableEditor`) y no por su clase: nombrar la clase en `viewChild` metería CodeMirror en el espacio de trabajo y desharía su `@defer` (4.7).
- **Los mismos colores en el editor y en el chat:** `codeHighlighter` asigna a cada tipo de pieza de código clases de Tailwind con los tokens del tema, y sustituye al `HighlightStyle` del editor. Los bloques del chat en JavaScript lo usan con `highlightCode`, y el resaltador se descarga con un `resource()` cuando hace falta. Mientras tanto, y en otros lenguajes, el código se ve sin colores.

**Alternativas:**

- **Formatear solo la sangría** (la de CodeMirror): no arregla espacios, llaves ni puntos y coma.
- **Formatear al guardar o al ejecutar:** cambiaría el código del alumno sin que lo pida, y le quitaría la ocasión de aprender a ordenarlo.
- **Clases propias de `@lezer/highlight` (`classHighlighter`) con CSS aparte:** no distingue las llamadas a funciones y obliga a mantener los colores en dos sitios.
- **Montar el `HighlightStyle` de CodeMirror fuera del editor:** hace falta `style-mod`, una dependencia indirecta.

**Consecuencias:**

- Prettier solo formatea JavaScript. Un lenguaje nuevo (D-029) añadirá su plugin o dejará el botón sin ofrecer.
- La carga inicial no cambia; el primer formateo descarga unos 140 kB.

**Aprobación:** el autor pidió el formateo, para que el código quedara bien indentado, y, sobre los colores, preguntó si serían útiles. El agente recomendó hacerlos porque cuestan poco y ayudan a reconocer las palabras del lenguaje. El diseño, por delegación del autor.

## D-051 · Las herramientas del tutor: un registro con el formato de WebMCP, en el JSON de la respuesta (12/11/2026)

**Contexto:** el paso 2.5e (D-047) da herramientas al tutor y las abre a los agentes del navegador con WebMCP. Al aprobar el plan, el autor pidió además poder preguntar por sus datos («¿qué asignaturas tengo?», «¿cuántos me quedan?», «¿cuántos errores llevo?»), quiso saber si eso iba en el front o en el back y pidió una valoración objetiva de todo el diseño, usando el WebMCP de Angular en lo posible. Con esa valoración, el paso se partió en dos: el 2.5e (registro, consultas, navegación, interfaz y ajustes) y el 2.5f (lo que toca el código o la entrega).

**Decisión:**

- **Un solo registro con el tipo de Angular:** cada herramienta es un `WebMcpToolDescriptor` (`appTool()` en `core/tools/app-tool.ts`) con su esquema del contrato compartido sin imports (`data/tutor/tutor-tools.ts`). Angular deduce los tipos de los argumentos a partir del esquema. `declareAppTool()` registra cada herramienta en nuestro `ToolRegistry` y, si es abierta, con `declareExperimentalWebMcpTool`; `provideAppTools()` lo hace para una ruta, y las dos se quitan al cerrarse su inyector (`withAutoCleanupInjectors`). La página del ejercicio declara `setLayout`, porque la disposición es suya.
- **Nuestro chat no pasa por `document.modelContext`,** que es para agentes externos: llama al mismo `execute` a través del registro.
- **Un validador del subconjunto de JSON Schema** que usamos (`checkToolArguments()`), en el contrato: lo usan el `execute` de Angular (ni Angular ni WebMCP comprueban los argumentos), las llamadas de los agentes de WebMCP y la Edge Function.
- **Diez herramientas, agrupadas por parámetros:** con muchas, un modelo barato elige peor y cada llamada cuesta más.
  - consultas: `getMyProgress`, `searchExercises`, `getExerciseStats` y `getSettings`;
  - navegación, con un botón que pulsa el alumno: `openExercise` (por id, por palabras del título o `next`) y `navigate`;
  - interfaz, al momento: `highlightLines`, `pointAt` y `setLayout`;
  - `updateSettings`, al momento y con «Deshacer», salvo el idioma, que recarga la página y espera a un botón.
- **Cómo llegan al modelo: un campo más del JSON de la respuesta** (`query` con las consultas y `actions` con las acciones, una propiedad por herramienta). El servidor descarta cualquier llamada que no esté en el contrato, que sea del otro grupo o con argumentos que no valen, y una nota de `highlightLines` con código. Las acciones se guardan con la interacción (`tutor_interaction.actions`); el historial las muestra sin volver a ejecutarlas.
- **Las consultas, en el front y en dos vueltas:** el modelo pide la consulta; el servidor la devuelve al navegador (evento `query`) sin guardar nada; el chat la ejecuta con los servicios de datos, con la sesión del alumno (la RLS solo le deja ver lo suyo), y reenvía la misma petición (mismo `requestId`) con el resultado. El servidor lo pasa al modelo entre etiquetas de datos (`<resultado_consulta>`) y ya no admite otra consulta: como mucho, dos llamadas al modelo, y solo cuando se pregunta por datos.
- **Excepción del lint, acotada:** `@angular-eslint/no-experimental` está desactivada solo en `core/tools/app-tool.ts`, el único fichero que usa la API de WebMCP. El resto de la app sigue usando solo APIs estables, y un cambio de la API se queda en ese fichero.
- **Prompt v4** (`docs/prompt-history.md`): qué hace cada herramienta, cuándo usarla, que nunca sirven para dar código y que solo ve los datos de este alumno.

**Alternativas:**

- **_Tool calling_ nativo** (`tools` de la API de chat, con la respuesta como una herramienta más, `respond`, y `tool_choice: "required"`): se implementó como un modo más del proveedor (`responseFormat: "tools"`) y se comparó con la batería. Con `gemini-3.5-flash-lite` acertó mejor la consulta del progreso, pero falló en las acciones: no llamaba a `respond` (y el alumno recibía la respuesta por defecto) o no llamaba a la herramienta que decía usar. El campo del JSON usó bien las acciones y funciona igual en toda la cadena de respaldo (D-044). El modo nativo queda disponible por modelo, para compararlo con `gemini-3.8-flash` en el 3.1. No cambia nada fuera del proveedor.
- **Consultas en el servidor:** habría que escribir cada consulta tres veces (SQL en la Edge Function, Angular para WebMCP y el tutor simulado) y la demo con datos simulados no las tendría.
- **Un resumen del progreso en cada petición:** encarece todas las llamadas y distrae en las pistas.
- **Ejecutar todas las acciones al momento:** un modelo barato puede pedir una que nadie pidió; abrir otra página o recargarla espera a un botón (la anotación `consequentialHint` de WebMCP separa lo mismo).
- **`playReaction`** (prevista en el inventario): nuestro tutor ya elige la reacción de cada respuesta, así que sobraba.
- **El polyfill `@mcp-b/webmcp-polyfill` en los tests:** un `modelContext` de prueba de pocas líneas comprueba lo mismo sin otra dependencia.

**Consecuencias:**

- Migración `20261112100000_tutor_actions.sql`: columna `actions` y `record_tutor_interaction` con un argumento más.
- La primera llamada de una consulta no queda en `tutor_interaction`, así que no cuenta para el límite de 6 por minuto: como mucho, el doble de llamadas en las preguntas de datos.
- WebMCP sigue siendo experimental (en Chrome, con el flag `enable-webmcp-testing`), pero ya está registrado con la API de Angular: se comprobó en la app con un `modelContext` de prueba. La demo, con el Model Context Tool Inspector.
- El 2.5f añade las herramientas que solo usa nuestro tutor (esqueleto, formatear, ejecutar, entregar, practicar de nuevo y `proposeFix`) sobre este registro.

**Aprobación:** el autor pidió las consultas de datos, aprobó hacerlas en el front, la valoración objetiva y el reparto en dos pasos. El transporte (campo del JSON tras la prueba), el «Deshacer» de los ajustes y la excepción del lint, por delegación del autor, que pidió decidir lo más lógico.

## D-052 · La frontera de `proposeFix`, en el contrato y en el sandbox, y las herramientas que solo usa nuestro tutor (12/11/2026)

**Contexto:** el paso 2.5f (D-047) añade las herramientas que tocan el código o la entrega: esqueleto, formatear, ejecutar, entregar, practicar de nuevo y `proposeFix`. Esta última tiene que corregir lo que impide ejecutar el código, nunca lo que hace fallar las pruebas. El plan decía «un error de nombre», pero D-047 pone `lenght` como ejemplo, y en JavaScript `v.lenght` no lanza nada: devuelve `undefined` y las pruebas fallan sin error. Además, el tutor está cerrado en un intento entregado (2.4: el servidor responde 409), que es justo donde tendría sentido «practicar de nuevo».

**Decisión:**

- **Qué es un despiste de escritura** lo decide una función pura del contrato (`checkFix()` en `data/tutor/code-fix.ts`, sin imports), nunca el modelo:
  - cambia una línea o añade una que solo cierra (`}`), con tres cambios como mucho;
  - los únicos cambios posibles son signos de cierre, separadores y comillas (`` ( ) [ ] { } ; , ' " ` ``), o un nombre que nadie declaró por otro conocido casi igual: palabras del lenguaje, sus métodos más usados o lo que declara el código (funciones, variables, parámetros, desestructuración y `catch`);
  - casi igual quiere decir una letra en las palabras cortas y dos en las largas, contando como una el intercambio de dos letras (`retrun`);
  - también vale renombrar la función a la que pide el ejercicio, si el código aún no la declara;
  - nunca cambia operadores, puntos ni números: `i < n` → `i <= n` se rechaza siempre, también junto a un `)` que falta.
- **El servidor lo prueba en el sandbox** (`code-actions.ts`): antes del cambio, el código no carga, le falta la función o una prueba lanza un error de nombre (`ReferenceError`, «is not a function»); después, ese error desaparece. Un arreglo que solo cambia nombres puede venir de un código que no lanza nada (`lenght`), y basta con que el código arreglado tampoco lance nada. Con el código cargando y fallando por la lógica, el tutor solo señala y da pistas.
- **Una nota en la petición y un respaldo del servidor** (tras la prueba del autor con Supabase local): Flash-Lite dejó de proponer el arreglo porque tomaba «arréglame el código» por una petición de la solución. Cuando el código no se ejecuta, una nota le recuerda que arreglar un despiste no es dar la solución. Y si el código no se ejecuta por un nombre mal escrito y el modelo no propone el arreglo, el servidor lo busca (`suggestFix()`) y lo añade si pasa la misma comprobación. Nunca en una intervención del tutor por su cuenta.
- **La app lo vuelve a comprobar al pulsar «Aplicar»,** contra el código de ese momento, con la misma función. Antes de pulsar, el chat enseña el cambio («Línea 5: retrun → return»), para que el alumno vea el despiste y aprenda. Si ya lo corrigió él o el código cambió, lo dice en lugar del botón.
- **Al escribir en el editor** (insertar o aplicar), solo entra la parte que cambia, como un cambio del historial (Ctrl + Z) que no cuenta como pegado (2.8). La línea queda marcada con una nota y el foco pasa al editor, que en el móvil también cambia de pestaña.
- **`insertSkeleton` la añade el servidor** con el esqueleto del 2.5d, con los mismos nombres de parámetros (`skeletonParameters()`), y no la ofrece si el código ya declara la función. El modelo no la ve (`fromServer`): ya pide el esqueleto con `skeleton`, y una herramienta menos ayuda al modelo barato.
- **Formatear, ejecutar y entregar** van con un botón. El servidor descarta formatear y ejecutar sin código, y entregar si el intento no está superado. Entregar abre el diálogo de siempre, y si el alumno pulsa «Seguir revisando», el chat lo dice.
- Todas se declaran donde está lo que tocan: `CodeZone` tiene el editor y «Entregar», y `runTests` va en las herramientas del ejercicio. Ninguna se abre a WebMCP.
- **`practiseAgain` se descarta:** el tutor está cerrado en un intento entregado (2.4), y «Practicar de nuevo» ya está a un clic en esa pantalla.
- **Prompt v5** (`docs/prompt-history.md`).

**Alternativas:**

- **Que el servidor calcule el arreglo él solo** (`suggestFix()`, que usa el tutor simulado): encuentra los nombres mal escritos, pero no un `)` que falta sin probar candidatos en el sandbox. El modelo propone y el servidor comprueba.
- **Solo errores que se lanzan, como decía el plan:** dejaría fuera `lenght`, el ejemplo de D-047, que en JavaScript no lanza nada.
- **Limitar el tamaño en caracteres:** `i < n` → `i <= n` es un carácter, y es la solución. Lo que se limita es qué clase de cambio es.
- **Mostrar el arreglo sin vista previa:** el alumno no vería qué se le escapó, y aplicar a ciegas no enseña.
- **Un «Deshacer» en el chat:** el deshacer de CodeMirror solo deshace el último cambio, y el alumno puede haber escrito después. El foco en el editor deja Ctrl + Z a mano.

**Consecuencias:**

- `TutorToolDefinition` gana `fromServer`. `actionView()` recibe el código para enseñar el arreglo. `CodeEditor` gana `code()`, `replaceCode()` y `focus()`, y `format()` dice qué ha hecho.
- Un fallo de una acción con botón se nombra por su botón («No se ha podido hacer: Abrir el siguiente ejercicio»).
- Las inserciones del tutor no son pegados (2.8). Queda en pendientes registrarlas como eventos del proceso para el panel docente.

**Aprobación:** el autor aprobó el plan con sus dos puntos (`lenght` con la regla de los nombres, y `practiseAgain` descartada) y las mejoras propuestas. El diseño de la frontera, por delegación del autor.

## D-053 · El despliegue en la nube: configuración pública en el código, gratis y con un límite diario del tutor (12/11/2026)

**Contexto:** el paso 3.1 publica la app en Supabase en la nube y en Vercel. El `environment.ts` de producción seguía sin servicios de datos desde la fase 1, Vercel publicaba la demo simulada, y el seed local lleva la contraseña de prueba en todas las cuentas. El autor pide planes gratuitos siempre (quizá pago solo el día de la demo) y el muestrario en producción solo para la administración, sin crear un rol nuevo.

**Decisión:**

- **La URL y la clave publicable del proyecto van en `environment.ts`,** como las locales: son públicas por diseño (la RLS protege los datos, no la clave). Así cada build es el mismo en macOS, en Windows y en Vercel, sin variables de entorno ni scripts que las inyecten.
- **Vercel publica el build `production`,** que sustituye a la demo simulada en la misma URL. El build `demo` sigue para los e2e y las capturas.
- **Cabeceras de seguridad en `vercel.json`:**
  - una CSP con `default-src 'self'`, la conexión solo a la propia app y a Supabase (HTTPS y WebSocket del Realtime) y `frame-ancestors 'none'`;
  - los scripts, con `autoCsp` de Angular, que añade al `index.html` los _hashes_ de sus scripts en línea (el cargador de la CSS crítica) y `strict-dynamic`; la cabecera permite `'unsafe-inline'` en los scripts solo para no bloquear esos _hashes_, y la política de Angular, más estricta, manda;
  - los estilos, con `'unsafe-inline'`: Angular, Material y CodeMirror insertan `<style>` y un sitio estático no puede dar un _nonce_ por petición;
  - además, `nosniff`, `Referrer-Policy`, `Cross-Origin-Opener-Policy` y `Permissions-Policy` con el micrófono solo para la propia app (Web Speech).
- **El muestrario en producción, solo para la administración** (`adminDevRoutes`): las mismas rutas de `dev.routes.ts` con `roleGuard('admin')`. No depende de los datos simulados; para otro rol no existe y su código no se descarga. La barra de desarrollo y las cuentas de demostración siguen fuera de producción (D-014): actúan sobre los datos simulados y llevan la contraseña de prueba. Sin rol «dev»: el enum, las RLS, los guards y la pantalla de usuarios cambiarían para lo mismo que ya hace el administrador.
- **Las cuentas de la nube, con contraseñas aleatorias:** `npm run seed -- --cloud` escribe en `tmp/cloud/` (ignorado) el mismo seed con 24 caracteres aleatorios por cuenta y un CSV para el gestor de contraseñas. Se aplica con `supabase db query --remote -f` y se borra. El historial del seed se queda: el panel docente de la demo necesita datos.
- **Auth de la nube declarada en `config.toml`** (`[remotes.production]`): `supabase config push` aplica el registro cerrado y la URL de la app, revisable con `config diff`, sin tocar el panel a mano.
- **Límite diario del tutor: 60 llamadas por alumno en 24 horas,** además de las 6 por minuto. El plan gratuito del proveedor limita las llamadas del proyecto entero al día, así que ningún alumno puede gastar la cuota del resto. Se lee de una vez (`latest_tutor_calls` con la ventana del día; las del minuto son las más recientes). En la app, una espera de más de un minuto (`isLongWait()`) dice «Has llegado al límite de preguntas de hoy» y el botón «Reintentar a las 14:32», no una cuenta atrás de miles de segundos.
- **Recarga ante un chunk viejo** (`reloadOnStaleChunk`): cada despliegue cambia los nombres de los chunks perezosos, y una pestaña abierta antes falla al navegar a una pantalla que no había visitado. El router la carga de cero una vez; si vuelve a fallar en 10 s, enseña el error, sin bucles.
- **Respaldo gratuito del tutor:** Flash-Lite con 10 s, y detrás `gemma-4-31b-it` y `gemma-4-26b-a4b-it` con 30 s, de la misma API y clave y con cuota propia (en el seed y en la nube). El día del despliegue Google tuvo Flash-Lite saturado en el plan gratuito y el tutor no respondía; con la cadena, respondió Gemma. Un proveedor de otra empresa (Groq) queda en pendientes: Mistral ya no da clave gratuita sin más.
- **Smoke e2e contra la URL pública** (`npm run smoke`, proyecto `smoke` de Playwright, opcional): sin servidor local; la URL y la cuenta de Lucas por defecto, y la contraseña la pide sin mostrarla, igual en macOS y Windows. Recorre el tutor real y falla si la CSP bloquea algo o si faltan las credenciales.

**Alternativas:**

- **Variables de entorno de Vercel con `--define` o un script que escriba el `environment.ts`:** más piezas para dos valores públicos, y un build local distinto del de Vercel.
- **Solo la política de Angular (`autoCsp`), sin cabecera:** una etiqueta `<meta>` no admite `frame-ancestors` ni restringe las conexiones como la cabecera.
- **Crear las cuentas con la API de administración y la `service_role`:** la contraseña no pasaría por un SQL, pero obliga a tener la `service_role` en el equipo. El SQL se ejecuta una vez por HTTPS y el fichero se borra.
- **Un rol «dev»:** ver arriba.

**Consecuencias:**

- `authUsersStatement()` acepta una contraseña o una función por cuenta; `seed.sql` lleva la contraseña en cada fila.
- `secondsToWait()` gana la ventana (un minuto por defecto) y `limits.ts`, `dayBefore()`.
- `PageReloader` gana `open(url)`.
- La guía `docs/DESPLIEGUE.md` es el procedimiento repetible, y sirve para la memoria.
- El plan gratuito de Supabase pausa el proyecto tras una semana sin uso: se restaura desde el panel.

**Aprobación:** el autor fijó los planes gratuitos y el muestrario solo para la administración; el resto, por delegación del autor.

## D-054 · La sesión en vivo: a quién atender y qué explicar a todos, descrito sin clasificar (13/11/2026)

**Contexto:** el paso 4.1 hace la pantalla que el docente mira en plena clase. El plan pedía tres tarjetas («Necesitan ayuda», «Constancia», «Para revisar») y una tabla. Al probarlas, el autor no las vio útiles: repetían la tabla, obligaban a leer listas largas y no decían qué hacer. También pidió no clasificar a nadie, ni por esfuerzo ni por sospecha de copia, y que la pantalla funcione con datos simulados y reales a la vez.

**Decisión:**

- **La pantalla responde a las dos decisiones del docente en clase,** como en los paneles de aula de la investigación (Lumilo, de Holstein, McLaren y Aleven, 2018–2019, que guiaba al docente hacia quién atender):
  - **«A quién atender»:** una cola de quien necesita al docente donde el tutor no llega. Los motivos tienen en cuenta lo que ya hizo el tutor: pistas agotadas (tuvo la de nivel 3 y sigue fallando), fallos seguidos de la misma prueba (diciendo si pidió pistas, porque evitar la ayuda es otro problema), pistas en ráfaga sin probarlas (`HINT_RUSH_COUNT = 3`), inactividad y salida de la ventana.
  - **Orden de la cola:** primero lo que es del código, después la inactividad y por último quien está fuera, que quizá ni está delante de la pantalla; dentro de cada grupo, quien lleva más rato esperando, como manos levantadas. Ordenar solo por tiempo dejaba a un alumno recién atascado detrás de quince que llevaban media hora quietos.
  - **«Atendido»** quita al alumno de la cola hasta que aparece un motivo posterior (cada señal lleva su `since`). Vive en memoria: es una ayuda de la sesión, no un dato del alumno.
  - **«La clase en el bloque»:** una barra apilada por ejercicio y la prueba que más falla ahora en la última ejecución de cada alumno, con «Para explicar a todos» desde 3 alumnos (`COMMON_FAILURE_STUDENTS`).
  - **Debajo, la tabla de todo el alumnado** con buscador; las observaciones (pegados, ráfagas de entregas, constancia) son chips de la fila, no tarjetas.
- **Describir, no clasificar:** cada texto da el dato («Entregó tras pegar 400 caracteres, sin ejecutar las pruebas»), nunca el juicio («copia»). Sin rankings ni etiquetas sobre la persona; los patrones son indicios para que el docente abra el intento y decida (§2.8).
- **Ventana de sesión de 60 minutos** (`LIVE_WINDOW_MINUTES`): lo anterior es historia y no da señales. Sin ella, el seed (con fechas pasadas) llenaba la pantalla de «atascados» de hace semanas.
- **Fuera de la ventana** (`awaySince()`): una salida sin vuelta. Cualquier evento posterior cuenta como vuelta: una pestaña cerrada y abierta más tarde no registra la vuelta y el alumno se quedaba «fuera» para siempre.
- **Datos simulados y reales a la vez:** `LiveService` con `listGroups()`, `snapshot()` y `watch()`. La versión simulada escucha los cambios de `MockDb` (también los de otra pestaña, con el evento `storage`); la de Supabase, Realtime de `attempt` y `process_event` (migración que los añade a `supabase_realtime`), filtrado por la RLS.
- **El `watch` empieza dentro del loader del `resource()`** y guarda lo que llega mientras carga la foto, para aplicarlo después; cada carga tiene su número, y un cambio de una selección anterior se ignora.
- **Container queries** para decidir entre tabla y tarjetas: el menú lateral ocupa sitio y el ancho de la ventana no decía cuánto tenía la tabla.
- **Simulador en la barra de desarrollo** (`ClassSimulator`): escribe en `MockDb` como lo haría el servidor, así que la pantalla recibe los cambios igual que con Realtime.

**Alternativas:**

- **Las tres tarjetas del plan, filtros sobre la tabla o un mapa de alumnos por ejercicios:** el autor los descartó por redundantes o poco útiles en clase.
- **Varias vistas con un botón para cambiar:** la cola y la clase arriba y la tabla debajo caben en una pantalla; otra vista añadiría un clic sin dar nada nuevo.
- **Guardar «Atendido» en la base de datos:** sobrevive a recargar y lo ve otro dispositivo, pero añade tabla y RLS para una ayuda de la sesión; queda en pendientes.
- **Guardar los eventos que llegan antes que su intento:** el cliente crea el intento antes de registrar eventos y Realtime los entrega en ese orden; se da por supuesto en lugar de añadir un búfer.

**Consecuencias:**

- `is-stuck.ts` exporta `stuckReason()`, `failureStreak()` y `lastActivityAt()`; nuevos `awaySince()` y `lastBreakthrough()` en `shared/`.
- `MockDb.onChange()` notifica cada cambio de tablas.
- El 4.1 absorbe el progreso por ejercicio y las pruebas que más fallan del 4.1b, que se queda con la actividad en directo (≈2 h).
- El Realtime no se filtra por grupo en el canal: llega todo lo que la RLS deja ver y el cliente se queda con lo del grupo. Basta para una clase; con muchos grupos, filtrar por asignaciones (en pendientes).
- La regla de i18n del lint ignora atributos de configuración de Material y del router (`matColumnDef`, `queryParamsHandling`, `start`, `subscriptSizing`), como ya hacía con `appearance` o `align`.
- La migración de Realtime se aplica en la nube con `supabase db push --remote`.

**Aprobación:** el autor eligió la cola, la clase por ejercicio y la tabla con buscador, «Repitiendo» para las prácticas y las señales descriptivas sin rankings; el resto, por delegación del autor.

## D-055 · El detalle del intento: datos propios, el directo del panel y el tutor por Realtime (13/11/2026)

**Contexto:** el paso 4.2 hace el detalle de un intento (RF-12, CU-04 flujo 3a), que se abre desde la cola o la tabla de la sesión en vivo. `AttemptService.history()` ya daba el intento con sus eventos e interacciones, pero no quién es el alumno, el ejercicio con sus pruebas ni su grupo y bloque. Además, el docente suele abrirlo mientras el alumno sigue trabajando.

**Decisión:**

- **`LiveService.attemptDetail(id)`,** en el servicio del docente y no en el del alumno. En una sola petición (Supabase) da el intento con su alumno, su ejercicio con todas las pruebas, su grupo y bloque, sus eventos y sus interacciones. Así un enlace directo funciona sin depender de lo que tenga cargado el panel. Un intento sin asignación o ajeno es `not_found`.
- **El directo llega por el `LiveStore` de la ruta padre,** sin otra suscripción: el detalle junta lo cargado con lo que oye el panel (`mergeById()`, `latestAttempt()`). Si la URL no lleva el grupo y el bloque del intento, se corrigen con `replaceUrl`, así el store vigila ese bloque y «Volver a la sesión» vuelve a él.
- **`tutor_interaction` entra en Realtime** (migración `attempt_detail_realtime`, con su test en pgTAP), con la RLS de siempre: el docente ve en directo lo que su alumno pregunta al tutor. `LiveUpdate` gana el tipo `interaction`, y el estado del panel las guarda por alumno. El 4.1b podrá usarlas en el feed.
- **Línea temporal como función pura** (`attemptTimeline()`): cada respuesta del tutor una sola vez, emparejada con el evento de pista o intervención que se guardó con ella (el servidor los escribe a la vez; margen de 60 s para los datos simulados); las pistas sin respuesta guardada y las intervenciones en las que el tutor calló, aparte; la salida de la ventana junto con su vuelta; los silencios de 5 min o más, marcados. Filtros por categoría (pruebas, tutor, pegados y salidas), y las cifras del intento en `attemptFigures()`.
- **El código en solo lectura respeta D-029:** el editor no copia cambios externos, así que si el alumno lo cambia aparece «El código ha cambiado · Ver el actual», que crea otro editor. Para crearlo sin el aviso NG0956 de `@for` con un solo elemento, el editor alterna entre dos ramas de un `@if` (`editorGeneration`).
- **Página y vista separadas:** `AttemptDetailPage` carga y muestra los estados (cargando, error, no encontrado); `AttemptDetailView` pinta un intento cargado, sin comprobaciones de «aún no hay datos».
- **`TutorMessage` pasa a `shared/`,** porque ahora lo usan el alumno y el docente.
- **La cola del store tipa sus filas con la señal obligatoria** (`QueuedRow`).
- **El simulador de la clase escribe también las respuestas del tutor y el código,** como el servidor, para que el detalle se pueda probar sin Supabase.

**Alternativas:**

- **Ampliar `AttemptService.history()`:** es el servicio del alumno; mezclar ahí los datos del docente (nombre, pruebas ocultas) confundiría quién puede leer qué.
- **Cargar solo lo que tiene el panel:** un enlace directo o un intento de otro bloque no funcionaría.
- **Recargar las interacciones cuando llega un evento de pista:** las preguntas no generan evento; Realtime de la tabla es más simple y completo.
- **`replaceCode()` del editor en solo lectura:** contradice D-029, y el editor lo ignora en solo lectura.

**Consecuencias:**

- La migración de Realtime se aplica en la nube con `supabase db push --remote`.
- Las capturas incluyen `07-detalle` (`e2e/screenshots/screens.ts`).

**Aprobación:** el plan del paso, aprobado por el autor; el resto, por delegación del autor.

## D-056 · La actividad en directo: solo avances, dos líneas y sin región viva (13/11/2026)

**Contexto:** el paso 4.1b añade a la sesión en vivo un feed corto de lo que pasa en el bloque y la actividad de la clase en los últimos 30 minutos. La sesión ya tiene la cola (quién necesita ayuda), la clase por ejercicio y la tabla con todas las observaciones de cada alumno, y D-054 pide describir sin clasificar ni vigilar.

**Decisión:**

- **El feed cuenta solo avances** (`liveFeed()`): empezar un ejercicio que no es el primero o repetir uno, superar una prueba que había fallado 3 o más ejecuciones seguidas (`RECOVERY_FAILURES`), superar todas las pruebas (una vez, hasta que una ejecución vuelva a fallar) y entregar. Los pegados y las salidas de la ventana ya están en la tabla y en la cola; en el feed serían una lista de vigilancia. Abrir el primer ejercicio tampoco sale: toda la clase lo hace a la vez al empezar y taparía lo demás. Las rachas de fallos cuentan también las ejecuciones anteriores a la ventana.
- **8 noticias de los últimos 30 minutos** (`FEED_SIZE`, `LIVE_ACTIVITY_MINUTES`), con el nombre del alumno como enlace a su intento, como en la cola y la tabla.
- **La actividad son dos líneas por minuto, ejecuciones y pistas** (`activityByMinute()`), en un SVG propio sin librerías: las pistas subiendo más que las ejecuciones dicen que la clase se atasca, algo que una sola línea de «acciones» escondería. Las líneas se distinguen también por el trazo; la gráfica es decorativa y los totales de la leyenda y el minuto con más actividad van en texto.
- **«Lo último» no es una región `aria-live`:** sus «Hace N min» cambian cada minuto y el lector de pantalla los leería sin parar. La cabecera ya anuncia cuando cambian las cifras.
- **Disposición:** «Actividad» bajo la cola y «Lo último» bajo «La clase en el bloque», para que las dos columnas queden parejas y la gráfica tenga ancho.
- **La pestaña del detalle dice el alumno y el ejercicio** («Ana García · Validar un correo electrónico · TutorIA», WCAG 2.4.2), con `AppTitleStrategy.setScreenTitle()`, después de corregir la URL al bloque del intento: esa navegación vuelve a poner el título de la ruta.
- `preserveAspectRatio` y `vector-effect` entran en los atributos que la regla de i18n del lint ignora, como `d` o `stroke-linejoin`: son del dibujo, no texto.

**Alternativas:**

- **Feed con todos los eventos:** demasiado ruido y un tono de vigilancia contrario a D-054.
- **Agrupar las noticias iguales** («12 alumnos empezaron el ejercicio 1»): más complejo y, sin la apertura del primer ejercicio, apenas hace falta.
- **Una sola línea de actividad, o barras:** una línea no distingue trabajar de atascarse, y 30 barras dobles en una tarjeta estrecha se leen peor que dos líneas.
- **Una sola tarjeta con la gráfica y el feed:** dejaba una columna mucho más larga que la otra.
- **Librería de gráficas:** no compensa para dos líneas y el plan ya pide gráficas propias (4.4).

**Consecuencias:**

- Las capturas del paso salen con el seed, sin actividad reciente: la gráfica y el feed muestran sus estados vacíos. Con datos se comprueban con el simulador.
- El feed y la gráfica salen del mismo estado del `LiveStore`, así que funcionan igual con Supabase sin consultas nuevas.

**Aprobación:** el plan del paso, aprobado por el autor; la disposición, el filtro del feed y la región no viva, por delegación del autor.

**Sustituida en la parte del feed por D-068 (4.1e):** «Lo último» y `liveFeed()` ya no existen. La gráfica sigue, como «Ritmo de la clase», con una frase que la lee y solo con los minutos completos (D-070).

## D-057 · El banco de ejercicios: por asignaturas, de su autor y con el código en inglés (15/11/2026)

**Contexto:** el paso 4.3 construye el banco de ejercicios y su formulario. El banco es común a todo el centro y a todas sus asignaturas (D-029), y hasta ahora cualquier docente podía editar o borrar cualquier ejercicio. El tutor escribía el esqueleto de la función con los nombres de parámetros que proponía el modelo, que podían salir en español (`count(palabra)`). El paso era demasiado grande para una sesión: los pendientes que apuntaban a él lo doblaban.

**Decisión:**

- **El paso se parte en tres:** 4.3 (banco y formulario), 4.3b (bloques y asignaciones) y 4.3c («Traducir con IA», «Probar mi solución», «Probar como alumno» y el formulario como herramienta de WebMCP).
- **El banco trae por asignaturas** (`listBank(scope)`): por defecto, las de los grupos del docente; también una concreta o todas, que se piden al servidor. Así lo que se descarga crece con la asignatura del docente, no con el centro. Buscar, filtrar por dificultad y por autor y paginar (20 por página) se hacen sobre lo cargado, al instante, y viven en la URL. Mientras llega otra asignatura se queda lo que se ve, con una barra fina encima. Cada ejercicio necesita al menos una asignatura: sin ella, nadie lo encontraría.
- **Cada ejercicio es de su autor:** solo él o la administración lo cambia o lo borra, con sus pruebas y sus asignaturas (`can_edit_exercise()` en la RLS). Los demás lo ven en solo lectura y lo duplican para adaptarlo. El banco dice «Tuyo» o «De otro docente», sin el nombre, así que la RLS de `app_user` no cambia.
- **Guardar es una sola transacción:** `save_exercise()` crea o actualiza el ejercicio y reemplaza sus pruebas y sus asignaturas. Es `security invoker`, así que la RLS decide, y un ejercicio ajeno da «no encontrado».
- **El uso de un ejercicio se ve antes de tocarlo:** `exercise_student_counts()` cuenta los alumnos que lo han empezado en cualquier grupo, solo la cifra. El formulario avisa al editar uno empezado, y el banco no deja borrarlo (sus intentos lo guardan).
- **El código, en inglés y sin mezclas:** el ejercicio guarda los nombres de sus parámetros (`exercise.parameters`, identificadores ASCII distintos). El tutor los usa siempre en el esqueleto y en el «Insertar», los pone en el prompt y no acepta un esqueleto del modelo con otros nombres. El formulario lo recomienda con un ejemplo. Los 42 ejercicios del seed los tienen, y los tests del proyecto dejan de usar `suma`, `sumar(vector)` o `contarVocales`.
- **El formulario vive en la página, con Signal Forms:** el modelo son los textos que teclea el docente (una pestaña por idioma; argumentos y resultado en JSON), y `toDraft()` los convierte al guardar. Las pestañas y la lista de pruebas son componentes que editan su rama del formulario. La vista previa reutiliza la zona del enunciado de la pantalla de trabajo, con el idioma de la pestaña.
- **Los botones flotan como el tutor:** «Nuevo ejercicio» es un botón flotante extendido, y guardar va en un panel flotante del color de los paneles, los dos abajo a la derecha.

**Alternativas:**

- **Hacer todo el paso en una sesión:** más de 10 horas, en contra de los pasos cortos.
- **Traer el banco entero:** con miles de ejercicios de otras asignaturas, la mayor parte de lo descargado no le sirve al docente.
- **Búsqueda y paginación en el servidor:** sin necesidad con el tamaño de una asignatura y con más complejidad (búsqueda sin tildes en JSON, una espera tras cada tecla y esperas a cada filtro). Queda en [PENDIENTES](PENDIENTES.md) si una asignatura llega a miles.
- **Editar cualquier ejercicio del banco:** un docente cambiaría las pruebas de los grupos de otro sin saberlo.
- **Mostrar el nombre del autor:** obliga a abrir la RLS de `app_user` a todos los docentes, y para elegir un ejercicio basta saber si es propio.
- **«Probar mi solución» en el navegador:** con los datos simulados funciona, pero en producción la CSP prohíbe `new Function` y el sandbox de verdad está en el servidor. Pasa al 4.3c con la Edge Function `execute`.
- **Una barra de guardar de lado a lado:** no existe en ninguna otra pantalla y desentonaba.

**Consecuencias:**

- `SEED_VERSION` sube a 9: los datos simulados guardados en un navegador se descartan, porque no tenían los parámetros.
- Los ejercicios de Programación avanzada del seed pasan a ser del otro docente, para ver un banco con ejercicios ajenos.
- El prompt del tutor cambia («Función que se pide: sum (parámetros: numbers)»): falta pasar la batería contra el modelo real.
- La pantalla de trabajo y el formulario comparten `StatementZone`, que admite un contenido sin asignación y un idioma.

**Aprobación:** el plan y la partición, aprobados por el autor; los parámetros en inglés, a petición suya; los botones flotantes y el banco por asignaturas, a partir de sus preguntas; el resto, por delegación del autor.

## D-058 · Bloques y asignaciones: una pantalla propia, el orden en el servidor y solo se borra lo que nadie empezó (15/11/2026)

**Contexto:** el paso 4.3b da al docente la gestión de los bloques de cada grupo y de los ejercicios asignados en ellos (D-046), con su orden y una fecha de entrega opcional (D-054). Hasta ahora las asignaciones solo existían en el seed: `ExerciseService` tenía `assign` y `unassign`, que ninguna pantalla usaba, la asignación no tenía orden (iba por su id) y borrarla dejaba los intentos de los alumnos sin asignación, fuera del catálogo y de la analítica. El formulario de grupos (`/docente/grupos`) es del 5.2 y trata de la matrícula.

**Decisión:**

- **Una pantalla propia, «Bloques»** (`/docente/bloques?grupo=`), en el menú del docente junto a «Ejercicios», con el grupo en la URL. El banco gana «Asignar a un bloque…» para no tener que salir de él.
- **Un servicio propio, `BlockService`,** con los grupos del docente, los bloques de un grupo con sus ejercicios y cuántos alumnos los han empezado, y las operaciones de bloques y asignaciones. `ExerciseService` se queda con el banco y deja sus tres métodos de asignación: una responsabilidad por servicio, como pide la guía de Angular.
- **El orden lo cuenta el servidor:** `exercise_assignment.position`, única por bloque y aplazable como la de los bloques. Crear un bloque y asignar ejercicios (`create_block`, `assign_exercises`) ponen las posiciones al final, y reordenar (`reorder_blocks`, `reorder_assignments`) escribe el orden completo en una transacción y rechaza uno al que le falte o le sobre alguna fila. Todas son `security invoker`: decide la RLS.
- **Solo se borra lo que nadie empezó:** las políticas de borrado de `class_block` y `exercise_assignment` lo exigen (`is_started_block`, `is_started_assignment`), y el bloque se borra con sus asignaciones (`on delete cascade`). Las claves ajenas no pasan por la RLS, así que borrar un grupo o un ejercicio sigue funcionando. Para retirar lo empezado, se oculta. La pantalla lo dice antes («Borrar (ya tiene intentos)», «Quitar (ya tiene intentos: ocúltalo)») y lo comprueba después.
- **Todo responde al momento:** cada acción cambia la lista en la página y la guarda; si el servidor dice que no, vuelve atrás y lo dice. «Quitar del bloque» tiene «Deshacer», que lo devuelve a su sitio con su fecha y su visibilidad. Ordenar se hace arrastrando o, con el teclado y en el móvil (sin asas), con «Subir» y «Bajar», y se anuncia al lector de pantalla.
- **La fecha de entrega describe, no juzga (D-054):** día y hora (sin hora, a las 23:59), también para todo un bloque de una vez. El alumno la ve en el catálogo («Entrega: vie 20 nov, 23:59 · en 5 días») hasta que entrega, y entregar después de la fecha sigue siendo posible. `DueLabel` y `dueDistance()` están en `shared/` para el histórico (4.4).
- **Fechas en el idioma de cada uno:** el adaptador nativo de Material lee las fechas tecleadas con `Date.parse`, que solo entiende el orden americano. `LocalizedDateAdapter` las lee en el orden del idioma de la interfaz («25/11/2026» en español y catalán).

**Alternativas:**

- **Los bloques dentro de «Grupos» (5.2):** mezclaba la matrícula con la docencia y obligaba a adelantar esa pantalla.
- **Seguir con las asignaciones en `ExerciseService`:** un servicio con dos responsabilidades y más de 15 métodos.
- **Calcular las posiciones en el cliente:** dos pestañas podían chocar, y un orden a medias quedaba guardado si fallaba una de varias peticiones.
- **Dejar borrar lo empezado, como hasta ahora:** los alumnos perderían ese trabajo en su catálogo y el docente en la analítica, sin que nadie lo viera venir.
- **Bloquear la entrega pasada la fecha:** contradice D-054, que pide describir sin sancionar.

**Consecuencias:**

- Migración `blocks_and_assignments`, con 19 tests de pgTAP, y `SEED_VERSION` 10, con fechas de entrega en cinco bloques.
- El catálogo, el panel en vivo y el detalle del ejercicio ordenan por la posición de la asignación, no por su id.
- `MatDialog` crea su contenido con el inyector raíz: los diálogos de la pantalla se abren con el de la página para recibir los valores por defecto del área.
- Quedan para un paso posterior (propuestos, en [PENDIENTES](PENDIENTES.md)): fecha de apertura de un bloque y duplicar un bloque en otro grupo.

**Aprobación:** el plan, aprobado por el autor; el detalle técnico y las mejoras (asignar desde el banco, fecha para todo el bloque, «También en», «Deshacer»), por delegación del autor.

## D-059 · Probar y traducir ejercicios: en el servidor, sin guardar nada, y el formulario como herramienta explícita de WebMCP (15/11/2026)

**Contexto:** el paso 4.3c tenía cuatro piezas para unas 3 h: «Traducir con IA», «Probar mi solución», «Probar como alumno» y el formulario como herramienta de WebMCP con la opción `experimentalWebMcpTool` de Signal Forms (D-051). Al leer el código salieron tres cosas. «Probar como alumno» necesita un modo de vista previa en la función `tutor`, que construye el prompt a partir del intento guardado y registra cada respuesta, y una pantalla de trabajo que hoy depende del intento, de la asignación y de los eventos. La herramienta implícita de Signal Forms deduce su esquema del valor inicial del modelo y falla con una lista vacía (`subjectIds: []` en un ejercicio nuevo), no describe los campos ni cierra sus valores (`difficulty` sería un texto cualquiera) y, al llamarla, reemplaza el modelo y **guarda**. Y la traducción la hace un modelo, que puede traducir el código del enunciado (`` `countWords("hola mundo")` `` → `` `contarPalabras("hello world")` ``).

**Decisión:**

- **«Probar como alumno» pasa a un paso propio, el 4.3e (propuesto),** con el tutor en vista previa. Lo aprobó el autor.
- **«Probar mi solución», en `execute` y sin intento:** el cuerpo `{ code, functionName, tests }` (`SolutionCheck`, en el contrato compartido `run-result.ts`) se ejecuta en el mismo sandbox y se compara igual que el de un alumno, pero el resultado trae también el detalle de las pruebas ocultas (`buildRunResult(…, { revealHidden: true })`), porque las escribió el docente. No se guarda nada: ni el código, ni un evento, ni el estado. En producción la CSP no deja ejecutar código en el navegador (D-057), así que va al servidor; con los datos simulados, al Web Worker. Cada prueba del formulario dice «Tu solución la supera» mientras la prueba siga igual.
- **«Traducir con IA», una Edge Function propia, `translate`,** con la cadena de modelos del tutor (D-044). El proveedor (`llm-provider.ts`, `provider-setting.ts` y `providerForSetting()`) pasa a `_shared/`. El prompt pide no tocar el código, y **el servidor lo comprueba** (`keepsCode()`): cada texto entre comillas invertidas del original sigue en la traducción, al menos tantas veces, y también los nombres que solo pueden ser identificadores (`countWords`, `max_value`); un nombre que también es palabra (`sum`, `text`) se puede traducir donde es palabra. Los contenidos tienen que ser los mismos, en el mismo orden. Una traducción que no cumple se pide otra vez diciendo qué falló; si vuelve a fallar, 502 y ningún borrador. El borrador llega con un aviso y «Deshacer», y se da por revisado cuando el docente lo cambia.
- **Solo para el profesorado, con límite por minuto:** `claim_staff_request()` comprueba que quien llama es docente o administración con la cuenta activa y cuenta la petición en `staff_request` (10 comprobaciones o 5 traducciones por minuto), con un candado por usuario y tipo para que dos peticiones a la vez no se cuelen. La tabla guarda cuándo y de qué tipo, nunca el código ni los textos.
- **El formulario como herramienta explícita, `fillExerciseForm`,** en nuestro registro (`declareAppTool`) y abierta a WebMCP. Tiene un esquema con descripciones y valores cerrados, que se valida con `checkToolArguments()`. Las asignaturas van por su nombre, sin mirar mayúsculas ni tildes. Rellena el formulario **sin guardar** y devuelve los errores que quedan, marcados junto a cada campo. El docente revisa y guarda. Es lo que pedía el pendiente del 2.5e y lo mismo que separa la anotación `consequentialHint` (D-051). La excepción del lint sigue solo en `app-tool.ts`.
- **Accesibilidad:** el resultado de la comprobación se anuncia («6 de 6 pruebas superadas») y el aviso del borrador es un `role="status"`. El `lang` de cada pestaña pasa a los campos: antes estaba en toda la pestaña, y las etiquetas y avisos de la interfaz se leían con la pronunciación del otro idioma.

**Alternativas:**

- **La herramienta implícita de Signal Forms:** no puede inferir el esquema de un ejercicio nuevo y guarda sin que el docente lo revise. Se puede volver a ella cuando Angular permita describir el esquema y separar rellenar de enviar.
- **Ejecutar la solución en el navegador:** con los datos simulados sí, pero en producción la CSP no deja evaluar código (D-057).
- **Traducir en la función `tutor`:** mezclaba dos responsabilidades y su límite por alumno.
- **Confiar en el prompt para conservar el código:** un modelo barato lo traduce a veces, y el error lo vería el alumno.
- **Limitar por minuto en memoria:** cada instancia de la función tiene la suya, así que no limita nada.

**Consecuencias:**

- Migración `staff_requests` (tabla, tipo y `claim_staff_request`), con 9 tests de pgTAP. `config.toml` sirve la función `translate`; con Supabase ya arrancado, hay que reiniciarlo.
- Las traducciones usan la misma clave y cuota que el tutor (`AI_API_KEY` y respaldos).
- Probado con `gemini-3.5-flash-lite` en cuatro casos, todos a la primera y con el código intacto. Queda en [PENDIENTES](PENDIENTES.md) medir cuántas traducciones rechaza `keepsCode()` con más ejercicios. «Probar como alumno» es el 4.3e.

**Aprobación:** el plan, con «Probar como alumno» en el 4.3e, aprobado por el autor. El autor recordó que la traducción no puede tocar los nombres de las funciones ni de las variables: la comprobación del servidor responde a eso. El detalle técnico, por delegación del autor.

## D-060 · Más sobre bloques: fecha de apertura en la RLS, archivar en lugar de borrar y mover ejercicios con sus intentos (15/11/2026)

**Contexto:** el 4.3d se propuso al cerrar el 4.3b (D-058) con tres piezas: la fecha de apertura de un bloque, duplicar un bloque en otro grupo y archivar ejercicios. Al empezarlo, el autor preguntó para qué servía duplicar un bloque. El caso real es preparar un curso a partir del anterior o de un grupo paralelo, y eso es copiar todos los bloques de un grupo, no uno. También preguntó si tenía sentido borrar ejercicios: un ejercicio que nadie ha empezado se puede borrar sin perder nada, pero uno empezado lo guardan los intentos de sus alumnos (D-057), y hasta ahora solo quedaba un «Borrar (ya tiene intentos)» desactivado. Por último, mover un ejercicio de un bloque a otro exigía quitarlo y añadirlo, y solo si nadie lo había empezado.

**Decisión:**

- **Fecha de apertura, en la RLS:** `class_block.opens_at` (opcional). Mientras no llega, el bloque es para sus alumnos como uno oculto: la política de lectura de `class_block` y `is_visible_assignment()` piden `opens_at is null or opens_at <= now()`. Así el alumno no ve el bloque ni sus ejercicios, y tampoco abre intentos (`can_open_assignment`). El docente lo ve siempre, con «Se abre el lun 23 nov, 09:00 · en 8 días» hasta entonces. En el diálogo del bloque, día y hora opcionales; sin hora, a las 0:00 (`DEFAULT_OPENING_TIME`), y con hora pero sin día, un error. `create_block()` admite la fecha como sexto argumento, opcional.
- **Archivar, no borrar, lo que alguien empezó:** `exercise.archived_at`, que cambia quien puede editar el ejercicio (la misma política, con su `grant update` de columna). El menú del banco ofrece «Archivar» y «Borrar» si nadie lo ha empezado, y solo «Archivar» si alguien lo hizo. Un archivado sale del banco (hay un interruptor «Archivados», en la URL, que los muestra en lugar de los demás), de «Añadir ejercicios» y de «Asignar a un bloque…», y en su menú tiene «Desarchivar». Sigue en los bloques donde ya estaba, con «Archivado» en Bloques: sus alumnos lo siguen viendo y trabajando. El formulario añade «Archivar» al aviso de un ejercicio empezado y un aviso propio con «Desarchivar». Archivar tiene «Deshacer» y no pregunta, porque se deshace.
- **Lo archivado se filtra en el cliente:** `listBank` sigue trayendo los archivados, y `filterBank()` enseña unos u otros. El servidor no impide asignar un archivado: es una forma de ordenar el banco, no una regla de seguridad, y desarchivarlo lo arregla.
- **Mover un ejercicio a otro bloque, empezado o no:** `move_assignment(asignación, bloque, posición)`, con seguridad del invocador (la RLS decide quién mueve), cierra el hueco en el bloque de origen y hace sitio en el de destino en una transacción (restricción de orden diferida). Los intentos apuntan a la asignación, que solo cambia de bloque, así que nadie pierde su trabajo. Un ejercicio está una sola vez en cada bloque (23505). En la pantalla, «Mover a otro bloque» abre un submenú con los demás bloques del grupo (desactivados los que ya lo tienen) y lo lleva al final; también se arrastra de un bloque a otro (listas de la CDK conectadas y un predicado que rechaza el bloque que ya lo tiene), al sitio donde se suelta. Se ve al momento, se anuncia, vuelve atrás si falla y el aviso tiene «Deshacer», que lo devuelve en el servidor y recarga los bloques.
- **Duplicar un bloque, fuera del paso:** pasa a [PENDIENTES](PENDIENTES.md) como copiar los bloques de un grupo en otro, para la fase 5 (gestión de grupos) o trabajo futuro.

**Alternativas:**

- **La fecha de apertura solo en el cliente:** el alumno vería el bloque llamando a la API.
- **Un estado del bloque (borrador, programado, publicado):** duplicaba lo que ya dicen `is_hidden` y la fecha.
- **Borrar un ejercicio empezado con sus intentos:** el alumno perdería su trabajo y el docente su histórico.
- **Ocultar el ejercicio en todos sus bloques al archivarlo:** quitaba el ejercicio a quien lo está haciendo; archivar es para el banco, y ocultar sigue siendo cosa de cada bloque.
- **Mover como quitar y añadir:** crea otra asignación, y los intentos se quedarían en la antigua.
- **«Deshacer» de mover en la página, sin recargar:** obligaba a buscar de nuevo el ejercicio y su bloque, que pueden haber cambiado; el servidor sabe dónde está todo.

**Consecuencias:**

- Migración `block_opening_and_archive`, con 18 tests de pgTAP. `BlockDraft.opensAt`, `BlockService.moveAssignment()` y `ExerciseService.setArchived()`, en simulado y Supabase. Seed v11: «Tabla de multiplicar» archivado y «Examen de los temas 5 y 6», que se abre el 23 de noviembre.
- El catálogo del alumno no necesita cambios: la RLS (y su imitación en `mock-access.ts`) ya le quita el bloque.
- Queda en [PENDIENTES](PENDIENTES.md) copiar los bloques de un grupo en otro.

**Aprobación:** el autor dejó duplicar un bloque para más adelante y aprobó archivar y mover. El detalle técnico, por delegación del autor.

## D-061 · Probar como alumno: la pantalla de trabajo en un diálogo, con servicios en memoria, y el tutor en vista previa sin guardar nada (16/11/2026)

**Contexto:** el 4.3e se separó del 4.3c (D-059) porque «Probar como alumno» necesitaba dos cosas que no había. La función `tutor` construye el prompt a partir del intento guardado y registra cada respuesta. Y la pantalla de trabajo depende del intento, de la asignación y de los eventos. El plan ponía la pantalla en una ruta del docente. Pero lo que se quiere probar es el ejercicio tal como está en el formulario, guardado o no: al salir del formulario hacia otra ruta se perdían los cambios sin guardar.

**Decisión:**

- **Un diálogo a pantalla completa sobre el formulario, no una ruta.** El docente prueba, cierra, corrige una prueba y vuelve a probar sin perder nada. «Probar como alumno» está en la cabecera del formulario, también en un ejercicio ajeno (antes de asignarlo), y espera a que la función y las pruebas sean válidas, diciendo por qué. Lo aprobó el autor.
- **La misma pantalla de trabajo, sobre servicios en memoria.** De `WorkspacePage` sale `WorkspaceLayout`, con las zonas, las pestañas del móvil, los divisores, el tutor flotante y las reacciones. La página se queda con la ruta, la cabecera y las señales del navegador. El diálogo provee los mismos stores (`AttemptStore`, `TutorStore`, `BrowserSignals`, `EditingTab`) sobre otras versiones de los servicios de datos, en `teacher/exercises/tryout/`:
  - `TryoutAttemptService`: los intentos, las ejecuciones y las respuestas, en memoria, con las reglas del servidor (2.4).
  - `TryoutCodeRunner`: «Ejecutar» va a `check` (`execute` sin intento, D-059) y oculta el detalle de las pruebas ocultas, como lo ve el alumno.
  - `TryoutTutorService`: cada turno va a `TutorService.tryOut()` con el ejercicio y la prueba hasta entonces.
  - `TryoutEventService`: los eventos no van a ninguna parte (un `EventLogger` propio los dirige allí).
  - `tryoutTools()`: `getExerciseStats` responde con la prueba, no con los ejercicios asignados, que el docente no tiene.

  Los servicios que sustituyen llegan a los de la app con `inject(…, { skipSelf: true })`.

- **El tutor en vista previa, en la misma función `tutor`:** el cuerpo lleva `preview` (ejercicio, estado, última ejecución y turnos anteriores) en lugar de `attemptId`, validado con su esquema (`preview.ts`). Responde lo mismo que a un alumno: el nivel de pista, el código probado con los ejemplos, la respuesta validada y las acciones comprobadas, con el mismo camino del manejador (`answerTurn`). Pero **no llama a `recordAnswer`**: ni `tutor_interaction` ni `process_event`. Solo para docentes y administración, con su propio límite por minuto (`claim_staff_request('tutor')`, 6 como un alumno). Los turnos anteriores los manda el navegador: es el docente probando su propio ejercicio, así que solo se comprueba su forma.
- **Nada dice que se guarda:** en la prueba, la zona del código no muestra «Guardado» ni lleva al catálogo o al siguiente ejercicio (`preview` en `CodeZone` y `WorkspaceLayout`). Un aviso dice «No se guarda nada».
- **«Empezar de nuevo» crea la prueba otra vez:** la pieza interior (`TryoutWorkspace`) provee todo, y el diálogo la vuelve a crear, así que no queda ningún guardado pendiente del intento anterior. El foco va al título, también al abrir.
- **Esc no cierra el diálogo:** la pantalla de trabajo lo usa para plegar el tutor y dentro del editor, y perder la prueba por accidente sería peor. Se cierra con su botón, y el foco vuelve a «Probar como alumno».

**Alternativas:**

- **Una ruta del docente con el borrador en un servicio raíz:** el formulario se destruye al salir, así que habría que reconstruirlo al volver, y la guarda de cambios sin guardar preguntaría cada vez.
- **Una pestaña nueva del navegador:** el borrador tendría que viajar por `sessionStorage` o un `BroadcastChannel`.
- **Una Edge Function aparte (`tutor-preview`):** duplicaba la validación, el prompt y la comprobación de acciones, y el plan pedía un modo de la misma función.
- **Un intento de prueba guardado en el servidor (`open_attempt` sin asignación, la idea del 2.5c):** ensuciaba las tablas que lee la analítica y obligaba a borrarlo.
- **Componer las zonas de nuevo en el diálogo, sin `WorkspaceLayout`:** unas 200 líneas duplicadas que se separarían con el tiempo.

**Consecuencias:**

- Migración `tutor_preview` (`staff_request_kind` con `tutor`), con 4 tests de pgTAP. El de `staff_requests` cuenta ya solo las filas de su tipo.
- `TutorService.tryOut()`, en simulado (el guion, sin registrar nada) y en Supabase. Los turnos del guion aceptan los de una prueba.
- Probado contra Supabase local con el modelo real: una pista de nivel 1 con su acción, sin filas en `tutor_interaction`, y 403 para un alumno.
- Queda en [PENDIENTES](PENDIENTES.md) probar desde el banco sin abrir el formulario.

**Iteración 1 (revisión del autor):** el autor vio redundante «Ver como el alumno» y preguntó por la X a la izquierda. Se quita «Ver como el alumno» y su diálogo: «Probar como alumno» ya muestra el enunciado como lo leerá el alumno, y ahora se abre en el idioma de la pestaña abierta del formulario (`TryoutExercise.locale`, `openLocale` de `ExerciseTexts`), que era lo único que aportaba el otro. Solo se pierde ver el enunciado antes de tener pruebas válidas, que ya está en el formulario. La zona del enunciado pone `lang` siempre que el texto no está en el idioma de la interfaz, no solo cuando falta la traducción (WCAG 3.1.2). La X se queda a la izquierda: es la pauta de Material 3 para los diálogos a pantalla completa y el sitio de «Volver» en la pantalla del alumno. Lo aprobó el autor.

**Aprobación:** el plan, con el diálogo a pantalla completa en lugar de una ruta, aprobado por el autor. Aclarado que en producción todo va contra el servidor real (`execute` y el modelo de IA) y que solo no se guarda nada. El detalle técnico, por delegación del autor.

## D-062 · Revisión de seguridad de la base de datos: el docente lee por grupo, límites a lo que escribe el navegador y permisos más estrechos (16/11/2026)

**Contexto:** antes de usar la aplicación con alumnos reales se revisó la base de datos como lo haría alguien con una cuenta y la API, sin pasar por las pantallas: las políticas, los permisos de columna, las funciones y lo que publica Realtime. Lo importante aguantó: las pruebas ocultas no se leen por ningún camino, el estado de un intento solo lo escribe el servidor, nadie cambia su rol y un visitante sin sesión no lee nada. Aparecieron dos problemas de gravedad media y varios menores, comprobados en local:

- Un docente leía todo lo que hacían sus alumnos, también en los grupos de otros docentes (`teaches_student()`): al matricular a un alumno en un grupo de otro docente, este pasaba de 0 a 7 intentos, 15 mensajes al tutor y 34 eventos de asignaturas que no imparte. Era lo que decía §2.3 («a través de `enrollment`»), pero no la minimización de §2.10.
- Lo que el navegador escribe directamente no tenía límite: la tabla aceptaba un código de 5 MB y 20 000 eventos en una petición, con cualquier fecha. El panel en vivo carga los eventos de cada intento del bloque y recibe cada uno por Realtime, así que un alumno podía dejarlo sin responder.

**Decisión:**

- **El docente lee los intentos de las asignaciones de sus grupos,** no los de sus alumnos en general: `teaches_assignment()` en la política de `attempt` y en `can_read_attempt()`, de la que cuelgan `tutor_interaction` y `process_event` (y Realtime, que aplica las mismas políticas). Un intento sin asignación (se borró su grupo) lo leen su alumno y la administración. `teaches_student()` sigue decidiendo de qué alumnos lee el nombre.
- **El código de un intento, hasta 50 000 caracteres:** el mismo límite que ya aplican las Edge Functions (`MAX_CODE_LENGTH`), ahora también en la tabla.
- **Los eventos del navegador, acotados:** el detalle es pequeño (100 bytes: son un número), la hora queda entre la apertura del intento y la llegada del evento (se ajusta, no se rechaza: un reloj desajustado no debe perder eventos), y un intento admite 300 por minuto y 3000 en total. Es mucho más de lo que produce un alumno (la app los envía en lotes de 20) y poco para saturar el panel. Un lote que se pasa se rechaza entero y la app no lo reintenta.
- **El aviso de datos se acepta una vez, con la hora del servidor:** desde el navegador, `privacy_notice_seen_at` solo pasa de vacío a ahora. El servidor puede vaciarlo para volver a pedirlo si el aviso cambia.
- **Permisos de columna en asignaciones y bloques:** el docente cambia el bloque, el orden, la visibilidad y la fecha de una asignación, pero no su ejercicio ni su grupo; de un bloque, todo menos el grupo. Antes podía apuntar una asignación con intentos a otro ejercicio.
- **Solo los alumnos de un grupo abren intentos:** `can_open_assignment()` ya no deja al docente ni a la administración, que desde el 4.3e prueban sin intento (D-061). Su intento contaba como un alumno más y, una vez abierto, la asignación no se podía borrar.
- **Un ejercicio asignado en grupos de otros docentes no lo borra su autor:** borrarlo se llevaba esas asignaciones sin aviso. Sí lo borra mientras solo esté en sus grupos, como hasta ahora; si no, lo archiva (D-060). El mensaje del banco pasa a «Ya está en uso: no se puede borrar, pero sí archivar», que vale también cuando alguien lo acaba de empezar.
- **Ninguna función abierta a `anon`:** se cierran las tres que lo estaban (validadores de las tablas, sin riesgo) y `function_privileges.test.sql` falla si una migración olvida su `revoke` o concede una función de más a `authenticated`.

**Alternativas:**

- **Dejar la lectura por matrícula, como decía §2.3:** un docente no necesita el trabajo de otra asignatura para atender la suya, y es justo lo que el RGPD pide minimizar. Si la analítica (4.4) quiere mostrar algo de otras asignaturas, que sea un agregado con su propia función.
- **Quitar el permiso de `PUBLIC` por defecto para todas las funciones nuevas (`alter default privileges for role postgres`):** es un valor global del rol, que alcanza también a las extensiones que instale y a las funciones temporales de los tests. Se probó y rompía cuatro ficheros de tests; el test que vigila los permisos da la misma garantía sin ese alcance.
- **Rechazar los eventos con una hora imposible:** un portátil con el reloj mal perdería todos sus eventos.
- **Limitar los eventos con una función en lugar de la inserción directa:** cambiaba el camino de la app y el envío con `keepalive`; el disparador da el mismo límite sin tocar el cliente.
- **`on delete restrict` en las asignaciones de un ejercicio:** impedía también borrar el que solo está en los bloques del autor, que la pantalla ya avisa y permite.

**Consecuencias:**

- Migración `security_review` y tests de pgTAP en los ficheros de cada tema (211 en total), con uno nuevo, `function_privileges`. Los servicios simulados imitan las reglas nuevas (`canReadAttempt`, `findOpenableAssignment` y el borrado en `mock-access.ts` y sus servicios).
- §2.3 del plan dice ya «de las asignaciones de sus grupos».
- Si en la nube hay intentos abiertos por docentes antes del 4.3e, siguen contando como alumnos: hay que mirarlo al publicar la migración. Queda en [PENDIENTES](PENDIENTES.md), con el cierre de un bloque (ocultarlo no impide entregar a quien ya lo tenía abierto), la configuración de Auth y la revisión de las Edge Functions.

**Aprobación:** el autor pidió la revisión y, vistos los hallazgos, la migración con los arreglos propuestos. Acotar la lectura del docente era una decisión suya: se hace como se recomendó y queda a su revisión. El detalle técnico, por delegación del autor.

## D-063 · Revisión de seguridad de las Edge Functions: turnos contados antes, hosts de IA permitidos, sandbox que corta las expresiones regulares e intento abierto (16/11/2026)

**Contexto:** tras la base de datos (D-062) se revisaron `execute`, `tutor` y `translate` como lo haría alguien con una cuenta y la API directa, probando cada hallazgo en local (el tutor, contra un proveedor simulado). Aguantó lo esencial: la sesión y la propiedad del intento, la cuenta desactivada, los límites del personal, el aislamiento del sandbox y que al modelo no viajan pruebas ocultas ni soluciones. No aguantaron: los límites del tutor y de las ejecuciones (leían y después escribían: 70 pistas a la vez, 28 atendidas con el límite en 6; las preguntas que piden datos no contaban), la URL de `app_setting.ai_provider` (con una sesión de administración la clave de la IA viajaba a cualquier servidor), una expresión regular catastrófica (tumbaba el worker sin contar como ejecución), que un intento siguiera ejecutando y gastando tutor con su bloque oculto o su alumno fuera del grupo, y un validador de «sin código» que solo miraba el principio de cada línea.

**Decisión:**

- **Los turnos se cuentan antes, de uno en uno:** `claim_student_request` (tabla `student_request`, bloqueo por usuario y tipo, como `claim_staff_request`) reserva la ejecución o el turno del tutor antes de lanzar el sandbox o llamar al modelo. Cuenta también lo que falla, lo que mata la función y el turno en que el modelo pide datos. Las ejecuciones pasan a contarse por usuario. El personal tiene además un tope diario en lo que llama al modelo (200 traducciones y 200 turnos de vista previa).
- **Los datos de una consulta solo se aceptan si el tutor la hizo:** `tutor` guarda la consulta que pidió el modelo (`tutor_pending_query`) y toma los resultados una vez, de ese usuario y esa petición, durante diez minutos; el segundo viaje no cuenta otro turno. Si el proveedor falla con los datos en la mano, no se vuelven a aceptar: el chat reintenta la pregunta desde el principio, y eso cuenta un turno (revisión posterior: guardarlos otra vez dejaba repetir sin límite un viaje que no cuenta mientras el proveedor fallara).
- **La clave solo viaja a hosts permitidos:** el del proyecto (`generativelanguage.googleapis.com`) y los del secreto `AI_ALLOWED_HOSTS`, por `https` salvo que el secreto diga `http://…` (un modelo local). La llamada no sigue redirecciones (`redirect: error`): un host permitido no puede mandar la petición a otro. Quien pone las claves dice adónde pueden ir; la administración sigue cambiando de modelo sin desplegar, pero no de destino. Un modelo de otro host se ignora, y si es el principal no hay proveedor. La tabla exige además la forma: URL web, modelo y hasta cinco respaldos.
- **QuickJS 0.32.0:** su motor comprueba el reloj dentro de las expresiones regulares, así que la catastrófica agota su prueba (250 ms) como un bucle infinito. Da además la línea en más errores.
- **Un intento se trabaja mientras su alumno ve la asignación y sigue en el grupo** (`is_open_attempt`): si no, `execute` y `tutor` responden 403. Guardar código y entregar no cambian: es la decisión del cierre de un bloque, que sigue en PENDIENTES.
- **Las pruebas ocultas se ejecutan después de las visibles:** el estado del código dura toda la ejecución, y así lo que vio de una oculta no puede volver en el valor de una visible.
- **El validador rechaza también el código dentro de una línea:** una declaración con su valor, la cabecera de un bucle, una función con su llave, una asignación tras una etiqueta («Línea 3: …») y las sentencias entre comillas invertidas. Nombres, expresiones y formatos del enunciado (`i < n`, `clave=valor`) siguen pasando. Las 179 respuestas reales guardadas de la batería de elusión pasan todas.
- **Prompt v6:** la regla de no escribir código nombra las mismas formas que rechaza el validador, la de los datos entre etiquetas sube junto a ella, el nivel 3 lleva un ejemplo con palabras y `elusion` dice qué cuenta. Sin probar con el modelo real: falta la batería de elusión.
- **Menores:** ninguna función lee más de 1 MB de cuerpo (413), y el nombre de función de la comprobación docente y de «Probar como alumno» es un identificador.

**Alternativas:**

- **Lista de hosts en la base de datos:** quien robara una sesión de administración la cambiaría igual que el ajuste.
- **Ejecutar el sandbox en un Worker que se pueda matar:** más piezas y arranque más lento; el motor nuevo resuelve el caso encontrado, y el turno contado antes acota lo que quede.
- **Devolver de las ocultas solo cuántas pasan:** el oráculo sigue (un bit por ejecución con cualquier condición) y el alumno pierde saber cuál falla. Se acepta el resto: el docente ve el código y cada ejecución.
- **Contar los dos viajes de una pregunta con datos:** partía por la mitad lo que un alumno puede preguntar sin gastar más de lo que ya permite un turno.

**Consecuencias:**

- Migración `edge_functions_review` y `latest_tutor_calls` eliminada. La batería de elusión borra los turnos del alumno en cada caso y necesita `AI_ALLOWED_HOSTS` para probar otro proveedor.
- Los servicios simulados imitan el intento abierto (`requireOpenAttempt`).
- Al publicar: migración, funciones y, si hay otro proveedor, el secreto `AI_ALLOWED_HOSTS`.

**Aprobación:** el autor pidió la auditoría y, vistos los hallazgos, que se arreglara todo decidiendo lo más útil. Las decisiones de producto (lista de hosts fuera de la base, 403 con el bloque oculto, no agregar las ocultas) quedan a su revisión.

## D-064 · El tutor proactivo: en puntos de corte, una vez por episodio y con un bocadillo de dos estados (16/11/2026)

**Contexto:** el 6.2 decía «cooldown entre intervenciones» y poco más. Un tutor que habla sin que le pregunten puede ayudar o estorbar: interrumpir a quien está escribiendo, repetirse ante quien no le hace caso o hablarle a una pantalla vacía. Además gasta turnos del alumno (6 por minuto y 60 al día, en planes gratuitos). Había siete filas en `PENDIENTES.md` esperando este paso: las ausencias, el ajuste, el motivo del logro, el atajo «Pregúntale al tutor», el bocadillo de dos estados, el arreglo de despistes y quién decide que una petición es proactiva.

**Decisión** (propuesta en el paso 6.2a, de diseño):

- **Solo en puntos de corte naturales:** justo después de una ejecución (la misma prueba falla N veces seguidas, o se supera una que se resistía) o tras N minutos sin actividad. Nunca mientras el alumno escribe.
- **Tres motivos** (`failures`, `idle` y `achievement`), que viajan en la petición. Los dos primeros son los de `stuckReason()`, y el logro, `lastBreakthrough()`: el tutor y el panel docente leen lo mismo.
- **Una vez por episodio, leído de los eventos:** otros N fallos para volver a hablar de fallos, una sola intervención por parón y una por logro. El evento `proactive_intervention` guarda el motivo, así que no hay estado que se pierda al recargar.
- **Cooldown de 3 minutos** desde cualquier turno del tutor, también los que pidió el alumno y las intervenciones calladas. Los logros no lo esperan. **Tope de 5** intervenciones de ayuda por intento.
- **El cliente calla sin gastar turno** si la proactividad está desactivada, el alumno está fuera de la pestaña o sin conexión, el tutor o una ejecución están ocupados o hay una pregunta a medio escribir. Un logro que no puede salir al momento se pierde.
- **Todo en una función pura,** `proactiveReason()`, que comparten el cliente y el servidor (D-065).
- **Bocadillo de dos estados** con el tutor plegado: «pensando» solo cuando el alumno ha preguntado con el atajo «Pregúntale al tutor», y después la respuesta. Una intervención entra directamente con la respuesta. Nunca mueve el foco ni abre el tutor, y se puede cerrar.
- **El atajo entra en el 6.2d** junto a los ejemplos visibles que fallan; el de la línea del error se queda para la fase 7.
- **La reacción de una intervención de ayuda sale reducida;** la de un logro, completa.
- El 6.2 se parte en 6.2a (diseño), 6.2b (lógica), 6.2c (servidor) y 6.2d (interfaz), y pasa de ≈6 h a ≈7 h por el atajo.

**Alternativas:**

- **Intervenir en cuanto se cumple el umbral, también a mitad de escritura:** más simple, pero interrumpe justo cuando el alumno está probando algo.
- **Recordar los episodios en memoria del monitor:** recargar la página repetiría la intervención, y el servidor no podría comprobar nada.
- **Cooldown que se alarga si el alumno ignora al tutor:** más fino, pero «ignorar» es difícil de definir; el episodio único y el tope ya evitan la insistencia.
- **«Pensando» también en las intervenciones:** si el modelo decide callar, el bocadillo habría prometido algo que no llega.
- **Dejar el atajo para el pulido:** el estado «pensando» se quedaría sin nada que lo encienda.

**Consecuencias:**

- `docs/PLAN.md` §2.6 (el campo `reason`), §2.7 y §2.8, y la ficha 04.
- `TutorRequest` y el `detail` de `proactive_intervention` ganan `reason` (6.2b).
- Los tiempos (15 s, 3 min, 5 intervenciones) son constantes con nombre: se ajustan tras probarlo con alumnos.

**Aprobación:** propuesta. El autor pidió el diseño y, ante la duda del atajo, que se decidiera lo mejor.

## D-065 · El servidor comprueba por qué se acerca el tutor, y el prompt lo sabe (16/11/2026)

**Contexto:** `kind: 'proactive'` lo elige el navegador (pendiente de la auditoría, D-063): con la API directa, un alumno podía pedir ayuda sin que quedara como pista pedida. El modelo, por su parte, recibía «el alumno puede estar bloqueado, decide si intervenir», sin saber qué había pasado, y no distinguía ayudar de celebrar (D-017).

**Decisión** (propuesta en el paso 6.2a; se implementa en el 6.2c):

- **`reason` es obligatorio en una petición proactiva** y el servidor lo vuelve a calcular con `proactiveReason()` sobre sus datos: los eventos `run` y `proactive_intervention`, la última actividad y el último turno del intento. Con holgura por los relojes: cooldown de 2 minutos (3 en el cliente) y 30 segundos menos de inactividad.
- **Si el motivo no cuadra, responde `silent`** sin llamar al modelo y sin registrar evento. El turno ya está contado (D-063).
- **Una intervención nunca sube el nivel de pista** y queda registrada con su motivo. Quien la fuerce con la API obtiene, como mucho, lo que el tutor le habría dicho solo, a su ritmo y a la vista del docente.
- **Prompt v7:** el servidor da al modelo el motivo con sus hechos (qué prueba y cuántos fallos, cuántos minutos parado, qué acaba de superar) y qué se espera en cada uno: una o dos frases en el nivel actual que acaban ofreciendo seguir, o una frase que celebra sin pistas. El modelo sigue pudiendo callar, y se le dice cuándo: si su última respuesta trataba de lo mismo o no tiene nada nuevo.
- **Sin herramientas en una intervención,** salvo el arreglo de un despiste de escritura cuando la última ejecución no cargó (D-052): nadie le ha pedido que actúe, pero ese botón es la ayuda más directa y no hace nada hasta que el alumno lo pulsa.

**Alternativas:**

- **Que el servidor decida solo, sin `reason`:** el cliente no sabría qué esperar y un desacuerdo no se podría depurar; con el motivo, la respuesta es sí o silencio.
- **Fiarse del cliente:** era lo que había; cualquiera con la API se saltaba el registro de pistas.
- **Disparar las intervenciones desde el servidor** (Realtime o un cron): el servidor no sabe si el alumno está escribiendo o fuera de la pestaña, y son más piezas en un plan gratuito.

**Consecuencias:**

- La función `tutor` importa `proactiveReason()` de la aplicación, como ya hace con el contrato.
- La vista previa del docente no admite intervenciones.
- Cierra la fila de la auditoría en `PENDIENTES.md`. El prompt v7 queda sin probar con el modelo real hasta que se pase la batería de elusión, como la v6.

**Implementación:** en el paso 6.2c (23/11/2026), con los cambios de D-090: los eventos se leen de forma que el navegador no pueda tapar las intervenciones, los eventos toman la hora de la petición y una intervención descartada se queda guardada.

**Aprobación:** propuesta, a revisión del autor.

## D-066 · La voz en tres piezas, y una llamada por turnos sobre el mismo `TutorStore` (16/11/2026)

**Contexto:** el 6.1 eran seis líneas y ≈6 h para toda la capa 3: síntesis, transcripción editable, selector de voz y un «modo llamada» sin definir. Una conversación hablada tiene problemas que el chat no tiene: quién habla, cuándo acaba un turno, qué pasa si los dos hablan a la vez y qué hace un micrófono abierto en un aula. La memoria pide conversar «por turnos» y revisar la transcripción antes de enviarla (RF-08, CU-02 1a), y que la voz del tutor no sea femenina por defecto.

**Decisión** (propuesta en el diseño del paso 6.1; §2.11 del plan):

- **Tres subpasos que se sostienen solos:** 6.1a, síntesis; 6.1b, dictado; 6.1c, modo llamada. Si falta tiempo, se recorta desde el último y lo anterior sigue siendo voz.
- **`TutorStore` no cambia.** La llamada es `VoiceCall`, un servicio de pantalla como `ProactivityMonitor`, que lee los turnos y pregunta con `ask()`. Voz y teclado se mezclan en la misma conversación, y el servidor no distingue una pregunta dicha de una escrita.
- **Por turnos:** mientras el tutor piensa o habla, el micrófono está cerrado. El turno del alumno acaba tras 1,5 s de silencio.
- **La revisión de RF-08, sin manos:** durante ese silencio el alumno ve lo que el navegador ha entendido y puede seguir hablando, descartarlo (Esc) o pasarlo al campo («Corregir»). En el dictado, la revisión es completa: nunca se envía solo.
- **Interrumpir al tutor,** siempre con un botón, un atajo o escribiendo. Hablando, solo si el alumno dice que lleva auriculares: sin ellos el reconocimiento oiría al tutor. Con ellos, un filtro descarta lo que coincide con la frase que se está diciendo.
- **El tutor no interrumpe al alumno:** las intervenciones proactivas esperan mientras habla, como con una pregunta a medio escribir (D-064).
- **En espera tras 90 s sin voz** y al ocultar la pestaña, con el micrófono cerrado. En un aula, un micrófono abierto todo el rato enviaría a transcribir las voces de los compañeros.
- **Ninguna voz por defecto.** La Web Speech API no dice el género de una voz, así que la aplicación no puede evitar una femenina eligiendo ella: el alumno escoge una de la lista, en orden alfabético y con «Probar», y hasta entonces el tutor no habla.
- **Reconocimiento en el equipo, si el navegador lo ofrece** (`processLocally`, que MDN ya documenta): el audio no sale de él. Si no, el servicio del navegador, con un aviso la primera vez.
- **Leer en voz alta fuera de una llamada, apagado por defecto,** y «Escuchar» bajo cada respuesta: en clase no todos llevan auriculares.
- El 6.1 pasa de ≈6 h a ≈7 h con el diseño.

**Alternativas:**

- **Micrófono siempre abierto y conversación a dos voces:** más natural, pero sin auriculares el tutor se oye a sí mismo, y la Web Speech API no cancela el eco de la síntesis, que la reproduce el sistema.
- **Pulsar para hablar:** sin falsos turnos, pero quita las manos del teclado, que es lo que la llamada evita. Queda como recurso: el atajo de la llamada abre y cierra el micrófono.
- **Una voz masculina o «neutra» por defecto:** no hay forma fiable de saber cuál lo es, y decidirlo por el nombre de la voz sería adivinar.
- **Audio directo con el proveedor de IA** (llamada en tiempo real): descartado en D-043, porque choca con la privacidad (§2.10) y con validar antes de mostrar.
- **Llevar los turnos de la llamada dentro de `TutorStore`:** el store tendría que conocer el micrófono y sus temporizadores, y §4.5 no admite `effect()` en los stores.

**Consecuencias:**

- `docs/PLAN.md` §2.11 (nuevo), §2.6, §2.10, §4.1 y el paso 6.1; las fichas 04 y 05.
- `SettingsStore` gana `voice`, `tutorVoice`, `speechRate`, `readAloud` y `headphones`.
- La tabla de motores por navegador se completa probando en el 6.1a y el 6.1b, y va a la memoria.
- La memoria tiene que contar cómo se revisa la transcripción en una llamada y el reconocimiento en el equipo (`PENDIENTES.md`).
- No se guarda si una pregunta fue hablada: sería un dato útil para la memoria y el docente, pero pide una migración (`PENDIENTES.md`).

**Aprobación:** propuesta. El autor aprobó el plan corto y dejó a criterio del agente lo que quedaba abierto: interrumpir hablando, la voz sin valor por defecto, el reconocimiento en el equipo y no guardar el canal.

## D-067 · Frase a frase: siempre en el cliente; en el servidor, solo si se mide que hace falta (16/11/2026)

**Contexto:** el tutor valida la respuesta entera antes de enviarla (D-043), así que entre la pregunta y el primer texto hay 1–2 s. En el chat lo cubren los tres puntos; en una llamada, un silencio así puede notarse. Quedaba pendiente desde el 2.4: «si la pausa se nota, enviar la respuesta frase a frase, validando cada frase en el servidor». Pero ese cambio rompe la garantía de D-043 (lo dicho no se puede retirar) y toca el proveedor, el validador, el transporte y la batería de elusión.

**Decisión** (propuesta en el diseño del paso 6.1):

- **En el cliente, siempre:** la síntesis dice una locución por frase y encola cada una en cuanto está completa. El tutor empieza a hablar con la primera frase, se le puede cortar entre frases y no hay locuciones largas. No toca el servidor.
- **Medir antes de construir:** el 6.1c mide con el modelo real, en diez turnos, el tiempo de la última palabra al envío, al primer texto y al primer sonido, y lo anota en su bitácora.
- **Umbral:** si la mediana entre el envío y el primer sonido pasa de 2 s, o el autor nota la pausa al probarlo, se hace el 6.1d. Si no, la fila de `PENDIENTES.md` se cierra sin tocar el servidor.
- **El 6.1d, ya diseñado** (§2.11): solo las peticiones de una llamada piden frases (`delivery: 'sentences'`); el modelo responde en streaming con el mensaje al final del JSON; el servidor valida y envía cada frase; un fallo antes de la primera frase reintenta entero, como hoy, y uno posterior corta y cierra con una frase fija. El chat escrito sigue validándose entero.

**Alternativas:**

- **Hacer ya el streaming por frases:** ≈3,5 h y más superficie para la elusión, por una pausa que quizá no se note; la mitad de la espera de una llamada es el silencio que cierra el turno, que se ajusta con una constante.
- **Frases de relleno mientras piensa** («A ver…», «Déjame mirar»): tapan la pausa, pero cansan a la tercera y suenan a truco.
- **Enviar la pregunta antes de que el alumno acabe de hablar:** gasta turnos del alumno (6 por minuto, 60 al día) en preguntas a medias.
- **Streaming también en el chat escrito:** D-043 lo descartó, y ahí la pausa ya está cubierta.

**Consecuencias:**

- `docs/PLAN.md` §2.6, §2.11 y los pasos 6.1c y 6.1d.
- `speakableSentences()` parte el texto con `Intl.Segmenter`, en el idioma de la interfaz.
- Si se hace el 6.1d, `TutorRequest` gana `delivery`, la batería de elusión se pasa también en ese modo y D-043 queda matizada: en una llamada, una frase ya dicha no se retira.

**Aprobación:** propuesta, a revisión del autor.

## D-068 · El panel en vivo, replanteado: cada dato responde a una decisión del docente (17/11/2026)

**Contexto:** el autor probó la sesión en vivo del 4.1 y el 4.1b y no la vio útil. No se sabía en qué grupo y asignatura se estaba (un título genérico y dos desplegables con el texto cortado); con los datos del seed, tres tarjetas vacías; casi ninguna gráfica; listas que crecían sin tope (el feed, la cola y veinticuatro tarjetas de alumnos), y una cola que daba como «a quién atender» cosas que no lo son, como salir de la ventana. Quedaba además por decidir cómo sigue el panel a un grupo que trabaja en bloques distintos (ideas A a E de `PENDIENTES.md`) y qué señales nuevas entran. El paso 4.1c lo replantea sin código.

**Decisión** (propuesta en el diseño del paso 4.1c):

- **Una regla para toda la pantalla:** cada dato responde a una decisión del docente en clase, o no sale. Las decisiones son cuatro: a quién atender, si explicar algo a todos, si el ritmo es el esperado y, solo cuando él lo pregunta, quién no está trabajando. Lo que vale cero no se enseña.
- **El contexto es el título:** el grupo y el bloque en el `h1`, con la asignatura encima; los selectores, compactos.
- **Cuatro cifras, que son también los filtros de la tabla:** «Trabajando ahora», «Necesitan ayuda», «Han terminado» y «Avance del bloque».
- **La cola solo tiene motivos del código,** los que el docente resuelve acercándose: pistas agotadas, fallos seguidos de la misma prueba, atasco en el chat (`isStuckMessage`, pendiente del 2.5d) y pistas en ráfaga. Cada entrada dice la prueba que falla. **Salen la inactividad y la salida de la ventana:** no son algo que atender y, en la cola, vigilaban más que ayudaban. Quedan como «parado» en la cifra «Trabajando ahora» y en su filtro, que el docente abre cuando quiere saberlo. Matiza D-054, que los tenía al final de la cola.
- **Bloques distintos: la idea D, con el bloque como filtro.** La cola y la tabla son siempre de todo el grupo, así nadie queda fuera por trabajar en otro bloque. El selector de bloque elige qué enseña «Dónde está la clase»: un bloque (todos sus ejercicios, y cuántos alumnos trabajan en otros) o «Toda la clase» (los ejercicios en marcha de cualquier bloque, los 5 con más alumnos y «Ver los N»). Al abrir se elige el bloque donde trabaja más de la mitad de la sesión, o «Toda la clase» si ninguno llega; después no cambia solo.
- **«Dónde está la clase» es la gráfica principal,** a dos tercios del ancho, y «Para explicar a todos» solo aparece desde 3 alumnos con la misma prueba fallida, con lo que la prueba espera.
- **«Ritmo de la clase» lleva una frase que lo lee** (`rhythmReading()`): una gráfica que el docente tiene que interpretar en plena clase no le sirve.
- **Nada crece sin tope:** la cola enseña 4 y despliega el resto dentro de su tarjeta; la tabla pagina de 8 en 8; «Lo último» desaparece.
- **Fuera de clase,** la pantalla enseña el estado acumulado del bloque en lugar de tarjetas vacías.
- **Animada, con sentido:** se mueve lo que cambia (las cifras cuentan, las barras crecen, las entradas de la cola llegan y se van, el último punto del ritmo late), y todo se queda quieto con `prefers-reduced-motion`.
- **Dos subpasos:** 4.1d (datos y lógica, con la pantalla de antes funcionando) y 4.1e (la pantalla).

**Alternativas:**

- **A (un bloque elegido a mano, como hasta ahora):** quien trabaja en otro bloque sale «sin empezar» y no entra en la cola.
- **B (la gráfica del bloque más activo, que cambia sola):** con medio grupo en dos bloques, salta de uno a otro y esconde a la mitad.
- **C (pestañas por bloque con actividad):** no escala a muchos bloques.
- **E (dos vistas con un botón):** D-054 ya descartó las vistas; el filtro de bloque da lo mismo en una sola pantalla.
- **Retocar la pantalla del 4.1** (quitar columnas, añadir el bloque a cada fila): fue la primera propuesta del paso; el autor pidió replantearla entera.
- **La inactividad y la salida de la ventana como último grupo de la cola** (D-054): llenaban la cola de alumnos a los que el docente no tiene nada que resolver.
- **El ritmo de escritura** (cientos de caracteres en segundos, pendiente del 2.5c): pide un evento nuevo, da falsos positivos (autocompletado, deshacer, el esqueleto que pone el tutor) y es justo el dato «por salir» y con tono de vigilancia que este replanteo quita. Queda como trabajo futuro.
- **Un mapa de alumnos por ejercicios:** descartado en D-054.
- **Mantener «Lo último»:** era la columna que más crecía y no cambiaba ninguna decisión.

**Consecuencias:**

- `docs/PLAN.md` §2.2 y los pasos 4.1c, 4.1d y 4.1e; la ficha `06-en-vivo`, reescrita.
- `LiveService.snapshot()` pasa a leer el grupo entero en la ventana de sesión, con las interacciones del tutor; el bloque de la URL es opcional.
- `liveFeed()` y su lista se borran en el 4.1e: D-056 sigue valiendo para la gráfica de actividad, no para el feed (hecho).
- Las figuras 9 y 18 de la memoria cambian: capturas nuevas en el 4.1e.
- La fila de «Llamar al profesor» sigue en `PENDIENTES.md`: cuando se haga, será el primer motivo de la cola.

**Aprobación:** propuesta. El autor vio el boceto del replanteo y dejó el resto a criterio del agente, con dos condiciones: que sea útil de verdad para el docente y animado, y que no salgan datos por salir ni la salida de la ventana como algo que atender.

**Hecho así (4.1e):** la pantalla de la ficha, con los cambios de D-070.

**Hecho así (4.1d):** «Toda la clase» es `?bloque=todos`. Sin bloque en la URL, el `LiveStore` elige al abrir y guarda lo elegido en el valor de su `resource()`, no en la URL: el store no navega y no hay dos fuentes de verdad; recargar sin bloque vuelve a elegir, y lo que el docente elige en el selector sí va a la URL. Elegir cuesta dos lecturas como mucho: la del grupo (`snapshot(grupo, null)`) y, si sale un bloque, la del bloque. Un intento «está en la sesión» si su `updatedAt` cae en la ventana (`LIVE_WINDOW_MINUTES`, ahora en el contrato de `LiveService`), el mismo criterio en los datos simulados y en Supabase. Con bloque, Supabase lee a la vez los intentos de la ventana y los del bloque, y los une por id, en lugar de un `or()` con una fecha dentro. El motivo de la cola se apoya en `failureStreak()` (la mitad de `stuckReason()` que mira el código) y el atasco en el chat sigue la misma regla que el tutor (`stuckAgain()`).

## D-069 · El detalle del intento, replanteado: «Ahora», la evolución y nada a cero (17/11/2026)

**Contexto:** el detalle del 4.2 abría con seis cifras, varias casi siempre a cero («Preguntas al tutor 0», «Pegados 0», «Fuera de la ventana 0») y repetidas en los recuentos de los filtros. Para saber dónde estaba atascado el alumno había que leer la línea temporal desde el principio. El autor pidió revisarlo (D-055, `PENDIENTES.md`).

**Decisión** (propuesta en el diseño del paso 4.1c):

- **«Ahora» sustituye a las cifras:** las pruebas que fallan en la última ejecución, con lo que esperan y desde cuántas ejecuciones, y la última ayuda del tutor con su nivel. Es lo que el docente necesita al acercarse. Con el intento entregado, «Cómo lo resolvió».
- **Un resumen en una línea** (tiempo, ejecuciones y pistas con su nivel) y, solo si existen, chips para las preguntas, los pegados y el tiempo fuera: nada que valga cero.
- **«Evolución», la gráfica del intento:** una columna por ejecución, tan alta como las pruebas superadas, con una marca por pista y por pegado. Enseña si avanza, si lleva varias ejecuciones igual o si saltó tras un pegado, sin que la pantalla lo juzgue (D-054). Cada columna lleva a su entrada de la línea temporal.
- **La línea temporal, con lo más reciente arriba** y las ejecuciones seguidas con el mismo resultado agrupadas: la evolución ya cuenta la historia en orden, y la lista se abre para saber qué pasa ahora.
- **El detalle solo necesita el grupo en la URL,** porque el panel sigue a todo el grupo (D-068).

**Alternativas:**

- **Esconder solo las cifras a cero:** quedaba una franja de tamaño cambiante que seguía sin decir dónde está el problema.
- **La línea temporal en orden cronológico, colocada al final:** obliga a mover el desplazamiento desde el código (una API imperativa) y la lista se abre igual por lo último.
- **Guardar el código de cada ejecución para compararlas:** daría mucho a la evolución, pero pide cambiar `execute` y una migración; sigue en `PENDIENTES.md`.

**Consecuencias:**

- `docs/PLAN.md` §2.2 y el paso 4.2b; la ficha `07-detalle`, reescrita.
- `attemptFigures()` se sustituye por `attemptSummary()`; nuevas `attemptNow()` y `attemptRuns()`; `attemptTimeline()` agrupa e invierte.
- Capturas nuevas de `07-detalle` en el 4.2b.

**Aprobación:** propuesta, a revisión del autor, que dejó el diseño a criterio del agente.

**Hecho así (4.2b):** la evolución es una gráfica en HTML con Tailwind y no un SVG: cada columna y cada marca es un `button` de verdad, con su nombre, su foco y 24 px de ancho como mínimo (WCAG 2.5.8). Va por orden y no a escala de tiempo, y se desplaza en su propia zona, que se queda al final. Su nombre lleva lo que se ve («3/6»), por WCAG 2.5.3. Hay un tercer título, «Dónde lo dejó», para un intento sin entregar cuyo alumno no está en la sesión, que es lo que son casi todos los del seed. Quién está «ahora» lo dice la fila del panel. «Minutos de trabajo» suma solo los ratos entre dos momentos seguidos del intento que duran menos que la ventana de la sesión, así que un intento retomado días después no dice «3 d de trabajo». Dos ejecuciones se agrupan si fallan exactamente las mismas pruebas, si no hay nada entre ellas y si no las separa un silencio largo. Los demás intentos del alumno en la asignación llegan con el detalle (`siblings`, embebidos en la misma petición) y ya no dependen del bloque que siga el panel. «Ahora» enseña 4 pruebas como mucho y manda el resto a la línea temporal («y N más»), en lugar de desplegarlas.

## D-070 · El panel en vivo, la pantalla: lo que cambió al construirla (17/11/2026)

**Contexto:** el paso 4.1e construía la pantalla diseñada en el 4.1c (D-068) con su plan de implementación. Una revisión del plan contra el código, pedida por el autor, encontró seis fallos antes de escribir nada. Ya con la pantalla hecha, el autor la probó y la rehízo en varias iteraciones: las tarjetas de cifras que filtraban no se entendían, la página daba saltos al filtrar, las tarjetas de al lado medían distinto y crecían sin tope, sobraba espacio, «Dónde está la clase» no escalaba a muchos ejercicios y los colores eran apagados.

**Decisión:**

- **Filtros: pestañas con su número sobre la tabla,** sin tarjetas de cifras ni números que cuentan. «Todos 24 · Necesitan ayuda 5 · Trabajando ahora 14 · Parados y sin entrar 10 · Han terminado 2», una pestaña por filtro y cada una un enlace a su `?filtro=`: un solo control, la activa se ve, «Todos» quita el filtro y nada se mueve al pulsar. Comparten fila con un buscador en píldora propio (sin la X nativa); el título «Alumnado» queda para el lector de pantalla. «Avance del bloque», que no filtra, va en la cabecera de «Dónde está la clase». Se descartaron las tarjetas que filtran (había que adivinar que eran botones y cómo se quitaba el filtro, y la de avance no filtraba) y unas cifras solo para leer con chips en la tabla (los números salían dos veces).
- **La tabla no mueve la página:** guarda el alto de una página, porque filtrar acortaba la página y el navegador subía el scroll. Su orden por defecto es la cola, la sesión y quien no ha entrado, por nombre dentro de cada parte: con páginas, ordenar por la última actividad pasaba a los alumnos de una página a otra cada pocos segundos. El gris de «no ha entrado», solo en clase. Sin chip de «parado», que repetía la última actividad.
- **«Dónde está la clase» escala:** una fila por ejercicio, con la barra a todo el ancho que queda (igual en todas las filas) y su resumen debajo, cuyas partes son los botones que dicen los nombres y filtran la tabla (`ChartFilter`, también para «Ver quiénes»). Los tramos de la barra no son botones: serían dianas de menos de 24 px (WCAG 2.5.8). Con un bloque, una frase dice dónde está la mayoría y nombra a quien va solo lejos del grueso (`classStrip()`: uno o dos alumnos a más de dos ejercicios, en clases de 6 o más), como un hecho (D-054). Con más de 5 ejercicios, encima, una franja con una columna por ejercicio, que mide lo mismo con 6 que con 200. Fuera de clase, «La prueba que más se falló» solo desde 2 alumnos.
- **Lado a lado, la gráfica y la cola miden lo mismo** (lo que pida la más alta, con un tope de 28 rem) y se desplazan por dentro: ni «Ver los otros N» ni «Ver los N», que con un scroll no tienen sentido. La cola, más compacta: «Atendido» en la línea del nombre y la llamada que falla en una línea, entera al pasar el ratón.
- **El ritmo, una tarjeta baja bajo la cabecera,** todo de datos: a la izquierda la frase, que dice que es de todo el grupo; a la derecha, dos minigráficas del mismo tamaño, ejecuciones y pistas, cada una con su escala (en una sola, las pistas salían planas; dos escalas en un eje engañarían), su número de los 10 últimos minutos y el de los 10 anteriores, y el minuto al pasar el ratón. Compara solo minutos completos: el minuto en curso hacía caer siempre el final de la línea y la frase se inclinaba a «se está atascando».
- **Paleta propia de gráficas,** validada para daltonismo y para el modo oscuro, en tokens del tema (`chart-progress`, `-fail`, `-pass`, `-done`): azul, naranja, turquesa y verde. Los colores de estado de la aplicación no cambian.
- **La pestaña del navegador sigue al grupo** con un `effect()`, la frontera con el título del documento. `AppTitleStrategy` no lo pisa cuando la navegación solo cambia la query o el fragmento (el mismo criterio que `HeadingFocus`): cambiar de bloque o de filtro dejaba «Sesión en vivo».
- **Fuera de clase con toda la clase,** la foto no trae intentos: sin tabla (serían 24 filas vacías), y «Dónde está la clase» ofrece un enlace a cada bloque, que lleva el foco al título.

**Alternativas:**

- **Las cifras como tarjetas-botón con un chip para quitar el filtro,** o junto a la tabla: el autor las rechazó tras probarlas.
- **Un tabulador por barra y flechas entre tramos:** resolvía las paradas de tabulador, no el tamaño de las dianas.
- **Congelar el orden de la tabla mientras se mira otra página, o un aviso «Reordenar»:** el orden dependería de lo que hace el docente.
- **El título en un `ResolveFn` de la ruta:** pediría los grupos en cada navegación.
- **La franja siempre, también con 3 ejercicios:** columnas enormes que no dicen nada que no digan las filas.

**Consecuencias:**

- La ficha 06 describe la pantalla final; la memoria (figuras 9 y 18) la tomará de ella.
- `AppTitleStrategy` cambia para toda la aplicación: una página que pone su propio título lo conserva mientras solo cambie su query.
- `pageOf()` y `prefersReducedMotion()` pasan a `shared/`. `theme.scss` gana los tokens de gráficas y el estilo de las pestañas apretadas (`compact-tabs`), sin su línea propia.
- El plan del 4.2b daba por hechos algunos ID de la cola que ya no existen: corregido en su punto «Del 4.1e».

**Aprobación:** la revisión del plan, aprobada por el autor; la pantalla final, construida con él iteración a iteración y aprobada al cerrar.

## D-072 · Las cuentas: baja con bloqueo, rol sin vínculos y contraseña entregada en persona (18/11/2026)

**Contexto:** la fase 5 da a la administración la gestión de usuarios, grupos y sistema (CU-06, CU-07, RF-16, RF-18 y RF-19). El 5.1a hace la parte de las cuentas: `AdminService` en sus dos versiones y la Edge Function `admin-users`, la única con la API de administración de Supabase Auth (`service_role`). El registro público está cerrado (2.3) y la aplicación no envía correos. Quedaba abierto desde el 2.2 cómo se da de baja una cuenta, sabiendo que Auth dice «User is banned» con cualquier contraseña (D-041).

**Decisión:**

- **La baja es el bloqueo en Auth más `status = disabled`,** como ya hace el seed. Desactivar escribe primero `status` (la RLS se cierra al instante, porque `current_app_role()` y `claim_*_request` lo miran) y después bloquea en Auth con `ban_duration` de cien años (`876000h`); activar va al revés. Así la cuenta nunca está abierta en Auth mientras los datos dicen que está de baja. Se acepta la fuga de «User is banned»: solo dice que ese correo tuvo una cuenta que ya no entra, la frena el límite de intentos de Auth y, a cambio, quien fue dado de baja lee un mensaje claro y no cree que ha olvidado la contraseña. La alternativa (no bloquear y poner una contraseña aleatoria) esconde el dato, pero deja vivas sesiones que se renuevan y da un mensaje engañoso.
- **El rol solo cambia a quien no tiene grupos a su cargo ni matrículas.** Un docente degradado dejaría grupos que nadie gestiona (`teaches_group()` exige el rol) y un alumno ascendido seguiría matriculado. La administración no puede quitarse su propio rol ni desactivarse (CU-06, 3b). Dar de baja a un docente con grupos sí se puede: se va, y sus grupos se reasignan en Grupos (5.2b).
- **Las reglas se escriben una vez,** en `src/app/data/admin/user-rules.ts`, sin importaciones, que usan la función y el servicio simulado, como `tutor-contract.ts`: `userChangeProblem()` (`own_role`, `own_status`, `has_groups`, `has_enrollments`, en ese orden), `normalizeEmail()` y los límites.
- **El correo no se cambia** (es la identidad en Auth) y un correo repetido se rechaza (CU-06, 3a). **La contraseña la pone la administración y se entrega en persona;** también la restablece. Nunca se escribe en un log ni vuelve en la respuesta. El alta crea la cuenta con el correo ya confirmado; el disparador `create_app_user` hace la fila como alumno y la función le pone el rol pedido; si eso falla, borra la cuenta y no queda nada a medias.
- **La contraseña, de 8 a 64 caracteres,** contados como cualquier web: 64 es lo que el NIST pide aceptar como mínimo. bcrypt solo lee 72 bytes, y Auth rechaza una más larga («Password cannot be longer than 72 characters»): eso solo pasa con 64 caracteres llenos de tildes o emojis, y la función lo devuelve como 400 (`invalid`), no como un fallo del servidor. La contraseña se cambia antes que lo demás, así que un rechazo no deja cambios a medias. `minimum_password_length` sube a 8 en `config.toml` para que Auth diga lo mismo.
- **Sin límite por minuto:** la función no llama a ningún modelo y solo la usa la administración. Responde 401 sin sesión, 403 si quien llama no es un administrador activo, 400 con un cuerpo que no encaja o una contraseña rechazada, 404 sin el usuario y 409 con un correo repetido o un cambio prohibido (el mensaje lo nombra).

**Alternativas:**

- Contar el límite de la contraseña en bytes (72): exacto, pero nadie lo entiende y la regla dependería de las tildes. El autor lo descartó.
- Comprobar el administrador con la RLS desde el cliente y escribir `app_user` directamente: no sirve, porque crear cuentas, bloquearlas y cambiar contraseñas exige la API de administración de Auth, que solo puede ir en el servidor.

**Consecuencias:**

- El 5.1b solo tiene que pintar la pantalla y traducir `invalid` según el caso; el formulario usa los mismos límites de `user-rules.ts`.
- Restablecer una contraseña no cierra las sesiones abiertas de esa cuenta (la API de administración no cierra las sesiones de otro usuario por su id): a `PENDIENTES.md`. Para echar a alguien al momento está la baja.
- En la nube, la longitud mínima de la contraseña se cambia en el panel (`DESPLIEGUE.md`).

**Ampliación del 5.2a (19/11/2026): grupos y matrícula.**

- **El docente gestiona sus grupos y su matrícula** (RF-16): crea grupos suyos, cambia su nombre y su curso, y matricula a alumnos activos de todo el centro, que busca con `search_students` (`security definer`, solo nombre y correo, al menos dos letras y 20 como mucho, sin tildes ni mayúsculas con `unaccent`). El tope impide listar el centro de una vez, no del todo: quien probara todas las parejas de letras vería a casi todos. Se acepta, porque un docente ya ve a los alumnos del centro en clase y la búsqueda solo da nombre y correo. El administrador gestiona todos y es el único que cambia el docente de un grupo. Las operaciones pasan de `AdminService` a `GroupService`.
- **Quién puede escribir lo dice la RLS (`42501`, `forbidden`); si el docente o el alumno valen, un disparador antes de ella (`check_group_teacher`, `check_enrolled_student`, `23514`, `invalid`).** Así Supabase distingue los dos casos igual que el servicio simulado: dar el grupo a otro docente está prohibido, y elegir como docente a un alumno, a un administrador o a una cuenta desactivada no es válido. El plan lo ponía todo en la RLS, que habría dado `forbidden` a todo.
- **Un grupo no cambia de asignatura** (`grant update (name, school_year, teacher_id)`), **solo se borra si nadie ha empezado nada en él** (`is_started_group`, como los bloques, D-058) y su curso tiene la forma `2026/27` (un `check`). La baja de una matrícula conserva los intentos.
- **Se matricula a varios en una sola petición, 50 como mucho** (`MAX_ENROLLMENT_BATCH`), y todos o ninguno: un tope para una petición, más de lo que la pantalla elige de una vez.
- **`group_summaries()`** (en lugar de `group_student_counts` del plan) da de cada grupo que gestiona quien llama sus alumnos y si está empezado, en una sola llamada: la lista no tiene que preguntar por cada grupo.
- **Revisión del 5.2a (migración `groups_review`), tras probar el servicio contra Supabase local con peticiones reales:**
  - La política de lectura de `class_group` mira la fila (`teacher_id` y el rol) en lugar de `teaches_group()`. Esa función lee la tabla con la foto de la sentencia, que no tiene la fila nueva: un docente no podía crear un grupo con `insert … returning`, que es como lo pide la app.
  - Se matricula con la RPC `enroll_students` (de 1 a 50 alumnos distintos, todos o ninguno). Un `insert … returning` con el alumno incrustado lo devolvía `null`, porque es la propia matrícula nueva la que deja al docente leer al alumno, y esa sentencia aún no la ve.
  - `search_students` y `enroll_students` responden `P0002` (`not_found`) con un grupo ajeno, igual que el resto de peticiones sobre un grupo y el servicio simulado.
  - El docente de un grupo se comprueba solo al elegirlo, al crear el grupo o al cambiarlo: un grupo cuyo docente se dio de baja sigue editable hasta que se reasigna.
  - pgTAP comprueba ahora las escrituras con `returning`, que es lo que hace la app. Así se habría visto el primer fallo.
- **Segunda revisión (migración `enrollment_through_rpc`), probando también los casos límite contra Supabase local:**
  - **Solo se matricula con `enroll_students`,** que pasa a `security definer` y comprueba el grupo ella misma. El `insert` directo en `enrollment` queda cerrado (`revoke insert` y sin política de alta). Con él abierto, una petición a la tabla se saltaba el tope de 50, que la primera revisión daba por cumplido en el servidor. `check_enrolled_student` sigue rechazando a quien no es un alumno activo.
  - **Borrar un grupo ajeno es `not_found` también en Supabase.** La RLS no borra ninguna fila, sin error, ni de un grupo empezado ni de uno ajeno; solo entonces una segunda lectura los distingue. Antes los dos daban `invalid`, y la pantalla habría dicho «ya hay alumnos con trabajo» de un grupo que, por ejemplo, otra persona acababa de borrar.
  - **El servicio simulado comprueba en el orden de Postgres:** primero el disparador (docente válido), después la RLS, los `check` y la clave ajena. Un docente que pone a un alumno como docente de su grupo recibe `invalid` en las dos versiones. Al cambiar un grupo, el simulado ya no valida la asignatura, que no cambia.
- **`listTeachers()`** lee `app_user`: a la administración le da los docentes activos y a un docente solo su cuenta, como la RLS, en las dos versiones.

**Aprobación:** el plan y el límite de 8 a 64 caracteres, aprobados por el autor; la ampliación del 5.2a, propuesta al cerrar el paso.

## D-073 · El histórico: lo que ya pasó, bloque a bloque, para dos decisiones fuera de clase (18/11/2026)

**Contexto:** el paso 4.4 construye el histórico del grupo (`/docente/historico`, ficha 09, figuras 10 y 19 de la memoria). La especificación pedía una gráfica de la media de pistas por bloque y tres KPI (tiempo medio, porcentaje de superados y alumnos con señales), contando solo el intento que cuenta de cada asignación (D-046), y, por D-054, el ritmo de entrega respecto a la fecha. Con la regla del panel en vivo (D-068), cada dato tiene que responder a una decisión del docente. La primera versión, que seguía el plan al pie de la letra, el autor la rechazó al probarla: mezclaba la tendencia del grupo, un bloque y las fechas de todo el grupo sin decirlo; la gráfica no explicaba sus colores; con un solo bloque era una barra suelta; las entregas dejaban huecos y escondían los nombres tras «Ver quiénes». Se rehízo a partir de un boceto aprobado por el autor.

**Decisión:**

- **La pantalla es solo historia,** en dos tarjetas a todo el ancho: la evolución del grupo y el bloque elegido. Responde a si el grupo gana autonomía y a qué repasar. Las entregas que vienen de todo el grupo, que son un recordatorio y no historia, se dejan para Bloques, donde se ponen las fechas (`PENDIENTES.md`).
- **Pistas por alumno y ejercicio,** no por alumno y bloque: las pistas pedidas en los intentos que cuentan, entre esos intentos. Por bloque, uno con tres ejercicios saldría más alto que uno con uno aunque el grupo pida menos ayuda.
- **El tiempo es la mediana** entre abrir un ejercicio y entregarlo («Tiempo por ejercicio»): un ejercicio abierto el lunes y entregado el jueves no puede contar tres días.
- **«Se atascaron en alguna prueba»** son los alumnos que, en algún momento del intento que cuenta, fallaron la misma prueba tantas veces seguidas como el umbral del ejercicio (`longestFailureStreak()`). La inactividad no cuenta: en datos pasados todo intento tiene parones (D-068). Se da el número, sin nombres.
- **La gráfica se explica sola:** una leyenda dice qué es el verde, el gris y la columna resaltada del bloque elegido, y una línea dice que cada barra elige su bloque. La frase de la tendencia solo lee los bloques que ha trabajado al menos media clase (`REPRESENTATIVE_SHARE`): una recuperación con un alumno daría la vuelta a la lectura, así que va en gris con «1 alumno». Compara el primero con el último, con una tolerancia de 0,1 pistas. Con un solo bloque empezado no hay gráfica, sino una frase.
- **El bloque elegido** (`?bloque=`; por defecto, el último trabajado por media clase) trae sus tres cifras, su entrega y una fila por ejercicio: lo que se repasa es un ejercicio, no la media de un bloque. Una media de todo el curso no responde a ninguna decisión, y la mediana y los alumnos distintos no se suman bloque a bloque.
- **La entrega del bloque,** una fila por fecha: a tiempo, en las **últimas 24 horas** (`DEADLINE_LAST_HOURS`, parte del contrato), después del plazo y quién falta, por nombre y siempre a la vista. Solo quien entregó una parte dice cuánto le queda; si nadie ha entregado, una línea lo dice en lugar de nombrar a la clase entera. Quien entrega en el último momento no se nombra: es un dato del plazo, no de la persona. Una fecha que aún no ha llegado dice «entregadas», porque todavía nadie llega tarde.
- **`StatsService.groupHistory()` da cuentas en bruto,** del bloque y de cada ejercicio, y la pantalla calcula medias y porcentajes; la versión de Supabase responde `unavailable` hasta el 4.5.
- **La gráfica es HTML con Tailwind:** cada barra es un enlace de verdad, con su foco y su nombre. El título va primero en el DOM aunque se dibuje debajo, y «1 alumno» queda fuera del enlace, para que lo visible esté seguido dentro del nombre (WCAG 2.5.3, `label-content-name-mismatch` de axe).

**Alternativas:**

- **Las tres cifras del grupo entero,** como el prototipo: no responden a ninguna decisión y la mediana no se puede agregar.
- **Una sección «Entregas» de todo el grupo en el histórico,** con tarjetas o con filas: mezcla un recordatorio con el análisis, que es lo que el autor rechazó.
- **Cambiar el nombre a «Progreso»** para que cupieran las dos cosas: tapaba la mezcla en lugar de quitarla.
- **Contar la inactividad como señal:** en el histórico, todo el mundo la tendría.
- **Nombrar a quien entrega en las últimas horas o tarde:** etiqueta a personas, contra D-054.
- **Un SVG o una librería de gráficas:** había que rehacer el foco, los nombres y el tamaño de las dianas.

**Consecuencias:**

- El 4.5 implementa las RPC `group_work_stats` (del bloque y de cada ejercicio) y `group_deadline_stats` con estas mismas reglas, y sus tests de pgTAP usan las cifras del seed que comprueba `group-history.spec.ts`.
- `formatDuration()` pasa a `shared/` y `is-stuck.ts` gana `longestFailureStreak()`.
- Con el seed no hay entregas en las últimas horas ni fuera de plazo: los tests las cubren, y `PENDIENTES.md` propone añadirlas para las capturas de la memoria.
- El modelo de datos asigna cada bloque a todo el grupo: una recuperación cuenta como pendientes a quienes no la necesitan. Lo recoge `PENDIENTES.md`.
- La lección de proceso: una pantalla nueva se boceta con los datos del seed y se valida antes de construirla, aunque el plan la deje atada.

**Aprobación:** el boceto y la pantalla final, aprobados por el autor.

**Hecho así en el 4.5** (18/11/2026): `group_work_stats` y `group_deadline_stats`, las dos `security definer`, comprueban al entrar que quien llama es la administración o el docente del grupo (si no, `P0002`, que el cliente lee como `not_found`). Agregar bajo la RLS llamaría a `can_read_attempt()` por cada evento del grupo, y solo devuelven cuentas y los nombres del alumnado, que su docente ya lee. `group_work_stats` da con `grouping sets` una fila por bloque y una por asignación, para que las reglas de cuenta estén escritas una sola vez. Quien tiene algo pendiente viaja en tres vectores paralelos de la fila de su plazo, lejos del tope de 1000 filas de PostgREST.

## D-074 · Los tests, siempre en la hora de Madrid (19/11/2026)

**Contexto:** las pantallas muestran las fechas en la hora local del navegador, y algunos tests leen la hora que sale («Entrega: vie 6 nov, 23:59»). En un equipo con otra zona horaria (un Windows en UTC, una sesión en la nube) salía «22:59» y el test fallaba sin que nada estuviera mal. Ya había pasado en el 4.3d, y se arregló test a test.

**Decisión:** los tests unitarios y los e2e corren en la zona horaria del centro, `Europe/Madrid`, sea cual sea el reloj del equipo. La fija la constante `TEST_TIME_ZONE` de `vitest-base.config.mts` (con `test.env.TZ`) y la de `playwright.config.ts` (con `timezoneId`). Así cada test lee la hora como la vería el docente, sin tener que construir las fechas de una forma especial.

**Alternativas:** construir cada fecha de los tests en hora local, como en el 4.3d: hay que acordarse en cada test nuevo, y el fallo solo aparece en otro equipo. Escribir las fechas en UTC en los tests: el centro no las ve así.

**Consecuencias:** un test nuevo con horas no necesita nada especial, y el apaño del 4.3d (la apertura del examen reescrita en hora local en el test de Bloques) se quita: el test usa la del seed. Comprobado con `TZ=UTC npm run check`, en verde, y los dos tests con horas también en Nueva York y en Tokio, donde el de las entregas fallaba desde el 4.3d.

**Aprobación:** pedida por el autor, para que el fallo no se repitiera en el futuro.

## D-075 · La pantalla de usuarios: los grupos de cada cuenta en la lista (19/11/2026)

**Contexto:** el rol solo cambia a quien no tiene grupos ni matrículas (D-072). Con `listUsers()` devolviendo solo las cuentas, la pantalla no lo sabía hasta que el servidor lo rechazaba, y en el seed todos los docentes y alumnos tienen grupos: cambiar el rol daría siempre un error después de guardar.

**Decisión:** `listUsers()` devuelve `UserEntry`: la cuenta, los nombres de los grupos que imparte o en los que está matriculada (sin repetir) y sus `UserLinks`. En Supabase es una sola consulta, con `class_group` (por su clave `class_group_teacher_id_fkey`) y `enrollment(class_group)` incrustados; los dos servicios la arman con `toUserEntry()`. El diálogo deshabilita el rol con el motivo y los grupos, y la tabla tiene una columna «Grupos». El servidor sigue aplicando la regla. Además: los roles se nombran en colectivo y sin género («Alumnado», «Profesorado», «Administración»), el estado se filtra con un desplegable (Activas, Desactivadas, Todas) y la tabla se ordena por sus cabeceras.

**Alternativas:** pedir los vínculos al abrir el diálogo de cada cuenta: una petición más por edición y un diálogo que cambia mientras carga. Dejar que el servidor lo rechace y explicar el error: el administrador lo descubre después de intentarlo, que es lo que CU-06 evita con el rol propio.

**Consecuencias:** la lista pesa algo más (los nombres de los grupos), dentro del tope de 1000 filas ya apuntado. El 5.2a, que pasa los grupos a `GroupService`, no toca esta consulta: la administración sigue leyendo `class_group` y `enrollment` por su RLS.

**Aprobación:** el autor aprobó el ajuste con el boceto y pidió el orden por columnas y el filtro de estado.

## D-076 · La prueba del proveedor de IA: un resultado por modelo, también con un host no permitido (19/11/2026)

**Contexto:** el 5.3 era un paso de ≈2,5 h con una Edge Function nueva y una pantalla. Además, la migración prevista (`20261119100000_ai_check.sql`) repetía el número de `groups_and_enrollment`. Y la función `ai-check` lee el ajuste con `providerSettingOf()`, que quita sin avisar los respaldos de un host no permitido: la administración no los vería en el resultado ni sabría por qué.

**Decisión:** el paso se parte en el 5.3a (datos, migración y función, sin pantalla) y el 5.3b (la pantalla), como el 5.1 y el 5.2. La migración pasa a `20261119120000_ai_check.sql`. La función lee el ajuste aceptando cualquier host y comprueba después cada modelo: el principal de un host no permitido da un solo resultado `host_not_allowed`, y un respaldo, su propio `host_not_allowed` en su sitio de la lista. Al límite de 5 por minuto se suma uno de 100 al día (`AI_CHECKS_PER_DAY`), como el de `translate` (D-063), porque cada prueba llama a todos los modelos. Un fallo sin respuesta del proveedor es `timeout` si ha pasado el tiempo máximo del modelo y `unavailable` si no, sin tocar `ProviderError`. La forma del ajuste que pide la tabla (`is_valid_ai_provider`) se escribe en `isValidAiProvider()`, que usa el servicio simulado y usará el formulario del 5.3b. Los proveedores predefinidos usan JSON simple con Groq y OpenRouter, porque no todos sus modelos siguen un esquema, y el esquema con Gemini y Ollama.

**Alternativas:** un solo paso, en una sesión demasiado larga para revisarla. Que `providerSettingOf()` avise de lo que quita: cambiaría la lectura que usan el tutor y `translate`. Marcar el `timeout` dentro de `ProviderError`: tocaría la clase compartida por una sola función.

**Consecuencias:** el resultado tiene siempre un elemento por modelo del ajuste, en su orden.

**Revisión (19/11/2026, iteración 2 del 5.3a):** el autor pidió revisar el paso a fondo, y salieron dos fallos. Un respaldo que `providerSettingOf()` descarta (un modelo repetido, un secreto o un tiempo que no acepta) desaparecía del resultado, y el formulario del 5.3b no impide repetir un modelo. Ahora la función lee el ajuste respaldo a respaldo, y el que las funciones dejarían fuera sale como `invalid` en su sitio. Más de `MAX_FALLBACKS` respaldos, o unos que no son una lista, es `invalid` entero, como en la tabla. El simulado también marca el modelo repetido, y el texto de `invalid` pasa a «No es válido o está repetido en la lista». El otro fallo: los modelos se probaban uno tras otro, y seis de 2 min cada uno superaban el tiempo de una Edge Function. Ahora se prueban a la vez (`Promise.all`) y el resultado conserva el orden. En local, cuatro modelos tardaron lo que el más lento (16 s), no la suma.

**Aprobación:** el autor aprobó partir el paso y las correcciones, y empezar por el 5.3a.

## D-077 · Los respaldos de otro proveedor se editan en el formulario del sistema (19/11/2026)

**Contexto:** el plan del 5.3 dejaba el formulario del proveedor de IA para el modelo principal y los respaldos del mismo proveedor; uno de otro proveedor (con su `baseUrl`) solo se enseñaba en una línea de solo lectura y se conservaba al guardar. Pero el fallo más común del principal es de su proveedor (cuota agotada, caída, clave rechazada), y entonces un respaldo del mismo proveedor suele caer a la vez: el respaldo que de verdad protege al tutor es el de otro proveedor, que el back-end ya admite (D-044) y `ai-check` ya prueba (D-076).

**Decisión:** cada respaldo lleva su propio desplegable de proveedor: «El del principal» (por defecto: solo modelo y tiempo, guardado como `{ model, timeoutMs }`), uno de `AI_PROVIDER_PRESETS` (rellena la URL, el secreto y el formato, que se enseñan en una línea) u «Otro» (los escribe). Se guardan con todos sus campos, porque un respaldo de otro proveedor nunca hereda la clave del principal. Los respaldos se pueden además subir y bajar, porque se prueban en su orden. El principal deja sus campos de proveedor deshabilitados salvo con «Otro», y la clave y el formato por defecto no se escriben, para que el ajuste del seed vuelva igual.

**Alternativas:** la línea de solo lectura del plan (con «Quitar»): no deja crear el respaldo más útil sin tocar la base de datos. Un formulario aparte para cada respaldo: más pantallas para lo mismo.

**Consecuencias:** `toProviderSetting()` ya no recibe los respaldos conservados; el formulario los edita todos. `system.fallbacks.kept` del plan no existe. La pantalla provisional (`PlaceholderPage`) deja de usarse con el 5.3b y se borra.

**Aprobación:** el autor preguntó por qué no se podían editar y, tras la explicación, eligió que fueran editables.

## D-071 · La voz del alumno: `StudentVoice`, y qué respuesta dice el tutor (19/11/2026)

**Contexto:** la voz (6.1a) necesita en tres sitios lo mismo: si está activada, las voces del idioma, la voz elegida si sigue existiendo y decir una frase con su velocidad. Son los ajustes, el chat y, después, el dictado y la llamada. Además, `TutorSpeaker` tiene que saber qué respuesta es nueva para leerla sola.

**Decisión:** `StudentVoice` (`student/settings/`, `@Service()`) junta `SettingsStore` con lo que puede el navegador. No es un store, porque no guarda estado propio: carga el habla con `resource()` solo con `voice` activado y deriva el resto con `computed()`. Si el código de la voz o sus voces no cargan, se queda en silencio, porque todo está escrito. `TutorSpeaker` dice sola cada respuesta `fresh` nueva, identificada por `id` y `createdAt` (un reintento conserva el `id`), la primera vez que la ve, tanto si llega a medias como si llega entera. No vuelve a decir una ya vista cuando desaparece la última. La lista de voces enseña la región (`Intl.DisplayNames`) solo si el nombre no la dice.

**Alternativas:** que cada pantalla lea los ajustes y cargue el habla por su cuenta (repetido tres veces). Hacer de la voz un store nuevo: §4.5 solo prevé los que hay, y no tiene estado que guardar. Empezar solo con turnos `answering`, como decía el plan: con los datos simulados, la respuesta llega entera antes de que corra el `effect()` y no se leía.

**Consecuencias:** el 6.1b y el 6.1c usarán `StudentVoice` para el dictado y la llamada. «Escuchar» solo aparece si el navegador tiene voces del idioma.

**Aprobación:** el autor aprobó el plan del paso y las mejoras, y delegó la decisión técnica.

## D-078 · La voz del tutor: la más natural por defecto, y siempre a la vista cuando suena (19/11/2026)

**Contexto:** D-066 dejaba la voz del tutor sin valor por defecto, porque la API no dice el género de una voz y la aplicación no debía elegir una por el alumno. Al probarlo, el autor vio dos problemas: muchas voces del navegador suenan robóticas (las antiguas de macOS que ofrece Chrome), y al cambiar de idioma «Escuchar» llevaba a los ajustes a elegir otra.

**Decisión:** las voces se ordenan por calidad (`core/speech/voice-quality.ts`): primero las naturales o en red (`Natural`, `Online`, `Google`, `mejorada`, `Premium`, `localService` falso), después las del sistema y al final las de juguete de macOS, que se esconden tras «Ver todas las voces». Mientras el alumno no elija otra, el tutor habla con la primera, que es una elección por **calidad**, no por género: el nombre de las voces en red (como «Google español») ni siquiera lo dice. Los ajustes lo explican («Tiene la que suena más natural en tu navegador. Puedes elegir otra»). Mientras el tutor habla, su cabecera enseña «Hablando» con «Parar». El micrófono del 6.1b y del 6.1c tendrá un indicador igual de claro.

**Alternativas:** mantener la voz sin elegir, como en D-066, con el coste de un paso más en cada idioma. Guardar una voz por idioma: sigue obligando a elegir la primera vez. Una síntesis de pago en el servidor: mejor sonido, pero con coste por respuesta y otro proveedor que recibe el texto (queda en `PENDIENTES.md`).

**Las voces de broma** (que cantan o hacen ruidos) se reconocen por su nombre en inglés, español y catalán, porque macOS los traduce y su `voiceURI` es el mismo nombre traducido: la API no da un identificador fijo. Siguen ofreciéndose tras «Ver todas las voces», a petición del autor.

**Consecuencias:** desaparece el enlace del chat a los ajustes («Elige una voz para el tutor en los ajustes»). Esta decisión se explica en la memoria junto a la perspectiva de género, que cambia de «no elegir» a «elegir por calidad y dejar cambiarla».

**Aprobación:** el autor la pidió: las mejores voces primero, la mejor elegida por defecto y la posibilidad de cambiarla.

## D-079 · Preparar un curso nuevo: la clase son los grupos con el mismo nombre y curso, que se crean, duplican y matriculan juntos (19/11/2026)

**Contexto:** en la revisión del 5.2b el autor señaló que preparar un curso nuevo resultaba pesado y poco intuitivo. Una clase son tantos grupos como asignaturas (`class_group`: nombre, curso, asignatura y docente), los mismos alumnos se matriculan en cada uno (solo ayudaba «Añadir los de otro grupo») y los bloques, que son de cada grupo, se rehacían a mano; los ejercicios sí se reutilizan del banco. Copiar los bloques de un grupo en otro ya estaba pendiente desde el 4.3d (D-060).

**Decisión:**

- **La clase no es una tabla:** son los grupos con el mismo nombre y curso (`classOf()`), como ya los distinguía el desplegable. No cambia el modelo de datos.
- **«Nuevo grupo» en varias asignaturas:** el desplegable es múltiple y crea un grupo en cada una, con el mismo nombre, curso y docente, en un solo `insert` (todo o nada). `GroupService.createGroups()`.
- **«Duplicar…» en el menú del grupo:** un grupo nuevo por cada grupo elegido de la clase (todos, al principio), en su asignatura, con el nombre, el curso (el siguiente, o el actual si el grupo es más antiguo) y el docente que se elijan, y, si se quiere, sus bloques con sus ejercicios, orden, visibilidad y traducciones, sus fechas y su alumnado activo (sin marcar: un curso nuevo es otra clase). RPC `duplicate_groups`, con seguridad del definidor, porque la matrícula solo entra por funciones (D-072): comprueba los grupos y el docente, y las comprobaciones de las tablas hacen el resto.
- **Las fechas pasan al nuevo curso en semanas enteras:** `school_year_shift_days()` (y `schoolYearShiftDays()` en el cliente) redondea los años a semanas (364 días por un año), para que el viernes de entrega siga siendo viernes; en el mismo curso no se mueven. La suma se hace en la zona horaria del navegador (parámetro `time_zone`), para que las 23:59 sigan siéndolo aunque cambie la hora de verano. Sin fechas, los bloques llegan sin apertura ni entrega. El diálogo dice antes dónde caerán (`datesNote()`).
- **Matricular en toda la clase:** el diálogo de matrícula añade «Matricular también en», con los otros grupos de la clase marcados. `enroll_students` admite `also_group_ids` (20 como mucho): allí salta a quien ya está, en lugar de rechazar el lote, y sigue devolviendo la matrícula del grupo abierto. Las cuentas de los demás se recargan.
- **«Copiar de otro grupo» en Bloques:** los bloques de otro grupo del usuario detrás de los que hay (los de la misma asignatura primero, el curso más reciente antes), con o sin fechas. RPC `copy_blocks`, también del definidor y con sus comprobaciones, que comparte con `duplicate_groups` la copia (`copy_group_blocks`, sin permisos para nadie). Para eso, `BlockService.listGroups()` da también el curso (`PlannedGroup`), y el desplegable de Bloques lo añade cuando el nombre se repite.

**Alternativas:**

- **Una tabla `class` con sus grupos:** más limpia en teoría, pero cambiaba el modelo, las RLS y todas las pantallas que eligen grupo, para lo que ya resuelven el nombre y el curso.
- **Mover las fechas un año exacto:** el día de la semana cambia (el viernes pasa a sábado) y el docente tendría que corregir cada entrega.
- **Hacer la copia en el cliente, petición a petición:** un fallo a mitad dejaba un grupo con la mitad de los bloques; el servidor la hace en una transacción.
- **Matricular en varios grupos rechazando a quien ya está en alguno:** obligaba a desmarcar grupos a mano por un solo alumno.

**Consecuencias:**

- Migración `20261119150000_school_year_setup.sql`, con 31 tests de pgTAP (`school_year_setup.test.sql`) y la lista de funciones de `function_privileges` ampliada. Tipos regenerados.
- `GroupService` gana `createGroups()`, `duplicateGroups()` y el tercer argumento de `enroll()`; `BlockService`, `copyBlocks()`. En las dos versiones; la copia simulada imita la del servidor (`copy-group-blocks.ts`).
- Sale de [PENDIENTES](PENDIENTES.md) copiar los bloques de un grupo en otro (4.3d) y preparar un curso nuevo (5.2b).
- Para la memoria (el autor lo pidió al probar el 5.2f, 20/11/2026): las fechas se mueven 52 semanas y no un año de calendario, así que una entrega conserva su día de la semana y su hora. Por ejemplo, el viernes 7/11/2025 a las 23:59 pasa al viernes 6/11/2026 a las 23:59, cuando el 7/11/2026 es sábado. Es un detalle pequeño que ahorra al docente corregir cada fecha a mano al reutilizar un curso, y desde el 5.2f sirve también para traer los bloques de una clase cerrada.

**Aprobación:** el diseño, por el autor, que aprobó las cuatro piezas; el detalle técnico (semanas enteras, zona horaria del navegador, alumnado sin marcar), por delegación del autor.

## D-080 · Ayuda guiada: un único botón «Ayuda», tareas guiadas con driver.js y el manual generado de ellas (19/11/2026, propuesta)

**Contexto:** el autor pidió una ayuda que explique cada perfil, sobre todo el del alumno y el del docente, marcando cada pieza paso a paso: visual, accesible y también en el móvil. Además, que se pueda volver a ella para ver cómo se hace algo concreto, y que sirva casi de manual. La valoran mucho, y la cuenta del tribunal es de administración, así que su primera impresión será la ayuda.

**Decisión:**

- **Un único punto de entrada,** el botón «Ayuda» de la barra superior, con un panel que reúne todo: los primeros pasos con su progreso, «¿Cómo se hace…?» con todas las tareas guiadas del perfil y un filtro, las balizas de la pantalla y la bienvenida. Antes eran cuatro mecanismos en sitios distintos: el usuario tendría que saber dónde buscar cada uno.
- **Tareas guiadas antes que recorridos que solo enseñan:** un recorrido largo al entrar casi siempre se salta. Lo que se recuerda es lo que se hace, así que la tarea espera a que el usuario haga cada acción en la pantalla real y con sus datos. La bienvenida es corta (cinco pasos como mucho) y acaba señalando el botón «Ayuda».
- **driver.js 1.14** (MIT, sin dependencias, ≈ 4 M descargas semanales en noviembre de 2026 y versiones frecuentes) para los recorridos y las balizas:
  - **Aspecto:** oscurece la pantalla salvo la pieza que explica.
  - **Accesibilidad:** su globo es un diálogo con título, y el ciclo del foco incluye la pieza resaltada (comprobado en su código).
  - **Uso:** se maneja con teclado, se recoloca al cambiar el tamaño y puede esperar una acción del usuario (`advanceOn`).
  - **Aislamiento:** solo lo importa `TourRunner`, y se carga cuando hace falta. Cambiar de librería solo cambiaría esa clase, porque las tareas son datos propios (`GuideTask`), no configuración de driver.js.
- **El panel, propio con Material.** driver.js trae un checklist, pero:
  - las etiquetas de dos de sus botones para el lector de pantalla están fijas en inglés y no se configuran;
  - no tiene filtro ni secciones;
  - su aspecto no es el de la aplicación.
- **Lo visto y lo hecho, en el servidor** (`user_guide_state`, `jsonb`), no en `localStorage`:
  - la ayuda no se repite en otro equipo;
  - una tabla de una fila por usuario, que solo lee y escribe su dueño. El plan decía una columna de `app_user`, pero esa fila la leen su docente y la administración (el `select *` de usuarios), y la pantalla de datos registrados dice «Tu docente no lo ve»: en el 7.0a se cambió a una tabla propia, con el visto bueno del autor;
  - `jsonb` con identificadores estables admite tareas nuevas sin migraciones, y una versión de la bienvenida permite volver a enseñarla si se rehace;
  - las tareas con datos se dan por hechas por esos datos, no por lo guardado.
- **El manual sale de las tareas** (`npm run manual`, 7.0c): Playwright hace cada tarea y guarda el texto de cada globo con su captura. Así el manual no se desfasa de la aplicación, y de paso comprueba que todas las tareas siguen funcionando.

**Alternativas:**

- **Shepherd.js:** igual de buena en aspecto y accesibilidad, con envoltorio de Angular, pero con licencia AGPL-3.0, que obliga a publicar el código de toda la aplicación bajo esa licencia o a pagar la comercial.
- **Intro.js:** también AGPL-3.0 y de aspecto más anticuado.
- **ngx-ui-tour-md-menu:** hecha para Angular y Material, pero:
  - poco usada (≈ 21 k descargas semanales);
  - no oscurece la pantalla;
  - sus globos son menús de Material (`role="menu"`) con texto dentro, que axe marca como error.
- **TourGuide JS y OnboardJS:** abandonada la primera (sin versiones desde 2025); la segunda, sin interfaz y en versión de prueba.
- **Solo un recorrido inicial:** más barato, pero enseña dónde está cada cosa sin enseñar a hacer nada, y no se puede volver a una tarea concreta.
- **El checklist de driver.js,** retocando sus etiquetas al dibujarse: funciona, pero depende de su HTML interno y puede romperse con cualquier versión.
- **Un manual escrito a mano:** se desfasa con cada cambio de pantalla.
- **Una paleta de órdenes (Ctrl+K):**
  - cada perfil tiene cinco pantallas como mucho y un solo atajo propio (Ctrl+Enter o ⌘+Enter para ejecutar en el editor), así que no ahorra nada;
  - Ctrl+K ya es un atajo del navegador (la barra de búsqueda en Chrome, Edge y Firefox), y quitárselo al usuario rompe un hábito suyo;
  - el filtro de «¿Cómo se hace…?» cubre lo que aportaría.

**Comprobado al empezar el 7.0a** (detalle en la ficha 13): driver.js encaja con los diálogos de Material y no hace falta el globo propio. Dos trampas de foco a la vez atascaban el tabulador, así que en los pasos dentro de un diálogo manda la del diálogo (`allowPageInteraction`) y driver.js lee el globo en su región `aria-live`; si el diálogo se cierra con Esc, la tarea vuelve al paso que lo abrió. Al construir salieron tres cosas más de driver.js: su contenedor de capas permitido tapaba los clics, se queda con los clics de los botones con sus clases (los propios llevan clases propias) y bloquea la pieza en los pasos que solo explican (los que la dejan usar lo dicen).

**Lo que cambió en el 7.0a, a petición del autor al probarlo:**

- **Todo explicado:** balizas en cada pieza de cada pantalla del alumno (la barra, los ajustes y los datos registrados incluidos) y «Recorrer esta pantalla», que pasa por todas ellas con los mismos textos; muchas más tareas en «¿Cómo se hace…?» (cada ajuste, la voz completa con su reconocimiento en el equipo, por qué falla una prueba, preguntar, ajustar la pantalla, cerrar sesión…). Los recorridos de pantalla, hechos de las balizas, también entran en el manual del 7.0c.
- **La bienvenida enseña la barra seguida y en su orden** (Ayuda, Tema, Idioma, menú), con el tema y el idioma que se pueden cambiar ahí mismo, y acaba en «Por dónde seguir» con «Siguiente: Empezar un ejercicio». Tiene siete pasos, no cinco: los de la barra son cortos. Cuenta como vista al acabar, no al empezar, para que quien cambia de idioma la vea en el suyo.
- **«Esta pantalla», arriba del panel:** el recorrido y las balizas son lo más útil donde se está.
- **Menús y diálogos:** se resalta el menú o el diálogo entero, para que el globo no tape sus otras opciones (los intentos), y solo cuenta el clic en la opción de la tarea.
- **Un interruptor que muestra más opciones** (la voz): el globo ofrece «Activar la voz» y sigue por ellas.
- **Las balizas no oscurecen:** son ayuda sobre la marcha; van en la esquina donde empieza cada pieza, con un aro claro.
- **El botón del docente y la administración,** con sus tareas en el 7.0b: con el panel vacío no serviría.

**Consecuencias:**

- Pasos 7.0a (≈ 5 h), 7.0b (≈ 4 h) y 7.0c (≈ 2 h), antes del 7.1 para que sus e2e y axe ya recorran la ayuda. La fase 7 pasa de ≈ 15 h a ≈ 26 h.
- Si falta tiempo, se recortan las tareas que no son primeros pasos, justo después del 7.3. Cada una es sobre todo texto, así que se pueden añadir más tarde.
- Una dependencia nueva (`driver.js`), una columna en `app_user`, un store nuevo (`GuideStore`, §4.5) y la carpeta `core/guide/`.
- El CSS de driver.js se adapta con los tokens del tema en `src/styles/guide.css` (D-039).
- La pantalla de datos registrados cuenta qué se guarda de la ayuda.

**Aprobación:**

- El autor eligió driver.js tras la comparación y dejó en manos del agente el panel propio, la segunda opción.
- Pidió poder volver a ver cómo se hace algo concreto, aprobó el panel único, con la ayuda ampliada y actualizada hasta quedar completa, y quiere que sirva de manual.
- El resto, a criterio del agente, con la condición de elegir lo más compatible a futuro.

## D-081 · La clase, compartida por los docentes del centro: una tabla con su alumnado, y los desdobles con nombre (20/11/2026)

**Contexto:** el 5.2c hizo la clase implícita: los grupos con el mismo nombre y curso (D-079). En su revisión el autor vio tres problemas: la clase dependía de escribir el mismo nombre a mano, «Duplicar» estaba en el menú de una asignatura pero duplicaba la clase entera y, sobre todo, varios docentes dan clase en la misma clase (Marta Programación, Javier Bases de datos en 1.º DAW A), así que cada uno tendría «su» clase. Además, hay asignaturas que se dan partidas en desdobles (una parte en inglés, por ejemplo).

**Decisión:**

- **La clase es una tabla, una vez por centro:** `school_class` (nombre, curso, quién la creó), única por nombre (sin distinguir mayúsculas) y curso. La lee todo el profesorado, para unirse a ella, y el alumnado de sus grupos, para ver su nombre. La crea cualquier docente o la administración; la renombran su creador o la administración, y la borran solo vacía (sin grupos).
- **`class_group` cuelga de su clase** (`class_id`) y pierde el nombre y el curso, que pasan a la clase: una sola fuente. El grupo sigue siendo de su docente: bloques, panel en vivo y analítica no cambian.
- **El alumnado de la clase, en `class_member`, y la matrícula «copiada con excepciones»:** `enrollment` sigue siendo la matrícula de cada grupo, con sus RLS intactas. Matricular en la clase matricula en todos sus grupos y quitar de la clase quita de todos, también de los de otros docentes; un grupo nuevo empieza con el alumnado activo de la clase. Cada docente puede dar de baja a alguien solo de su grupo (una convalidada), volver a matricularlo o matricular solo en su grupo a alguien de otra clase.
- **Desdobles:** dos grupos de la misma asignatura en una clase se distinguen por `class_group.label` («Nombre del desdoble», 30 caracteres como mucho, opcional y editable por el docente del grupo o la administración), única por clase, asignatura y nombre (`unique nulls not distinct`). Al añadir una asignatura que la clase ya tiene, el nombre viene como «Desdoble N». Regla única: **un grupo sin nombre es el de toda la clase** (toma su alumnado al crearse y al matricular en la clase); **uno con nombre es un desdoble**, cuyo alumnado se elige a mano. En los selectores: «1.º DAW A · Programación básica · Desdoble inglés».
- **Qué lee un docente de la clase (D-062):** el nombre y el correo de todo su alumnado (`class_roster`), y en qué grupos de la clase está cada uno, porque lo necesita para mantener la lista. El trabajo de un alumno lo sigue leyendo solo el docente del grupo donde lo hace (`teaches_assignment()`). También ve qué asignaturas tiene la clase y quién las da (`class_overview`): no es un secreto entre el profesorado.
- **Todo lo que crea grupos o toca la matrícula, por funciones** con seguridad del definidor (`create_class`, `add_class_group`, `duplicate_class`, `enroll_class_members`, `remove_class_member`, `enroll_students`), como ya era la matrícula (D-072); el `insert` directo en `class_group` se retira. Editar un grupo (su nombre de desdoble y, la administración, su docente) y renombrar o borrar una clase siguen siendo escrituras directas con su RLS.
- **«Duplicar» va en el menú de la clase** y copia solo los grupos de quien duplica (todos, para la administración), con su asignatura, nombre de desdoble y docente, en la clase del nombre y curso elegidos (creada, o la existente, a la que se une); con sus bloques y las fechas en semanas enteras (D-079) y, si se quiere, su alumnado. Los demás docentes añaden después sus asignaturas.
- **La pantalla de grupos se rehace alrededor de la clase** (`?clase=`): se elige la clase; a un lado sus asignaturas (de todos sus docentes, con menú solo en las propias) y al otro su alumnado, con una nota por alumno («No cursa: …», el desdoble en que está o «De otra clase: …») y sus acciones. «Nueva clase» sugiere las clases que existen y, si se escribe una, se une a ella.
- **La matrícula, como una tabla** (segunda iteración, a petición del autor, a quien no convencía el sistema de altas y bajas): una fila por alumno y una columna por grupo de la clase, con las siglas de la asignatura (sacadas de sus iniciales: PB, DWEC; sin campo nuevo) y, debajo, el desdoble y el docente. En los grupos propios (todos, para la administración), una casilla matricula o da de baja al momento, y el aviso ofrece «Deshacer» en lugar de pedir confirmación en cada clic; en los de otros docentes solo se ve. «Quitar de la clase», que alcanza a todos, sigue pidiendo confirmación.
- **Matricular a muchos de una vez** (también a petición del autor, porque había que conocer los nombres de los 30 alumnos y añadirlos uno a uno): el diálogo tiene «Sin clase este curso» (el alumnado activo sin clase en el curso, con «Seleccionar todos»; `class_candidates`), «Pegar una lista» (correos o nombres completos, uno por línea, hasta 500; dice qué líneas no tienen una cuenta de alumno, o tienen más de una; `match_students`), «De otra clase» y «Buscar». La pantalla envía los elegidos en peticiones de 50, una tras otra: cada una es todo o nada.
- **Un solo panel** (tercera iteración: al autor no le convencían las asignaturas como tarjetas encima de la tabla, porque puede haber 20, ni el menú que faltaba en la de otro docente): cada asignatura es una columna de la tabla, con su menú ⋮ en la cabecera (editar, ver sus bloques, matricular solo ahí, eliminar) o un candado y «La da …» si es de otro docente; con muchas, la tabla se desplaza en horizontal con los nombres fijos. «Matricular solo aquí» ofrece primero «De esta clase» (los que no están en el grupo, para elegirlos), no «Añadir los de esta clase» entera, que deshacía las excepciones.
- **Las asignaturas se añaden en un solo sitio** (iteraciones cuarta a sexta: el autor no veía sentido a añadirlas desde dos diálogos, uno con desdoble y otro sin él). «Añadir clase» pide solo el nombre y el curso; si la clase existe lo dice («Esta clase ya existe (la dan …): únete con tus asignaturas») y no la crea otra vez. Después, siempre, el mismo diálogo «Añadir asignaturas a …», que sabe qué grupos tiene la clase (`school_classes` trae todos, con su desdoble y su docente). Tiene la estética del de matrícula (séptima iteración, tras descartar un desplegable múltiple cuyo aviso «un desdoble se añade solo» no se entendía): la lista de las asignaturas del centro, por orden alfabético y con filtro, y debajo las elegidas, cada una «Toda la clase» o «Desdoble» con su nombre; una que la clase ya tiene para toda la clase solo puede ser desdoble. Se añaden de una en una con `add_class_group`: si una falla, las añadidas salen de las elegidas y el resto espera otro intento.
- **Un desdoble puede crearse antes que el grupo de toda la clase** (el autor lo planteó para el docente que da de alta su asignatura antes): con una sola asignatura nueva, la casilla «Es un desdoble (la asignatura se da partida)» le da nombre y lo crea sin alumnos. El grupo de toda la clase que llegue después no toma a quien ya está en un desdoble de esa asignatura, ni al crearse ni al matricular en la clase. Los desdobles se numeran desde «Desdoble 1», haya o no grupo de toda la clase.
- **El curso se elige, no se escribe** (al autor, escribir el año a mano le resultaba poco práctico): una clase nueva es de «Este curso» o de «El que viene», dos botones; «Editar la clase» cambia solo el nombre, porque sus grupos, bloques y fechas son de su curso (para otro, «Duplicar», que ofrece el anterior, el siguiente y el de después). Los cursos se calculan de la fecha y avanzan solos cada septiembre. La pantalla elige en dos niveles, «Curso» y «Clase», y abre por defecto una clase del curso actual: las antiguas siguen ahí sin mezclarse con las de este año.
- **Sacar la lista:** «Descargar la lista (CSV)» (nombre, correo, si está en la clase y en cada grupo; «;» y UTF-8 con BOM, como lo abre Excel en español; se genera en el navegador) y «Copiar los correos», uno por línea, el formato que acepta «Pegar una lista».
- **Lo que ve más un docente:** «Sin clase este curso» le enseña el nombre y el correo del alumnado del centro sin clase en ese curso, no solo los 20 que coinciden con una búsqueda. Son datos de contacto del centro, no el trabajo de nadie (D-062 se mantiene), y solo los ve quien cuida una clase. La descarga saca a un fichero lo que ese docente ya ve.
- **Datos de ejemplo de cinco cursos anteriores** (a petición del autor, para probar y para la demo): 2021/22 a 2025/26, con 1.º y 2.º de DAW y DAM, promociones de 8 que entran en 1.º, pasan a 2.º y acaban con la cuenta desactivada; la última está en 2.º este curso. Sin bloques ni intentos. Y 18 asignaturas más (las de DAW y DAM), para probar las listas largas.
- **La migración rellena las clases** a partir de los grupos de hoy por nombre (sin espacios ni mayúsculas) y curso; si una clase tiene dos grupos de la misma asignatura, el primero sigue siendo el de toda la clase y los demás pasan a «Desdoble 1», «Desdoble 2»…, y el alumnado de la clase es la unión de sus grupos. Se probó con datos de antes de migrar.

**Alternativas:**

- **La clase implícita de D-079:** sin tabla, pero dependía de escribir igual el nombre y no podía compartirse entre docentes.
- **Una clase por docente:** cada docente con su copia de 1.º DAW A y su lista de alumnos; justo lo que el autor vio raro.
- **Una confirmación en cada casilla:** segura, pero pesada en una tabla de 30 alumnos; «Deshacer» cubre el clic equivocado.
- **Siglas como campo de la asignatura:** más control, pero otra columna y otra pantalla de administración para algo que las iniciales resuelven; queda como idea si alguna sale ambigua.
- **Matrícula derivada de la clase** (el grupo lee el alumnado de la clase menos sus excepciones): obligaba a rehacer `is_enrolled()` y casi todas las políticas, el panel en vivo y las estadísticas.
- **Una sola asignatura por clase:** evitaba duplicados por despiste, pero no permitía los desdobles, que el autor confirmó que no son raros: a veces una parte de la asignatura se da en inglés. El aviso y el nombre del desdoble cubren el despiste.
- **Distinguir el desdoble editando el nombre del grupo:** el nombre ya es de la clase; volvería a depender de escribirlo a mano.
- **Mantener el nombre y el curso también en el grupo, sincronizados por un disparador:** dos copias del mismo dato.

**Consecuencias:**

- Migración `20261119160000_shared_classes.sql` y 43 tests de pgTAP nuevos (`shared_classes.test.sql`); `school_year_setup.test.sql` se queda con las fechas y «Copiar de otro grupo». 15 tablas en §2.3.
- `GroupService` se rehace (clases, alumnado de la clase, desdobles) en sus dos versiones; los demás servicios leen el nombre y el curso de la clase, y los selectores de Bloques, Histórico, panel en vivo y catálogo añaden el nombre del desdoble (`groupTitle()`, `groupName()`).
- El seed gana las dos clases y un desdoble de Javier en 1.º DAW A («Desdoble inglés», sin alumnos): una clase con dos docentes y dos grupos de una asignatura.
- Supera la clase implícita de D-079: salen `classOf()`, «Matricular también en» (`also_group_ids`) y `duplicate_groups`. «Copiar de otro grupo» en Bloques se queda.
- Para la memoria y la presentación: la clase compartida y los desdobles son un caso real de los centros de FP que el modelo de la memoria no contemplaba.

**Aprobación:** el autor eligió la clase compartida y aprobó las cinco decisiones (quién crea las clases, la matrícula copiada con excepciones, qué lee un docente de la clase, los desdobles con nombre y quitar el nombre y el curso del grupo), pidió los desdobles con un nombre editable que viniera relleno («Desdoble inglés, Desdoble alemán…») y que consten para la memoria y la presentación. En la segunda iteración pidió la tabla de matrícula, con las siglas de cada asignatura y si el alumno está o no, una forma de no añadir a los alumnos uno a uno y la exportación, ya que las listas se podían pegar, y aprobó todo lo propuesto que supusiera una mejora. En las siguientes pidió un solo sitio para añadir asignaturas, vio coherente crear el desdoble antes que el grupo de toda la clase, rechazó escribir el curso a mano y aprobó «Este curso / El que viene» con el selector de dos niveles. El detalle técnico, por delegación del autor.

## D-082 · Las clases de cursos pasados, cerradas; los grupos, por curso (20/11/2026)

**Contexto:** con cinco cursos anteriores en los datos (D-081), se podía matricular y añadir asignaturas en una clase de 2021/22, y Bloques, Histórico y el panel en vivo mezclaban en un desplegable los grupos de todos los cursos. Ya era un pendiente del 5.2a («Archivar los grupos de cursos pasados»).

**Decisión:**

- **Cierre automático por fecha:** una clase de un curso anterior al actual (que empieza el 1 de septiembre, en hora de Madrid, `current_school_year()`) es de solo lectura para todos, administración incluida: ni matricular ni dar de baja, ni añadir, editar o eliminar grupos, ni renombrar o eliminar la clase. Nadie crea, se une ni duplica hacia un curso pasado. Se sigue leyendo y duplicando, que es como se prepara el curso nuevo.
- **«Reabrir» para la administración** (`school_class.reopened`, solo con `reopen_class()`), y «Volver a cerrar». Una clase reabierta la cambian sus docentes como una del curso actual.
- **En el servidor:** `is_open_class()` e `is_open_group()` en la RLS de las escrituras directas y en las funciones que crean grupos o matriculan (`42501`). El servicio simulado falla igual que Supabase en cada caso.
- **En la pantalla:** el mismo selector «Curso», con candado en los cursos terminados; la clase cerrada, con un aviso que dice qué queda por hacer.
- **Bloques e Histórico eligen en dos niveles, «Curso» y «Grupo»**, como Grupos, abiertos en el curso actual (o el siguiente, si el actual no tiene grupos). El panel en vivo solo lista los grupos del curso actual, y «Asignar a un grupo», ninguno de un curso terminado. «Copiar de otro grupo» sigue ofreciendo todos, porque sirve para reutilizar los del curso pasado.

**Alternativas:**

- **Cierre o archivo explícito** («Cerrar la clase» en junio): da control, pero una clase que nadie cierra sigue editable, que era el problema.
- **Que la administración no tenga límite:** más cómodo, pero el error más probable es justo de quien lo ve todo; reabrir es un clic y queda a la vista.
- **Un desplegable agrupado por curso:** todos los grupos a la vista, pero con cinco cursos la lista seguía siendo larga.

**Consecuencias:**

- Migración `20261120100000_closed_classes.sql` y 24 tests de pgTAP (`closed_classes.test.sql`). `school-year.ts` pasa a `src/app/data/`; `GroupPicker` nuevo en `src/app/teacher/`.
- Quedan para pasos siguientes, acordados con el autor: los bloques de una clase cerrada, también de solo lectura; y el 5.2f, la evaluación final de cada alumno (Promociona, Repite, Titula, Baja), con la que los titulados y las bajas dejan de salir al matricular y la administración desactiva sus cuentas en bloque. Los docentes no desactivan cuentas (D-072), y no se crea un rol de secretaría (trabajo futuro).

**Aprobación:** el autor eligió el cierre automático con «Reabrir» y los dos niveles, propuso la evaluación final con sus términos y dio el paso por bueno en el navegador de forma provisional.

## D-083 · Los bloques de una clase cerrada, de solo lectura; copiar, deshacer y borrar varios (20/11/2026, propuesta)

**Contexto:** desde el 5.2e (D-082) una clase de un curso pasado no se cambia en Grupos, pero sus bloques sí se podían editar en Bloques. Al probarlo, el autor preguntó si tenía sentido que un docente editara los bloques de cursos pasados, y se acordó que no: son lo que tuvo su alumnado aquel curso, y cambiarlos falsea el histórico. Para reutilizarlos ya estaba «Copiar de otro grupo» (D-079). Al probar este paso, el autor vio que copiar dos veces lo mismo duplica los bloques y que un error solo se arreglaba borrando bloque a bloque.

**Decisión (cómo se usa):**

- **Un grupo de una clase cerrada se consulta en Bloques, sin cambiar nada.** Arriba, un aviso con candado: «El curso 2025/26 ya terminó: estos bloques se pueden ver, pero no cambiar. Para reutilizarlos, abre tu grupo de 2026/27 y pulsa «Copiar de otro grupo».» La administración ve además «Para corregirlos, reabre la clase en Grupos». El aviso nombra el curso actual, no «este curso», que era ambiguo. No hay «Nuevo bloque», «Copiar de otro grupo», «Seleccionar», arrastrar, «Visible», menús de bloque o de ejercicio, «Añadir ejercicios» ni botones de fecha u ocultar. La fecha de entrega y lo oculto se ven como texto, y los ejercicios se siguen abriendo. Un grupo cerrado sin bloques dice «Este grupo no tuvo bloques».
- **«Reabrir» la clase en Grupos lo desbloquea todo,** y el aviso pasa a decir que la administración la ha reabierto. «Volver a cerrar» lo bloquea de nuevo.
- **Los bloques de un curso pasado se reutilizan copiándolos:** «Copiar de otro grupo», en un grupo abierto, los ofrece como origen. Copia los bloques en su orden, detrás de los que haya, con título, traducciones, ejercicios (los mismos del banco), orden y visibilidad. Con «Con sus fechas», la apertura y las entregas pasan al curso del destino en semanas enteras, el mismo día de la semana y a la misma hora (D-079). No copia matrícula, intentos ni notas, y el origen no cambia. «Asignar a un grupo», desde el banco, solo ofrece grupos de clases abiertas, también las reabiertas.
- **Copiar lo que ya hay:** se puede, porque una recuperación empieza como copia de un tema, pero el diálogo avisa al elegir el origen: «Este grupo ya tiene «Tema 1», «Tema 2»…: se añadirán otra vez, aparte de los que hay. Si solo querías cambiar sus fechas, borra antes los que copiaste («Seleccionar», en Bloques) y vuelve a copiar.» Se comparan los títulos sin mayúsculas ni espacios en los extremos. Copiar nunca mezcla ni sustituye bloques: cada copia lleva las fechas de su origen.
- **«Deshacer» después de copiar:** el aviso dice qué se copió y de dónde («4 bloques copiados de 1.º DAW A · Programación básica · 2025/26»), para confirmar que se eligió el grupo correcto. Trae «Deshacer», que borra de una vez los bloques recién copiados (los que quedaron detrás de los que había). Si alguien hubiera empezado ya alguno, ese se queda y se avisa. Como los copiados quedan al final de la lista, fuera de la vista, la página baja al primero con un desplazamiento suave (inmediato para quien pide menos movimiento al sistema), lo deja arriba del todo y le da el foco. «Nuevo bloque» baja igual al bloque creado. Este aviso dura 10 segundos en lugar de 6 (`LONG_SNACK_BAR_DURATION_MS`): da tiempo a verlos antes de que «Deshacer» desaparezca. Pasado ese tiempo, queda «Seleccionar» para borrarlos, así que «Deshacer» nunca es la única salida (el autor preguntó si no iba demasiado rápido).
- **«Seleccionar» para borrar varios bloques a la vez:** en la cabecera de Bloques, junto a «Copiar de otro grupo». Pone una casilla en cada bloque; solo se marcan los que nadie ha empezado, y los demás salen desactivados. Arriba aparece una barra con fondo propio, que se queda fija al bajar por la lista: el recuento («4 bloques marcados»); «Marcar los no empezados», que pasa a «Desmarcar todos» cuando ya están todos; «Borrar 4», que pide confirmación («¿Borrar 4 bloques?… No se puede deshacer»), y «Cancelar», que sale del modo. Al entrar no se mueve nada: la fila normal tiene el mismo alto y relleno que la barra, solo aparece el fondo, y «Cancelar» queda donde estaba «Seleccionar», a la derecha del todo (el autor notó que antes los botones saltaban). Mientras se selecciona, el botón flotante «Nuevo bloque» se oculta: un modo cada vez, y en el móvil taparía la casilla del último bloque. Las demás acciones no se fijan: «Copiar de otro grupo» y «Seleccionar» se usan de vez en cuando y al empezar, y fijas ocuparían alto de pantalla y competirían con el botón flotante y los avisos. Tampoco hay botón de «subir arriba»: el autor lo planteó y se descartó (ver la respuesta en la bitácora del paso). «Borrar» es tonal y no del color principal: lo que protege es la confirmación, y una acción destructiva no debe parecer la de «adelante». Si mientras tanto alguien empieza uno, ese se queda y se avisa. El modo de selección, y no casillas siempre a la vista, evita llenar cada bloque de controles para algo que se hace pocas veces (el autor lo preguntó y se mantuvo).

**Decisión (técnica):**

- **Servidor:** migración `20261120120000_closed_class_blocks.sql`. Las políticas de insertar, cambiar y borrar de `class_block` y `exercise_assignment` añaden `is_open_group(group_id)`. Las funciones de seguridad del invocador (`create_block`, `assign_exercises`, `reorder_blocks`, `reorder_assignments`, `move_assignment`) fallan con `42501` por la RLS, y las escrituras directas quedan sin filas. `copy_blocks`, del definidor, comprueba el destino (`42501`); el origen puede estar cerrado.
- **Datos:** `PlannedGroup.open`, con `isOpenClass()` en `school-year.ts`, la misma regla en el cliente que en los dos servicios. `BlockService.removeBlocks()` borra varios en una sola sentencia (la RLS deja lo empezado) y devuelve cuántos. `MockBlockService` falla como Supabase en cada escritura a una clase cerrada: `forbidden` al crear, asignar, reordenar, mover o copiar hacia ella; `not_found` al cambiar; `invalid` al borrar.
- **Datos de ejemplo:** el grupo de Programación básica de 1.º DAW A de 2025/26 (Marta) trae los cuatro temas de este curso, con las fechas un año antes y sin intentos, para consultar una clase cerrada y copiar de ella en la demo.

**Alternativas:**

- **No permitir copiar dos veces lo mismo:** impedía hacer una recuperación a partir de un tema.
- **Saltarse al copiar los bloques que ya existen, o copiar «solo las fechas» buscándolos por título:** un «Tema 1» puede ser de otra asignatura o tener otros ejercicios; faltarían bloques o cambiarían fechas sin que el docente lo vea.
- **Comprobar la clase abierta solo en la pantalla:** cualquier llamada directa seguiría cambiando el histórico.

**Consecuencias:**

- Sale de [PENDIENTES](PENDIENTES.md) la fila del 5.2e sobre los bloques de una clase cerrada. La evaluación final, que el 5.2e llamaba 5.2f, pasa a ser el 5.2g.
- Para la memoria: las fechas copiadas conservan el día de la semana (D-079).

**Aprobación:** el autor aprobó el plan y la numeración. Al probarlo pidió un aviso más claro (dos iteraciones, hasta nombrar el curso), y aprobó el aviso de repetidos, «Deshacer» y «Seleccionar» para borrar los no empezados. Pidió documentarlo todo para sacar después un manual de funcionalidades.

## D-084 · La evaluación final: qué pasa con cada alumno al acabar el curso, y una clase por alumno y curso (21/11/2026, propuesta)

**Contexto:** con las clases de cursos pasados cerradas (D-082), faltaba decir qué pasa con cada alumno al acabar el curso. Sin eso, quien titulaba o se iba seguía saliendo para matricular al curso siguiente y la administración no sabía qué cuentas desactivar. Lo acordó el autor al cerrar el 5.2e, con sus propios términos: Promociona, Repite, Titula y Baja. Al probarlo salieron tres preguntas más: por qué se podía matricular a una alumna de baja, quién gestiona a un alumno al que no das clase y qué pasa si alguien está en dos clases del mismo curso.

**Decisión (cómo se usa):**

- **Evaluar, en Grupos:** el botón «Evaluación final» de la barra de la clase enseña la columna «Evaluación», con la etiqueta de cada alumno de la clase: «Promociona», «Repite», «Titula», «Baja» o «Sin evaluar». Se cambia en su menú, al momento. Encima de la tabla, el resumen («Evaluación final: 5 de 8 · 4 promocionan · 1 repite») y dos atajos, «Promocionan los N sin evaluar» y «Titulan los N sin evaluar», que nunca pisan una evaluación puesta y traen «Deshacer». La ✕ oculta la columna, que sale ya visible en una clase cerrada o en una que alguien empezó a evaluar.
- **Quién evalúa:** cualquier docente de la clase (también quien la creó) o la administración, y también con la clase cerrada: es lo único que cambia en ella, porque en septiembre el curso ya cerró y la evaluación puede estar por hacer. Se evalúa a los alumnos de la clase; quien solo cursa una asignatura aquí lleva «—» («Se evalúa en su clase»).
- **«Titula» se puede poner en cualquier curso:** la app no sabe cuál es el último de un ciclo, y el docente sí.
- **Quitar de la clase borra su evaluación**, que es de esa clase; en una clase cerrada no se quita a nadie.
- **Al matricular, de dónde viene cada alumno:** cuenta su última clase hasta el curso de la clase donde se matricula, sea cual sea la clase de la que se copie, y su evaluación en ella.
  - «Sin clase este curso» (o «Sin clase en 2027/28» para una clase de otro curso) agrupa a los alumnos por esa última clase, cada grupo con su casilla («Promocionan de 1.º DAW A · 2025/26», «Repiten 2.º DAM B · 2025/26», «Sin evaluar en …», «Sin clase anterior»), y no ofrece a quien tituló o causó baja.
  - «Buscar» dice bajo cada alumno su última clase («1.º DAM B · 2026/27»). Quien tituló o causó baja sale con un aviso y se puede elegir, porque puede volver (titular en DAW y empezar DAM, o volver tras una baja): ahí el docente busca a esa persona y lo ve.
  - «De otra clase» y «Pegar una lista» se saltan a quien tituló o causó baja y lo dicen bajo «No se añaden:», porque son las vías por las que alguien se cuela sin que nadie lo vea. Al copiar una clase antigua cuenta su última clase, no la evaluación en la copiada: quien promocionó en 2025/26 y causó baja en 2026/27 no entra.
- **No se bloquea la matrícula por la evaluación:** si para volver a matricular a alguien hubiera que borrarle la evaluación, se falsearía el historial (aquel curso sí tituló). Lo que de verdad deja fuera a alguien es su cuenta desactivada; si vuelve, la administración la reactiva.
- **Una clase por alumno y curso:** un alumno de otra clase del mismo curso no se matricula en esta. «Buscar» lo enseña con «Ya está en 1.º DAM B · 2026/27» y la casilla desactivada; «De otra clase» y «Pegar una lista» lo saltan; en la tabla, quien cursa una asignatura desde otra clase lleva «De 1.º DAM B» y no se le ofrece «Añadir a la clase». Para cambiar a alguien de clase, primero se le quita de la suya (su trabajo se conserva). Cursar una asignatura de otra clase sigue siendo «Matricular solo aquí…», que no lo hace alumno de la clase.
- **En Usuarios, la administración:**
  - un aviso, «4 alumnos titulados o de baja siguen con la cuenta activa.», con «Revisar y desactivar…»: la lista con todos marcados y su última clase («Titula · 2.º DAW A · 2025/26»), para desmarcar a alguien y desactivar el resto de una vez. Cuenta a quien tituló o causó baja en su última clase, también en la de este curso; quien volvió y está en una clase posterior no cuenta. Los docentes no desactivan cuentas (D-072);
  - el filtro «Situación del alumnado»: «En una clase este curso», «Sin clase este curso» o «Titulados o de baja» (`?situacion=`);
  - «Ver su trayectoria» en el menú de cada alumno: sus clases curso a curso con su evaluación, para saber si alguien ya estuvo en el centro antes de reactivarlo;
  - si una búsqueda no encuentra nada con el estado elegido pero sí con otro, lo dice («Ninguna cuenta activa coincide, pero una desactivada sí.») con «Ver todas las cuentas».
- **Quién da de alta a los alumnos nuevos:** la administración, en Usuarios, de uno en uno (D-072). Dar de alta a muchos de una vez queda para el 5.2h.

**Decisión (técnica):**

- **Migración `20261121100000_final_evaluation.sql`:** el tipo `class_outcome` y la columna `class_member.outcome`; `last_class_member(up_to_school_year)` (sin permisos para nadie), la última clase de cada alumno hasta un curso; `set_class_outcomes()` (`manages_class`, sin mirar si la clase está cerrada, 100 alumnos como mucho, `P0002` para quien no es de la clase); `class_roster` gana `outcome` y `other_class_name`; `class_candidates`, `search_class_students`, `search_students` y `match_students` devuelven la última clase y su evaluación (`class_candidates` sin quien terminó); `finished_students()`, solo para la administración (`42501`); y el disparador `class_member_one_class_a_year`, que rechaza con `23505` a un alumno en otra clase del mismo curso, por cualquier vía. 28 tests de pgTAP nuevos (425 en total); tres tests anteriores pasan a clases de otro curso o a una alumna sin clase.
- **`admin-users` gana la acción `disable`** con hasta `MAX_DISABLE_BATCH` (100, en `user-rules.ts`, compartido con la app) cuentas distintas: cada una como un `update` de estado, una tras otra, y responde `{ disabled, failed }`, porque Auth no admite transacciones. Una que no existe, la propia o una que falla no detiene a las demás.
- **Servicios:** `GroupService.setOutcomes()`, `listCandidates()`, `searchStudents()` y `matchStudents()` con `ClassCandidate` (`student` y `previous`), `RosterStudent.outcome` y `otherClass`; `AdminService.listFinishedStudents()`, `disableUsers()` y `UserEntry.classes`. Las dos versiones; la simulada falla igual que Supabase en cada caso. Las piezas de pantalla comunes, en `src/app/shared/class-outcome.ts`; las reglas del diálogo de matrícula, en `enroll-choice.ts` (`enrollBlocker`, `sortOutCandidates`); la situación de un alumno, en `user-filter.ts` (`studentSituation`).
- **Datos de ejemplo:** las clases pasadas, evaluadas (primero promociona, segundo titula). En 2025/26, 1.º DAW A de Marta queda sin evaluar; en 2.º DAM B una alumna repite y otro causó baja, los dos sin clase este curso; y tres que titularon en 2.º DAW A siguen con la cuenta activa.

**Alternativas:**

- **Bloquear la matrícula de quien tituló o causó baja:** obligaba a borrar su evaluación para que volviera, y eso falsea el historial; y el docente de la clase nueva no podría resolverlo solo.
- **Mirar la evaluación en la clase que se copia:** más simple, pero dejaba colar a quien se fue después.
- **Desempatar dos clases del mismo curso por orden o por la evaluación:** cualquier regla fallaba en algún caso (alguien que se cambia de clase a mitad de curso); una clase por curso evita el problema.
- **Un rol de secretaría con expedientes:** trabajo futuro en la memoria; la administración tiene ya la vista de centro que necesita (aviso, filtro y trayectoria).
- **Que los docentes desactiven cuentas:** contradice D-072.

**Consecuencias:**

- Sale de [PENDIENTES](PENDIENTES.md) la fila del 5.2e sobre la evaluación final; entra el 5.2h, el alta de varios alumnos.
- `docs/DESPLIEGUE.md`: `db push --remote` y volver a desplegar `admin-users`.
- Para la memoria: el cierre de curso real de un centro de FP (promociona, repite, titula, baja) salió de la conversación con el autor, y por qué la evaluación informa pero no bloquea.

**Aprobación:** el autor aprobó el plan. Al probarlo vio que se podía matricular a una alumna de baja y preguntó si bloquearlo; aceptó la opinión de no bloquear y avisar, y pidió la vista de centro para la administración. Preguntó cómo se gestiona a un alumno al que no se da clase y quién da de alta a los nuevos (de ahí la procedencia en «Buscar» y el 5.2h), por qué no salía Andrea en la búsqueda (de ahí los mensajes de «no encontrado»), si se miraba la última clase aunque no fuera la copiada (no lo hacía: se corrigió) y qué pasaba con dos clases del mismo curso. Después dio vía libre al agente. El detalle técnico, por delegación del autor.

## D-085 · El alta de varios alumnos con la lista de secretaría, y el ancho fijo de los diálogos con formulario (21/11/2026, propuesta)

**Contexto:** al empezar el curso, secretaría pasa la lista de alumnos nuevos y la administración tenía que crear sus cuentas de una en una (D-072). Se acordó al cerrar el 5.2g (D-084). Al probarlo, el autor vio además que el diálogo de «Nuevo usuario» cambiaba de ancho al pulsar el ojo de la contraseña.

**Decisión (cómo se usa):**

- **Dónde:** en Usuarios, el botón «Alta de varios…», junto a «Nuevo usuario». Solo la administración da de alta cuentas; los docentes no (D-072).
- **Pegar la lista:** un alumno por línea, con su nombre y su correo en cualquier orden, tal como sale de Excel (tabuladores) o separados por «;» o comas. Hasta 500 líneas de una vez.
  - «García López, Ana» pasa a «Ana García López», como están las cuentas.
  - Un nombre en mayúsculas se escribe como nombre: «DE LA FUENTE DEL RÍO, MARÍA JOSÉ» queda «María José de la Fuente del Río».
  - Si el nombre va en varias columnas (nombre y apellidos), se juntan; «Ana <ana@centro.es>» también vale.
- **Revisar antes de crear nada:** «Se crean N cuentas de alumno · M líneas se quedan fuera», y dos listas:
  - «Se crean»: el nombre y el correo, tal como quedarán;
  - «No se crean»: cada línea con su número y el motivo: «Ya tiene una cuenta», «Tiene una cuenta desactivada: actívala en la lista», «Repetido en la lista», «Sin un correo válido», «Sin nombre», «Nombre demasiado largo» o «Correo demasiado largo». Una fila de cabecera («Nombre;Correo») sale aquí como «Sin un correo válido»: no se ignora sola, porque cualquier regla para reconocerla podría saltarse a un alumno.
  - «Volver a la lista» devuelve al texto para corregirlo.
- **Matricular (opcional):** «Matricular en una clase», con las clases abiertas de este curso o de uno posterior («1.º DAW A · 2026/27»). Si no se puede leer la lista de clases, no se ofrece y el alta sigue. Quien ya tenía cuenta no se matricula desde aquí: se hace en Grupos con «Pegar una lista», que aplica las reglas de la evaluación final (D-084).
- **Crear:** cada cuenta recibe una contraseña al azar de 12 caracteres sin los que se confunden en papel (el generador de «Nuevo usuario»). «Creando las cuentas: 25 de 60…», con una barra de progreso. Si se corta la red, lo creado se queda y el diálogo dice cuántas faltan, con «Reintentar los que faltan». Si una cuenta se creó mientras tanto en otra sesión, se dice («Ya tenían cuenta, no se ha cambiado nada: …»), y si una falla, también («No se pudieron crear: …»).
- **Entregar las contraseñas:** «N cuentas creadas y matriculadas en 1.º DAW A · 2026/27», el aviso «Las contraseñas solo se ven ahora…» y la lista con el nombre, el correo y la contraseña de cada uno.
  - «Descargar CSV»: nombre, correo y contraseña, con «;» y las tildes bien en Excel.
  - «Imprimir las tiras»: una tira por alumno, dos por fila, con línea discontinua para recortar: «Tu cuenta de TutorIA», el nombre, el correo, la contraseña en letra de código y la dirección de entrada.
  - El CSV y el PDF se llaman igual: «Credenciales 1.º DAW A 2026-27», o con la fecha si no se matriculó en ninguna clase.
  - Cerrar sin descargar ni imprimir (con el botón, Esc o fuera del diálogo) pregunta antes («¿Cerrar sin guardar las contraseñas?»), porque no se vuelven a ver; mientras se crean, el diálogo no se cierra. Al cerrar, la lista de Usuarios se recarga con las cuentas nuevas y sus grupos.
- **Los diálogos con formulario tienen un ancho fijo:** el de un diálogo (560 px, o la pantalla menos 32 px en el móvil), con ayuda o con error. Antes, al salir de un campo vacío, la ayuda larga se cambiaba por un error más corto y el diálogo se estrechaba bajo el puntero. Se aplica a los de usuario, contraseña, asignatura, bloque, asignar, copiar bloques y duplicar.

**Decisión (técnica):**

- **`admin-users` gana `create_students`:** hasta `MAX_CREATE_BATCH` (25, en `user-rules.ts`, compartido con la app) alumnos distintos y válidos, o nada (`400`). Cada cuenta se crea con la API de Auth una tras otra; el disparador `create_app_user` hace su fila de alumno con su nombre, así que no se escribe nada más. Responde `{ created, existing, failed }`: un correo con cuenta va a `existing`, y una cuenta que falla (también si no aparece su fila) va a `failed` y se borra si llegó a crearse. Las contraseñas las genera la pantalla y la función nunca las devuelve. El cuerpo admite ahora 40 kB (25 alumnos con tildes).
- **La pantalla manda la lista en tandas de 25:** cada una responde a tiempo con Auth creando las cuentas de una en una, y la barra dice por dónde va. La matrícula usa `enrollInClass()` en tandas de `MAX_ENROLLMENT_BATCH`.
- **Servicios:** `AdminService.createStudents()` con `NewStudent` y `CreateStudentsResult`, en las dos versiones; la simulada rechaza igual que la función. Las funciones puras, en `admin/users/student-list.ts` (`readStudentList`, `reviewStudentList`, `credentialsCsv`, `credentialsTitle`).
- **CSV seguro:** `toCsv()` en `shared/download-text.ts`, compartido con la lista de la clase de Grupos, pone una comilla delante de un campo que empieza por `=`, `+`, `-` o `@`, para que un nombre pegado no se ejecute como fórmula al abrir el fichero.
- **Las tiras se imprimen en la propia página, no en un iframe:** la política de seguridad de Vercel no admite marcos (`frame-src 'none'`). `credentials-sheet.ts` monta la hoja al final del `body`, con `aria-hidden`, pone una clase en la raíz para que `@media print` solo imprima la hoja (`credentials-sheet.css`), cambia el título de la página por el nombre de los ficheros y lo deshace todo con `afterprint`. Lleva colores fijos, no tokens: el papel es blanco aunque la app esté en oscuro (como la mascota, D-022).
- **El ancho de los diálogos:** una regla en `theme.scss` (`dialog-overrides` con `container-min-width: min(560px, calc(100vw - 32px))`) sobre el panel que contiene `.app-form-dialog`, porque el panel lo crea Material y Tailwind no llega a él.

**Alternativas:**

- **Que la función genere las contraseñas:** las devolvería en la respuesta; generándolas la pantalla con el mismo generador de «Nuevo usuario», la función nunca las contesta.
- **Una petición con toda la lista:** con Auth creando cuentas de una en una, una lista larga podía pasar del tiempo de la función sin decir por dónde iba.
- **Imprimir en un iframe o una ventana nueva:** lo impide la política de seguridad, y una ventana nueva la bloquean los navegadores.
- **Ignorar sola la primera línea sin correo:** podría saltarse a un alumno cuyo correo está mal; se ve y se entiende en «No se crean».
- **Matricular también a quien ya tenía cuenta:** obligaría a repetir aquí las reglas de la evaluación final; para eso está «Pegar una lista» en Grupos.

**Consecuencias:**

- Sale de [PENDIENTES](PENDIENTES.md) la fila del 5.2h; entran tres: matricular aquí a quien ya tenía cuenta, la fila de cabecera y que el primer acceso pida cambiar la contraseña cuando exista esa opción.
- `docs/DESPLIEGUE.md`: volver a desplegar `admin-users`.
- Para la memoria: lo que pesa en un centro no es crear las cuentas, sino entregarlas; por eso el paso acaba en un CSV y en tiras para recortar.

**Aprobación:** el autor aprobó el plan. Al probarlo vio que el diálogo de «Nuevo usuario» cambiaba de ancho al pulsar el ojo y preguntó por qué (se explicó y se arregló en todos los diálogos con formulario), y que el PDF se guardaba como «Claude.pdf» (era el navegador interno, pero ahora se llama como el CSV). Después dio el paso por bueno y lo cerró. El detalle técnico, por delegación del autor.

## D-086 · El dictado: el campo de siempre, que el alumno revisa y envía (21/11/2026, propuesta)

**Contexto:** el 6.1b añade la segunda pieza de la voz (2.11, RF-08): dictar la pregunta al tutor. El plan del paso fijaba casi todo; al implementarlo salieron detalles que cambian lo que ve el alumno.

**Decisión (cómo se usa):**

- **Dónde:** «Dictar» es un micrófono junto a enviar, en el campo de la pregunta. Solo sale con la voz activada en los ajustes y en un navegador que reconoce la voz (no en Firefox), y no en la vista previa del docente. No depende de que haya voces del idioma: se puede dictar sin poder escuchar.
- **Dictar:** al pulsarlo, el tutor se calla si estaba hablando, el botón queda marcado y bajo el campo se lee «Te escucho…» con el micrófono latiendo (sin animación si el sistema pide menos movimiento). Lo que el navegador va entendiendo aparece tras lo escrito y se sustituye hasta que se fija; lo fijado se queda. Si empieza frase (campo vacío, o tras un punto, una interrogación, una exclamación, unos puntos suspensivos o una línea nueva), con mayúscula: el navegador lo da en minúscula. Lo dictado nunca pasa de los 500 caracteres de una pregunta.
- **Acabar:** pulsar otra vez, Esc (que no pliega el tutor flotante), escribir en el campo, enviar, ocultar la pestaña, salir de la pantalla u 8 segundos sin voz. Lo que se estaba entendiendo al parar se queda en el campo para revisarlo. Nunca se envía solo.
- **El aviso del audio,** antes de abrir el micrófono por primera vez, solo si el navegador transcribe en su servicio: «Tu navegador envía el audio a su servicio de reconocimiento para transcribirlo. TutorIA no lo graba», con «Entendido», que lo recuerda para ese usuario y empieza a dictar.
- **Errores,** sobre el campo, sin perder lo escrito y diciendo qué hacer: sin permiso para el micrófono, sin micrófono, servicio no disponible e idioma no admitido. No oír nada no es un error, pero si el dictado acaba en silencio sin que el navegador haya dado ningún texto, un aviso suave (`role="status"`, no de error) dice «No he entendido nada. Prueba otra vez o escribe tu pregunta». No sale si lo para el alumno. Escribir o volver a dictar quita los avisos.
- **Ajustes:** «Dónde se transcribe tu voz» dice lo que hace este navegador: en el equipo, en su servicio (con «Reconocer la voz en este equipo» si solo falta el paquete del idioma) o que no reconoce la voz. Al acabar la descarga, el foco pasa al título de la línea y la línea nueva se anuncia. La pantalla de datos registrados dice lo mismo en su servicio de reconocimiento de voz.

**Decisión (técnica):**

- **`listen()` nunca rechaza:** devuelve `Listening` con `stop()` y `ended`, que dice por qué acabó (2.11). Parar usa `abort()`, no `stop()`: así no llega ningún resultado después de parar, que caería sobre lo que el alumno ya está escribiendo.
- **`service-not-allowed` es servicio no disponible, no falta de permiso:** según MDN es el servicio rechazado (también en el equipo sin el paquete), y el mensaje de permiso mandaría al alumno a la barra de direcciones sin motivo.
- **`install()` solo desde el botón:** necesita un clic del usuario (rechaza sin él), y `available()` dice `downloadable` hasta que se llama aunque el paquete ya esté.
- **«Te escucho…» lo anuncia Material:** la zona de ayuda del campo ya es una región `aria-live="polite"`, así que no se añade otra (se leería dos veces).
- **Conmutador con el mismo nombre:** «Dictar» con `aria-pressed` y el tooltip que cambia, como «Ampliar el código» y «Mostrar contraseña»; cambiar el nombre y el estado a la vez es lo que la guía ARIA desaconseja.
- **«Dictar» solo con `TutorSpeaker`:** su presencia marca la pantalla del alumno; `StudentVoice` es de toda la aplicación y la vista previa del docente también tiene el campo.
- **Mayúscula en una función pura** (`appendDictation`), con su test: no depende del navegador.
- **El aviso de no haber entendido nada sale del propio dictado:** recuerda si el navegador dio algún texto y lo dice al acabar por silencio (el suyo de 8 s o el del navegador). Nació en la prueba del autor: Chrome 157 en su Mac detectaba la voz y no devolvía texto en ninguna web salvo, a ratos, la demo de Google; sin aviso, «Dictar» parecía no hacer nada.

**Alternativas:**

- **El texto del plan para el anuncio** (un `<p aria-live>` propio): duplicaba el de Material.
- **Cambiar el nombre a «Dejar de dictar»:** lo pedía la ficha; se quedó en el tooltip por la guía ARIA.
- **El indicador del micrófono también en la cabecera y la mascota plegada:** con el dictado no hace falta, porque plegar el tutor quita el campo y para el dictado. Lo hará el 6.1c para la llamada.

**Consecuencias:**

- El 6.2b llama a `setDrafting()` también desde lo dictado (anotado en su plan).
- Entra en [PENDIENTES](PENDIENTES.md) la tabla de motores con un dictado real en cada navegador, y en [E2E-PENDIENTES](E2E-PENDIENTES.md) el e2e del dictado con un reconocimiento falso.

**Aprobación:** el autor aprobó el plan y los cinco ajustes propuestos. Al probarlo en su Chrome no salía nada; se diagnosticó con él (el fallo es del reconocimiento de su Chrome, no de la app) y aprobó las dos mejoras que salieron: el aviso de no haber entendido nada y un «Te escucho…» más visible. El detalle técnico, por delegación del autor.

## D-087 · La llamada con el tutor: la tarjeta, las teclas y una llamada sin `effect()` (22/11/2026, propuesta)

**Contexto:** el 6.1c une la síntesis (6.1a) y el dictado (6.1b) en una conversación por turnos y sin manos (2.11). El plan de implementación fijaba la máquina de estados; quedaban por decidir el aspecto de la llamada (en `PENDIENTES.md`, un «aspecto de videollamada» con boceto), las teclas y el ajuste para interrumpir hablando. Al revisarlo salieron además cinco fallos del plan.

**Decisión (cómo se usa):**

- **Llamar:** un teléfono, «Llamar al tutor», en la cabecera del tutor, con la voz activada, una voz y un navegador que reconoce la voz. La primera vez, si el audio sale del equipo, antes el aviso del audio (el mismo del dictado). El tutor dice «Te escucho» y después se abre el micrófono. Durante la llamada el botón sigue ahí, deshabilitado y enfocable («En llamada»), y al colgar el foco vuelve a él.
- **La tarjeta** (boceto C de tres, aprobado por el autor), sobre «Pedir pista»: la mascota es la cara del tutor, con su gesto en cada estado (escucha con la lengua fuera, piensa, habla, descansa) y un anillo que late mientras el micrófono está abierto; el estado («Te escucho», «Pensando…», «Hablando…», «En espera»); dos líneas fijas, para que la tarjeta no salte, con lo que se va entendiendo, la frase que dice el tutor como subtítulo, «Habla cuando quieras» o «Micrófono cerrado»; y una fila a todo el ancho con el botón del estado («Pausar», «Corregir», «Interrumpir», «Seguir hablando») y «Colgar», en rojo. Durante la llamada, la mascota de la cabecera y la del chat vacío se ocultan (una sola cara), «Hablando · Parar» de la cabecera no sale (la tarjeta ya tiene «Interrumpir») y «Dictar» queda deshabilitado (los dos usan el micrófono).
- **Turnos:** el alumno habla y, tras 1,5 s de silencio, la pregunta se envía. Si el tutor aún escribe la respuesta anterior (porque el alumno le interrumpió), la pregunta espera a que acabe; no se pierde. Una pregunta escrita o una pista durante la llamada también se dicen. «Escuchar» bajo una respuesta, en una llamada, la repite: cierra el micrófono, la dice y vuelve a escuchar.
- **Teclas:** **Control sola** (pulsar y soltar sin otra tecla ni clic en medio, en menos de medio segundo) interrumpe al tutor mientras habla, y en cualquier otro momento no hace nada; **Ctrl + .** pausa la llamada en cualquier estado o la retoma; **Esc** descarta lo que el alumno está diciendo, sin plegar el tutor flotante. Los tooltips lo dicen: «Interrumpir (Ctrl)», «Pausar (Ctrl + .)», «Seguir hablando (Ctrl + .)».
- **Interrumpir hablando:** el ajuste «Interrumpir al tutor hablando», apagado por defecto y solo donde el navegador reconoce la voz, con «Mejor con auriculares: con altavoces, puede oír al tutor y cortarle sin querer». Con él, el micrófono sigue abierto mientras el tutor habla y dos palabras propias lo cortan; lo que repite al tutor (`isEcho()`, comparado con sus dos últimas frases) no.
- **Plegado:** la mascota flotante lleva el anillo, y una línea encima, en lugar del bocadillo de la respuesta, dice lo que se va entendiendo, el estado o el subtítulo, con un «Colgar» pequeño que devuelve el foco a la mascota. En el móvil, la pestaña «Tutor» lleva un micrófono mientras dura la llamada y su nombre dice «en llamada».
- **Espera y cortes:** «Pausar», Ctrl + ., 90 s sin voz u ocultar la pestaña dejan la llamada en espera con el micrófono cerrado. Una respuesta que llega en espera se dice y deja 10 s para contestar. Si la respuesta falla, el tutor lo dice («No he podido responder») y el chat tiene su «Reintentar»; con demasiadas preguntas dice cuánto esperar y queda en espera. Un error del micrófono, o tres cierres seguidos en menos de un segundo, cuelgan con un aviso que dice por qué.
- **Colgar:** «Colgar», cambiar de ejercicio, entregar o salir de la pantalla cierran el micrófono y callan al tutor.
- **Lo que queda en el chat** (iteración 2, a petición del autor): «Te lo dejo en el chat» tras cada respuesta con código o con un botón sonaba a coletilla. Ahora el tutor dice qué deja: el botón por su nombre («Te dejo en el chat el botón Ejecutar las pruebas»), varios con «y», o que hay código, con tres frases que se turnan de una respuesta a la siguiente; con las dos cosas, una sola frase. Vale también fuera de una llamada (`closingSentence()`, una función pura que usa los nombres de los botones del chat). Se decide una vez por respuesta: si el alumno pulsa el botón mientras el tutor aún habla, la frase no cambia a mitad. No lo dice el modelo: no sabe qué partes no se leen, y la frase solo tiene sentido en voz, no escrita en el chat.

**Decisión (técnica):**

- **`VoiceCall` sin `effect()`:** el plan le daba uno para seguir los turnos, pero `TutorSpeaker` ya tiene el suyo sobre los mismos turnos y Angular no garantiza el orden de los dos. Si el de la llamada corría primero, veía la respuesta completa aún sin voz, abría el micrófono y el tutor hablaba con él abierto. En su lugar, `TutorSpeaker` avisa a la llamada (`follow(AnswerFollower)`): empieza a decir una respuesta, primer texto, primer sonido, acaba (dicha, callada o fallida), la conversación se cierra (otro ejercicio o el intento entregado) o vuelve a aceptar preguntas. `VoiceCall` queda en métodos, temporizadores (`createDebouncer`, como los 8 s del dictado) y `computed()`: pasar de «Pensando…» a «Hablando…» se deriva de `speakingTurnId()`. El único `effect()` de la voz sigue siendo el de `TutorSpeaker` (frontera con Web Speech, 4.8), más el de `voiceschanged` de `StudentVoice`.
- **La pregunta que espera** no sondea con un temporizador: la envía el aviso `free()` cuando la respuesta que llegaba está completa.
- **Control sola** no es una tecla de carácter (WCAG 2.1.4 no pide poder cambiarla) y nadie la usa sola: ni CodeMirror ni los navegadores. Los lectores de pantalla ya la usan para callar, así que encaja. **Ctrl + .** abre el micrófono solo a propósito, con una combinación; en macOS es Control porque ⌘ + . es «cancelar». `aria-keyshortcuts` en cada botón.
- **El ajuste se llama por lo que hace** (`interruptBySpeaking`), no `headphones`: con altavoces se puede probar, y la ayuda dice el riesgo.
- **`isEcho()`** compara con las dos últimas frases, no con toda la respuesta: las palabras con que el alumno corta suelen estar en ella y no podría interrumpir.
- **Marcas de la medición:** una por turno; la última palabra con su hora (`performance.mark(…, { startTime })`), no una por palabra. Solo se miden las respuestas a lo que pregunta la propia llamada. `SpeakOptions.started` marca el primer sonido con el evento `start` de la locución.
- **`MAX_QUESTION_LENGTH`** pasa a su propio fichero (`tutor/question-limit.ts`) para que `VoiceCall` y `TutorComposer` no se importen entre sí.
- **Un botón deshabilitado y enfocable recibe el clic** (`disabledInteractive` no lo detiene ante el manejador de la plantilla): «Dictar» y «Llamar al tutor» comprueban la llamada ellos mismos.

**Alternativas:**

- **La barra del plan** (icono, texto y botones): sobria, pero sin la cara del tutor ni el micrófono a la vista.
- **Videollamada completa** (la mascota grande arriba, cronómetro, subtítulos): quitaba unos 150 px al chat, un tercio del tutor flotante. El cronómetro no ayuda a programar y obliga a repintar cada segundo.
- **Esc para interrumpir:** la tecla universal de «parar», pero choca con plegar el tutor flotante, con cerrar menús y con salir del editor (Esc y Tab).
- **Atajo configurable:** no lo pide la accesibilidad y casi nadie lo cambiaría; queda en `PENDIENTES.md` un interruptor para desactivar Control sola si corta sin querer.
- **Un `effect()` en `VoiceCall`,** como en el plan: más directo de leer, pero con la carrera de arriba y transiciones que llegan un ciclo después.

**Consecuencias:**

- El 6.2b conecta el silencio de la proactividad mientras el alumno habla en una llamada (anotado en su plan).
- La medición de los diez turnos la hace el autor y decide el 6.1d (`PENDIENTES.md`); también si Chrome de Android pita al reabrir el micrófono.
- En [E2E-PENDIENTES](E2E-PENDIENTES.md), el e2e de la llamada con un reconocimiento falso y axe en cada estado.

**Aprobación:** el autor aprobó la tarjeta C y las propuestas, por delegación en el agente, preguntó si los `effect()` eran necesarios (de ahí la llamada sin `effect()`) y si los temporizadores eran la mejor solución (se quedan los tres de tiempo sin voz; el sondeo de la pregunta que espera pasó a un aviso). Pidió una sola tecla para interrumpir; se habló de Esc y de Control sola, y Claude eligió Control sola con Ctrl + . para pausar, por delegación del autor. Lo probó en su navegador, lo dio por bueno y pidió cerrarlo.

## D-088 · El tutor proactivo en el navegador: una función sin imports, los eventos de la visita y una intervención que no se ve hasta que habla (22/11/2026, propuesta)

**Contexto:** el 6.2b pone en marcha la lógica del tutor proactivo con datos simulados (2.7, D-064 y D-065). El plan de implementación lo dejaba casi todo decidido; al leer el código salieron cuatro huecos: los eventos podían contarse dos veces, el tutor podía cortarse a sí mismo mientras leía en voz alta, preguntar al tutor no contaba como actividad y dos funciones con nombres casi iguales hacían cosas distintas.

**Decisión (cómo se usa):**

- **Cuándo se acerca:** justo después de cada ejecución y cada 15 segundos. Tras tres ejecuciones seguidas con la misma prueba fallando (el umbral del ejercicio), el turno entra en la conversación con «El tutor se acerca» y una frase sobre esa prueba; no vuelve hasta otros tres fallos seguidos (a los 6, a los 9…) ni antes de 3 minutos desde el último turno con el tutor. Tras cuatro minutos parado, pregunta si sigue ahí y qué le frena, una vez por parón. Cuando el alumno supera una prueba que se le resistía, lo celebra al momento, sin esperar al cooldown y también con el intento ya superado; si en ese instante no puede (el tutor responde, por ejemplo), el logro se pierde, porque una felicitación tardía no se entiende.
- **Cuándo calla sin preguntar al servidor:** con la proactividad desactivada (con efecto al momento), fuera de la pestaña, sin conexión, mientras el tutor responde o **habla en voz alta**, mientras el alumno **habla en una llamada**, durante una ejecución o una entrega, con una pregunta a medio escribir o dictada en el campo (cuenta el texto, no el foco), en un intento que no se puede editar y en la vista previa del docente. Lo que espera se vuelve a mirar en la siguiente comprobación.
- **Preguntar al tutor cuenta como actividad** para el parón, como en el panel en vivo (D-068): quien acaba de preguntar no recibe «¿Sigues ahí?» al acabar el cooldown. **Abrir el ejercicio y teclear código** (aunque aún no se haya guardado) también cuentan (iteración 2): sin eso, al abrir un intento de otro día saltaba «¿Sigues ahí?» a los 15 s.
- **Nunca mientras escribe código** (iteración 2, a pregunta del autor): la comprobación de cada 15 s espera a que el código lleve 15 s sin cambios; tras una ejecución, no se acerca si el alumno cambió el código mientras corría. Antes solo miraba el campo de la pregunta, y una ayuda que esperaba podía salir con el alumno tecleando.
- **Solo cuentan las ausencias de esta visita** (iteración 2): cerrar la pestaña deja un `focus_lost` sin vuelta, y en la visita siguiente el tutor creía al alumno fuera y no se acercaba nunca. Quien abre la pantalla está delante.
- **Los fallos de otra visita no se sacan en la comprobación de cada 15 s** (iteración 2): al abrir el ejercicio al día siguiente no tiene sentido «Llevas un rato con la misma prueba». Tras una ejecución nueva, sí.
- **Una intervención no se ve hasta sus primeras palabras:** ni turno, ni «respondiendo», ni mascota pensativa mientras viaja, así que el alumno puede seguir preguntando. Si el tutor calla, la petición falla (también con 429) o el alumno preguntó mientras tanto y aún le están respondiendo, no queda nada: ni turno, ni aviso de error, ni reacción. Si el alumno cambió de ejercicio, tampoco. Al llegar las primeras palabras se vuelven a mirar los silencios (iteración 2): si mientras viajaba apagó la proactividad, empezó una pregunta, editó el código, se fue de la pestaña o el tutor se puso a hablar, se descarta.
- **La pregunta a medio escribir se guarda** (iteración 2): plegar el tutor, cambiarlo de sitio o cambiar de pestaña en el móvil destruía el campo y se perdía lo escrito. Ahora vive en `TutorStore` (`draft`) y el campo la recupera; `drafting` se deriva de ella.
- **El tutor simulado** responde según el motivo: ayuda con los fallos (mirando o comprendiendo, por turnos, como antes), pregunta con sueño ante el parón y celebra el logro siempre, con fiesta. Calla la ayuda si la intervención anterior fue por el mismo motivo, como se le pedirá al modelo (iteración 2: antes callaba tras cualquier intervención, y tras los fallos nunca se veía el parón ni el rearme).

**Decisión (técnica):**

- **`shared/proactive-reason.ts` sin imports:** la Edge Function `tutor` lo importará tal cual en el 6.2c (D-042), así que las lecturas de los eventos de ejecución se mudan a él con tipos estructurales (`ProcessEvent` encaja en `AttemptEvent` sin importarlo): `failingStreaks()`, `failureStreak()`, `currentFailure()`, `failedTestsByRun()`, `lastActivityAt()` y `lastBreakthrough()`, que gana el `testId`. `is-stuck.ts` se queda con `isStuck()`, `stuckReason()` y `longestFailureStreak()` (la historia del 4.4), y `last-breakthrough.ts` desaparece.
- **`currentFailure()`** en lugar del `longestFailure()` del plan: ya existía `longestFailureStreak()`, que mira toda la historia, y con nombres casi iguales se confundían. Esta es la prueba que falla ahora en más ejecuciones seguidas, con su `testId`, para que el 6.2c diga en el prompt qué prueba es.
- **`proactiveReasons()` devuelve todos los motivos que se cumplen,** en orden `achievement`, `failures`, `idle`. El monitor toma el primero tras una ejecución y, en el temporizador, el primero que no es un logro. El servidor (6.2c) comprobará que el recibido está en la lista, con su holgura (`ProactiveLimits`: cooldown e inactividad son parámetros).
- **`lastTurnAt` es el último turno que pidió el alumno** (pregunta o pista): vale para el cooldown y como actividad. Las intervenciones, también las calladas, salen de los eventos.
- **Los eventos de la visita** (las ejecuciones, leídas de `AttemptStore.lastRun()`, y las peticiones propias) se vacían cada vez que `TutorStore` carga la conversación, que ya los trae: así una recarga tras un error no cuenta dos veces la misma ejecución, y otro intento empieza limpio (`linkedSignal` sobre `loadedEvents`). Una petición que acaba con otro ejercicio abierto no deja su evento en él. Las ausencias y los pegados los guarda `BrowserSignals` (`events()`).
- **Toda petición deja un evento local,** también si el tutor calla o falla: el cooldown y el episodio valen en la visita y no se pregunta cada 15 segundos.
- **`AttemptStore.openedAt` y `lastEditAt`** (iteración 2): cuándo se abrió el intento en esta visita y cuándo cambió el código por última vez (0 si no hay dato, para no tener ramas que nunca se ejecutan). El monitor pasa a `proactiveReasons()` como `updatedAt` el más reciente de los tres; la función compartida con el servidor no cambia.
- **`intervene(reason, stillWanted)`** (iteración 2): el monitor le da una función que vuelve a mirar sus silencios al llegar las primeras palabras; el store no conoce la voz ni los ajustes.
- **«Tutor proactivo rápido»** (iteración 3, a petición del autor, que no podía probarlo esperando 4 y 3 minutos): un interruptor en la barra de desarrollo (solo con `npm start`) que deja el parón en 30 s, el cooldown en 20 s, la comprobación cada 5 s y la pausa al escribir en 5 s; los fallos siguen en el umbral del ejercicio. Los tiempos son un token de `core/` (`PROACTIVE_TIMING`) con los valores del 2.7, y solo `provideDevToolbar()` lo cambia por los de `DevProactivity`: el código de producción no conoce la barra. El monitor encadena un `setTimeout` por comprobación, así que el cambio vale desde la siguiente, sin otro `effect()`. Se apaga al recargar la página.
- **Un `effect()`** sobre `lastRun()`, frontera con el temporizador y la petición (4.8), que solo sigue la ejecución: el resto se lee con `untracked()`. El temporizador es un `setInterval` que se para con `DestroyRef`.
- **El tutor simulado rechaza** una intervención sin motivo, un motivo sin intervención y cualquier intervención en la vista previa (D-061), como hará el servidor.

**Alternativas:**

- **Filtrar los eventos locales por intento** en lugar de vaciarlos con cada carga: no evitaba la doble cuenta tras una recarga.
- **Derivar «a medio escribir» del modelo del campo con un `effect()`:** el compositor ya sabe cuándo cambia el texto (teclado, dictado, «Corregir» y envío), así que llama a `setDrafting()` en esos puntos.
- **Dejar que un logro corte la lectura en voz alta:** el alumno perdería la respuesta que estaba escuchando.

**Consecuencias:**

- El 6.2c calcula `lastTurnAt` con las interacciones que no son proactivas, como el cliente, y usa `currentFailure()` para el prompt.
- `SupabaseTutorService` ya envía `reason`; el servidor lo ignora hasta el 6.2c.
- Una intervención que el cliente descarta ya está guardada en el servidor (y en el simulado): al recargar aparece en la conversación. Lo decide el 6.2c (`PENDIENTES.md`).

**Aprobación:** el autor aprobó el plan con las cuatro mejoras propuestas. En la iteración 2 pidió revisar el plan inicial, preguntó por qué el tutor no miraba el editor y pidió arreglar todo lo que Claude viera; de esa revisión salieron los arreglos marcados como iteración 2.

## D-089 · Los atajos en el Mac: por la tecla física y con los símbolos de sus teclas (22/11/2026, propuesta)

**Contexto:** el autor vio en su Mac que Mayús + Opción + F escribía «ﬁ» en lugar de formatear el código (2.5d), y preguntó si había más atajos que corregir en el Mac. La fila del 1.6 de `PENDIENTES.md` ya decía que la ayuda nombraba «Ctrl + Intro» donde en el Mac lo natural es ⌘.

**Decisión (cómo se usa):**

- **Formatear con Mayús + ⌥ + F funciona en el Mac,** como en VS Code, y ya no escribe nada en el código.
- **En un Mac, la ayuda del editor y los tooltips nombran las teclas con los símbolos impresos en ellas:** «Mayús + ⌥ + F formatea el código; ⌘ + Intro ejecuta las pruebas» y «Formatear el código (Mayús + ⌥ + F)», «También con ⌘ + Intro desde el editor». En el resto, como siempre. Ctrl + Intro sigue funcionando también en el Mac. En inglés y catalán, igual («Shift + ⌥ + F», «⌘ + Enter»; «Maj + ⌥ + F», «⌘ + Retorn»).
- **Los atajos de la llamada no cambian:** «Ctrl» y «Ctrl + .» son la tecla control también en el Mac, a propósito (D-087).
- Revisados todos los atajos de la app: no falla ningún otro en el Mac.

**Decisión (técnica):**

- **Por la tecla física:** CodeMirror (6.43) deja a propósito las combinaciones con Opción en macOS para escribir caracteres y no las compara con los atajos. `isFormatKey()` (`shared/code-editor/format-key.ts`) mira `event.code === 'KeyF'` con Mayús y Alt, sin Ctrl ni ⌘, en un manejador de `keydown` de máxima prioridad que cancela el carácter, como hace VS Code.
- **`IS_MAC`** (`core/is-mac.ts`): `navigator.userAgentData.platform` donde existe y, si no, `navigator.platform`; cuenta también el iPad y el iPhone con teclado. Un token, para cambiarlo en los tests.
- **`editorKeys(mac)`** (`shared/code-editor/editor-keys.ts`) da los nombres de las teclas, traducidos, y las tres frases los llevan como marcador: un solo sitio para los nombres, y las frases no se duplican por plataforma.
- **Símbolos y no nombres:** la tecla Opción se llama «option» o «alt» según el teclado del Mac, y ⌥ y ⌘ están en todos; los lectores de pantalla del Mac los leen por su nombre.

**Alternativas:**

- **Otro atajo para el Mac** (⌘ + Mayús + F): obligaría a dos atajos distintos y no es el de VS Code.
- **Frases enteras por plataforma:** seis textos más por idioma en lugar de cuatro nombres de teclas.

**Aprobación:** el autor pidió arreglar el atajo y hacer aquí la tarea de los nombres, por delegación en lo demás.

## D-090 · El servidor comprueba el motivo del tutor proactivo: lecturas que no se pueden tapar y la hora de la petición (23/11/2026, propuesta)

**Contexto:** el 6.2c pone en marcha D-065: la función `tutor` vuelve a calcular el motivo que envía el navegador (2.7) y se lo explica al modelo (prompt v7). El plan de implementación del 17/11 lo dejaba casi todo decidido; al leer el código salieron cinco huecos: el nombre de la migración no se habría podido publicar, la hora de los eventos descuadraba el episodio de fallos, una avalancha de eventos del navegador tapaba las intervenciones, quedaba por decidir qué hacer con una intervención descartada y la prueba se nombraba en el prompt con comillas invertidas.

**Decisión (cómo se usa):**

- **Con el servidor real, el tutor se acerca como con datos simulados** (D-088). Además, el servidor vuelve a comprobar el motivo con sus datos y algo de holgura (2 minutos de cooldown en lugar de 3, y el parón 30 segundos antes). Si no cuadra, el tutor calla sin llamar al modelo; el turno sí cuenta (D-063).
- **Lo que dice el tutor depende del motivo:** ante fallos repetidos, una o dos frases sobre la prueba que se resiste, en el nivel alcanzado, ofreciendo seguir; ante un parón, pregunta qué le frena o le ofrece por dónde seguir; ante un logro, una sola frase que lo celebra, sin pistas. Si su última respuesta trataba de lo mismo o no tiene nada nuevo, calla. Una intervención nunca sube el nivel de pista.
- **Una intervención por fallos puede traer «Aplicar»** si el código no se ejecuta por un despiste de escritura (2.5f, D-052). Ninguna otra intervención trae botones, esqueleto ni ejemplos de sintaxis: nadie ha pedido nada.
- **La vista previa del docente no admite intervenciones** (D-061): no tiene proceso del que leer un motivo.
- **Una intervención que el navegador descartó se queda guardada** (la pisó una pregunta, el alumno empezó a escribir o cambió de ejercicio mientras viajaba) y aparece al recargar, en su sitio: es lo que el tutor dijo, el docente lo ve, y evitarlo costaría otra petición por cada descarte.
- **Una diferencia aceptada:** abrir el ejercicio cuenta como actividad en el navegador (D-088), pero el servidor no se entera. Tras un «¿Sigues ahí?» sin respuesta, quien vuelve otro día y pasa 4 minutos sin tocar nada no recibe otro: el servidor calla y se gasta un turno. Para que el servidor lo supiera haría falta un tipo de evento nuevo (migración, límites de los eventos del navegador, línea temporal, panel en vivo, seed y fixtures), y no compensa para un caso que cuesta un turno.

**Decisión (técnica):**

- **`checkReason()`** (`supabase/functions/tutor/proactive.ts`) llama tal cual a `proactiveReasons()` de `shared/proactive-reason.ts` con `SERVER_PROACTIVE_LIMITS` y devuelve los hechos del motivo: la prueba y sus ejecuciones fallando (`currentFailure()`), los minutos del parón (redondeados, como mínimo 1) o la prueba superada y sus fallos (`lastBreakthrough()`). `lastTurnAt` es la última interacción que no es proactiva, como en el navegador.
- **Lecturas que no se pueden tapar:** `findActivity()` lee, solo para una intervención, los eventos que escribe el servidor (ejecuciones, intervenciones, pistas y entrega, hasta 1000) y, aparte, solo el último evento de actividad del navegador (pegar o volver a la pestaña). El plan leía los últimos 1000 de todos, pero un navegador puede escribir hasta 3000 por intento (D-063) y habría dejado fuera las intervenciones anteriores, y con ellas el tope de 5 y el cooldown. De los del navegador solo cuenta la hora más reciente, que además solo puede hacer parecer más activo al alumno (se acota entre la apertura del intento y su llegada).
- **La hora de la petición:** `record_tutor_interaction` gana `answer_reason` (obligatorio en una intervención y prohibido en lo demás, `22023`) y `asked_at`. Los eventos `hint_requested` y `proactive_intervention` toman la hora en que llegó la petición, nunca posterior a `now()`, y no la de la respuesta del modelo, que puede llegar hasta 30 segundos después. Así, una ejecución hecha mientras viaja la intervención cuenta para el siguiente episodio en los dos lados. Antes, a los 6 fallos el servidor callaba y la ayuda llegaba a los 9.
- **La migración se llama `20261122100000_proactive_reason.sql`,** no `20261117…` como decía el plan: `db push` no publica en la nube una migración más antigua que la última aplicada.
- **Orden en `tutor`:** intento y permisos, respuesta ya guardada, turno contado y, en una intervención, el motivo. Si no cuadra, 200 con solo `done` callado: sin modelo, sin evento y sin interacción. En una intervención, el servidor descarta toda acción del modelo salvo `proposeFix` en `failures` y no le da el esqueleto (sin él, el validador no deja pasar ni la función vacía).
- **La prueba se nombra en el prompt sin comillas invertidas** («el ejemplo sum([1,2,3])», como el resto de la petición), para que el modelo no las copie y el validador no lo tome por código. Una prueba oculta es «una comprobación oculta», sin sus valores.
- **La v6 del prompt,** que subió la auditoría (D-063) sin anotarla, queda en `docs/prompt-history.md` junto a la v7.

**Alternativas:**

- **Los últimos 1000 eventos de todos los tipos** (el plan): una consulta menos, pero un navegador podía saltarse el tope.
- **Marcar en el servidor las intervenciones descartadas:** una petición más por descarte, para esconder algo que el tutor sí dijo.
- **Registrar la apertura del ejercicio en el servidor:** ver arriba.
- **Guardar el evento con la hora de la respuesta** y cambiar la del navegador para que coincida: la hora en que el tutor decidió acercarse es la de la petición.

**Consecuencias:**

- D-065 queda implementada.
- La batería de elusión tendrá que preparar los eventos del intento para que el servidor acepte cada motivo (`PENDIENTES.md`).

**Aprobación:** el autor aprobó el plan con los cinco cambios y pidió aplicarlos todos. Preguntó por qué no compensaba registrar la apertura del ejercicio y aceptó dejarlo si complica más de lo que aporta.

## D-091 · Los unitarios con el equipo cargado: consultas dentro de su zona, Material sin animaciones y la mitad de los núcleos (23/11/2026, propuesta)

**Contexto:** desde el 6.2b, `npm run check` fallaba con el equipo cargado, siempre en tests distintos de las pantallas grandes del docente. En la línea base de esta sesión fallaron 22 tests de 5 ficheros, casi todos por los 15 s; solos, pasaban. Medido con perfiles de CPU y contando las llamadas a `getComputedStyle()`, salieron tres causas que se suman:

- **Las consultas a toda la página.** `getByRole(…, { name })` calcula el nombre accesible de cada elemento con ese rol y, para saber qué está oculto, el estilo de cada elemento de dentro. jsdom 30 calcula para cada uno la cascada entera, en torno a 1 ms, y la olvida con cualquier cambio del DOM. En la página de bloques de 1.º DAW A, con 1300 elementos y 127 botones, una consulta de botón por nombre sobre `screen` calculaba unos 630 estilos: medio segundo. Las consultas eran la mitad del tiempo de `blocks-page.spec.ts`.
- **Las animaciones de Material.** jsdom no las reproduce, y Material esperaba cada una con un temporizador: un diálogo no tomaba el foco ni avisaba de que se había cerrado hasta que vencía, y un menú tampoco se daba por cerrado. En Grupos, «Añadir asignaturas a…» se abre después de guardar la clase y de cerrar el primer diálogo, y con carga no llegaba en el segundo que espera `findByRole`.
- **Demasiados workers.** Vitest lanza tantos como núcleos menos uno: 7 en el M3 del autor, que tiene 4 núcleos de rendimiento y 4 de eficiencia, mientras Docker (Supabase) y otra aplicación ocupaban la CPU. Vitest empieza por los ficheros más lentos, así que las pantallas grandes corrían a la vez en los núcleos lentos. En la suite entera, un test tardaba entre 20 y 60 veces lo que tarda solo, sobre todo al principio de cada fichero. La memoria no era el problema: los workers sumaban unos 2,2 GB y el swap no creció.

Además, un test que se pasa del tiempo no se detiene: en la línea base, el de crear un ejercicio siguió tecleando `[2, 3]` dentro del siguiente, que falló por eso. Es el fallo «por el orden» que se vio en el 6.2c.

**Decisión:**

- **Los elementos que se repiten se buscan dentro de su zona,** como los busca el docente: los botones de un bloque y de sus ejercicios, dentro del bloque (`blockButton()`, `blockMenu()` y `exerciseMenu()` en `blocks-page.spec.ts`), y los de la barra para borrar varios bloques, dentro de la barra. `class-students.spec.ts` ya lo hacía con las casillas de la tabla (`box()`). Los botones de la página sin zona propia («Nuevo bloque», «Seleccionar», «Copiar de otro grupo») siguen buscándose en `screen`: son uno o dos por test.
- **Material sin animaciones en todos los unitarios:** `src/providers-testing.ts`, el `providersFile` del builder de Angular. Un test puede volver a activarlas. Tres specs lo hacían por su cuenta (`staff-layout`, `dev-toolbar` y `showcase-page`) y dejan de repetirlo.
- **`maxWorkers: '50%'`** en `vitest-base.config.mts`, salvo en el CI: en el M3, sus 4 núcleos de rendimiento. El CI es una máquina limpia, donde estos tests no fallaban, y sigue con lo que Vitest pone por defecto (3 workers con sus 4 vCPU), para no alargar el job `check` sin ganar nada (iteración 2).
- **Los tiempos máximos no cambian:** 15 s por test y la espera de Testing Library para los diálogos. No hizo falta alargarlos.

**Resultados,** en el mismo equipo y con la misma carga de fondo (suite entera de unitarios, 3256 tests):

| Pasada                               | Fallos | Duración | Suma de los tests | Test más lento |
| ------------------------------------ | ------ | -------- | ----------------- | -------------- |
| Línea base (7 workers)               | 22     | 430 s    | 2446 s            | 20,2 s         |
| Consultas acotadas y sin animaciones | 5      | 389 s    | 1915 s            | 16,2 s         |
| Lo anterior y 4 workers              | 0      | 303 s    | 914 s             | 9,4 s          |

En `blocks-page.spec.ts`, los estilos calculados bajan de 49 600 a 25 200. Después, `npm run check` pasó entero tres veces seguidas, con una carga de 3,2 a 6,1 al empezar y el test más lento por debajo de 10 s.

**Alternativas:**

- **Subir el tiempo máximo:** esconde la causa, y un test que se pasa sigue corriendo y estropea el siguiente.
- **`configure({ defaultHidden: true })` de Testing Library:** se salta la comprobación de lo oculto en todas las consultas, lo que cambia lo que prueban, y apenas ahorra: el coste está en el nombre accesible.
- **Buscar los botones por su `aria-label` (`getByLabelText`):** más barato, pero deja de comprobar el rol.
- **jsdom 31 o happy-dom:** una versión mayor recién salida, u otro entorno para 272 ficheros, sin saber si calculan los estilos más deprisa.
- **Una caché propia de `getComputedStyle()`:** jsdom ya tiene una; lo que cuesta es llenarla después de cada cambio del DOM.

**Consecuencias:**

- Un spec nuevo de una pantalla grande busca dentro de su zona (bloque, fila, barra o diálogo) los elementos que se repiten.

- La fila del 1.10 de `PENDIENTES.md` (un test de `app.routes.spec.ts` que falló una vez con la suite entera) se cierra con esta decisión: tiene el mismo patrón y no falló en ninguna de las seis pasadas completas de este trabajo. Si vuelve a fallar, se reabre.

**Aprobación:** propuesta. El autor pidió diagnosticar primero por qué eran lentos, arreglar la causa y subir el límite solo donde la espera fuera legítima. En la iteración 2 preguntó qué ganaba el CI con 2 workers en lugar de 3: nada, y vuelve a los de Vitest; aceptó también cerrar la fila del 1.10.

---

## D-092 · El bocadillo y el atajo «Pregúntale al tutor»: junto a la llamada, lo visto por respuesta y el foco en la pestaña del móvil (23/11/2026, propuesta)

**Contexto:** el 6.2d pone en pantalla lo que D-064 decidió para el tutor plegado: el bocadillo de dos estados y el atajo junto a los ejemplos que fallan. El plan de implementación del 17/11 lo dejaba casi todo atado; al leer el código y probarlo en el navegador salieron cinco cosas: el atajo al final de la fila quedaba bajo la mascota flotante, el foco no podía quedarse en el botón en el móvil, lo visto se contaba por número y fallaba al cambiar de ejercicio, la pregunta llevaba código que la burbuja del alumno enseñaba con sus comillas invertidas, y el bocadillo enseñaba la respuesta en bruto, bloques de código incluidos.

**Decisión (cómo se usa):**

- **El atajo va junto a la llamada** de cada ejemplo visible que falla (valor erróneo, error o tiempo agotado), no al final de la fila: ahí quedaba en la esquina de la mascota flotante y el bocadillo lo tapaba justo cuando el alumno querría preguntar por el ejemplo siguiente.
- **La pregunta lleva la llamada y los valores como código:** «¿Por qué falla `sum([])`? Devuelve `NaN` y se espera `0`.». Si no cabe en una pregunta (500 caracteres), «¿Por qué falla el ejemplo N?»: el tutor ya tiene el código y la última ejecución.
- **Las burbujas del alumno enseñan su código en monoespaciada,** como las respuestas, también en lo que escribe a mano.
- **En el móvil, el foco pasa a la pestaña «Tutor»,** la que el alumno habría pulsado: Material deja inerte la pestaña del código, y un foco en un elemento inerte se pierde. En el escritorio se queda en el botón.
- **El bocadillo enseña el texto de la respuesta sin sus bloques de código,** que no caben en dos líneas, y el error, en rojo y con su icono.
- **«El tutor te escribe»** sustituye a «El tutor se acerca» en la etiqueta de las intervenciones (en inglés, «The tutor reaches out»; en catalán, «El tutor t'escriu»): se entiende leída en un chat y va en la línea del ajuste «El tutor puede escribirme por iniciativa propia».

**Decisión (técnica):**

- **`TutorBubble`** (`student/workspace/tutor/`) dibuja los tres estados y no anuncia nada: la región `aria-live` de `WorkspaceLayout` dice cada estado una vez. Su botón lleva el nombre explícito («Abrir el tutor: » y todo lo que dice), porque armado desde las piezas en línea del texto y del código perdía los espacios entre ellas en algunas herramientas de accesibilidad.
- **Lo visto y lo cerrado, por el id de la respuesta** (`TutorStore.latestAnswerId`), no por cuántas han llegado: la pantalla se reutiliza al pasar de un ejercicio a otro, y con el número el punto y el bocadillo no salían en el siguiente hasta superar las respuestas vistas en el anterior. Era un fallo anterior al paso; un test lo confirmó con el código de antes.
- **La pregunta del atajo deja su propio estado** (`foldedAsk`), que se olvida al cambiar de ejercicio y al ver el tutor; solo la respuesta de esa pregunta puede cambiarlo.
- **`ask()` y `requestHint()` devuelven si la respuesta llegó entera** a la conversación (`false` si no se envió, falló, el tutor calló o se abrió otro ejercicio).
- **`Reaction.reduced`:** `TutorStore` lo pone en la reacción de una intervención que no es un logro, y `ReactionOverlay` la dibuja reducida si el ajuste es «completas»; desactivadas, nada.
- **`failureQuestion()`** (`code-zone/failure-question.ts`), una función pura con sus textos en los tres idiomas, que podrá reutilizar el atajo de la línea del error (fase 7).

**Alternativas:**

- **El atajo al final de la fila** (el plan): todos alineados, pero bajo la mascota flotante.
- **Un botón con texto en cada fila:** más visible, pero con varios ejemplos fallando llena los resultados de botones iguales.
- **Dejar el foco donde estaba en el móvil:** se perdía en un elemento inerte.
- **Seguir contando las respuestas vistas** y reiniciar el número al cambiar de ejercicio: un estado más que sincronizar a mano, cuando el id ya distingue cada respuesta.

**Consecuencias:**

- D-064 queda implementada.
- Ficha 04 (bocadillo, atajo, etiqueta y accesibilidad) y ficha 05 (el interruptor ya no dice «desde el paso 6.2»).
- El atajo de la línea del error (fase 7) y las capturas del bocadillo (fila del 6.1a) siguen en `PENDIENTES.md`; el e2e, en `E2E-PENDIENTES.md`.

**Aprobación:** el autor aprobó el plan con las cinco mejoras propuestas y, tras verlo en el navegador con el atajo ya junto a la llamada y los valores como código, dio el visto bueno. Lo técnico, por delegación del autor.

## D-093 · La ayuda guiada del personal: el perfil por el rol, los primeros pasos en el perfil y «hecha» solo con lo suyo (24/11/2026, propuesta)

**Contexto:** el 7.0b lleva al personal la ayuda que el 7.0a construyó para el alumno (D-080). Al revisarlo salieron cuatro cosas: el docente y la administración tienen cada uno su `StaffLayout` (`teacher.routes.ts`, `admin.routes.ts`), así que el layout se recrea al cruzar de área; «Crear una clase y matricular» y «Seguir la clase en vivo» son primeros pasos de los dos perfiles, en otro orden, y la marca `firstStep` era de la tarea; con la semilla, la cuenta de demostración del docente y la de la administración ya tienen clases, bloques y ejercicios, así que sus primeros pasos saldrían hechos y el tribunal no los vería; y el paso no cabía en ≈ 4 h.

**Decisión (cómo se usa):**

- **El paso se parte:** 7.0b1 (la base del personal, el menú lateral y el docente) y 7.0b2 (la administración y el resto de «¿Cómo se hace…?»). Si falta tiempo, el 7.0b2 es lo primero que se recorta (§1).
- **Del docente, «hecha» solo cuenta lo suyo:** sus clases (`ManagedGroup.mine`), los bloques y asignaciones de sus grupos y sus ejercicios (`createdBy`), no los de sus compañeros.
- **Los primeros pasos de la administración, solo al terminar su recorrido** (sin condición de datos): la cuenta del tribunal los enseña aunque la semilla ya tenga de todo.
- **Las palabras de las tareas, las de la interfaz:** clase, asignatura y matricular en la clase, no «grupo» (§2.12 y ficha 13).
- **Las pantallas vacías llevan a la tarea:** Bloques, En vivo e Histórico sin clases dicen que el docente puede crear la suya (Bloques decía que la crea la administración) y llevan «Crear tu clase», que empieza su tarea guiada.

**Decisión (técnica):**

- **`GuideProfile.id` y `GuideProfile.firstSteps`:** el perfil dice sus primeros pasos en orden, por id, y desaparece `GuideTask.firstStep`. Una tarea con el mismo id en dos perfiles se hace una sola vez (lo hecho se guarda por id).
- **El perfil del personal, por el rol:** `StaffLayout` da el del docente (y en el 7.0b2, el de la administración, que incluye las tareas del docente), y `GuideStore.use()` con un perfil del mismo id lo cambia, para que llegue el menú lateral del layout nuevo, pero no vuelve a leer sus hechos: solo los lee con otro perfil o con otro usuario. Al cruzar de área no se repiten las consultas ni se corta la tarea en marcha.
- **Los hechos del docente sin consultas nuevas:** de `GroupService.listClasses()`, `ExerciseService.listBank()` y `BlockService.listBlocks()` de cada grupo suyo, en paralelo. Son pocas llamadas, pero se repiten al abrir el panel y tras cada tarea; si crecen, una consulta propia.
- **Los textos, repartidos** en `teacher/teacher-guide/` (hechos, balizas, tareas, bienvenida y el perfil), en lugar de un fichero de 1300 líneas como `student/student-guide.ts`.
- **«Paso N de M» cuenta solo los pasos que se ven** a ese ancho: los opcionales que no están no suman.
- **Datos simulados:** un docente sin clases y un alumno sin empezar, para probar las pantallas vacías y los primeros pasos desde cero (`SEED_VERSION` sube).

**Alternativas:**

- **Un único `StaffLayout` padre de las dos áreas** en `app.routes.ts`: no hace falta mientras `use()` ignore el mismo perfil; queda si una tarea de la administración se corta al cruzar de área (7.0b2).
- **Mantener `firstStep` en la tarea** y duplicar las compartidas con otro id: se harían dos veces.
- **«Hecha» por cualquier dato del centro:** el docente de la semilla y la administración nunca verían sus primeros pasos pendientes.

**Consecuencias:**

- `guide-progress.ts`, `GuideStore`, la guía del alumno y sus tests cambian a la lista del perfil.
- §2.12, el paso 7.0b del plan (ahora 7.0b1 y 7.0b2) y la ficha 13.

**Aprobación:** el autor aceptó las ocho recomendaciones de la revisión y el plan del 7.0b1, y dio el visto bueno tras verlo en el navegador. Lo técnico, por delegación del autor.

## D-094 · El menú lateral en las tareas guiadas: lo abre `TourRunner` en el móvil y el raíl no se despliega (24/11/2026, propuesta)

**Contexto:** las tareas del personal señalan entradas del menú lateral (Grupos, Bloques…), que en el móvil está cerrado (`mat-sidenav` en modo `over`) y en el escritorio puede estar plegado a sus iconos (raíl). `TourRunner` no sabía abrirlo. Se probó en el navegador antes de construir (ficha 13).

**Decisión (cómo se usa):**

- **En el móvil,** la tarea abre el menú antes de señalar una entrada; si Esc o el fondo lo cierran a mitad, lo vuelve a abrir.
- **En el raíl,** se señala el icono: el globo dice el nombre de la entrada. No se despliega ni se toca la preferencia guardada.

**Decisión (técnica):**

- **`GuideStep.inSideMenu`** y el menú en el perfil (`GuideProfile.sideMenu`), que le da `StaffLayout` al crearlo, con tres funciones. Sin servicio nuevo:
  - `open()` lo abre si está en modo `over` y cerrado, con `MatSidenav.open()`, y resuelve cuando acaba la animación; si está fijo o ya abierto, no hace nada. Se abre a mano y no con la señal de la plantilla: justo después de que Esc lo cierre, la señal volvía a `true` sin que la detección de cambios viera el paso por `false`, y el menú no se abría (visto en el navegador).
  - `close()` lo cierra en modo `over`.
  - `closed()` resuelve la próxima vez que se cierra.
- **`TourRunner`** abre el menú al buscar la pieza de un paso `inSideMenu` y, cuando acaba de abrirse, vuelve a medirla (`refresh()`): medida a mitad de la animación, el recuadro quedaba desplazado. Al resaltarla espera a `closed()` y, si el paso sigue activo, lo abre otra vez: driver.js no nota que la pieza deja de verse si sigue en la página. Lo cierra en el primer paso que no es del menú y al acabar.
- **En el móvil manda el foco de driver.js:** no hace falta `allowPageInteraction`, a diferencia de los diálogos.
- **El perfil llega a `StaffLayout` con un token** (`STAFF_GUIDE`, `core/guide/staff-guide-token.ts`) que dan las rutas del área: `shared/` no importa las áreas. La función elige el perfil por el rol (D-093).

**Alternativas:**

- **Un paso de acción «Abre el menú»** antes de cada entrada: un paso más en cada tarea, y Esc seguía dejando el globo en el aire.
- **Desplegar el raíl mientras dura la tarea:** más código (guardar y devolver el estado) para nada: el icono con su globo se entiende.
- **Un servicio del menú lateral:** solo `StaffLayout` lo abre, y el perfil ya viaja de él a `GuideStore`.

**Consecuencias:** ficha 13 (la prueba del menú y la regla); `TourRunner` y `GuideProfile` crecen una opción cada uno.

**Aprobación:** el autor aceptó todas las recomendaciones de la revisión, con la del menú lateral corregida tras la prueba, y dio el visto bueno tras verlo en el navegador, en el escritorio y en el móvil. Lo técnico, por delegación del autor.

## D-095 · El globo de las tareas, en la capa superior del navegador; sobre un diálogo alto, en la esquina (24/11/2026, propuesta)

**Contexto:** al probar las tareas del docente en el navegador, el globo del diálogo de asignaturas no se veía. Material 22 abre sus diálogos y menús en la capa superior del navegador (el atributo `popover`), que queda por encima de cualquier `z-index`: el globo de driver.js, en la página, quedaba debajo cuando se solapaba con el diálogo. En el 7.0a no pasó porque el diálogo de entregar es pequeño y el globo cabía a su lado. Con el globo ya encima, en un diálogo tan alto como la pantalla driver.js lo coloca sobre el diálogo, en el centro de su borde de abajo, donde están sus botones.

**Decisión:**

- **El globo sube a la capa superior** cada vez que se dibuja (`popover="manual"` y `togglePopover`), después de los diálogos y menús que haya: nunca queda debajo de uno. Donde el navegador no tiene esa capa (los tests), se queda como estaba.
- **En un paso dentro de un diálogo** (`inOverlay`), si no cabe a su lado (driver.js lo pone encima, sin flecha), el globo va a la esquina inferior izquierda de la pantalla: deja libres los botones del diálogo, que van a la derecha. Con una clase propia (`app-guide-in-overlay`) y CSS en `guide.css`: los globos centrados, sin pieza, no se mueven.

**Alternativas:**

- **Subir el `z-index` del globo:** no sirve contra la capa superior.
- **Resaltar solo los botones del diálogo** en lugar del diálogo entero: contradice la regla del 7.0a (menús y diálogos resaltados enteros) y el globo seguiría tapando su contenido.
- **Dejar que driver.js lo ponga sobre los botones:** se podía pulsar la parte que quedaba a la vista, pero no siempre.

**Consecuencias:** ficha 13 (globo y prueba en el navegador); en el móvil, donde el diálogo ocupa la pantalla, el globo aún puede tapar una parte (`PENDIENTES.md`).

**Aprobación:** el autor dio el visto bueno tras verlo en el navegador. Lo técnico, por delegación del autor.

## D-096 · La ayuda guiada de la administración: un perfil en las dos áreas, posible con lo que exista y hecha solo al terminar (25/11/2026, propuesta)

**Contexto:** el 7.0b2 lleva la ayuda guiada a la administración, que es la cuenta del tribunal. Trabaja en sus dos pantallas (Usuarios y Sistema) y en todas las del docente, con todos los grupos del centro. Al construirla salieron tres preguntas: qué perfil tiene cuando entra en las pantallas del docente, cuándo puede hacer una tarea y cuándo la ha hecho, y qué pasa con una tarea en marcha al cruzar de un área a otra, porque cada área tiene su propio `StaffLayout`.

**Decisión:**

- **Un solo perfil, el de la administración, en todas las pantallas del personal.** Lo elige el rol (`staffGuide`, en `admin/admin-guide/`), y las rutas de las dos áreas lo dan a `StaffLayout`. Tiene sus primeros pasos (los de la cuenta del tribunal), sus tareas, sus recorridos y sus balizas, y además todas las del docente. «Crear una clase y matricular» es la tarea del docente con el mismo id, así que se hace una vez, pero con sus palabras: la administración elige el docente de cada asignatura y da de alta a quien falte.
- **Posible en cuanto algo existe, sea de quien sea:** sus hechos (`adminFacts`) cuentan las clases abiertas con asignaturas, el alumnado, los bloques y las asignaciones de todo el centro, no solo lo suyo, como hace el docente (D-093).
- **Hecha solo al terminarla,** también las del docente: el perfil les quita su condición de hecha (`doneBy`). Los datos del centro no dicen qué hizo la administración, y con ellos el tribunal vería sus primeros pasos ya hechos sin haberlos visto.
- **La tarea sigue al cruzar de área:** `GuideStore` da al recorrido un menú lateral que delega en el del perfil en uso en cada momento, no en el del layout donde empezó. Así no hace falta un único `StaffLayout` padre de las dos áreas, que D-093 dejaba como plan B. Por el mismo camino le da el inyector del área a la mascota de los globos, que con el del alumno lleva sus accesorios.

**Alternativas:**

- **El perfil del área en lugar del rol:** al pasar de Usuarios a Grupos cambiarían la lista de tareas, los primeros pasos y la tarea en marcha.
- **Hechos «suyos» también para la administración:** no da clases (no figura como docente de ningún grupo), así que casi nada sería posible.
- **Un único `StaffLayout` padre de las dos áreas en `app.routes.ts`:** resuelve el cruce, pero mueve las rutas y los proveedores de las dos áreas; el menú que delega basta.

**Consecuencias:** ficha 13 (catálogo de la administración y del docente); la mascota del alumno lleva sus accesorios; las balizas del docente le hablan a la administración de «tu grupo» (`PENDIENTES.md`).

**Aprobación:** el autor dio el visto bueno tras verlo en el navegador. Lo técnico, por delegación del autor.

## D-097 · «¿Cómo se hace…?»: tareas cortas que no crean nada; las balizas resaltan su pieza; los diálogos avanzan al guardar (25/11/2026, propuesta)

**Contexto:** el 7.0b2 completa «¿Cómo se hace…?» del personal (34 tareas) y resuelve lo que el 7.0b1 dejó en `PENDIENTES.md`: el globo de una baliza tapaba su pieza, un diálogo con error dejaba avanzar la tarea, «Siguiente: …» se decidía con los datos del principio y el banco repetía la clase.

**Decisión:**

- **Tareas cortas que no crean nada:** de uno a cinco globos sobre la pantalla real. Las de un menú lo abren y acaban pulsando su opción, que abre su diálogo o pide confirmación; el foco queda dentro del menú o del diálogo para que el usuario siga o cancele. Con el autor: todas las del catálogo, no solo las más usadas.
- **La bienvenida enseña todo el menú lateral,** entrada a entrada y en su orden: la del docente pasa a doce pasos (versión 2, para que la vea quien ya vio la primera), y la de la administración, después de la sección «Docencia», sigue por cada entrada. A petición del autor: antes se saltaban Bloques e Histórico.
- **Las balizas resaltan su pieza** con el oscurecido de driver.js (`overlay`), solo mientras su globo está abierto, y el globo va al lado de la pieza, no del punto. Con el autor, la opción recomendada.
- **Un paso que guarda un diálogo** (`savesDialog`) avanza cuando el diálogo se cierra con resultado, no con el clic: si hay un error y el diálogo sigue abierto, la tarea espera. Cancelar sigue volviendo al paso anterior.
- **«Siguiente: …» se decide en el último globo,** con los hechos leídos de nuevo en ese momento: asignar el primer ejercicio ofrece ya «Seguir la clase en vivo». El botón aparece en cuanto se sabe.
- **El banco nombra la asignatura y, si es de otro curso, el curso:** «1.º DAW A · Programación básica (2025/26)». Lo que se repetía era el mismo grupo en dos cursos.
- **Las piezas, declaradas por área** en `core/guide/anchors/`; la prueba de los scripts comprueba además que no se repite ningún id.

**Alternativas:**

- **Tareas que hacen la acción entera:** crearían datos de verdad en lo que es solo una consulta.
- **Colocar mejor el globo de la baliza, sin oscurecer:** en las piezas grandes no siempre hay sitio.
- **Avanzar con el clic y volver atrás si el diálogo sigue abierto:** el globo saltaría adelante y atrás.

**Consecuencias:** ficha 13; las tareas de un menú con una opción que ese usuario no tiene esperan sin decir por qué (`PENDIENTES.md`).

**Aprobación:** el autor eligió en el paso las opciones recomendadas y pidió la bienvenida completa. Lo técnico, por delegación del autor.

## D-098 · El manual de usuario sale de hacer las tareas guiadas en el navegador (26/11/2026, propuesta)

**Contexto:** D-080 decidió que el manual se genera de las tareas guiadas para que no se desfase de la aplicación. El 7.0c lo construye: hay que decidir de dónde salen las tareas, cómo se hacen sin nadie delante y qué forma tiene el manual.

**Decisión:**

- **Las tareas se leen del panel de «Ayuda»,** no de una lista aparte: el manual recorre lo que ve el usuario, y una tarea nueva entra sola. Las hace un usuario de la semilla con datos para todas: Lucía (que ya ha practicado de nuevo un ejercicio, así que tiene intentos a los que volver), Marta y la administración. Los primeros pasos, en su orden, se leen del panel de quien aún no los ha hecho (Tomás y Nuria; la administración, la propia), porque el de quien ya los hizo solo los celebra. Las dos tareas del detalle de un intento, que solo se pueden hacer con uno abierto, empiezan en el de la semilla.
- **Cada tarea se hace como un usuario,** en una sesión limpia y empezada desde el panel: «Siguiente» en los globos que explican y, en los de acción, la acción sobre su pieza. El globo dice en `data-guide-step` qué pieza explica su paso, porque dentro de un diálogo se resalta el diálogo entero y la pieza no tiene otra forma de encontrarse. Los diálogos que guardan se rellenan antes con datos inventados (una clase «2.º DAW B», un bloque, una cuenta). «Entregar», que solo se activa con todas las pruebas superadas, se prepara escribiendo la solución de ejemplo de la semilla, y la tarea vuelve a empezar. Cuando la aplicación explica en el globo que algo aún no se puede hacer (eliminar una asignatura que ya tiene trabajo), ese globo es el último paso, como lo vería el usuario.
- **El texto de cada paso se lee del globo en la página,** no del código: el manual dice exactamente lo que dice la aplicación, con los mismos datos.
- **Si una tarea no se completa, `npm run manual` falla** y dice cuál y en qué paso, con una captura del error en `tmp/manual`; no escribe un manual a medias. Una tarea que el panel ofrece como no disponible para ese usuario se lista con su motivo.
- **Un manual por perfil** (`docs/manual/alumno.md`, `docente.md` y `administracion.md`): índice, bienvenida, primeros pasos, «¿Cómo se hace…?» y recorridos de pantalla; por tarea, su resumen y sus pasos con el texto del globo, lo que hay que hacer y la captura. El de la administración enlaza al del docente las tareas que comparten, en lugar de repetirlas.
- **Capturas de la pieza y su globo con algo de pantalla alrededor** (al menos 880 × 520 de una ventana de 1280 × 800), en WebP: se leen sin ampliar y pesan poco en el repositorio.
- **También en PDF, que es lo que se entrega** (a petición del autor): `npm run manual` escribe además `alumno.pdf`, `docente.pdf` y `administracion.pdf` desde una página de impresión con el mismo contenido (Playwright `page.pdf()`, sin dependencias nuevas): portada con la mascota y la fecha de la edición, índice con enlaces, marcadores, cada parte en su página, cada paso entero con su captura y número de página. Las capturas del PDF van en JPEG, que Chromium guarda tal cual: unos 13 MB los tres. `--reescribir` vuelve a escribir los manuales con lo recogido, sin repetir las tareas.
- **El manual habla al usuario:** cómo se genera solo lo dice `docs/manual/README.md` y un comentario invisible del Markdown; la portada dice solo la fecha de la edición. El autor lo pidió al ver la primera versión.
- **Solo en español** y con los datos de demostración, como las capturas de la memoria.
- **Con el Chromium completo** (`channel: 'chromium'`), no con el navegador reducido de Playwright, que se cuelga al activar la voz del tutor. En paralelo, por trozos de cada perfil, y cada tarea con una segunda oportunidad si la primera carga tarda.

**Alternativas:**

- **Leer las tareas importando su código:** los textos usan `$localize` y las tareas dependen de Angular; además no comprobaría que se pueden hacer.
- **Un manual escrito a mano o solo con los textos de las tareas:** se desfasa, y no prueba nada.
- **Capturas de la pantalla entera en PNG:** unos 45 MB, y el texto del globo queda pequeño.

**Consecuencias:** `npm run manual` hace también de prueba de toda la ayuda guiada (no entra en `npm run check` porque tarda unos minutos). Se vuelve a generar cuando cambian las tareas o las pantallas. El 7.0d (diario del proyecto) lo enlaza desde su web.

**Aprobación:** el autor aprobó el plan del paso, pidió el PDF y quitar del manual la nota de cómo se genera. Lo técnico, por delegación del autor.
