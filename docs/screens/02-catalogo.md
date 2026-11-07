# 02 · Catálogo de ejercicios

`/alumno` · Alumno · Capa 1 · 3 h

## Objetivo

Que el alumno vea los ejercicios asignados a sus grupos, agrupados por sesión, con su dificultad, su estado y su progreso, y que abra cualquiera con un clic (RF-02).

## Datos

- Lee `ExerciseService.listAssigned(userId)` con `resource()`, con el usuario de `AuthStore`. Sin store (4.5): todo lo demás se deriva con `computed()`.
- Cada ejercicio asignado trae el ejercicio (título, dificultad y contenidos), su sesión, el estado del último intento y las pistas pedidas en él con el nivel alcanzado.
- No escribe nada: abrir un ejercicio crea el intento en la pantalla de trabajo (1.3).

## Contenido y disposición

- Referencia: boceto (figura 7 de la memoria) y prototipo (figura 16).
- Cabecera: el `h1` «Ejercicios», una línea de ayuda («Elige un ejercicio. Tu progreso se guarda automáticamente») y el progreso global «n/N superados» con una barra de progreso determinada. «Superados» cuenta los superados y los entregados (D-027).
- Un bloque por sesión, en orden: un `h2` «Sesión N» con su propio «n/N superados» y una lista de tarjetas. Cada sesión se pliega y despliega desde su encabezado; al llegar, las sesiones superadas enteras empiezan plegadas y las que tienen algo pendiente, abiertas (iteración 1).
- Cada tarjeta:
  - título del ejercicio (`h3`) y, debajo, sus contenidos separados por «·» («Bucles · rangos · condicionales»);
  - si el intento tiene pistas pedidas, «n pistas pedidas · nivel n»;
  - chip de dificultad (neutro) y chip de estado (color e icono);
  - el botón según el estado: «Empezar» si no está empezado, «Continuar» si está en curso, con fallos o superado, y «Repasar» si está entregado. «Continuar» es el principal (relleno); «Empezar», tonal, y «Repasar», con borde, para que destaque lo que está a medias.
- Escritorio y tablet: una fila por tarjeta, con el texto a la izquierda y chips y botón a la derecha. Móvil (375 px): el título y los contenidos arriba, y debajo los chips y el botón.
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
- Sesiones plegables con el patrón de acordeón de las prácticas de ARIA: un botón dentro del `h2`, con `aria-expanded` y `aria-controls` hacia su lista. Su nombre lee la sesión y su progreso («Sesión 1 2/2 superados»).
- El nombre accesible de cada botón incluye el título del ejercicio («Empezar: Contar números pares»), para que los botones no suenen todos igual fuera de contexto. El texto visible va al principio del nombre (WCAG 2.5.3).
- La barra de progreso tiene nombre («Ejercicios superados») y su valor.
- Mientras carga, la zona tiene `aria-busy`, el esqueleto `aria-hidden` y un «Cargando los ejercicios…» para el lector de pantalla. El error se anuncia con `role="alert"`.
- El chip de estado no depende solo del color: lleva icono y texto.

## Criterios de aceptación

- [ ] Lucía Martín ve los 8 ejercicios de 1.º DAW A agrupados en las sesiones 1 a 4, con el estado de su último intento y el progreso correcto.
- [ ] Cada tarjeta muestra los contenidos del ejercicio y, si las hay, las pistas pedidas con su nivel.
- [ ] Cada botón dice Empezar, Continuar o Repasar según el estado y abre su ejercicio.
- [ ] Las sesiones superadas enteras empiezan plegadas, y cualquier sesión se pliega y despliega con el ratón o el teclado.
- [ ] Con latencia, aparecen los esqueletos; sin latencia, no parpadean.
- [ ] Un alumno sin ejercicios ve el estado vacío, y un error de red muestra el mensaje con «Reintentar», que funciona.
- [ ] Responsive a 375, 768 y 1280 px sin scroll horizontal; axe sin infracciones en claro y oscuro.

## Fuera de alcance

Nada de momento.

## Pulido pendiente

Se rellena si se agota el tiempo de la pantalla.
