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

- **Más sitio para el código, sin ventanas encima** (iteraciones 1 y 2, a propuesta del autor): un botón «Ampliar el código» oculta el enunciado y le da su altura al código (a 1280 × 720, de unas 4 líneas a ocupar casi toda la columna), y los resultados se pliegan a su resumen como un acordeón y se despliegan solos con cada ejecución (`linkedSignal` del resultado, sin `effect()`). El tutor sigue a la vista: ocultarlo solo daba anchura, que al código no le falta, y el alumno dejaría de ver al tutor justo cuando interviene por su cuenta (6.2). La columna del tutor no se estrecha, porque las pistas se leerían peor. No es un modal: un modal obligaría a un segundo CodeMirror sincronizado con el primero (justo lo que evita D-029) y taparía el código mientras se leen los resultados. Ni el estado ampliado ni el plegado se recuerdan. La mascota flotante como forma compacta del tutor y un separador vertical entre código y tutor se valoran en el 1.7, con el chat hecho.

**Consecuencias:** cambian §4.2 (`RunResult.loadError`), §4.3 (explorador y runner) y el paso 1.5 del plan. El 2.3 tiene que hacer lo mismo en el servidor: transportar `undefined`, `NaN` e `±Infinity` en el JSON, informar de `loadError`, escribir el resultado de cada prueba en cuanto acaba y comparar con las claves ordenadas (anotado en `PENDIENTES.md`).

**Aprobación:** el autor, que pidió revisar el paso, aplicar las mejoras propuestas («Adelante con tus ideas») y hacer el separador en este paso.

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

**Aprobación:** el autor, que aprobó el plan corregido del paso («Adelante»).

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

**Aprobación:** el autor, que fijó el objetivo («mi idea es de cara a la pec 3 tener la app acabada»).

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

**Aprobación:** el autor, que aprobó el plan con todas las mejoras propuestas («Sí, todo») y la iteración 1 («Sí, termínalo»).

## D-034 · Catálogo: sesiones con título, «entregado» frente a «superado» y por dónde seguir (09/11/2026)

**Contexto:** el autor veía el catálogo «un poco pobre» y preguntó si «Sesión 1» podía ser cualquier texto, como «Tema 1: Bucles». La sesión era solo un número en `exercise_assignment.session`. Además, el catálogo plegaba al llegar las sesiones superadas enteras, de modo que Lucía, con el último ejercicio superado pero sin entregar, veía «8/8 superados» y cuatro sesiones plegadas: la pantalla invitaba a irse sin entregar (anotado en `PENDIENTES.md` desde el 1.6). Antes de reentregar la PEC2 con el código, el catálogo tenía que lucir.

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

**Aprobación:** el autor, tras ver la demo («Sí, ciérralo todo»).

## D-035 · Reacciones flotantes: al llegar la respuesta, tres niveles, paleta viva y la mascota con ellas (09/11/2026)

**Contexto:** el paso 1.8 añade las reacciones afectivas del tutor (RF-10, capa 4 de la memoria). El plan pedía un overlay que leyera el evento `meta`, una animación de 2 a 3 segundos en una posición variable, poder desactivarlas y respetar `prefers-reduced-motion`. Al contrastarlo con la memoria salieron tres huecos:

- RF-10 y el flujo 4a de CU-03 piden poder **reducirlas o** desactivarlas, no solo desactivarlas;
- el `meta` llega antes del texto, así que reaccionar a él haría reaccionar también a una respuesta que falla a mitad o a una intervención que el tutor decide callar (`silent`, 2.7);
- `SettingsStore`, donde vive ese ajuste, era del paso 1.9.

Al ver la primera versión, con los colores del tema, el autor pidió reacciones «más exageradas y grandes», con colores «mucho más vistosos» y más variedad de iconos.

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

**Aprobación:** el autor aprobó el plan con las tres mejoras («dale pues con lo que consideras»), pidió las reacciones más vistosas, señaló el desplazamiento lateral y el panel «Tutor» del muestrario, y cerró el paso («Sí, ciérralo»).

## D-036 · Reacciones: un catálogo de recetas declarativas, separado de la emoción (09/11/2026)

**Contexto:** tras cerrar el 1.8 (D-035), el autor revisó las reacciones en su navegador y pidió más:

- un efecto raro con una sola reacción y al pedir pistas seguidas: la nueva cortaba la anterior;
- un icono grande que lata en el centro de la pantalla y más cosas alrededor;
- muchas reacciones distintas, que la IA pudiera, por ejemplo, «lanzarte una piedra»;
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

## D-037 · Reacciones: emojis oficiales de Fluent, 3D o planos, y bromas a elección del autor (09/11/2026)

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
- **Bromas, a elección del autor:** al pedir la solución, el tutor bromea por turnos (guiño, monos, «¿en serio?», lanzamiento y enfado). El autor eligió también la caca entre los proyectiles y 😡 y 🤬 entre las caras de enfado. Claude advirtió que pueden leerse como una falta de respeto al alumno y que las verán la tutora y el tribunal, y propuso la tarta como alternativa; el autor las quiso igualmente, siempre como bromas. La receta lo dice y el prompt del tutor real lo dirá: nunca ante un error.
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

**Aprobación:** el autor pidió cada cambio y los revisó en su navegador; dio por bueno el conjunto («Sí, ciérralo»).

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

**Aprobación:** el autor («aplica lo que consideres»).

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

**Aprobación:** propuesta; el autor aprobó el plan del paso («añádelo y ya») y objetó la retirada del consentimiento, que se quitó.

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

**Aprobación:** el autor aprobó el plan con las cinco mejoras («Las cinco») y pidió dejar bien documentado cómo resiste cada modelo, con los ejemplos y las respuestas exactas, para la memoria. El modelo lo elige el agente por delegación del autor, con los datos de la batería.

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

**Aprobación:** el autor aprobó el plan («Sí, adelante»), con dos correcciones durante el planteamiento: el idioma de origen no tiene por qué ser el español, y la batería no se repite ni debe depender del seed.
