# Registro de trabajo y de uso de IA

Índice de todos los pasos del plan: una fila por paso, con enlace a su bitácora, donde está el detalle. El agente rellena su parte al cerrar el paso. Las horas humanas, la validación y el commit los rellena el humano.

Este registro alimenta el seguimiento de la planificación con horas reales, el apartado de uso de herramientas de IA de la memoria (1.8) y la presentación.

## Herramientas de IA usadas

- Claude Code (versión 2.1.319; modelo: …): implementación de los pasos del plan.
- Claude en Cowork (modelo configurado: `claude-opus-5-5`): planificación, revisión del plan y de la memoria, y guía de instalación.

## Registro

| Fecha      | Paso | Horas humanas | Tiempo de Claude    | Tokens (leídos / escritos)           | Coste equivalente | Qué hizo la IA                                                                                                                                | Cómo se validó                                 | Commit                        | Bitácora                             |
| ---------- | ---- | ------------- | ------------------- | ------------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------- | ------------------------------------ |
| 06/11/2026 | 0.0  | (rellenar)    | ≈ 3 h 10 min (chat) | ≈ 80 M / 0,42 M (≈ 11,2 M efectivos) | —                 | Revisión crítica del plan v3, comprobación de versiones y APIs contra los paquetes publicados, plan v4.1, bloque del `CLAUDE.md` y plantillas | Cada decisión la revisó y aprobó el autor      | —                             | [0.0](bitacora/0.0-planificacion.md) |
| 06/11/2026 | 0.1  | (rellenar)    | —                   | —                                    | —                 | Guía de instalación y resolución de incidencias en Windows (PATH, aprobación del MCP)                                                         | Comandos ejecutados y comprobados por el autor | `chore: scaffold` (pendiente) | [0.1](bitacora/0.1-workspace.md)     |

<!--
Ejemplo de fila:
| 10/11/2026 | 0.3 | 1,5 | 48 min | 1,2 M / 85 k | 3,10 $ | Instaló Material, generó el tema y el muestrario /dev/ui | Revisión visual en claro y oscuro; sin peticiones a Google Fonts | chore: theme | [0.3](bitacora/0.3-material-tema.md) |
-->
