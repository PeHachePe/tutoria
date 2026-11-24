# 13 · Ayuda guiada

Botón «Ayuda» en la barra de cada área · Todos los perfiles · Transversal · 7.0a (la base, el panel y el alumno), 7.0b1 (la base del personal, el menú lateral y el docente) y 7.0b2 (la administración y «¿Cómo se hace…?» del personal) · §2.12 · D-080

## Objetivo

Que cada perfil aprenda a usar TutorIA sobre la propia aplicación: una bienvenida la primera vez, unos primeros pasos que se hacen de verdad, «¿Cómo se hace…?» para volver a cualquier tarea, el recorrido de cada pantalla pieza a pieza y una baliza junto a cada pieza. Todo, desde un único botón, y sirve también de manual (7.0c).

## Datos

- **`user_guide_state`** (una fila por usuario, solo de su dueño): `state` (`jsonb`) con la versión de la bienvenida vista (`welcome`), las tareas hechas con su fecha (`done`: id → fecha) y si ocultó los primeros pasos (`firstStepsHidden`). Una comprobación limita su forma (solo esas tres claves, con sus tipos) y su tamaño (8 KB). Ni el docente ni la administración la leen: por eso es una tabla y no una columna de `app_user`, que ellos sí leen (D-080).
- **`AuthService`:** `guideState()` lee la fila (vacía si no existe) y `saveGuideState()` la escribe entera (`upsert`). Versión simulada y con Supabase.
- **`GuideStore`** (`core/guide/`, global): el estado guardado, leído con `resource()` por usuario, el progreso y la pantalla abierta. Guarda al momento lo que cambia, de uno en uno y siempre entero; si el servidor falla, sigue valiendo en la visita y viaja con el siguiente cambio.
- **Hecha por los datos:** cada perfil da sus hechos (`student/student-guide.ts`). Los del alumno salen de `ExerciseService.listAssigned()`, sin consultas nuevas: ha empezado un ejercicio, ha ejecutado pruebas, ha pedido una pista, ha entregado, tiene un ejercicio abierto o más de una asignatura; y las páginas donde empieza cada tarea (su siguiente ejercicio primero, uno entregado, uno con varios intentos). Se leen al entrar en el área, al abrir el panel y al acabar cada tarea.
- **Los hechos del docente** (`teacher/teacher-guide/teacher-facts.ts`), sin consultas nuevas y solo con lo suyo (D-093): una clase suya o con una asignatura suya (`ManagedGroup.mine`, de `GroupService.listClasses()`), una asignatura suya con alumnado, un ejercicio suyo sin archivar (`createdBy`, de `ExerciseService.listBank()`), un bloque y una asignación en sus grupos (`BlockService.listBlocks()` de cada grupo suyo, en paralelo). Los lugares: Grupos, Bloques (su grupo con bloques primero), Ejercicios, el formulario nuevo, En vivo e Histórico.
- **El perfil** tiene un id y dice sus primeros pasos en orden (`firstSteps`): una misma tarea puede ser primer paso de dos perfiles, en otro orden. El del personal se elige por el rol, y `GuideStore.use()` con el mismo perfil trae el menú del layout nuevo sin volver a leer los hechos (D-093).
- **Funciones puras** (`guide-progress.ts`): el progreso de los primeros pasos, el orden del panel, el filtro sin acentos, dónde empieza una tarea, si se puede hacer y lo que se guarda.

## Contenido y disposición

### Botón «Ayuda»

- En la barra superior, a la derecha, el primero de sus botones: Ayuda, Tema, Idioma y el menú. Icono `help`, con su nombre y su _tooltip_ «Ayuda».
- Mientras quedan primeros pasos, un punto del color primario en la esquina, como el de «respuesta nueva» del tutor. Su nombre lo dice: «Ayuda: 2 de 4 primeros pasos hechos».
- En el alumno desde el 7.0a y en el docente desde el 7.0b1; la administración lo tendrá con sus tareas (7.0b2). En el personal, entre el nombre de la aplicación y el tema.

### Panel

Un diálogo lateral a la derecha, a toda la altura y de 26 rem de ancho; en el móvil, a pantalla completa. Cabecera con la mascota, el título «Ayuda» y «Cerrar la ayuda». De arriba abajo:

1. **Esta pantalla** (lo más útil donde se está, arriba): dos tarjetas iguales, «Recorrer esta pantalla» (cada pieza, una a una) y «Ayuda de esta pantalla» (un punto junto a cada pieza; «Ocultar…» si ya están), y debajo «Ver la bienvenida».
2. **Primeros pasos** (mientras no estén todos hechos ni ocultos): «2 de 4» y una barra de progreso; una fila por tarea con su estado (círculo vacío o marca) y su título. Una fila es un botón que la empieza, también si está hecha. Debajo, «Ya sé usarla», que oculta la sección. Al hacer el último, la mascota lo celebra («¡Ya sabes lo básico!») hasta pulsar «Entendido».
3. **¿Cómo se hace…?:** un campo «Busca una tarea» y la lista. Cada fila es un botón con el título por nombre, una línea con lo que consigue (su descripción) y, si ya se hizo, «Hecha». Las de la pantalla abierta, primero. Mientras se ven los primeros pasos, la lista no los repite, aunque el filtro los encuentra. Una tarea que no se puede hacer todavía no se oculta: sale desactivada con su motivo («No disponible: Cuando hayas entregado un ejercicio»).

### Globo de las tareas

- **Aspecto** (`src/styles/guide.css`, con tokens): la superficie más clara del tema (blanca en el claro), una línea fina y una sombra suave; la flecha, un triángulo que apunta a la pieza; la mascota a la izquierda del título, alegre en el último paso; el texto y, en los pasos de acción, la instrucción en una franja con un punto que late («Pulsa «Entregar»»).
- **Pie:** «Paso 2 de 5», «Anterior», «Siguiente» (relleno; «Terminar» en el último) y «Cerrar» (×). Los pasos de acción no tienen «Siguiente»: avanzan solos. En el último paso de un primer paso o de la bienvenida, «Siguiente: Ejecutar las pruebas» (relleno) junto a «Terminar» (con borde) empieza el siguiente primer paso pendiente, si se puede hacer.
- **Oscurecido:** la pantalla se oscurece con el velo del tema salvo la pieza, que conserva su forma con el radio de las esquinas.
- **«Paso N de M»** cuenta solo los pasos que se ven a ese ancho: un paso opcional cuenta si su pieza está (7.0b1).
- **Encima de todo:** el globo va en la capa superior del navegador, como los diálogos y menús de Material, para que ninguno lo tape; en un diálogo tan alto que no le deja sitio al lado, va a la esquina inferior izquierda y deja libres sus botones (7.0b1, D-095).

### Balizas

- Un punto del color primario que late, con un aro claro para verse sobre cualquier fondo (la barra verde incluida), en la esquina donde empieza cada pieza, como se lee. Las piezas sin tamaño (el indicador de guardado sin cambios) no llevan.
- Al pulsarlo, su globo: el título de la pieza, qué hace, «Ocultar la ayuda» y «Entendido».
- **Sin oscurecer la pantalla:** es ayuda sobre la marcha; la pantalla se ve entera, para saber dónde está cada punto, y se puede seguir usando. El oscurecido es de los recorridos y las tareas.
- Esc con un globo abierto lo cierra; sin ninguno, las apaga. También «Ocultar la ayuda» y cambiar de pantalla.

## Catálogo de tareas

Cada tarea tiene un id estable (en inglés), su perfil, título, una línea de lo que consigue, palabras clave, la pantalla donde ocurre, dónde empieza, sus pasos y, si la hay, su condición de hecha. Los textos de cada globo están en `student/student-guide.ts`, con `$localize`, y en los tres idiomas.

Reglas comunes:

- **Dónde empiezan:** si una tarea es de la pantalla de trabajo y el alumno está en otra, se abre su siguiente ejercicio (el que propone el catálogo) o el que la tarea necesita (uno entregado, uno con varios intentos). Las de la barra empiezan donde se esté.
- **Piezas que dependen del ancho:** en el móvil, la pantalla de trabajo va en pestañas, así que la tarea pide antes abrir la pestaña («Abre la pestaña «Tutor»»). En la tableta, o con el código ampliado, el tutor está plegado en la mascota, y la tarea pide abrirla. Son pasos que se saltan solos donde su pieza no existe o no se ve.
- **Menús y diálogos de Material:** se resalta el menú o el diálogo entero y el globo va a su lado, sin tapar sus otras opciones; la tarea avanza solo al pulsar la opción que pide. Esc cierra el diálogo y la tarea vuelve al paso que lo abrió.
- **Un interruptor que muestra más opciones** (la voz): si está apagado, el globo ofrece «Activar la voz», que lo enciende y sigue por sus opciones; «Siguiente» continúa sin ellas.
- **Datos de verdad:** si un paso crea algo o es definitivo (entregar, practicar de nuevo), el globo lo dice antes.

### Alumno

**Bienvenida** (versión 1; después del aviso de datos y solo en el catálogo: si entra por un enlace directo a un ejercicio, espera a que llegue a él). Cuenta como vista al terminar o al saltarla, no al empezar: quien cambia de idioma a mitad la vuelve a ver en el suyo. Siete pasos, los botones de la barra seguidos y en su orden:

1. «¡Hola, {nombre}!» (centrado): quién es y que se puede saltar.
2. La ayuda: los primeros pasos, cómo se hace cada cosa y el recorrido de cada pantalla.
3. Claro u oscuro (el botón del tema, que se puede probar ahí mismo).
4. Tu idioma (el botón del idioma, que se puede cambiar ahí mismo).
5. Tu menú: los ajustes, los datos registrados y «Cerrar sesión».
6. Tus asignaturas (si hay más de una).
7. Por dónde seguir (la tarjeta del siguiente ejercicio, si la hay), con «Siguiente: Empezar un ejercicio».

**Primeros pasos:**

| Id               | Título                   | Pasos (las piezas, por orden)                                                                                                                                              | Hecha si…               |
| ---------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `start-exercise` | Empezar un ejercicio     | Catálogo: el botón de «Tu siguiente ejercicio» (**acción**) · el enunciado · (móvil: pestaña «Código») · el editor                                                         | ha empezado alguno      |
| `run-tests`      | Ejecutar las pruebas     | (móvil: pestaña «Código») · «Ejecutar pruebas» (**acción**; con su atajo) · los resultados                                                                                 | ha ejecutado alguna vez |
| `ask-hint`       | Pedir una pista al tutor | (móvil: pestaña «Tutor»; tableta: la mascota) · «Pedir pista» (**acción**) · el nivel de las pistas · el campo de la pregunta                                              | ha pedido alguna pista  |
| `submit`         | Entregar                 | (móvil: pestaña «Código») · «Entregar»: si aún no se puede, el globo lo explica y la tarea acaba; si se puede, **acción** · el diálogo (**acción**) · la nota de entregado | ha entregado alguno     |

**Recorrer esta pantalla** (una tarea por pantalla, hecha de sus balizas y con sus mismos textos): «Conocer tus ejercicios» (el catálogo y, al final, la barra), «Conocer la pantalla de trabajo» (abre por el camino las pestañas y el tutor plegado), «Conocer tus ajustes» y «Conocer tus datos registrados».

**¿Cómo se hace…?** (además): cambiar el idioma · cambiar el tema · cambiar de asignatura (con más de una) · ver por qué falla una prueba · preguntar al tutor con tus palabras · escuchar, dictar o llamar al tutor · configurar la voz del tutor (activarla, su voz, la velocidad, leer las respuestas, interrumpir hablando y dónde se reconoce tu voz) · cambiar las reacciones · vestir a la mascota · que el tutor te escriba solo, o no · ajustar la pantalla de trabajo · ordenar tu código · practicar de nuevo un ejercicio entregado · volver a un intento anterior · pasar al siguiente ejercicio · ver qué datos se registran · cerrar sesión.

**Balizas** (cada pieza de cada pantalla; las de la barra, en todas):

- **Barra:** TutorIA, Ejercicios, Ayuda, Tema, Idioma, Tu menú.
- **Catálogo:** por dónde seguir y su botón, todo entregado, asignaturas, progreso, contadores, temas, número, dificultad, estado, fecha de entrega, listo para entregar, pistas, repeticiones y el botón de cada ejercicio.
- **Trabajo:** volver, dónde estás, dificultad, cómo va, intentos, plegar el enunciado, el enunciado, los ejemplos, los dos divisores, guardado, formatear, ampliar, el editor, ejecutar, entregar, los resultados, preguntar por un fallo, la nota de práctica, la de entregado, practicar de nuevo, siguiente ejercicio; y del tutor, plegado, el nivel de las pistas, llamar, fijo o flotante, minimizar, la conversación, las preguntas sugeridas, escuchar, pedir pista, la pregunta, dictar y enviar.
- **Ajustes:** tema, idioma, mascota, reacciones, emojis animados, probar una reacción, el tutor que escribe solo, la voz y, con ella activada, la voz del tutor, la velocidad, leer las respuestas, interrumpir hablando y dónde se reconoce tu voz; privacidad.
- **Datos registrados:** lo que se registra, lo que nunca, para qué, quién lo ve, servicios externos y «Tú decides».

### Docente (7.0b1)

Con las palabras de la interfaz: el docente crea **clases** (con su curso), cada una con sus **asignaturas** (cada asignatura de una clase es un grupo, con sus desdobles), y matricula en la clase. No da de alta alumnos: solo matricula cuentas que ya existen, que crea la administración.

**Menú lateral:** un paso `inSideMenu` señala una entrada del menú. En el móvil, `TourRunner` lo abre antes con la función que da `StaffLayout` y lo vuelve a abrir si Esc o el fondo lo cierran; en el raíl (escritorio plegado) se señala el icono, sin desplegarlo (D-094).

**Bienvenida** (versión 1, en En vivo; diez pasos):

1. «¡Hola, {nombre}!» (centrado): quién es y que se puede saltar.
2. La ayuda · 3. Claro u oscuro (se puede probar) · 4. Tu idioma (se puede cambiar) · 5. Tu menú: la barra, seguida y en su orden.
3. El menú lateral entero, y su botón para plegarlo o abrirlo.
4. En vivo · 8. Ejercicios · 9. Grupos (sus entradas del menú). Bloques e Histórico se explican en sus balizas.
5. Por dónde seguir (centrado), con «Siguiente: Crear tu clase y matricular a su alumnado» (o el primer paso pendiente).

**Primeros pasos** (cada uno avisa antes de crear algo y dice cómo deshacerlo):

| Id                | Título                                    | Pasos (las piezas, por orden)                                                                                                                                                                                                                                                                                                                                                                                                            | Hecha si…                        | Necesita       |
| ----------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------- |
| `create-class`    | Crear tu clase y matricular a su alumnado | _menú_ Grupos (**acción**) · «Añadir clase» (**acción**; aviso) · _diálogo_ la clase (**acción**: «Crear y elegir asignaturas»; si ya existe, unirse) · _diálogo_ sus asignaturas, que se abre solo (**acción**: «Añadir») · «Matricular en la clase» (**acción**) · _diálogo_ las formas de matricular: sin clase este curso, pegar una lista, de otra clase, buscar (**acción**: «Matricular»; solo cuentas que ya existen) · la tabla | una asignatura suya con alumnado | —              |
| `create-block`    | Crear un bloque                           | _menú_ Bloques (**acción**) · el grupo · «Nuevo bloque» (**acción**; aviso) · _diálogo_ el bloque (**acción**: crearlo) · la lista de bloques                                                                                                                                                                                                                                                                                            | un bloque en sus grupos          | una clase suya |
| `add-exercise`    | Añadir un ejercicio al banco              | _menú_ Ejercicios (**acción**) · «Nuevo ejercicio» (**acción**, navega) · título y enunciado · dificultad y asignaturas · la función · las pruebas · «Probar mi solución» · «Crear el ejercicio» (aviso: se archiva después; si aún no se puede, el globo dice qué falta)                                                                                                                                                                | un ejercicio suyo                | —              |
| `assign-exercise` | Asignarlo a un bloque                     | _menú_ Bloques (**acción**) · un bloque · «Añadir ejercicios» (**acción**) · _diálogo_ buscar y marcar (**acción**: añadir) · los ejercicios del bloque, con su fecha y su menú                                                                                                                                                                                                                                                          | una asignación en sus grupos     | un bloque      |
| `follow-live`     | Seguir la clase en vivo                   | _menú_ En vivo (**acción**) · grupo y bloque · en directo o fuera de clase · dónde está la clase · ritmo de la clase (en directo) · el alumnado y sus pestañas · la tabla: cada fila abre su detalle                                                                                                                                                                                                                                     | al terminar                      | una asignación |

**Recorrer esta pantalla** (una por pantalla, hecha de sus balizas): en vivo (con la barra y el menú, como el catálogo del alumno), detalle del intento, ejercicios, formulario, bloques, grupos e histórico.

**Balizas** (cada pieza; las de la barra y el menú, en todas):

- **Barra y menú:** el botón del menú, TutorIA, Ayuda, Tema, Idioma, Tu menú; el menú y cada entrada (En vivo, Histórico, Ejercicios, Bloques, Grupos).
- **En vivo:** en directo o fuera de clase, grupo, bloque, dónde está la clase, ritmo de la clase, lo que necesita atención, el alumnado: sus pestañas, buscar y la tabla.
- **Detalle del intento:** volver, el alumno y su estado, ahora o dónde lo dejó, pruebas, la última ayuda del tutor, el resumen, «Atendido», evolución, la línea temporal y su filtro, el código.
- **Ejercicios (banco):** nuevo ejercicio, buscar, asignatura, dificultad, «Solo los míos», archivados, el contador, cada tarjeta y su menú.
- **Formulario:** volver, probar como alumno, título y enunciado (con su idioma), contenidos, dificultad y asignaturas, umbrales del tutor proactivo, la función, las pruebas, «Probar mi solución», cancelar y guardar.
- **Bloques:** curso y grupo, copiar de otro grupo, seleccionar, «Nuevo bloque», cada bloque (arrastrar, visible, su menú, añadir ejercicios) y cada ejercicio (su fecha, ocultarlo, su menú).
- **Grupos:** curso, clase y su menú, añadir clase, el alumnado (filtrar, evaluación final, matricular en la clase, añadir asignatura, exportar) y la tabla (cada asignatura en su columna y su menú, cada alumno y el suyo).
- **Histórico:** curso y grupo, evolución del grupo, cada bloque y sus cifras.

**Pantallas vacías:** Bloques, En vivo e Histórico sin ninguna clase dicen que el docente puede crear la suya y llevan «Crear tu clase», que empieza su tarea guiada.

### Administración (7.0b2)

- **Bienvenida** (en Usuarios): los mismos pasos de la barra y el menú, Usuarios, Sistema, la sección «Docencia» (entra en todas las pantallas del docente), el Muestrario (qué es, para que no se tome por un fallo) y, al final, «Siguiente: Dar de alta un usuario».
- **Primeros pasos,** los de la cuenta del tribunal, hechos solo al terminar su recorrido: dar de alta un usuario (una cuenta no se borra: se desactiva) · crear una clase y matricular (la del docente, con el mismo id: se hace una vez) · probar el proveedor de IA (gasta una llamada) · seguir la clase en vivo.
- **¿Cómo se hace…?, recorridos y balizas** de Usuarios y Sistema, y todas las del docente.

## Interacciones

- **Botón «Ayuda»:** abre el panel, con el mismo `GuideStore` que el botón; al cerrarlo, el foco vuelve al botón.
- **Empezar una tarea** (una fila o una tarjeta): el panel se cierra; la tarea espera a que no quede ningún diálogo abierto, navega si hace falta y espera a su primera pieza (hasta 8 s). Una pieza opcional que no está se salta.
- **Cerrar la tarea** (×, Esc fuera de un diálogo o irse a otra pantalla que la tarea no abrió): acaba sin darse por hecha. El foco vuelve a donde estaba: el botón «Ayuda» si empezó en el panel.
- **Terminar:** se guarda como hecha (con la fecha) y los hechos se leen de nuevo.
- **«Ya sé usarla»:** oculta los primeros pasos, se guarda y el punto del botón desaparece.
- **Filtro:** por título y palabras clave, sin distinguir acentos ni mayúsculas, mientras se escribe; sin resultados, «Ninguna tarea coincide con «…»».
- **Ayuda de esta pantalla:** cierra el panel, enciende las balizas y lleva el foco a la primera.

## Estados

- **Cargando:** el botón aparece desde el principio; el punto y la bienvenida esperan a tener el estado guardado y los hechos.
- **Sin primeros pasos pendientes:** sin punto; en el panel, la celebración hasta pulsar «Entendido».
- **Sin ejercicios asignados:** las tareas que necesitan uno, desactivadas con su motivo; la bienvenida salta el paso de la tarjeta y no ofrece «Empezar un ejercicio».
- **Error al leer el estado:** el panel funciona igual (nada hecho, nada visto), pero la bienvenida no se lanza, para no repetirla por un fallo de red.
- **Error al guardar:** nada que decir al usuario: vale en la visita y viaja con el siguiente cambio.

## Accesibilidad

- **Panel:** diálogo con título, que guarda el foco, se cierra con Esc y lo lleva al título al abrirse. Cada fila es un botón con el título por nombre (más «, hecha») y su resumen o su motivo como descripción (`aria-describedby`). La barra de progreso tiene su nombre.
- **Globo:** un diálogo con título y descripción (driver.js). El foco va a «Siguiente» o, en los pasos de acción, al globo; el tabulador recorre el globo y la pieza resaltada.
- **Pasos dentro de un diálogo:** manda la trampa de foco del diálogo (las dos a la vez atascaban el tabulador); driver.js lee el globo en su región `aria-live`.
- **Atributos de la pieza:** driver.js le pone `aria-haspopup`, `aria-expanded` y `aria-controls`; donde su rol no los admite (un diálogo), `TourRunner` los quita.
- **Balizas:** botones «Ayuda: Ejecutar las pruebas», con `aria-haspopup="dialog"`, de 28 px (WCAG 2.5.8) y con el foco visible. Su globo, un diálogo con su título; Esc lo cierra y devuelve el foco a la baliza.
- **Sin animaciones** con `prefers-reduced-motion`: sin transiciones entre pasos ni latido.
- **Colores:** con tokens, en claro y oscuro.

## Prueba de driver.js con Material (7.0a)

Hecha el 23/11/2026 en la pantalla de trabajo, con datos simulados, antes de construir; lo marcado con (después) salió al construir.

| Qué                                     | Resultado                                                                                                                                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capas                                   | Con `allowedElements: '.cdk-overlay-container'`, los diálogos y menús de Material quedan por encima del oscurecido.                                                                                                           |
| Clics en la pieza (después)             | **Fallo:** driver.js da `pointer-events: auto` a ese contenedor, que ocupa toda la pantalla, y tapaba la pieza resaltada. **Arreglo:** el contenedor vuelve a `none` en `guide.css`; sus paneles siguen recibiendo clics.     |
| Foco en un paso normal                  | El tabulador recorre el globo y la pieza resaltada, así que la acción se hace con teclado.                                                                                                                                    |
| Foco dentro de un diálogo               | **Fallo:** las dos trampas de foco se pisan y el tabulador se queda en el último botón. **Arreglo:** `allowPageInteraction` en esos pasos: manda el diálogo, y driver.js lee el globo en voz alta.                            |
| Esc con el diálogo abierto              | Cierra el diálogo, no la tarea; Material devuelve el foco a «Entregar».                                                                                                                                                       |
| La pieza desaparece                     | **Fallo:** el globo se quedaba señalando el hueco. **Arreglo:** `onElementMissing: 'previousAction'` vuelve al paso que lo abrió, tras 300 ms.                                                                                |
| Menús (después)                         | **Fallo:** con un menú abierto, se resaltaba su primera opción y el globo tapaba las demás. **Arreglo:** se resalta el menú o el diálogo entero y solo cuenta el clic en la opción de la tarea.                               |
| Botones propios del globo (después)     | **Fallo:** driver.js se queda con cualquier clic en un botón con sus clases. **Arreglo:** los botones propios («Siguiente: …», «Entendido», «Activar la voz», «Ocultar la ayuda») llevan clases propias con el mismo aspecto. |
| Pasos que solo explican (después)       | driver.js bloquea los clics en su pieza; los que la dejan usar (el tema, el idioma, un interruptor) lo dicen (`interactive`, `turnOn`).                                                                                       |
| Balizas                                 | Botones con `aria-haspopup="dialog"`. Su nombre era el título del globo y coincidía con el del botón real: se cambia a «Ayuda: …». Van al final de la página, así que «Ayuda de esta pantalla» lleva el foco a la primera.    |
| Balizas en la esquina derecha (después) | Se amontonaban en el borde de las piezas anchas y no se veían en la barra verde: van en la esquina donde empieza cada pieza, con un aro claro.                                                                                |
| Flecha del globo (después)              | Un color en las cuatro caras de la flecha la volvía un cuadrado: solo se colorea la que apunta a la pieza.                                                                                                                    |
| Móvil (375 px)                          | El globo se coloca donde cabe. Una pieza de otra pestaña se alcanza con un paso «Abre la pestaña «Tutor»», que en escritorio se salta solo.                                                                                   |
| Lector de pantalla                      | El árbol de accesibilidad es el esperado. La prueba con un lector real queda para el recorrido del 7.1 (NVDA).                                                                                                                |

## Prueba del menú lateral con driver.js (7.0b1)

Hecha el 24/11/2026 en En vivo, con datos simulados, antes de construir: driver.js cargado a mano en la página con las opciones de `TourRunner`.

| Qué                        | Resultado                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Móvil (`over`), foco       | Sin `allowPageInteraction`, manda el foco de driver.js: Material lo pone en la página actual al abrir, pero el primer Tab vuelve al globo. El clic en la entrada navega y el menú se cierra solo.            |
| Móvil, capas               | El fondo del menú queda bajo el oscurecido: se ve algo más oscuro, sin estorbar.                                                                                                                             |
| Esc o el fondo             | **Fallo:** cierran el menú y el globo se queda señalando una entrada que ya no se ve. **Arreglo:** `TourRunner` lo abre en cada paso `inSideMenu` y lo vuelve a abrir si se cierra.                          |
| Raíl (escritorio plegado)  | El globo junto al icono se entiende con su título: no hace falta desplegarlo ni tocar la preferencia guardada.                                                                                               |
| Animación (después)        | **Fallo:** medido a mitad de la animación de abrirse, el recuadro de la entrada quedaba desplazado. **Arreglo:** el menú avisa cuando acaba de abrirse y driver.js vuelve a medir.                           |
| Volver a abrirlo (después) | **Fallo:** tras Esc, poner la señal del menú otra vez a `true` no lo abría (la detección de cambios no veía el paso por `false`). **Arreglo:** `StaffLayout` lo abre con `MatSidenav.open()`.                |
| Diálogos altos (después)   | **Fallo:** el diálogo de asignaturas, en la capa superior del navegador, tapaba el globo. **Arreglo:** el globo sube a esa capa; si no cabe al lado del diálogo, va a la esquina inferior izquierda (D-095). |

## Criterios de aceptación

- [x] Un alumno nuevo ve la bienvenida una sola vez, también si entra desde otro equipo, y nunca encima del aviso de datos.
- [x] Hace sus primeros pasos sobre la pantalla real, con teclado y en el móvil (con lector de pantalla, en el 7.1).
- [x] Puede repetir cualquier tarea desde «¿Cómo se hace…?» y filtrarlas.
- [x] Cada pieza de cada pantalla del alumno tiene su baliza y su paso en «Recorrer esta pantalla».
- [x] Lo que se guarda solo lo lee su dueño (pgTAP).
- [x] La pantalla de datos registrados lo cuenta.
- [x] Revisión visual del autor.
- [x] Un docente nuevo prepara su primera clase guiado de principio a fin (crear la clase, sus asignaturas y matricular), también en el móvil con el menú lateral (7.0b1).
- [x] Cada pieza de cada pantalla del docente tiene su baliza y su paso en «Recorrer esta pantalla» (7.0b1).
- [x] Las pantallas vacías de un docente sin clases llevan a «Crear tu clase» (7.0b1).
- [ ] La administración y «¿Cómo se hace…?» del personal (7.0b2).

## Fuera de alcance

- Un atajo de teclado global y una paleta de órdenes (D-080).
- Vídeos o animaciones grabadas: la ayuda es la propia aplicación.

## Pulido pendiente

- Al abrir una baliza, su globo puede tapar la pieza que explica: se propuso resaltarla y poner el globo a su lado, como en los recorridos (`PENDIENTES.md`).
- La mascota del globo lleva los accesorios por defecto, no los que el alumno eligió (`PENDIENTES.md`).
