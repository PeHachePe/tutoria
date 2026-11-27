# Auditoría · Seguridad de la base de datos

16/11/2026 · Sesión de Claude Code · `15a6ab1`, `9cfbb20` y `50b12e0`

## Objetivo

Revisar la base de datos como lo haría alguien con una cuenta y la API, sin pasar por las pantallas, y cerrar lo que apareciera antes de usar la aplicación con alumnos reales. No es un paso del plan: sale de una revisión pedida por el autor entre la fase 4 y la 5. Toca §2.3 (RLS) y §2.10 (minimización de datos).

## Qué se pidió

- Una auditoría de seguridad del back-end, empezando por la base de datos: RLS, funciones SQL, Realtime y pruebas ocultas, con los hallazgos graves comprobados en el Supabase local y todo anotado en `PENDIENTES.md`.
- Después, vistos los hallazgos, la migración con los arreglos propuestos.

## Qué hizo Claude

1. Leyó las 19 migraciones enteras, la configuración de Supabase y los 16 ficheros de tests de pgTAP, y probó cada sospecha en local suplantando a un alumno, a dos docentes y a `anon` dentro de transacciones que se deshacen.
2. Lo importante aguantó: las pruebas ocultas no se leen por ningún camino, el estado del intento solo lo escribe el servidor, nadie cambia su rol, una cuenta desactivada pierde el acceso al momento y `anon` no lee nada.
3. Encontró dos problemas de gravedad media (un docente leía el trabajo de sus alumnos en grupos de otros docentes; lo que escribe el navegador no tenía límite de tamaño ni de ritmo), cuatro menores y un endurecimiento, y los dejó en `PENDIENTES.md`.
4. Escribió la migración `security_review` con los arreglos (D-062) y sus tests de pgTAP, cada uno en el fichero de su tema, más `function_privileges`, que vigila qué funciones puede ejecutar cada rol.
5. Llevó las mismas reglas a los servicios simulados (`mock-access.ts`), con sus tests primero, y cambió el mensaje del banco cuando un ejercicio no se puede borrar.
6. Actualizó §2.3 del plan y quitó de `PENDIENTES.md` lo arreglado. Quedan allí el cierre de un bloque, la configuración de Auth, la revisión de las Edge Functions y dos cosas nuevas: el editor no avisa de los 50 000 caracteres, y hay que mirar los intentos de docentes en la nube al publicar la migración.

## Comandos e instalaciones

| Comando                                     | Para qué                                                             |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `docker exec -i supabase_db_tutoria psql …` | Probar los hallazgos y la migración en transacciones que se deshacen |
| `npx supabase migration up`                 | Aplicar la migración en local sin borrar los datos                   |
| `npm run db:test`                           | pgTAP                                                                |
| `npm run db:types` · `npm run i18n`         | Tipos de la base y textos tras los cambios                           |
| `npm run format` · `npm run check`          | Cierre                                                               |
| `npm run metrics -- auditoria-bd`           | Métricas                                                             |

Sin instalaciones.

## Archivos creados o modificados

- **Migración:** `supabase/migrations/20261116100000_security_review.sql`.
- **pgTAP:** nuevo `function_privileges.test.sql`; ampliados `teacher_access`, `process_events`, `attempt_workflow`, `student_access`, `blocks_and_assignments` y `exercise_editor`.
- **Datos:** `mock-access.ts` (`canReadAttempt` y `findOpenableAssignment` en lugar de `canSeeStudentData`), `mock-attempt-service.ts`, `mock-exercise-service.ts` y sus tests; comentarios de `exercise-service.ts` y de los servicios de Supabase; `database.types.ts` regenerado.
- **Pantalla:** el aviso de `exercise-bank-page.ts` cuando no se puede borrar (`bank.delete.in-use`), con sus traducciones.
- **Documentación:** `PLAN.md` §2.3, `DECISIONES.md` (D-062), `PENDIENTES.md`, esta bitácora y `REGISTRO.md`.

## Problemas y cómo se resolvieron

- **Cerrar las funciones por defecto rompía los tests.** El primer intento quitaba a `PUBLIC` el permiso de ejecutar cualquier función nueva (`alter default privileges for role postgres`). Es un valor global del rol: alcanzaba a las funciones temporales de cuatro ficheros de tests y alcanzaría a las extensiones que se instalen. Se quitó de la migración, se deshizo en local y lo sustituye un test que falla si una función queda abierta a `anon` o si `authenticated` ejecuta una que no está en su lista.
- **El borrado de un ejercicio en los datos simulados.** El test que borraba el ejercicio 8 falló con la regla nueva: en el seed también está en el grupo del otro docente. Era justo el caso que ahora se impide; el test usa uno que solo está en los grupos de su autora y hay otro para el caso nuevo.
- **La migración no se ha aplicado desde cero.** Se aplicó en local sobre la base que había y después se le quitó la línea de los permisos por defecto. Los `revoke` añadidos se comprobaron sueltos y los 211 tests pasan, pero falta un `npm run db:reset`, que borra los datos locales y se deja al autor.

## Decisiones

- [D-062](../DECISIONES.md): el docente lee por grupo, límites a lo que escribe el navegador y permisos más estrechos.

## Tests

Unitarios: 1838 (nuevos: 3) · e2e: 39 (sin cambios, no se han pasado) · Deno: 175 · scripts: 129 · pgTAP: 211 (nuevos: 22)

Cobertura de la app, 100 %. Los de pgTAP nuevos cubren: un alumno de dos docentes (cada uno lee solo los intentos de su grupo, con sus eventos y mensajes), el límite del código, el detalle, la hora y los topes de los eventos, el aviso de datos, los permisos de columna, que docentes y administración no abren intentos, el borrado de un ejercicio que usa otro docente y los permisos de las funciones.

## Validación humana

Aprobado empezar por la base de datos y, vistos los hallazgos, la migración. Acotar la lectura del docente al grupo se hizo como se recomendó; queda a su revisión. Ejecutó los commits; la migración sigue sin publicar en la nube.

## Capturas

No es una pantalla.

## Métricas

| Duración                                                             | Tokens de entrada | Tokens de salida | Tokens de caché              | Coste equivalente                          | Líneas +/−  | Archivos | Horas humanas |
| -------------------------------------------------------------------- | ----------------- | ---------------- | ---------------------------- | ------------------------------------------ | ----------- | -------- | ------------- |
| 8 h 30 min de sesión, con la noche en medio; ≈ 1 h 15 min de trabajo | 138               | 114.101          | 11,7 M leída · 510 k escrita | sin calcular: el script no tiene su precio | +771 / −150 | 26       | ≈ 1 h 35 min  |

Modelo: `claude-fable-5-2`. Horas humanas estimadas: el tiempo de Claude sin pausas más un 30 % de revisión. Las métricas se tomaron antes de la documentación del cierre.

## Commits

Los ejecutó el autor:

1. `15a6ab1` · `fix(db): teachers read by group, limits to what the browser writes and narrower grants (security review)`
2. `9cfbb20` · `fix(data): mock services follow the rules of the security review (security review)`
3. `50b12e0` · `docs: record the security review of the database (security review)`

## Para la presentación

- Una revisión con una cuenta de alumno y la API directa encontró que la tabla aceptaba 20 000 eventos en una sola petición: lo que protege una pantalla no protege la base.
- La RLS cumplía lo que decía la especificación («a través de `enrollment`»), y la especificación era la que daba de más: un docente veía el código de su alumno en la asignatura de otro.
