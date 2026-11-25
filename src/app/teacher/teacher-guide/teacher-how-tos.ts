import { GUIDE_ANCHORS } from '../../core/guide/guide-anchor';
import type { GuideTask } from '../../core/guide/guide-task';
import { NO_ASSIGNMENT, NO_ATTEMPT, NO_BLOCK, NO_CLASS, NO_STUDENTS } from './teacher-tasks';

const A = GUIDE_ANCHORS;

/**
 * «¿Cómo se hace…?» of the teacher (2.12, ficha 13, 7.0b2): short tasks on the real screens that
 * never create anything. Those of a menu open it and end by pressing its entry, which opens its
 * dialog or asks for confirmation: the user goes on from there, or cancels. The administration
 * has them too.
 */
export function teacherHowTos(): readonly GuideTask[] {
  return [...GROUPS, ...BLOCKS, ...BANK, ...FORM, ...LIVE];
}

const GROUPS: readonly GuideTask[] = [
  {
    id: 'edit-class',
    screen: 'groups',
    place: 'groups',
    needs: 'hasClass',
    unavailable: NO_CLASS,
    title: $localize`:@@guide.teacher.editClass.title:Cambiar el nombre o el curso de una clase`,
    summary: $localize`:@@guide.teacher.editClass.summary:Desde el menú de la clase.`,
    keywords: [$localize`:@@guide.teacher.editClass.keywords:editar renombrar clase curso nombre`],
    steps: [
      {
        anchor: A.groupsClassMenu,
        title: $localize`:@@guide.teacher.editClass.menu.title:El menú de la clase`,
        text: $localize`:@@guide.teacher.editClass.menu.text:Lo que puedes hacer con la clase elegida.`,
        action: $localize`:@@guide.teacher.editClass.menu.action:Abre el menú «⋮» de la clase`,
      },
      {
        anchor: A.groupsClassEdit,
        inOverlay: true,
        title: $localize`:@@guide.teacher.editClass.edit.title:Editar`,
        text: $localize`:@@guide.teacher.editClass.edit.text:Su nombre y su curso, para todos sus docentes y su alumnado. Solo lo cambia quien la creó.`,
        action: $localize`:@@guide.teacher.editClass.edit.action:Pulsa «Editar»`,
      },
    ],
  },
  {
    id: 'duplicate-class',
    screen: 'groups',
    place: 'groups',
    needs: 'hasClass',
    unavailable: NO_CLASS,
    title: $localize`:@@guide.teacher.duplicateClass.title:Preparar la clase del curso siguiente`,
    summary: $localize`:@@guide.teacher.duplicateClass.summary:Duplicarla con tus asignaturas, sus bloques y, si quieres, su alumnado.`,
    keywords: [
      $localize`:@@guide.teacher.duplicateClass.keywords:duplicar copiar clase curso siguiente nuevo año`,
    ],
    steps: [
      {
        anchor: A.groupsClassMenu,
        title: $localize`:@@guide.teacher.duplicateClass.menu.title:El menú de la clase`,
        text: $localize`:@@guide.teacher.duplicateClass.menu.text:Elige antes, arriba, la clase que quieres repetir.`,
        action: $localize`:@@guide.teacher.duplicateClass.menu.action:Abre el menú «⋮» de la clase`,
      },
      {
        anchor: A.groupsClassDuplicate,
        inOverlay: true,
        title: $localize`:@@guide.teacher.duplicateClass.duplicate.title:Duplicar`,
        text: $localize`:@@guide.teacher.duplicateClass.duplicate.text:Crea la misma clase en otro curso, con las asignaturas tuyas que elijas y, si quieres, sus bloques, sus fechas y su alumnado. Lo eliges antes de crear nada.`,
        action: $localize`:@@guide.teacher.duplicateClass.duplicate.action:Pulsa «Duplicar…»`,
      },
    ],
  },
  {
    id: 'add-subject',
    screen: 'groups',
    place: 'groups',
    needs: 'hasClass',
    unavailable: NO_CLASS,
    title: $localize`:@@guide.teacher.addSubject.title:Añadir una asignatura a la clase`,
    summary: $localize`:@@guide.teacher.addSubject.summary:Otra asignatura que das en una clase que ya tienes.`,
    keywords: [
      $localize`:@@guide.teacher.addSubject.keywords:asignatura nueva añadir grupo desdoble`,
    ],
    steps: [
      {
        anchor: A.groupsAddSubject,
        title: $localize`:@@guide.teacher.addSubject.add.title:Añadir asignatura`,
        text: $localize`:@@guide.teacher.addSubject.add.text:Las que das en esta clase y aún no tiene. Si otro docente ya la da a toda la clase, la tuya será un desdoble.`,
        action: $localize`:@@guide.teacher.addSubject.add.action:Pulsa «Añadir asignatura»`,
      },
    ],
  },
  {
    id: 'enroll-in-subject',
    screen: 'groups',
    place: 'groups',
    needs: 'hasClass',
    unavailable: NO_CLASS,
    title: $localize`:@@guide.teacher.enrollSubject.title:Matricular solo en una asignatura`,
    summary: $localize`:@@guide.teacher.enrollSubject.summary:Para quien no cursa toda la clase, o en un desdoble.`,
    keywords: [
      $localize`:@@guide.teacher.enrollSubject.keywords:matricular desdoble asignatura suelta pendiente repetidor`,
    ],
    steps: [
      {
        anchor: A.groupsSubjectMenu,
        title: $localize`:@@guide.teacher.enrollSubject.menu.title:El menú de la asignatura`,
        text: $localize`:@@guide.teacher.enrollSubject.menu.text:Cada asignatura tuya tiene el suyo, en su columna.`,
        action: $localize`:@@guide.teacher.enrollSubject.menu.action:Abre el menú «⋮» de una asignatura`,
      },
      {
        anchor: A.groupsSubjectEnroll,
        inOverlay: true,
        title: $localize`:@@guide.teacher.enrollSubject.enroll.title:Matricular solo aquí`,
        text: $localize`:@@guide.teacher.enrollSubject.enroll.text:Entra en esta asignatura y no en las demás de la clase. Lo eliges igual que al matricular en la clase.`,
        action: $localize`:@@guide.teacher.enrollSubject.enroll.action:Pulsa «Matricular solo aquí…»`,
      },
    ],
  },
  {
    id: 'remove-student',
    screen: 'groups',
    place: 'groups',
    needs: 'hasStudents',
    unavailable: NO_STUDENTS,
    title: $localize`:@@guide.teacher.removeStudent.title:Quitar a un alumno de la clase`,
    summary: $localize`:@@guide.teacher.removeStudent.summary:Sale de la clase; su trabajo se conserva.`,
    keywords: [$localize`:@@guide.teacher.removeStudent.keywords:quitar sacar baja alumno clase`],
    steps: [
      {
        anchor: A.groupsStudentMenu,
        title: $localize`:@@guide.teacher.removeStudent.menu.title:El menú del alumno`,
        text: $localize`:@@guide.teacher.removeStudent.menu.text:Cada alumno tiene el suyo, al final de su fila.`,
        action: $localize`:@@guide.teacher.removeStudent.menu.action:Abre el menú «⋮» de un alumno`,
      },
      {
        anchor: A.groupsStudentRemove,
        inOverlay: true,
        title: $localize`:@@guide.teacher.removeStudent.remove.title:Quitar de la clase`,
        text: $localize`:@@guide.teacher.removeStudent.remove.text:Sale de la clase y de todas sus asignaturas. Te pide confirmación, y lo que ya hizo se conserva.`,
        action: $localize`:@@guide.teacher.removeStudent.remove.action:Pulsa «Quitar de la clase»`,
      },
    ],
  },
  {
    id: 'final-evaluation',
    screen: 'groups',
    place: 'groups',
    needs: 'hasStudents',
    unavailable: NO_STUDENTS,
    title: $localize`:@@guide.teacher.outcomes.title:Poner la evaluación final`,
    summary: $localize`:@@guide.teacher.outcomes.summary:Quién promociona, repite, titula o deja los estudios.`,
    keywords: [
      $localize`:@@guide.teacher.outcomes.keywords:evaluación final promociona titula baja fin de curso`,
    ],
    steps: [
      {
        anchor: A.groupsOutcomes,
        title: $localize`:@@guide.teacher.outcomes.show.title:Evaluación final`,
        text: $localize`:@@guide.teacher.outcomes.show.text:Al acabar el curso. Con ella, la administración sabe qué cuentas desactivar y tu clase del curso siguiente, a quién traer.`,
        action: $localize`:@@guide.teacher.outcomes.show.action:Pulsa «Evaluación final»`,
      },
      {
        anchor: A.groupsOutcome,
        optional: true,
        title: $localize`:@@guide.teacher.outcomes.one.title:La de cada alumno`,
        text: $localize`:@@guide.teacher.outcomes.one.text:En su fila: pulsa y elige.`,
      },
      {
        anchor: A.groupsOutcomesBar,
        optional: true,
        title: $localize`:@@guide.teacher.outcomes.bar.title:Cuántos llevas`,
        text: $localize`:@@guide.teacher.outcomes.bar.text:Para no ir uno a uno, pon a mano las excepciones y después que promocionen o titulen todos los que quedan sin evaluar.`,
      },
    ],
  },
  {
    id: 'export-students',
    screen: 'groups',
    place: 'groups',
    needs: 'hasStudents',
    unavailable: NO_STUDENTS,
    title: $localize`:@@guide.teacher.export.title:Exportar el alumnado`,
    summary: $localize`:@@guide.teacher.export.summary:La lista en una hoja de cálculo, o sus correos.`,
    keywords: [
      $localize`:@@guide.teacher.export.keywords:exportar descargar lista csv excel correos copiar`,
    ],
    steps: [
      {
        anchor: A.groupsExport,
        title: $localize`:@@guide.teacher.export.button.title:Exportar`,
        text: $localize`:@@guide.teacher.export.button.text:El alumnado de la clase, como se ve con el filtro puesto.`,
        action: $localize`:@@guide.teacher.export.button.action:Pulsa el botón de exportar`,
      },
      {
        anchor: A.groupsExportItems,
        inOverlay: true,
        title: $localize`:@@guide.teacher.export.items.title:Elige cómo`,
        text: $localize`:@@guide.teacher.export.items.text:La lista en CSV, que se abre con una hoja de cálculo, o los correos copiados, para pegarlos en un mensaje.`,
        action: $localize`:@@guide.teacher.export.items.action:Elige una de las dos`,
      },
    ],
  },
  {
    id: 'remove-subject',
    screen: 'groups',
    place: 'groups',
    needs: 'hasClass',
    unavailable: NO_CLASS,
    title: $localize`:@@guide.teacher.removeSubject.title:Quitar una asignatura o eliminar la clase`,
    summary: $localize`:@@guide.teacher.removeSubject.summary:Mientras nadie haya trabajado en ella.`,
    keywords: [
      $localize`:@@guide.teacher.removeSubject.keywords:eliminar borrar quitar asignatura clase grupo`,
    ],
    steps: [
      {
        anchor: A.groupsSubjectMenu,
        title: $localize`:@@guide.teacher.removeSubject.menu.title:El menú de la asignatura`,
        text: $localize`:@@guide.teacher.removeSubject.menu.text:Cada asignatura tuya tiene el suyo, en su columna.`,
        action: $localize`:@@guide.teacher.removeSubject.menu.action:Abre el menú «⋮» de una asignatura`,
      },
      {
        anchor: A.groupsSubjectRemove,
        inOverlay: true,
        title: $localize`:@@guide.teacher.removeSubject.remove.title:Eliminar`,
        text: $localize`:@@guide.teacher.removeSubject.remove.text:Te pide confirmación. Sin asignaturas, la clase se elimina desde su propio menú «⋮», arriba.`,
        action: $localize`:@@guide.teacher.removeSubject.remove.action:Pulsa «Eliminar»`,
        whenDisabled: {
          title: $localize`:@@guide.teacher.removeSubject.started.title:Ya tiene trabajo`,
          text: $localize`:@@guide.teacher.removeSubject.started.text:Alguien de su alumnado ya ha trabajado en ella, así que no se elimina: su trabajo se conserva. Oculta sus bloques si ya no la usas.`,
        },
      },
    ],
  },
];

const BLOCKS: readonly GuideTask[] = [
  {
    id: 'copy-blocks',
    screen: 'blocks',
    place: 'blocks',
    needs: 'hasClass',
    unavailable: NO_CLASS,
    title: $localize`:@@guide.teacher.copyBlocks.title:Copiar los bloques de otro grupo`,
    summary: $localize`:@@guide.teacher.copyBlocks.summary:Los de otro grupo tuyo o de un curso anterior, con sus ejercicios.`,
    keywords: [
      $localize`:@@guide.teacher.copyBlocks.keywords:copiar bloques reutilizar curso anterior otro grupo`,
    ],
    steps: [
      {
        anchor: A.blocksGroup,
        title: $localize`:@@guide.teacher.copyBlocks.group.title:El grupo de destino`,
        text: $localize`:@@guide.teacher.copyBlocks.group.text:Elige aquí el grupo que recibe los bloques.`,
      },
      {
        anchor: A.blocksCopy,
        title: $localize`:@@guide.teacher.copyBlocks.copy.title:Copiar de otro grupo`,
        text: $localize`:@@guide.teacher.copyBlocks.copy.text:Eliges el grupo de origen y qué bloques traer antes de copiar nada, también de un curso anterior.`,
        action: $localize`:@@guide.teacher.copyBlocks.copy.action:Pulsa «Copiar de otro grupo»`,
      },
    ],
  },
  {
    id: 'due-dates',
    screen: 'blocks',
    place: 'blocks',
    needs: 'hasAssignment',
    unavailable: NO_ASSIGNMENT,
    title: $localize`:@@guide.teacher.dueDates.title:Poner fechas de entrega`,
    summary: $localize`:@@guide.teacher.dueDates.summary:A un ejercicio o a todo un bloque.`,
    keywords: [$localize`:@@guide.teacher.dueDates.keywords:fecha entrega plazo límite calendario`],
    steps: [
      {
        anchor: A.blocksDue,
        title: $localize`:@@guide.teacher.dueDates.one.title:La de un ejercicio`,
        text: $localize`:@@guide.teacher.dueDates.one.text:Púlsala para ponerla, cambiarla o quitarla.`,
      },
      {
        anchor: A.blocksMenu,
        title: $localize`:@@guide.teacher.dueDates.menu.title:El menú del bloque`,
        text: $localize`:@@guide.teacher.dueDates.menu.text:Para todos sus ejercicios a la vez.`,
        action: $localize`:@@guide.teacher.dueDates.menu.action:Abre el menú «⋮» del bloque`,
      },
      {
        anchor: A.blocksDueAll,
        inOverlay: true,
        title: $localize`:@@guide.teacher.dueDates.all.title:Para todo el bloque`,
        text: $localize`:@@guide.teacher.dueDates.all.text:La misma fecha para todos sus ejercicios. Después puedes cambiar la de alguno.`,
        action: $localize`:@@guide.teacher.dueDates.all.action:Pulsa «Fecha de entrega para todo el bloque»`,
      },
    ],
  },
  {
    id: 'hide-content',
    screen: 'blocks',
    place: 'blocks',
    needs: 'hasAssignment',
    unavailable: NO_ASSIGNMENT,
    title: $localize`:@@guide.teacher.hide.title:Ocultar un bloque o un ejercicio`,
    summary: $localize`:@@guide.teacher.hide.summary:Prepararlo antes de que tu alumnado lo vea.`,
    keywords: [$localize`:@@guide.teacher.hide.keywords:ocultar mostrar visible esconder publicar`],
    steps: [
      {
        anchor: A.blocksVisible,
        interactive: true,
        title: $localize`:@@guide.teacher.hide.block.title:Visible`,
        text: $localize`:@@guide.teacher.hide.block.text:Apagado, tu alumnado no ve el bloque hasta que lo enciendas. Prepáralo oculto y enciéndelo en clase.`,
      },
      {
        anchor: A.blocksHide,
        title: $localize`:@@guide.teacher.hide.exercise.title:Un solo ejercicio`,
        text: $localize`:@@guide.teacher.hide.exercise.text:El ojo lo oculta sin sacarlo del bloque. Si alguien ya lo empezó, ocúltalo en lugar de quitarlo: su trabajo se conserva.`,
      },
    ],
  },
  {
    id: 'reorder',
    screen: 'blocks',
    place: 'blocks',
    needs: 'hasAssignment',
    unavailable: NO_ASSIGNMENT,
    title: $localize`:@@guide.teacher.reorder.title:Cambiar el orden`,
    summary: $localize`:@@guide.teacher.reorder.summary:De los bloques y de sus ejercicios.`,
    keywords: [
      $localize`:@@guide.teacher.reorder.keywords:ordenar orden arrastrar subir bajar mover`,
    ],
    steps: [
      {
        anchor: A.blocksDrag,
        title: $localize`:@@guide.teacher.reorder.drag.title:Arrastrar`,
        text: $localize`:@@guide.teacher.reorder.drag.text:Por aquí se arrastran los bloques, y los ejercicios por el suyo, al orden en que los verá tu alumnado.`,
      },
      {
        anchor: A.blocksExerciseMenu,
        title: $localize`:@@guide.teacher.reorder.menu.title:Sin arrastrar`,
        text: $localize`:@@guide.teacher.reorder.menu.text:Con el teclado o en el móvil, «Subir» y «Bajar» de su menú «⋮» hacen lo mismo.`,
      },
    ],
  },
  {
    id: 'move-exercise',
    screen: 'blocks',
    place: 'blocks',
    needs: 'hasAssignment',
    unavailable: NO_ASSIGNMENT,
    title: $localize`:@@guide.teacher.moveExercise.title:Mover un ejercicio a otro bloque`,
    summary: $localize`:@@guide.teacher.moveExercise.summary:Con su fecha y el trabajo de tu alumnado.`,
    keywords: [
      $localize`:@@guide.teacher.moveExercise.keywords:mover pasar ejercicio otro bloque tema`,
    ],
    steps: [
      {
        anchor: A.blocksExerciseMenu,
        title: $localize`:@@guide.teacher.moveExercise.menu.title:El menú del ejercicio`,
        text: $localize`:@@guide.teacher.moveExercise.menu.text:Cada ejercicio de un bloque tiene el suyo.`,
        action: $localize`:@@guide.teacher.moveExercise.menu.action:Abre el menú «⋮» de un ejercicio`,
      },
      {
        anchor: A.blocksMoveTo,
        inOverlay: true,
        title: $localize`:@@guide.teacher.moveExercise.move.title:Mover a otro bloque`,
        text: $localize`:@@guide.teacher.moveExercise.move.text:Después eliges el bloque: el ejercicio pasa al final.`,
        action: $localize`:@@guide.teacher.moveExercise.move.action:Pulsa «Mover a otro bloque»`,
        whenDisabled: {
          title: $localize`:@@guide.teacher.moveExercise.single.title:Solo hay un bloque`,
          text: $localize`:@@guide.teacher.moveExercise.single.text:Crea otro bloque en este grupo para mover ejercicios entre ellos.`,
        },
      },
    ],
  },
  {
    id: 'select-several',
    screen: 'blocks',
    place: 'blocks',
    needs: 'hasAssignment',
    unavailable: NO_ASSIGNMENT,
    title: $localize`:@@guide.teacher.select.title:Borrar varios bloques a la vez`,
    summary: $localize`:@@guide.teacher.select.summary:Los que nadie ha empezado.`,
    keywords: [
      $localize`:@@guide.teacher.select.keywords:seleccionar varios quitar borrar limpiar marcar`,
    ],
    steps: [
      {
        anchor: A.blocksSelect,
        title: $localize`:@@guide.teacher.select.button.title:Seleccionar`,
        text: $localize`:@@guide.teacher.select.button.text:Marca los bloques y bórralos de una vez, o marca de golpe los que nadie ha empezado. Los empezados no se borran: ocúltalos.`,
      },
    ],
  },
];

const BANK: readonly GuideTask[] = [
  {
    id: 'find-exercise',
    screen: 'exercise-bank',
    place: 'exercises',
    title: $localize`:@@guide.teacher.find.title:Buscar en el banco`,
    summary: $localize`:@@guide.teacher.find.summary:Antes de escribir uno, quizá ya existe.`,
    keywords: [
      $localize`:@@guide.teacher.find.keywords:buscar filtrar banco ejercicio archivados míos`,
    ],
    steps: [
      {
        anchor: A.bankSearch,
        title: $localize`:@@guide.teacher.find.search.title:Buscar`,
        text: $localize`:@@guide.teacher.find.search.text:Por título, contenido o nombre de la función.`,
      },
      {
        anchor: A.bankSubject,
        title: $localize`:@@guide.teacher.find.subject.title:Asignatura`,
        text: $localize`:@@guide.teacher.find.subject.text:Las tuyas o una en concreto.`,
      },
      {
        anchor: A.bankDifficulty,
        title: $localize`:@@guide.teacher.find.difficulty.title:Dificultad`,
        text: $localize`:@@guide.teacher.find.difficulty.text:Inicial, media, avanzada o de ampliación.`,
      },
      {
        anchor: A.bankMine,
        title: $localize`:@@guide.teacher.find.mine.title:Solo los míos`,
        text: $localize`:@@guide.teacher.find.mine.text:Los que escribiste tú, los únicos que puedes editar.`,
      },
      {
        anchor: A.bankArchived,
        title: $localize`:@@guide.teacher.find.archived.title:Archivados`,
        text: $localize`:@@guide.teacher.find.archived.text:Los que ya no salen en el banco. Sus intentos se conservan, y desde su menú vuelven.`,
      },
    ],
  },
  {
    id: 'duplicate-exercise',
    screen: 'exercise-bank',
    place: 'exercises',
    title: $localize`:@@guide.teacher.duplicateExercise.title:Adaptar un ejercicio de otro docente`,
    summary: $localize`:@@guide.teacher.duplicateExercise.summary:Duplicarlo y cambiar la copia.`,
    keywords: [
      $localize`:@@guide.teacher.duplicateExercise.keywords:duplicar copiar adaptar modificar ejercicio`,
    ],
    steps: [
      {
        anchor: A.bankActions,
        title: $localize`:@@guide.teacher.duplicateExercise.menu.title:El menú del ejercicio`,
        text: $localize`:@@guide.teacher.duplicateExercise.menu.text:Cada ejercicio tiene el suyo. Solo editas los tuyos; los demás, los duplicas.`,
        action: $localize`:@@guide.teacher.duplicateExercise.menu.action:Abre el menú «⋮» de un ejercicio`,
      },
      {
        anchor: A.bankDuplicate,
        inOverlay: true,
        navigates: true,
        title: $localize`:@@guide.teacher.duplicateExercise.duplicate.title:Duplicar`,
        text: $localize`:@@guide.teacher.duplicateExercise.duplicate.text:Abre una copia en el formulario, ya tuya. No se crea nada hasta que la guardes.`,
        action: $localize`:@@guide.teacher.duplicateExercise.duplicate.action:Pulsa «Duplicar»`,
      },
    ],
  },
  {
    id: 'assign-from-bank',
    screen: 'exercise-bank',
    place: 'exercises',
    needs: 'hasBlock',
    unavailable: NO_BLOCK,
    title: $localize`:@@guide.teacher.assignFromBank.title:Asignar un ejercicio desde el banco`,
    summary: $localize`:@@guide.teacher.assignFromBank.summary:Sin salir del banco.`,
    keywords: [
      $localize`:@@guide.teacher.assignFromBank.keywords:asignar banco bloque grupo ejercicio`,
    ],
    steps: [
      {
        anchor: A.bankActions,
        title: $localize`:@@guide.teacher.assignFromBank.menu.title:El menú del ejercicio`,
        text: $localize`:@@guide.teacher.assignFromBank.menu.text:Cada ejercicio tiene el suyo.`,
        action: $localize`:@@guide.teacher.assignFromBank.menu.action:Abre el menú «⋮» de un ejercicio`,
      },
      {
        anchor: A.bankAssign,
        inOverlay: true,
        title: $localize`:@@guide.teacher.assignFromBank.assign.title:Asignar a un bloque`,
        text: $localize`:@@guide.teacher.assignFromBank.assign.text:Eliges el grupo y el bloque, y se añade al final.`,
        action: $localize`:@@guide.teacher.assignFromBank.assign.action:Pulsa «Asignar a un bloque…»`,
      },
    ],
  },
];

const FORM: readonly GuideTask[] = [
  {
    id: 'translate-exercise',
    screen: 'exercise-form',
    place: 'newExercise',
    title: $localize`:@@guide.teacher.translate.title:Traducir un ejercicio`,
    summary: $localize`:@@guide.teacher.translate.summary:Con un borrador de la IA, que revisas.`,
    keywords: [
      $localize`:@@guide.teacher.translate.keywords:traducir idioma inglés catalán ia traducción`,
    ],
    steps: [
      {
        anchor: A.formLanguageTab,
        title: $localize`:@@guide.teacher.translate.tab.title:Sus idiomas`,
        text: $localize`:@@guide.teacher.translate.tab.text:Tu alumnado lo lee en su idioma si está traducido; si no, en el original, con un aviso.`,
        action: $localize`:@@guide.teacher.translate.tab.action:Abre la pestaña de otro idioma`,
      },
      {
        anchor: A.formTranslate,
        title: $localize`:@@guide.teacher.translate.button.title:Traducir con IA`,
        text: $localize`:@@guide.teacher.translate.button.text:Rellena la pestaña con un borrador que revisas antes de guardar; el código no se traduce. Escribe antes el título y el enunciado en el original.`,
      },
    ],
  },
  {
    id: 'try-as-student',
    screen: 'exercise-form',
    place: 'newExercise',
    title: $localize`:@@guide.teacher.tryout.title:Probar un ejercicio como alumno`,
    summary: $localize`:@@guide.teacher.tryout.summary:Verlo como lo verá tu alumnado, con el tutor.`,
    keywords: [
      $localize`:@@guide.teacher.tryout.keywords:probar alumno vista previa tutor resolver`,
    ],
    steps: [
      {
        anchor: A.formTryout,
        title: $localize`:@@guide.teacher.tryout.button.title:Probar como alumno`,
        text: $localize`:@@guide.teacher.tryout.button.text:El ejercicio tal como está en el formulario, en la pantalla del alumno y con el tutor, sin guardar nada. Espera a que la función y las pruebas sean válidas.`,
      },
    ],
  },
  {
    id: 'proactive-thresholds',
    screen: 'exercise-form',
    place: 'newExercise',
    title: $localize`:@@guide.teacher.thresholds.title:Ajustar cuándo se ofrece el tutor`,
    summary: $localize`:@@guide.teacher.thresholds.summary:A quien parece atascado en un ejercicio.`,
    keywords: [
      $localize`:@@guide.teacher.thresholds.keywords:tutor proactivo atascado umbral fallos minutos`,
    ],
    steps: [
      {
        anchor: A.formThresholds,
        title: $localize`:@@guide.teacher.thresholds.section.title:Umbrales del tutor proactivo`,
        text: $localize`:@@guide.teacher.thresholds.section.text:Tras cuántos fallos seguidos de la misma prueba, o cuántos minutos sin hacer nada, el tutor se ofrece por su cuenta. Más bajos en un ejercicio difícil.`,
      },
    ],
  },
];

const LIVE: readonly GuideTask[] = [
  {
    id: 'attend',
    screen: 'live',
    place: 'live',
    needs: 'hasAssignment',
    unavailable: NO_ASSIGNMENT,
    title: $localize`:@@guide.teacher.attend.title:Atender a quien necesita ayuda`,
    summary: $localize`:@@guide.teacher.attend.summary:Ver qué le pasa y marcarlo como atendido.`,
    keywords: [
      $localize`:@@guide.teacher.attend.keywords:atender ayuda atascado pistas atendido alumno`,
    ],
    steps: [
      {
        anchor: A.liveQueue,
        optional: true,
        title: $localize`:@@guide.teacher.attend.queue.title:Necesitan atención`,
        text: $localize`:@@guide.teacher.attend.queue.text:Quién lleva rato atascado o ha pedido muchas pistas, primero quien más espera. Solo sale en directo.`,
      },
      {
        anchor: A.liveTable,
        title: $localize`:@@guide.teacher.attend.table.title:Su detalle`,
        text: $localize`:@@guide.teacher.attend.table.text:Pulsa su nombre: verás su código, sus pruebas y lo que le dijo el tutor. Cuando le hayas ayudado, «Atendido» lo quita de la lista.`,
      },
    ],
  },
  {
    id: 'other-group',
    screen: 'live',
    place: 'live',
    needs: 'hasAssignment',
    unavailable: NO_ASSIGNMENT,
    title: $localize`:@@guide.teacher.otherGroup.title:Seguir otro grupo u otro bloque`,
    summary: $localize`:@@guide.teacher.otherGroup.summary:Y ver lo que hicieron fuera de clase.`,
    keywords: [
      $localize`:@@guide.teacher.otherGroup.keywords:cambiar grupo bloque fuera de clase directo`,
    ],
    steps: [
      {
        anchor: A.liveGroup,
        title: $localize`:@@guide.teacher.otherGroup.group.title:El grupo`,
        text: $localize`:@@guide.teacher.otherGroup.group.text:Cada asignatura de cada clase es un grupo.`,
      },
      {
        anchor: A.liveBlock,
        title: $localize`:@@guide.teacher.otherGroup.block.title:El bloque`,
        text: $localize`:@@guide.teacher.otherGroup.block.text:Un punto verde marca los que tienen actividad ahora.`,
      },
      {
        anchor: A.liveState,
        title: $localize`:@@guide.teacher.otherGroup.state.title:Fuera de clase`,
        text: $localize`:@@guide.teacher.otherGroup.state.text:Si nadie trabaja ahora, ves lo que dejaron hecho y cuándo fue su última actividad.`,
      },
    ],
  },
  {
    id: 'find-student',
    screen: 'live',
    place: 'live',
    needs: 'hasAssignment',
    unavailable: NO_ASSIGNMENT,
    title: $localize`:@@guide.teacher.findStudent.title:Buscar a un alumno en la clase`,
    summary: $localize`:@@guide.teacher.findStudent.summary:Por su nombre, o los que han terminado.`,
    keywords: [
      $localize`:@@guide.teacher.findStudent.keywords:buscar alumno nombre terminado empezado`,
    ],
    steps: [
      {
        anchor: A.liveTabs,
        optional: true,
        title: $localize`:@@guide.teacher.findStudent.tabs.title:Todos, empezados o terminados`,
        text: $localize`:@@guide.teacher.findStudent.tabs.text:Para ver solo una parte del alumnado.`,
      },
      {
        anchor: A.liveSearch,
        title: $localize`:@@guide.teacher.findStudent.search.title:Buscar`,
        text: $localize`:@@guide.teacher.findStudent.search.text:Por su nombre, mientras escribes.`,
      },
    ],
  },
  {
    id: 'attempt-timeline',
    screen: 'attempt',
    place: 'attempt',
    unavailable: NO_ATTEMPT,
    title: $localize`:@@guide.teacher.timeline.title:Ver qué hizo un alumno, paso a paso`,
    summary: $localize`:@@guide.teacher.timeline.summary:Sus pruebas, sus pistas y su código.`,
    keywords: [
      $localize`:@@guide.teacher.timeline.keywords:detalle intento línea temporal historial código pistas`,
    ],
    steps: [
      {
        anchor: A.detailTimeline,
        title: $localize`:@@guide.teacher.timeline.list.title:Lo que pasó`,
        text: $localize`:@@guide.teacher.timeline.list.text:Todo lo que hizo, en orden: cada ejecución, cada pista y lo que le respondió el tutor.`,
      },
      {
        anchor: A.detailTimelineFilter,
        title: $localize`:@@guide.teacher.timeline.filter.title:Filtrar`,
        text: $localize`:@@guide.teacher.timeline.filter.text:Todo, solo las pruebas o solo el tutor.`,
      },
      {
        anchor: A.detailCode,
        title: $localize`:@@guide.teacher.timeline.code.title:Su código`,
        text: $localize`:@@guide.teacher.timeline.code.text:El que entregó o, si sigue trabajando, el actual.`,
      },
    ],
  },
  {
    id: 'group-evolution',
    screen: 'history',
    place: 'history',
    needs: 'hasAssignment',
    unavailable: NO_ASSIGNMENT,
    title: $localize`:@@guide.teacher.evolution.title:Ver cómo evoluciona un grupo`,
    summary: $localize`:@@guide.teacher.evolution.summary:Bloque a bloque, también de cursos anteriores.`,
    keywords: [
      $localize`:@@guide.teacher.evolution.keywords:histórico evolución estadísticas grupo curso anterior`,
    ],
    steps: [
      {
        anchor: A.historyGroup,
        title: $localize`:@@guide.teacher.evolution.group.title:El curso y el grupo`,
        text: $localize`:@@guide.teacher.evolution.group.text:También los de cursos anteriores.`,
      },
      {
        anchor: A.historyEvolution,
        title: $localize`:@@guide.teacher.evolution.chart.title:Su evolución`,
        text: $localize`:@@guide.teacher.evolution.chart.text:Cuántas pistas pide de media cada alumno en cada bloque: si bajan, el grupo gana autonomía.`,
      },
      {
        anchor: A.historyBlock,
        title: $localize`:@@guide.teacher.evolution.block.title:Cada bloque`,
        text: $localize`:@@guide.teacher.evolution.block.text:Cuántos superaron cada ejercicio, cuánto tardaron y dónde se atascaron.`,
      },
    ],
  },
];
