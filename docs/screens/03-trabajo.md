# 03 · Pantalla de trabajo

`/alumno/ejercicio/:id` · Alumno · Capas 1, 3 y 4 · 2 h la disposición (paso 1.3), 3 h el editor (1.4), 3 h las pruebas y la entrega (1.5) y 3 h el chat del tutor (1.7, ficha 04); se completa con el 1.8

## Objetivo

Que el alumno resuelva un ejercicio en una sola pantalla: lee el enunciado y los ejemplos, escribe y prueba su código y pide ayuda al tutor (RF-03 a RF-06). En el paso 1.3 se construye la disposición y la apertura del intento; las zonas se llenan en los pasos siguientes.

## Datos

- Lee `ExerciseService.getDetail(id)` con `resource()`: el ejercicio, sus pruebas visibles y cuántas ocultas tiene.
- Abre el intento con `AttemptStore.open(id)`, que llama a `AttemptService.openOrCreate`: recupera el último intento del alumno o crea uno en `in_progress` (2.4). El store se provee en la ruta y lo comparten el editor, los resultados, «Entregar» y el tutor (4.5).
- Si el alumno no tiene el ejercicio asignado, los dos servicios responden `not_found`.
- El código se guarda con `AttemptService.saveCode` 800 ms después del último cambio (paso 1.4, D-029).
- Las pruebas se ejecutan con `CodeRunnerService.run`, que guarda el código y fija `passed` o `tests_failed`, y se entrega con `AttemptService.submit` (paso 1.5, D-030). Los resultados viven en el store mientras se está en la pantalla: no se guardan.
- El reparto entre enunciado y código, y entre código y tutor, se recuerda por usuario en `localStorage`.
- La conversación con el tutor la lleva `TutorStore` (ficha 04, D-033).
- La pantalla se descarga aparte (`loadChildren`), con sus stores, cuando el alumno abre un ejercicio (D-033).

## Contenido y disposición

- Referencia: boceto (figura 8 de la memoria), versión móvil y tableta (figura 15) y prototipo (figura 17).
- Cabecera: volver a «Ejercicios», el `h1` con el título del ejercicio y los chips de dificultad y de estado del intento; tras ejecutar, el de estado añade las pruebas superadas («Con fallos · 3/5»), como el contador de la figura 17.
- Tres zonas:
  - **Enunciado:** el texto, con el código en monoespaciada; «Ejemplos» como tabla de llamadas y resultados esperados (`suma([1, 2, 3])` → `6`) y «Y N comprobaciones ocultas» (2.5). Se puede plegar. El texto no pasa de unos 65 caracteres por línea; cuando el panel mide 896 px o más (tutor flotante en una pantalla ancha), los ejemplos van a su derecha en lugar de debajo, con una consulta de contenedor sobre el propio panel (1.2b).
  - **Código:** el editor (1.4), con el indicador de guardado junto al encabezado; debajo, «Ejecutar pruebas» y «Entregar», y los resultados (1.5), que se desplazan por dentro y ocupan como mucho el 40 % de la zona. Es la zona principal y se lleva el espacio que sobre. Un intento nuevo empieza vacío, con «Escribe aquí la función `suma`» como texto de ayuda (D-018); uno entregado solo muestra su código y, en lugar de los botones, «Entregado el …» con «Volver a los ejercicios».
  - **Resultados** (figura 17): el resumen («3 de 5 superadas» o «Todas superadas»); cada ejemplo con su llamada, el esperado y el obtenido, el error o «Tiempo agotado»; las pruebas que no llegaron a empezar tras un tiempo agotado, como «Sin ejecutar»; las comprobaciones ocultas, solo con su icono; si el código no carga o no tiene la función, solo eso, una vez. Si el código cambia después de ejecutar, una nota avisa de que son de la versión anterior. Antes de la primera ejecución, una línea invita a ejecutar.
  - **Tutor:** el chat (ficha 04).
- Escritorio y tableta (desde 768 px), como en el prototipo: dos columnas. A la izquierda, el enunciado encima del código, con un separador entre los dos (el enunciado ocupa del 15 al 70 % de la columna; 45 % al empezar); a la derecha, el tutor, con un separador vertical entre el código y el tutor (el código ocupa del 50 al 80 % del ancho, 70 % al empezar, y el tutor nunca baja de 16rem). El alumno puede hacer flotante el tutor, y lo es siempre con el código ampliado y en la tableta (de 768 a 1023 px): entonces el enunciado y el código ocupan todo el ancho y el tutor se pliega en la mascota, abajo a la derecha (ficha 04, D-033). La pantalla ocupa el alto de la ventana y cada zona se desplaza por dentro.
- Móvil (menos de 768 px): pestañas «Ejercicio», «Código» y «Tutor», cada una a pantalla completa. Cambia la figura 15, que apilaba los bloques con el tutor plegable debajo: a 375 × 667 no cabían y la página entera se desplazaba (5.4).

## Interacciones

- **Volver a los ejercicios:** navega al catálogo.
- **Plegar el enunciado:** en escritorio y tableta, el encabezado de la zona lo pliega o lo despliega y el código gana el espacio.
- **Pestañas (móvil):** cambian de zona; con las flechas del teclado, como en las prácticas de ARIA.
- **Reintentar** (error): vuelve a cargar lo que falló.
- **Escribir código:** el estado pasa a «En curso» y el indicador dice «Guardando…» y, al llegar la respuesta, «Guardado». Tab sangra; Esc y después Tab salen del editor.
- **Reintentar el guardado:** si falla, «No se ha guardado» ofrece «Reintentar» y el código no se pierde.
- **Salir o recargar:** lo pendiente se guarda al ocultar la pestaña, al cambiar de ejercicio y al salir de la pantalla; con cambios sin guardar, el navegador pregunta antes de cerrar.
- **Ejecutar pruebas** (o Ctrl + Intro desde el editor): envía el código actual, dice «Ejecutando…» y muestra los resultados; el estado pasa a «Superado» o «Con fallos». Un bucle infinito acaba a los 2 s en «Tiempo agotado» sin colgar la pestaña. Si falla, un aviso con «Reintentar».
- **Entregar:** solo con el intento superado; pide confirmación («Seguir revisando» o «Entregar») y después el código queda en solo lectura. Antes de superar, el botón se puede enfocar y su tooltip explica por qué no se puede.
- **Separadores:** se arrastran o se mueven con las flechas (arriba y abajo el del enunciado; izquierda y derecha el del tutor), Inicio y Fin; doble clic vuelve al reparto inicial. Se recuerdan para el alumno.
- **Ampliar el código** (escritorio y tableta): el botón ⤢ del encabezado «Código» oculta el enunciado y le da su altura al código y a los resultados; el tutor se pliega en la mascota flotante, que lo abre cuando el alumno lo necesita (D-033). El mismo botón vuelve a la vista normal. Es el mismo editor: no se pierde nada de lo escrito ni el historial de deshacer.
- **Plegar los resultados:** su encabezado, con el resumen, los pliega o los despliega; cada ejecución nueva los vuelve a desplegar.
- **Señales del navegador** (paso 1.6, D-031): en un intento sin entregar se registran, sin nada visible para el alumno, los pegados de texto de fuera del código y las salidas a otra ventana o pestaña de 2 s o más, con su duración. Cerrar sesión espera a guardar el código y a enviar los eventos. La pantalla de datos registrados (1.9) lo explica.

## Estados

- **Cargando:** esqueletos con la forma del enunciado y de los ejemplos, solo si la espera pasa de 300 ms.
- **Sin acceso:** un ejercicio que no existe o no está asignado muestra «No tienes acceso a este contenido» con «Volver a los ejercicios», no «Reintentar».
- **Error:** mensaje según el tipo de error y «Reintentar».
- **Editor:** reserva su sitio hasta que la zona se ve; si su descarga pasa de 300 ms, un esqueleto; si falla, «Recargar».
- **Ejecutando o entregando:** el botón lo dice («Ejecutando…», «Entregando…») y no se puede repetir la acción.
- **Fallo al ejecutar o entregar:** aviso según el tipo de error (sin conexión, demasiadas ejecuciones, sesión caducada) con «Reintentar»; el código no se pierde (CU-01, 4b).
- **Entregado:** el código en solo lectura y la nota con la fecha.
- **Con datos:** las tres zonas.

## Accesibilidad

- Al llegar, el foco va al `h1`, que existe desde el primer momento (con «Ejercicio» mientras carga), y la pestaña del navegador dice el título del ejercicio («Suma de los elementos de un vector · TutorIA»).
- Cada zona es una sección con su `h2` (en el móvil, la pestaña la nombra).
- El enunciado plegable sigue el patrón de acordeón: botón dentro del `h2` con `aria-expanded` y `aria-controls`.
- Los ejemplos son una tabla con encabezados de columna.
- El editor es un área de texto llamada «Código», con el texto de cómo salir con el teclado enlazado (`aria-describedby`) y `aria-readonly` si está entregado. «No se ha guardado» se anuncia (`role="alert"`); «Guardando…» y «Guardado» no, para no repetirse en cada pausa.
- En «Ejercicios» de la barra, el enlace sigue resaltado dentro de un ejercicio, pero `aria-current="page"` solo lo lleva en el catálogo.
- El resumen de cada ejecución se anuncia (`aria-live="polite"`), porque los resultados aparecen lejos del botón; los fallos al ejecutar o entregar, con `role="alert"`. Cada resultado dice su estado con texto, además del icono y el color.
- Los botones que se deshabilitan siguen enfocables (`disabledInteractive`); tras entregar, el foco va a la nota de entregado.
- El diálogo de entrega atrapa el foco y empieza en «Seguir revisando».
- Los separadores son `separator` con su valor (`aria-valuenow`, en porcentaje), su orientación y `aria-controls` a la zona que cambian: «Tamaño del enunciado» y «Ancho del código».
- «Ampliar el código» es un botón de alternar: mismo nombre y `aria-pressed`. Los resultados plegables siguen el patrón de acordeón, como el enunciado.

## Criterios de aceptación

- [ ] Abrir un ejercicio crea el intento o recupera el que ya existe (el estado del chip coincide con el del catálogo).
- [ ] Lucía Martín ve el enunciado y los 4 ejemplos del ejercicio 3, con «Y 1 comprobación oculta».
- [ ] Un ejercicio no asignado muestra el estado sin acceso con «Volver a los ejercicios».
- [ ] Dos columnas desde 768 px y pestañas por debajo, sin desplazar la página a 375 × 667, 768 × 1024 y 1280 × 720.
- [ ] El enunciado se pliega y el código ocupa el espacio.
- [ ] axe sin infracciones en claro y oscuro.
- [ ] Escribir, recargar y el código sigue ahí (paso 1.4).
- [ ] Un intento entregado se ve en solo lectura y sin indicador de guardado.
- [ ] El ejercicio 3 se resuelve y se entrega, y un bucle infinito acaba en tiempo agotado sin colgar la pestaña (paso 1.5).
- [ ] El separador cambia el reparto con el ratón y con el teclado, y se recuerda al volver.
- [ ] El separador vertical da más o menos ancho al tutor, sin bajar de 16rem, y se recuerda al volver (paso 1.7).
- [ ] Con el código ampliado y en la tableta, el tutor flota en la mascota y el código ocupa todo el ancho (iteración 1 del 1.7).
- [ ] «Ampliar el código» da al código el sitio del enunciado, con el tutor a la vista y sin perder lo escrito, y los resultados se pliegan al resumen (iteraciones 1 y 2 del 1.5).

## Fuera de alcance

- Las reacciones (1.8). El chat tiene su propia ficha (04).
- El registro del pegado: el editor ya lo detecta, y lo envía el `EventLogger` del 1.6.
- La lista de ejercicios dentro de la pantalla: el plan la dejaba opcional y basta con volver al catálogo.

## Pulido pendiente

Se rellena si se agota el tiempo de la pantalla.
