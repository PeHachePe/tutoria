# Preparación del entorno en Windows

10/11/2026 · Sesión de Claude Code · Commit propuesto: `test(routes): mark the data notice as seen (windows setup)`

## Objetivo

Dejar el equipo Windows listo para la fase 2, que necesita Supabase en local (y, por tanto, Docker), antes de empezar el paso 2.4.

## Qué se pidió

- Saber en qué paso va el proyecto y qué hace falta en local para el 2.4.
- Descartar Ollama por ahora y usar un proveedor externo (Gemini).
- Instalar Docker, que el equipo no tenía, y comprobar que todo está listo para trabajar.

## Qué hizo Claude

1. Comprobó que el siguiente paso es el 2.4 (tutor real) y que el equipo no tenía WSL ni Docker.
2. Indicó la instalación: `wsl --install` y reinicio, Docker Desktop con WSL 2 (por `winget`) y primer arranque hasta «Engine running».
3. Ante el aviso de la protección LSA de Windows, recomendó dejarla activada: ni WSL ni Docker la necesitan desactivada.
4. Diagnosticó con el registro de Docker Desktop un primer arranque cortado mientras formateaba su disco, sin error; el autor lo abrió de nuevo y arrancó.
5. Arrancó Supabase local por primera vez (`db:start`: imágenes, seis migraciones y seed) y revisó los contenedores. El de `vector` (registros para Studio) se reinicia en bucle en Windows, sin efecto en el desarrollo.
6. Comprobó Node 24.19, la CLI de Supabase 3.1.0, Deno 2.5.6, `check` y `db:test`.
7. Un test de `app.routes.spec.ts` fallaba solo con la batería completa: el alumno de prueba no ha visto el aviso de datos, que el layout abre en `afterNextRender`, y en un equipo cargado el diálogo ya estaba abierto al buscar el `h1` y ocultaba la página. El spec da ahora el aviso por visto, porque comprueba las rutas, no el aviso (que ya prueban sus propios tests).
8. Sacó del comentario del ejemplo, en `REGISTRO.md`, las filas del 2.1 al 2.3, que no se veían en la tabla.

## Comandos e instalaciones

| Comando                                       | Para qué                                                 |
| --------------------------------------------- | -------------------------------------------------------- |
| `wsl --install`                               | WSL 2, que necesita Docker Desktop (lo ejecutó el autor) |
| `winget install -e --id Docker.DockerDesktop` | Docker Desktop (lo ejecutó el autor)                     |
| `npm run db:start`                            | Primer arranque de Supabase local                        |
| `npm run check` y `npm run db:test`           | Comprobar el entorno completo                            |

## Archivos creados o modificados

- `src/app/app.routes.spec.ts`: el aviso de datos se da por visto.
- `docs/REGISTRO.md`: filas del 2.1 al 2.3 fuera del comentario y fila de esta sesión.
- `docs/bitacora/entorno-windows.md` y `docs/bitacora/metricas.csv`.

## Problemas y cómo se resolvieron

- **Docker Desktop se cerraba en el primer arranque:** el registro mostraba que se cortó al preparar su disco; al abrirlo de nuevo y esperar, arrancó.
- **Test de rutas intermitente:** carrera con el aviso de datos, resuelta en el spec (punto 7).
- **Contenedor `vector` reiniciándose:** sin resolver, porque no hace falta para desarrollar.

## Decisiones

Ninguna nueva.

## Tests

Unitarios: 968 (nuevos: 0) · e2e: 38 · Deno: 34 · pgTAP: 72

## Validación humana

El autor instaló WSL y Docker siguiendo las indicaciones y abrió Docker Desktop. Claude lo comprobó con `docker info`, `db:start`, `check` (968 tests, cobertura del 100 %) y `db:test` (72 tests).

## Capturas

No aplica.

## Métricas

| Duración | Tokens de entrada | Tokens de salida | Tokens de caché        | Coste equivalente | Líneas +/− | Archivos | Horas humanas |
| -------- | ----------------- | ---------------- | ---------------------- | ----------------- | ---------- | -------- | ------------- |
| 31 min   | 97                | 13.943           | 3.951.465 L / 69.582 E | 1,63 $            | +5 / −1    | 1        | ≈ 1 h         |

## Para la presentación

Pasar a Windows destapó una carrera en un test que en el Mac nunca fallaba: un equipo más lento también sirve para probar.
