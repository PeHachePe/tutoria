# TutorIA · instrucciones para el agente

## Proyecto

TutorIA es una aplicación web (Angular 22 + Supabase) de ejercicios de programación autoevaluables, con un tutor de IA que da pistas graduadas sin entregar nunca la solución y un panel docente con analítica formativa. Es un TFM: lo que se construye se documenta en una memoria académica.

Todo está en `docs/`: `PLAN.md` (plan completo; su especificación, en la sección 2, es la fuente de verdad), `screens/` (fichas de pantalla), `DECISIONES.md`, y `REGISTRO.md`, `bitacora/` y `capturas/` para el registro de cada paso.

## Prioridad

En código, estructura y nombres mandan las buenas prácticas de Angular 22: la sección del final de este fichero (la generó `ng new` y no se modifica), `get_best_practices` y la [guía de estilo](https://angular.dev/style-guide). Este bloque y `docs/PLAN.md` solo las amplían. Si algo choca, sigue a Angular, avisa al humano y anótalo en `docs/DECISIONES.md`.

## Reglas innegociables

- **Commits:** cuando el humano da el paso por bueno, el agente los prepara y el humano los ejecuta (la configuración global de Claude Code prohíbe `git commit` al agente). El agente deja escrito el mensaje de cada uno en inglés con Conventional Commits, con el paso al final del asunto (`feat(auth): role guards (step 0.6)`) y un cuerpo que explique qué cambia y por qué, sin línea `Co-Authored-By`, y le pasa al humano los comandos `git add` y `git commit -F`. **Nunca** `git push` ni nada que reescriba el historial (`--amend`, `rebase`, `reset`).
- No toques ficheros `.env*` ni pongas secretos en el cliente. Las claves de IA y `service_role` solo van en los secretos de las Edge Functions.
- **Un paso cada vez, cada uno en su propia sesión:** lee el paso del plan, las secciones que cita, las reglas transversales (§4.8) y su ficha; propón un plan corto, espera el visto bueno, implementa, cierra el paso (abajo) y **para**. Si en esta sesión ya cerraste uno, pide al humano una sesión nueva.
- Si el plan, la especificación y el código no coinciden, pregunta antes de decidir.
- En inglés, todo lo que es código: identificadores, comentarios, nombres de ficheros, carpetas y scripts de npm, y commits. En español, los textos de la interfaz y la documentación de `docs/`.

## Entorno y comandos

Se desarrolla en macOS (zsh) y, alguna vez, en Windows. Todo tiene que funcionar en los dos: los scripts de `package.json` los ejecuta `sh` en el Mac y `cmd` en Windows, así que nada de comandos propios de un sistema (`rm`, `cp`, `export`, `set`…). Los scripts auxiliares y los hooks, en Node, con rutas construidas con `path` y `os.homedir()`. En la terminal del agente (zsh) sí valen los comandos de Unix.

- `npm start`: servidor de desarrollo con datos simulados; `npm run start:local`, contra Supabase local (`db:start` antes).
- `npm run format` y `npm run check` (formato, lint, tests unitarios y los de Deno de las Edge Functions, que también se lanzan solos con `npm run test:functions`). El lint hace cumplir buenas prácticas de Angular: no desactives reglas para salir del paso.
- `npm run e2e`: Playwright (desde el paso 0.6).
- `npm run db:start`, `db:stop`, `db:reset` (migraciones y seed desde cero), `db:test` (pgTAP) y `db:types` (tipos en `src/app/data/supabase/`): Supabase en local, con Docker abierto y en los puertos 553xx (D-040). `db:start` también sirve las Edge Functions; si se crea una con Supabase ya arrancado, hay que reiniciarlo. La CLI de Supabase y Deno van fijados en `devDependencies` y los scripts los toman de `node_modules`, igual en macOS y Windows: se actualizan con `npm install --save-dev --save-exact supabase@<versión>`, nunca con Homebrew. Con la CLI v3, los comandos que tocan el proyecto en la nube necesitan `--remote` y piden confirmación. Si una imagen nueva de Postgres no arranca por la _collation_, `ALTER DATABASE template1 REFRESH COLLATION VERSION` (como `supabase_admin`) y `db:reset`.
- `npm run emojis`: trae de los repositorios oficiales de Fluent Emoji los emojis de las reacciones que falten y borra los que sobren (`-- --force` los rehace todos; necesita red y tarda con los animados).

## Angular en este proyecto

- **Estado con signals,** sin `@ngrx/signals` ni otras librerías. Se lee con `resource()` (no en `ngOnInit`) y se escribe con métodos `async`. Solo existen los stores previstos en `docs/PLAN.md` §4.5, y exponen su estado como solo lectura (`asReadonly()` o `computed()`).
- **`effect()`** solo en la frontera con APIs imperativas (CodeMirror, Web Speech, Realtime), justificado en un comentario.
- **Formularios:** Signal Forms con `<form [formRoot]>` y la opción `submission` de `form()` (`docs/PLAN.md` §4.6).
- **Ante la duda,** `search_documentation` para Angular y los tipos de `node_modules/@angular/material` para Material, cuya API ha cambiado hace poco.

## Arquitectura

Una aplicación Angular normal, sin capas ni patrones extra (`docs/PLAN.md` §4).

- **Estructura:** carpetas por funcionalidad (`auth/`, `student/`, `teacher/`, `admin/`) o por tema (`core/`, `data/`, `shared/`, `dev/`), nunca por tipo.
- **Datos:** pantallas y stores dependen solo de los servicios de datos (clases abstractas en `src/app/data`), nunca de Supabase ni de los datos simulados.
- **Tests:** cobertura del 100 % en la app Angular, que exige `npm run check`; solo se exime lo que no depende de nosotros, justificado en un comentario y en la bitácora (D-010). Los scripts auxiliares no entran. TDD en la lógica de stores, servicios simulados y funciones puras: primero el test.
- **UI:** Material para los componentes y Tailwind para la disposición y las piezas propias. **Tailwind siempre primero**, también para animaciones (`animate-*` del tema); CSS o SCSS solo si Tailwind complica o ensucia la plantilla, en `src/styles/` o en el parcial de la pieza (D-039). Sin CSS por componente: el aspecto de Material solo se toca en `src/theme.scss`. Colores solo con tokens (nunca directos ni `dark:`), y fuentes e iconos autoalojados, sin Google Fonts.
- **Tests:** busca los elementos como el usuario, por rol, etiqueta o texto. `data-testid` solo si no hay forma accesible.

## Al cerrar cada paso

1. `npm run format` y después `npm run check` en verde.
2. Si el paso es una pantalla, cumple su definición de terminado (`docs/PLAN.md` §5.4) y guarda su versión con `npm run screenshots -- <paso> <pantalla>`.
3. `npm run metrics -- <paso>`.
4. Escribe la bitácora del paso con `docs/bitacora/_plantilla.md` y su fila en `docs/REGISTRO.md`, completas: también las horas humanas (estimadas; por defecto, en torno al doble del tiempo de Claude), la validación del humano con sus iteraciones y los commits (los mensajes propuestos hasta que existan; después, sus hashes).
5. Si tomaste una decisión técnica, proponla en `docs/DECISIONES.md`.
6. Resume y espera. En cada iteración posterior, actualiza la bitácora; guarda capturas de la iteración solo si el humano lo pide.

---

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

## Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection
