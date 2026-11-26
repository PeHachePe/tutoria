# Manual de la administración

Cómo se usa TutorIA desde la administración: las cuentas de usuario, el proveedor de IA y las asignaturas. La administración puede hacer además todo lo que hace un docente.

> Generado con `npm run manual` el 26/11/2026 a partir de las tareas guiadas de la aplicación: cada tarea se hizo de principio a fin en el navegador, con los datos de demostración, y cada paso lleva el texto de su globo y su captura. No se edita a mano: se vuelve a generar cuando cambian las tareas o las pantallas.

Todo lo que cuenta este manual está también dentro de la aplicación: el botón «Ayuda» (?), arriba a la derecha, hace estas mismas tareas contigo sobre tus propios datos.

## Índice

- [Bienvenida](#bienvenida)
- Primeros pasos
  - [Dar de alta un usuario](#add-user)
  - [Crear una clase y matricular a su alumnado](#create-class)
  - [Probar el proveedor de IA](#test-provider)
  - [Seguir la clase en vivo](#follow-live)
- ¿Cómo se hace…?
  - [Dar de alta a varios alumnos a la vez](#add-students)
  - [Dar otra contraseña a una cuenta](#reset-password)
  - [Cambiar el nombre, el correo o el rol](#edit-user)
  - [Desactivar o activar una cuenta](#disable-user)
  - [Desactivar a quien ya terminó](#finished-students)
  - [Ver la trayectoria de un alumno](#trajectory)
  - [Cambiar el proveedor o el modelo de IA](#change-provider)
  - [Añadir un modelo de respaldo](#fallback-model)
  - [Crear o traducir una asignatura](#subjects)
- Recorridos de pantalla
  - [Conocer Usuarios](#tour-users)
  - [Conocer Sistema](#tour-system)
- [Las tareas del docente](#tareas-compartidas)

## <a id="bienvenida"></a>Bienvenida

Lo primero que ves al entrar por primera vez. Se puede volver a ver desde «Ayuda» › «Ver la bienvenida».

### 1. ¡Hola, Administración!

Soy el tutor de TutorIA. Te enseño en un momento dónde está cada cosa; puedes saltarlo cuando quieras.

![Paso 1: ¡Hola, Administración!](capturas/administracion/welcome-01.webp)

### 2. La ayuda

Aquí la tienes siempre: tus primeros pasos, el recorrido de cada pantalla y la explicación de cada pieza.

![Paso 2: La ayuda](capturas/administracion/welcome-02.webp)

### 3. Claro u oscuro

El tema: claro, oscuro o el de tu sistema. Pruébalo ahora si quieres.

![Paso 3: Claro u oscuro](capturas/administracion/welcome-03.webp)

### 4. Tu idioma

Español, català o English. Si prefieres otro, elígelo ahora y seguimos en él.

![Paso 4: Tu idioma](capturas/administracion/welcome-04.webp)

### 5. Tu menú

Con qué cuenta has entrado y «Cerrar sesión».

![Paso 5: Tu menú](capturas/administracion/welcome-05.webp)

### 6. Tus pantallas

Todo lo que haces está en este menú. El botón de arriba a la izquierda lo pliega a sus iconos o, en el móvil, lo abre.

![Paso 6: Tus pantallas](capturas/administracion/welcome-06.webp)

### 7. Docencia

Todas las pantallas del docente, con todos los grupos del centro: puedes preparar una clase o seguirla en vivo como cualquier docente.

![Paso 7: Docencia](capturas/administracion/welcome-07.webp)

### 8. En vivo

Cómo va tu grupo mientras trabaja, ejercicio a ejercicio, y quién necesita ayuda.

![Paso 8: En vivo](capturas/administracion/welcome-08.webp)

### 9. Histórico

Cómo evoluciona cada grupo, bloque a bloque, también de cursos anteriores.

![Paso 9: Histórico](capturas/administracion/welcome-09.webp)

### 10. Ejercicios

El banco común del profesorado, con sus pruebas automáticas.

![Paso 10: Ejercicios](capturas/administracion/welcome-10.webp)

### 11. Bloques

Los temas de cada grupo y los ejercicios que les asignas, en el orden en que los verá el alumnado.

![Paso 11: Bloques](capturas/administracion/welcome-11.webp)

### 12. Grupos

Las clases, sus asignaturas y su alumnado: aquí se crean y se matricula.

![Paso 12: Grupos](capturas/administracion/welcome-12.webp)

### 13. Usuarios

Las cuentas del centro: altas, roles, contraseñas y quién ya terminó. Estás aquí.

![Paso 13: Usuarios](capturas/administracion/welcome-13.webp)

### 14. Sistema

El proveedor de IA que hace de tutor y las asignaturas.

![Paso 14: Sistema](capturas/administracion/welcome-14.webp)

### 15. Muestrario

Cada pieza de la aplicación en todos sus estados, para revisarlas. Es una página de trabajo, no un fallo.

![Paso 15: Muestrario](capturas/administracion/welcome-15.webp)

### 16. Por dónde seguir

Tus primeros pasos te enseñan lo principal de la aplicación con datos de verdad. Están siempre en «Ayuda».

![Paso 16: Por dónde seguir](capturas/administracion/welcome-16.webp)

## Primeros pasos

### <a id="add-user"></a>Dar de alta un usuario

_Una cuenta de alumno, docente o administración._

#### 1. Nuevo usuario

Vas a crear una cuenta de verdad. Una cuenta no se borra: si sobra, desactívala desde su menú «⋮».

**Qué haces:** Pulsa «Nuevo usuario»

![Paso 1: Nuevo usuario](capturas/administracion/add-user-01.webp)

#### 2. La cuenta

Su nombre, su correo y su rol. La contraseña la generas aquí y la entregas en persona: la aplicación no envía correos.

**Qué haces:** Rellénala y pulsa «Crear la cuenta»

![Paso 2: La cuenta](capturas/administracion/add-user-02.webp)

#### 3. Ya puede entrar

Está en la lista, activa. Desde su menú «⋮» la editas, le das otra contraseña o la desactivas. Un alumno entra en una clase cuando su docente lo matricula.

![Paso 3: Ya puede entrar](capturas/administracion/add-user-03.webp)

### <a id="create-class"></a>Crear una clase y matricular a su alumnado

_Una clase, sus asignaturas con su docente y su alumnado._

#### 1. Grupos

Tus clases, sus asignaturas y su alumnado están en Grupos.

**Qué haces:** Pulsa «Grupos»

![Paso 1: Grupos](capturas/administracion/create-class-01.webp)

#### 2. Añadir clase

Vas a crear una clase de verdad. Si era solo para probar, después quítale las asignaturas y elimínala desde su menú «⋮».

**Qué haces:** Pulsa «Añadir clase»

![Paso 2: Añadir clase](capturas/administracion/create-class-02.webp)

#### 3. La clase

Su nombre, como 1.º DAW A, y su curso. Si ya existe, te lo dice al escribirlo.

**Qué haces:** Escribe su nombre y pulsa «Crear y elegir asignaturas»

![Paso 3: La clase](capturas/administracion/create-class-03.webp)

#### 4. Sus asignaturas

Marca las de esta clase y elige el docente que las da. Cada una es un grupo, con su propio alumnado y sus bloques.

**Qué haces:** Marca las asignaturas, elige su docente y pulsa «Añadir»

![Paso 4: Sus asignaturas](capturas/administracion/create-class-04.webp)

#### 5. Matricular en la clase

El alumnado entra en la clase y en todas sus asignaturas, salvo los desdobles.

**Qué haces:** Pulsa «Matricular en la clase»

![Paso 5: Matricular en la clase](capturas/administracion/create-class-05.webp)

#### 6. Elige a tu alumnado

Elígelo entre quienes no tienen clase este curso, pega sus correos, tráelo de otra clase o búscalo. Solo están las cuentas que ya existen: si falta alguien, dale de alta en Usuarios.

**Qué haces:** Elige al alumnado y pulsa «Matricular»

![Paso 6: Elige a tu alumnado](capturas/administracion/create-class-06.webp)

#### 7. Tu alumnado

Una fila por alumno y una columna por asignatura. Desde el menú de cada uno, lo quitas de la clase.

![Paso 7: Tu alumnado](capturas/administracion/create-class-07.webp)

### <a id="test-provider"></a>Probar el proveedor de IA

_Que el tutor responde, con el modelo que tiene._

#### 1. El modelo

El que responde como tutor y traduce los ejercicios, y cuánto se le espera.

![Paso 1: El modelo](capturas/administracion/test-provider-01.webp)

#### 2. Probar la conexión

Pregunta al principal y a cada respaldo si responden. Gasta una llamada a cada uno.

**Qué haces:** Pulsa «Probar la conexión»

![Paso 2: Probar la conexión](capturas/administracion/test-provider-02.webp)

#### 3. El resultado

Cada modelo, con su respuesta o con su error explicado. Si cambias algo, pruébalo antes de guardar.

![Paso 3: El resultado](capturas/administracion/test-provider-03.webp)

### <a id="follow-live"></a>Seguir la clase en vivo

_Ver cómo va tu grupo y quién necesita ayuda._

#### 1. En vivo

Lo que hace tu grupo ahora mismo está en En vivo.

**Qué haces:** Pulsa «En vivo»

![Paso 1: En vivo](capturas/administracion/follow-live-01.webp)

#### 2. Grupo y bloque

Elige el grupo y, a su lado, el bloque que trabaja hoy.

![Paso 2: Grupo y bloque](capturas/administracion/follow-live-02.webp)

#### 3. ¿En directo?

En directo mientras alguien trabaja; fuera de clase, lo que dejaron hecho.

![Paso 3: ¿En directo?](capturas/administracion/follow-live-03.webp)

#### 4. Dónde está la clase

Cuántos van por cada ejercicio y cómo. Pulsa una barra para ver quiénes son.

![Paso 4: Dónde está la clase](capturas/administracion/follow-live-04.webp)

#### 5. El alumnado

Todos, los que han empezado o los que han terminado.

![Paso 5: El alumnado](capturas/administracion/follow-live-05.webp)

#### 6. El detalle de cada uno

Pulsa el nombre de un alumno para ver su código, sus pruebas y lo que le dijo el tutor.

![Paso 6: El detalle de cada uno](capturas/administracion/follow-live-06.webp)

## ¿Cómo se hace…?

### <a id="add-students"></a>Dar de alta a varios alumnos a la vez

_Con la lista de secretaría._

#### 1. Alta de varios

Pega la lista tal como sale de la hoja de cálculo y revísala antes de crear nada. Al terminar, te da sus contraseñas para entregarlas.

**Qué haces:** Pulsa «Alta de varios…»

![Paso 1: Alta de varios](capturas/administracion/add-students-01.webp)

### <a id="reset-password"></a>Dar otra contraseña a una cuenta

_A quien la ha olvidado._

#### 1. El menú de la cuenta

Cada cuenta tiene el suyo, al final de su fila.

**Qué haces:** Abre el menú «⋮» de una cuenta

![Paso 1: El menú de la cuenta](capturas/administracion/reset-password-01.webp)

#### 2. Restablecer la contraseña

La generas y se la das en persona: la aplicación no envía correos.

**Qué haces:** Pulsa «Restablecer la contraseña»

![Paso 2: Restablecer la contraseña](capturas/administracion/reset-password-02.webp)

### <a id="edit-user"></a>Cambiar el nombre, el correo o el rol

_De una cuenta que ya existe._

#### 1. El menú de la cuenta

Cada cuenta tiene el suyo, al final de su fila.

**Qué haces:** Abre el menú «⋮» de una cuenta

![Paso 1: El menú de la cuenta](capturas/administracion/edit-user-01.webp)

#### 2. Editar

Si la cuenta ya tiene trabajo o clases, su rol no cambia, y el diálogo te dice por qué.

**Qué haces:** Pulsa «Editar»

![Paso 2: Editar](capturas/administracion/edit-user-02.webp)

### <a id="disable-user"></a>Desactivar o activar una cuenta

_Una cuenta no se borra: se desactiva._

#### 1. El menú de la cuenta

Cada cuenta tiene el suyo, al final de su fila. La tuya no se puede desactivar.

**Qué haces:** Abre el menú «⋮» de una cuenta

![Paso 1: El menú de la cuenta](capturas/administracion/disable-user-01.webp)

#### 2. Desactivar

Deja de poder entrar, y su trabajo se conserva. Te pide confirmación, y desde el mismo menú se vuelve a activar: «Estado» muestra las desactivadas.

**Qué haces:** Pulsa «Desactivar» o «Activar»

![Paso 2: Desactivar](capturas/administracion/disable-user-02.webp)

### <a id="finished-students"></a>Desactivar a quien ya terminó

_Tras la evaluación final de sus docentes._

#### 1. Siguen con la cuenta activa

Los que han titulado o dejado los estudios según sus docentes. «Revisar y desactivar…» los desactiva de una vez, tras revisarlos.

![Paso 1: Siguen con la cuenta activa](capturas/administracion/finished-students-01.webp)

#### 2. Situación del alumnado

Para verlos cuando quieras: «Titulados o de baja». Aparecen cuando sus docentes ponen la evaluación final.

![Paso 2: Situación del alumnado](capturas/administracion/finished-students-02.webp)

### <a id="trajectory"></a>Ver la trayectoria de un alumno

_Sus clases de cada curso y cómo acabó._

#### 1. El menú de la cuenta

El de alguien con clases: los demás no tienen trayectoria.

**Qué haces:** Abre el menú «⋮» de una cuenta

![Paso 1: El menú de la cuenta](capturas/administracion/trajectory-01.webp)

#### 2. Ver su trayectoria

Cada curso, su clase y su evaluación final.

**Qué haces:** Pulsa «Ver su trayectoria»

![Paso 2: Ver su trayectoria](capturas/administracion/trajectory-02.webp)

### <a id="change-provider"></a>Cambiar el proveedor o el modelo de IA

_Probándolo antes de guardar._

#### 1. Proveedor

Su dirección y su formato vienen solos; «Otro», para uno compatible que no esté en la lista.

![Paso 1: Proveedor](capturas/administracion/change-provider-01.webp)

#### 2. Modelo principal

Su nombre exacto en el proveedor, y cuántos segundos se le espera.

![Paso 2: Modelo principal](capturas/administracion/change-provider-02.webp)

#### 3. La clave

No se escribe aquí: vive en los secretos del servidor, con este nombre.

![Paso 3: La clave](capturas/administracion/change-provider-03.webp)

#### 4. Probar antes de guardar

Gasta una llamada a cada modelo. Si el principal no responde, no se guarda: sigue el anterior.

![Paso 4: Probar antes de guardar](capturas/administracion/change-provider-04.webp)

#### 5. Guardar

Vale desde la siguiente petición al tutor, sin reiniciar nada.

![Paso 5: Guardar](capturas/administracion/change-provider-05.webp)

### <a id="fallback-model"></a>Añadir un modelo de respaldo

_Para cuando el principal no responde._

#### 1. Modelos de respaldo

Si el principal falla, se prueban en este orden. Mejor uno de otro proveedor: protege también de una caída o de la cuota agotada.

![Paso 1: Modelos de respaldo](capturas/administracion/fallback-model-01.webp)

#### 2. Añadir un respaldo

Elige su proveedor y su modelo. Las flechas cambian su orden.

![Paso 2: Añadir un respaldo](capturas/administracion/fallback-model-02.webp)

#### 3. Probar y guardar

Como al cambiar el principal: primero la prueba, que gasta una llamada a cada uno, y después «Guardar».

![Paso 3: Probar y guardar](capturas/administracion/fallback-model-03.webp)

### <a id="subjects"></a>Crear o traducir una asignatura

_Las que los docentes eligen para sus clases._

#### 1. Asignaturas

Cada grupo es una asignatura de una clase: los docentes eligen aquí las suyas.

![Paso 1: Asignaturas](capturas/administracion/subjects-01.webp)

#### 2. Nueva asignatura

Su nombre en el idioma en que lo escribes.

![Paso 2: Nueva asignatura](capturas/administracion/subjects-02.webp)

#### 3. Editar

Su nombre en los otros idiomas: sin traducción, se ve el original.

![Paso 3: Editar](capturas/administracion/subjects-03.webp)

## Recorridos de pantalla

### <a id="tour-users"></a>Conocer Usuarios

_Cada pieza de Usuarios, de la barra y del menú._

#### 1. Alta de varios

Muchos alumnos a la vez, pegando la lista de secretaría. La revisas antes de crear nada.

![Paso 1: Alta de varios](capturas/administracion/tour-users-01.webp)

#### 2. Nuevo usuario

Una cuenta de alumno, docente o administración, con su contraseña.

![Paso 2: Nuevo usuario](capturas/administracion/tour-users-02.webp)

#### 3. Quién ya terminó

Titulados o de baja según la evaluación final de sus docentes que siguen con la cuenta activa.

![Paso 3: Quién ya terminó](capturas/administracion/tour-users-03.webp)

#### 4. Buscar

Por nombre o correo, sin preocuparte de las tildes.

![Paso 4: Buscar](capturas/administracion/tour-users-04.webp)

#### 5. Rol

Alumnado, docentes o administración.

![Paso 5: Rol](capturas/administracion/tour-users-05.webp)

#### 6. Estado

Las activas, las desactivadas o todas. Una cuenta no se borra: se desactiva.

![Paso 6: Estado](capturas/administracion/tour-users-06.webp)

#### 7. Situación del alumnado

En una clase este curso, sin clase o titulados y de baja.

![Paso 7: Situación del alumnado](capturas/administracion/tour-users-07.webp)

#### 8. Cuántas

Las cuentas que se ven con estos filtros, de todas las del centro.

![Paso 8: Cuántas](capturas/administracion/tour-users-08.webp)

#### 9. Las cuentas

Su nombre, su correo, su rol y sus grupos. Pulsa una cabecera para ordenar.

![Paso 9: Las cuentas](capturas/administracion/tour-users-09.webp)

#### 10. El menú de cada cuenta

Editarla, darle otra contraseña, ver su trayectoria si tiene clases, y desactivarla o activarla.

![Paso 10: El menú de cada cuenta](capturas/administracion/tour-users-10.webp)

#### 11. El menú

Pliega el menú a sus iconos para dejar más sitio, o lo despliega. En el móvil, lo abre.

![Paso 11: El menú](capturas/administracion/tour-users-11.webp)

#### 12. TutorIA

Desde cualquier pantalla, te lleva a Usuarios.

![Paso 12: TutorIA](capturas/administracion/tour-users-12.webp)

#### 13. Ayuda

Tus primeros pasos, el recorrido de cada pantalla, la ayuda de cada pieza y la bienvenida.

![Paso 13: Ayuda](capturas/administracion/tour-users-13.webp)

#### 14. Tema

Claro, oscuro o el de tu sistema.

![Paso 14: Tema](capturas/administracion/tour-users-14.webp)

#### 15. Idioma

Español, català o English. Los ejercicios se ven en el idioma que tengan traducido.

![Paso 15: Idioma](capturas/administracion/tour-users-15.webp)

#### 16. Tu menú

Con qué cuenta has entrado y «Cerrar sesión».

![Paso 16: Tu menú](capturas/administracion/tour-users-16.webp)

#### 17. En vivo

Cómo va tu grupo ahora mismo, ejercicio a ejercicio, y quién necesita ayuda.

![Paso 17: En vivo](capturas/administracion/tour-users-17.webp)

#### 18. Histórico

Cómo evoluciona cada grupo, bloque a bloque, también de cursos anteriores.

![Paso 18: Histórico](capturas/administracion/tour-users-18.webp)

#### 19. Ejercicios

El banco común del profesorado: busca, duplica o escribe ejercicios con sus pruebas.

![Paso 19: Ejercicios](capturas/administracion/tour-users-19.webp)

#### 20. Bloques

Los temas de cada grupo y los ejercicios que les asignas, en el orden en que los verán.

![Paso 20: Bloques](capturas/administracion/tour-users-20.webp)

#### 21. Grupos

Tus clases, sus asignaturas y su alumnado: aquí se crean y se matricula.

![Paso 21: Grupos](capturas/administracion/tour-users-21.webp)

#### 22. Usuarios

Las cuentas del centro: altas, roles, contraseñas y quién ya terminó.

![Paso 22: Usuarios](capturas/administracion/tour-users-22.webp)

#### 23. Sistema

El proveedor de IA que hace de tutor y las asignaturas.

![Paso 23: Sistema](capturas/administracion/tour-users-23.webp)

#### 24. Muestrario

Cada pieza de la aplicación en todos sus estados, para revisarlas. Es una página de trabajo, no un fallo.

![Paso 24: Muestrario](capturas/administracion/tour-users-24.webp)

### <a id="tour-system"></a>Conocer Sistema

_El proveedor de IA y las asignaturas, pieza a pieza._

#### 1. Proveedor

De dónde viene el modelo de IA: su dirección y su formato vienen solos.

![Paso 1: Proveedor](capturas/administracion/tour-system-01.webp)

#### 2. Modelo principal

El que responde como tutor y traduce los ejercicios, y cuánto se le espera.

![Paso 2: Modelo principal](capturas/administracion/tour-system-02.webp)

#### 3. La clave

Solo el nombre del secreto: la clave vive en el servidor y nunca llega al navegador.

![Paso 3: La clave](capturas/administracion/tour-system-03.webp)

#### 4. Respaldos

Si el principal falla, se prueban en este orden.

![Paso 4: Respaldos](capturas/administracion/tour-system-04.webp)

#### 5. Añadir un respaldo

Mejor de otro proveedor: protege también de una caída o de la cuota agotada.

![Paso 5: Añadir un respaldo](capturas/administracion/tour-system-05.webp)

#### 6. Probar la conexión

Pregunta a cada modelo si responde. Gasta una llamada a cada uno.

![Paso 6: Probar la conexión](capturas/administracion/tour-system-06.webp)

#### 7. Guardar

Después de probar, y solo si el principal responde. Vale desde la siguiente petición.

![Paso 7: Guardar](capturas/administracion/tour-system-07.webp)

#### 8. Asignaturas

Las que los docentes eligen para sus clases, con su nombre en cada idioma.

![Paso 8: Asignaturas](capturas/administracion/tour-system-08.webp)

#### 9. Nueva asignatura

Con su nombre en el idioma en que lo escribes.

![Paso 9: Nueva asignatura](capturas/administracion/tour-system-09.webp)

#### 10. Editar

Su nombre y sus traducciones: sin ellas, se ve el original.

![Paso 10: Editar](capturas/administracion/tour-system-10.webp)

## <a id="tareas-compartidas"></a>Las tareas del docente

Entras también en todas las pantallas del docente, con estas tareas. Se cuentan en el [Manual del profesorado](docente.md), con las mismas pantallas:

- [Crear un bloque](docente.md#create-block)
- [Añadir un ejercicio al banco](docente.md#add-exercise)
- [Asignar un ejercicio a un bloque](docente.md#assign-exercise)
- [Cambiar el nombre o el curso de una clase](docente.md#edit-class)
- [Preparar la clase del curso siguiente](docente.md#duplicate-class)
- [Añadir una asignatura a la clase](docente.md#add-subject)
- [Matricular solo en una asignatura](docente.md#enroll-in-subject)
- [Quitar a un alumno de la clase](docente.md#remove-student)
- [Poner la evaluación final](docente.md#final-evaluation)
- [Exportar el alumnado](docente.md#export-students)
- [Quitar una asignatura o eliminar la clase](docente.md#remove-subject)
- [Copiar los bloques de otro grupo](docente.md#copy-blocks)
- [Poner fechas de entrega](docente.md#due-dates)
- [Ocultar un bloque o un ejercicio](docente.md#hide-content)
- [Cambiar el orden](docente.md#reorder)
- [Mover un ejercicio a otro bloque](docente.md#move-exercise)
- [Borrar varios bloques a la vez](docente.md#select-several)
- [Buscar en el banco](docente.md#find-exercise)
- [Adaptar un ejercicio de otro docente](docente.md#duplicate-exercise)
- [Asignar un ejercicio desde el banco](docente.md#assign-from-bank)
- [Traducir un ejercicio](docente.md#translate-exercise)
- [Probar un ejercicio como alumno](docente.md#try-as-student)
- [Ajustar cuándo se ofrece el tutor](docente.md#proactive-thresholds)
- [Atender a quien necesita ayuda](docente.md#attend)
- [Seguir otro grupo u otro bloque](docente.md#other-group)
- [Buscar a un alumno en la clase](docente.md#find-student)
- [Ver qué hizo un alumno, paso a paso](docente.md#attempt-timeline)
- [Ver cómo evoluciona un grupo](docente.md#group-evolution)
- [Conocer la sesión en vivo](docente.md#tour-live)
- [Conocer el detalle de un intento](docente.md#tour-attempt)
- [Conocer el banco de ejercicios](docente.md#tour-exercise-bank)
- [Conocer el formulario de un ejercicio](docente.md#tour-exercise-form)
- [Conocer los bloques](docente.md#tour-blocks)
- [Conocer los grupos](docente.md#tour-groups)
- [Conocer el histórico](docente.md#tour-history)
