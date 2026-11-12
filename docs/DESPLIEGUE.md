# Despliegue en la nube

Guía del paso 3.1: la aplicación publicada en Supabase (base de datos, autenticación y Edge Functions) y en Vercel (el front), con planes gratuitos. Cada paso dice quién lo hace, qué comandos lanzar y cómo comprobar que ha ido bien antes de pasar al siguiente. Los comandos valen igual en macOS (zsh) y en Windows (PowerShell), salvo donde se indica.

Lo que es público por diseño (la URL del proyecto y la clave publicable) va en el código; los secretos (la contraseña de la base, las claves de la IA, `service_role` y las contraseñas de las cuentas) nunca salen de tu equipo, del gestor de contraseñas o de los secretos de Supabase (D-053).

## Antes de empezar

- Cuenta en [supabase.com](https://supabase.com) y en [vercel.com](https://vercel.com). Vercel ya tiene el proyecto conectado al repositorio desde el paso 1.10.
- Docker no hace falta para desplegar. La CLI de Supabase va en `node_modules`, así que siempre se llama con `npx supabase`.
- La clave de Gemini en `supabase/functions/.env` (`AI_API_KEY`), la misma que usa el tutor en local.

## 1 · Crear el proyecto de Supabase · tú

En el panel de Supabase, **New project** (si es la primera vez, antes una organización con el plan Free). Cada opción, con su motivo; las marcadas con 🔒 no se pueden cambiar después:

| Opción                          | Valor                                     | Por qué                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nombre                          | `TutorIA`                                 | Solo se ve en el panel; la CLI y la app usan el _Project ref_, que genera Supabase.                                                                                                                                                                                                                                                             |
| Contraseña de la base           | La genera el panel                        | Va al gestor de contraseñas, nunca al repositorio ni al chat.                                                                                                                                                                                                                                                                                   |
| 🔒 Región                       | **Frankfurt (eu-central-1)**, no «Europe» | «Europe» deja elegir a Supabase y puede acabar en Londres, fuera de la UE. Con Frankfurt, los datos de los alumnos se quedan en la UE (RGPD) y el aviso de datos y la memoria lo pueden decir sin matices. Desde España, la latencia es la misma.                                                                                               |
| Plan                            | Free                                      | Todo en planes gratuitos (D-053).                                                                                                                                                                                                                                                                                                               |
| 🔒 Postgres Type                | **Postgres** (el de por defecto)          | OrioleDB está en beta y no se recomienda en producción; el Supabase local usa el Postgres normal, así que la nube queda igual que lo probado.                                                                                                                                                                                                   |
| Enable Data API                 | Activada                                  | `supabase-js` va por ella: sin ella la app no funciona.                                                                                                                                                                                                                                                                                         |
| Automatically expose new tables | **Activada**, pese a la recomendación     | Las migraciones ya quitan todos los permisos a `anon` y `authenticated` y dan solo los justos, tabla a tabla y columna a columna (`row_level_security.sql`). Desactivada, `service_role` podría quedarse también sin permisos, y las Edge Functions leen tablas con él. Activada, la nube es igual que el Supabase local de los tests de pgTAP. |
| Enable automatic RLS            | Activada                                  | Red de seguridad: las migraciones ya activan RLS en cada tabla, pero protege si alguien crea una a mano desde el panel. Añade la función `rls_auto_enable()`, que el paso 3 cierra a la API.                                                                                                                                                    |
| Conectar con GitHub             | **No** (se puede hacer más tarde)         | Con la integración, Supabase aplicaría las migraciones solo en cada push a `master`, sin revisión. Aquí cada cambio en la nube lo lanza el autor con la CLI. Las ramas de base de datos, lo que más aporta, son de pago.                                                                                                                        |

Después, pásale a Claude estos tres valores, que son públicos:

- el **Project ref** (Project Settings → General, «Project ID»; también sale en la URL del panel);
- la **publishable key** (Project Settings → API Keys, la que empieza por `sb_publishable_`);
- la **URL de Vercel** (la del paso 1.10).

Nunca la contraseña de la base, la _secret key_ (`sb_secret_…`) ni la `service_role`. Claude pone los tres valores en `src/environments/environment.ts`, en la CSP de `vercel.json` y en el bloque `[remotes.production]` de `supabase/config.toml`.

✅ El proyecto aparece como _Healthy_ en el panel.

## 2 · Conectar la CLI · tú

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <ref>
```

`login` abre el navegador para autorizar la CLI. Con la CLI v3, `link` usa esa sesión y no pide la contraseña de la base: solo la pediría un comando que tuviera que conectarse a la base directamente.

✅ `npx supabase projects list` muestra `TutorIA` con `linked: true`, región `eu-central-1`, estado `ACTIVE_HEALTHY` y Postgres 17, la misma versión mayor que en local (`major_version` de `config.toml`).

## 3 · Migraciones · tú o Claude, con tu OK

```bash
npx supabase db push --remote
```

Aplica todas las migraciones de `supabase/migrations/` y pide confirmación.

✅ `npx supabase migration list --remote` muestra las mismas migraciones en las columnas _Local_ y _Remote_.

Después, los avisos de seguridad y rendimiento de Supabase sobre la base en la nube (solo lectura):

```bash
npx supabase db advisors --remote
```

Lo que se espera y por qué:

- **`rls_auto_enable()` ejecutable sin sesión:** la crea la opción «Enable automatic RLS». Solo la necesita su _event trigger_, así que la migración `cloud_rls_auto_enable` le quita el permiso; no hace nada en local, donde no existe. Si aparece, falta subir esa migración con otro `db push --remote`.
- **Funciones `SECURITY DEFINER` ejecutables por `authenticated`** (`is_admin`, `teaches_group`, `open_attempt`, `submit_attempt`…): intencionado desde el paso 2.1. Son las ayudas de las RLS y las RPC de los intentos, y solo responden sobre el propio usuario.
- **Varias políticas permisivas en una tabla:** aviso de rendimiento, sin efecto con los datos de un aula (en pendientes, para el pulido).

## 4 · Autenticación · tú o Claude, con tu OK

```bash
npx supabase config diff
```

```bash
npx supabase config push
```

`diff` enseña lo que va a cambiar: revísalo antes del `push`, que pide confirmación. Lo que debe salir, y nada más:

- `enable_signup` → `false`: el registro público, cerrado (las cuentas las crea el seed y, más adelante, la administración);
- `site_url` y `additional_redirect_urls` → la URL de Vercel (venían con `localhost:3000`);
- las confirmaciones por correo y SMS y el MFA por TOTP, desactivados: la app no los usa y las cuentas ya nacen confirmadas;
- `password_requirements` (solo local) y `storage.vector` (solo en la nube, no declarado): no cambian nada.

Lo que en local es cómodo para desarrollar se queda en la nube con los valores de Supabase, fijados en `[remotes.production]`: un correo como mucho por minuto, códigos de 8 cifras y el _pooler_ que Supabase dimensiona para la instancia (15 conexiones por usuario y 200 clientes). Sin ellos, el `push` los habría cambiado por los locales.

✅ `npx supabase config diff` ya no muestra diferencias (salvo `storage.vector`). En el panel, Authentication → Sign In / Providers: _Allow new users to sign up_ desactivado; en URL Configuration, la URL de Vercel.

## 5 · Secretos de las Edge Functions · tú

```bash
npx supabase secrets set --env-file supabase/functions/.env --remote
```

Sube las claves de la IA (`AI_API_KEY` y las de respaldo, D-044). `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya las pone Supabase.

Lo lanza el autor: lee `supabase/functions/.env`, que el agente no toca.

✅ `npx supabase secrets list --remote` muestra `AI_API_KEY` (solo el nombre y un resumen, nunca el valor). Las variables de Supabase no salen en la lista: se inyectan solas en las funciones.

## 6 · Edge Functions · tú o Claude, con tu OK

```bash
npx supabase functions deploy --remote
```

Despliega `execute` y `tutor`. Las dos importan ficheros de `src/app/data/` (los contratos compartidos con la app); si la CLI no los empaqueta, el despliegue falla con un error de módulo no encontrado: pásaselo a Claude.

La CLI las empaqueta bien (1,2 MB `execute` y 1,9 MB `tutor`, con QuickJS). Avisa de que `import_map` en `config.toml` ya no se admite como opción; no afecta, porque Deno encuentra solo el `deno.json` de `supabase/functions/`.

✅ `npx supabase functions list --remote` muestra las dos como _ACTIVE_ y con `verify_jwt`: una petición sin sesión a `/functions/v1/execute` responde 401.

Cada cambio en las funciones necesita otro `functions deploy --remote`: el push a `master` solo publica el front. Ojo: sube los ficheros del disco, no lo que hay en GitHub, aunque no estén en un commit; si nada ha cambiado desde el último despliegue, dice «No change found» y la versión no sube.

## 7 · Datos y cuentas · tú

```bash
npm run seed -- --cloud
```

```bash
npx supabase db query --remote -f tmp/cloud/seed.sql
```

El primero escribe en `tmp/cloud/` (ignorado por git) el mismo contenido e historial que el seed local, con una contraseña aleatoria de 24 caracteres para cada cuenta, y `accounts.csv` con todas. El segundo lo carga en la nube.

1. Guarda en tu gestor las cuentas que vas a usar: la administración (`admin@tutoria.test`), la docente Marta (`marta.ibanez@tutoria.test`), cuatro estudiantes con historial (Lucía, Hugo, Aya y Daniel) y Lucas (`lucas.ortiz@tutoria.test`), sin historial, para el smoke del paso 9.
2. Borra la carpeta: `rm -rf tmp/cloud` en macOS o `Remove-Item -Recurse tmp/cloud` en Windows.

Las contraseñas solo están en `accounts.csv`, no salen en la terminal. Si se borra la carpeta antes de cargar el seed o de guardar las contraseñas, no pasa nada mientras la base siga vacía: se genera de nuevo, con contraseñas nuevas (las anteriores ya no valen). La CLI pide confirmación para cualquier SQL contra la nube, también para una consulta que solo lee.

✅ 34 cuentas en `auth.users` y en `app_user`, todas con contraseña; 42 ejercicios, 209 intentos del historial y el ajuste `ai_provider`. Y dos comprobaciones de seguridad contra la API de autenticación: la contraseña de prueba del repositorio (`tutoria`) da `invalid_credentials`, y un registro nuevo, `signup_disabled`.

## 8 · Vercel · tú

1. Project Settings → Build and Deployment → Framework Preset: **Other**, y sin ningún _Override_ activado (el de _Output Directory_ apuntaba a `dist/demo/browser`, de la demo del 1.10). La app sigue siendo Angular y se construye con `ng build`: el preset solo decide qué supone Vercel por su cuenta. El de Angular añade su propia regla de SPA, que devuelve `index.html` con un 200 para un fichero que no existe, como el chunk de una versión anterior (pendiente 1.10); con _Other_ manda solo `vercel.json`, que ya dice el build, la carpeta, las reescrituras (solo las rutas sin extensión) y las cabeceras, y que lleva `"framework": null`. El aviso _Overridden_ del panel es lo esperado: dice que manda `vercel.json`.
2. Sin variables de entorno: la configuración pública va en el código (D-053).
3. Despliega con los commits del paso: Vercel publica cada push a `master`.

✅ En la URL de Vercel:

- entras con la cuenta de administración y `/dev/ui` abre el muestrario;
- con una cuenta de estudiante, `/dev/ui` es la página de «no encontrada»;
- la consola del navegador no muestra errores de _Content Security Policy_.
- `curl -I` de la URL devuelve las cabeceras de `vercel.json` (CSP, `Permissions-Policy`, `Referrer-Policy`, `nosniff`), el `index.html` lleva la CSP de Angular con los _hashes_ de sus scripts, y una petición desde la página a otro origen falla (la CSP solo deja hablar con Supabase).
- la pantalla de acceso no tiene el menú de cuentas de demostración.
- `curl` de `/alumno/ajustes` da 200. Un fichero que no existe (`/chunk-NOEXISTE.js`) debería dar 404 y todavía da `index.html` con un 200: está en pendientes (1.10), sin efecto en el uso.

## 9 · Smoke e2e contra la URL pública · opcional

```bash
npm run smoke
```

Igual en macOS y en Windows. Va contra `https://tutoria-rosy.vercel.app` con la cuenta de Lucas (`SMOKE_URL` y `SMOKE_EMAIL` las cambian) y pide su contraseña sin mostrarla; nunca va a un fichero. La primera vez en un equipo hace falta `npx playwright install chromium`. Recorre la app de verdad, con el tutor real: acceso (y el aviso de datos la primera vez), pruebas que fallan, una pista, la solución y la entrega. Se puede repetir (la segunda vez practica de nuevo el ejercicio entregado) y falla si la CSP bloquea algo o si faltan las credenciales. Espera hasta 30 s en cada paso y 90 s al tutor: la nube gratuita arranca en frío y la cadena de respaldo puede tardar.

✅ `1 passed`. En la primera pasada (3.1) encontró un fallo real: el tutor no respondía porque Google tenía saturado `gemini-3.5-flash-lite` en el plan gratuito (503 _high demand_ y llamadas de más de 15 s). Se arregló con la cadena de respaldo del ajuste `ai_provider`: Flash-Lite (10 s), `gemma-4-31b-it` (30 s) y `gemma-4-26b-a4b-it` (30 s), de la misma API y clave y cada uno con su cuota. Los registros de las funciones (`npx supabase logs --remote --service functions`) dicen qué modelo respondió.

## 10 · Comprobaciones a mano · tú

- **Bucle infinito:** en un ejercicio, `while (true) {}` y «Ejecutar pruebas» acaba en «Tiempo agotado». En el panel, Edge Functions → `execute` → Logs, el tiempo de CPU de esa ejecución (pendiente 2.3).
- **Safari y Firefox:** escribe código, cambia de pestaña y vuelve; en Table Editor → `process_event` aparece el `tab_hidden` (escritura con `keepalive`, D-041; pendiente 2.2).

## Mantenimiento

- **Cada fase:** `db push --remote` si hay migraciones nuevas, `functions deploy --remote` si cambian las funciones y push a `master` para el front.
- **Pausa del plan gratuito:** Supabase pausa un proyecto gratuito tras una semana sin actividad. Se reactiva desde el panel (Restore), sin perder datos; antes de una demo, entra un rato el día anterior.
- **El día de la demo:** cambiar a un modelo de pago es solo el ajuste `ai_provider` desde la administración, sin desplegar nada.
