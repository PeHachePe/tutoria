# Registro de trabajo y de uso de IA

Índice de todos los pasos del plan: una fila por paso, con enlace a su bitácora, donde está el detalle. El agente rellena su parte al cerrar el paso. Las horas humanas, la validación y el commit los rellena el humano.

Este registro alimenta el seguimiento de la planificación con horas reales, el apartado de uso de herramientas de IA de la memoria (1.8) y la presentación.

## Herramientas de IA usadas

- Claude Code (versión 2.1.319; modelo: `claude-opus-5-5`): implementación de los pasos del plan.
- Claude en Cowork (modelo configurado: `claude-opus-5-5`): planificación, revisión del plan y de la memoria, y guía de instalación.

## Registro

| Fecha      | Paso | Horas humanas | Tiempo de Claude           | Tokens (leídos / escritos)            | Coste equivalente | Qué hizo la IA                                                                                                                                                                                                                                               | Cómo se validó                                                                                             | Commit                        | Bitácora                                 |
| ---------- | ---- | ------------- | -------------------------- | ------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------- |
| 06/11/2026 | 0.0  | (rellenar)    | ≈ 3 h 10 min (chat)        | ≈ 80 M / 0,42 M (≈ 11,2 M efectivos)  | —                 | Revisión crítica del plan v3, comprobación de versiones y APIs contra los paquetes publicados, plan v4.1, bloque del `CLAUDE.md` y plantillas                                                                                                                | Cada decisión la revisó y aprobó el autor                                                                  | —                             | [0.0](bitacora/0.0-planificacion.md)     |
| 06/11/2026 | 0.1  | (rellenar)    | ≈ 1 h 26 min (Claude Code) | ≈ 38,4 M / 0,18 M (≈ 5,2 M efectivos) | —                 | Guía de instalación y resolución de incidencias en Windows (PATH, aprobación del MCP). En Claude Code: cierre del paso, revisión del plan contra Angular 22 (v4.2, D-002 a D-008), lint con las buenas prácticas de Angular y simplificación del `CLAUDE.md` | Comandos ejecutados y comprobados por el autor                                                             | `chore: scaffold` (pendiente) | [0.1](bitacora/0.1-workspace.md)         |
| 06/11/2026 | 0.2  | ≈ 1,3 h       | 38 min (Claude Code)       | 23,1 M / 90 k                         | 8,26 $            | Hooks que registran cada sesión en `eventos.jsonl`, script `npm run metrics` (tokens, coste, líneas y tests por paso) y 34 tests con TDD; decisión D-009. Iteraciones: cobertura del 100 % exigida en la app (D-010) y CI con GitHub Actions (D-011)         | Sesión de prueba: eventos y métricas correctos; aprobó el plan, D-010 y D-011; paró y mandó deshacer Husky | `chore: logbook` (pendiente)  | [0.2](bitacora/0.2-bitacora-metricas.md) |

<!--
Ejemplo de fila:
| 10/11/2026 | 0.3 | 1,5 | 48 min | 1,2 M / 85 k | 3,10 $ | Instaló Material, generó el tema y el muestrario /dev/ui | Revisión visual en claro y oscuro; sin peticiones a Google Fonts | chore: theme | [0.3](bitacora/0.3-material-tema.md) |
-->
