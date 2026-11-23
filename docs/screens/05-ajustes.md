# 05 · Ajustes

`/alumno/ajustes` · Alumno · Capa 1 (la capa 3 añade los ajustes de la voz, en el 6.1a y el 6.1b) · 1,5 h

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
  - **Tutor:** «El tutor puede escribirme por iniciativa propia» (activado por defecto) y «Hablar con el tutor por voz», que funciona desde el 6.1a.
  - **Voz** (6.1a y 6.1b, §2.11, D-066 y D-078), dentro de la tarjeta del tutor. «Hablar con el tutor por voz» está apagado por defecto y dice lo que ya funciona: «Podrás escuchar sus respuestas. Nunca se graba el audio» en el 6.1a, y «Podrás escucharle y dictarle. Nunca se graba el audio» en el 6.1b, y «Podrás escucharle, dictarle y llamarle. Nunca se graba el audio» desde el 6.1c. Al activarlo aparecen:
    - **Voz del tutor:** un grupo de opciones con las voces del navegador para el idioma de la interfaz, con el nombre que les da el sistema y su región si el nombre no la dice, de la más natural a la menos (D-078). Mientras el alumno no elija otra, está marcada la más natural, con «Tiene la que suena más natural en tu navegador. Puedes elegir otra»: la aplicación elige por calidad, no por género, que la API no dice. Las robóticas y las de broma de macOS van tras «Ver todas las voces (N más)». Cada una con «Probar», que dice una frase corta y pasa a «Parar» mientras suena. Debajo, «¿Suenan robóticas?», con cómo conseguir voces naturales (Edge, voces mejoradas del Mac). Sin voces del idioma: «Tu navegador no tiene voces en catalán: el tutor te escribirá»;
    - **Velocidad:** lenta, normal o rápida, con botones conmutadores; «Probar» la usa;
    - «Leer las respuestas en voz alta» (apagado por defecto): fuera de una llamada, las respuestas nuevas suenan solas;
    - «Interrumpir al tutor hablando» (6.1c, D-087, apagado por defecto; solo si el navegador reconoce la voz), con «En una llamada, el micrófono sigue abierto mientras te habla. Mejor con auriculares: con altavoces, puede oír al tutor y cortarle sin querer»;
    - **Dónde se transcribe tu voz** (6.1b), una línea según el navegador: «En este equipo: el audio no sale de él»; «En el servicio de tu navegador, que recibe el audio para transcribirlo», con «Reconocer la voz en este equipo» si se puede descargar el paquete del idioma («Descargando…» mientras tanto; al acabar, el foco pasa al título de la línea y la línea nueva se anuncia); o «Tu navegador no reconoce la voz: puedes escuchar al tutor y escribirle»;
    - una nota: «Si usas un lector de pantalla, no necesitas activar la voz: ya te lee las respuestas».
- Abajo, a todo el ancho, **Privacidad**, con el enlace «Ver los datos registrados».
- Tema e idioma siguen también en la barra, como acceso rápido.
- Sin prototipo en la memoria: sigue la paleta y las tarjetas del catálogo.

## Interacciones

- Cada control aplica y guarda su cambio al momento; no hay botón de guardar ni formulario (D-038).
- Con las reacciones desactivadas, «Emojis 3D» y «Probar una reacción» se deshabilitan.
- Activar la voz carga su código en ese momento y despliega sus controles; desactivarla los pliega, calla al tutor y conserva lo elegido. Elegir una voz la prueba; salir de los ajustes calla la prueba. Al cambiar el idioma de la interfaz, si la voz elegida no es de ese idioma, el tutor habla con la más natural del nuevo idioma, y al volver sigue la elegida (6.1a). Una voz que el navegador añade con la página abierta aparece en la lista sin recargar.
- Los mismos ajustes se pueden pedir al tutor («pon el modo oscuro») o a un agente del navegador con WebMCP (2.5e, D-051): se aplican al momento y el chat ofrece «Deshacer»; el idioma, con un botón, porque recarga la página.

## Estados

Solo el de con datos: la pantalla no lee nada que tarde.

## Accesibilidad

- Cada grupo de botones conmutadores toma su nombre del encabezado (`aria-labelledby`) y se anuncia como grupo de opciones; cada idioma lleva su `lang`.
- Los interruptores tienen su explicación asociada con `aria-describedby`; la del modo de reacción se anuncia al cambiar (`aria-live`).
- La vista previa de la mascota y la capa de reacciones son decorativas (`aria-hidden`).
- Las voces son un grupo de opciones con nombre («Voz del tutor»); cada «Probar» dice de qué voz es («Probar la voz Jorge»). Los controles que aparecen al activar la voz no reciben el foco solos.

## Criterios de aceptación

- [x] Cada ajuste se aplica al momento y sigue tras recargar, por usuario (otro alumno en el mismo navegador tiene los suyos).
- [x] La mascota de la vista previa, la del tutor y la del catálogo llevan los accesorios elegidos.
- [x] «Probar una reacción» respeta el modo y los emojis elegidos, y enseña las tres intensidades.
- [x] Sin scroll horizontal a 375 px.
- [x] Al activar la voz está marcada la más natural del navegador y las robóticas y de broma quedan tras «Ver todas las voces»; «Probar» suena con la voz y la velocidad elegidas y «Parar» la calla; todo sigue tras recargar, por usuario (6.1a).
- [x] La línea «Dónde se transcribe tu voz» dice lo que hace este navegador, y en uno sin reconocimiento la voz se puede activar igual para escuchar (6.1b).
- [x] «Interrumpir al tutor hablando» se guarda por usuario y solo sale donde el navegador reconoce la voz (6.1c).
- [ ] axe sin infracciones en claro y oscuro con la voz activada (6.1a).

## Fuera de alcance

- La proactividad y la voz funcionando (pasos 6.2 y 6.1a a 6.1c).
- Guardar los ajustes en el servidor para llevarlos a otro dispositivo.

## Pulido pendiente
