# Manual de usuario de TutorIA

Un manual por perfil, para leer aquí o en PDF:

- **Alumnado** ([en línea](alumno.md) · [PDF](alumno.pdf)): ver tus ejercicios, resolverlos con el tutor, entregarlos y ajustar la aplicación.
- **Profesorado** ([en línea](docente.md) · [PDF](docente.pdf)): preparar las clases, escribir y asignar ejercicios, seguir la clase en vivo y ver la evolución de cada grupo.
- **Administración** ([en línea](administracion.md) · [PDF](administracion.pdf)): las cuentas, el proveedor de IA y las asignaturas, además de todo lo del docente.

## Cómo se hace

Los manuales no se escriben a mano: salen de las tareas guiadas de la ayuda de la aplicación (paso 7.0c, D-080). `npm run manual` abre la aplicación con los datos de demostración y, como lo haría un usuario, hace cada tarea de cada perfil de principio a fin desde el panel «Ayuda». En cada paso guarda el texto del globo, leído de la pantalla, y una captura con la pieza resaltada. Después escribe estos ficheros, con las capturas en `capturas/`, y sus PDF: portada, índice con enlaces, cada parte en su página y números de página.

Así la ayuda y el manual dicen siempre lo mismo. Además, si una tarea deja de funcionar (una pieza que ya no existe o un paso que no avanza), `npm run manual` falla y dice cuál, así que sirve también de prueba de toda la ayuda guiada. Se vuelve a generar cuando cambian las tareas o las pantallas; `npm run manual -- alumno` rehace solo uno, y `npm run manual -- --reescribir` vuelve a escribir los manuales y sus PDF con lo recogido la última vez, sin repetir las tareas (para cambiar sus textos o su aspecto).
