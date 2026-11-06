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
