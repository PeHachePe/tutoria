# Pendiente de hoy (19/11/2026) · fichero temporal

Lo que queda del paso 6.1a (voz: síntesis), para hacerlo desde otro equipo. Cuando esté hecho, se pasa lo que quede a `PENDIENTES.md` y **este fichero se borra**.

## 1. Revisión del 6.1a con esfuerzo alto

La revisión de la iteración 4 se hizo en la misma sesión larga del paso. La revisión en alto con `/code-review` empezó y se interrumpió sin resultados.

- **Qué hacer:** en una sesión nueva con esfuerzo alto, `/code-review high` sobre los commits del paso. Después, corregir lo que salga como **iteración 5**: tests, `npm run check` en verde, la bitácora al día y su commit.
- **Alcance:** solo los ficheros de la voz. El rango `3266d9a..HEAD` incluye también commits de otra sesión (5.2a y 5.3a: grupos, sistema, Supabase), que no son de este paso:
  - `src/app/core/speech/` (todo)
  - `src/app/student/settings/` (`settings-store`, `student-voice`, `settings-page`)
  - `src/app/student/workspace/tutor-speaker.ts`, `tutor/tutor-panel.*`, `workspace-page.ts`, `workspace-layout.ts`, `workspace.routes.ts`
  - `src/app/shared/mascot/` y `src/app/dev/showcase/showcase-page.ts` (estado «hablando»)
  - los textos `settings.voice.*` y `tutor.voice.*` de `src/locale/`
- **Dónde mirar con más cuidado:**
  - `TutorSpeaker`: el `effect()`, la cola, `isNew()` con reintentos y silencios, y las carreras entre `stop()` y una frase que acaba tarde.
  - `StudentVoice`: los dos `resource()`, `onVoicesChanged` y la prueba de voz (`sampling`).
  - `speakableSentences()` con respuestas parciales.
  - `voice-quality.ts`: los nombres de las voces de macOS en otros idiomas.
- **Documentación de referencia:** §2.11 del plan, las fichas 04 y 05, D-071 y D-078, y `docs/bitacora/6.1a-voz-sintesis.md`.

## 2. Probar la voz en Edge y Firefox

Activar la voz, contar las voces del español, mirar cuál sale por defecto y oír una respuesta. Después, completar la columna de síntesis de la tabla de motores (§2.11) y quitar la fila de `PENDIENTES.md`.

## 3. Cerrar

- Apuntar los hashes y las métricas de la iteración 5 en la bitácora y en `REGISTRO.md`.
- Borrar este fichero.
- Siguiente paso: el 6.1b (dictado), en una sesión nueva.
