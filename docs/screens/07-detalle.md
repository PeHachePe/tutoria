# 07 · Detalle del intento

`/docente/en-vivo/:attemptId?grupo=&bloque=` · Docente y administrador · Capa 2 · 3 h (4.2)

## Objetivo

Que el docente, al acercarse a un alumno o al revisar después su trabajo, vea **cómo ha llegado hasta aquí**: la evolución del intento en el tiempo (RF-12, CU-04 flujo 3a), con las pruebas que fallaban, lo que preguntó al tutor y lo que este respondió, los pegados y las salidas de la ventana, y el código. Describe sin juzgar: el sistema cuenta lo que pasó y el docente interpreta (D-054).

## Datos

- `LiveService.attemptDetail(id)` (simulado y Supabase): el intento con su alumno, su ejercicio (con las pruebas, visibles y ocultas), el grupo y el bloque de su asignación, sus eventos y sus interacciones con el tutor. Lo lee la RLS del docente (sus alumnos; el administrador, todos). Un intento ajeno o inexistente da `not_found`.
- `LiveStore` (el de la ruta padre `en-vivo`): los cambios en vivo del intento (estado, código, eventos y, desde este paso, las interacciones con el tutor por Realtime), la señal del alumno en la cola con «Atendido» y los demás intentos del alumno en la misma asignación.
- Si la URL no lleva el grupo y el bloque del intento, se corrigen sin añadir una entrada al historial: así el `LiveStore` sigue el bloque del intento y «Volver a la sesión» vuelve a él.
- Funciones puras: la línea temporal (`attemptTimeline()`), las cifras del intento (`attemptFigures()`) y la mezcla de lo cargado con lo que llega en vivo (`mergeById()`).
- No escribe nada.

## Contenido y disposición

- **Cabecera:** «Volver a la sesión»; el `h1` con el nombre del alumno; debajo, el ejercicio (con su posición en el bloque), el bloque, «Intento N · Repitiendo» si es una práctica, el chip de estado y, si el alumno trabaja ahora, «En directo». Con más de un intento en la asignación, enlaces a los demás.
- **Si el alumno está en la cola:** una franja con su motivo («Falla 4 veces seguidas la misma prueba») y «Atendido».
- **Cifras:** tiempo, ejecuciones (con las pruebas superadas en la última), pistas (y el nivel más alto), preguntas al tutor, pegados (y caracteres) y tiempo fuera de la ventana.
- **Línea temporal** (izquierda en escritorio, con su propio desplazamiento): una lista ordenada, de lo más antiguo a lo más reciente, con la hora de cada entrada:
  - «Abrió el ejercicio»;
  - «Ejecutó las pruebas: 3 de 5 superadas», con la llamada de las que fallan (`sum([1, 2])`, o «comprobación oculta»), y «Superó todas las pruebas»;
  - cada pregunta, pista o intervención proactiva: lo que escribió el alumno y la respuesta del tutor, con el nivel de la pista, lo que hizo con sus herramientas y «Pidió la solución» si lo intentó; «El tutor prefirió no intervenir» cuando calló;
  - «Pegó 120 caracteres» y «Salió de la ventana · 2 min» (la salida y su vuelta, juntas);
  - «Entregó el ejercicio».
  - Entre dos entradas separadas por 5 minutos o más, «12 min sin actividad».
  - Filtros: «Todo», «Pruebas», «Tutor» y «Pegados y salidas».
- **Código** (derecha en escritorio, la misma altura): `<app-code-editor>` en solo lectura dentro de `@defer`, con el código final si está entregado o el actual si no. Si el alumno lo cambia mientras se mira, «El código ha cambiado» con «Ver el actual», que crea el editor de nuevo (D-029).
- **Ancho disponible** (container queries): dos columnas desde `@4xl`; por debajo, una debajo de otra, primero la línea temporal.

## Interacciones

- **Volver a la sesión:** al panel, con el grupo y el bloque.
- **Atendido:** como en la cola del panel; la franja desaparece.
- **Otro intento** del alumno en la asignación: abre su detalle.
- **Filtros:** cambian las entradas que se ven; la cifra de cada filtro dice cuántas tiene.
- **Ver el actual:** carga el código más reciente.
- **Reintentar** (error): vuelve a cargar.

## Estados

- **Cargando:** esqueleto de la cabecera, la línea temporal y el código, solo si la espera pasa de 300 ms.
- **No encontrado:** estado vacío («No encontramos este intento») con «Volver a la sesión».
- **Error:** mensaje según el tipo y «Reintentar».
- **Sin actividad todavía:** la línea temporal solo con «Abrió el ejercicio».
- **Con datos:** lo anterior, que se actualiza solo mientras el alumno trabaja.

## Accesibilidad

- Al llegar, el foco va al `h1`; la pestaña dice «Detalle del intento · TutorIA».
- La línea temporal es una lista ordenada (`ol`) con nombre; cada entrada empieza por su hora en un `<time>`.
- Los filtros son un grupo de opciones (`mat-button-toggle-group`, que expone `radiogroup`) con nombre, y cada una dice su recuento («Tutor 4»).
- Las entradas nuevas no se anuncian una a una; el código en solo lectura se puede recorrer con el teclado y Esc seguido de Tab sale de él.
- Ninguna marca depende solo del color: iconos con texto.

## Criterios de aceptación

- [x] Desde la cola o la tabla del panel, el nombre del alumno abre el detalle de su intento con el grupo y el bloque.
- [x] Un enlace directo sin grupo ni bloque abre el detalle y corrige la URL; «Volver a la sesión» lleva al bloque del intento.
- [x] La línea temporal muestra ejecuciones con las pruebas que fallan, la conversación con el tutor, pegados, salidas de la ventana con su duración y la entrega, sin duplicar una pista con su evento.
- [x] Con el simulador en marcha, las entradas nuevas aparecen solas (en el navegador); «El código ha cambiado» y «Ver el actual», comprobados con tests.
- [x] Con Supabase local, una pregunta al tutor aparece sola en el detalle (probado con una interacción guardada en la base local, como la escribe el servidor; con dos navegadores, en los e2e del 7.1).
- [x] Un intento ajeno dice «No encontramos este intento».
- [x] Responsive a 375, 768, 1280 y 1440 px con el menú abierto, sin scroll horizontal y sin scroll de la página en escritorio; claro y oscuro, axe sin infracciones. Falta mirarlo a 1024 y 1920 px.

## Fuera de alcance

- Reproducir el código en cada ejecución: el evento `run` no guarda el código (ver `PENDIENTES.md`).
- Comentarios o notas del docente sobre el intento.

## Pulido pendiente

- El autor quiere darle una vuelta más adelante: no le acaba de convencer y cree que algunas cifras sobran (ver `PENDIENTES.md`).
