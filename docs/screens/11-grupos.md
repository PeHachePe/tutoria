# 11 · Grupos y matrícula

`/docente/grupos?grupo=` · Docente y administrador · Capa 2 · 2 h (5.2b)

## Objetivo

Que el docente cree sus grupos, cada uno de una asignatura, y matricule o dé de baja a sus alumnos (RF-16, CU-07), y que la administración gestione todos los grupos y cambie su docente. Sustituye a `/admin/grupos` (2.2).

## Datos

- `GroupService` (5.2a): `listGroups()` (los del docente, o todos para el administrador, con su asignatura, su docente, cuántos alumnos tiene y si está empezado), `saveGroup()`, `removeGroup()`, `listStudents()`, `searchStudents()`, `enroll()` (50 como mucho, `MAX_ENROLLMENT_BATCH`), `unenroll()` y `listTeachers()`.
- `ExerciseService.listSubjects()` para el desplegable de la asignatura.
- Sin store: el estado es de la pantalla (`resource()`), cambiado en el sitio tras cada acción y recargado tras un fallo. La matrícula de cada panel, con su propio `resource()`, se pide al abrirlo.
- Funciones puras: `schoolYearOf()` (el curso por defecto: desde septiembre, el que empieza ese año); `groupSchema()`, `toGroupFormModel()` y `toGroupDraft()`; `filterStudents()` (el filtro del panel); `groupActionMessage()`.

## Contenido y disposición

Escritorio, tablet y móvil en una columna:

- Cabecera: «Grupos y matrícula», lo que es la pantalla y el botón «Nuevo grupo».
- Un `mat-accordion` con un panel por grupo y uno abierto cada vez; el abierto va en la URL (`?grupo=`).
  - **Cabecera del panel:** el nombre; debajo, la asignatura, el curso, «N alumnos» y, para el administrador, «Docente: …».
  - **Dentro:** «Matricular alumnos» y el menú del grupo («Editar», «Ver sus bloques», que lleva a `/docente/bloques?grupo=`, y «Eliminar», deshabilitado con su motivo si alguien ya ha empezado algo).
  - **El alumnado** por nombre, con su correo y «Dar de baja del grupo». Con más de 10 alumnos, un campo «Filtrar alumnos» (sin tildes ni mayúsculas, sin peticiones). La lista tiene una altura máxima y se desplaza dentro de su zona: un grupo de 30 no estira la página.
- Diálogo del grupo: nombre, curso (con su pista «Como 2026/27»), asignatura (se elige al crear; al editar se lee, con su motivo) y, solo para el administrador, el docente.
- Diálogo de matrícula: el buscador, los resultados como casillas con nombre y correo, los elegidos como chips que se quitan y «Matricular (n)». No se eligen más de 50 de una vez.

## Interacciones

- **Abrir un panel:** escribe `?grupo=` sin llenar el historial y pide su matrícula; al recargar se abre el mismo.
- **Nuevo grupo:** el curso viene con el actual, y la asignatura elegida si solo hay una. El panel nuevo aparece en su sitio y se abre.
- **Editar:** cambia el panel en el sitio.
- **Eliminar:** pregunta antes («Se eliminará … con sus bloques y su matrícula…»).
- **Matricular:** busca 300 ms después de dejar de escribir (`createDebouncer`), desde dos letras; los matriculados aparecen en la lista por nombre y la cuenta sube.
- **Dar de baja:** pregunta antes («… dejará de ver este grupo. Su trabajo se conserva.»); la fila sale y la cuenta baja.
- Cada acción se avisa con un `MatSnackBar`. Un fallo en un diálogo se dice en él y recarga; el de eliminar o dar de baja, en el aviso.

## Estados

- **Cargando:** esqueleto de tres paneles.
- **Vacío:** `EmptyState` «Aún no tienes grupos» con «Nuevo grupo». Un grupo sin alumnos: «Este grupo aún no tiene alumnos» con «Matricular alumnos».
- **Error:** `LoadError` con «Reintentar»; la matrícula de un panel carga y falla por separado, con su propio reintento.
- **Buscando:** barra fina en el diálogo. Menos de dos letras, la pista; sin resultados, «Ningún alumno coincide. Las cuentas las crea la administración.».
- **Guardando:** «Guardando…» en el botón del diálogo y el error junto a él (`role="alert"`) sin cerrarlo.

## Accesibilidad

- El menú de cada grupo y la baja de cada alumno tienen nombre propio («Acciones de 1.º DAW A», «Dar de baja a Lucía…»).
- «Eliminar» deshabilitado sigue enfocable (`disabledInteractive`) con su motivo escrito; la asignatura fija, con su pista enlazada.
- Los resultados de la búsqueda se anuncian (`aria-live`).

## Criterios de aceptación

- [ ] Lista de los grupos del docente (todos, para el administrador, con su docente).
- [ ] Crear, editar y eliminar un grupo; el empezado no se elimina, con su motivo.
- [ ] Matricular buscando por nombre o correo, varios a la vez; dar de baja conservando el trabajo (RF-16).
- [ ] El grupo abierto, en la URL.
- [ ] Revisión visual del autor.

## Fuera de alcance

- Matricular pegando una lista de correos y archivar los grupos de cursos pasados ([PENDIENTES](../PENDIENTES.md)).
- Crear cuentas de alumno: es la pantalla de usuarios (5.1b).

## Pulido pendiente

—
