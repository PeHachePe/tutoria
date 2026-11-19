# 04 · Tutor

Zona del tutor de `/alumno/ejercicio/:id` · Alumno · Capa 1 (las capas 3 y 4 añaden la voz y las intervenciones proactivas) · 3 h (paso 1.7), 1,5 h las reacciones (1.8), 6,5 h la voz (6.1a a 6.1c) y 4,5 h el tutor proactivo (6.2b y 6.2d) · D-033, D-035 y D-064 a D-067

## Objetivo

Que el alumno pida ayuda al tutor por escrito y reciba pistas graduadas en tres niveles, sin la solución (RF-05, CU-02), sin salir de la pantalla de trabajo (ficha 03).

## Datos

- `TutorStore` (provisto en la ruta de la pantalla de trabajo junto a `AttemptStore`, 4.5):
  - carga la conversación del intento con `AttemptService.history()`;
  - envía cada pregunta o pista con `TutorService.ask()`, con el código actual del editor y el idioma de la interfaz;
  - escribe la respuesta según llegan sus eventos (`meta` → `delta` → `done`, §2.6).
- El nivel de pista lo decide el servidor: «Pedir pista» lo sube (de 1 a 3) y una pregunta se responde en el nivel actual (§2.6).
- El tutor simulado registra cada interacción y los eventos `hint_requested` y `proactive_intervention` (§2.8).
- `ProactivityMonitor` (6.2b, provisto en la ruta; no en la vista previa del docente): tras cada ejecución y cada 15 segundos decide con `proactiveReason()` si el tutor se acerca y por qué (`failures`, `idle` o `achievement`, §2.7), y se lo pide a `TutorStore`. Lee el ajuste `SettingsStore.proactive` y `awaySince()`.
- La voz (6.1, §2.11), solo con el ajuste `SettingsStore.voice` activado, que es cuando se carga `SpeechService`:
  - `TutorSpeaker` (6.1a, provisto en la ruta) dice las respuestas frase a frase, con la voz y la velocidad de los ajustes;
  - el dictado (6.1b) escribe en el campo de la pregunta lo que el navegador reconoce;
  - `VoiceCall` (6.1c, provisto en la ruta) lleva los turnos de una llamada: lee `turns()` y `answering()` y pregunta con `ask()`. `TutorStore` no cambia, y no se guarda nada nuevo: ni audio ni si la pregunta fue hablada.

## Contenido y disposición

- Referencia: prototipo (figura 17), donde el tutor ocupa la columna derecha con la mascota arriba; la voz llega en la capa 3 (6.1).
- **Cabecera:** la mascota pequeña (en cuanto hay conversación), «Tutor» y el nivel de pista: tres escalones que se llenan y su nombre («Pista nivel 2 de 3 · Concepto», o «Sin pistas pedidas»).
- **Conversación:**
  - las preguntas del alumno a la derecha y las respuestas del tutor a la izquierda, cada una con su hora;
  - antes de cada pista, la etiqueta «Pista · nivel N»; antes de una intervención por iniciativa del tutor, «El tutor se acerca»; cuando el alumno dice otra vez que está atascado («no sé», «no me acuerdo») y el servidor sube el nivel sin que pulse «Pedir pista», «Más ayuda · nivel N» (2.5d);
  - un separador con el día («Hoy» o la fecha) cuando cambia;
  - el código en línea de las respuestas, en monoespaciada, y los bloques de código aparte, con los colores del editor, su lenguaje y «Copiar» («Copiado» durante dos segundos, anunciado a los lectores de pantalla): el esqueleto vacío de la función y los ejemplos genéricos de sintaxis del catálogo, que escribe el servidor (2.5d). Cada línea se ve entera; si no cabe, el bloque se desplaza de lado, también con el teclado;
  - bajo una respuesta, lo que el tutor ha hecho con sus herramientas (2.5e, D-051): «Ha consultado tu progreso» si leyó datos del alumno antes de responder; lo que hizo al momento («He marcado la línea 3 del código», «Te señalo el ejemplo 2», «Tema oscuro» con «Deshacer»); y, para lo que cambia de página o la recarga, un botón («Abrir el siguiente ejercicio», «Ir a los ajustes», «Cambiar el idioma a inglés» con «La página se vuelve a cargar»). En el historial, lo que propuso («Te propuso: …»), sin volver a hacerlo;
  - se desplaza por dentro y se queda abajo mientras crece.
- **Sin conversación:** la mascota grande, «¡Hola, Lucía!», «Pregúntame lo que necesites o pide una pista. No te daré la solución, pero te ayudaré a encontrarla» y dos preguntas sugeridas. La primera depende del intento: «¿Por dónde empiezo?», «¿Por qué falla una de las pruebas?» o «¿Se puede mejorar mi código?». La segunda es siempre «No entiendo el enunciado».
- **Pie:** «Pedir pista» («Otra pista» en el nivel 3), con un tooltip que dice qué dará el siguiente nivel; debajo, el campo «Pregunta al tutor» con el botón de enviar y la ayuda «Intro para enviar; Mayús + Intro, nueva línea».
- **Escritorio:** columna a la derecha del código, de ancho ajustable con un separador vertical (nunca baja de 16rem), o flotante si el alumno lo elige.
- **Flotante** (con el código ampliado, en la tableta o por elección del alumno, D-033): la mascota abajo a la derecha. Al pulsarla, el tutor se abre en un panel sobre la esquina del código (24rem de ancho) y la mascota saca la lengua; en su cabecera están «Fijar el tutor a la derecha» (no en la tableta) y «Minimizar el tutor». Plegado, una respuesta nueva asoma en un bocadillo junto a la mascota, con un punto.
- **Bocadillo de dos estados** (6.2d, D-064), solo con el tutor plegado:
  - **Pensando:** tres puntos y la mascota pensativa, al instante. Solo cuando el alumno ha preguntado sin abrir el tutor, con el atajo «Pregúntale al tutor»;
  - **Respuesta:** las primeras palabras (dos líneas como mucho), con el punto en la mascota y «Cerrar el aviso». Se queda hasta que el alumno lo abre o lo cierra, o llega otra respuesta; cerrarlo deja el punto;
  - una intervención del tutor por iniciativa propia entra directamente en «Respuesta»: si el tutor decide callar, un «pensando» sería una promesa sin cumplir;
  - si la respuesta no llega, «No he podido responder. Ábreme para reintentar», que abre el tutor con su «Reintentar». Una intervención que falla no enseña nada.
- **Atajo «Pregúntale al tutor»** (6.2d): un botón junto a cada ejemplo visible que falla en los resultados de la ejecución (ficha 03). Envía la pregunta de un clic con sus datos («¿Por qué falla `suma([1,2,3])`? Devuelve 5 y se espera 6»), en el nivel actual. Nunca hay avisos sueltos dentro del editor.
- **Móvil:** la pestaña «Tutor», a pantalla completa.
- **Voz** (6.1, §2.11, D-066), solo con la voz activada en los ajustes:
  - **Escuchar** (6.1a): bajo cada respuesta del tutor, «Escuchar», que pasa a «Parar» mientras suena. Con «Leer las respuestas en voz alta» en los ajustes, las respuestas nuevas suenan solas. Mientras habla, la mascota mueve la boca. Sin una voz elegida, «Escuchar» lleva a los ajustes («Elige una voz para el tutor»);
  - **Dictar** (6.1b): un botón con un micrófono junto a enviar. Mientras escucha, el botón queda marcado, dice «Dejar de dictar» y bajo el campo se lee «Te escucho…»; lo reconocido aparece en el campo. La primera vez, si el audio sale del equipo, un aviso junto al botón lo dice, con «Entendido». En un navegador sin reconocimiento, el botón no existe;
  - **Llamar al tutor** (6.1c): un botón con un teléfono en la cabecera. En una llamada, una barra sobre el pie con el estado («Te escucho», lo que va entendiendo, «Pensando…», «Hablando…» o «En espera»), y sus botones según el estado: «Interrumpir» mientras el tutor habla, «Corregir» mientras el alumno habla, «Seguir hablando» en espera y siempre «Colgar». El campo de la pregunta y «Pedir pista» siguen debajo: voz y teclado se mezclan;
  - con el tutor plegado, la llamada sigue: la mascota muestra el estado y el bocadillo enseña lo que se va entendiendo, «pensando» y la respuesta. En el móvil, la llamada vive en la pestaña «Tutor» y sigue al cambiar de pestaña.
- **Reacciones flotantes (1.8, D-035 a D-037):** cada respuesta nueva, cuando llega completa, lanza durante 2 o 3 segundos la reacción que eligió el tutor (o la de su emoción) en una capa sobre toda la pantalla:
  - un emoji grande en el centro (animado en 3D, o el mismo en 3D estático si el alumno desactiva «Emojis animados» o mientras el animado carga, D-043), con un halo y ondas de luz a su compás, y alrededor coronas, lluvia de emojis pequeños y confeti; nunca sale igual;
  - dieciocho reacciones: corazones, ánimo, fiesta, pensando, bombilla, cohete, fuego, aplausos, mente explotando, risas, guiño, secreto, «¿en serio?», lanzamiento (pelota, huevo, tarta, tomate o caca, que se estampan con un 💥 y dejan su mancha), enfado de broma (que en la intensidad 3 explota con una bomba y un fogonazo), ojos vigilantes, empatía y sueño;
  - las bromas son para cuando el alumno pide la solución, nunca para sus errores;
  - el emoji de cada reacción se descarga en cuanto el tutor la elige, mientras escribe; si no llega a tiempo, sigue la coreografía hasta que aparece;
  - la intensidad (1 a 3) da más piezas y más grandes, y algunas partes solo salen en la más alta;
  - si llega otra respuesta mientras dura, se suma sin cortar la anterior (hasta tres);
  - la mascota del panel (o la flotante) se mueve con ellas;
  - las respuestas del historial, las que fallan a mitad y las intervenciones que el tutor decide callar no reaccionan;
  - una intervención de ayuda (por fallos repetidos o por un parón) reacciona en reducido, con un solo icono pequeño, sea cual sea su intensidad: el alumno no ha pedido nada y la pantalla no se le llena. La de un logro, completa (6.2d);
  - ejecutar las pruebas también reacciona (2.2, D-041): fiesta cuando pasan todas, aplausos más discretos si siguen pasando al volver a ejecutar, ánimo cuando pasan más que en la ejecución anterior y nada con fallos, que solo desanimaría. Gana la reacción más reciente, del tutor o de la ejecución.
  - En el tutor simulado, siempre con intensidad 3: las pistas de nivel 1, 2 y 3 dan pensando, bombilla y cohete; pedir la solución, por turnos, guiño, secreto, «¿en serio?», lanzamiento y enfado; las preguntas, aplausos, mente explotando, risas o fuego; el enunciado, corazones; el código vacío, ánimo; el ejercicio superado, fiesta; sus intervenciones, ojos o empatía.

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
- **El tutor se acerca** (6.2, §2.7): tras una ejecución en la que la misma prueba lleva tres fallos seguidos, tras cuatro minutos sin actividad o cuando el alumno supera una prueba que se le resistía (los umbrales son los del ejercicio). Con el tutor a la vista, el turno entra en la conversación con «El tutor se acerca»; plegado, asoma en el bocadillo; en el móvil, el punto de la pestaña. Nunca mueve el foco ni abre el tutor. No se acerca mientras el alumno escribe una pregunta, el tutor responde o hay una ejecución en curso, ni con el alumno fuera de la pestaña, ni antes de tres minutos desde su último turno, ni más de cinco veces por ejercicio para ayudar.
- **Pregúntale al tutor** (atajo): con el tutor a la vista, la pregunta entra en la conversación como cualquier otra; plegado, el bocadillo pasa por «pensando» y después por la respuesta, y pulsarlo abre el tutor; en el móvil, cambia a la pestaña «Tutor», porque lo ha pedido el alumno. El foco se queda en el botón.
- **Cerrar el aviso:** quita el bocadillo y deja el punto en la mascota; el foco pasa a la mascota.
- **Escuchar y Parar** (6.1a): una sola respuesta suena cada vez. Se calla con «Parar», al enviar otra pregunta, al cambiar de ejercicio y al ocultar la pestaña. El código de una respuesta no se lee: el tutor acaba con «Te lo dejo en el chat».
- **Dictar** (6.1b): pulsar empieza y pulsar otra vez acaba; también Esc, escribir en el campo u 8 segundos de silencio. Lo dictado se añade a lo ya escrito y nunca se envía solo: el alumno lo revisa y pulsa enviar (RF-08). El foco se queda en el campo.
- **Llamada** (6.1c, §2.11):
  - **Turnos:** el alumno habla y, tras 1,5 segundos de silencio, su pregunta se envía; mientras, ve lo que el navegador ha entendido. Seguir hablando alarga el turno, Esc lo descarta y «Corregir» lo pasa al campo y deja la llamada en espera;
  - **Interrumpir al tutor:** «Interrumpir», el atajo de la llamada, enviar una pregunta escrita o pedir una pista lo callan al momento, y la respuesta queda entera en el chat. Con «Llevo auriculares» en los ajustes, también hablar;
  - **El tutor no interrumpe:** mientras el alumno habla, una intervención espera. Editar el código no corta nada;
  - **En espera:** tras 90 segundos sin voz o al ocultar la pestaña, el micrófono se cierra y la barra dice «En espera»; «Seguir hablando» o el atajo lo abren. Una intervención del tutor en espera se oye y deja 10 segundos para contestar;
  - **Colgar:** «Colgar», cambiar de ejercicio, entregar o salir. El foco vuelve a «Llamar al tutor».

- **Preguntar por sus datos** (2.5e): «¿cuántos me quedan?», «¿qué asignaturas tengo?», «¿cuántos errores llevo?»: el tutor los consulta con la sesión del alumno (solo ve lo suyo) y responde con ellos; mientras, los tres puntos de siempre.
- **Pedirle que actúe** (2.5e): «ponme uno de bucles», «el siguiente que me queda», «pon el modo oscuro», «resalta la línea 3». El botón de una acción se puede enfocar mientras se ejecuta; si falla, «No se ha podido hacer: …» (con el texto de su botón) y «Reintentar». «Deshacer» devuelve los ajustes que cambió.
- **Que toque el código** (2.5f, D-052): «arréglame el código», «formatéalo», «ejecuta las pruebas», «entrégalo», o el esqueleto cuando no sabe empezar. Cada uno deja su botón bajo la respuesta: «Aplicar la corrección», «Formatear el código», «Ejecutar las pruebas», «Entregar el ejercicio» o «Poner la función en el editor». Debajo de «Aplicar» se ve el cambio («Línea 5: retrun → return», «Línea 3: falta )»), para que el alumno vea el despiste. Si ya lo corrigió él, dice «Ya lo has corregido tú»; si el código cambió, que la corrección ya no encaja. Hecho, dice qué pasó: «Línea 5 corregida», «Pruebas ejecutadas: 3 de 5 superadas», «Ejercicio entregado» o «Has seguido revisando: no se ha entregado». Con pruebas que fallan por la lógica, no hay arreglo: solo pistas.

## Estados

- **Cargando:** burbujas en esqueleto, solo si la espera pasa de 300 ms.
- **Error al cargar:** «No se ha podido cargar la conversación.» con «Reintentar».
- **Vacío:** la bienvenida con las preguntas sugeridas.
- **Respondiendo:** tres puntos hasta que llega el texto y un cursor al final mientras sigue llegando; «Pedir pista» y enviar, deshabilitados (enfocables).
- **Respuesta fallida:** aviso según el tipo de error (sin conexión, demasiadas preguntas, sesión caducada) con «Reintentar». Una intervención por iniciativa del tutor que falla, o que el tutor calla, no deja turno ni aviso.
- **Proactividad desactivada** (ajustes): el tutor solo habla cuando le preguntan; apagarla tiene efecto al momento. El atajo y el bocadillo siguen igual.
- **Atajo deshabilitado** (enfocable) mientras el tutor responde; no aparece con el intento entregado ni en las pruebas ocultas.
- **Voz desactivada** (por defecto): ni «Escuchar», ni «Dictar», ni «Llamar al tutor»; la zona es la de siempre y no se carga nada de voz.
- **Sin reconocimiento en el navegador:** solo «Escuchar». **Sin voces del idioma:** solo «Dictar», y la llamada no se ofrece.
- **Micrófono sin permiso, sin micrófono o servicio caído:** un aviso junto al campo, con qué hacer, y lo escrito intacto. En una llamada, además, cuelga.
- **Respuesta fallida en una llamada:** el tutor dice «No he podido responder» y el chat tiene su «Reintentar»; con demasiadas preguntas, dice cuánto esperar y la llamada queda en espera.
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
- El bocadillo no roba el foco en ninguno de sus estados. «Pensando» se anuncia una vez («El tutor está pensando…») y la respuesta, una vez y completa, en esa misma región (`polite`): una intervención nunca interrumpe al lector de pantalla. El bocadillo es un botón «Abrir el tutor: » seguido de sus primeras palabras, y «Cerrar el aviso», otro botón, los dos alcanzables con el teclado después de la mascota.
- El atajo se llama «Pregúntale al tutor por qué falla el ejemplo N», para distinguir los de cada fila.
- La voz no sustituye a nada: todo lo que el tutor dice está escrito y todo lo que se puede hacer hablando se puede hacer con el teclado (RF-08). Las regiones `aria-live` siguen igual con la voz activada; los ajustes avisan de que con un lector de pantalla no hace falta activarla.
- «Dictar» es un botón conmutador (`aria-pressed`) y «Te escucho…» se anuncia una vez. El micrófono abierto se ve siempre con icono y texto, no solo con color.
- La barra de la llamada es un grupo «Llamada con el tutor». Cada cambio de estado se anuncia una vez (`polite`); lo que se va entendiendo no se anuncia palabra a palabra, solo la pregunta enviada, como cualquier otra. Ningún cambio de estado mueve el foco, y todos sus botones se alcanzan con el teclado.
- El atajo de la llamada aparece en el tooltip de sus botones.
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
- [ ] Ejecutar con todo superado lanza la fiesta, y volver a ejecutar sin romper nada, aplausos; mejorar lanza el ánimo; con fallos no sale nada.
- [ ] Cada respuesta nueva lanza su reacción con su emoji y mueve la mascota; dos seguidas se suman sin cortarse; sin «Emojis animados», los mismos emojis estáticos; reducidas, su emoji pequeño; desactivadas, nada; con «reducir movimiento», su emoji se desvanece sin moverse.
- [ ] axe sin infracciones en claro y oscuro, con conversación, vacía, cargando, con error y entregada.
- [x] «¿Cuántos me quedan?» responde con los datos del alumno y dice «Ha consultado tu progreso»; «pon el modo oscuro» lo aplica con «Deshacer»; «ponme el siguiente» deja el botón (2.5e).
- [x] «Arréglame el código» con un `retrun` deja «Aplicar la corrección» con «Línea 5: retrun → return»; «formatéalo», «ejecuta las pruebas» y «entrégalo» dejan su botón y dicen qué pasó; sin despiste, no hay arreglo (2.5f, con datos simulados).
- [ ] Tres ejecuciones seguidas con la misma prueba fallando traen una intervención con «El tutor se acerca»; no se repite hasta otros tres fallos ni antes de tres minutos, y recargar no la repite (6.2b).
- [ ] Cuatro minutos sin actividad traen una sola intervención, y ninguna con el alumno fuera de la pestaña, con una pregunta a medio escribir o con la proactividad desactivada (6.2b).
- [ ] Superar una prueba que llevaba tres fallos trae una felicitación, sin esperar al cooldown (6.2b).
- [ ] Una intervención que el tutor calla o que falla no deja turno, aviso ni reacción (6.2b).
- [ ] Una petición proactiva sin motivo real recibe silencio del servidor, sin llamada al modelo (6.2c).
- [ ] Plegado, «Pregúntale al tutor» enseña «pensando» y después la respuesta sin mover el foco; una intervención entra sin «pensando»; «Cerrar el aviso» deja el punto (6.2d).
- [ ] El atajo sale solo en los ejemplos visibles que fallan y en el móvil cambia a la pestaña «Tutor» (6.2d).
- [ ] Una intervención de ayuda reacciona en reducido y un logro, completo (6.2d).
- [ ] axe sin infracciones en claro y oscuro con el bocadillo en «pensando», con respuesta y con error (6.2d).
- [x] Con la voz activada y una voz elegida, «Escuchar» dice la respuesta frase a frase sin leer el código, y «Parar» la calla; sin voz elegida, lleva a los ajustes (6.1a).
- [x] Con la voz desactivada no aparece ningún control de voz ni se descarga su código (6.1a).
- [ ] «Dictar» escribe en el campo lo que se dice sin borrar lo escrito y no envía nada; sin permiso para el micrófono, el aviso dice qué hacer y se puede seguir escribiendo (6.1b).
- [ ] En un navegador sin reconocimiento no hay «Dictar» ni «Llamar al tutor», y el resto funciona (6.1b).
- [ ] En una llamada, una pregunta dicha se envía tras el silencio, su respuesta se oye y se lee, y el micrófono vuelve a abrirse al acabar (6.1c).
- [ ] «Interrumpir» calla al tutor al momento y deja la respuesta entera en el chat; Esc descarta lo que se estaba diciendo y «Corregir» lo deja en el campo (6.1c).
- [ ] Tras 90 segundos sin voz y al ocultar la pestaña, la llamada queda en espera con el micrófono cerrado; colgar, cambiar de ejercicio y entregar lo cierran (6.1c).
- [ ] axe sin infracciones en claro y oscuro con el dictado en marcha y con la llamada en cada estado (6.1b y 6.1c).

## Fuera de alcance

- Los ajustes de las reacciones (modo y emojis 3D) en la pantalla de ajustes (1.9): hasta entonces se cambian en el muestrario.
- La voz llega en el 6.1a (escuchar), el 6.1b (dictar) y el 6.1c (llamada); las órdenes de voz («cuelga», «repite») y resaltar la frase que se está diciendo quedan en `PENDIENTES.md`. Las intervenciones proactivas llegan en el 6.2b (lógica), el 6.2c (servidor) y el 6.2d (bocadillo y atajo). La conversación ya muestra las de las fixtures.
- El atajo «Pregúntale al tutor» en la línea del error del editor: fase 7 (`PENDIENTES.md`).
- El streaming real (2.4, D-017): el tutor simulado ya escribe poco a poco y el cliente no cambiará.

## Pulido pendiente

Se rellena si se agota el tiempo de la pantalla.
