# 11 · Grupos y matrícula

`/docente/grupos?clase=` · Docente y administrador · Capa 2 · 2 h (5.2b, rehecha en su revisión), el 5.2c (preparar un curso nuevo) y el 5.2d (la clase compartida)

## Objetivo

Que el docente cree sus grupos, cada uno de una asignatura, y matricule o dé de baja a sus alumnos (RF-16, CU-07), y que la administración gestione todos los grupos y cambie su docente. Sustituye a `/admin/grupos` (2.2).

Desde el 5.2d (D-081), la pantalla gira alrededor de la **clase** del centro («1.º DAW A · 2026/27»), que existe una sola vez y comparten sus docentes. Cada asignatura de la clase es un grupo de su docente. El alumnado es de la clase, y cada grupo puede dejar fuera a alguien (una convalidada) o tener a alguien de otra clase. Un grupo con nombre es un **desdoble** de su asignatura («Desdoble inglés»), con su propio alumnado; puede crearse antes o después del grupo de toda la clase. Preparar un curso nuevo (5.2c) sigue siendo rápido: se duplica la clase con los bloques.

## Datos

- `GroupService` (5.2a, 5.2d):
  - Clases: `listClasses()` (aquellas en las que el usuario da clase o que creó; todas para el administrador), `listAllClasses()` (las del centro, con todos sus grupos, para unirse a una), `createClass(clase, asignaturas, docente)` (crea la clase o se une a la que ya existe con ese nombre y curso; un grupo por asignatura), `saveClass()`, `removeClass()` y `duplicateClass(clase, nombre y curso, grupos, opciones)`.
  - Grupos: `addGroup(clase, asignatura, nombre del desdoble, docente)`, `saveGroup()` (el nombre del desdoble y, para la administración, el docente) y `removeGroup()`.
  - Alumnado: `listRoster(clase)` (el de la clase y el de sus grupos, con los grupos de cada uno), `listCandidates(clase)` (el alumnado activo sin clase en su curso), `matchStudents(clase, líneas)` (los alumnos que nombra una lista pegada), `searchStudents(clase o grupo, texto)`, `enrollInClass()`, `removeFromClass()`, `enroll(grupo, alumnos)`, `unenroll(grupo, alumno)` y `listTeachers()`. La pantalla envía los elegidos en peticiones de 50 (`inBatches()`).
- `ExerciseService.listSubjects()` para el desplegable de la asignatura.
- Sin store: el estado es de la pantalla (`resource()`), que se recarga tras cada acción. El alumnado de la clase, con su propio `resource()`, se pide al elegirla.
- Funciones puras:
  - De las clases y los grupos: `labelClasses()`, `subjectLine()`, `sortClassGroups()`, `nextSplitLabel()` («Desdoble N»), `subjectInitials()` (las siglas: PB, DWEC), `rosterColumns()`, `rosterCsv()` y `rosterFileName()`; `downloadCsv()` en `shared/`.
  - De los formularios: `classSchema()`, `toClassDraft()`, `existingClass()`, `existingEntry()`, `classSubjectsOf()`, `hasWholeGroup()`, `groupSchema()`, `toGroupDraft()`, `teacherChoices()`, `toDuplicateFormModel()`, `duplicateSchema()` y `toDuplicateOptions()`.
  - Del curso y las fechas: `schoolYearOf()`, `shiftSchoolYear()`, `schoolYearChoices()`, `nextSchoolYear()`, `schoolYearShiftDays()` y `shiftDate()` (en `data/`), y `datesNote()` (en `shared/`).
  - Del resto: `filterStudents()` (el filtro del panel), `groupActionMessage()`, y `groupName()` y `groupTitle()` (en `data/`, los nombres de un grupo en las demás pantallas).

## Contenido y disposición

Escritorio, tablet y móvil, en un solo panel que llega hasta el final de la ventana: la tabla de matrícula, en la que cada asignatura es una columna (con 20 asignaturas, la tabla se desplaza en horizontal) y que ocupa todo el alto que deja su barra.

- Cabecera: «Grupos y matrícula», lo que es la pantalla («Tus clases, que compartes con sus otros docentes…»; para el administrador, «Las clases del centro…»). En la misma fila, a la derecha (como el selector de Bloques; en el móvil, debajo): la clase elegida, su menú y el botón «Añadir clase».
- La clase se elige en dos niveles: el desplegable «Curso» (los cursos con clases, del más reciente al más antiguo; siempre a la vista) y el desplegable «Clase» con las de ese curso por nombre («1.º DAW A»), o su nombre como texto si es la única. Va en la URL (`?clase=`); sin ella, la primera del curso actual (o la primera de todas si ese curso no tiene). Cambiar de curso abre su primera clase.
- Junto al desplegable, el menú de la clase (solo si hay algo que hacer en él): «Editar» (para su creador o la administración), «Duplicar…» (si el usuario tiene asignaturas en ella) y «Eliminar» (para su creador o la administración, deshabilitado con su motivo mientras tenga asignaturas).
- La tabla de matrícula: en su barra, «Alumnado (N)», el filtro (el mismo campo que en el resto de la app) con más de 10 alumnos o mientras se filtra, «Matricular en la clase», «Añadir asignatura» y el botón «Exportar el alumnado» («Descargar la lista (CSV)» y «Copiar los correos»). Sin asignaturas, «Aún no tiene asignaturas. Añade las tuyas.». Una clase con asignaturas pero sin alumnos enseña igual la tabla, con sus columnas y menús, y en su cuerpo un icono, «Esta clase aún no tiene alumnos» y cómo matricularlos. La columna de los nombres es fija, con un fondo propio (un paso más oscuro que el panel en claro y más claro en oscuro) y su cabecera por encima de las de las asignaturas al desplazarse; en el móvil es más estrecha. Una fila por alumno (su nombre, con el correo al pasar el ratón, y debajo «(cuenta desactivada)» o «De otra clase» si lo es) y una columna por grupo de la clase. Su cabecera: las siglas de la asignatura y, en los grupos propios, su menú ⋮ («Editar», «Ver sus bloques» a `/docente/bloques?grupo=`, «Matricular solo aquí…» y «Eliminar», deshabilitado con su motivo si alguien ya ha empezado algo); en los de otros docentes, un candado y «La da Javier Ortega Ruiz» para el lector de pantalla. Debajo, el desdoble, el docente y cuántos alumnos tiene; el nombre completo al pasar el ratón y para el lector de pantalla. En los grupos propios (todos, para el administrador), una casilla; en los de otros docentes, ✓ o —. Al final de la fila, su menú: «Quitar de la clase» (o «Añadir a la clase» si es de otra clase). La tabla se desplaza dentro de su zona, en vertical y en horizontal, con la cabecera y los nombres fijos.
- Diálogo «Añadir una clase»: nombre (con las clases del centro de ese curso como sugerencias) y curso, con dos botones: «Este curso (2026/27)», marcado, y «El que viene (2027/28)»; no se escribe. Si el nombre y el curso son los de una clase que existe, la pista dice «Esta clase ya existe (la dan Javier Ortega Ruiz): únete con tus asignaturas» (o que no tiene ninguna) y el botón pasa de «Crear y elegir asignaturas» a «Unirme y elegir asignaturas». En los dos casos se abre a continuación «Añadir asignaturas»: las asignaturas se añaden siempre en ese diálogo.
- Diálogo «Editar la clase»: solo el nombre; el curso no cambia («Para otro curso, duplícala»).
- Diálogo «Añadir asignaturas a 1.º DAW A · 2026/27», con la estética del de matrícula y de alto fijo (46rem, o la ventana): una línea con lo que hace; «Asignaturas del centro (N)» con un filtro pequeño en la misma fila y la lista de todas, por orden alfabético en el idioma de la interfaz, con una casilla cada una y su nota («La da Marta Ibáñez Soler · solo como desdoble», «Ya tiene un desdoble»); con muchas, la lista se desplaza dentro. Debajo, «Elegidas (n)» con «Quitar todas» y una fila por elegida: «Toda la clase / Desdoble» (solo «Desdoble» si la clase ya la tiene para toda la clase), el nombre del desdoble cuando lo es («Desdoble N» de entrada) y una ✕ para quitarla. Para el administrador, el docente. El botón dice «Añadir (n)». Se añaden de una en una: si una falla, las añadidas salen de las elegidas y el resto espera otro intento.
- Diálogo «Editar 1.º DAW A · 2026/27 · Programación básica»: la asignatura, que se lee con su motivo, el nombre del desdoble (opcional) y, para el administrador, el docente.
- Diálogo de matrícula («Matricular en …»), ancho (56rem, o la ventana menos un margen) y de alto fijo (44rem, o la ventana) para que no salte al cambiar de pestaña; las listas ocupan el sitio que queda. Una línea con lo que hace y cuatro pestañas: la primera, con «Seleccionar todos (n)» y un filtro pequeño en la misma fila (sin nadie, un icono y el motivo en el centro), es «Sin clase este curso» para la clase (el alumnado activo sin clase en el curso) y «De esta clase» para un grupo (los de la clase que no están en él), «Pegar una lista» (correos o nombres completos, uno por línea, hasta 500; «Buscar en la lista» dice cuántos ha elegido y qué líneas no tienen una cuenta de alumno, o tienen más de una), «De otra clase» («Añadir los de …» por cada otra clase del usuario) y «Buscar» (por nombre o correo). Debajo, «Elegidos (n)», «Quitar todos», los elegidos como chips y «Matricular (n)», sin límite: se envían de 50 en 50.
- Diálogo «Duplicar 1.º DAW A · 2026/27»: nombre (el mismo), curso (un desplegable con el siguiente marcado, o el actual si la clase es más antigua, y los de a cada lado), «Asignaturas» (las del usuario, o todas para el administrador, marcadas) y «Qué traer»: los bloques (marcado), «Con sus fechas» (marcado, solo con los bloques, con la nota de dónde caen) y «Su alumnado (las cuentas activas)» (sin marcar). El botón dice «Copiar 3 asignaturas».

## Interacciones

- **Elegir una clase:** cambia `?clase=` y pide su alumnado; al recargar se ve la misma. El filtro empieza vacío en cada clase.
- **Añadir clase:** se crea la clase vacía (aviso «Clase creada»), queda elegida y se piden sus asignaturas; si ya existía, se piden las asignaturas para ella sin crear nada, y queda elegida al añadirlas.
- **Añadir asignaturas:** un grupo sin nombre de desdoble toma el alumnado activo de la clase, salvo a quien ya está en un desdoble de esa asignatura; un desdoble empieza vacío y su alumnado se elige con «Matricular en X» o «Matricular solo aquí…».
- **Duplicar:** crea la clase del nombre y curso elegidos, o se une a la que existe, con una copia de cada grupo elegido (su asignatura, su desdoble y su docente). Las fechas se mueven semanas enteras en la zona horaria del navegador. Queda elegida la clase nueva; los demás docentes añaden después sus asignaturas.
- **Editar:** la clase (su nombre) o el grupo (el nombre del desdoble y, para el administrador, el docente).
- **Eliminar:** pregunta antes. Un grupo, «con sus bloques y su matrícula»; una clase, solo sin asignaturas, «con su lista de alumnos». Después, el foco va al encabezado.
- **Matricular en la clase:** entran en ella y en todos sus grupos sin nombre de desdoble, también en los de otros docentes, salvo en la asignatura en cuyo desdoble ya estén. Se eligen de una vez (sin clase este curso, una lista pegada u otra clase) o buscándolos, 300 ms después de dejar de escribir y desde dos letras.
- **Matricular solo aquí:** en un grupo propio, para un desdoble, para volver a meter a quien se dio de baja o para quien cursa la asignatura desde otra clase. «De esta clase» lista solo a los que no están en el grupo, para elegirlos.
- **Marcar o desmarcar una casilla:** matricula o da de baja en ese grupo al momento, sin preguntar; el aviso lo dice corto («Baja de Lucía Martín Gómez en Desarrollo web en entorno cliente») y ofrece «Deshacer». Si falla, la casilla vuelve a su estado y el aviso dice por qué. La baja conserva el trabajo del alumno.
- **Exportar:** «Descargar la lista (CSV)» guarda `1.º DAW A 2026-27.csv` (nombre, correo, si está en la clase y en cada grupo, con «;» para Excel en español); «Copiar los correos» copia los de la clase, uno por línea, lo que acepta «Pegar una lista».
- **Quitar de la clase:** pregunta antes. Sale de la clase y de todas sus asignaturas, también las de otros docentes, y su trabajo se conserva.
- Cada acción se avisa con un `MatSnackBar`. Un fallo en un diálogo se dice en él; el de una acción del menú, en el aviso. En los dos casos se recarga.

## Estados

- **Cargando:** esqueleto del desplegable y del panel; luego, del alumnado.
- **Vacío:** `EmptyState` «Aún no tienes clases» («Aún no hay clases» para el administrador) con «Añadir clase». Una clase sin asignaturas: «Aún no tiene asignaturas. Añade las tuyas.»; sin alumnos: «Esta clase aún no tiene alumnos».
- **Error:** `LoadError` con «Reintentar» si fallan las clases, las asignaturas o (para el administrador) los docentes. El alumnado carga y falla por separado, con su propio reintento.
- **Buscando:** barra fina en el diálogo. Con menos de dos letras, la pista; sin resultados, «Ningún alumno coincide. Las cuentas las crea la administración.».
- **Guardando:** «Guardando…» en el botón del diálogo y el error junto a él (`role="alert"`), sin cerrarlo.

## Accesibilidad

- Los menús tienen nombre propio: el de la clase («Acciones de 1.º DAW A · 2026/27»), el de cada grupo («Acciones de 1.º DAW A · Programación básica») y el de cada alumno («Acciones de Lucía…»).
- La tabla tiene título (`caption`), cabeceras de fila y de columna; cada casilla y cada marca se nombran enteras («Lucía Martín Gómez está en Programación básica»), no por las siglas.
- «Eliminar» deshabilitado sigue enfocable (`disabledInteractive`) con su motivo escrito; la asignatura fija, con su pista.
- En el buscador se anuncia cuántos alumnos se encuentran, no la lista entera; al tomar los de otra clase, cuántos se han elegido.
- Tras quitar de la clase, dar de baja o eliminar, el foco no se pierde: va al panel del alumnado o al encabezado.

## Criterios de aceptación

- [x] Los grupos del docente (todos, para el administrador, con su docente).
- [x] Crear, editar y eliminar un grupo; el empezado no se elimina, con su motivo.
- [x] Matricular buscando por nombre o correo, varios a la vez o el alumnado de otra clase; dar de baja conservando el trabajo (RF-16).
- [x] Revisión visual del autor de la versión rehecha (dada por buena el 20/11/2026, con la del 5.2d).
- [x] Duplicar una clase para el curso siguiente o una paralela, con sus bloques (fechas movidas o sin ellas) y, si se quiere, su alumnado (5.2c).
- [x] La clase existe una sola vez y la comparten sus docentes; quien crea una que ya existe se une a ella (5.2d).
- [x] El alumnado es de la clase: matricular en ella llega a todas sus asignaturas, y cada grupo admite excepciones (5.2d).
- [x] Desdobles: dos grupos de una asignatura con su nombre, «Desdoble N» por defecto (5.2d).
- [x] La matrícula como tabla con las siglas de cada asignatura, casillas y «Deshacer» (5.2d).
- [x] Matricular a muchos de una vez: sin clase este curso, una lista pegada u otra clase (5.2d).
- [x] Sacar la lista en CSV y copiar los correos (5.2d).
- [x] Las asignaturas son las columnas de la tabla, con su menú en la cabecera; las de otros docentes, con candado (5.2d).
- [x] La clase elegida, en la URL, en dos niveles: curso y clase (5.2d).
- [x] Las asignaturas se añaden en un solo diálogo, también al crear o unirse a una clase; un desdoble puede ir antes que el grupo de toda la clase (5.2d).
- [x] El curso se elige, nunca se escribe: «Este curso» o «El que viene» (5.2d).
- [x] La tabla ocupa todo el alto de la ventana, con la columna de los nombres fija y con fondo propio (5.2d).
- [x] «Añadir asignaturas» con la estética de matricular, para muchas asignaturas: filtro, elegidas abajo, cada una de toda la clase o desdoble (5.2d).
- [x] Revisión visual del autor de lo del 5.2d (20/11/2026: «de momento la doy por buena»).
- [x] Las clases de cursos pasados, de solo lectura, con un aviso y «Duplicar…»; la administración las reabre y las vuelve a cerrar (5.2e, D-082).

## Fuera de alcance

- Archivar las clases de cursos pasados ([PENDIENTES](../PENDIENTES.md)).
- Crear cuentas de alumno: es la pantalla de usuarios (5.1b).
- Dos docentes en el mismo grupo (codocencia): un grupo tiene un único docente.

## Pulido pendiente

—
