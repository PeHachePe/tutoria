# Limpieza al cerrar la fase 1

10/11/2026 · Sesión de Claude Code · Commit `5eef82a`

## Objetivo

Dejar el proyecto lo más pulido posible antes de la fase 2: quitar lo innecesario, reorganizar lo que lo pida, limpiar los estilos globales y usar Tailwind siempre que sea viable.

## Qué se pidió

- Una revisión general para hacer limpieza: quitar cosas innecesarias, limpiar código malo y reorganizar o agrupar en carpetas si hace falta.
- `src/styles.css` lo más limpio posible y repartido en ficheros específicos si es mejor idea.
- Usar siempre Tailwind en lo posible; SCSS y CSS cuando Tailwind complique o ensucie, sin sobrejustificarlo.
- Si los «datos simulados» del modo de desarrollo (`/dev/datos`) son necesarios o aportan algo; «aplica lo que consideres».
- **Iteración 2:** que Claude reformule los ejercicios de las fixtures que lo necesiten y añada más si lo ve conveniente.

## Qué hizo Claude

1. Revisó estructura, estilos y código: no hay `TODO`, `console.log` ni dependencias sin usar. Las exportaciones que nadie importa son las que solo usan los tests, los servicios que llegan en las fases 4 a 6 (`AdminService`, `LiveService`, `StatsService`, `isStuck`) y siete constantes o funciones de uso interno.
2. Quitó el explorador `/dev/datos` (unas 1.000 líneas con sus tests): se hizo en el 0.5, antes de las pantallas, y lo que hacía ya lo cubren el catálogo, la pantalla de trabajo y los tests. Se van también su ruta, su enlace en la barra de desarrollo y `.app-code-field` de `src/theme.scss`.
3. Dejó `src/styles.css` como índice y repartió su contenido en `src/styles/`: `tokens.css` (colores y tipos de Material para Tailwind), `animations.css` (animaciones como clases `animate-*`), `base.css` (cursor de mano) y `utilities.css` (`eyebrow` y `scroll-shadows`). `_theme-colors.scss` pasa también a `src/styles/`.
4. Pasó a Tailwind el chat del tutor (los puntos de «escribiendo», el cursor y la entrada de cada turno) y la entrada de las páginas en los dos shells, con `motion-reduce:animate-none`. `tutor-chat.css` desaparece. La mascota y las reacciones siguen en CSS.
5. Agrupó en `core/i18n/` los cuatro ficheros del idioma (`locale`, `load-locale`, `language-service`, `localized-paginator-intl`, con sus tests). `page-reloader` se queda en `core/`, porque también lo usan la zona de código y la barra de desarrollo.
6. Quitó el `export` de `AUTOSAVE_DELAY_MS`, `WIDE_LAYOUT`, `NARROW_WORKSPACE_QUERY`, `CENTRE`, `amount`, `swing` y `LOCALES`, que solo usa su propio fichero.
7. Actualizó §4.1 y §4.8 del plan, el bloque del proyecto en `CLAUDE.md` y propuso D-039.
8. **Iteración 2**, los 8 ejercicios de las fixtures (pendiente del 0.5). El 8 pasa a «Buscar la primera aparición de un valor»: pedía dejar de recorrer el vector en cuanto encontrara el valor, que las pruebas no pueden comprobar, y ahora pide la primera aparición contando desde 0, que sí comprueban sus pruebas con valores repetidos (la eficiencia queda para el tutor). El 2 cambia «Bucles anidados» por «Bucles», porque la tabla de un número se hace con un solo bucle. El «sin `reverse()`» del 5 se mantiene: es la práctica del ejercicio, y la ven el tutor y el docente en el código. No se añaden ejercicios: los 8 son la batería de §2.5 y de la memoria, cubren las cuatro sesiones del grupo de ejemplo, y el docente podrá crear más en el 4.3. Se regenera `seed.sql` y se quita la fila del 0.5 de `PENDIENTES.md`.

## Comandos e instalaciones

| Comando                       | Para qué                                    |
| ----------------------------- | ------------------------------------------- |
| `npx tsc -p tsconfig.*.json`  | Comprobar las rutas tras mover los ficheros |
| `npm run check`               | Formato, lint, tests con cobertura e i18n   |
| `npm run metrics -- limpieza` | Métricas de la sesión                       |

## Archivos creados o modificados

- Nuevos: `src/styles/{tokens,animations,base,utilities}.css`, `docs/bitacora/limpieza-fase-1.md`.
- Movidos: `src/_theme-colors.scss` → `src/styles/`; `core/{locale,load-locale,language-service,localized-paginator-intl}{,.spec}.ts` → `core/i18n/`.
- Borrados: `dev/data-explorer/` (5 ficheros), `student/workspace/tutor/tutor-chat.css`.
- Modificados: `src/styles.css`, `src/theme.scss`, `tutor-panel.{html,spec.ts}`, `workspace-page.html`, `student-layout.html`, `staff-layout.{html,ts}`, `dev.routes{,.spec}.ts`, `dev-paths.ts`, `dev-toolbar{,.spec}.ts`, `showcase-page.html`, `attempt-store.ts`, `workspace-page.ts`, `reaction-blocks.ts`, los imports del idioma en ocho ficheros, `docs/PLAN.md`, `DECISIONES.md`, `CLAUDE.md`.

## Problemas y cómo se resolvieron

- Los tres puntos de «escribiendo» salían a la vez: el `animation` que el padre pone con `*:` pisaba el `animation-delay` de cada punto, porque los dos selectores pesan lo mismo. Los retrasos pasan al padre con `*:nth-2:` y `*:nth-3:`, que pesan más (comprobado en el navegador: 0 s, 0,15 s y 0,3 s).
- Al mover `load-locale.ts`, sus `import()` de `src/locale/*.json` necesitaban un nivel más de `../`; lo detectó `tsc`.

## Decisiones

[D-039](../DECISIONES.md): Tailwind primero y estilos globales repartidos en `src/styles/`, sin el explorador `/dev/datos`.

## Tests

Unitarios: 796 (−23, los del explorador) · e2e: 38. Sin tests nuevos; el del cursor del chat lo busca por `data-testid`, porque es decorativo y `aria-hidden`. `npm run check` en verde.

En el navegador: entrada de página, `eyebrow`, `scroll-shadows`, los puntos y el cursor del chat, la entrada de cada turno, el parpadeo de la mascota y el cursor de mano en los botones.

Iteración 2: el test de los contenidos de las fixtures se actualiza; `npm run check` en verde y `seed.sql` al día.

## Validación humana

El autor pidió la revisión y, sobre la propuesta, preguntó si el explorador de datos aportaba algo y dejó a Claude decidir («aplica lo que consideres»), con la regla de Tailwind primero sin sobrejustificar el CSS.

- Iteración 2: dio por buenos los ejercicios y pidió reformular lo que hiciera falta o añadir los que Claude viera oportunos.

## Capturas

No es una pantalla.

## Métricas

| Duración | Tokens de entrada | Tokens de salida | Tokens de caché                      | Coste equivalente | Líneas +/−   | Archivos | Horas humanas |
| -------- | ----------------- | ---------------- | ------------------------------------ | ----------------- | ------------ | -------- | ------------- |
| 17 min   | 201               | 52.643           | 12.742.502 leídos / 156.784 escritos | 4,86 $            | +322 / −1397 | 52       | ≈ 35 min      |

Las líneas incluyen la documentación; la mayor parte de lo borrado es el explorador.

Iteración 2: ≈ 6 min de Claude y ≈ 15 min humanas (estimadas), 3 ficheros de código, el plan y `seed.sql`.

## Para la presentación

Al cerrar la fase 1, una limpieza quitó unas 1.000 líneas que ya no aportaban (el explorador de datos de la fase 0) y dejó los estilos globales en un índice de cinco líneas de imports.
