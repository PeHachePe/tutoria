# Los unitarios que fallaban con el equipo cargado

23/11/2026 · Sesión de Claude Code `6e570015` (`claude-opus-5-5`) · Commits: `8a8a442` test(blocks): look for the buttons of a block within the block (slow tests), `8320dcd` test: run the unit tests without Material animations, on half the cores (slow tests) y el de documentación

## Objetivo

Que `npm run check` vuelva a ser fiable con el equipo cargado. Desde el 6.2b fallaban unitarios de las pantallas del docente (`blocks-page`, `groups-page`, `exercise-form-page` y alguna vez `class-students`), casi siempre por los 15 s y nunca los mismos, aunque solos pasaban (fila del 6.2b en `PENDIENTES.md`). Primero había que averiguar por qué eran lentos y arreglar la causa; subir el límite, solo donde la espera fuera legítima y justificándolo.

## Qué se pidió

- Arreglar los unitarios del panel docente que fallan con el equipo cargado, empezando por diagnosticar por qué son lentos.
- Subir el tiempo máximo solo donde la espera sea legítima, y justificarlo.
- Hecho cuando `npm run check` pase entero tres veces seguidas y la fila de `PENDIENTES.md` quede cerrada.

## Qué hizo Claude

1. **Midió antes de tocar nada.** Perfiló la CPU de los tests más lentos y contó las llamadas a `getComputedStyle()` de cada consulta, con la línea del spec que la hacía (un sondeo temporal que no queda en el repositorio). La mitad del tiempo de `blocks-page.spec.ts` se iba en las consultas de Testing Library: `getByRole(…, { name })` sobre `screen` calcula el nombre accesible de cada botón de la página y, para eso, el estilo de cada elemento de dentro. jsdom 30 calcula la cascada entera de cada uno (≈ 1 ms) y la olvida con cualquier cambio del DOM: unos 630 estilos y medio segundo por consulta en la página de bloques (1300 elementos, 127 botones).
2. **Descartó lo que no era:** el DOM queda limpio entre tests, no se acumulan temporizadores, y los cuatro ficheros seguidos en un solo worker tardan lo mismo que por separado. La memoria tampoco: los workers sumaban ≈ 2,2 GB y el swap no creció.
3. **Pasó la suite entera como línea base:** 22 fallos en 5 ficheros (también `system-page`) y 430 s. En la suite, cada test tardaba entre 20 y 60 veces lo que tarda solo, sobre todo al principio de cada fichero: Vitest lanza 7 workers en el M3 del autor (4 núcleos de rendimiento y 4 de eficiencia), empieza por los ficheros más lentos y los reparte también por los núcleos lentos, con Docker y otra aplicación ocupando la CPU. Uno de los fallos lo provocó el anterior: el test de crear un ejercicio agotó su tiempo y siguió tecleando `[2, 3]` en el siguiente.
4. **Acotó las consultas de `blocks-page.spec.ts`:** los botones de un bloque o de sus ejercicios se buscan dentro del bloque (`blockButton()`, `blockMenu()` y `exerciseMenu()`, que sustituyen a `menu()`), y los de la barra de borrar varios, dentro de la barra (`toolbarButton()`). Los estilos calculados del fichero bajan de 49 600 a 25 200.
5. **Quitó las animaciones de Material en todos los unitarios** con `src/providers-testing.ts`, el `providersFile` del builder: jsdom no las reproduce y Material las esperaba con temporizadores, también para dar el foco a un diálogo o avisar de que se cerró. Tres specs lo hacían por su cuenta y dejan de repetirlo.
6. **Limitó los workers a la mitad de los núcleos** (`maxWorkers: '50%'` en `vitest-base.config.mts`). Con los dos cambios anteriores y 7 workers quedaban 5 fallos (389 s); con 4, ninguno, y la suite tardó 303 s.
7. Pasó `npm run check` tres veces seguidas (abajo), escribió D-091 y cerró la fila de `PENDIENTES.md`.

## Cómo funciona (para el manual)

No cambia nada de la aplicación: solo cómo corren sus unitarios.

- **Un test de una pantalla grande busca lo que se repite dentro de su zona** (el bloque, la fila, la barra o el diálogo), como lo busca quien usa la pantalla. Así la consulta mira unos pocos elementos en lugar de toda la página.
- **En los unitarios, Material no anima:** diálogos, menús y avisos se abren y se cierran al momento. Un test que quiera probar una animación puede volver a activarlas con su propio `MATERIAL_ANIMATIONS`.
- **`ng test` usa la mitad de los núcleos lógicos:** 4 en el Mac del autor y 2 en el CI.

## Comandos e instalaciones

| Comando                                                 | Para qué                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ng test --include … --coverage=false`                  | Pasar solo los ficheros afectados y leer la duración de cada test de su JSON |
| `ng test --runner-config <copia con --cpu-prof>`        | Perfilar la CPU de un test (configuración temporal, fuera del repositorio)   |
| `ng test --setup-files … <sondeo>`                      | Contar los estilos que calcula cada consulta y la línea del spec que la hace |
| `ng test --runner-config <copia con maxWorkers: 1 o 4>` | Comprobar si había acumulación entre ficheros y medir la suite con 4 workers |
| `sysctl vm.swapusage`, `vm_stat`, `ps -o rss`           | Ver la presión de memoria y lo que ocupaban los workers durante la suite     |
| `npm run format`, `npm run check` (tres veces seguidas) | Cerrar                                                                       |

Sin instalaciones.

## Archivos creados o modificados

- `src/providers-testing.ts` (nuevo) y `angular.json` (`providersFile`): Material sin animaciones en los unitarios.
- `vitest-base.config.mts`: `maxWorkers: '50%'`, con su porqué.
- `src/app/teacher/blocks/blocks-page.spec.ts`: las consultas, dentro del bloque o de la barra.
- `src/app/shared/staff-layout/staff-layout.spec.ts`, `src/app/dev/dev-toolbar/dev-toolbar.spec.ts` y `src/app/dev/showcase/showcase-page.spec.ts`: sin su `MATERIAL_ANIMATIONS`.
- `docs/DECISIONES.md` (D-091), `docs/PENDIENTES.md` (fila cerrada), `docs/REGISTRO.md` y esta bitácora.

## Problemas y cómo se resolvieron

- **Los tiempos no servían para comparar:** la misma tanda tardaba entre 26 y 84 s según el momento, porque la carga de fondo cambiaba y los workers caían en unos núcleos u otros. Para comparar se contaron los estilos calculados (no dependen de la carga) y, para la suite, se compararon pasadas seguidas.
- **El sondeo distorsionaba los tiempos:** sacar la pila de cada consulta es caro. Sirvió para contar y localizar, no para cronometrar.
- **Las consultas que quedan caras** son botones de la página sin zona propia («Nuevo bloque», «Seleccionar», «Copiar de otro grupo»), uno o dos por test, y las opciones del diálogo del banco, que ya se buscan dentro del diálogo. Se dejan así.
- **El test con menos margen** es el de los desdobles de `groups-page` (≈ 10 s en la suite): encadena siete diálogos y, tras cada guardado, la pantalla recarga la tabla del alumnado. Es trabajo de la pantalla, no del test.
- **La espera del diálogo «Añadir asignaturas a…»** no se alargó: sin animaciones, el diálogo llega a tiempo dentro de la espera de Testing Library.

## Decisiones

- [D-091](../DECISIONES.md): consultas dentro de su zona, Material sin animaciones y la mitad de los núcleos.

## Tests

Unitarios: 3256 (nuevos: 0) · e2e: 39. Ningún test nuevo: cambian cómo buscan los elementos y cómo corren.

| Pasada de la suite de unitarios      | Fallos | Duración | Suma de los tests | Test más lento |
| ------------------------------------ | ------ | -------- | ----------------- | -------------- |
| Línea base (7 workers)               | 22     | 430 s    | 2446 s            | 20,2 s         |
| Consultas acotadas y sin animaciones | 5      | 389 s    | 1915 s            | 16,2 s         |
| Lo anterior y 4 workers              | 0      | 303 s    | 914 s             | 9,4 s          |

Después, `npm run check` tres veces seguidas, todas en verde, con Supabase y la otra aplicación en marcha:

| Pasada | Carga al empezar | Duración del check | Test más lento                                              |
| ------ | ---------------- | ------------------ | ----------------------------------------------------------- |
| 1      | 3,2              | 455 s              | 9,8 s (`groups-page`, los desdobles)                        |
| 2      | 5,6              | 398 s              | 10,0 s (`blocks-page`, marcar los no empezados y borrarlos) |
| 3      | 6,1              | 442 s              | 9,6 s (`groups-page`, los desdobles)                        |

## Validación humana

Pendiente de la revisión del autor. Claude lo comprobó con las pasadas de arriba: la línea base reproduce los fallos, cada cambio se midió por separado y los tres `check` seguidos pasan enteros.

## Métricas

| Duración                                                              | Tokens de entrada | Tokens de salida | Tokens de caché                | Coste equivalente | Líneas +/− | Archivos | Horas humanas            |
| --------------------------------------------------------------------- | ----------------- | ---------------- | ------------------------------ | ----------------- | ---------- | -------- | ------------------------ |
| 1 h 22 min (las pasadas de la suite, en segundo plano mientras medía) | 284               | 134 k            | 33,4 M leídos / 331 k escritos | 11,94 $           | +265 / −85 | 10       | ≈ 1 h 45 min (estimadas) |

## Para la presentación

- Los tests no eran lentos por sí mismos: una consulta «busca el botón que se llama así» sobre toda la página le costaba a jsdom medio segundo, y siete workers en cuatro núcleos rápidos lo multiplicaban hasta pasar de 15 s.
- Con menos workers, la suite no solo deja de fallar: tarda menos (de 430 a 303 s).
