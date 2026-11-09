# 04 · Tutor

Zona del tutor de `/alumno/ejercicio/:id` · Alumno · Capa 1 (las capas 3 y 4 añaden la voz y las intervenciones proactivas) · 3 h (paso 1.7) y 1,5 h las reacciones (1.8) · D-033 y D-035

## Objetivo

Que el alumno pida ayuda al tutor por escrito y reciba pistas graduadas en tres niveles, sin la solución (RF-05, CU-02), sin salir de la pantalla de trabajo (ficha 03).

## Datos

- `TutorStore` (provisto en la ruta de la pantalla de trabajo junto a `AttemptStore`, 4.5):
  - carga la conversación del intento con `AttemptService.history()`;
  - envía cada pregunta o pista con `TutorService.ask()`, con el código actual del editor y el idioma de la interfaz;
  - escribe la respuesta según llegan sus eventos (`meta` → `delta` → `done`, §2.6).
- El nivel de pista lo decide el servidor: «Pedir pista» lo sube (de 1 a 3) y una pregunta se responde en el nivel actual (§2.6).
- El tutor simulado registra cada interacción y los eventos `hint_requested` y `proactive_intervention` (§2.8).

## Contenido y disposición

- Referencia: prototipo (figura 17), donde el tutor ocupa la columna derecha con la mascota arriba; la voz llega en la capa 3.
- **Cabecera:** la mascota pequeña (en cuanto hay conversación), «Tutor» y el nivel de pista: tres escalones que se llenan y su nombre («Pista nivel 2 de 3 · Concepto», o «Sin pistas pedidas»).
- **Conversación:**
  - las preguntas del alumno a la derecha y las respuestas del tutor a la izquierda, cada una con su hora;
  - antes de cada pista, la etiqueta «Pista · nivel N»; antes de una intervención por iniciativa del tutor, «El tutor se acerca»;
  - un separador con el día («Hoy» o la fecha) cuando cambia;
  - el código en línea de las respuestas, en monoespaciada;
  - se desplaza por dentro y se queda abajo mientras crece.
- **Sin conversación:** la mascota grande, «¡Hola, Lucía!», «Pregúntame lo que necesites o pide una pista. No te daré la solución, pero te ayudaré a encontrarla» y dos preguntas sugeridas. La primera depende del intento: «¿Por dónde empiezo?», «¿Por qué falla una de las pruebas?» o «¿Se puede mejorar mi código?». La segunda es siempre «No entiendo el enunciado».
- **Pie:** «Pedir pista» («Otra pista» en el nivel 3), con un tooltip que dice qué dará el siguiente nivel; debajo, el campo «Pregunta al tutor» con el botón de enviar y la ayuda «Intro para enviar; Mayús + Intro, nueva línea».
- **Escritorio:** columna a la derecha del código, de ancho ajustable con un separador vertical (nunca baja de 16rem), o flotante si el alumno lo elige.
- **Flotante** (con el código ampliado, en la tableta o por elección del alumno, D-033): la mascota abajo a la derecha. Al pulsarla, el tutor se abre en un panel sobre la esquina del código (24rem de ancho) y la mascota saca la lengua; en su cabecera están «Fijar el tutor a la derecha» (no en la tableta) y «Minimizar el tutor». Plegado, una respuesta nueva asoma en un bocadillo junto a la mascota, con un punto.
- **Móvil:** la pestaña «Tutor», a pantalla completa.
- **Reacciones flotantes (1.8, D-035):** cada respuesta nueva, cuando llega completa, lanza durante 2 o 3 segundos su emoción en una capa sobre la pantalla:
  - un icono protagonista en el centro y el resto alrededor, en un sitio distinto cada vez, con una paleta viva propia y confeti;
  - alegría: corazones, caras sonrientes, flores y soles que suben balanceándose;
  - sorpresa: «!», rayos y bombillas que estallan con una sacudida;
  - ánimo: pulgares, cohetes, fuego y estrellas que suben a saltos;
  - celebración: un trofeo, medallas y estrellas que explotan con confeti;
  - la intensidad (1 a 3) da más piezas y más grandes;
  - la mascota del panel (o la flotante) se mueve con ellas: ladea la cabeza, menea las orejas, salta o da dos saltos;
  - salen por el lado del tutor; en el móvil, a todo el ancho;
  - las respuestas del historial, las que fallan a mitad y las intervenciones que el tutor decide callar no reaccionan.

## Interacciones

- **Pedir pista:** añade la etiqueta del nivel y la respuesta, que llega poco a poco.
- **Preguntar:** Intro o el botón envían; Mayús + Intro hace salto de línea. El campo se vacía al enviar y se puede escribir la siguiente pregunta mientras el tutor responde, pero no enviarla hasta que acabe.
- **Pregunta sugerida:** se envía con un clic.
- **Reintentar** (respuesta que no llegó): vuelve a enviar lo mismo; la pregunta no se pierde.
- **Reintentar** (conversación que no cargó): la vuelve a cargar.
- **Mascota:** saca la lengua mientras el foco está en el campo, la recoge al salir e inclina la cabeza mientras el tutor responde.
- **Separador vertical:** se arrastra o se mueve con las flechas izquierda y derecha, Inicio y Fin; doble clic vuelve al 70 % para el código. Se recuerda para el alumno.
- **Hacer flotante / Fijar:** pasa el tutor de la columna a la mascota flotante (abierto, con el foco en la pregunta) y de vuelta; fijarlo devuelve también la vista normal si el código estaba ampliado. Se recuerda para el alumno.
- **Abrir y minimizar** (flotante): la mascota lo abre con el foco en la pregunta; «Minimizar el tutor», la mascota o Esc lo pliegan y el foco vuelve a la mascota. El bocadillo de una respuesta nueva también lo abre.
- **Móvil:** si llega una respuesta mientras el alumno está en otra pestaña, la pestaña «Tutor» muestra un punto hasta que la abre.

## Estados

- **Cargando:** burbujas en esqueleto, solo si la espera pasa de 300 ms.
- **Error al cargar:** «No se ha podido cargar la conversación.» con «Reintentar».
- **Vacío:** la bienvenida con las preguntas sugeridas.
- **Respondiendo:** tres puntos hasta que llega el texto y un cursor al final mientras sigue llegando; «Pedir pista» y enviar, deshabilitados (enfocables).
- **Respuesta fallida:** aviso según el tipo de error (sin conexión, demasiadas preguntas, sesión caducada) con «Reintentar».
- **Entregado:** la conversación en solo lectura, sin pie, con la nota «Ejercicio entregado: puedes repasar la conversación, pero el tutor ya no da más pistas». Sin conversación: «En este ejercicio no pediste ayuda al tutor».

## Accesibilidad

- Las reacciones son decorativas: `aria-hidden` y sin capturar el puntero; la respuesta ya se anuncia por escrito. Se pueden reducir a un solo icono pequeño o desactivar (RF-10, CU-03 4a), y con `prefers-reduced-motion` un solo icono aparece y se desvanece sin moverse.
- La zona es una sección con su `h2` «Tutor» (en el móvil la nombra la pestaña).
- La conversación es un grupo «Conversación con el tutor» que se puede enfocar para desplazarlo con el teclado.
- Cada burbuja empieza con «Tú:» o «Tutor:» para el lector de pantalla.
- Cada respuesta se anuncia una sola vez, completa (`aria-live="polite"`), nunca a trozos. Los errores, con `role="alert"`.
- Los tres puntos y el cursor son decorativos (`aria-hidden`); el lector oye «El tutor está escribiendo…».
- El nivel se dice con texto, no solo con los escalones.
- Los botones deshabilitados siguen enfocables (`disabledInteractive`).
- La pestaña con aviso se llama «Tutor, respuesta nueva».
- La mascota flotante es un botón «Abrir el tutor» / «Cerrar el tutor» con `aria-expanded` y `aria-controls` al panel. Plegado, la respuesta nueva se anuncia con su propia región `aria-live`, porque la del panel no está en la página.
- Las animaciones (entrada de cada turno, puntos y cursor) respetan `prefers-reduced-motion`.

## Criterios de aceptación

- [ ] Conversación completa subiendo del nivel 1 al 3, con la etiqueta de cada nivel y el medidor al día.
- [ ] Pedir la solución («Dame la solución») obtiene una pregunta de vuelta y queda registrado como elusión.
- [ ] Recargar conserva la conversación y el nivel.
- [ ] Un fallo de red a mitad de respuesta muestra el aviso y «Reintentar» la recupera sin perder la pregunta.
- [ ] Un intento entregado muestra su conversación sin poder preguntar.
- [ ] En el móvil, el punto de la pestaña «Tutor» aparece con una respuesta nueva y se va al abrirla.
- [ ] El tutor pasa de fijo a flotante y de vuelta, y se recuerda al recargar; flotante, se abre con el foco en la pregunta y se minimiza con el botón, la mascota o Esc, con el foco de vuelta en la mascota.
- [ ] Plegado, una respuesta nueva asoma en el bocadillo, se anuncia y abre el tutor.
- [ ] Cada respuesta nueva lanza la reacción de su emoción y mueve la mascota; reducidas, un solo icono; desactivadas, nada; con «reducir movimiento», un icono que se desvanece sin moverse.
- [ ] axe sin infracciones en claro y oscuro, con conversación, vacía, cargando, con error y entregada.

## Fuera de alcance

- El ajuste de las reacciones en la pantalla de ajustes (1.9): hasta entonces se cambia en el muestrario.
- La voz (6.1) y las intervenciones proactivas (6.2); la conversación ya muestra las de las fixtures.
- El streaming real (2.4, D-017): el tutor simulado ya escribe poco a poco y el cliente no cambiará.

## Pulido pendiente

Se rellena si se agota el tiempo de la pantalla.
