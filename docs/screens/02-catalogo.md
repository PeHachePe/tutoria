# 02 · Catálogo de ejercicios

`/alumno` · Alumno · Capa 1 · 3 h

## Objetivo

Que el alumno vea los ejercicios asignados a sus grupos, agrupados por sesión, con su dificultad, su estado y su progreso, y que abra cualquiera con un clic (RF-02).

## Datos

- Lee `ExerciseService.listAssigned(userId)` con `resource()`, con el usuario de `AuthStore`. Sin store (4.5): todo lo demás se deriva con `computed()`.
- Cada ejercicio asignado trae el ejercicio (título, dificultad y contenidos), su sesión con su título (o `null`), el estado del último intento, cuándo cambió por última vez y las pistas pedidas en él con el nivel alcanzado (D-034).
- No escribe nada: abrir un ejercicio crea el intento en la pantalla de trabajo (1.3).

## Contenido y disposición

- Referencia: boceto (figura 7 de la memoria) y prototipo (figura 16).
- Cabecera: el `h1` «Ejercicios» y una línea de ayuda con el nombre del alumno («Hola, Lucía. Elige un ejercicio. Tu progreso se guarda automáticamente»).
- Resumen (1.2b): el progreso global «n/N superados» en grande, con una barra de progreso determinada, y contadores por estado («1 listo para entregar», «2 con fallos», «1 en curso», «7 entregados»; los que están a cero no salen). «Superados» cuenta los superados y los entregados (D-027); los contadores avisan de lo superado que falta por entregar.
- Tarjeta destacada (1.2b, D-034), en el color principal del tema y con la mascota (no en el móvil):
  - «Continúa donde lo dejaste»: el intento abierto (en curso, con fallos o superado sin entregar) que cambió el último;
  - si no hay ninguno abierto, «Tu siguiente ejercicio»: el primero sin empezar;
  - con todo entregado, en su lugar, «¡Enhorabuena, Lucía!» con la mascota contenta.
    Lleva el título, «Sesión N · título de la sesión · contenidos», el chip de estado y el botón relleno con flecha.
- Un bloque por sesión, en orden, cada uno sobre una superficie propia: un `h2` con «Sesión N» en pequeño y el título de la sesión (o solo «Sesión N» si no tiene), un punto por ejercicio del color de su estado y su propio «n/N superados»; debajo, la lista de ejercicios separados por líneas. Cada sesión se pliega y despliega desde su encabezado; al llegar, las sesiones entregadas enteras empiezan plegadas y las que tienen algo pendiente, abiertas (una sesión superada con algo sin entregar sigue abierta).
- Cada ejercicio:
  - un círculo con su número dentro de la sesión, o ✓ si está superado, del color de su estado (decorativo: el chip lo dice con texto);
  - título del ejercicio (`h3`) y, debajo, sus contenidos separados por «·» («Bucles · rangos · condicionales»);
  - si está superado sin entregar, «Listo para entregar»;
  - si el intento tiene pistas pedidas, «n pistas pedidas · nivel n»;
  - chip de dificultad (neutro) y chip de estado (color e icono);
  - el botón según el estado: «Empezar» si no está empezado, «Continuar» si está en curso, con fallos o superado, y «Repasar» si está entregado. «Continuar» es el principal (relleno); «Empezar», tonal, y «Repasar», con borde, para que destaque lo que está a medias. Todos con el mismo ancho mínimo, para que queden alineados.
- Escritorio y tablet: una fila por ejercicio, con el círculo y el texto a la izquierda y chips y botón a la derecha. Móvil (375 px): el título y los contenidos arriba, y debajo los chips y el botón; el resumen apila los contadores bajo la barra.
- La lista crece con la página: es el contenido principal y no tiene una zona propia con scroll.

## Interacciones

- **Empezar, Continuar o Repasar:** navega a `/alumno/ejercicio/:id`. Es un enlace con aspecto de botón, porque cambia de página.
- **Encabezado de una sesión:** la pliega o la despliega; el chevron gira (sin animación con `prefers-reduced-motion`).
- **Reintentar** (estado de error): vuelve a cargar la lista.

## Estados

- **Cargando:** esqueletos con la forma de las tarjetas (`shared/skeleton/`), solo si la espera pasa de 300 ms.
- **Vacío:** la mascota en reposo y «Aún no tienes ejercicios asignados. Cuando tu docente te asigne alguno, aparecerá aquí» (`shared/empty-state/`).
- **Error:** mensaje según el tipo de error y botón «Reintentar» (`shared/load-error/`).
- **Con datos:** las sesiones con sus tarjetas.

## Accesibilidad

- Al llegar, el foco va al `h1` y la pestaña dice «Ejercicios · TutorIA».
- Encabezados en orden (`h1` → `h2` por sesión → `h3` por ejercicio) y cada sesión es una lista (`ul`).
- Sesiones plegables con el patrón de acordeón de las prácticas de ARIA: un botón dentro del `h2`, con `aria-expanded` y `aria-controls` hacia su lista. Su nombre lee la sesión, su título y su progreso («Sesión 1 Bucles y condicionales 2/2 superados»); los puntos de estado son decorativos (`aria-hidden`).
- El resumen, la tarjeta destacada y cada sesión son regiones con nombre (`section` con `aria-labelledby`).
- El nombre accesible de cada botón incluye el título del ejercicio («Empezar: Contar números pares»), para que los botones no suenen todos igual fuera de contexto. El texto visible va al principio del nombre (WCAG 2.5.3).
- La barra de progreso tiene nombre («Ejercicios superados») y su valor.
- Mientras carga, la zona tiene `aria-busy`, el esqueleto `aria-hidden` y un «Cargando los ejercicios…» para el lector de pantalla. El error se anuncia con `role="alert"`.
- El chip de estado no depende solo del color: lleva icono y texto.

## Criterios de aceptación

- [x] Lucía Martín ve los 8 ejercicios de 1.º DAW A agrupados en las sesiones 1 a 4, con sus títulos, el estado de su último intento y el progreso correcto.
- [x] Lucía ve su último ejercicio, superado sin entregar, como «Listo para entregar» en la tarjeta destacada, en el resumen y en la sesión 4, que no empieza plegada (1.2b).
- [x] Hugo ve «Continúa donde lo dejaste» con el intento que tocó el último; un alumno sin empezar, «Tu siguiente ejercicio»; Aya, con todo entregado, la enhorabuena (1.2b).
- [x] Una sesión sin título (1.º DAM B, sesión 2) se muestra como «Sesión 2» (1.2b).
- [x] Cada tarjeta muestra los contenidos del ejercicio y, si las hay, las pistas pedidas con su nivel.
- [x] Cada botón dice Empezar, Continuar o Repasar según el estado y abre su ejercicio.
- [x] Las sesiones entregadas enteras empiezan plegadas, y cualquier sesión se pliega y despliega con el ratón o el teclado.
- [x] Con latencia, aparecen los esqueletos; sin latencia, no parpadean.
- [x] Un alumno sin ejercicios ve el estado vacío, y un error de red muestra el mensaje con «Reintentar», que funciona.
- [x] Responsive a 375, 768 y 1280 px sin scroll horizontal; axe sin infracciones en claro y oscuro.

## Fuera de alcance

Nada de momento.

## Pulido pendiente

Se rellena si se agota el tiempo de la pantalla.
