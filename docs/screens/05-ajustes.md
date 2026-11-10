# 05 · Ajustes

`/alumno/ajustes` · Alumno · Capa 1 · 1,5 h

## Objetivo

Que el alumno adapte TutorIA a su gusto: aspecto, idioma, reacciones del tutor (RF-10), mascota y tutor proactivo, y que llegue desde aquí a los datos registrados (RF-07).

## Datos

- Lee y escribe `SettingsStore` (reacciones, emojis 3D, proactividad, accesorios de la mascota), guardado por usuario en localStorage.
- El tema lo lleva `ThemeService`, para todo el navegador, porque el acceso también lo usa antes de saber quién entra.
- El idioma, `LanguageService`: cambiarlo vuelve a cargar la página (D-023).
- No lee nada del servidor: sin estados de carga, vacío ni error.

## Contenido y disposición

- Cabecera: `h1` «Ajustes» y «Los cambios se aplican y se guardan al momento en este navegador».
- Cuatro tarjetas en dos columnas desde 1024 px y en una sola por debajo:
  - **Apariencia:** tema (claro, oscuro, sistema) e idioma, con botones conmutadores; bajo el idioma, «Al cambiarlo, la página se vuelve a cargar».
  - **Mascota:** la mascota en vista previa en directo y tres interruptores: auriculares con micro, pajarita de cuadros (los dos activados por defecto) y puntero de hueso al pasar por encima.
  - **Reacciones del tutor:** completas, reducidas o desactivadas, con una línea que explica la elegida; «Emojis 3D»; «Probar una reacción», que lanza una reacción alegre distinta cada vez, pasando por las tres intensidades, con la opción elegida (y la mascota de la vista previa se mueve con ella).
  - **Tutor:** «El tutor puede escribirme por iniciativa propia» (activado por defecto; actúa desde el paso 6.2) y «Hablar con el tutor por voz», deshabilitado con «Pronto podrás…» hasta el 6.1.
- Abajo, a todo el ancho, **Privacidad**, con el enlace «Ver los datos registrados».
- Tema e idioma siguen también en la barra, como acceso rápido.
- Sin prototipo en la memoria: sigue la paleta y las tarjetas del catálogo.

## Interacciones

- Cada control aplica y guarda su cambio al momento; no hay botón de guardar ni formulario (D-038).
- Con las reacciones desactivadas, «Emojis 3D» y «Probar una reacción» se deshabilitan.

## Estados

Solo el de con datos: la pantalla no lee nada que tarde.

## Accesibilidad

- Cada grupo de botones conmutadores toma su nombre del encabezado (`aria-labelledby`) y se anuncia como grupo de opciones; cada idioma lleva su `lang`.
- Los interruptores tienen su explicación asociada con `aria-describedby`; la del modo de reacción se anuncia al cambiar (`aria-live`).
- La vista previa de la mascota y la capa de reacciones son decorativas (`aria-hidden`).

## Criterios de aceptación

- [x] Cada ajuste se aplica al momento y sigue tras recargar, por usuario (otro alumno en el mismo navegador tiene los suyos).
- [x] La mascota de la vista previa, la del tutor y la del catálogo llevan los accesorios elegidos.
- [x] «Probar una reacción» respeta el modo y los emojis elegidos, y enseña las tres intensidades.
- [x] Sin scroll horizontal a 375 px.

## Fuera de alcance

- La proactividad y la voz funcionando (pasos 6.2 y 6.1).
- Guardar los ajustes en el servidor para llevarlos a otro dispositivo.

## Pulido pendiente
