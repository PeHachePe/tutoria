# Auditoría · Seguridad de las Edge Functions

16/11/2026 · Sesión de Claude Code · `966eadd`, `1f83b36`, `f2323ab`, `acdf32c`, `306da96`, `5938b47` y `c94557b`; la revisión posterior, `a3e0398`, `27ece4e`, `6b09369` y `1b91bce`

## Objetivo

Revisar `execute`, `tutor` y `translate` como lo haría alguien con una cuenta y la API directa, y cerrar lo que apareciera antes de usar la aplicación con alumnos reales. No es un paso del plan: sigue a la auditoría de la base de datos (D-062). Toca §2.3 y §2.4.

## Qué se pidió

- Una auditoría de las Edge Functions, con cada hallazgo serio comprobado en el Supabase local y anotado en `PENDIENTES.md`.
- Después, vistos los hallazgos, arreglarlos decidiendo lo más útil, y mejorar el prompt del tutor sin perder su esencia.
- En otra sesión, revisar lo hecho, porque la primera se quedó sin cerrar, y arreglar lo que saliera.

## Qué hizo Claude

1. Leyó las tres funciones, lo compartido y el SQL del que dependen, y probó cada sospecha en local con cuentas de alumno, docente y administración; el tutor, contra un proveedor de IA simulado, sin gastar la cuota real.
2. Lo esencial aguantó: sesión y propiedad del intento, cuenta desactivada, límites del personal, aislamiento del sandbox, y al modelo no viajan pruebas ocultas ni soluciones.
3. Encontró tres problemas altos (límites del tutor y de las ejecuciones con carrera, la clave de la IA viajando a la URL del ajuste, una expresión regular que tumbaba `execute`), tres medios y varios menores.
4. Los arregló (D-063): migración `edge_functions_review`, turnos contados antes y de uno en uno, hosts de IA permitidos, QuickJS 0.32.0, intento abierto, consultas pendientes del tutor, validador más estricto, cuerpo acotado y prompt v6.
5. Llevó la regla del intento abierto a los servicios simulados y volvió a probar en local cada hallazgo con el arreglo puesto.
6. En la revisión posterior releyó las tres funciones, lo compartido y la migración, y cerró dos huecos: el viaje con los datos de una consulta, que no cuenta turno, se podía repetir sin límite mientras el proveedor fallara (ya no se vuelven a guardar las consultas: el chat pregunta de nuevo desde el principio, y eso sí cuenta), y la llamada al modelo seguía redirecciones (`redirect: error`).

## Comandos e instalaciones

| Comando                                     | Para qué                                           |
| ------------------------------------------- | -------------------------------------------------- |
| `docker exec -i supabase_db_tutoria psql …` | Preparar y restaurar los datos de las pruebas      |
| `npx supabase migration up`                 | Aplicar la migración en local sin borrar los datos |
| `npm run db:types` · `npm run db:test`      | Tipos de la base y pgTAP                           |
| `npm run test:functions` · `ng test`        | Tests de Deno y unitarios                          |
| `npm run check`                             | Cierre                                             |

QuickJS pasa de 0.31.0 a 0.32.0 (`supabase/functions/deno.json`).

## Archivos creados o modificados

- **Migración y pgTAP:** `20261116120000_edge_functions_review.sql`; nuevo `edge_functions_review.test.sql`; ampliados `staff_requests`, `function_privileges` y `record_tutor_interaction`.
- **Funciones:** `execute`, `tutor`, `translate` y `_shared` (`http.ts`, `provider-setting.ts`, `student-requests.ts`, `staff-requests.ts`), con sus tests.
- **Datos:** `mock-access.ts` (`requireOpenAttempt`), los servicios simulados de ejecución y tutor, `run-result.ts`, `supabase-error.ts` y `database.types.ts`.
- **Scripts:** `elusion.mjs` borra los turnos del alumno en cada caso.
- **Revisión posterior:** `tutor/tutor.ts` y `_shared/llm-provider.ts`, con sus tests.
- **Documentación:** `PLAN.md` §2.3 y los límites, `DECISIONES.md` (D-063), `PENDIENTES.md`, `DESPLIEGUE.md`, `CLAUDE.md`, esta bitácora y `REGISTRO.md`.

## Problemas y cómo se resolvieron

- **El motor nuevo cambiaba tres tests del sandbox.** QuickJS 0.32.0 da la línea en más errores y une cadenas sin copiarlas, así que la bomba de memoria del test pasó a ser de vectores.
- **El tutor no arrancaba en local.** Importaba un fichero de la app que el runtime no tenía montado; la validación del nombre de función se movió a `run-result.ts`, que ya se importaba.
- **Borrado con los disparadores apagados.** Una limpieza de datos de prueba dejó 12 eventos sin intento; se borraron y la base quedó como la línea base.
- **`npm run check` se pasó entero después de los commits,** en verde: antes solo lint, Deno, pgTAP y unitarios.
- **En la revisión, la base local del otro equipo estaba en las migraciones del 12/11.** Con `supabase migration up` pasan 231 de 233 pruebas de pgTAP; las dos que fallan (`blocks_and_assignments`, `exercise_editor`) dependen del seed, que cambió después. Tras `db:reset`, las 243 pasan.
- **En ese equipo (Windows) los unitarios agotaban los 5 s en pruebas pesadas del panel docente** (entre 1 y 4 de 1841 en cada pasada, nunca las mismas; solas pasan). No tenían que ver con la revisión: renderizan la pantalla entera en jsdom y, con todos los ficheros a la vez, se pasaban del tiempo por defecto de Vitest. `vitest-base.config.mts` lo sube a 15 s (`testTimeout`), y `npm run check` sale en verde también allí.

## Decisiones

- [D-063](../DECISIONES.md): turnos contados antes, hosts de IA permitidos, sandbox que corta las expresiones regulares e intento abierto.

## Tests

Unitarios: 1841 (nuevos: 3) · e2e: 39 (sin cambios, no se han pasado) · Deno: 191 (nuevos: 16, uno de la revisión posterior) · pgTAP: 243 (nuevos: 32)

Cobertura de la app, 100 %.

## Validación humana

El autor pidió la auditoría y, vistos los hallazgos, que se arreglara todo decidiendo lo más útil; ejecutó los commits. Las decisiones de producto de D-063 quedan a su revisión. Publicado en la nube el 16/11 por el autor: las dos migraciones de la auditoría y las tres funciones.

Iteración 1: el autor pidió revisar lo hecho en otra sesión y, vistos los dos huecos, arreglarlos.

## Capturas

No es una pantalla.

## Métricas

| Duración                           | Tokens de entrada | Tokens de salida | Tokens de caché             | Coste equivalente                          | Líneas +/− | Archivos | Horas humanas            |
| ---------------------------------- | ----------------- | ---------------- | --------------------------- | ------------------------------------------ | ---------- | -------- | ------------------------ |
| 10 min, solo la revisión posterior | 47                | 19.868           | 3,5 M leída · 145 k escrita | sin calcular: el script no tiene su precio | +35 / −17  | 4        | ≈ 15 min, de la revisión |

Modelo: `claude-fable-5-2`. La sesión de la auditoría se cerró sin tomar sus métricas y no se pueden recuperar desde otra: su duración, sus tokens y sus horas humanas quedan sin medir. Las de la tabla son las de la revisión posterior, tomadas antes de la documentación del cierre.

## Commits

Los ejecutó el autor:

1. `966eadd` · `fix(functions): atomic limits, allowed AI hosts and open attempts (security review)`
2. `1f83b36` · `fix(data): mock services follow the rules of the function review (security review)`
3. `f2323ab` · `feat(tutor): prompt v6 names the forms of code it must not write (security review)`
4. `acdf32c` · `docs: record the security review of the Edge Functions (security review)`
5. `306da96` · `docs: note AI_ALLOWED_HOSTS and prompt v6 (security review)`
6. `5938b47` · `docs: the plan follows the limits of the function review (security review)`
7. `c94557b` · `docs: log of the security review of the Edge Functions (security review)`

De la revisión posterior:

8. `a3e0398` · `fix(tutor): the data of a query are taken once and the model call follows no redirect (security review)`
9. `27ece4e` · `docs: record the second look at the Edge Functions review (security review)`

## Para la presentación

- Un límite que lee y después escribe no limita: 70 peticiones a la vez pasaron 28 con el tope en 6.
- Un ajuste que decide adónde viaja una clave es parte de la clave: con una sesión de administración bastaba para llevársela.
- Lo que falta por demostrar: el prompt v6 y el validador contra el modelo real, con la batería de elusión.
