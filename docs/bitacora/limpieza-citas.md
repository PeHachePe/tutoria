# Limpieza de citas del chat en la documentación

26–27/11/2026 · Sesión de Claude Code · Commit pendiente

## Objetivo

Que la documentación de `docs/` no reproduzca frases literales del chat entre el autor y Claude ni anécdotas sobre sus gustos personales, para que se pueda citar en la memoria del TFM con un tono profesional.

## Qué se pidió

- Detectar si algún fichero Markdown guardaba trozos literales de la conversación con Claude.
- Reescribirlos en estilo indirecto.
- Quitar también los detalles anecdóticos e innecesarios sobre las preferencias del autor.

## Qué hizo Claude

1. Buscó en todo el repositorio las citas atribuidas al autor y las frases coloquiales entre comillas. Encontró unas 330, todas en `docs/`. El código, los comentarios, los textos de la interfaz y la configuración estaban limpios.
2. Repartió la reescritura entre tres subagentes en paralelo: `DECISIONES.md` (91 citas), la bitácora (unas 210 en 64 ficheros) y `REGISTRO.md`, `PENDIENTES.md` y las fichas (33).
3. Las aprobaciones («Adelante», «Sí, ciérralo»…) se reducen a «aprobó el plan» o «cerró el paso». Las peticiones y las críticas pasan a estilo indirecto, con el mismo contenido.
4. Se mantienen entre comillas los textos de la interfaz y los mensajes de prueba escritos en la app haciendo de alumno («PIKACHU», «no me acuerdo»…), porque son datos del producto y explican los cambios del tutor.
5. El «por ahora» de la regla de pendientes pasa a «de forma provisional».
6. Quitó las anécdotas sobre los gustos del autor en D-037, en la bitácora del 1.8 y en la del 6.1a. D-037 pasa a titularse «… y reacciones de broma».
7. Añadió la regla a `CLAUDE.md` (punto 4 del cierre de paso) y a `docs/bitacora/_plantilla.md`: la validación y lo pedido se escriben en estilo indirecto, sin citas literales del chat.

## Comandos e instalaciones

| Comando                             | Para qué              |
| ----------------------------------- | --------------------- |
| `npm run format`                    | Realinear las tablas  |
| `npm run metrics -- limpieza-citas` | Métricas de la sesión |

## Archivos creados o modificados

- Nuevo: `docs/bitacora/limpieza-citas.md`.
- Modificados: `CLAUDE.md`, `docs/DECISIONES.md`, `docs/REGISTRO.md`, `docs/PENDIENTES.md`, `docs/PLAN.md` (una línea), `docs/screens/11-grupos.md`, `docs/bitacora/_plantilla.md` y 64 bitácoras.

## Problemas y cómo se resolvieron

- El subagente de la bitácora se detuvo por el límite de uso y se reanudó con su contexto cuando se restableció.
- Algunas citas eran ambiguas: términos de Claude por los que preguntó el autor, o mensajes al tutor durante las pruebas. Se dejaron las que no son palabras del autor dirigidas a Claude.

## Decisiones

Ninguna técnica. La regla de estilo queda en `CLAUDE.md` y en la plantilla de la bitácora.

## Tests

No cambia código. `npm run format` aplicado.

## Validación humana

El autor pidió la revisión y aprobó reescribir las citas. Durante la reescritura pidió quitar también los detalles anecdóticos sobre sus preferencias.

## Capturas

No es una pantalla.

## Métricas

| Duración                                                             | Tokens de entrada | Tokens de salida | Tokens de caché                | Coste equivalente | Líneas +/−  | Archivos | Horas humanas        |
| -------------------------------------------------------------------- | ----------------- | ---------------- | ------------------------------ | ----------------- | ----------- | -------- | -------------------- |
| ≈ 30 min de trabajo (18 h 5 min medidos, con la pausa por el límite) | 257               | 127 k            | 14,5 M leídos / 966 k escritos | 10,87 $           | +311 / −311 | 71       | ≈ 40 min (estimadas) |

Los tokens no incluyen los de los tres subagentes (≈ 540 k en total).

## Para la presentación

La documentación generada con un agente tiende a transcribir el chat. Revisarla al final dejó unas 330 citas en estilo indirecto, y la regla pasó a las instrucciones del agente.
