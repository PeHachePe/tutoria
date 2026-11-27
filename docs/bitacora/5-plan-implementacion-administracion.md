# Fase 5 (plan) · Plan de implementación de la administración

17/11/2026 · Sesión de Claude Code (`claude-fable-5-2`) · `3347ba9`

## Objetivo

Dejar escrita en `docs/PLAN.md` la fase 5 (usuarios, grupos y matrícula, y sistema) con un plan de implementación tan concreto que otra sesión pueda hacer cada subpaso sin decidir nada: ficheros, firmas y tipos, reglas, textos de la interfaz en los tres idiomas, tests en orden TDD y dudas resueltas.

## Qué se pidió

- Aprovechar la sesión para planificar lo que aún no tenía plan detallado. De lo que faltaba (fase 5, 4.4, 4.5, 4.2b y fase 7), el agente propuso la fase 5 por ser el bloque más grande sin desglosar y el más delicado (cuentas, `service_role` y RLS), y el autor la eligió.
- Sin implementar nada ni tocar código.

## Qué hizo Claude

1. Leyó la fase 5, §2.2, §2.3, §2.10, §4.8, §5.2 y §5.4 del plan, los pendientes que apuntan a la fase 5 y las decisiones que la tocan (D-041, D-046, D-058, D-060 y D-063).
2. Contrastó la fase con la memoria del TFM: CU-06 (el correo repetido y el rol propio), CU-07 (las alternativas, la prueba de conexión y que un fallo mantiene el proveedor anterior), RF-16, RF-18 y RF-19.
3. Leyó el código que se toca: `AdminService` (sin ninguna versión todavía), los tipos de usuario, grupo y proveedor, la base simulada y sus reglas de acceso, `MockAuthService`, el servicio y la pantalla de bloques como patrón, las rutas, el esquema y las políticas de `app_user`, `class_group`, `enrollment`, `subject` y `app_setting`, el disparador de las cuentas nuevas, y la función `translate` con sus piezas compartidas como patrón de las funciones nuevas.
4. Partió la fase en cinco subpasos (5.1a, 5.1b, 5.2a, 5.2b y 5.3) que suman las mismas 10 horas, cada uno con los datos simulados y los reales, y escribió en cada uno su bloque «Plan de implementación».
5. Comprobó en los tipos de Angular 22 que `debounced()` es experimental y lo dejó fuera del buscador de alumnos.
6. Formateó `docs/PLAN.md` con Prettier.

## Comandos e instalaciones

| Comando                                    | Para qué                    |
| ------------------------------------------ | --------------------------- |
| `npx prettier --write docs/…`              | Formato de la documentación |
| `npm run metrics -- 5-plan --session <id>` | Métricas de la sesión       |

## Archivos creados o modificados

- `docs/PLAN.md`: la fase 5 entera.
- `docs/bitacora/5-plan-implementacion-administracion.md`, `docs/REGISTRO.md` y `docs/bitacora/metricas.csv`.

## Problemas y cómo se resolvieron

- **Las tres fichas de la fase (`10`, `11` y `12`) no existen.** Cada sesión de pantalla escribe primero la suya con la plantilla, a partir de su plan, y el autor la valida con el plan corto.
- **`AdminService` no tiene ninguna versión y mezcla lo del administrador con lo del docente.** Los grupos y la matrícula pasan a `GroupService`; `AdminService` se queda con las cuentas, las asignaturas y el proveedor.
- **Hoy solo el administrador puede escribir en `class_group` y en `enrollment`,** y un docente no lee a los alumnos que no son suyos: el 5.2a trae la migración con las políticas del docente y una RPC de búsqueda acotada.
- **Las reglas de las cuentas harían falta dos veces** (en la función y en los datos simulados): van a un fichero sin importaciones que comparten, como el contrato del tutor.
- **Degradar a un docente con grupos los dejaría sin nadie que los gestione,** porque `teaches_group()` exige el rol: el rol solo se cambia a quien no tiene grupos ni matrículas.
- **En los datos simulados todas las cuentas comparten contraseña:** una cuenta creada en la demo no podría entrar con la suya. La base simulada gana una tabla de contraseñas.
- **La gestión de asignaturas estaba pendiente «para la fase 5» y ningún paso la recogía:** entra en el 5.3, junto al proveedor.
- **La prueba de conexión no puede hacerse desde el navegador,** que no tiene las claves: es una función nueva (`ai-check`) que prueba el borrador sin guardarlo y distingue el servidor no permitido, el secreto que falta y cada respuesta del proveedor.

## Decisiones

Ninguna escrita todavía en `docs/DECISIONES.md`: el plan deja redactada **D-072** para proponerla al cerrar el 5.1a (y ampliarla en el 5.2a y el 5.3):

- la baja de una cuenta es el bloqueo en Auth más `status = disabled`, y se acepta que Auth revele que un correo está dado de baja (el pendiente del 2.2), a cambio de un mensaje claro;
- el rol solo se cambia a quien no tiene grupos ni matrículas;
- el correo no se cambia y la aplicación no envía correos: la contraseña la pone y la restablece la administración;
- el docente busca alumnos de todo el centro con una RPC acotada (dos letras y 20 resultados);
- un grupo no cambia de asignatura y solo se borra si nadie ha empezado nada en él;
- el proveedor de IA solo se guarda después de probarlo.

## Tests

Unitarios: 1841 (nuevos: 0) · e2e: 39. Sesión sin código. No se ejecutó `npm run check`: solo Prettier sobre la documentación cambiada.

## Validación humana

- El autor eligió la fase 5 entre las opciones que propuso el agente.
- Recibió el resumen de las decisiones tomadas por el agente (las de D-072, la partición en cinco subpasos y que las asignaturas entren en el 5.3) y ejecutó el commit sin pedir cambios.

## Capturas

No hay: la sesión no toca ninguna pantalla.

## Métricas

Medidas antes de escribir esta bitácora.

| Duración                          | Tokens de entrada | Tokens de salida | Tokens de caché             | Coste equivalente                 | Líneas +/− | Archivos | Horas humanas |
| --------------------------------- | ----------------- | ---------------- | --------------------------- | --------------------------------- | ---------- | -------- | ------------- |
| ≈ 10 min de trabajo (Claude Code) | 54                | 49.661           | 3,8 M leída · 179 k escrita | sin calcular (`claude-fable-5-2`) | +374 / −12 | 1        | ≈ 13 min      |

## Para la presentación

- La fase de administración pasa de tres pasos con siete viñetas a cinco subpasos con sus ficheros, firmas, reglas y tests, sin cambiar sus 10 horas.
- Planificar antes de escribir código sacó a la luz lo que el plan no decía: que el docente no podía escribir en sus propios grupos, que cambiar un rol podía dejar grupos huérfanos y que las asignaturas no tenían pantalla.
