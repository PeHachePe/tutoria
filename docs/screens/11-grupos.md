# 11 · Grupos y matrícula

`/docente/grupos?clase=` · Docente y administrador · Capa 2 · 2 h (5.2b, rehecha en su revisión), el 5.2c (preparar un curso nuevo) y el 5.2d (la clase compartida)

## Objetivo

Que el docente cree sus grupos, cada uno de una asignatura, y matricule o dé de baja a sus alumnos (RF-16, CU-07), y que la administración gestione todos los grupos y cambie su docente. Sustituye a `/admin/grupos` (2.2).

Desde el 5.2d (D-081), la pantalla gira alrededor de la **clase** del centro («1.º DAW A · 2026/27»), que existe una sola vez y comparten sus docentes. Cada asignatura de la clase es un grupo de su docente. El alumnado es de la clase, y cada grupo puede dejar fuera a alguien (una convalidada) o tener a alguien de otra clase. Dos grupos de la misma asignatura son un **desdoble**, con su nombre («Desdoble inglés»). Preparar un curso nuevo (5.2c) sigue siendo rápido: se duplica la clase con los bloques.

## Datos

- `GroupService` (5.2a, 5.2d):
  - Clases: `listClasses()` (aquellas en las que el usuario da clase o que creó; todas para el administrador), `listAllClasses()` (las del centro, para unirse a una), `createClass(clase, asignaturas, docente)` (crea la clase o se une a la que ya existe con ese nombre y curso; un grupo por asignatura), `saveClass()`, `removeClass()` y `duplicateClass(clase, nombre y curso, grupos, opciones)`.
  - Grupos: `addGroup(clase, asignatura, nombre del desdoble, docente)`, `saveGroup()` (el nombre del desdoble y, para la administración, el docente) y `removeGroup()`.
  - Alumnado: `listRoster(clase)` (el de la clase y el de sus grupos, con los grupos de cada uno), `searchStudents(clase o grupo, texto)`, `enrollInClass()`, `removeFromClass()`, `enroll(grupo, alumnos)`, `unenroll(grupo, alumno)` y `listTeachers()`.
- `ExerciseService.listSubjects()` para el desplegable de la asignatura.
- Sin store: el estado es de la pantalla (`resource()`), que se recarga tras cada acción. El alumnado de la clase, con su propio `resource()`, se pide al elegirla.
- Funciones puras:
  - De las clases y los grupos: `labelClasses()`, `subjectLine()`, `sortClassGroups()`, `nextSplitLabel()` («Desdoble N») y `rosterNote()` (lo que dice cada alumno además del nombre).
  - De los formularios: `classSchema()`, `newClassSchema()`, `toClassDraft()`, `existingClass()`, `groupSchema()`, `toGroupDraft()`, `teacherChoices()`, `toDuplicateFormModel()`, `duplicateSchema()` y `toDuplicateOptions()`.
  - Del curso y las fechas: `schoolYearOf()`, `nextSchoolYear()`, `schoolYearShiftDays()` y `shiftDate()` (en `data/`), y `datesNote()` (en `shared/`).
  - Del resto: `filterStudents()` (el filtro del panel), `groupActionMessage()`, y `groupName()` y `groupTitle()` (en `data/`, los nombres de un grupo en las demás pantallas).

## Contenido y disposición

Escritorio, tablet y móvil; desde 1024 px, las asignaturas y el alumnado en dos columnas:

- Cabecera: «Grupos y matrícula», lo que es la pantalla («Tus clases, que compartes con sus otros docentes…»; para el administrador, «Las clases del centro…») y el botón «Nueva clase».
- La clase se elige con el desplegable «Clase» («1.º DAW A · 2026/27»), en la URL (`?clase=`), y sin ella la primera. Con una sola clase, su nombre como texto. Van del curso más reciente al más antiguo y, dentro de cada curso, por nombre.
- Junto al desplegable, el menú de la clase (solo si hay algo que hacer en él): «Editar» (para su creador o la administración), «Duplicar…» (si el usuario tiene asignaturas en ella) y «Eliminar» (para su creador o la administración, deshabilitado con su motivo mientras tenga asignaturas).
- Panel «Asignaturas»: «Añadir asignatura» y cada grupo de la clase, también los de otros docentes, con su asignatura y el nombre del desdoble, el docente y «N alumnos». Los grupos propios llevan su menú: «Editar», «Ver sus bloques» (a `/docente/bloques?grupo=`), «Matricular solo aquí…» y «Eliminar» (deshabilitado con su motivo si alguien ya ha empezado algo).
- Panel del alumnado: «Alumnado (N)», el filtro con más de 10 alumnos (o mientras se filtra), «Matricular en la clase» y la lista por nombre. Cada alumno muestra su correo, «(cuenta desactivada)» si lo está y una nota: «No cursa: …», el desdoble en el que está o «De otra clase: …». En su menú, «Dar de baja de X» o «Matricular en X» por cada grupo propio, y «Quitar de la clase» (o «Añadir a la clase» si es de otra clase). La lista se desplaza dentro de su zona con el alto que deja la ventana: en escritorio y tablet la página no se desplaza; en el móvil los dos paneles se apilan y sí.
- Diálogo «Nueva clase»: nombre (con las clases del centro de ese curso como sugerencias), curso (con su pista «Como 2026/27» mientras no es válido), «Tus asignaturas en ella» (varias o ninguna) y, solo para el administrador, el docente. Si el nombre y el curso son los de una clase que existe, la pista dice «Esta clase ya existe: tus asignaturas se añaden a ella», el botón pasa a «Añadir mis asignaturas» y hay que elegir alguna.
- Diálogo «Editar la clase»: nombre y curso.
- Diálogo «Añadir una asignatura a 1.º DAW A · 2026/27»: la asignatura, «Nombre del desdoble» (opcional; si la clase ya tiene la asignatura, viene relleno con «Desdoble N» y es obligatorio) y, para el administrador, el docente. Al editar, la asignatura se lee con su motivo.
- Diálogo de matrícula («Matricular en …»): una línea con lo que hace, el buscador, «Añadir los de otra clase», los resultados como casillas, los elegidos como chips y «Matricular (n)», con 50 como mucho de una vez.
- Diálogo «Duplicar 1.º DAW A · 2026/27»: nombre (el mismo), curso (el siguiente, o el actual si la clase es más antigua), «Asignaturas» (las del usuario, o todas para el administrador, marcadas) y «Qué traer»: los bloques (marcado), «Con sus fechas» (marcado, solo con los bloques, con la nota de dónde caen) y «Su alumnado (las cuentas activas)» (sin marcar). El botón dice «Copiar 3 asignaturas».

## Interacciones

- **Elegir una clase:** cambia `?clase=` y pide su alumnado; al recargar se ve la misma. El filtro empieza vacío en cada clase.
- **Nueva clase:** el curso viene con el actual. Se crea la clase con un grupo del docente en cada asignatura, cada uno con el alumnado de la clase; si ya existía, se añaden a ella. Queda elegida, y el aviso dice «Clase creada» o «Asignaturas añadidas a la clase».
- **Añadir asignatura:** un grupo sin nombre de desdoble toma el alumnado activo de la clase; un desdoble empieza vacío y su alumnado se elige con «Matricular en X» o «Matricular solo aquí…».
- **Duplicar:** crea la clase del nombre y curso elegidos, o se une a la que existe, con una copia de cada grupo elegido (su asignatura, su desdoble y su docente). Las fechas se mueven semanas enteras en la zona horaria del navegador. Queda elegida la clase nueva; los demás docentes añaden después sus asignaturas.
- **Editar:** la clase (su nombre y curso) o el grupo (el nombre del desdoble y, para el administrador, el docente).
- **Eliminar:** pregunta antes. Un grupo, «con sus bloques y su matrícula»; una clase, solo sin asignaturas, «con su lista de alumnos». Después, el foco va al encabezado.
- **Matricular en la clase:** entran en ella y en todos sus grupos sin nombre de desdoble, también en los de otros docentes. Se buscan 300 ms después de dejar de escribir, desde dos letras, o se toman de otra clase.
- **Matricular solo aquí:** en un grupo propio, para un desdoble o para quien cursa la asignatura desde otra clase. Se puede tomar a los de esta clase.
- **Dar de baja de X / Matricular en X:** solo en ese grupo; dar de baja pregunta antes («Dejará de ver esta asignatura, pero sigue en la clase. Su trabajo se conserva.»).
- **Quitar de la clase:** pregunta antes. Sale de la clase y de todas sus asignaturas, también las de otros docentes, y su trabajo se conserva.
- Cada acción se avisa con un `MatSnackBar`. Un fallo en un diálogo se dice en él; el de una acción del menú, en el aviso. En los dos casos se recarga.

## Estados

- **Cargando:** esqueleto del desplegable y del panel; luego, del alumnado.
- **Vacío:** `EmptyState` «Aún no tienes clases» («Aún no hay clases» para el administrador) con «Nueva clase». Una clase sin asignaturas: «Aún no tiene asignaturas. Añade las tuyas.»; sin alumnos: «Esta clase aún no tiene alumnos».
- **Error:** `LoadError` con «Reintentar» si fallan las clases, las asignaturas o (para el administrador) los docentes. El alumnado carga y falla por separado, con su propio reintento.
- **Buscando:** barra fina en el diálogo. Con menos de dos letras, la pista; sin resultados, «Ningún alumno coincide. Las cuentas las crea la administración.».
- **Guardando:** «Guardando…» en el botón del diálogo y el error junto a él (`role="alert"`), sin cerrarlo.

## Accesibilidad

- Los menús tienen nombre propio: el de la clase («Acciones de 1.º DAW A · 2026/27»), el de cada grupo («Acciones de 1.º DAW A · Programación básica») y el de cada alumno («Acciones de Lucía…»).
- «Eliminar» deshabilitado sigue enfocable (`disabledInteractive`) con su motivo escrito; la asignatura fija, con su pista.
- En el buscador se anuncia cuántos alumnos se encuentran, no la lista entera; al tomar los de otra clase, cuántos se han elegido.
- Tras quitar de la clase, dar de baja o eliminar, el foco no se pierde: va al panel del alumnado o al encabezado.

## Criterios de aceptación

- [x] Los grupos del docente (todos, para el administrador, con su docente).
- [x] Crear, editar y eliminar un grupo; el empezado no se elimina, con su motivo.
- [x] Matricular buscando por nombre o correo, varios a la vez o el alumnado de otra clase; dar de baja conservando el trabajo (RF-16).
- [ ] Revisión visual del autor de la versión rehecha.
- [x] Duplicar una clase para el curso siguiente o una paralela, con sus bloques (fechas movidas o sin ellas) y, si se quiere, su alumnado (5.2c).
- [x] La clase existe una sola vez y la comparten sus docentes; quien crea una que ya existe se une a ella (5.2d).
- [x] El alumnado es de la clase: matricular en ella llega a todas sus asignaturas, y cada grupo admite excepciones (5.2d).
- [x] Desdobles: dos grupos de una asignatura con su nombre, «Desdoble N» por defecto (5.2d).
- [x] La clase elegida, en la URL (5.2d).
- [ ] Revisión visual del autor de lo del 5.2d.

## Fuera de alcance

- Matricular pegando una lista de correos y archivar las clases de cursos pasados ([PENDIENTES](../PENDIENTES.md)).
- Crear cuentas de alumno: es la pantalla de usuarios (5.1b).
- Dos docentes en el mismo grupo (codocencia): un grupo tiene un único docente.

## Pulido pendiente

—
