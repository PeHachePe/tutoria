# 08 · Ejercicios

`/docente/ejercicios?asignatura=&buscar=&dificultad=&mios=&pagina=` (banco), `/docente/ejercicios/nuevo?copia=&asignatura=` y `/docente/ejercicios/:exerciseId` (formulario), `/docente/bloques?grupo=` (bloques) · Docente y administrador · Capa 2 · 5 h (4.3) y 3 h (4.3b)

## Objetivo

Que el docente encuentre en el banco común los ejercicios de sus asignaturas, los cree y los edite (RF-14, RF-17, CU-05): título, enunciado y contenidos en cada idioma, dificultad, asignaturas, la función con sus parámetros, la batería de pruebas y los umbrales del tutor proactivo. Puede verlo como lo leerá el alumno antes de guardar (CU-05, 5b).

## Datos

**Bloques (4.3b, D-058):** `BlockService.listGroups()` (los grupos del docente con su asignatura; la administración, todos) y `listBlocks(groupId)` (los bloques en orden, ocultos incluidos, con sus ejercicios en orden y cuántos alumnos ha empezado cada uno). `createBlock`, `updateBlock`, `removeBlock` y `reorderBlocks`; `assign`, `updateAssignment` (oculta y fecha de entrega), `unassign` y `reorderAssignments`. Solo se borra lo que nadie empezó. Funciones puras: `moveItem()`, `toBlockFormModel()`, `toBlockDraft()`, `blockSchema` y, en `shared/`, `dueDistance()` y `withTime()`.

**Banco y formulario (4.3):**

- `ExerciseService.listBank(scope)`: los ejercicios de la parte del banco que se pide, del más nuevo al más antiguo, con sus asignaturas, cuántas pruebas tienen, cuántos alumnos los han empezado (en cualquier grupo) y en qué grupos del docente están asignados. Además devuelve todas las asignaturas y las del docente. Por defecto, las de sus grupos («Mis asignaturas»); también una concreta o «Todas». Quien no tiene grupos, como la administración, ve el banco entero.
- `ExerciseService.listSubjects()` y `getWithTests(id)`: el ejercicio con todas sus pruebas (también las ocultas), sus asignaturas y su uso.
- `create(draft)` y `update(id, draft)`: guardan el ejercicio, sus pruebas y sus asignaturas a la vez (`save_exercise` en Supabase). `remove(id)`: solo si nadie lo ha empezado.
- Solo su autor o la administración cambia o borra un ejercicio (RLS, D-057). Los demás lo leen y lo duplican.
- Funciones puras: `filterBank()` y `pageOf()` (banco), y `toFormModel()`, `copyFormModel()`, `toDraft()`, `previewContent()` y `exerciseSchema` (formulario).

## Contenido y disposición

**Banco** (escritorio, tablet y móvil en una columna; dos columnas de tarjetas desde `2xl`):

- Cabecera con el título y lo que es el banco.
- Filtros, en la URL: buscar (título y contenidos en cualquier idioma, y la función, sin tildes ni mayúsculas), asignatura («Mis asignaturas», cada asignatura con las del docente primero, «Todas»), dificultad y «Solo los míos».
- «30 ejercicios», o «5 ejercicios de 30» al filtrar, anunciado con `aria-live`.
- Una tarjeta por ejercicio: el título como enlace al formulario, los contenidos, la dificultad, sus asignaturas, `función()`, «Tuyo» o «De otro docente», las pruebas, dónde está asignado y cuántos alumnos lo han empezado. Un menú con «Editar» o «Ver», «Duplicar» y «Borrar» (solo lo propio, y desactivado si alguien lo ha empezado).
- 20 por página, con el paginador solo si hay más.
- «Nuevo ejercicio», botón flotante abajo a la derecha, como el tutor de la pantalla de trabajo.

**Formulario** (Figura 20 de la memoria; dos columnas desde `xl`):

- Volver a los ejercicios y el título: «Nuevo ejercicio», «Nuevo ejercicio a partir de otro», «Editar el ejercicio» o «Ejercicio de otro docente».
- Avisos: el de otro docente, con «Duplicar», y el de un ejercicio que ya han empezado alumnos, con «Duplicar».
- **Título y enunciado:** el idioma en que se escribe y una pestaña por idioma, con su marca de traducido o de error. Cada pestaña tiene título, enunciado (con el código entre comillas invertidas) y contenidos. Debajo, «Ver como el alumno».
- **Dificultad y asignaturas:** dificultad con botones y asignaturas en un desplegable múltiple.
- **Umbrales del tutor proactivo:** dos deslizadores con su valor (fallos seguidos de la misma prueba, de 1 a 10; minutos sin actividad, de 1 a 30).
- **La función:** su nombre y sus parámetros, recomendando el inglés y sin mezclar idiomas, con el esqueleto que dará el tutor.
- **Pruebas automáticas:** cada prueba en su grupo, con los argumentos como en la llamada y el resultado esperado en JSON, «Oculta», «Quitar» y la llamada tal como la verá el alumno. «Añadir prueba».
- Un panel flotante abajo a la derecha con «Hay cambios sin guardar», «Cancelar» y «Guardar los cambios» o «Crear el ejercicio».

**Bloques** (`/docente/bloques?grupo=`, captura `08c-bloques`):

- Cabecera con el título, lo que es la pantalla y el grupo (desplegable con la asignatura, o su nombre si solo hay uno).
- Una tarjeta por bloque: asa para arrastrar (no en el móvil), título en su idioma, cuántos ejercicios tiene y si está oculto, «Visible» y un menú con «Editar el título», «Añadir ejercicios», «Fecha de entrega para todo el bloque», «Subir», «Bajar» y «Borrar» (desactivado si alguien ha empezado alguno de sus ejercicios).
- Dentro, sus ejercicios en orden: asa, número, título (enlace al formulario), quién lo ha empezado, dificultad, fecha de entrega («mié 18 nov, 23:59 · en 3 días» o «Sin fecha de entrega»), mostrar u ocultar y un menú con «Subir», «Bajar» y «Quitar del bloque». Debajo, «Añadir ejercicios».
- «Nuevo bloque», botón flotante abajo a la derecha.
- Diálogos: el del bloque (título, idioma en que se escribe, títulos en los otros idiomas y «Oculto para los alumnos»), «Añadir ejercicios» (el banco de la asignatura del grupo o de todas, con buscador; marca los que ya están y en qué otros bloques), la fecha de entrega (día y hora, «Quitar la fecha») y, desde el banco, «Asignar a un bloque…» (grupo y bloque).
- El alumno ve la fecha en su catálogo («Entrega: vie 20 nov, 23:59 · en 5 días») hasta que entrega.

## Interacciones

- **Ordenar bloques y ejercicios:** arrastrando o con «Subir» y «Bajar»; se ve al momento, se anuncia («Bloque «Tema 2» en el lugar 1 de 8») y vuelve atrás si no se puede guardar.
- **Crear un bloque:** va al final, y la página baja hasta él con el foco en su título.
- **Quitar un ejercicio:** sin preguntar, con «Deshacer», que lo devuelve a su sitio con su fecha y su visibilidad. **Borrar un bloque:** pregunta antes y dice cuántos ejercicios salen con él.
- **Fecha de entrega:** sin hora, a las 23:59; el día se escribe en el orden del idioma («25/11/2026»).

- **Buscar y filtrar:** cambian la URL sin llenar el historial y vuelven a la página 1. Solo la asignatura pide datos al servidor; mientras llegan, se quedan los filtros y la lista con una barra fina encima.
- **Quitar los filtros:** conserva la asignatura. **Buscar en todas las asignaturas:** cuando no se encuentra nada en la asignatura elegida.
- **Cambiar de página:** el foco vuelve a la lista.
- **Duplicar:** abre el formulario nuevo con todo copiado y «(copia)» en los títulos.
- **Borrar:** pregunta antes (y dice de qué bloques saldrá), borra y lo dice con un aviso.
- **Nuevo ejercicio:** empieza en el idioma de la interfaz, con una prueba vacía y la asignatura que mostraba el banco.
- **Guardar:** si falta algo, marca los errores y lleva el foco al primero, abriendo su pestaña si es de otro idioma. Si va bien, «Cambios guardados» o «Ejercicio creado», y el nuevo se abre como tal.
- **Ver como el alumno:** un diálogo con la zona del enunciado de la pantalla de trabajo, en el idioma de la pestaña abierta.
- **Salir con cambios sin guardar:** pregunta antes; al cerrar la pestaña, avisa el navegador.

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
- [ ] Revisión visual del autor.

## Fuera de alcance

- Fecha de apertura de un bloque, duplicar un bloque en otro grupo y archivar ejercicios (4.3d, propuesto).
- «Traducir con IA», «Probar mi solución», «Probar como alumno» y el formulario como herramienta de WebMCP (4.3c).
- Archivar un ejercicio con intentos para que deje de salir en el banco ([PENDIENTES](../PENDIENTES.md)).

## Pulido pendiente

—
