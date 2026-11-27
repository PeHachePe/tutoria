# Citas del chat y tono de la documentación

26–27/11/2026 · Sesión de Claude Code · Commit pendiente

## Objetivo

Que la documentación de `docs/` no reproduzca frases literales del chat entre el autor y Claude ni lo narre como una crónica de lo que el autor hizo o dijo, para que se pueda citar en la memoria del TFM con un tono profesional.

## Qué se pidió

- Detectar si algún fichero Markdown guardaba trozos literales de la conversación con Claude.
- Reescribirlos en estilo indirecto.
- Quitar también los detalles anecdóticos sobre las preferencias del autor.
- Iteración 2: revisar toda la documentación para que el tono sea neutro y profesional, sin crónica de «el autor preguntó…, dijo…» ni nada que lo deje en mal lugar.

## Qué hizo Claude

1. Buscó en todo el repositorio las citas atribuidas al autor y las frases coloquiales entre comillas. Encontró unas 330, todas en `docs/`. El código, los comentarios, los textos de la interfaz y la configuración estaban limpios.
2. Repartió la reescritura entre tres subagentes en paralelo: `DECISIONES.md` (91 citas), la bitácora (unas 210 en 64 ficheros) y `REGISTRO.md`, `PENDIENTES.md` y las fichas (33).
3. Las aprobaciones («Adelante», «Sí, ciérralo»…) se reducen a «aprobó el plan» o «cerró el paso». Las peticiones y las críticas pasan a estilo indirecto, con el mismo contenido.
4. Se mantienen entre comillas los textos de la interfaz y los mensajes de prueba escritos en la app haciendo de alumno («PIKACHU», «no me acuerdo»…), porque son datos del producto y explican los cambios del tutor.
5. El «por ahora» de la regla de pendientes pasa a «de forma provisional».
6. Quitó las anécdotas sobre los gustos del autor en D-037, en la bitácora del 1.8 y en la del 6.1a. D-037 pasa a titularse «… y reacciones de broma».
7. Los «al autor no le gustaba X» pasan a ser el motivo de diseño del cambio («las tarjetas no escalaban, porque puede haber 20»).
8. **Iteración 2:** tres subagentes revisaron el tono de `DECISIONES.md`, las 87 bitácoras, `REGISTRO.md` y `PENDIENTES.md` (unas 735 frases en 86 ficheros). La crónica pasa a un estilo impersonal centrado en el problema y la solución. Se quitan las dudas, quejas, correcciones y detalles domésticos del autor. Las líneas «Aprobación:» y la validación humana quedan sobrias. Las decisiones de producto del autor se mantienen con una sola mención y los fallos de Claude se conservan, porque sirven a la memoria. Las menciones a «el autor» bajan de unas 810 a 480.
9. Añadió la regla a `CLAUDE.md` (punto 4 del cierre de paso) y a `docs/bitacora/_plantilla.md`: la validación y lo pedido se escriben en estilo indirecto, sin citas literales del chat. En la iteración 2 la regla de `CLAUDE.md` se amplió al tono: neutro, impersonal y sin crónica.

## Comandos e instalaciones

| Comando                             | Para qué              |
| ----------------------------------- | --------------------- |
| `npm run format`                    | Realinear las tablas  |
| `npm run metrics -- limpieza-citas` | Métricas de la sesión |

## Archivos creados o modificados

- Nuevo: `docs/bitacora/limpieza-citas.md`.
- Modificados: `CLAUDE.md`, `docs/DECISIONES.md`, `docs/REGISTRO.md`, `docs/PENDIENTES.md`, `docs/PLAN.md` (una línea), `docs/screens/11-grupos.md`, `docs/bitacora/_plantilla.md` y 82 bitácoras.

## Problemas y cómo se resolvieron

- El subagente de la bitácora se detuvo por el límite de uso y se reanudó con su contexto cuando se restableció.
- En la iteración 2 dos subagentes compartían la carpeta temporal y uno sobrescribió el script del otro a mitad del trabajo. Las ediciones se aplicaron con reemplazos exactos que comprobaban cada frase, así que no hubo daños. Para otra vez, una carpeta por subagente.
- `npm run metrics` sin `--session` midió otra sesión abierta a la vez en el proyecto. Se borró su fila y se midió esta sesión con `--session`.
- Algunas citas eran ambiguas: términos de Claude por los que preguntó el autor, o mensajes al tutor durante las pruebas. Se dejaron las que no son palabras del autor dirigidas a Claude.

## Decisiones

Ninguna técnica. La regla de estilo queda en `CLAUDE.md` y en la plantilla de la bitácora.

## Tests

No cambia código. `npm run format` aplicado.

## Validación humana

Revisión pedida por el autor; reescritura de las citas aprobada. Iteración 2: ampliada a todo el tono de la documentación. Muestras revisadas por Claude en el diff, con algunas frases corregidas (fórmulas de aprobación forzadas y frases sin sujeto).

## Capturas

No es una pantalla.

## Métricas

| Duración                                                                  | Tokens de entrada | Tokens de salida | Tokens de caché                | Coste equivalente | Líneas +/−  | Archivos | Horas humanas            |
| ------------------------------------------------------------------------- | ----------------- | ---------------- | ------------------------------ | ----------------- | ----------- | -------- | ------------------------ |
| ≈ 1 h de trabajo (18 h 41 min medidos, con la pausa por el límite de uso) | 533               | 300 k            | 33,4 M leídos / 1,7 M escritos | 22,13 $           | +792 / −806 | 86       | ≈ 1 h 15 min (estimadas) |

Incluye los seis subagentes.

## Para la presentación

La documentación generada con un agente tiende a transcribir el chat. También tiende a narrar como una crónica lo que hizo y dijo el autor. En la revisión, unas 330 citas pasaron a estilo indirecto y unas 735 frases a un tono neutro, y la regla pasó a las instrucciones del agente.
