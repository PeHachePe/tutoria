# 06 · Sesión en vivo

`/docente/en-vivo?grupo=&bloque=` · Docente y administrador · Capa 2 · 6 h (4.1) + 2 h (4.1b) + 6 h (4.1d y 4.1e, replanteo del 4.1c)

> Replanteada en el paso 4.1c (D-068). El 4.1d hizo los datos y la lógica; el 4.1e, la pantalla.

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
- Funciones puras (TDD): el motivo de la cola (`attentionReason()`, sobre `failureStreak()` y `isStuckMessage()`), si el alumno trabaja o está parado (`workState()`), los recuentos de las pestañas (`liveFigures()`), el resumen por ejercicio (`exerciseOverview()`), dónde está cada alumno en el bloque (`classStrip()`), la actividad por minuto y su lectura (`activityByMinute()`, `rhythmReading()`), el bloque por defecto (`defaultBlock()`) y la fila de cada alumno.
- No escribe nada.

## Contenido y disposición

- Referencia: boceto (figura 9 de la memoria) y prototipo (figura 18), que cambian con este replanteo.
- **Ventana de sesión:** solo cuenta la actividad de los últimos 60 minutos (`LIVE_WINDOW_MINUTES`). Un alumno **trabaja** si escribió, ejecutó o preguntó en los últimos 5 minutos (`ACTIVE_MINUTES`) y no está fuera de la ventana del navegador; si estuvo en la sesión y ya no, está **parado**; si no ha tenido actividad en la ventana, **no ha entrado**.
- **Cabecera: el contexto es el título.** Encima, en pequeño, un punto rojo que late y «En directo · Desarrollo web en entorno cliente» (la asignatura; fuera de clase, «Fuera de clase · Desarrollo web en entorno cliente · última actividad: jue 12 nov»). El `h1`, «1.º DAW A · Tema 1: Validación de formularios» (grupo y bloque; con todo el grupo, «1.º DAW A · Toda la clase»). A la derecha, los selectores de grupo y de bloque, compactos y sin cortar el texto: el título ya dice dónde estás. El selector de bloque empieza por «Toda la clase» y marca los ocultos con «(oculto)» y los que tienen actividad ahora con un punto. La cabecera solo da contexto: todo lo que es dato va en tarjetas.
- **Colores de las gráficas** (4.1e, D-070): una paleta propia, validada para daltonismo y para el modo oscuro, en tokens del tema (`bg-chart-progress`, `-fail`, `-pass`, `-done`): azul en curso, naranja con fallos, turquesa superado y verde entregado; «Sin empezar» es el fondo vacío de la barra. Los colores de estado del resto de la aplicación no cambian.
- **«Ritmo de la clase»** (en clase; una tarjeta baja a todo el ancho, bajo la cabecera): a la izquierda, **una frase que lo lee** (`rhythmReading()`, comparando los 10 últimos minutos completos con los 10 anteriores) y «Todo el grupo · últimos 10 min, frente a los anteriores», centrados en altura con las gráficas:
  - «La clase trabaja a buen ritmo»;
  - «Las pistas suben y las ejecuciones bajan: la clase se está atascando», en una píldora de aviso con su icono;
  - «La actividad ha bajado: la clase ha parado o está terminando»;
  - «La clase acaba de empezar» (sin minutos anteriores).
  - A su derecha, **dos minigráficas del mismo tamaño**, ejecuciones y pistas, que se reparten el resto del ancho: cada una con su número de los 10 últimos minutos y el de los 10 anteriores encima («22 ejecuciones (antes: 12)») y su línea de los últimos 30 minutos completos debajo, con línea base, un relleno suave y el último punto latiendo. Cada una tiene su escala: en una sola, las pistas, siempre muchas menos, salían planas. Al pasar el ratón, una línea marca el minuto y dice sus cifras («Hace 4 min · ejecuciones: 3 · pistas: 1»). El minuto en curso no se dibuja ni se compara: sus pocos segundos se leerían siempre como una bajada.
  - Es siempre de todo el grupo, sea cual sea el bloque elegido.
- **«Dónde está la clase»** (dos tercios del ancho en escritorio): la gráfica principal. En la cabecera, con un bloque, «Avance del bloque 31 %» (ejercicios entregados sobre los posibles); debajo, la leyenda.
  - Con un bloque, **una frase dice dónde está la clase**: «La mayoría está entre el ejercicio 8 y el 9» (la mitad central de quienes están en él; fuera de clase, donde lo dejaron) y **nombra a quien va solo lejos del grueso**, uno o dos alumnos a más de dos ejercicios, en clases de 6 o más: «Hugo sigue en el 2 · Lía va por el 12». Como un hecho, sin etiquetas sobre la persona (D-054).
  - Con más de 5 ejercicios, encima de la frase, **una franja con una columna por ejercicio**, de la misma altura con 6 ejercicios que con 200: cada columna mide lo que los alumnos que están ahora en ese ejercicio, por estados, y lleva encima el nombre de quien va solo. Al pasar el ratón dice el ejercicio y cuántos hay.
  - Debajo, **una fila por ejercicio**: el título en una línea (y su bloque, pequeño, debajo, con «Toda la clase»), y a su derecha la barra apilada, que ocupa todo el ancho que queda y mide lo mismo en todas las filas, con su resumen debajo («5 con fallos · 4 en curso», sin los ceros). Cada parte del resumen es un botón que dice los nombres al pasar el ratón o enfocarlo («Con fallos: Aya, Hugo y 3 más») y filtra la tabla, con un chip «Con fallos en 2. Título» para quitarlo.
  - Con un bloque de más de 5 ejercicios, primero los que tienen alumnos ahora, los más concurridos antes, y después el resto en orden; con 5 o menos, en orden. Con «Toda la clase», los ejercicios con actividad en la ventana, de cualquier bloque, el de más alumnos primero. Todos en la tarjeta, que tiene un alto máximo y se desplaza por dentro: nada que desplegar.
  - **«Para explicar a todos»:** cuando 3 alumnos o más fallan ahora la misma prueba (`COMMON_FAILURE_STUDENTS`), un aviso destacado bajo ese ejercicio con la llamada, lo que se espera («· prueba oculta» si lo es), cuántos la fallan y «Ver quiénes», que filtra la tabla. Fuera de clase, «La prueba que más se falló», solo si la fallaron 2 alumnos o más: una prueba de un alumno es cosa de la cola.
  - Si hay alumnos trabajando en otros bloques, una línea al pie: «4 trabajan en otros bloques: Tema 2 (3) · Repaso (1)», cada uno un enlace que cambia de bloque y lleva el foco al título.
  - Fuera de clase y con toda la clase no hay nada acumulado que enseñar: «Ahora no hay nadie trabajando. Elige un bloque para ver cómo lo lleva el grupo.», con un enlace a cada bloque, y sin tabla.
- **«A quién atender»** (un tercio, al lado de la gráfica): quien necesita al docente donde el tutor no llega. Siempre de todo el grupo, trabaje en el bloque que trabaje. La cola no la pide el alumno: la calcula el sistema con su trabajo.
  - Solo motivos del código, que el docente resuelve acercándose:
    - «Ya tuvo la pista de nivel 3 y sigue fallando»;
    - «Falla N veces seguidas la misma prueba» (y «… y no ha pedido ninguna pista» si no la pidió);
    - «Le ha dicho al tutor N veces que no sabe seguir» (el atasco en el chat, `isStuckMessage`, desde 2 seguidas);
    - «Ha pedido N pistas seguidas sin ejecutar las pruebas».
  - **No entran** quien ha salido de la ventana del navegador ni quien lleva un rato sin escribir: no son algo que atender, sino quién no está trabajando, y eso lo responde la pestaña «Parados y sin entrar».
  - Cada entrada: en la primera línea, el nombre (enlace a su intento), cuánto lleva esperando y «Atendido»; debajo, el motivo, el ejercicio y su bloque si no es el elegido; y «falla» con la llamada en una línea, cortada con «…» y entera al pasar el ratón.
  - Orden: pistas agotadas, fallos seguidos, atasco en el chat y pistas en ráfaga; dentro de cada motivo, quien lleva más rato esperando.
  - Todas las entradas están en la tarjeta, que se desplaza por dentro. Las entradas llegan deslizando y se van al marcarlas.
  - Sin nadie, la mascota con «Todo en orden: nadie necesita ayuda ahora mismo».
- **Lado a lado, la gráfica y la cola miden lo mismo:** lo que pida la más alta de las dos, con un tope (28 rem). Ninguna crece sin fin: lo que no cabe se desplaza por dentro.
- **«Alumnado»:** una tarjeta con una sola fila arriba: **una pestaña por filtro con su número** a la izquierda y **un buscador en píldora** a la derecha (con su botón «Borrar la búsqueda»), y debajo la tabla compacta y **paginada** (8 por página, `mat-paginator`), nunca una lista que crece. El título «Alumnado» es solo para el lector de pantalla: las pestañas dicen lo que es. Con poco ancho, el buscador baja a su propia línea.
  - Las pestañas en clase: «Todos 24 · Necesitan ayuda 5 · Trabajando ahora 14 · Parados y sin entrar 10 · Han terminado 2» («Han entregado» con «Toda la clase», quien entregó algo en esta clase). Fuera de clase: «Todos · Han empezado · Han terminado». «Necesitan ayuda» lleva su número en color de aviso cuando no es cero.
  - Cada pestaña es un enlace a su filtro (`?filtro=ayuda`): recargar o volver del detalle lo conserva, y nada se mueve al pulsarla. La tabla guarda el alto de una página, así que filtrar no acorta la página bajo el docente.
  - Buscador por nombre (sin tildes ni mayúsculas).
  - Columnas: alumno (enlace a su intento), ejercicio (con su bloque si no es el elegido y «Repitiendo» si es una práctica), estado con las pruebas superadas («Con fallos · 3/6», con una barrita), pistas con su nivel (vacío si no ha pedido), última actividad («Ahora mismo», «Hace 5 min») y observaciones.
  - Observaciones, como chips y solo si existen: el motivo de la cola, «Fuera de la ventana», «Entregó tras pegar 400 caracteres», «Pegó al volver a la ventana», «Ráfaga de entregas», «Superó tras insistir», «Repite ejercicios». No hay chip de «parado»: lo dice la última actividad. Las columnas de pegados, salidas y tiempo desaparecen: casi siempre valían cero, y cuando no, lo dice el chip.
  - Ordenable por cualquier columna; por defecto, primero quien está en la cola (en su orden), después quien está en la sesión y al final quien no ha entrado, en gris solo en clase; dentro de cada parte, por nombre. Una fila solo se mueve cuando su alumno cambia de parte, así una página no se reordena sola mientras la clase trabaja.
- **Fuera de clase** (nadie con actividad en la ventana): la pantalla no se queda vacía.
  - La cabecera dice «Fuera de clase · … · última actividad: jue 12 nov», sin el punto que late.
  - Las pestañas pasan a las acumuladas del bloque: «Han empezado» y «Han terminado».
  - «Dónde está la clase» ocupa todo el ancho con el estado acumulado del bloque.
  - «A quién atender» y «Ritmo de la clase» no salen. La tabla enseña el estado acumulado.
- **Ancho disponible** (container queries, no el de la ventana, porque el menú lateral ocupa sitio): la gráfica y la cola, una al lado de otra desde `@4xl` y, por debajo, primero la cola; las filas de la gráfica, con el título a la izquierda desde `@2xl`; la tabla, completa desde `@5xl` y, por debajo, una fila de texto por alumno, también paginada (6 por página).
- **Animaciones** (con las `animate-*` del tema, y quietas con `prefers-reduced-motion`; el ajuste de animaciones es del alumno): el punto en directo late, los tramos de las barras y las columnas de la franja cambian con transición, las entradas de la cola llegan deslizando y se van al marcarlas, el último punto de cada minigráfica late, una fila destella al cambiar y la mascota de «Todo en orden» saluda al vaciarse la cola.
- **«Lo último» desaparece** (era el feed del 4.1b): crecía con cada avance y no ayudaba a decidir nada. «Superó tras insistir» sigue como observación de la fila.

## Interacciones

- **Grupo o bloque:** cambia la URL; recargar o «Atrás» los conservan. Sin bloque en la URL, se elige al abrir (`defaultBlock()`): el bloque donde trabaja más de la mitad de quienes están en la sesión; si ninguno llega, «Toda la clase»; fuera de clase, el de actividad más reciente. Después no cambia solo.
- **Una pestaña:** filtra la tabla; «Todos» enseña a todo el alumnado.
- **Atendido:** quita al alumno de la cola hasta que aparece un motivo posterior.
- **Ver quiénes** («Para explicar a todos») o **una parte del resumen** de un ejercicio: filtra la tabla por esos alumnos; un chip («Fallan `isStrongPassword("abc12345")`», «Con fallos en 2. Título») lo deja quitar, y una pestaña también.
- **Otro bloque** (línea al pie de la gráfica, o los enlaces cuando nadie trabaja): cambia el bloque y lleva el foco al título.
- **Buscar, ordenar y paginar** la tabla; el orden lo anuncia el lector de pantalla y el tercer clic vuelve al orden por defecto.
- **Nombre del alumno** (cola o tabla): abre el detalle de su intento, conservando el grupo y el bloque. Sin intento, no es enlace.
- **Reintentar** (error): vuelve a cargar.
- Barra de desarrollo, «Simular la clase»: alumnos al azar que abren, ejecutan, piden pistas, preguntan, pegan, salen y entregan, con tres repartos para probar la pantalla: toda la clase en un bloque, medio grupo en dos bloques y cada alumno en un bloque distinto. «Atascar a un alumno», «Atascar en el chat» (un alumno le dice dos veces al tutor que no sabe seguir) y «Provocar un patrón» (un alumno sale, vuelve, pega 420 caracteres y entrega: las observaciones de la tabla).

## Estados

- **Cargando:** esqueletos con la forma de la página (el ritmo, la gráfica junto a la cola y la tabla), solo si la espera pasa de 300 ms.
- **Sin grupos:** estado vacío («Todavía no tienes grupos»).
- **Grupo sin bloques o bloque sin ejercicios:** estado vacío con su mensaje.
- **Error:** mensaje según el tipo y «Reintentar».
- **Fuera de clase:** el estado acumulado del bloque (arriba).
- **Bloque sin nadie:** «Ahora nadie trabaja en este bloque.» (en clase) o «Nadie ha empezado este bloque todavía.».
- **En directo:** todo lo anterior, que se actualiza solo.

## Accesibilidad

- Al llegar, el foco va al `h1`; la pestaña del navegador dice «1.º DAW A · En vivo · TutorIA», también al cambiar de bloque o de filtro (D-070).
- Las pestañas de la tabla son una lista de pestañas con nombre («Filtrar el alumnado»), cada una con su número en el nombre; un párrafo `aria-live="polite"` anuncia «Trabajando ahora: 14 de 24. Necesitan ayuda: 5.» cuando cambian.
- La gráfica, la cola, el ritmo y el alumnado son regiones con nombre; cada «Atendido» dice de quién es («Marcar como atendido: Aya»).
- Las barras y la franja son decorativas (`aria-hidden`): la frase dice dónde está la clase y quién va solo, y cada ejercicio lleva su resumen en texto visible, cuyas partes son botones de 24 px que dicen los nombres al enfocarlos y filtran la tabla. Los tramos como botones serían dianas de menos de 24 px (WCAG 2.5.8).
- «Para explicar a todos» y «se está atascando» no dependen del color: llevan su texto y su icono.
- Las minigráficas del ritmo son decorativas: su frase y sus números son texto, y cada una lleva su nombre encima.
- La tabla tiene `caption` (oculto) con el grupo y el bloque; las cabeceras ordenables anuncian el orden (`LiveAnnouncer`), y el paginador, la página.
- Ninguna señal depende solo del color: chips e iconos con texto.
- Mientras carga, `aria-busy`, esqueleto con `aria-hidden` y «Cargando la sesión…» para el lector de pantalla.

## Criterios de aceptación

Del replanteo (4.1d y 4.1e):

- [x] El título dice el grupo y el bloque, y la asignatura está a la vista sin abrir ningún desplegable; los selectores no cortan el texto a 1280 px.
- [x] Con los datos del seed (fechas pasadas), la pantalla sale como «Fuera de clase» con el estado acumulado del bloque: ninguna tarjeta vacía.
- [x] Con el simulador y toda la clase en un bloque: las pestañas, la gráfica, la cola y el ritmo cambian solos, con sus animaciones.
- [x] Con medio grupo en dos bloques: la cola y la tabla tienen a los alumnos de los dos, cada uno con su bloque, y la gráfica dice cuántos trabajan en el otro.
- [x] Con cada alumno en un bloque distinto: se abre «Toda la clase», con los ejercicios en marcha de cualquier bloque, el de más alumnos primero.
- [x] Un alumno que sale de la ventana o deja de escribir **no** entra en la cola: baja «Trabajando ahora» y sale en la pestaña «Parados y sin entrar».
- [x] «Atascar a un alumno» lo pone en la cola con su motivo y la prueba que falla; un alumno que le dice dos veces al tutor que no sabe seguir, también.
- [x] La cola y la gráfica no hacen crecer la página: miden lo mismo, con un tope, y se desplazan por dentro.
- [x] Con muchos ejercicios, la franja ocupa lo mismo y nombra a quien va solo lejos del grueso (muestrario, 12 ejercicios).
- [x] «Para explicar a todos» aparece desde 3 alumnos con la misma prueba fallida, y «Ver quiénes» filtra la tabla.
- [x] La frase del ritmo cambia con la actividad (los cuatro casos, con tests).
- [x] La tabla pagina de 8 en 8 y no tiene columnas de ceros; una pestaña filtra sin mover la página.
- [x] Con `prefers-reduced-motion`, nada se mueve.
- [x] Responsive en el móvil, a 1024, 1280, 1440 y 1920 px con el menú abierto, sin scroll horizontal; claro y oscuro; axe sin infracciones.

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
