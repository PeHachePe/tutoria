# 09 · Histórico

`/docente/historico?grupo=&bloque=` · Docente y administrador · Capa 2 · 3 h (4.4, datos simulados) y 2 h (4.5, datos reales)

## Objetivo

Que el docente, fuera de clase, vea lo que ya pasó en un grupo bloque a bloque (RF-13, CU-05; figuras 10 y 19 de la memoria) para dos decisiones (D-068): si el grupo gana autonomía (la gráfica de pistas y la frase que la lee) y qué repasar (el bloque elegido: sus cifras, su entrega con quién faltó, D-054, y sus ejercicios uno a uno). Describe sin clasificar: ni rankings ni orden por cifras, y las listas de personas van por nombre.

## Datos

- `BlockService.listGroups()`: los grupos del docente con su asignatura (la administración, todos).
- `StatsService.groupHistory(groupId)`: el alumnado matriculado hoy; de cada bloque del grupo en orden, las cuentas en bruto (asignaciones que cuentan, intentos que cuentan, alumnos activos, pistas, superados, mediana de segundos entre abrir y entregar, y alumnos que se atascaron con el código) y las mismas cuentas de cada uno de sus ejercicios; y de cada fecha de entrega (bloque y fecha) de lo que el alumnado ve, las entregas a tiempo, en las últimas 24 horas (`DEADLINE_LAST_HOURS`), después del plazo y quién tiene algo sin entregar. `not_found` si el grupo no es suyo.
- Cuenta solo el intento que cuenta de cada alumno y asignación (`countedAttempt()`, D-046): la práctica no. Las asignaciones que cuentan son las que el alumnado ve o en las que alguien trabajó.
- Sin store: dos `resource()` en la página. No escribe nada.
- Funciones puras: `groupHistoryOf()` (simulados), `longestFailureStreak()` y `formatDuration()` (en `shared/`), `averageHints()`, `solvedPercent()`, `isStarted()`, `isRepresentative()`, `formatAverage()`, `formatPercent()`, `pickBlock()` y `hintTrend()`.
- En el 4.4, la versión de Supabase responde `unavailable` (estado de error con reintento); el 4.5 la completa con las RPC `group_work_stats` y `group_deadline_stats`.

## Contenido y disposición

Referencia: figura 19 (la gráfica con su frase y las cifras). Una sola columna a todos los anchos, con dos tarjetas a todo el ancho.

- **Cabecera:** la asignatura encima (`eyebrow`), «{grupo} · Histórico» y, con más de un grupo, el selector («grupo · asignatura»).
- **Evolución del grupo:** la frase que lee la tendencia («Las pistas bajan de 1,1 a 0,0 por ejercicio: el grupo recurre cada vez menos a la ayuda»), la leyenda («Cuenta para la tendencia», «Menos de media clase: no cuenta» solo si hay alguna barra gris, «Bloque elegido: su detalle, abajo»), una barra por bloque empezado con su valor encima y su título debajo, «Pulsa una barra para ver su detalle» y qué mide la gráfica. Los bloques que ha trabajado menos de media clase van en gris con «1 alumno» debajo y no cuentan para la frase. La columna del bloque elegido va resaltada y su título en negrita. Las barras miden de 4 a 10 rem; si no caben, la gráfica se desplaza dentro de su tarjeta. Con un solo bloque empezado no hay gráfica: «Aún no hay evolución que comparar: el grupo solo ha trabajado un bloque».
- **El bloque elegido:** su título, «3 ejercicios · lo han trabajado 24 de 24 alumnos» y tres cifras iguales en fila: «Ejercicios superados» («57 %», «41 de 72»), «Tiempo por ejercicio» (la mediana entre abrirlo y entregarlo, o «Sin entregas») y «Se atascaron en alguna prueba» («6 de 24» o «Nadie»).
- **Su entrega,** si tiene fecha (una fila por fecha): «Entrega: vie 6 nov, 23:59 · hace 12 días», las entregas a tiempo («40 de 72 a tiempo»; si la fecha aún no ha llegado, «3 de 48 entregadas»), las de las últimas 24 horas y las de después del plazo (solo si no son cero) y quién falta, siempre a la vista: «Faltan 19: Ana López, Bruno Gil (falta 1 de 3) y …». Solo quien entregó una parte dice cuánto le queda. Si nadie ha entregado, «Nadie ha entregado todavía» en lugar de la clase entera; si todos, «Todo entregado».
- **Sus ejercicios:** una tabla con el ejercicio, el porcentaje de la clase que lo superó, las pistas por alumno, el tiempo y, solo si alguien se atascó en el bloque, cuántos se atascaron en cada uno. Se desplaza de lado dentro de su tarjeta en el móvil.

## Interacciones

- **Cambiar de grupo:** cambia `?grupo=` y quita `?bloque=`.
- **Elegir un bloque** con su barra: cambia `?bloque=` conservando el grupo, sin pedir nada al servidor, y el foco se queda en la barra. Sin bloque en la URL, o con uno sin intentos, el último trabajado por media clase y, si no hay ninguno, el último con intentos.

## Estados

- **Cargando:** esqueleto con la forma de las dos tarjetas, con `aria-busy` y «Cargando el histórico…».
- **Vacío:** sin grupos, «Aún no tienes grupos»; con el grupo sin ningún bloque empezado, «Este grupo aún no tiene actividad».
- **Error:** de los grupos y del histórico, cada uno con «Reintentar».
- **Con datos:** lo descrito arriba.

## Accesibilidad

- La gráfica es una lista (`ol`) con nombre; cada barra es un enlace con nombre propio («Tema 1: 1,1 pistas por ejercicio. Ver sus cifras») y `aria-current` en el elegido. El título va primero en el DOM, aunque se vea debajo, para que lo visible esté seguido dentro del nombre (WCAG 2.5.3); «1 alumno» queda fuera del enlace.
- El gris y el resaltado se explican en la leyenda, y el gris también en texto («1 alumno»).
- La cabecera del bloque elegido es una región `aria-live`: elegir otro bloque se anuncia.
- La tabla de ejercicios tiene `caption` y, como se desplaza de lado en el móvil, su contenedor es una región con nombre que toma el foco.
- Al llegar, el foco va al `h1` (`HeadingFocus`).

## Criterios de aceptación

- [x] Gráfica propia de pistas por ejercicio, bloque a bloque, con su leyenda y la frase de la tendencia sobre los bloques representativos; sin gráfica con un solo bloque.
- [x] El bloque elegido, desde la gráfica y en la URL, con sus tres cifras, su entrega y sus ejercicios.
- [x] Selector de grupo con su asignatura, solo con más de un grupo.
- [x] Solo cuenta el intento que cuenta de cada asignación (D-046).
- [x] La entrega del bloque: a tiempo, en las últimas 24 horas, después y quién falta, por nombre, a la vista y sin etiquetar (D-054).
- [x] Sin huecos ni desplegables: lo que se viene a buscar se ve sin pulsar.
- [x] Estados de carga, vacío (sin grupos y sin actividad) y error con reintento.
- [x] La versión de Supabase da el estado de error hasta el 4.5.

## Fuera de alcance

- Los datos reales (4.5).
- Las entregas que vienen de todo el grupo, como recordatorio: su sitio es Bloques, donde se ponen las fechas (`PENDIENTES.md`).
- Los nombres de quien se atascó: llegan con la ficha del alumno (`PENDIENTES.md`, fila del 4.2).
- El histórico por sesión: los bloques generalizan la sesión (D-046).

## Pulido pendiente
