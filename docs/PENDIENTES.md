# Pendientes

Constancia de todo lo que queda por hacer y no tiene todavía un paso del plan que lo haga, para detectarlo fácilmente al acabar y no olvidar nada. Entra aquí:

- lo que un paso aplaza o deja a medias, por el motivo que sea;
- las consecuencias de una decisión para pasos futuros («el back-end tendrá que…»);
- las mejoras o ideas que salen en una conversación y no se hacen en el momento;
- lo que el autor acepta «por ahora».

Los e2e van aparte, en [E2E-PENDIENTES.md](E2E-PENDIENTES.md), y se hacen en el 7.1. Cada paso añade aquí sus filas al cerrar, y una fila se borra cuando se hace. En la versión 1.0 (7.4) no puede quedar ninguna.

| Desde | Pendiente                                                                                                                                                                                                                     | Cuándo                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 0.5   | Que el autor revise los enunciados y las pruebas de los 8 ejercicios de las fixtures                                                                                                                                          | Antes de la fase 2, que los lleva a `seed.sql` real     |
| 1.1d  | Volver a pensar dónde van el tema y el idioma en los shells: el autor lo aceptó «por ahora»                                                                                                                                   | Con los ajustes del alumno (1.9)                        |
| 1.2   | Revisar las figuras de la memoria citadas en la tabla de pantallas (§2.2) y en los pasos: la numeración cambió (el catálogo es la 7 y la 16)                                                                                  | Al construir cada pantalla, en su ficha                 |
| 1.2   | La columna `topics` (`text[]`) en la migración de `exercise` y las pistas (`hintCount`, `hintLevel`) en la consulta de `listAssigned` con Supabase (D-027)                                                                    | Fase 2, al crear el esquema y los servicios de Supabase |
| 1.2   | Los contenidos (`topics`) en el editor de ejercicios del docente (D-027)                                                                                                                                                      | Paso 4.3                                                |
| 1.2   | Chrome DevTools MCP (opcional, §5.5): añadirlo a `.mcp.json` con versión fijada (`chrome-devtools-mcp@1.12.0` o la vigente) solo si hace falta Lighthouse o trazas de rendimiento, que el navegador de la app de Claude no da | Cierre (fase 7) o si alguna pantalla va lenta           |
| 1.3   | Pasar la carga de la pantalla de trabajo a los recursos de ruta de Angular (`resources` y `nonBlocking()`) cuando dejen de estar en _developer preview_, y quitar del lint la excepción que haga falta (D-028)                | Cuando Angular los declare estables                     |
| 1.3   | Idea: con el editor, que el alumno pueda ajustar con un separador la altura del enunciado y del código, en lugar del 45 % fijo del enunciado (D-028)                                                                          | Paso 1.4                                                |
