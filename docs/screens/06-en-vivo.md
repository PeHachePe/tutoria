# 06 · Sesión en vivo

`/docente/en-vivo?grupo=&bloque=` · Docente y administrador · Capa 2 · 6 h (4.1) + 2 h (4.1b) + 6 h (4.1d y 4.1e, replanteo del 4.1c)

> Replanteada en el paso 4.1c (D-068). El 4.1d hizo los datos y la lógica que describe esta ficha, con la pantalla del 4.1 y el 4.1b encima; la pantalla nueva llega en el 4.1e.

## Objetivo

Que el docente, en plena clase, decida cuatro cosas de un vistazo:

1. **a quién atender ahora;**
2. **si conviene parar y explicar algo a todos;**
3. **si el ritmo es el que esperaba** (quién ha terminado, cuánto queda);
4. **quién no está trabajando,** solo cuando él lo pregunta.

**Regla de la pantalla:** cada dato responde a una de esas decisiones, o no sale. Lo que vale cero no se enseña, y nada entra en la cola si el docente no puede resolverlo acercándose a mirar el código. Los indicadores describen lo que pasa sin clasificar a nadie: el sistema describe y el docente interpreta (RF-11, CU-04, D-054).

## Datos

- `LiveService` (simulado y Supabase):
  - `listGroups()`: los grupos del docente (el administrador, todos), con su asignatura y sus bloques (los ocultos también);
  - `snapshot(grupo, bloque | null)`: los alumnos matriculados, los bloques y ejercicios del grupo (con sus pruebas, visibles y ocultas), **los intentos de todo el grupo con actividad en la ventana de sesión**, con sus eventos y sus interacciones con el tutor, y, si se pide un bloque, además todos los intentos de ese bloque (su estado acumulado);
  - `watch(grupo, onUpdate)`: intentos que cambian, eventos e interacciones nuevos (con Supabase, Realtime de `attempt`, `process_event` y `tutor_interaction`, filtrado por la RLS; con datos simulados, los cambios de `MockDb`, también los de otra pestaña).
- `LiveStore`, provisto en la ruta padre `en-vivo` para que lo comparta el detalle (ficha 07): lee el grupo y el bloque de la URL, carga la foto con `resource()`, aplica los cambios en vivo de forma inmutable (también los que llegan mientras carga) y tiene un reloj que avanza cada 15 s. Guarda en memoria a quién marcó el docente como atendido.
- Funciones puras (TDD): el motivo de la cola (`attentionReason()`, sobre `failureStreak()` y `isStuckMessage()`), si el alumno trabaja o está parado (`workState()`), las cifras de la cabecera (`liveFigures()`), el resumen por ejercicio (`exerciseOverview()`), la actividad por minuto y su lectura (`activityByMinute()`, `rhythmReading()`), el bloque por defecto (`defaultBlock()`) y la fila de cada alumno.
- No escribe nada.

## Contenido y disposición

- Referencia: boceto (figura 9 de la memoria) y prototipo (figura 18), que cambian con este replanteo.
- **Ventana de sesión:** solo cuenta la actividad de los últimos 60 minutos (`LIVE_WINDOW_MINUTES`). Un alumno **trabaja** si escribió, ejecutó o preguntó en los últimos 5 minutos (`ACTIVE_MINUTES`) y no está fuera de la ventana del navegador; si estuvo en la sesión y ya no, está **parado**; si no ha tenido actividad en la ventana, **no ha entrado**.
- **Cabecera: el contexto es el título.** Encima, en pequeño, un punto rojo que late y «En directo · Desarrollo web en entorno cliente» (la asignatura). El `h1`, «1.º DAW A · Tema 1: Validación de formularios» (grupo y bloque; con todo el grupo, «1.º DAW A · Toda la clase»). A la derecha, los selectores de grupo y de bloque, compactos y sin cortar el texto: el título ya dice dónde estás. El selector de bloque empieza por «Toda la clase» y marca los ocultos con «(oculto)» y los que tienen actividad ahora con un punto.
- **Cuatro cifras,** en una fila, que son también los filtros de la tabla:
  - **«Trabajando ahora»:** «18 de 24», con «3 parados · 3 sin entrar» debajo, solo lo que no sea cero.
  - **«Necesitan ayuda»:** el tamaño de la cola.
  - **«Han terminado»:** con un bloque, cuántos lo tienen entero entregado («4 de 24»); con toda la clase, «Entregas en esta clase».
  - **«Avance del bloque»:** el porcentaje de ejercicios entregados sobre los posibles (alumnos × ejercicios), con una barra fina; con toda la clase no sale.
  - Las cifras cambian contando (de 17 a 18), no de golpe.
- **«Dónde está la clase»** (dos tercios del ancho en escritorio): la gráfica principal. Una barra apilada por ejercicio (sin empezar, en curso, con fallos, superado, entregado) con su leyenda, que crece y mengua en directo. Bajo cada barra, su resumen en texto con lo que importa («5 con fallos · 4 en curso»), sin los ceros.
  - Con un bloque: todos sus ejercicios, en su orden.
  - Con toda la clase: los ejercicios con actividad en la ventana, de cualquier bloque, cada uno con el nombre de su bloque; los 5 con más alumnos y «Ver los N».
  - Cada tramo dice al pasar el ratón o al enfocarlo quiénes son («Con fallos: Aya, Hugo y 3 más»).
  - **«Para explicar a todos»:** cuando 3 alumnos o más fallan ahora la misma prueba (`COMMON_FAILURE_STUDENTS`), un aviso destacado bajo ese ejercicio con la llamada (`isStrongPassword("abc12345")`), lo que se espera (`false`; «prueba oculta» si lo es), cuántos la fallan y «Ver quiénes», que filtra la tabla. Con menos de 3 no sale nada: una prueba que falla un alumno es cosa de la cola.
  - Si hay alumnos trabajando en otros bloques, una línea al pie: «4 trabajan en otros bloques: Tema 2 (3) · Repaso (1)», cada uno un enlace que cambia de bloque.
- **«A quién atender»** (un tercio, a la misma altura que la gráfica; la tarjeta no crece): quien necesita al docente donde el tutor no llega. Siempre de todo el grupo, trabaje en el bloque que trabaje.
  - Solo motivos del código, que el docente resuelve acercándose:
    - «Ya tuvo la pista de nivel 3 y sigue fallando»;
    - «Falla N veces seguidas la misma prueba» (y «… y no ha pedido ninguna pista» si no la pidió);
    - «Le ha dicho al tutor N veces que no sabe seguir» (el atasco en el chat, `isStuckMessage`, desde 2 seguidas);
    - «Ha pedido N pistas seguidas sin ejecutar las pruebas».
  - **No entran** quien ha salido de la ventana del navegador ni quien lleva un rato sin escribir: no son algo que atender, sino quién no está trabajando, y eso lo responde la cifra «Trabajando ahora» cuando el docente lo pregunta.
  - Cada entrada, en dos líneas: el nombre (enlace a su intento) y cuánto lleva esperando; debajo, el motivo, el ejercicio (con su bloque si no es el elegido) y la prueba que falla, para llegar sabiendo qué mirar. A la derecha, «Atendido».
  - Orden: pistas agotadas, fallos seguidos, atasco en el chat y pistas en ráfaga; dentro de cada motivo, quien lleva más rato esperando.
  - Enseña 4; «Ver los otros N» despliega el resto dentro de la tarjeta, con su propio desplazamiento.
  - Sin nadie, la mascota con «Todo en orden: nadie necesita ayuda ahora mismo».
- **«Ritmo de la clase»** (todo el ancho, baja): las ejecuciones y las pistas de toda la clase minuto a minuto en los últimos 30 min, como dos líneas (las pistas, discontinuas), con sus totales («64 ejecuciones · 26 pistas»). Encima, **una frase que la lee** (`rhythmReading()`, comparando los últimos 10 minutos con los 10 anteriores):
  - «La clase trabaja a buen ritmo»;
  - «Las pistas suben y las ejecuciones bajan: la clase se está atascando»;
  - «La actividad ha bajado: la clase ha parado o está terminando»;
  - «La clase acaba de empezar» (menos de 10 minutos de actividad).
  - El último punto de cada línea late; cada minuto, la gráfica avanza.
- **«Alumnado»:** una tabla compacta y **paginada** (8 por página, `mat-paginator`), nunca una lista que crece.
  - Filtros, los mismos que las cifras: «Todos», «Necesitan ayuda», «Parados y sin entrar» y «Han terminado»; pulsar una cifra de la cabecera activa su filtro y lleva a la tabla. Buscador por nombre (sin tildes ni mayúsculas).
  - Columnas: alumno (enlace a su intento), ejercicio (con su bloque si no es el elegido y «Repitiendo» si es una práctica), estado con las pruebas superadas («Con fallos · 3 de 6», con una barrita), pistas con su nivel (vacío si no ha pedido), última actividad («Ahora mismo», «Hace 5 min») y observaciones.
  - Observaciones, como chips y solo si existen: el motivo de la cola, «Parado desde hace 12 min», «Fuera de la ventana», «Entregó tras pegar 400 caracteres», «Pegó al volver a la ventana», «Ráfaga de entregas», «Superó tras insistir», «Repite ejercicios». Las columnas de pegados, salidas y tiempo desaparecen: casi siempre valían cero, y cuando no, lo dice el chip.
  - Ordenable por cualquier columna; por defecto, primero quien está en la cola y después quien se movió último. Quien no ha entrado sale al final, en gris.
- **Fuera de clase** (nadie con actividad en la ventana): la pantalla no se queda vacía.
  - La cabecera dice «Fuera de clase · última actividad: jue 12 nov», sin el punto que late.
  - Las cifras pasan a las acumuladas del bloque: «Han empezado», «Han terminado» y «Avance del bloque».
  - «Dónde está la clase» ocupa todo el ancho con el estado acumulado del bloque y, bajo cada ejercicio, la prueba que más se falló.
  - «A quién atender» y «Ritmo de la clase» no salen. La tabla enseña el estado acumulado, sin «parados».
- **Ancho disponible** (container queries, no el de la ventana, porque el menú lateral ocupa sitio): las cifras, de cuatro en fila a dos por fila; la gráfica y la cola, una al lado de otra desde `@4xl` y, por debajo, primero la cola; la tabla, completa desde `@5xl` y, por debajo, una tarjeta por alumno, también paginada (6 por página).
- **Animaciones** (con las `animate-*` del tema, y quietas con `prefers-reduced-motion` o con las animaciones desactivadas): el punto en directo late, las cifras cuentan al cambiar, los tramos de las barras cambian de ancho con transición, las entradas de la cola llegan deslizando y se van al marcarlas, el último punto del ritmo late, una fila destella al cambiar y la mascota de «Todo en orden» saluda al vaciarse la cola.
- **«Lo último» desaparece** (era el feed del 4.1b): crecía con cada avance y no ayudaba a decidir nada. «Superó tras insistir» sigue como observación de la fila.

## Interacciones

- **Grupo o bloque:** cambia la URL; recargar o «Atrás» los conservan. Sin bloque en la URL, se elige al abrir (`defaultBlock()`): el bloque donde trabaja más de la mitad de quienes están en la sesión; si ninguno llega, «Toda la clase»; fuera de clase, el de actividad más reciente. Después no cambia solo.
- **Una cifra:** activa su filtro en la tabla y lleva el foco a ella.
- **Atendido:** quita al alumno de la cola hasta que aparece un motivo posterior.
- **Ver los otros N / Ver menos:** despliega la cola dentro de su tarjeta.
- **Ver quiénes** («Para explicar a todos»): filtra la tabla por quienes fallan esa prueba; un chip «Fallan `isStrongPassword("abc12345")`» lo deja quitar.
- **Ver los N** (toda la clase): enseña todos los ejercicios en marcha.
- **Otro bloque** (línea al pie de la gráfica): cambia el bloque.
- **Buscar, filtrar, ordenar y paginar** la tabla; el orden lo anuncia el lector de pantalla y el tercer clic vuelve al orden por atención.
- **Nombre del alumno** (cola o tabla): abre el detalle de su intento, conservando el grupo y el bloque. Sin intento, no es enlace.
- **Reintentar** (error): vuelve a cargar.
- Barra de desarrollo, «Simular la clase»: alumnos al azar que abren, ejecutan, piden pistas, preguntan, pegan, salen y entregan, con tres repartos para probar la pantalla: toda la clase en un bloque, medio grupo en dos bloques y cada alumno en un bloque distinto. «Atascar a un alumno», «Atascar en el chat» (un alumno le dice dos veces al tutor que no sabe seguir) y «Provocar un patrón».

## Estados

- **Cargando:** esqueletos de las cifras, la gráfica, la cola y la tabla, solo si la espera pasa de 300 ms.
- **Sin grupos:** estado vacío («Todavía no tienes grupos»).
- **Grupo sin bloques o bloque sin ejercicios:** estado vacío con su mensaje.
- **Error:** mensaje según el tipo y «Reintentar».
- **Fuera de clase:** el estado acumulado del bloque (arriba).
- **En directo:** todo lo anterior, que se actualiza solo.

## Accesibilidad

- Al llegar, el foco va al `h1`; la pestaña dice «1.º DAW A · En vivo · TutorIA».
- Las cifras son botones con su nombre completo («Necesitan ayuda: 5. Filtrar el alumnado») y `aria-pressed` cuando su filtro está activo. La fila de cifras es una región `aria-live="polite"` que anuncia solo el valor final, no cada paso de la cuenta.
- La gráfica, la cola, el ritmo y el alumnado son regiones con nombre; cada «Atendido» dice de quién es («Marcar como atendido: Aya»).
- Las barras son decorativas (`aria-hidden`) y cada ejercicio lleva su resumen en texto («En curso: 4, Con fallos: 5»); los nombres de cada tramo, también al enfocarlo con el teclado.
- «Para explicar a todos» no depende del color: lleva su texto y su icono.
- La gráfica del ritmo es decorativa: su frase de lectura y sus totales son texto, y las dos líneas se distinguen también por el trazo.
- La tabla tiene `caption` (oculto) con el grupo y el bloque; las cabeceras ordenables anuncian el orden (`LiveAnnouncer`), y el paginador, la página.
- Ninguna señal depende solo del color: chips e iconos con texto.
- Mientras carga, `aria-busy`, esqueleto con `aria-hidden` y «Cargando la sesión…» para el lector de pantalla.

## Criterios de aceptación

Del replanteo (4.1d y 4.1e):

- [ ] El título dice el grupo y el bloque, y la asignatura está a la vista sin abrir ningún desplegable; los selectores no cortan el texto a 1280 px.
- [ ] Con los datos del seed (fechas pasadas), la pantalla sale como «Fuera de clase» con el estado acumulado del bloque: ninguna tarjeta vacía.
- [ ] Con el simulador y toda la clase en un bloque: las cuatro cifras, la gráfica, la cola y el ritmo cambian solos, con sus animaciones.
- [ ] Con medio grupo en dos bloques: la cola y la tabla tienen a los alumnos de los dos, cada uno con su bloque, y la gráfica dice cuántos trabajan en el otro.
- [ ] Con cada alumno en un bloque distinto: se abre «Toda la clase», con los 5 ejercicios con más alumnos y «Ver los N».
- [ ] Un alumno que sale de la ventana o deja de escribir **no** entra en la cola: baja «Trabajando ahora» y sale en el filtro «Parados y sin entrar».
- [ ] «Atascar a un alumno» lo pone en la cola con su motivo y la prueba que falla; un alumno que le dice dos veces al tutor que no sabe seguir, también.
- [ ] La cola no hace crecer la página: enseña 4 y el resto se despliega dentro de la tarjeta.
- [ ] «Para explicar a todos» aparece desde 3 alumnos con la misma prueba fallida, y «Ver quiénes» filtra la tabla.
- [ ] La frase del ritmo cambia con la actividad (los cuatro casos, con tests).
- [ ] La tabla pagina de 8 en 8 y no tiene columnas de ceros; pulsar una cifra activa su filtro.
- [ ] Con `prefers-reduced-motion`, nada se mueve.
- [ ] Responsive en el móvil, a 1024, 1280, 1440 y 1920 px con el menú abierto, sin scroll horizontal; claro y oscuro; axe sin infracciones.

Ya cumplidos en el 4.1 y el 4.1b, y que siguen valiendo:

- [x] Marta (1.º DAW A) ve sus grupos con su asignatura; el administrador los ve todos.
- [x] «Atendido» quita al alumno de la cola hasta un motivo nuevo.
- [x] Un intento de práctica sale como «Repitiendo».
- [x] La tabla se ordena por cualquier columna y el buscador encuentra «Álvaro» con «alvaro».
- [x] Grupo y bloque en la URL; recargar los conserva.
- [x] Con Supabase local, la pantalla carga los datos reales y, con dos navegadores, lo que hace el alumno llega solo (probado por el autor; e2e en el 7.1).
- [x] La pestaña del detalle dice de quién es el intento y qué ejercicio.

## Fuera de alcance

- El detalle del intento (ficha 07).
- El ritmo respecto a la fecha de entrega (4.4).
- Rankings automáticos o etiquetas sobre la persona (D-054).
- El ritmo de escritura como indicio de código que no llega como pegado: descartado en el 4.1c por frágil y por su tono de vigilancia (D-068; trabajo futuro en `PENDIENTES.md`).
- «Llamar al profesor» desde la pantalla del alumno (`PENDIENTES.md`): cuando se haga, será el primer motivo de la cola.

## Pulido pendiente

- «Atendido» vive en memoria: se pierde al recargar y no lo ve otro dispositivo del docente (ver `PENDIENTES.md`).
