# Plan · La aplicación completa en la PEC3

09/11/2026 · Sesión de Claude Code · Commit (abajo)

## Objetivo

Reordenar el plan para entregar la aplicación completa en la PEC3 y dejar la PEC4 para el feedback, la versión 1.0 y la defensa.

## Qué se pidió

- Cuántos pasos quedan, yendo por el 1.7.
- Aclarar qué piden la PEC3 y la PEC4: la beta, el vídeo de 5 minutos de la PEC3 y el vídeo de defensa de la PEC4, con sus 5 minutos de demo.
- «Mi idea es de cara a la pec 3 tener la app acabada».

## Qué hizo Claude

1. Contó los pasos que quedan: 26 contando el 1.7 (23 obligatorios), unas 96 h de plan.
2. Contrastó los enunciados de la PEC3 y la PEC4 (fuera del repositorio) con el plan: la PEC3 pide una beta, que puede no estar terminada, y un vídeo de demo de 5 minutos; la PEC4, el proyecto acabado y un vídeo de unos 20 minutos con 5 de demo en directo, sin cortes y con el estudiante en cámara.
3. Comparó las horas reales del registro con las estimadas (parecidas) para ver que el nuevo objetivo cabe: unas 90 h en cuatro semanas.
4. Pasó el plan a la v4.4: hitos y reparto por semanas (sección 1), orden de ejecución del bloque A, pasos 3.2 y 7.4, y tabla de riesgos.
5. Propuso D-032.

## Comandos e instalaciones

| Comando                                                | Para qué                  |
| ------------------------------------------------------ | ------------------------- |
| `npx prettier --write docs/PLAN.md docs/DECISIONES.md` | Formato de los documentos |
| `npm run metrics -- plan-pec3 --session <id>`          | Métricas de esta sesión   |

## Archivos creados o modificados

- Modificados: `docs/PLAN.md`, `docs/DECISIONES.md` y `docs/REGISTRO.md`.
- Nuevo: esta bitácora.

## Problemas y cómo se resolvieron

- El autor creía que la PEC3 pedía la versión final. El enunciado pide una beta; el objetivo de llegar con la aplicación completa se fijó igualmente, por la carga de la PEC4.
- Había trabajo del 1.7 sin confirmar en el árbol: las métricas del repositorio de esta sesión lo incluyen. Lo de esta sesión son solo los tres documentos (+63 / −33 líneas en el plan y las decisiones).

## Decisiones

- [D-032](../DECISIONES.md): la aplicación completa en la PEC3.

## Tests

Sin cambios de código: unitarios 661 · e2e 38.

## Validación humana

El autor fijó el objetivo en el chat. Pendiente: que revise el plan v4.4 y el orden de recorte.

## Capturas

No aplica.

## Métricas

| Duración | Tokens de entrada | Tokens de salida | Tokens de caché | Coste equivalente | Líneas +/− | Archivos | Horas humanas |
| -------- | ----------------- | ---------------- | --------------- | ----------------- | ---------- | -------- | ------------- |
| 9 min    | 53                | 15,8 k           | 1,78 M / 55,7 k | 1,12 $            | +63 / −33  | 3        | ≈ 0,3 h       |

## Para la presentación

A los tres días de empezar, el ritmo real permitió adelantar el objetivo: la PEC3 pasa de entregar la capa 1 a entregar la aplicación completa.
