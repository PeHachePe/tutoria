# 06 · Sesión en vivo

`/docente/en-vivo` · Docente y administrador · Capa 2 · 6 h (4.1) + 2 h (4.1b)

## Objetivo

Que el docente, en plena clase, decida dos cosas de un vistazo: **a quién atender ahora** y **si conviene explicar algo a todos**. Los indicadores describen lo que pasa sin clasificar a nadie: el sistema describe y el docente interpreta (RF-11, CU-04, D-054).

## Datos

- `LiveService` (simulado y Supabase):
  - `listGroups()`: los grupos del docente (el administrador, todos), con su asignatura, sus bloques (los ocultos también) y el bloque con actividad más reciente;
  - `snapshot(grupo, bloque)`: alumnos matriculados, ejercicios del bloque (con sus umbrales y sus pruebas, visibles y ocultas), intentos de esas asignaciones y sus eventos;
  - `watch(grupo, onUpdate)`: intentos que cambian y eventos nuevos (con Supabase, Realtime de `attempt` y `process_event`, filtrado por la RLS; con datos simulados, los cambios de `MockDb`, también los de otra pestaña).
- `LiveStore`, provisto en la ruta padre `en-vivo` para que lo comparta el detalle (4.2): lee el grupo y el bloque de la URL (`?grupo=&bloque=`), carga la foto con `resource()`, aplica los cambios en vivo de forma inmutable (también los que llegan mientras carga) y tiene un reloj que avanza cada 15 s. Guarda en memoria a quién marcó el docente como atendido.
- Funciones puras: el motivo del atasco (`stuckReason()`), `awaySince()`, `lastBreakthrough()`, la fila de cada alumno con su señal, los patrones y el resumen por ejercicio (`exerciseOverview()`).
- No escribe nada.

## Contenido y disposición

- Referencia: boceto (figura 9 de la memoria) y prototipo (figura 18).
- **Cabecera:** el `h1` «Sesión en vivo», un punto rojo que late, «En directo · N en la sesión · N con el bloque entregado»; a la derecha, los selectores de grupo («1.º DAW A · Programación básica») y de bloque (los ocultos, con «(oculto)»).
- **Ventana de sesión:** solo cuenta la actividad de los últimos 60 minutos (`LIVE_WINDOW_MINUTES`). Un alumno sin actividad en ella sale en gris y sin señales.
- **A quién atender** (izquierda en escritorio): la cola de quien necesita al docente donde el tutor no llega, cada uno con su icono, su nombre (enlace a su intento), el motivo, el ejercicio, cuánto lleva esperando y el botón «Atendido».
  - Motivos: «Ya tuvo la pista de nivel 3 y sigue fallando»; «Falla N veces seguidas la misma prueba» (y «… y no ha pedido ninguna pista» si no la pidió); «Ha pedido N pistas seguidas sin ejecutar las pruebas»; «No escribe ni ejecuta desde hace un rato»; «Ha salido de la ventana».
  - Orden: primero lo que es del código (pistas agotadas y fallos seguidos), después las pistas en ráfaga, la inactividad y por último quien está fuera; dentro de cada grupo, quien lleva más rato esperando.
  - Enseña 6 y «Ver los N»; sin nadie, la mascota con «Todo en orden: nadie necesita ayuda ahora mismo».
- **La clase en el bloque** (derecha en escritorio, la misma altura): leyenda de estados y una barra apilada por ejercicio (sin empezar, en curso, con fallos, superado, entregado) que crece y mengua en directo. Debajo, «Más falla ahora:» con la llamada de la prueba (`isValidEmail("ana@example.com")`), «(prueba oculta)» si lo es, y cuántos alumnos la fallan; desde 3, la marca «Para explicar a todos».
- **Alumnado:** buscador por nombre (sin tildes ni mayúsculas) y la tabla: alumno (enlace a su intento), ejercicio (con «Repitiendo» si es una práctica), estado, tiempo, pistas y nivel, pegados, salidas de la ventana, pruebas superadas, última actividad («Ahora mismo», «Hace 5 min» o la fecha) y observaciones como chips (la señal, entrega con pegado, pegado al volver, ráfaga de entregas, sin actividad, repite ejercicios, superó tras insistir). Ordenable por cualquier columna; por defecto, primero lo que necesita atención y luego quien se movió último.
- **Ancho disponible** (container queries, no el de la ventana, porque el menú lateral ocupa sitio): tabla completa desde `@6xl`; entre `@5xl` y `@6xl`, sin tiempo, pegados ni salidas; por debajo, una tarjeta por alumno con todo.
- Animaciones: el punto en directo late, las entradas de la cola llegan deslizando, las barras cambian de ancho con transición y una fila destella al cambiar; todo se queda quieto con `prefers-reduced-motion`.
- **Actividad en directo (4.1b):** feed corto y actividad de la clase en los últimos 30 min.

## Interacciones

- **Grupo o bloque:** cambia la URL; recargar o «Atrás» los conservan. Al cambiar de grupo, el bloque pasa al de actividad más reciente.
- **Atendido:** quita al alumno de la cola hasta que aparece un motivo posterior.
- **Ver los N / Ver menos:** despliega la cola entera.
- **Buscar alumno:** filtra la tabla y las tarjetas.
- **Ordenar** por una columna (lo anuncia el lector de pantalla); el tercer clic vuelve al orden por atención.
- **Nombre del alumno** (cola o tabla): abre el detalle de su intento (4.2), conservando el grupo y el bloque. Sin intento, no es enlace.
- **Reintentar** (error): vuelve a cargar.
- Barra de desarrollo, «Simular la clase»: alumnos al azar que abren, ejecutan, piden pistas, pegan, salen y entregan; «Atascar a un alumno» y «Provocar un patrón», sobre el grupo y el bloque que se ven.

## Estados

- **Cargando:** esqueletos de las dos tarjetas y de la tabla, solo si la espera pasa de 300 ms.
- **Sin grupos:** estado vacío («Todavía no tienes grupos»).
- **Grupo sin bloques o bloque sin ejercicios:** estado vacío con su mensaje.
- **Error:** mensaje según el tipo y «Reintentar».
- **Con datos:** lo anterior, que se actualiza solo.

## Accesibilidad

- Al llegar, el foco va al `h1`; la pestaña dice «Sesión en vivo · TutorIA».
- La cola y la clase son regiones con nombre; cada «Atendido» dice de quién es («Marcar como atendido: Bea»).
- Las barras son decorativas (`aria-hidden`) y cada ejercicio lleva su resumen en texto para el lector de pantalla («En curso: 3, Entregado: 1»).
- Los selectores y el buscador tienen etiqueta; la tabla, `caption` (oculto) con el grupo y el bloque, y las cabeceras ordenables anuncian el orden (`LiveAnnouncer`).
- La cifra de la cabecera es una región `aria-live="polite"` que solo cambia cuando cambian las cifras, para no anunciar cada evento.
- Ninguna señal depende solo del color: chips e iconos con texto.
- Mientras carga, `aria-busy`, esqueleto con `aria-hidden` y «Cargando la sesión…» para el lector de pantalla.

## Criterios de aceptación

- [x] Marta (1.º DAW A) ve sus grupos con su asignatura y, por defecto, el bloque con actividad más reciente; el administrador los ve todos.
- [x] Con los datos del seed (fechas pasadas), todos salen sin actividad en la última hora y la cola dice «Todo en orden».
- [x] Con el simulador en marcha, la cola, las barras, la tabla y la cabecera cambian solas; «Atascar a un alumno» lo pone en la cola con «Falla N veces seguidas la misma prueba».
- [x] «Atendido» lo quita de la cola hasta un motivo nuevo.
- [x] Un alumno que sale de la ventana sale como «Ha salido de la ventana», no como atascado; si vuelve a trabajar sin que se registre la vuelta, deja de estar fuera.
- [x] Un intento de práctica sale como «Repitiendo».
- [x] La tabla se ordena por cualquier columna y el buscador encuentra «Álvaro» con «alvaro».
- [x] Grupo y bloque en la URL; recargar los conserva.
- [x] Con Supabase local, la pantalla carga los datos reales y, con dos navegadores, lo que hace el alumno llega solo (probado por el autor; e2e en el 7.1).
- [x] Responsive en el móvil, a 1024, 1200, 1366, 1600 y 1920 px con el menú abierto, sin scroll horizontal de la página; claro y oscuro.

## Fuera de alcance

- El detalle del intento (4.2).
- El ritmo respecto a la fecha de entrega (4.4, con la fecha del 4.3).
- Rankings automáticos o etiquetas sobre la persona (D-054).

## Pulido pendiente

- «Atendido» vive en memoria: se pierde al recargar y no lo ve otro dispositivo del docente (ver `PENDIENTES.md`).
