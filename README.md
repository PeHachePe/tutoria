# TutorIA

Aplicación web de ejercicios de programación autoevaluables, con un tutor de IA que da pistas graduadas sin entregar nunca la solución y un panel docente con analítica formativa. Es un Trabajo Fin de Máster, construido paso a paso con un agente de codificación (Claude Code) bajo supervisión humana.

- **Aplicación publicada:** <https://tutoria-rosy.vercel.app>
- **Tecnología:** Angular 22 (signals, zoneless, Signal Forms), Angular Material y Tailwind, Supabase (Postgres, autenticación y Edge Functions) y driver.js para la ayuda guiada.

## Manual de usuario

Un manual por perfil, generado desde las tareas guiadas de la propia aplicación, con el texto de cada globo y su captura, para leer aquí o en PDF:

- Alumnado: [en línea](docs/manual/alumno.md) · [PDF](docs/manual/alumno.pdf)
- Profesorado: [en línea](docs/manual/docente.md) · [PDF](docs/manual/docente.pdf)
- Administración: [en línea](docs/manual/administracion.md) · [PDF](docs/manual/administracion.pdf)

## Documentación del proyecto

- [Plan de desarrollo](docs/PLAN.md): la especificación, las decisiones de arquitectura y los pasos.
- [Decisiones](docs/DECISIONES.md): cada decisión técnica y de producto, con su contexto y sus alternativas.
- [Registro de trabajo y de uso de IA](docs/REGISTRO.md) y [bitácora](docs/bitacora/) de cada paso, con sus [capturas](docs/capturas/).
- [Fichas de pantalla](docs/screens/) y [despliegue](docs/DESPLIEGUE.md).
- **Diario del proyecto:** `npm run diary` genera en `dist/diary/` una web con todo lo anterior (un tablero con cada paso, las cifras, la evolución de las pantallas y las decisiones) y la presentación del proyecto; `npm run diary -- --pdf` añade las láminas en PDF.

## Arrancarla en local

Con Node 24 o 26:

```sh
npm install
npm start
```

`npm start` abre la aplicación en <http://localhost:4200> con datos simulados, sin nada más que instalar; la barra de desarrollo permite entrar con cada perfil. Contra una base de datos de verdad, con Docker abierto: `npm run db:start` y `npm run start:local` (detalles en [DESPLIEGUE.md](docs/DESPLIEGUE.md)).

| Comando               | Qué hace                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `npm run check`       | Formato, lint, tests unitarios (cobertura del 100 %), de scripts y de las Edge Functions |
| `npm run e2e`         | Tests end-to-end con Playwright                                                          |
| `npm run manual`      | Vuelve a generar los manuales de usuario, en Markdown y PDF (`-- alumno` para uno solo)  |
| `npm run screenshots` | Capturas de las pantallas para la memoria                                                |
| `npm run db:reset`    | Supabase local desde cero: migraciones y datos de demostración                           |
