# 10 · Usuarios

`/admin/usuarios?buscar=&rol=&estado=&pagina=` · Administrador · Capa 2 · 2 h (5.1b)

## Objetivo

Que la administración dé de alta las cuentas del centro, les cambie el rol, les restablezca la contraseña y las active o desactive (RF-18, CU-06), sin quitarse nunca su propio rol ni desactivarse (3b) y sin cuentas con el mismo correo (3a). Figura 13 de la memoria.

## Datos

- `AdminService.listUsers()`: todas las cuentas por nombre, cada una con los grupos que imparte o en los que está matriculada (sus nombres, sin repetir) y sus vínculos (`UserLinks`: cuántos grupos imparte y cuántas matrículas tiene). En Supabase, una consulta a `app_user` con `class_group` y `enrollment` incrustados (la RLS da todo a la administración).
- `createUser(user)` y `updateUser(id, changes)`, por la Edge Function `admin-users` (5.1a, D-072). El correo repetido y los cambios no permitidos dan `invalid`.
- Sin store: el estado es de la pantalla (`resource()`), cambiado en el sitio tras cada acción y recargado tras un fallo.
- Funciones puras: `toUserEntry()`; `filterUsers()`, `sortUsers()` y `USERS_PAGE_SIZE`; `userSchema()`, `passwordRules()`, `toNewUser()` y `toUserChanges()`; `roleLock()` (por qué no se puede cambiar el rol); `generatePassword()`; `userActionMessage()`; y `pageOf()` y `searchable()` de `shared/`.

## Contenido y disposición

Escritorio, tablet y móvil en una columna:

- Cabecera: «Usuarios», lo que es la pantalla y los botones «Alta de varios…» (5.2h) y «Nuevo usuario», en una fila también en el móvil.
- Tras la evaluación final (5.2g, D-084), un aviso con fondo de aviso: «4 alumnos titulados o de baja siguen con la cuenta activa.» y «Revisar y desactivar…». Solo si hay alguno.
- Filtros, en la URL, en una fila desde `sm` (en el móvil, el buscador solo y los dos desplegables lado a lado): buscar por nombre o correo (sin tildes ni mayúsculas), el rol («Todos los roles», «Alumnado», «Profesorado», «Administración»), el estado («Activas», por defecto, «Desactivadas» o «Todas») y la situación del alumnado («Todas», «En una clase este curso», «Sin clase este curso» o «Titulados o de baja», 5.2g).
- «33 cuentas», o «5 cuentas de 33» al filtrar, anunciado con `aria-live`.
- Una tabla (`mat-table`) que se desplaza dentro de su zona, con la cabecera fija, y se ordena por nombre (por defecto), rol o grupos:
  - **Nombre:** el nombre, «Tú» en la cuenta propia y «Desactivada» (icono y texto) en las desactivadas; el correo debajo y, en quien queda por desactivar, su última clase («Titula · 2.º DAW A · 2025/26»);
  - **Rol**;
  - **Grupos:** los que imparte o en los que está matriculada, o «—» (desde `md`);
  - el menú de acciones: «Editar», «Restablecer la contraseña», «Ver su trayectoria» (en quien fue alumno de alguna clase, 5.2g) y «Desactivar» o «Activar». En la cuenta propia, «Desactivar» aparece deshabilitado con el motivo escrito debajo.
- 10 por página, con el paginador solo si hay más.
- Diálogo de la cuenta: en el alta, nombre, correo, rol y contraseña (con «Generar», mostrarla u ocultarla y «Copiar»); al editar, nombre y rol, con el correo solo para leer. El rol se deshabilita con su motivo en la cuenta propia y en quien tiene grupos o matrículas.
- Diálogo de la contraseña: la nueva contraseña, con los mismos botones.
- Diálogo «Cuentas de quien ya terminó» (5.2g): qué hace, la lista con todos marcados (nombre y «Titula · 2.º DAW A · 2025/26») y «Desactivar N».
- Diálogo «Trayectoria de …» (5.2g): sus clases curso a curso, de la más reciente, con la etiqueta de su evaluación.
- Diálogo «Alta de varios alumnos» (5.2h, D-085), ancho, en tres fases: pegar la lista; revisarla («Se crean» y «No se crean», cada línea con su número y su motivo) con «Matricular en una clase» opcional; y el resultado, con el aviso de que las contraseñas solo se ven ahora, la lista de cuentas con su contraseña, «Descargar CSV» e «Imprimir las tiras».
- Los diálogos con formulario tienen siempre el mismo ancho, con ayuda o con error (5.2h).

## Interacciones

- **Buscar y filtrar:** cambian la URL sin llenar el historial y vuelven a la página 1. **Quitar los filtros** los borra todos.
- **Ordenar:** con las cabeceras; vuelve a la página 1. Dentro del mismo rol o grupo, por nombre.
- **Cambiar de página:** el foco vuelve a la tabla.
- **Nuevo usuario:** el correo repetido se marca en el formulario, contra la lista cargada (el servidor lo rechaza igualmente). Al crearla, la fila aparece en su sitio y el aviso dice «Cuenta creada. Entrégale la contraseña en persona.».
- **Editar:** cambia la fila en el sitio. Solo se envía lo que cambia.
- **Restablecer la contraseña:** la nueva contraseña, sin enviar correos (D-072).
- **Alta de varios alumnos (5.2h, D-085):** la lista de secretaría, como sale de Excel o separada por «;» o comas, con el nombre y el correo en cualquier orden. «Apellidos, Nombre» y los nombres en mayúsculas se escriben como en las cuentas. Nada se crea hasta pulsar «Crear N cuentas»; se crean en tandas de 25 con barra de progreso, cada una con una contraseña al azar, y se matriculan en la clase elegida. Un corte de red deja lo creado y ofrece «Reintentar los que faltan». El CSV y el PDF de las tiras se llaman «Credenciales 1.º DAW A 2026-27» (o con la fecha). Cerrar sin descargar ni imprimir pregunta antes; al cerrar, la lista se recarga.
- **Revisar y desactivar (5.2g):** desactiva de una vez las cuentas marcadas, como «Desactivar» una a una; el aviso dice cuántas, o cuántas no se pudieron. Los docentes no desactivan cuentas (D-072).
- **Desactivar:** pregunta antes («… dejará de poder entrar. Su trabajo se conserva…»); la fila pasa a «Desactivada» y sale de la lista si solo se ven las activas. **Activar:** sin preguntar.
- Cada acción se avisa con un `MatSnackBar`, que se anuncia solo. Un fallo en un diálogo se dice en él y recarga la lista; el de activar o desactivar, en el aviso.

## Estados

- **Cargando:** esqueleto con la forma de los filtros y de la tabla.
- **Vacío:** «Ningún usuario coincide» con «Quitar los filtros». Si coincide alguna cuenta con otro estado, «Ningún usuario coincide con este estado» y «Ninguna cuenta activa coincide, pero una desactivada sí.», con «Ver todas las cuentas» (5.2g). Sin filtros la lista nunca está vacía: siempre está la propia cuenta.
- **Error:** `LoadError` con «Reintentar».
- **Guardando:** «Guardando…» en el botón del diálogo, y el error junto a él (`role="alert"`) sin cerrarlo.

## Accesibilidad

- El botón de cada fila tiene nombre propio («Acciones de Lucía Martín Gómez»).
- El estado se dice con texto e icono, no solo con color.
- Lo deshabilitado (el rol, «Desactivar» en la cuenta propia) sigue siendo enfocable (`disabledInteractive`) y su motivo está escrito, a la vista, enlazado con `aria-describedby` en el diálogo.
- Los botones de la contraseña tienen nombre («Mostrar la contraseña», «Copiar la contraseña») y su resultado se anuncia.
- En el alta de varios (5.2h), el resumen de la revisión y el resultado se anuncian (`role="status"`), los errores con `role="alert"`, las dos listas son regiones con su título y la hoja de tiras, que solo existe al imprimir, va con `aria-hidden`.
- Al cambiar de página, el foco va a la tabla.

## Criterios de aceptación

- [x] Lista con nombre, correo, rol, estado y grupos (CU-06, 2).
- [x] Buscar, filtrar por rol y por estado y paginar, en la URL; ordenar por las cabeceras.
- [x] Alta con nombre, correo, rol y contraseña; el correo repetido se indica y no se crea (3a).
- [x] Cambiar el nombre y el rol; el rol, bloqueado con su motivo en la cuenta propia (3b) y en quien tiene grupos o matrículas (D-072).
- [x] Restablecer la contraseña, generada o escrita.
- [x] Desactivar con confirmación y activar; la cuenta propia no se desactiva (3b).
- [x] Revisión visual del autor.
- [x] El aviso de las cuentas de quien tituló o causó baja y desactivarlas de una vez; la situación del alumnado y su trayectoria (5.2g, D-084).
- [x] El alta de varios alumnos con la lista de secretaría, revisada antes de crear nada, con matrícula opcional y las contraseñas en CSV o en tiras para imprimir (5.2h, D-085).

## Fuera de alcance

- Cambiar el correo de una cuenta (es su identidad en Auth, D-072) y que cada usuario cambie su contraseña ([PENDIENTES](../PENDIENTES.md)).
- Matricular desde el alta de varios a quien ya tenía cuenta: se hace en Grupos con «Pegar una lista» ([PENDIENTES](../PENDIENTES.md)).
- Más de 1000 usuarios, con la lista paginada en el servidor ([PENDIENTES](../PENDIENTES.md)).
- Reasignar los grupos de un docente o dar de baja a un alumno de sus grupos: es la pantalla de grupos (5.2b).

## Pulido pendiente

—
