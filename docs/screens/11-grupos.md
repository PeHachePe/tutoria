# 11 · Grupos y matrícula

`/docente/grupos?grupo=` · Docente y administrador · Capa 2 · 2 h (5.2b, rehecha en su revisión)

## Objetivo

Que el docente cree sus grupos, cada uno de una asignatura, y matricule o dé de baja a sus alumnos (RF-16, CU-07), y que la administración gestione todos los grupos y cambie su docente. Sustituye a `/admin/grupos` (2.2).

## Datos

- `GroupService` (5.2a): `listGroups()` (los del docente, o todos para el administrador, con su asignatura, su docente, cuántos alumnos tiene y si está empezado), `saveGroup()`, `removeGroup()`, `listStudents()`, `searchStudents()`, `enroll()` (50 como mucho, `MAX_ENROLLMENT_BATCH`), `unenroll()` y `listTeachers()`.
- `ExerciseService.listSubjects()` para el desplegable de la asignatura.
- Sin store: el estado es de la pantalla (`resource()`), cambiado en el sitio tras cada acción y recargado tras un fallo. La matrícula de cada panel, con su propio `resource()`, se pide al abrirlo.
- Funciones puras: `schoolYearOf()` (el curso por defecto: desde septiembre, el que empieza ese año); `groupSchema()`, `toGroupFormModel()` y `toGroupDraft()`; `filterStudents()` (el filtro del panel); `groupActionMessage()`.

## Contenido y disposición

Escritorio, tablet y móvil en una columna:

- Cabecera: «Grupos y matrícula», lo que es la pantalla («Tus grupos…»; para el administrador, «Los grupos del centro…») y el botón «Nuevo grupo».
- El grupo se elige como en Bloques e Histórico: un desplegable «Grupo» con «nombre · asignatura» (y el curso si se repite), en la URL (`?grupo=`), el primero sin ella. Con un solo grupo, su nombre como texto. Los grupos van del curso más reciente al más antiguo y, dentro de cada curso, por nombre y asignatura.
- Junto al desplegable, el menú del grupo («Editar», «Ver sus bloques», que lleva a `/docente/bloques?grupo=`, y «Eliminar», deshabilitado con su motivo si alguien ya ha empezado algo).
- Un panel con el grupo elegido: el curso, «N alumnos» y, para el administrador, «Docente: …»; «Matricular alumnos»; con más de 10 alumnos (o mientras se filtra), «Filtrar alumnos» (sin tildes ni mayúsculas, sin peticiones); y el alumnado por nombre, con su correo y «Dar de baja del grupo». La lista se desplaza dentro de su zona con el alto que deja la ventana: la página no se desplaza.
- Diálogo del grupo: nombre, curso (con su pista «Como 2026/27» mientras no es válido), asignatura (se elige al crear; al editar se lee, con su motivo) y, solo para el administrador, el docente (si el del grupo está desactivado, aparece como «(cuenta desactivada)» y no se vuelve a elegir).
- Diálogo de matrícula: el buscador, «Añadir los de otro grupo» (el alumnado de otro grupo del usuario, como la misma clase en otra asignatura), los resultados como casillas con nombre y correo, los elegidos como chips que se quitan y «Matricular (n)». No se eligen más de 50 de una vez.

## Interacciones

- **Elegir un grupo:** cambia `?grupo=` y pide su matrícula; al recargar se ve el mismo. El filtro empieza vacío en cada grupo.
- **Nuevo grupo:** el curso viene con el actual, y la asignatura elegida si solo hay una. El grupo nuevo queda elegido.
- **Editar:** cambia el grupo en el sitio.
- **Eliminar:** pregunta antes («Se eliminará … con sus bloques y su matrícula…»); después, el foco va al encabezado.
- **Matricular:** busca 300 ms después de dejar de escribir (`createDebouncer`), desde dos letras, o toma el alumnado de otro grupo que no esté ya en este; los matriculados aparecen en la lista por nombre y la cuenta sube.
- **Dar de baja:** pregunta antes («… dejará de ver este grupo. Su trabajo se conserva.»); la fila sale, la cuenta baja y el foco se queda en el panel del grupo.
- Cada acción se avisa con un `MatSnackBar`. Un fallo en un diálogo se dice en él y recarga; el de eliminar o dar de baja, en el aviso.

## Estados

- **Cargando:** esqueleto del desplegable y del panel.
- **Vacío:** `EmptyState` «Aún no tienes grupos» («Aún no hay grupos» para el administrador) con «Nuevo grupo». Un grupo sin alumnos: «Este grupo aún no tiene alumnos».
- **Error:** `LoadError` con «Reintentar» si fallan los grupos, las asignaturas o (para el administrador) los docentes; la matrícula del grupo carga y falla por separado, con su propio reintento.
- **Buscando:** barra fina en el diálogo. Menos de dos letras, la pista; sin resultados, «Ningún alumno coincide. Las cuentas las crea la administración.».
- **Guardando:** «Guardando…» en el botón del diálogo y el error junto a él (`role="alert"`) sin cerrarlo.

## Accesibilidad

- El menú del grupo y la baja de cada alumno tienen nombre propio («Acciones de 1.º DAW A · Programación básica», «Dar de baja a Lucía… del grupo»), y el panel se llama como el grupo.
- «Eliminar» deshabilitado sigue enfocable (`disabledInteractive`) con su motivo escrito; la asignatura fija, con su pista.
- En el buscador se anuncia cuántos alumnos se encuentran, no la lista entera; al tomar los de otro grupo, cuántos se han elegido.
- Tras dar de baja o eliminar, el foco no se pierde: va al panel del grupo o al encabezado.

## Criterios de aceptación

- [x] Los grupos del docente (todos, para el administrador, con su docente).
- [x] Crear, editar y eliminar un grupo; el empezado no se elimina, con su motivo.
- [x] Matricular buscando por nombre o correo, varios a la vez o el alumnado de otro grupo; dar de baja conservando el trabajo (RF-16).
- [x] El grupo elegido, en la URL.
- [ ] Revisión visual del autor de la versión rehecha.

## Fuera de alcance

- Matricular pegando una lista de correos y archivar los grupos de cursos pasados ([PENDIENTES](../PENDIENTES.md)).
- Crear cuentas de alumno: es la pantalla de usuarios (5.1b).

## Pulido pendiente

—
