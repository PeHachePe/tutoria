# 01 · Acceso

`/login` · Todos los roles (sin sesión) · Capa 1 · 2 h

## Objetivo

Que cualquier usuario entre con su correo y su contraseña y llegue al inicio de su rol (RF-01). En desarrollo, entrar con un clic con las cuentas de demostración.

## Datos

- Escribe la sesión con `AuthStore.signIn()`, que usa `AuthService` (simulado o Supabase según el entorno).
- No lee nada al cargar: la pantalla no tiene estado de carga ni vacío.
- Las cuentas de demostración llegan por el token `DEMO_ACCOUNTS`, que solo proveen los entornos de desarrollo, de modo que ni las cuentas ni su contraseña de prueba llegan al build de producción (D-014, D-018).

## Contenido y disposición

- Una tarjeta centrada en la página, de ancho máximo ≈ 28 rem, igual en escritorio, tablet y móvil (a 375 px ocupa el ancho con el margen de 16 px).
- Arriba, la marca «TutorIA», el `h1` «Acceso» y una línea: «Entra con la cuenta que te ha dado tu centro».
- Campos «Correo» y «Contraseña», cada uno con su error debajo. La contraseña tiene un botón para mostrarla u ocultarla.
- Error del servidor encima del botón, como error del formulario.
- Botón «Entrar» a todo el ancho.
- Pie: «¿No tienes cuenta o has olvidado la contraseña? Pídesela a tu docente». El registro público no existe (§2.3) y las cuentas las crea el administrador.
- Solo en desarrollo, debajo de la tarjeta, «Cuentas de demostración»: una lista de acciones con una cuenta por rol (alumna Lucía Martín, docente de 1.º DAW A, administración) y la cuenta desactivada, para ver cómo se rechaza.
- Sin prototipo en la memoria: sigue la paleta y la tipografía del tema.

## Interacciones

- **Entrar con datos válidos:** el botón pasa a «Entrando…» y se deshabilita hasta que se ve la página siguiente: la que se pidió sin sesión (`?redirect=`, solo rutas de la app) o `/`, que lleva al inicio del rol (D-019, D-021).
- **Entrar con campos vacíos o un correo mal escrito:** no se envía, se muestran los errores bajo cada campo y el foco va al primer campo con error.
  - Correo: «Introduce tu correo» / «El correo no es válido».
  - Contraseña: «Introduce tu contraseña».
- **Error del servidor**, según el tipo de `DataError`:
  - `unauthorized`: «Correo o contraseña incorrectos». También para una cuenta desactivada, para no revelar qué cuentas existen.
  - `network`: «No hay conexión. Comprueba la red e inténtalo de nuevo».
  - `rate_limited`: «Demasiados intentos. Espera un momento e inténtalo de nuevo».
  - cualquier otro: «No se ha podido entrar. Inténtalo de nuevo».
- **Mostrar u ocultar la contraseña:** cambia el tipo del campo sin perder lo escrito.
- **Acceso rápido (desarrollo):** rellena el formulario con la cuenta y lo envía, con el mismo «Entrando…».
- **Con sesión abierta**, `/login` lleva al inicio del rol (`guestGuard`, ya hecho en el 0.6).

## Estados

- **Inicial:** formulario vacío.
- **Enviando:** «Entrando…», botón y accesos rápidos deshabilitados.
- **Error del servidor:** mensaje del formulario; se puede corregir y volver a enviar.
- Cargando, vacío y error con reintento no aplican: la pantalla no lee datos.

## Accesibilidad

- Al llegar, el foco va al `h1` (`HeadingFocus`, salvo en la primera carga) y la pestaña dice «Acceso · TutorIA».
- `autocomplete="username"` en el correo y `current-password` en la contraseña, para los gestores de contraseñas.
- El botón de mostrar la contraseña es un botón conmutador: nombre fijo («Mostrar contraseña») y `aria-pressed`, como recomiendan las prácticas de ARIA (cambiar a la vez el nombre y el estado confunde al lector de pantalla).
- El error del servidor se anuncia con `role="alert"`; los de los campos los asocia Material.
- Pasa axe en claro y oscuro; se usa entero con teclado (Intro envía).

## Criterios de aceptación

- [x] Un alumno, un docente y un administrador del seed entran con su correo y `tutoria` y llegan a su inicio.
- [x] Con los campos vacíos o un correo no válido, no se envía y cada campo dice qué falta.
- [x] Una contraseña incorrecta o una cuenta desactivada muestran «Correo o contraseña incorrectos».
- [x] Mientras se envía, el botón dice «Entrando…» y no se puede pulsar otra vez.
- [x] En desarrollo, cada acceso rápido entra con su cuenta; en producción no aparecen.
- [x] Responsive a 375, 768 y 1280 px, sin scroll horizontal; axe sin infracciones en claro y oscuro.

## Fuera de alcance

- Recuperar la contraseña y el registro público: las cuentas las gestiona el administrador (paso 5.x).
- Acceso con proveedores externos (Google, Microsoft).

## Pulido pendiente

Se rellena si se agota el tiempo de la pantalla.
