# 03 · Pantalla de trabajo

`/alumno/ejercicio/:id` · Alumno · Capas 1, 3 y 4 · 2 h la disposición (paso 1.3) y 3 h el editor (1.4); se completa del 1.5 al 1.8

## Objetivo

Que el alumno resuelva un ejercicio en una sola pantalla: lee el enunciado y los ejemplos, escribe y prueba su código y pide ayuda al tutor (RF-03 a RF-06). En el paso 1.3 se construye la disposición y la apertura del intento; las zonas se llenan en los pasos siguientes.

## Datos

- Lee `ExerciseService.getDetail(id)` con `resource()`: el ejercicio, sus pruebas visibles y cuántas ocultas tiene.
- Abre el intento con `AttemptStore.open(id)`, que llama a `AttemptService.openOrCreate`: recupera el último intento del alumno o crea uno en `in_progress` (2.4). El store se provee en la ruta y lo comparten el editor, los resultados, «Entregar» y el tutor (4.5).
- Si el alumno no tiene el ejercicio asignado, los dos servicios responden `not_found`.
- El código se guarda con `AttemptService.saveCode` 800 ms después del último cambio (paso 1.4, D-029).

## Contenido y disposición

- Referencia: boceto (figura 8 de la memoria), versión móvil y tableta (figura 15) y prototipo (figura 17).
- Cabecera: volver a «Ejercicios», el `h1` con el título del ejercicio y los chips de dificultad y de estado del intento.
- Tres zonas:
  - **Enunciado:** el texto, con el código en monoespaciada; «Ejemplos» como tabla de llamadas y resultados esperados (`suma([1, 2, 3])` → `6`) y «Y N comprobaciones ocultas» (2.5). Se puede plegar.
  - **Código:** el editor (1.4), con el indicador de guardado junto al encabezado, y debajo los resultados (1.5). Es la zona principal y se lleva el espacio que sobre. Un intento nuevo empieza vacío, con «Escribe aquí la función `suma`» como texto de ayuda (D-018); uno entregado solo muestra su código.
  - **Tutor:** el chat (1.7).
- Escritorio y tableta (desde 768 px), como en el prototipo: dos columnas. A la izquierda, el enunciado encima del código; a la derecha, el tutor con ancho fijo. La pantalla ocupa el alto de la ventana y cada zona se desplaza por dentro.
- Móvil (menos de 768 px): pestañas «Ejercicio», «Código» y «Tutor», cada una a pantalla completa. Cambia la figura 15, que apilaba los bloques con el tutor plegable debajo: a 375 × 667 no cabían y la página entera se desplazaba (5.4).

## Interacciones

- **Volver a los ejercicios:** navega al catálogo.
- **Plegar el enunciado:** en escritorio y tableta, el encabezado de la zona lo pliega o lo despliega y el código gana el espacio.
- **Pestañas (móvil):** cambian de zona; con las flechas del teclado, como en las prácticas de ARIA.
- **Reintentar** (error): vuelve a cargar lo que falló.
- **Escribir código:** el estado pasa a «En curso» y el indicador dice «Guardando…» y, al llegar la respuesta, «Guardado». Tab sangra; Esc y después Tab salen del editor.
- **Reintentar el guardado:** si falla, «No se ha guardado» ofrece «Reintentar» y el código no se pierde.
- **Salir o recargar:** lo pendiente se guarda al ocultar la pestaña, al cambiar de ejercicio y al salir de la pantalla; con cambios sin guardar, el navegador pregunta antes de cerrar.

## Estados

- **Cargando:** esqueletos con la forma del enunciado y de los ejemplos, solo si la espera pasa de 300 ms.
- **Sin acceso:** un ejercicio que no existe o no está asignado muestra «No tienes acceso a este contenido» con «Volver a los ejercicios», no «Reintentar».
- **Error:** mensaje según el tipo de error y «Reintentar».
- **Editor:** reserva su sitio hasta que la zona se ve; si su descarga pasa de 300 ms, un esqueleto; si falla, «Recargar».
- **Con datos:** las tres zonas.

## Accesibilidad

- Al llegar, el foco va al `h1`, que existe desde el primer momento (con «Ejercicio» mientras carga), y la pestaña del navegador dice el título del ejercicio («Suma de los elementos de un vector · TutorIA»).
- Cada zona es una sección con su `h2` (en el móvil, la pestaña la nombra).
- El enunciado plegable sigue el patrón de acordeón: botón dentro del `h2` con `aria-expanded` y `aria-controls`.
- Los ejemplos son una tabla con encabezados de columna.
- El editor es un área de texto llamada «Código», con el texto de cómo salir con el teclado enlazado (`aria-describedby`) y `aria-readonly` si está entregado. «No se ha guardado» se anuncia (`role="alert"`); «Guardando…» y «Guardado» no, para no repetirse en cada pausa.
- En «Ejercicios» de la barra, el enlace sigue resaltado dentro de un ejercicio, pero `aria-current="page"` solo lo lleva en el catálogo.

## Criterios de aceptación

- [ ] Abrir un ejercicio crea el intento o recupera el que ya existe (el estado del chip coincide con el del catálogo).
- [ ] Lucía Martín ve el enunciado y los 4 ejemplos del ejercicio 3, con «Y 1 comprobación oculta».
- [ ] Un ejercicio no asignado muestra el estado sin acceso con «Volver a los ejercicios».
- [ ] Dos columnas desde 768 px y pestañas por debajo, sin desplazar la página a 375 × 667, 768 × 1024 y 1280 × 720.
- [ ] El enunciado se pliega y el código ocupa el espacio.
- [ ] axe sin infracciones en claro y oscuro.
- [ ] Escribir, recargar y el código sigue ahí (paso 1.4).
- [ ] Un intento entregado se ve en solo lectura y sin indicador de guardado.

## Fuera de alcance

- Las pruebas y «Entregar» (1.5), el chat (1.7) y las reacciones (1.8): sus zonas muestran qué llegará.
- El registro del pegado: el editor ya lo detecta, y lo envía el `EventLogger` del 1.6.
- La lista de ejercicios dentro de la pantalla: el plan la dejaba opcional y basta con volver al catálogo.

## Pulido pendiente

Se rellena si se agota el tiempo de la pantalla.
