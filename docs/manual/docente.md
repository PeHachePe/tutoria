# Manual del profesorado

Cómo se usa TutorIA como docente: preparar tus clases y sus asignaturas, escribir y asignar ejercicios, seguir la clase en vivo y ver cómo evoluciona cada grupo.

> Generado con `npm run manual` el 26/11/2026 a partir de las tareas guiadas de la aplicación: cada tarea se hizo de principio a fin en el navegador, con los datos de demostración, y cada paso lleva el texto de su globo y su captura. No se edita a mano: se vuelve a generar cuando cambian las tareas o las pantallas.

Todo lo que cuenta este manual está también dentro de la aplicación: el botón «Ayuda» (?), arriba a la derecha, hace estas mismas tareas contigo sobre tus propios datos.

## Índice

- [Bienvenida](#bienvenida)
- Primeros pasos
  - [Crear tu clase y matricular a su alumnado](#create-class)
  - [Crear un bloque](#create-block)
  - [Añadir un ejercicio al banco](#add-exercise)
  - [Asignar un ejercicio a un bloque](#assign-exercise)
  - [Seguir la clase en vivo](#follow-live)
- ¿Cómo se hace…?
  - [Atender a quien necesita ayuda](#attend)
  - [Seguir otro grupo u otro bloque](#other-group)
  - [Buscar a un alumno en la clase](#find-student)
  - [Cambiar el nombre o el curso de una clase](#edit-class)
  - [Preparar la clase del curso siguiente](#duplicate-class)
  - [Añadir una asignatura a la clase](#add-subject)
  - [Matricular solo en una asignatura](#enroll-in-subject)
  - [Quitar a un alumno de la clase](#remove-student)
  - [Poner la evaluación final](#final-evaluation)
  - [Exportar el alumnado](#export-students)
  - [Quitar una asignatura o eliminar la clase](#remove-subject)
  - [Copiar los bloques de otro grupo](#copy-blocks)
  - [Poner fechas de entrega](#due-dates)
  - [Ocultar un bloque o un ejercicio](#hide-content)
  - [Cambiar el orden](#reorder)
  - [Mover un ejercicio a otro bloque](#move-exercise)
  - [Borrar varios bloques a la vez](#select-several)
  - [Buscar en el banco](#find-exercise)
  - [Adaptar un ejercicio de otro docente](#duplicate-exercise)
  - [Asignar un ejercicio desde el banco](#assign-from-bank)
  - [Traducir un ejercicio](#translate-exercise)
  - [Probar un ejercicio como alumno](#try-as-student)
  - [Ajustar cuándo se ofrece el tutor](#proactive-thresholds)
  - [Ver qué hizo un alumno, paso a paso](#attempt-timeline)
  - [Ver cómo evoluciona un grupo](#group-evolution)
- Recorridos de pantalla
  - [Conocer la sesión en vivo](#tour-live)
  - [Conocer el detalle de un intento](#tour-attempt)
  - [Conocer el banco de ejercicios](#tour-exercise-bank)
  - [Conocer el formulario de un ejercicio](#tour-exercise-form)
  - [Conocer los bloques](#tour-blocks)
  - [Conocer los grupos](#tour-groups)
  - [Conocer el histórico](#tour-history)

## <a id="bienvenida"></a>Bienvenida

Lo primero que ves al entrar por primera vez. Se puede volver a ver desde «Ayuda» › «Ver la bienvenida».

### 1. ¡Hola, Marta!

Soy el tutor de TutorIA. Te enseño en un momento dónde está cada cosa; puedes saltarlo cuando quieras.

![Paso 1: ¡Hola, Marta!](capturas/docente/welcome-01.webp)

### 2. La ayuda

Aquí la tienes siempre: tus primeros pasos, el recorrido de cada pantalla y la explicación de cada pieza.

![Paso 2: La ayuda](capturas/docente/welcome-02.webp)

### 3. Claro u oscuro

El tema: claro, oscuro o el de tu sistema. Pruébalo ahora si quieres.

![Paso 3: Claro u oscuro](capturas/docente/welcome-03.webp)

### 4. Tu idioma

Español, català o English. Si prefieres otro, elígelo ahora y seguimos en él.

![Paso 4: Tu idioma](capturas/docente/welcome-04.webp)

### 5. Tu menú

Con qué cuenta has entrado y «Cerrar sesión».

![Paso 5: Tu menú](capturas/docente/welcome-05.webp)

### 6. Tus pantallas

Todo lo que haces está en este menú. El botón de arriba a la izquierda lo pliega a sus iconos o, en el móvil, lo abre.

![Paso 6: Tus pantallas](capturas/docente/welcome-06.webp)

### 7. En vivo

Cómo va tu grupo mientras trabaja, ejercicio a ejercicio, y quién necesita ayuda.

![Paso 7: En vivo](capturas/docente/welcome-07.webp)

### 8. Histórico

Cómo evoluciona cada grupo, bloque a bloque, también de cursos anteriores.

![Paso 8: Histórico](capturas/docente/welcome-08.webp)

### 9. Ejercicios

El banco común del profesorado, con sus pruebas automáticas.

![Paso 9: Ejercicios](capturas/docente/welcome-09.webp)

### 10. Bloques

Los temas de cada grupo y los ejercicios que les asignas, en el orden en que los verá el alumnado.

![Paso 10: Bloques](capturas/docente/welcome-10.webp)

### 11. Grupos

Las clases, sus asignaturas y su alumnado: aquí se crean y se matricula.

![Paso 11: Grupos](capturas/docente/welcome-11.webp)

### 12. Por dónde seguir

Tus primeros pasos te llevan a preparar tu primera clase de principio a fin. Están siempre en «Ayuda».

![Paso 12: Por dónde seguir](capturas/docente/welcome-12.webp)

## Primeros pasos

### <a id="create-class"></a>Crear tu clase y matricular a su alumnado

_Tu clase, las asignaturas que das en ella y su alumnado._

#### 1. Grupos

Tus clases, sus asignaturas y su alumnado están en Grupos.

**Qué haces:** Pulsa «Grupos»

![Paso 1: Grupos](capturas/docente/create-class-01.webp)

#### 2. Añadir clase

Vas a crear una clase de verdad. Si era solo para probar, después quítale las asignaturas y elimínala desde su menú «⋮».

**Qué haces:** Pulsa «Añadir clase»

![Paso 2: Añadir clase](capturas/docente/create-class-02.webp)

#### 3. La clase

Su nombre, como 1.º DAW A, y su curso. Si ya existe porque la da otro docente, te lo dice al escribirlo: únete a ella con tus asignaturas.

**Qué haces:** Escribe su nombre y pulsa «Crear y elegir asignaturas»

![Paso 3: La clase](capturas/docente/create-class-03.webp)

#### 4. Tus asignaturas

Marca las que das en esta clase. Cada una es un grupo, con su propio alumnado y sus bloques.

**Qué haces:** Marca tus asignaturas y pulsa «Añadir»

![Paso 4: Tus asignaturas](capturas/docente/create-class-04.webp)

#### 5. Matricular en la clase

El alumnado entra en la clase y en todas sus asignaturas, salvo los desdobles.

**Qué haces:** Pulsa «Matricular en la clase»

![Paso 5: Matricular en la clase](capturas/docente/create-class-05.webp)

#### 6. Elige a tu alumnado

Elígelo entre quienes no tienen clase este curso, pega sus correos, tráelo de otra clase o búscalo. Solo están las cuentas que ya existen: si falta alguien, pide a la administración que le dé de alta.

**Qué haces:** Elige al alumnado y pulsa «Matricular»

![Paso 6: Elige a tu alumnado](capturas/docente/create-class-06.webp)

#### 7. Tu alumnado

Una fila por alumno y una columna por asignatura. Desde el menú de cada uno, lo quitas de la clase.

![Paso 7: Tu alumnado](capturas/docente/create-class-07.webp)

### <a id="create-block"></a>Crear un bloque

_Un tema de un grupo, que luego llenas de ejercicios._

#### 1. Bloques

Los temas de cada grupo están en Bloques.

**Qué haces:** Pulsa «Bloques»

![Paso 1: Bloques](capturas/docente/create-block-01.webp)

#### 2. El grupo

Cada asignatura de una clase tiene sus bloques. Elige aquí la del bloque nuevo.

![Paso 2: El grupo](capturas/docente/create-block-02.webp)

#### 3. Nuevo bloque

Se crea de verdad. Si era solo para probar, bórralo desde su menú «⋮» mientras nadie lo haya empezado.

**Qué haces:** Pulsa «Nuevo bloque»

![Paso 3: Nuevo bloque](capturas/docente/create-block-03.webp)

#### 4. El bloque

Su título, como «Tema 1: Bucles». Puedes dejarlo oculto o hacer que se abra solo un día.

**Qué haces:** Escribe su título y pulsa «Crear el bloque»

![Paso 4: El bloque](capturas/docente/create-block-04.webp)

#### 5. Tus bloques

En el orden en que los verá tu alumnado. Con «Visible» decides si lo ven, y desde su menú le añades ejercicios.

![Paso 5: Tus bloques](capturas/docente/create-block-05.webp)

### <a id="add-exercise"></a>Añadir un ejercicio al banco

_Escribir un ejercicio con su enunciado y sus pruebas._

#### 1. Ejercicios

El banco común de todo el profesorado está en Ejercicios.

**Qué haces:** Pulsa «Ejercicios»

![Paso 1: Ejercicios](capturas/docente/add-exercise-01.webp)

#### 2. Nuevo ejercicio

Antes de escribir uno, busca: quizá otro docente ya lo tiene y te basta con duplicarlo.

**Qué haces:** Pulsa «Nuevo ejercicio»

![Paso 2: Nuevo ejercicio](capturas/docente/add-exercise-02.webp)

#### 3. Título y enunciado

Qué tiene que hacer la función, con ejemplos. Escribe el código entre comillas invertidas.

![Paso 3: Título y enunciado](capturas/docente/add-exercise-03.webp)

#### 4. Dificultad y asignaturas

Las asignaturas deciden quién lo ve en el banco.

![Paso 4: Dificultad y asignaturas](capturas/docente/add-exercise-04.webp)

#### 5. La función

Su nombre y sus parámetros, en inglés, como el código de verdad.

![Paso 5: La función](capturas/docente/add-exercise-05.webp)

#### 6. Las pruebas

Lo que recibe y lo que debe devolver. Deja visibles los ejemplos del enunciado y oculta los casos límite.

![Paso 6: Las pruebas](capturas/docente/add-exercise-06.webp)

#### 7. Probar mi solución

Escribe una solución y comprueba que tus pruebas están bien antes de dárselo a tu alumnado.

![Paso 7: Probar mi solución](capturas/docente/add-exercise-07.webp)

#### 8. Crear el ejercicio

Cuando esté todo, pulsa «Crear el ejercicio»: si falta algo, te dice qué. Se guarda en el banco común; si no lo quieres, archívalo o bórralo desde su menú mientras nadie lo haya empezado.

![Paso 8: Crear el ejercicio](capturas/docente/add-exercise-08.webp)

### <a id="assign-exercise"></a>Asignar un ejercicio a un bloque

_Llevar ejercicios del banco a un bloque de tu grupo._

#### 1. Tus bloques

Los ejercicios se asignan a un bloque, y tu alumnado los ve en ese orden.

![Paso 1: Tus bloques](capturas/docente/assign-exercise-01.webp)

#### 2. Añadir ejercicios

Cada bloque tiene el suyo, al final.

**Qué haces:** Pulsa «Añadir ejercicios»

![Paso 2: Añadir ejercicios](capturas/docente/assign-exercise-02.webp)

#### 3. Elige del banco

Busca y marca los que quieras: se añaden al final del bloque. Si no hay ninguno de tu asignatura, escribe uno antes en Ejercicios.

**Qué haces:** Marca los ejercicios y pulsa «Añadir»

![Paso 3: Elige del banco](capturas/docente/assign-exercise-03.webp)

#### 4. Ya están asignados

Cada uno con su fecha de entrega, el ojo para ocultarlo y su menú. Si nadie lo ha empezado, «Quitar» lo saca del bloque.

![Paso 4: Ya están asignados](capturas/docente/assign-exercise-04.webp)

### <a id="follow-live"></a>Seguir la clase en vivo

_Ver cómo va tu grupo y quién necesita ayuda._

#### 1. En vivo

Lo que hace tu grupo ahora mismo está en En vivo.

**Qué haces:** Pulsa «En vivo»

![Paso 1: En vivo](capturas/docente/follow-live-01.webp)

#### 2. Grupo y bloque

Elige el grupo y, a su lado, el bloque que trabaja hoy.

![Paso 2: Grupo y bloque](capturas/docente/follow-live-02.webp)

#### 3. ¿En directo?

En directo mientras alguien trabaja; fuera de clase, lo que dejaron hecho.

![Paso 3: ¿En directo?](capturas/docente/follow-live-03.webp)

#### 4. Dónde está la clase

Cuántos van por cada ejercicio y cómo. Pulsa una barra para ver quiénes son.

![Paso 4: Dónde está la clase](capturas/docente/follow-live-04.webp)

#### 5. El alumnado

Todos, los que han empezado o los que han terminado.

![Paso 5: El alumnado](capturas/docente/follow-live-05.webp)

#### 6. El detalle de cada uno

Pulsa el nombre de un alumno para ver su código, sus pruebas y lo que le dijo el tutor.

![Paso 6: El detalle de cada uno](capturas/docente/follow-live-06.webp)

## ¿Cómo se hace…?

### <a id="attend"></a>Atender a quien necesita ayuda

_Ver qué le pasa y marcarlo como atendido._

#### 1. Su detalle

Pulsa su nombre: verás su código, sus pruebas y lo que le dijo el tutor. Cuando le hayas ayudado, «Atendido» lo quita de la lista.

![Paso 1: Su detalle](capturas/docente/attend-01.webp)

### <a id="other-group"></a>Seguir otro grupo u otro bloque

_Y ver lo que hicieron fuera de clase._

#### 1. El grupo

Cada asignatura de cada clase es un grupo.

![Paso 1: El grupo](capturas/docente/other-group-01.webp)

#### 2. El bloque

Un punto verde marca los que tienen actividad ahora.

![Paso 2: El bloque](capturas/docente/other-group-02.webp)

#### 3. Fuera de clase

Si nadie trabaja ahora, ves lo que dejaron hecho y cuándo fue su última actividad.

![Paso 3: Fuera de clase](capturas/docente/other-group-03.webp)

### <a id="find-student"></a>Buscar a un alumno en la clase

_Por su nombre, o los que han terminado._

#### 1. Todos, empezados o terminados

Para ver solo una parte del alumnado.

![Paso 1: Todos, empezados o terminados](capturas/docente/find-student-01.webp)

#### 2. Buscar

Por su nombre, mientras escribes.

![Paso 2: Buscar](capturas/docente/find-student-02.webp)

### <a id="edit-class"></a>Cambiar el nombre o el curso de una clase

_Desde el menú de la clase._

#### 1. El menú de la clase

Lo que puedes hacer con la clase elegida.

**Qué haces:** Abre el menú «⋮» de la clase

![Paso 1: El menú de la clase](capturas/docente/edit-class-01.webp)

#### 2. Editar

Su nombre y su curso, para todos sus docentes y su alumnado. Solo lo cambia quien la creó.

**Qué haces:** Pulsa «Editar»

![Paso 2: Editar](capturas/docente/edit-class-02.webp)

### <a id="duplicate-class"></a>Preparar la clase del curso siguiente

_Duplicarla con tus asignaturas, sus bloques y, si quieres, su alumnado._

#### 1. El menú de la clase

Elige antes, arriba, la clase que quieres repetir.

**Qué haces:** Abre el menú «⋮» de la clase

![Paso 1: El menú de la clase](capturas/docente/duplicate-class-01.webp)

#### 2. Duplicar

Crea la misma clase en otro curso, con las asignaturas tuyas que elijas y, si quieres, sus bloques, sus fechas y su alumnado. Lo eliges antes de crear nada.

**Qué haces:** Pulsa «Duplicar…»

![Paso 2: Duplicar](capturas/docente/duplicate-class-02.webp)

### <a id="add-subject"></a>Añadir una asignatura a la clase

_Otra asignatura que das en una clase que ya tienes._

#### 1. Añadir asignatura

Las que das en esta clase y aún no tiene. Si otro docente ya la da a toda la clase, la tuya será un desdoble.

**Qué haces:** Pulsa «Añadir asignatura»

![Paso 1: Añadir asignatura](capturas/docente/add-subject-01.webp)

### <a id="enroll-in-subject"></a>Matricular solo en una asignatura

_Para quien no cursa toda la clase, o en un desdoble._

#### 1. El menú de la asignatura

Cada asignatura tuya tiene el suyo, en su columna.

**Qué haces:** Abre el menú «⋮» de una asignatura

![Paso 1: El menú de la asignatura](capturas/docente/enroll-in-subject-01.webp)

#### 2. Matricular solo aquí

Entra en esta asignatura y no en las demás de la clase. Lo eliges igual que al matricular en la clase.

**Qué haces:** Pulsa «Matricular solo aquí…»

![Paso 2: Matricular solo aquí](capturas/docente/enroll-in-subject-02.webp)

### <a id="remove-student"></a>Quitar a un alumno de la clase

_Sale de la clase; su trabajo se conserva._

#### 1. El menú del alumno

Cada alumno tiene el suyo, al final de su fila.

**Qué haces:** Abre el menú «⋮» de un alumno

![Paso 1: El menú del alumno](capturas/docente/remove-student-01.webp)

#### 2. Quitar de la clase

Sale de la clase y de todas sus asignaturas. Te pide confirmación, y lo que ya hizo se conserva.

**Qué haces:** Pulsa «Quitar de la clase»

![Paso 2: Quitar de la clase](capturas/docente/remove-student-02.webp)

### <a id="final-evaluation"></a>Poner la evaluación final

_Quién promociona, repite, titula o deja los estudios._

#### 1. Evaluación final

Al acabar el curso. Con ella, la administración sabe qué cuentas desactivar y tu clase del curso siguiente, a quién traer.

**Qué haces:** Pulsa «Evaluación final»

![Paso 1: Evaluación final](capturas/docente/final-evaluation-01.webp)

### <a id="export-students"></a>Exportar el alumnado

_La lista en una hoja de cálculo, o sus correos._

#### 1. Exportar

El alumnado de la clase, como se ve con el filtro puesto.

**Qué haces:** Pulsa el botón de exportar

![Paso 1: Exportar](capturas/docente/export-students-01.webp)

#### 2. Elige cómo

La lista en CSV, que se abre con una hoja de cálculo, o los correos copiados, para pegarlos en un mensaje.

**Qué haces:** Elige una de las dos

![Paso 2: Elige cómo](capturas/docente/export-students-02.webp)

### <a id="remove-subject"></a>Quitar una asignatura o eliminar la clase

_Mientras nadie haya trabajado en ella._

#### 1. El menú de la asignatura

Cada asignatura tuya tiene el suyo, en su columna.

**Qué haces:** Abre el menú «⋮» de una asignatura

![Paso 1: El menú de la asignatura](capturas/docente/remove-subject-01.webp)

#### 2. Ya tiene trabajo

Alguien de su alumnado ya ha trabajado en ella, así que no se elimina: su trabajo se conserva. Oculta sus bloques si ya no la usas.

![Paso 2: Ya tiene trabajo](capturas/docente/remove-subject-02.webp)

### <a id="copy-blocks"></a>Copiar los bloques de otro grupo

_Los de otro grupo tuyo o de un curso anterior, con sus ejercicios._

#### 1. El grupo de destino

Elige aquí el grupo que recibe los bloques.

![Paso 1: El grupo de destino](capturas/docente/copy-blocks-01.webp)

#### 2. Copiar de otro grupo

Eliges el grupo de origen y qué bloques traer antes de copiar nada, también de un curso anterior.

**Qué haces:** Pulsa «Copiar de otro grupo»

![Paso 2: Copiar de otro grupo](capturas/docente/copy-blocks-02.webp)

### <a id="due-dates"></a>Poner fechas de entrega

_A un ejercicio o a todo un bloque._

#### 1. La de un ejercicio

Púlsala para ponerla, cambiarla o quitarla.

![Paso 1: La de un ejercicio](capturas/docente/due-dates-01.webp)

#### 2. El menú del bloque

Para todos sus ejercicios a la vez.

**Qué haces:** Abre el menú «⋮» del bloque

![Paso 2: El menú del bloque](capturas/docente/due-dates-02.webp)

#### 3. Para todo el bloque

La misma fecha para todos sus ejercicios. Después puedes cambiar la de alguno.

**Qué haces:** Pulsa «Fecha de entrega para todo el bloque»

![Paso 3: Para todo el bloque](capturas/docente/due-dates-03.webp)

### <a id="hide-content"></a>Ocultar un bloque o un ejercicio

_Prepararlo antes de que tu alumnado lo vea._

#### 1. Visible

Apagado, tu alumnado no ve el bloque hasta que lo enciendas. Prepáralo oculto y enciéndelo en clase.

![Paso 1: Visible](capturas/docente/hide-content-01.webp)

#### 2. Un solo ejercicio

El ojo lo oculta sin sacarlo del bloque. Si alguien ya lo empezó, ocúltalo en lugar de quitarlo: su trabajo se conserva.

![Paso 2: Un solo ejercicio](capturas/docente/hide-content-02.webp)

### <a id="reorder"></a>Cambiar el orden

_De los bloques y de sus ejercicios._

#### 1. Arrastrar

Por aquí se arrastran los bloques, y los ejercicios por el suyo, al orden en que los verá tu alumnado.

![Paso 1: Arrastrar](capturas/docente/reorder-01.webp)

#### 2. Sin arrastrar

Con el teclado o en el móvil, «Subir» y «Bajar» de su menú «⋮» hacen lo mismo.

![Paso 2: Sin arrastrar](capturas/docente/reorder-02.webp)

### <a id="move-exercise"></a>Mover un ejercicio a otro bloque

_Con su fecha y el trabajo de tu alumnado._

#### 1. El menú del ejercicio

Cada ejercicio de un bloque tiene el suyo.

**Qué haces:** Abre el menú «⋮» de un ejercicio

![Paso 1: El menú del ejercicio](capturas/docente/move-exercise-01.webp)

#### 2. Mover a otro bloque

Después eliges el bloque: el ejercicio pasa al final.

**Qué haces:** Pulsa «Mover a otro bloque»

![Paso 2: Mover a otro bloque](capturas/docente/move-exercise-02.webp)

### <a id="select-several"></a>Borrar varios bloques a la vez

_Los que nadie ha empezado._

#### 1. Seleccionar

Marca los bloques y bórralos de una vez, o marca de golpe los que nadie ha empezado. Los empezados no se borran: ocúltalos.

![Paso 1: Seleccionar](capturas/docente/select-several-01.webp)

### <a id="find-exercise"></a>Buscar en el banco

_Antes de escribir uno, quizá ya existe._

#### 1. Buscar

Por título, contenido o nombre de la función.

![Paso 1: Buscar](capturas/docente/find-exercise-01.webp)

#### 2. Asignatura

Las tuyas o una en concreto.

![Paso 2: Asignatura](capturas/docente/find-exercise-02.webp)

#### 3. Dificultad

Inicial, media, avanzada o de ampliación.

![Paso 3: Dificultad](capturas/docente/find-exercise-03.webp)

#### 4. Solo los míos

Los que escribiste tú, los únicos que puedes editar.

![Paso 4: Solo los míos](capturas/docente/find-exercise-04.webp)

#### 5. Archivados

Los que ya no salen en el banco. Sus intentos se conservan, y desde su menú vuelven.

![Paso 5: Archivados](capturas/docente/find-exercise-05.webp)

### <a id="duplicate-exercise"></a>Adaptar un ejercicio de otro docente

_Duplicarlo y cambiar la copia._

#### 1. El menú del ejercicio

Cada ejercicio tiene el suyo. Solo editas los tuyos; los demás, los duplicas.

**Qué haces:** Abre el menú «⋮» de un ejercicio

![Paso 1: El menú del ejercicio](capturas/docente/duplicate-exercise-01.webp)

#### 2. Duplicar

Abre una copia en el formulario, ya tuya. No se crea nada hasta que la guardes.

**Qué haces:** Pulsa «Duplicar»

![Paso 2: Duplicar](capturas/docente/duplicate-exercise-02.webp)

### <a id="assign-from-bank"></a>Asignar un ejercicio desde el banco

_Sin salir del banco._

#### 1. El menú del ejercicio

Cada ejercicio tiene el suyo.

**Qué haces:** Abre el menú «⋮» de un ejercicio

![Paso 1: El menú del ejercicio](capturas/docente/assign-from-bank-01.webp)

#### 2. Asignar a un bloque

Eliges el grupo y el bloque, y se añade al final.

**Qué haces:** Pulsa «Asignar a un bloque…»

![Paso 2: Asignar a un bloque](capturas/docente/assign-from-bank-02.webp)

### <a id="translate-exercise"></a>Traducir un ejercicio

_Con un borrador de la IA, que revisas._

#### 1. Sus idiomas

Tu alumnado lo lee en su idioma si está traducido; si no, en el original, con un aviso.

**Qué haces:** Abre la pestaña de otro idioma

![Paso 1: Sus idiomas](capturas/docente/translate-exercise-01.webp)

#### 2. Traducir con IA

Rellena la pestaña con un borrador que revisas antes de guardar; el código no se traduce. Escribe antes el título y el enunciado en el original.

![Paso 2: Traducir con IA](capturas/docente/translate-exercise-02.webp)

### <a id="try-as-student"></a>Probar un ejercicio como alumno

_Verlo como lo verá tu alumnado, con el tutor._

#### 1. Probar como alumno

El ejercicio tal como está en el formulario, en la pantalla del alumno y con el tutor, sin guardar nada. Espera a que la función y las pruebas sean válidas.

![Paso 1: Probar como alumno](capturas/docente/try-as-student-01.webp)

### <a id="proactive-thresholds"></a>Ajustar cuándo se ofrece el tutor

_A quien parece atascado en un ejercicio._

#### 1. Umbrales del tutor proactivo

Tras cuántos fallos seguidos de la misma prueba, o cuántos minutos sin hacer nada, el tutor se ofrece por su cuenta. Más bajos en un ejercicio difícil.

![Paso 1: Umbrales del tutor proactivo](capturas/docente/proactive-thresholds-01.webp)

### <a id="attempt-timeline"></a>Ver qué hizo un alumno, paso a paso

_Sus pruebas, sus pistas y su código._

#### 1. Lo que pasó

Todo lo que hizo, en orden: cada ejecución, cada pista y lo que le respondió el tutor.

![Paso 1: Lo que pasó](capturas/docente/attempt-timeline-01.webp)

#### 2. Filtrar

Todo, solo las pruebas o solo el tutor.

![Paso 2: Filtrar](capturas/docente/attempt-timeline-02.webp)

#### 3. Su código

El que entregó o, si sigue trabajando, el actual.

![Paso 3: Su código](capturas/docente/attempt-timeline-03.webp)

### <a id="group-evolution"></a>Ver cómo evoluciona un grupo

_Bloque a bloque, también de cursos anteriores._

#### 1. El curso y el grupo

También los de cursos anteriores.

![Paso 1: El curso y el grupo](capturas/docente/group-evolution-01.webp)

#### 2. Su evolución

Cuántas pistas pide de media cada alumno en cada bloque: si bajan, el grupo gana autonomía.

![Paso 2: Su evolución](capturas/docente/group-evolution-02.webp)

#### 3. Cada bloque

Cuántos superaron cada ejercicio, cuánto tardaron y dónde se atascaron.

![Paso 3: Cada bloque](capturas/docente/group-evolution-03.webp)

## Recorridos de pantalla

### <a id="tour-live"></a>Conocer la sesión en vivo

_Cada pieza de la sesión en vivo, de la barra y del menú._

#### 1. En directo o fuera de clase

En directo cuando alguien del grupo está trabajando ahora; si no, cuándo fue la última actividad.

![Paso 1: En directo o fuera de clase](capturas/docente/tour-live-01.webp)

#### 2. El grupo

Cada asignatura de cada clase que das es un grupo. Elige el que quieres seguir.

![Paso 2: El grupo](capturas/docente/tour-live-02.webp)

#### 3. El bloque

El tema que sigues. Un punto verde marca los que tienen actividad ahora.

![Paso 3: El bloque](capturas/docente/tour-live-03.webp)

#### 4. Dónde está la clase

Cuántos van por cada ejercicio y cómo: en curso, con fallos, superado o entregado. Pulsa una barra para ver quiénes son.

![Paso 4: Dónde está la clase](capturas/docente/tour-live-04.webp)

#### 5. El alumnado

Todos, los que han empezado o los que han terminado, con cuántos hay en cada pestaña.

![Paso 5: El alumnado](capturas/docente/tour-live-05.webp)

#### 6. Buscar alumno

Por su nombre, sin preocuparte de las tildes.

![Paso 6: Buscar alumno](capturas/docente/tour-live-06.webp)

#### 7. Cada alumno

Su estado, cuántas pruebas supera, las pistas que ha pedido y su última actividad. Pulsa su nombre para ver el detalle.

![Paso 7: Cada alumno](capturas/docente/tour-live-07.webp)

#### 8. El menú

Pliega el menú a sus iconos para dejar más sitio, o lo despliega. En el móvil, lo abre.

![Paso 8: El menú](capturas/docente/tour-live-08.webp)

#### 9. TutorIA

Desde cualquier pantalla, te lleva a la sesión en vivo.

![Paso 9: TutorIA](capturas/docente/tour-live-09.webp)

#### 10. Ayuda

Tus primeros pasos, el recorrido de cada pantalla, la ayuda de cada pieza y la bienvenida.

![Paso 10: Ayuda](capturas/docente/tour-live-10.webp)

#### 11. Tema

Claro, oscuro o el de tu sistema.

![Paso 11: Tema](capturas/docente/tour-live-11.webp)

#### 12. Idioma

Español, català o English. Los ejercicios se ven en el idioma que tengan traducido.

![Paso 12: Idioma](capturas/docente/tour-live-12.webp)

#### 13. Tu menú

Con qué cuenta has entrado y «Cerrar sesión».

![Paso 13: Tu menú](capturas/docente/tour-live-13.webp)

#### 14. En vivo

Cómo va tu grupo ahora mismo, ejercicio a ejercicio, y quién necesita ayuda.

![Paso 14: En vivo](capturas/docente/tour-live-14.webp)

#### 15. Histórico

Cómo evoluciona cada grupo, bloque a bloque, también de cursos anteriores.

![Paso 15: Histórico](capturas/docente/tour-live-15.webp)

#### 16. Ejercicios

El banco común del profesorado: busca, duplica o escribe ejercicios con sus pruebas.

![Paso 16: Ejercicios](capturas/docente/tour-live-16.webp)

#### 17. Bloques

Los temas de cada grupo y los ejercicios que les asignas, en el orden en que los verán.

![Paso 17: Bloques](capturas/docente/tour-live-17.webp)

#### 18. Grupos

Tus clases, sus asignaturas y su alumnado: aquí se crean y se matricula.

![Paso 18: Grupos](capturas/docente/tour-live-18.webp)

### <a id="tour-attempt"></a>Conocer el detalle de un intento

_Lo que hizo un alumno en un ejercicio, paso a paso._

#### 1. Volver

A la sesión en vivo, con el mismo grupo y el mismo bloque.

![Paso 1: Volver](capturas/docente/tour-attempt-01.webp)

#### 2. El alumno y su ejercicio

Cómo va, en qué ejercicio y bloque está y, si lo repite, qué intento es.

![Paso 2: El alumno y su ejercicio](capturas/docente/tour-attempt-02.webp)

#### 3. Ahora

Las pruebas que falla, la última ayuda del tutor y el resumen: tiempo de trabajo, ejecuciones, pistas y si pegó código o salió de la ventana.

![Paso 3: Ahora](capturas/docente/tour-attempt-03.webp)

#### 4. Evolución

Las pruebas que superó en cada ejecución y cuándo pidió pistas. Pulsa un punto para ir a ese momento.

![Paso 4: Evolución](capturas/docente/tour-attempt-04.webp)

#### 5. Línea temporal

Todo lo que hizo, en orden: cuándo abrió el ejercicio, cada ejecución, cada pista y lo que le respondió el tutor.

![Paso 5: Línea temporal](capturas/docente/tour-attempt-05.webp)

#### 6. Filtrar la línea temporal

Todo, solo las pruebas o solo el tutor.

![Paso 6: Filtrar la línea temporal](capturas/docente/tour-attempt-06.webp)

#### 7. Su código

El que entregó o, si sigue trabajando, el actual. Solo se lee: no se puede cambiar.

![Paso 7: Su código](capturas/docente/tour-attempt-07.webp)

### <a id="tour-exercise-bank"></a>Conocer el banco de ejercicios

_Buscar, filtrar y las acciones de cada ejercicio._

#### 1. Nuevo ejercicio

Escribe uno con su enunciado y sus pruebas. Lo verá todo el profesorado de sus asignaturas.

![Paso 1: Nuevo ejercicio](capturas/docente/tour-exercise-bank-01.webp)

#### 2. Buscar

Por título, contenido o nombre de la función.

![Paso 2: Buscar](capturas/docente/tour-exercise-bank-02.webp)

#### 3. Asignatura

Parte de las tuyas; elige otra o «Todas» para ver el resto del banco.

![Paso 3: Asignatura](capturas/docente/tour-exercise-bank-03.webp)

#### 4. Dificultad

Inicial, media, avanzada o de ampliación.

![Paso 4: Dificultad](capturas/docente/tour-exercise-bank-04.webp)

#### 5. Solo los míos

Los que has escrito tú: los únicos que puedes cambiar. Los de otros, duplícalos para adaptarlos.

![Paso 5: Solo los míos](capturas/docente/tour-exercise-bank-05.webp)

#### 6. Archivados

Los que ya no se usan: salen del banco sin que nadie pierda sus intentos.

![Paso 6: Archivados](capturas/docente/tour-exercise-bank-06.webp)

#### 7. Cuántos hay

Los que coinciden con los filtros, de todos los de las asignaturas elegidas.

![Paso 7: Cuántos hay](capturas/docente/tour-exercise-bank-07.webp)

#### 8. Cada ejercicio

Su dificultad, sus asignaturas y su función; si es tuyo, cuántas pruebas tiene, dónde está asignado y cuántos alumnos lo han empezado.

![Paso 8: Cada ejercicio](capturas/docente/tour-exercise-bank-08.webp)

#### 9. Sus acciones

Editarlo o verlo, duplicarlo, asignarlo a un bloque y, si es tuyo, archivarlo.

![Paso 9: Sus acciones](capturas/docente/tour-exercise-bank-09.webp)

### <a id="tour-exercise-form"></a>Conocer el formulario de un ejercicio

_El enunciado, la función, las pruebas y cómo comprobarlas._

#### 1. Volver

Al banco. Si hay cambios sin guardar, te lo pregunta antes.

![Paso 1: Volver](capturas/docente/tour-exercise-form-01.webp)

#### 2. Probar como alumno

La pantalla de trabajo del alumnado, con el tutor, tal como está el ejercicio. Necesita la función y una prueba.

![Paso 2: Probar como alumno](capturas/docente/tour-exercise-form-02.webp)

#### 3. Título y enunciado

En el idioma en que lo escribes; cuando lo guardes, podrás traducirlo con IA a los otros dos.

![Paso 3: Título y enunciado](capturas/docente/tour-exercise-form-03.webp)

#### 4. Dificultad y asignaturas

Las asignaturas deciden quién lo ve en el banco.

![Paso 4: Dificultad y asignaturas](capturas/docente/tour-exercise-form-04.webp)

#### 5. Umbrales del tutor proactivo

Cuántos fallos seguidos o minutos sin actividad esperan antes de que el tutor se ofrezca solo.

![Paso 5: Umbrales del tutor proactivo](capturas/docente/tour-exercise-form-05.webp)

#### 6. La función

Su nombre y sus parámetros, en inglés. Con ellos, el tutor da al alumno el esqueleto para empezar.

![Paso 6: La función](capturas/docente/tour-exercise-form-06.webp)

#### 7. Pruebas automáticas

Los argumentos y el resultado esperado, en JSON. Las visibles son los ejemplos del enunciado; las ocultas, los casos límite.

![Paso 7: Pruebas automáticas](capturas/docente/tour-exercise-form-07.webp)

#### 8. Probar mi solución

Escribe una solución y comprueba que las pruebas están bien. No se guarda.

![Paso 8: Probar mi solución](capturas/docente/tour-exercise-form-08.webp)

#### 9. Guardar

Si falta algo, te dice qué. «Cancelar» vuelve al banco sin guardar.

![Paso 9: Guardar](capturas/docente/tour-exercise-form-09.webp)

### <a id="tour-blocks"></a>Conocer los bloques

_Los temas de un grupo y sus ejercicios, pieza a pieza._

#### 1. Curso y grupo

Los bloques son de cada grupo: de una asignatura en una clase.

![Paso 1: Curso y grupo](capturas/docente/tour-blocks-01.webp)

#### 2. Copiar de otro grupo

Trae los bloques de otro grupo tuyo, también de un curso anterior, con sus ejercicios.

![Paso 2: Copiar de otro grupo](capturas/docente/tour-blocks-02.webp)

#### 3. Seleccionar

Para borrar varios bloques a la vez. Los que alguien ha empezado no se borran: ocúltalos.

![Paso 3: Seleccionar](capturas/docente/tour-blocks-03.webp)

#### 4. Nuevo bloque

Un tema, un repaso o una recuperación, con la fecha en que se abre si quieres.

![Paso 4: Nuevo bloque](capturas/docente/tour-blocks-04.webp)

#### 5. Los bloques del grupo

En el orden en que los verá tu alumnado.

![Paso 5: Los bloques del grupo](capturas/docente/tour-blocks-05.webp)

#### 6. Ordenar

Arrastra un bloque o un ejercicio a su sitio, o usa «Subir» y «Bajar» de su menú.

![Paso 6: Ordenar](capturas/docente/tour-blocks-06.webp)

#### 7. Visible

Apagado, tu alumnado no ve el bloque hasta que lo enciendas.

![Paso 7: Visible](capturas/docente/tour-blocks-07.webp)

#### 8. El menú del bloque

Editarlo, añadirle ejercicios, poner una fecha de entrega a todo el bloque, moverlo o borrarlo.

![Paso 8: El menú del bloque](capturas/docente/tour-blocks-08.webp)

#### 9. Cada ejercicio

Su número en el bloque, su dificultad y cuántos alumnos lo han empezado.

![Paso 9: Cada ejercicio](capturas/docente/tour-blocks-09.webp)

#### 10. Fecha de entrega

La de este ejercicio, que tu alumnado ve en su lista. «Fecha de entrega para todo el bloque», en el menú del bloque.

![Paso 10: Fecha de entrega](capturas/docente/tour-blocks-10.webp)

#### 11. Ocultar

Oculta el ejercicio a tu alumnado sin quitarlo del bloque.

![Paso 11: Ocultar](capturas/docente/tour-blocks-11.webp)

#### 12. El menú del ejercicio

Subirlo, bajarlo, moverlo a otro bloque o quitarlo. Si ya lo han empezado, mejor ocultarlo.

![Paso 12: El menú del ejercicio](capturas/docente/tour-blocks-12.webp)

#### 13. Añadir ejercicios

Elige ejercicios del banco y se añaden al final del bloque.

![Paso 13: Añadir ejercicios](capturas/docente/tour-blocks-13.webp)

### <a id="tour-groups"></a>Conocer los grupos

_Tus clases, sus asignaturas y su alumnado._

#### 1. Curso

Este curso o uno anterior, que ya se puede ver pero no cambiar.

![Paso 1: Curso](capturas/docente/tour-groups-01.webp)

#### 2. La clase

Como 1.º DAW A: la comparten todos sus docentes, cada uno con sus asignaturas.

![Paso 2: La clase](capturas/docente/tour-groups-02.webp)

#### 3. El menú de la clase

Editarla, duplicarla para el curso que viene o eliminarla mientras no tenga asignaturas.

![Paso 3: El menú de la clase](capturas/docente/tour-groups-03.webp)

#### 4. Añadir clase

Una nueva, o la de otro docente si ya existe: escribe su nombre y te lo dice.

![Paso 4: Añadir clase](capturas/docente/tour-groups-04.webp)

#### 5. El alumnado

Quién está en la clase y en qué asignaturas.

![Paso 5: El alumnado](capturas/docente/tour-groups-05.webp)

#### 6. Filtrar alumnos

Por nombre o correo.

![Paso 6: Filtrar alumnos](capturas/docente/tour-groups-06.webp)

#### 7. Evaluación final

Al acabar el curso, quién promociona, repite, titula o deja los estudios.

![Paso 7: Evaluación final](capturas/docente/tour-groups-07.webp)

#### 8. Matricular en la clase

Con una lista de correos, desde otra clase o buscándolos. Entran en todas sus asignaturas, salvo los desdobles.

![Paso 8: Matricular en la clase](capturas/docente/tour-groups-08.webp)

#### 9. Añadir asignatura

Las que das en esta clase; cada una es un grupo, con sus desdobles si los hay.

![Paso 9: Añadir asignatura](capturas/docente/tour-groups-09.webp)

#### 10. Exportar

La lista en CSV o los correos copiados, para pegarlos donde quieras.

![Paso 10: Exportar](capturas/docente/tour-groups-10.webp)

#### 11. La tabla

Una fila por alumno y una columna por asignatura, con su docente y cuántos alumnos tiene.

![Paso 11: La tabla](capturas/docente/tour-groups-11.webp)

#### 12. El menú de la asignatura

Editarla, ver sus bloques, matricular solo en ella o eliminarla si nadie ha trabajado en ella.

![Paso 12: El menú de la asignatura](capturas/docente/tour-groups-12.webp)

#### 13. El menú del alumno

Quitarlo de la clase y de todas sus asignaturas. Su trabajo se conserva.

![Paso 13: El menú del alumno](capturas/docente/tour-groups-13.webp)

### <a id="tour-history"></a>Conocer el histórico

_Cómo evoluciona un grupo, bloque a bloque._

#### 1. Curso y grupo

También de cursos anteriores, para comparar.

![Paso 1: Curso y grupo](capturas/docente/tour-history-01.webp)

#### 2. Evolución del grupo

Cuántas pistas pide de media cada alumno en cada bloque: si bajan, el grupo gana autonomía.

![Paso 2: Evolución del grupo](capturas/docente/tour-history-02.webp)

#### 3. Cada bloque

Cuántos superaron cada ejercicio, cuánto tardaron, dónde se atascaron y qué llegó a tiempo en cada fecha de entrega.

![Paso 3: Cada bloque](capturas/docente/tour-history-03.webp)
