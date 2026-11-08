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
- **Mensajes de error del acceso** (`signInErrorMessage()`): la contraseña incorrecta, la cuenta desactivada y el correo desconocido dan el mismo mensaje, para no revelar qué cuentas existen. La red caída y el exceso de intentos tienen el suyo.
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

**Aprobación:** el autor, que delegó la decisión en el agente (07/11/2026). La redirección se propuso en el plan del paso y el autor la aprobó («adelante con todo»). Lo de las constantes lo pidió él.

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

**Aprobación:** el autor aprobó el plan del paso («perfecto sigue con todo»). Durante el paso pidió la bienvenida en el acceso, las reacciones al ratón y los ojos que lo siguen, y preguntó por el sitio del CSS. El agente eligió el parcial junto al componente, por la delegación del autor en las decisiones técnicas.

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

**Aprobación:** el autor delegó en el agente la forma de cargar los idiomas y el idioma de origen («la forma que ves mejor», «como veas tú que sería lo mejor o lo más correcto»).

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

**Aprobación:** el autor, que delegó la decisión en el agente («siempre haz la mejor decisión, si ves que en móvil o tablets no va a quedar bien pues usa otra opción tipo pestañas»).

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

**Aprobación:** el autor, que delegó la decisión en el agente («haz todas las mejoras que consideres» y «si puedes evitar en lo posible effects y similares mejor»).

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

**Consecuencias:** cambian §4.2 (`RunResult.loadError`), §4.3 (explorador y runner) y el paso 1.5 del plan. El 2.3 tiene que hacer lo mismo en el servidor: transportar `undefined`, `NaN` e `±Infinity` en el JSON, informar de `loadError`, escribir el resultado de cada prueba en cuanto acaba y comparar con las claves ordenadas (anotado en `PENDIENTES.md`).

**Aprobación:** el autor, que pidió revisar el paso, aplicar las mejoras propuestas («Adelante con tus ideas») y hacer el separador en este paso.
