# 12 · Sistema

`/admin/sistema` · Administrador · Capa 2 · 1,5 h (5.3b)

## Objetivo

Que la administración elija el proveedor de IA que responde como tutor y traduce, lo pruebe antes de guardarlo y gestione las asignaturas de los grupos (RF-19, CU-07, 2.5c). Figura 13 del TFM.

## Datos

- `AdminService` (5.3a): `getAiProvider()`, `checkAiProvider()` (un resultado por modelo, en orden), `setAiProvider()`, `listSubjects()` y `saveSubject()`.
- Sin store: el estado es de la pantalla (`resource()` por sección), cambiado en el sitio tras guardar.
- Funciones puras: `toProviderFormModel()`, `toProviderSetting()`, `providerSchema()` y `applyPreset()` (`provider-form.ts`); `checkMessage()` (`check-message.ts`); `toSubjectFormModel()`, `toSubjectDraft()` y `subjectSchema()` (`subject-form.ts`). La forma la valida `isValidAiProvider()` con `MAX_AI_FALLBACKS` y `AI_PROVIDER_PRESETS`.

## Contenido y disposición

Una columna, con un ancho máximo de lectura, en los tres tamaños; las dos secciones, una tras otra, cada una en su tarjeta con su `h2`:

- **Proveedor de IA:** su explicación; «Proveedor» (Gemini, Groq, OpenRouter, Ollama local u «Otro»), «URL base», «Modelo», «Nombre del secreto con la clave» (con su pista: la clave no se escribe aquí) y «Tiempo máximo de respuesta». En escritorio y tablet, modelo y tiempo en una fila; en móvil, uno bajo otro.
  - **Respaldos, en orden (D-077):** una fila por respaldo con su proveedor («El del principal» por defecto, uno predefinido u «Otro»), su modelo, sus segundos, «Subir», «Bajar» y «Quitar». Con un predefinido, su URL y su secreto en una línea; con «Otro», sus campos. En el móvil, el modelo y los segundos en una fila. «Añadir un respaldo» se deshabilita con cinco.
  - **Pie:** «Probar la conexión», «Guardar» (deshabilitado con «Prueba la conexión antes de guardar» mientras no haya una prueba superada del borrador) y «Descartar los cambios».
  - **Resultado de la prueba:** una lista bajo el pie, una línea por modelo con su icono y «Responde en N ms» o su problema.
- **Asignaturas:** la lista por nombre en el idioma de la interfaz, cada una con los idiomas en que está y «Editar»; «Nueva asignatura» en la cabecera. Con muchas, la lista se desplaza dentro de su zona.
- Diálogo de la asignatura: idioma en que se escribe, nombre y traducciones opcionales, como el de los bloques.

## Interacciones

- **Elegir un proveedor:** rellena la URL, el secreto y el formato; «Otro» deja escribirlos. Cambiar la URL a mano pasa a «Otro».
- **Probar la conexión:** «Probando…» en el botón; el resultado aparece debajo. Si el principal responde, «Guardar» se habilita; si no, «El modelo principal no responde: se mantiene el proveedor anterior.». Un respaldo que falla avisa, pero deja guardar.
- **Cualquier cambio** invalida la prueba: el resultado se borra y «Guardar» vuelve a deshabilitarse.
- **Guardar:** aviso «Proveedor de IA guardado» (`MatSnackBar`); el borrador pasa a ser el guardado.
- **Descartar los cambios:** vuelve al guardado y borra la prueba.
- **Nueva asignatura / Editar:** el diálogo; al guardar, la asignatura aparece o cambia en su orden. Un fallo se dice en el diálogo sin cerrarlo.

## Estados

- **Cargando:** esqueleto en cada sección, por separado.
- **Vacío:** sin proveedor guardado, el formulario con Gemini y su modelo vacío. Sin asignaturas, `EmptyState` «Aún no hay asignaturas» con «Nueva asignatura».
- **Error:** `LoadError` con «Reintentar» en cada sección, por separado. Un fallo al probar o guardar, junto al pie (`role="alert"`).
- **Con datos:** el ajuste del seed (Gemini con dos respaldos) y las tres asignaturas.

## Accesibilidad

- El resultado de la prueba, en una región `role="status"`; el icono de cada línea tiene su texto.
- «Guardar» deshabilitado sigue enfocable (`disabledInteractive`) con su motivo enlazado.
- «Quitar» de cada respaldo y «Editar» de cada asignatura llevan su nombre («Quitar gemma-4-31b-it», «Editar Programación básica»). Al añadir un respaldo, el foco va a su modelo; al quitarlo, al siguiente o a «Añadir un respaldo».
- El nombre de una asignatura en otro idioma lleva su `lang`.

## Criterios de aceptación

- [ ] Elegir un proveedor predefinido u «Otro», con su modelo, su tiempo y sus respaldos.
- [ ] Probar la conexión modelo a modelo; guardar solo con el principal superado (CU-07).
- [ ] Respaldos del mismo proveedor o de otro, en el orden elegido (D-077).
- [ ] Crear y editar asignaturas con sus traducciones (2.5c).
- [ ] Revisión visual del autor.

## Fuera de alcance

- Escribir la clave: vive en los secretos de las Edge Functions.
- Eliminar asignaturas: los grupos y ejercicios las referencian.

## Pulido pendiente

—
