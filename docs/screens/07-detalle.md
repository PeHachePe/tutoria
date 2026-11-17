# 07 · Detalle del intento

`/docente/en-vivo/:attemptId?grupo=&bloque=` · Docente y administrador · Capa 2 · 3 h (4.2) + 3,5 h (4.2b, replanteo del 4.1c)

> Replanteada en el paso 4.1c (D-069). Lo que describe esta ficha se construye en el 4.2b; hasta entonces, la aplicación tiene la versión del 4.2.

## Objetivo

Que el docente, al acercarse a un alumno, sepa en cinco segundos **dónde está atascado ahora** y, si quiere más, **cómo ha llegado hasta aquí**: la evolución del intento en el tiempo (RF-12, CU-04 flujo 3a), con las pruebas que fallaban, lo que preguntó al tutor y lo que este respondió, y el código. Al revisar después un intento entregado, lo mismo en pasado: cómo lo resolvió.

Sigue la regla del panel (ficha 06): cada dato responde a algo que el docente quiere saber, y lo que vale cero no se enseña. Describe sin juzgar: el sistema cuenta lo que pasó y el docente interpreta (D-054).

## Datos

- `LiveService.attemptDetail(id)` (simulado y Supabase): el intento con su alumno, su ejercicio (con las pruebas, visibles y ocultas), el grupo y el bloque de su asignación, sus eventos y sus interacciones con el tutor. Lo lee la RLS del docente (sus alumnos; el administrador, todos). Un intento ajeno o inexistente da `not_found`.
- `LiveStore` (el de la ruta padre `en-vivo`): los cambios en vivo del intento (estado, código, eventos e interacciones con el tutor), el motivo del alumno en la cola con «Atendido» y los demás intentos del alumno en la misma asignación.
- Si la URL no lleva el grupo del intento, se corrige sin añadir una entrada al historial. El bloque ya no hace falta: el panel sigue a todo el grupo (ficha 06), y «Volver a la sesión» conserva el bloque que hubiera.
- Funciones puras (TDD): lo que pasa ahora (`attemptNow()`), la evolución ejecución a ejecución (`attemptRuns()`), la línea temporal con las ejecuciones iguales agrupadas (`attemptTimeline()`), el resumen en una línea (`attemptSummary()`, que sustituye a `attemptFigures()`) y la mezcla de lo cargado con lo que llega en vivo (`mergeById()`).
- No escribe nada.

## Contenido y disposición

- **Cabecera:** «Volver a la sesión»; el `h1` con el nombre del alumno; debajo, el ejercicio (con su posición en el bloque), el bloque, «Intento N · Repitiendo» si es una práctica, el chip de estado y, si el alumno trabaja ahora, «En directo» con el punto que late. Con más de un intento en la asignación, enlaces a los demás.
- **Si el alumno está en la cola:** una franja con su motivo («Falla 4 veces seguidas la misma prueba») y «Atendido».
- **«Ahora»** (sustituye a las seis cifras; con el intento entregado se titula «Cómo lo resolvió» y habla en pasado). Dos piezas, una al lado de otra en escritorio:
  - **Pruebas:** «3 de 6 superadas» con su barrita y, debajo, cada prueba que falla en la última ejecución con su llamada, lo que se espera y desde cuándo (`isStrongPassword("abc12345")` · espera `false` · falla desde hace 5 ejecuciones); una oculta dice «comprobación oculta». Sin ejecuciones, «Todavía no ha ejecutado las pruebas». Con todo superado, «Supera todas las pruebas».
  - **La última ayuda del tutor:** el nivel de la pista, hace cuánto y el texto (dos líneas, con «Ver entera», que lleva a su entrada de la línea temporal). Sin ayuda, «No ha pedido ayuda al tutor».
  - Debajo, **una línea de resumen** con lo que siempre dice algo: «27 min de trabajo · 4 ejecuciones · 3 pistas (nivel 3)», sin las partes que valgan cero. Y, solo si existen, chips: «2 preguntas al tutor», «Pegó 320 caracteres», «8 min fuera de la ventana».
- **«Evolución»:** la gráfica del intento. Una columna por ejecución sobre el eje del tiempo, tan alta como las pruebas superadas (de 0 al total) y con otro tono cuando las supera todas; entre las columnas, una marca por cada pista (con su nivel) y por cada pegado. De un vistazo se ve si avanza, si lleva cinco ejecuciones igual o si saltó de 2 a 6 justo después de un pegado, sin que la pantalla lo diga.
  - Pulsar una columna o una marca lleva a su entrada de la línea temporal.
  - La columna nueva crece al llegar. Sin ejecuciones, la gráfica no sale.
- **Línea temporal** (izquierda en escritorio, con su propio desplazamiento): una lista con **lo más reciente arriba**, porque el docente la abre para saber qué pasa ahora y la gráfica ya cuenta la historia en orden. Cada entrada, con su hora:
  - «Ejecutó las pruebas: 3 de 6 superadas», con la llamada de las que fallan, y «Superó todas las pruebas»; **las ejecuciones seguidas con el mismo resultado se agrupan** («Ejecutó 4 veces · 3 de 6, fallan las mismas», con la hora de la primera y la última);
  - cada pregunta, pista o intervención proactiva: lo que escribió el alumno y la respuesta del tutor, con el nivel de la pista, lo que hizo con sus herramientas y «Pidió la solución» si lo intentó; «El tutor prefirió no intervenir» cuando calló;
  - «Pegó 120 caracteres» y «Salió de la ventana · 2 min» (la salida y su vuelta, juntas);
  - «Entregó el ejercicio» y, al final, «Abrió el ejercicio».
  - Entre dos entradas separadas por 5 minutos o más, «12 min sin actividad».
  - Filtros: «Todo», «Pruebas», «Tutor» y «Pegados y salidas», cada uno con su recuento; un filtro sin entradas no sale.
- **Código** (derecha en escritorio, la misma altura): `<app-code-editor>` en solo lectura dentro de `@defer`, con el código final si está entregado o el actual si no. Si el alumno lo cambia mientras se mira, «El código ha cambiado» con «Ver el actual», que crea el editor de nuevo (D-029).
- **Ancho disponible** (container queries): «Ahora» en dos piezas y la línea temporal junto al código desde `@4xl`; por debajo, todo en una columna, en este orden: ahora, evolución, código y línea temporal.
- **Animaciones** (quietas con `prefers-reduced-motion`): el punto en directo, la columna nueva de la evolución y la entrada nueva de la línea temporal, que llega deslizando.

## Interacciones

- **Volver a la sesión:** al panel, con el grupo y el bloque que hubiera.
- **Atendido:** como en la cola del panel; la franja desaparece.
- **Otro intento** del alumno en la asignación: abre su detalle.
- **Una columna o una marca de la evolución:** lleva a su entrada de la línea temporal y la resalta un momento.
- **Ver entera** (última ayuda): lleva a su entrada.
- **Filtros:** cambian las entradas que se ven.
- **Ver el actual:** carga el código más reciente.
- **Reintentar** (error): vuelve a cargar.

## Estados

- **Cargando:** esqueleto de la cabecera, «Ahora», la línea temporal y el código, solo si la espera pasa de 300 ms.
- **No encontrado:** estado vacío («No encontramos este intento») con «Volver a la sesión».
- **Error:** mensaje según el tipo y «Reintentar».
- **Sin actividad todavía:** «Todavía no ha ejecutado las pruebas», sin evolución, y la línea temporal solo con «Abrió el ejercicio».
- **En curso:** «Ahora», que se actualiza solo mientras el alumno trabaja.
- **Entregado:** «Cómo lo resolvió», con el código entregado.

## Accesibilidad

- Al llegar, el foco va al `h1`; la pestaña dice el alumno y el ejercicio («Ana García · Validar un correo electrónico · TutorIA»).
- «Ahora», «Evolución», la línea temporal y el código son regiones con nombre.
- La evolución tiene su alternativa en texto para el lector de pantalla («Ejecuciones: 3 de 6, 3 de 6, 5 de 6 y 6 de 6; 2 pistas y 1 pegado»); sus columnas y marcas son botones con nombre («Ejecución de las 10:12: 3 de 6 superadas. Ir a la línea temporal») y se recorren con el teclado.
- La línea temporal es una lista (`ol` con `reversed`) con nombre; cada entrada empieza por su hora en un `<time>`.
- Los filtros son un grupo de opciones (`mat-button-toggle-group`, que expone `radiogroup`) con nombre, y cada una dice su recuento («Tutor 4»).
- Las entradas nuevas no se anuncian una a una; el código en solo lectura se puede recorrer con el teclado y Esc seguido de Tab sale de él.
- Ninguna marca depende solo del color: iconos con texto, y las columnas de la evolución se distinguen por la altura.

## Criterios de aceptación

Del replanteo (4.2b):

- [ ] No hay ninguna cifra que valga cero: el resumen y los chips solo dicen lo que existe.
- [ ] «Ahora» dice qué pruebas fallan, qué esperan y desde cuántas ejecuciones, y la última ayuda del tutor con su nivel; en un intento entregado se titula «Cómo lo resolvió».
- [ ] La evolución pinta una columna por ejecución y una marca por pista y por pegado; pulsar una lleva a su entrada de la línea temporal.
- [ ] Cuatro ejecuciones seguidas con el mismo resultado salen como una entrada.
- [ ] La línea temporal enseña lo más reciente arriba y, con el simulador, las entradas y las columnas nuevas llegan solas.
- [ ] Un enlace directo sin grupo abre el detalle y corrige la URL; «Volver a la sesión» conserva el bloque.
- [ ] Responsive a 375, 768, 1024, 1280, 1440 y 1920 px con el menú abierto, sin scroll horizontal; claro y oscuro, axe sin infracciones.

Ya cumplidos en el 4.2, y que siguen valiendo:

- [x] Desde la cola o la tabla del panel, el nombre del alumno abre el detalle de su intento.
- [x] La línea temporal muestra ejecuciones con las pruebas que fallan, la conversación con el tutor, pegados, salidas de la ventana con su duración y la entrega, sin duplicar una pista con su evento.
- [x] «El código ha cambiado» y «Ver el actual», comprobados con tests.
- [x] Con Supabase local, una pregunta al tutor aparece sola en el detalle.
- [x] Un intento ajeno dice «No encontramos este intento».

## Fuera de alcance

- Reproducir el código en cada ejecución: el evento `run` no guarda el código (ver `PENDIENTES.md`). Cuando se guarde, cada columna de la evolución podrá abrir el código de esa ejecución.
- Comentarios o notas del docente sobre el intento.
- La ficha del alumno, con sus intentos de todos los bloques (ver `PENDIENTES.md`, después del 4.4).

## Pulido pendiente

- Nada por ahora.
