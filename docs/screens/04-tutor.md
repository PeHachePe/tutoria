# 04 · Tutor

Zona del tutor de `/alumno/ejercicio/:id` · Alumno · Capa 1 (las capas 3 y 4 añaden la voz y las intervenciones proactivas) · 3 h (paso 1.7) · D-033

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
- **Escritorio y tableta:** columna a la derecha del código. Su ancho se cambia con un separador vertical y nunca baja de 16rem.
- **Móvil:** la pestaña «Tutor», a pantalla completa.

## Interacciones

- **Pedir pista:** añade la etiqueta del nivel y la respuesta, que llega poco a poco.
- **Preguntar:** Intro o el botón envían; Mayús + Intro hace salto de línea. El campo se vacía al enviar y se puede escribir la siguiente pregunta mientras el tutor responde, pero no enviarla hasta que acabe.
- **Pregunta sugerida:** se envía con un clic.
- **Reintentar** (respuesta que no llegó): vuelve a enviar lo mismo; la pregunta no se pierde.
- **Reintentar** (conversación que no cargó): la vuelve a cargar.
- **Mascota:** saca la lengua mientras el foco está en el campo, la recoge al salir e inclina la cabeza mientras el tutor responde.
- **Separador vertical:** se arrastra o se mueve con las flechas izquierda y derecha, Inicio y Fin; doble clic vuelve al 70 % para el código. Se recuerda para el alumno.
- **Móvil:** si llega una respuesta mientras el alumno está en otra pestaña, la pestaña «Tutor» muestra un punto hasta que la abre.

## Estados

- **Cargando:** burbujas en esqueleto, solo si la espera pasa de 300 ms.
- **Error al cargar:** «No se ha podido cargar la conversación.» con «Reintentar».
- **Vacío:** la bienvenida con las preguntas sugeridas.
- **Respondiendo:** tres puntos hasta que llega el texto y un cursor al final mientras sigue llegando; «Pedir pista» y enviar, deshabilitados (enfocables).
- **Respuesta fallida:** aviso según el tipo de error (sin conexión, demasiadas preguntas, sesión caducada) con «Reintentar».
- **Entregado:** la conversación en solo lectura, sin pie, con la nota «Ejercicio entregado: puedes repasar la conversación, pero el tutor ya no da más pistas». Sin conversación: «En este ejercicio no pediste ayuda al tutor».

## Accesibilidad

- La zona es una sección con su `h2` «Tutor» (en el móvil la nombra la pestaña).
- La conversación es un grupo «Conversación con el tutor» que se puede enfocar para desplazarlo con el teclado.
- Cada burbuja empieza con «Tú:» o «Tutor:» para el lector de pantalla.
- Cada respuesta se anuncia una sola vez, completa (`aria-live="polite"`), nunca a trozos. Los errores, con `role="alert"`.
- Los tres puntos y el cursor son decorativos (`aria-hidden`); el lector oye «El tutor está escribiendo…».
- El nivel se dice con texto, no solo con los escalones.
- Los botones deshabilitados siguen enfocables (`disabledInteractive`).
- La pestaña con aviso se llama «Tutor, respuesta nueva».
- Las animaciones (entrada de cada turno, puntos y cursor) respetan `prefers-reduced-motion`.

## Criterios de aceptación

- [ ] Conversación completa subiendo del nivel 1 al 3, con la etiqueta de cada nivel y el medidor al día.
- [ ] Pedir la solución («Dame la solución») obtiene una pregunta de vuelta y queda registrado como elusión.
- [ ] Recargar conserva la conversación y el nivel.
- [ ] Un fallo de red a mitad de respuesta muestra el aviso y «Reintentar» la recupera sin perder la pregunta.
- [ ] Un intento entregado muestra su conversación sin poder preguntar.
- [ ] En el móvil, el punto de la pestaña «Tutor» aparece con una respuesta nueva y se va al abrirla.
- [ ] axe sin infracciones en claro y oscuro, con conversación, vacía, cargando, con error y entregada.

## Fuera de alcance

- Las reacciones flotantes con la emoción de cada respuesta (1.8).
- La voz (6.1) y las intervenciones proactivas (6.2); la conversación ya muestra las de las fixtures.
- El streaming real (2.4, D-017): el tutor simulado ya escribe poco a poco y el cliente no cambiará.

## Pulido pendiente

Se rellena si se agota el tiempo de la pantalla.
