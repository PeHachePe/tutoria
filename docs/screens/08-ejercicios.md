# 08 · Ejercicios

`/docente/ejercicios?asignatura=&buscar=&dificultad=&mios=&pagina=` (banco), `/docente/ejercicios/nuevo?copia=&asignatura=` y `/docente/ejercicios/:exerciseId` (formulario), `/docente/bloques?grupo=` (bloques) · Docente y administrador · Capa 2 · 5 h (4.3), 3 h (4.3b) y 3 h (4.3c)

## Objetivo

Que el docente encuentre en el banco común los ejercicios de sus asignaturas, los cree y los edite (RF-14, RF-17, CU-05): título, enunciado y contenidos en cada idioma, dificultad, asignaturas, la función con sus parámetros, la batería de pruebas y los umbrales del tutor proactivo. Puede verlo como lo leerá el alumno antes de guardar (CU-05, 5b).

## Datos

**Bloques (4.3b, D-058):** `BlockService.listGroups()` (los grupos del docente con su asignatura; la administración, todos) y `listBlocks(groupId)` (los bloques en orden, ocultos incluidos, con sus ejercicios en orden y cuántos alumnos ha empezado cada uno). `createBlock`, `updateBlock`, `removeBlock` y `reorderBlocks`; `assign`, `updateAssignment` (oculta y fecha de entrega), `unassign` y `reorderAssignments`. Solo se borra lo que nadie empezó. Funciones puras: `moveItem()`, `toBlockFormModel()`, `toBlockDraft()`, `blockSchema` y, en `shared/`, `dueDistance()` y `withTime()`.

**Probar y traducir (4.3c, D-059):** `CodeRunnerService.check({ code, functionName, tests })` ejecuta la solución del docente en `execute` sin intento, con el detalle de todas las pruebas, y no guarda nada. `ExerciseService.translate({ from, to, texts, functionName, parameters })` pide el borrador de una traducción a la Edge Function `translate`. Las dos, solo para docentes y administración y con un límite por minuto (`staff_request`). Funciones puras: `toSolutionCheck()`, `solutionSkeleton()`, `textFieldsOf()`, `toExerciseText()`, `fillFormModel()`, `subjectsByName()` y `formActionMessage()`.

**Banco y formulario (4.3):**

- `ExerciseService.listBank(scope)`: los ejercicios de la parte del banco que se pide, del más nuevo al más antiguo, con sus asignaturas, cuántas pruebas tienen, cuántos alumnos los han empezado (en cualquier grupo) y en qué grupos del docente están asignados. Además devuelve todas las asignaturas y las del docente. Por defecto, las de sus grupos («Mis asignaturas»); también una concreta o «Todas». Quien no tiene grupos, como la administración, ve el banco entero.
- `ExerciseService.listSubjects()` y `getWithTests(id)`: el ejercicio con todas sus pruebas (también las ocultas), sus asignaturas y su uso.
- `create(draft)` y `update(id, draft)`: guardan el ejercicio, sus pruebas y sus asignaturas a la vez (`save_exercise` en Supabase). `remove(id)`: solo si nadie lo ha empezado.
- Solo su autor o la administración cambia o borra un ejercicio (RLS, D-057). Los demás lo leen y lo duplican.
- Funciones puras: `filterBank()` y `pageOf()` (banco), y `toFormModel()`, `copyFormModel()`, `toDraft()`, `previewContent()` y `exerciseSchema` (formulario).

## Contenido y disposición

**Banco** (escritorio, tablet y móvil en una columna; dos columnas de tarjetas desde `2xl`):

- Cabecera con el título y lo que es el banco.
- Filtros, en la URL: buscar (título y contenidos en cualquier idioma, y la función, sin tildes ni mayúsculas), asignatura («Mis asignaturas», cada asignatura con las del docente primero, «Todas»), dificultad, «Solo los míos» y «Archivados» (4.3d), que muestra los archivados en lugar de los demás.
- «30 ejercicios», o «5 ejercicios de 30» al filtrar, anunciado con `aria-live`.
- Una tarjeta por ejercicio: el título como enlace al formulario, los contenidos, la dificultad, sus asignaturas, `función()`, «Tuyo» o «De otro docente», las pruebas, dónde está asignado y cuántos alumnos lo han empezado. Un menú con «Editar» o «Ver», «Duplicar», «Asignar a un bloque…» y, en lo propio, «Archivar» y «Borrar» si nadie lo ha empezado; si alguien lo empezó, solo «Archivar» (4.3d). Un archivado lleva «Archivado» y, en su menú, «Desarchivar» en lugar de «Asignar» y «Archivar».
- 20 por página, con el paginador solo si hay más.
- «Nuevo ejercicio», botón flotante abajo a la derecha, como el tutor de la pantalla de trabajo.

**Formulario** (Figura 20 de la memoria; dos columnas desde `xl`):

- Volver a los ejercicios y el título: «Nuevo ejercicio», «Nuevo ejercicio a partir de otro», «Editar el ejercicio» o «Ejercicio de otro docente».
- Avisos: el de otro docente, con «Duplicar»; el de un ejercicio que ya han empezado alumnos, con «Duplicar» y «Archivar»; y el de un archivado, con «Desarchivar» (4.3d).
- **Título y enunciado:** el idioma en que se escribe y una pestaña por idioma, con su marca de traducido o de error. Cada pestaña tiene título, enunciado (con el código entre comillas invertidas) y contenidos. Debajo, «Ver como el alumno».
- **Dificultad y asignaturas:** dificultad con botones y asignaturas en un desplegable múltiple.
- **Umbrales del tutor proactivo:** dos deslizadores con su valor (fallos seguidos de la misma prueba, de 1 a 10; minutos sin actividad, de 1 a 30).
- **La función:** su nombre y sus parámetros, recomendando el inglés y sin mezclar idiomas, con el esqueleto que dará el tutor.
- **Pruebas automáticas:** cada prueba en su grupo, con los argumentos como en la llamada y el resultado esperado en JSON, «Oculta», «Quitar» y la llamada tal como la verá el alumno. «Añadir prueba».
- **Probar mi solución** (4.3c): plegado bajo las pruebas. Un editor con el esqueleto, «Ejecutar las pruebas» y los resultados como los ve el alumno, pero con el detalle también de las ocultas. Cada prueba dice «Tu solución la supera» o «no la supera» mientras siga igual.
- **Traducir con IA** (4.3c): en cada pestaña de traducción, «Traducir con IA» (o «Volver a traducir con IA»), que pide antes el título y el enunciado del original. El borrador llega con el aviso «Borrador de la IA: revísalo antes de guardar» y «Deshacer», que se va al cambiarlo.
- Un panel flotante abajo a la derecha con «Hay cambios sin guardar», «Cancelar» y «Guardar los cambios» o «Crear el ejercicio».

**Bloques** (`/docente/bloques?grupo=`, captura `08c-bloques`):

- Cabecera con el título, lo que es la pantalla y el grupo (desplegable con la asignatura, o su nombre si solo hay uno).
- Una tarjeta por bloque: asa para arrastrar (no en el móvil), título en su idioma, cuántos ejercicios tiene, si está oculto y, hasta que se abre, cuándo («Se abre el lun 23 nov, 09:00 · en 8 días», 4.3d), «Visible» y un menú con «Editar el bloque», «Añadir ejercicios», «Fecha de entrega para todo el bloque», «Subir», «Bajar» y «Borrar» (desactivado si alguien ha empezado alguno de sus ejercicios).
- Dentro, sus ejercicios en orden: asa, número, título (enlace al formulario), quién lo ha empezado, «Archivado» si lo está, dificultad, fecha de entrega («mié 18 nov, 23:59 · en 3 días» o «Sin fecha de entrega»), mostrar u ocultar y un menú con «Subir», «Bajar», «Mover a otro bloque» (un submenú con los demás bloques del grupo; desactivados los que ya lo tienen) y «Quitar del bloque». Debajo, «Añadir ejercicios».
- «Nuevo bloque», botón flotante abajo a la derecha.
- Diálogos: el del bloque (título, idioma en que se escribe, títulos en los otros idiomas, «Oculto para los alumnos» y, opcional, el día y la hora en que se abre a los alumnos), «Añadir ejercicios» (el banco de la asignatura del grupo o de todas, con buscador; marca los que ya están y en qué otros bloques), la fecha de entrega (día y hora, «Quitar la fecha») y, desde el banco, «Asignar a un bloque…» (grupo y bloque).
- El alumno ve la fecha en su catálogo («Entrega: vie 20 nov, 23:59 · en 5 días») hasta que entrega.

## Interacciones

- **Ordenar bloques y ejercicios:** arrastrando o con «Subir» y «Bajar»; se ve al momento, se anuncia («Bloque «Tema 2» en el lugar 1 de 8») y vuelve atrás si no se puede guardar.
- **Crear un bloque:** va al final, y la página baja hasta él con el foco en su título.
- **Quitar un ejercicio:** sin preguntar, con «Deshacer», que lo devuelve a su sitio con su fecha y su visibilidad. **Borrar un bloque:** pregunta antes y dice cuántos ejercicios salen con él.
- **Fecha de entrega:** sin hora, a las 23:59; el día se escribe en el orden del idioma («25/11/2026»).
- **Fecha de apertura** (4.3d): sin hora, a las 0:00. Hasta ese momento, el alumno no ve el bloque ni sus ejercicios, como si estuviera oculto (lo hace cumplir la RLS); el docente lo ve con «Se abre el…».
- **Mover a otro bloque** (4.3d): con el submenú (va al final) o arrastrándolo a otro bloque (al sitio donde se suelta; un bloque que ya lo tiene no lo acepta). También si alguien lo ha empezado: los intentos van con él. Se anuncia («… en «Repaso final», en el lugar 3 de 3»), vuelve atrás si no se puede guardar y el aviso tiene «Deshacer».

- **Buscar y filtrar:** cambian la URL sin llenar el historial y vuelven a la página 1. Solo la asignatura pide datos al servidor; mientras llegan, se quedan los filtros y la lista con una barra fina encima.
- **Quitar los filtros:** conserva la asignatura. **Buscar en todas las asignaturas:** cuando no se encuentra nada en la asignatura elegida.
- **Cambiar de página:** el foco vuelve a la lista.
- **Duplicar:** abre el formulario nuevo con todo copiado y «(copia)» en los títulos.
- **Borrar:** pregunta antes (y dice de qué bloques saldrá), borra y lo dice con un aviso.
- **Archivar** (4.3d): sin preguntar, con «Deshacer». Sale del banco, de «Añadir ejercicios» y de «Asignar a un bloque…», pero sigue en los bloques donde ya estaba, con sus intentos. «Desarchivar» lo devuelve.
- **Nuevo ejercicio:** empieza en el idioma de la interfaz, con una prueba vacía y la asignatura que mostraba el banco.
- **Guardar:** si falta algo, marca los errores y lleva el foco al primero, abriendo su pestaña si es de otro idioma. Si va bien, «Cambios guardados» o «Ejercicio creado», y el nuevo se abre como tal.
- **Ver como el alumno:** un diálogo con la zona del enunciado de la pantalla de trabajo, en el idioma de la pestaña abierta.
- **Salir con cambios sin guardar:** pregunta antes; al cerrar la pestaña, avisa el navegador.
- **Probar mi solución:** la solución vive mientras el formulario está abierto y nunca se guarda. Se ejecuta con el botón o con Ctrl + Intro; si cambian la solución o las pruebas, los resultados dicen que son de antes y las marcas de las pruebas se van. Sin función o con pruebas mal escritas, el botón espera y dice qué corregir.
- **Traducir con IA:** el código del enunciado se queda tal cual (lo comprueba el servidor). Si la IA no responde o no respeta el código, lo dice y propone traducirlo a mano.
- **WebMCP** (`fillExerciseForm`): un agente del navegador rellena el formulario (textos en un idioma, dificultad, asignaturas por su nombre, función, parámetros, pruebas y umbrales) y recibe los errores que quedan. Nunca guarda: el docente revisa y pulsa el botón.

## Estados

- **Cargando:** esqueleto de la lista o de las dos columnas; al cambiar de asignatura, la barra fina.
- **Vacío:** «Todavía no hay ejercicios aquí», o «Ningún ejercicio con estos filtros» con «Quitar los filtros», y en los dos «Buscar en todas las asignaturas».
- **Error:** con «Reintentar»; un ejercicio inexistente o sin acceso, sin reintento, con el enlace de vuelta de la cabecera.
- **Guardando:** «Guardando…», con el error del servidor junto al botón (`role="alert"`).

## Accesibilidad

- Cada prueba es un `fieldset` con su leyenda («Prueba 2»), y los botones de icono tienen nombre propio («Acciones de «Año bisiesto»», «Quitar la prueba 2»).
- Los idiomas de las pestañas y los títulos sin traducción llevan su `lang`.
- La pestaña con errores lo dice también en texto («con errores»).
- La barra de carga solo aparece pasados 300 ms y se anuncia («Cargando los ejercicios…»).
- Al cambiar de página, el foco va a la lista.
- El resultado de «Probar mi solución» se anuncia («6 de 6 pruebas superadas»), y el aviso del borrador de la IA es un `role="status"`. Solo lo escrito en cada pestaña lleva su `lang`, no las etiquetas de la interfaz.

## Criterios de aceptación

- [x] El banco trae solo las asignaturas del docente por defecto y pide al servidor las demás.
- [x] Buscar, filtrar y paginar, en la URL y sin perder los filtros al cambiar de asignatura.
- [x] Crear, editar, duplicar y borrar; los ejercicios de otros, solo leerlos y duplicarlos.
- [x] Formulario con Signal Forms y validación junto a cada campo; pruebas con `applyEach`.
- [x] Un idioma original y pestañas de traducción, que se completan o se dejan vacías.
- [x] Parámetros con nombre, en inglés, que el tutor usa en el esqueleto.
- [x] Aviso al editar un ejercicio ya empezado y antes de salir sin guardar.
- [x] Vista previa como la verá el alumno.
- [x] Bloques: crear, titular y traducir, ordenar, ocultar y borrar lo que nadie empezó (4.3b).
- [x] Asignar ejercicios del banco a un bloque, desde Bloques y desde el banco, con orden y fecha de entrega opcional que el alumno ve en el catálogo (4.3b).
- [x] Probar la solución del docente contra las pruebas del formulario, en el servidor y sin guardarla (4.3c).
- [x] Borrador de la traducción con la IA, que conserva el código del enunciado (4.3c).
- [x] El formulario como herramienta de WebMCP, que rellena sin guardar (4.3c).
- [x] Fecha de apertura de un bloque, que la RLS hace cumplir (4.3d).
- [x] Archivar y desarchivar un ejercicio, con «Archivados» en el banco (4.3d).
- [x] Mover un ejercicio a otro bloque del grupo, con el menú o arrastrándolo, aunque esté empezado (4.3d).
- [ ] Revisión visual del autor.

## Fuera de alcance

- «Probar como alumno», con el tutor en vista previa (4.3e, propuesto).
- Copiar los bloques de un grupo en otro, para el curso siguiente o un grupo paralelo ([PENDIENTES](../PENDIENTES.md)).

## Pulido pendiente

—
