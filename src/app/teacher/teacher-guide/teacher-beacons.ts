import { GUIDE_ANCHORS } from '../../core/guide/guide-anchor';
import type { GuideBeacon } from '../../core/guide/guide-task';

const A = GUIDE_ANCHORS;

/**
 * Every piece of every screen of the teacher, in reading order (2.12, ficha 13): the beacons of
 * «Ayuda de esta pantalla» and, in the same order, the tour of «Recorrer esta pantalla». The pieces
 * of the bar and the side menu (no screen) show on every screen.
 */
export function teacherBeacons(): readonly GuideBeacon[] {
  return [...BARS, ...LIVE, ...ATTEMPT, ...BANK, ...FORM, ...BLOCKS, ...GROUPS, ...HISTORY];
}

const BARS: readonly GuideBeacon[] = [
  {
    anchor: A.menuButton,
    title: $localize`:@@guide.teacher.beacon.menuButton.title:El menú`,
    text: $localize`:@@guide.teacher.beacon.menuButton.text:Pliega el menú a sus iconos para dejar más sitio, o lo despliega. En el móvil, lo abre.`,
  },
  {
    anchor: A.brand,
    title: $localize`:@@guide.teacher.beacon.brand.title:TutorIA`,
    text: $localize`:@@guide.teacher.beacon.brand.text:Desde cualquier pantalla, te lleva a la sesión en vivo.`,
  },
  {
    anchor: A.help,
    title: $localize`:@@guide.teacher.beacon.help.title:Ayuda`,
    text: $localize`:@@guide.teacher.beacon.help.text:Tus primeros pasos, el recorrido de cada pantalla, la ayuda de cada pieza y la bienvenida.`,
  },
  {
    anchor: A.themeMenu,
    title: $localize`:@@guide.teacher.beacon.theme.title:Tema`,
    text: $localize`:@@guide.teacher.beacon.theme.text:Claro, oscuro o el de tu sistema.`,
  },
  {
    anchor: A.languageMenu,
    title: $localize`:@@guide.teacher.beacon.language.title:Idioma`,
    text: $localize`:@@guide.teacher.beacon.language.text:Español, català o English. Los ejercicios se ven en el idioma que tengan traducido.`,
  },
  {
    anchor: A.userMenu,
    title: $localize`:@@guide.teacher.beacon.userMenu.title:Tu menú`,
    text: $localize`:@@guide.teacher.beacon.userMenu.text:Con qué cuenta has entrado y «Cerrar sesión».`,
  },
  {
    anchor: A.navLive,
    inSideMenu: true,
    title: $localize`:@@guide.teacher.beacon.navLive.title:En vivo`,
    text: $localize`:@@guide.teacher.beacon.navLive.text:Cómo va tu grupo ahora mismo, ejercicio a ejercicio, y quién necesita ayuda.`,
  },
  {
    anchor: A.navHistory,
    inSideMenu: true,
    title: $localize`:@@guide.teacher.beacon.navHistory.title:Histórico`,
    text: $localize`:@@guide.teacher.beacon.navHistory.text:Cómo evoluciona cada grupo, bloque a bloque, también de cursos anteriores.`,
  },
  {
    anchor: A.navBank,
    inSideMenu: true,
    title: $localize`:@@guide.teacher.beacon.navBank.title:Ejercicios`,
    text: $localize`:@@guide.teacher.beacon.navBank.text:El banco común del profesorado: busca, duplica o escribe ejercicios con sus pruebas.`,
  },
  {
    anchor: A.navBlocks,
    inSideMenu: true,
    title: $localize`:@@guide.teacher.beacon.navBlocks.title:Bloques`,
    text: $localize`:@@guide.teacher.beacon.navBlocks.text:Los temas de cada grupo y los ejercicios que les asignas, en el orden en que los verán.`,
  },
  {
    anchor: A.navGroups,
    inSideMenu: true,
    title: $localize`:@@guide.teacher.beacon.navGroups.title:Grupos`,
    text: $localize`:@@guide.teacher.beacon.navGroups.text:Tus clases, sus asignaturas y su alumnado: aquí se crean y se matricula.`,
  },
];

const LIVE: readonly GuideBeacon[] = [
  {
    screen: 'live',
    anchor: A.liveState,
    title: $localize`:@@guide.teacher.beacon.liveState.title:En directo o fuera de clase`,
    text: $localize`:@@guide.teacher.beacon.liveState.text:En directo cuando alguien del grupo está trabajando ahora; si no, cuándo fue la última actividad.`,
  },
  {
    screen: 'live',
    anchor: A.liveGroup,
    title: $localize`:@@guide.teacher.beacon.liveGroup.title:El grupo`,
    text: $localize`:@@guide.teacher.beacon.liveGroup.text:Cada asignatura de cada clase que das es un grupo. Elige el que quieres seguir.`,
  },
  {
    screen: 'live',
    anchor: A.liveBlock,
    title: $localize`:@@guide.teacher.beacon.liveBlock.title:El bloque`,
    text: $localize`:@@guide.teacher.beacon.liveBlock.text:El tema que sigues. Un punto verde marca los que tienen actividad ahora.`,
  },
  {
    screen: 'live',
    anchor: A.liveRhythm,
    title: $localize`:@@guide.teacher.beacon.liveRhythm.title:Ritmo de la clase`,
    text: $localize`:@@guide.teacher.beacon.liveRhythm.text:Cuánta actividad hay minuto a minuto: si baja de golpe, quizá se han atascado todos.`,
  },
  {
    screen: 'live',
    anchor: A.liveQueue,
    title: $localize`:@@guide.teacher.beacon.liveQueue.title:Necesitan atención`,
    text: $localize`:@@guide.teacher.beacon.liveQueue.text:Quién lleva rato atascado o ha pedido muchas pistas, primero quien más tiempo espera. «Atendido» lo quita de la lista.`,
  },
  {
    screen: 'live',
    anchor: A.liveClass,
    title: $localize`:@@guide.teacher.beacon.liveClass.title:Dónde está la clase`,
    text: $localize`:@@guide.teacher.beacon.liveClass.text:Cuántos van por cada ejercicio y cómo: en curso, con fallos, superado o entregado. Pulsa una barra para ver quiénes son.`,
  },
  {
    screen: 'live',
    anchor: A.liveTabs,
    title: $localize`:@@guide.teacher.beacon.liveTabs.title:El alumnado`,
    text: $localize`:@@guide.teacher.beacon.liveTabs.text:Todos, los que han empezado o los que han terminado, con cuántos hay en cada pestaña.`,
  },
  {
    screen: 'live',
    anchor: A.liveSearch,
    title: $localize`:@@guide.teacher.beacon.liveSearch.title:Buscar alumno`,
    text: $localize`:@@guide.teacher.beacon.liveSearch.text:Por su nombre, sin preocuparte de las tildes.`,
  },
  {
    screen: 'live',
    anchor: A.liveTable,
    title: $localize`:@@guide.teacher.beacon.liveTable.title:Cada alumno`,
    text: $localize`:@@guide.teacher.beacon.liveTable.text:Su estado, cuántas pruebas supera, las pistas que ha pedido y su última actividad. Pulsa su nombre para ver el detalle.`,
  },
];

const ATTEMPT: readonly GuideBeacon[] = [
  {
    screen: 'attempt',
    anchor: A.detailBack,
    title: $localize`:@@guide.teacher.beacon.detailBack.title:Volver`,
    text: $localize`:@@guide.teacher.beacon.detailBack.text:A la sesión en vivo, con el mismo grupo y el mismo bloque.`,
  },
  {
    screen: 'attempt',
    anchor: A.detailHeader,
    title: $localize`:@@guide.teacher.beacon.detailHeader.title:El alumno y su ejercicio`,
    text: $localize`:@@guide.teacher.beacon.detailHeader.text:Cómo va, en qué ejercicio y bloque está y, si lo repite, qué intento es.`,
  },
  {
    screen: 'attempt',
    anchor: A.detailAttempts,
    title: $localize`:@@guide.teacher.beacon.detailAttempts.title:Sus intentos`,
    text: $localize`:@@guide.teacher.beacon.detailAttempts.text:Si ha practicado el ejercicio más de una vez, cada intento por separado.`,
  },
  {
    screen: 'attempt',
    anchor: A.detailAttend,
    title: $localize`:@@guide.teacher.beacon.detailAttend.title:Atendido`,
    text: $localize`:@@guide.teacher.beacon.detailAttend.text:Por qué necesita ayuda. Cuando le hayas ayudado, márcalo y sale de la lista de atención.`,
  },
  {
    screen: 'attempt',
    anchor: A.detailNow,
    title: $localize`:@@guide.teacher.beacon.detailNow.title:Ahora`,
    text: $localize`:@@guide.teacher.beacon.detailNow.text:Las pruebas que falla, la última ayuda del tutor y el resumen: tiempo de trabajo, ejecuciones, pistas y si pegó código o salió de la ventana.`,
  },
  {
    screen: 'attempt',
    anchor: A.detailEvolution,
    title: $localize`:@@guide.teacher.beacon.detailEvolution.title:Evolución`,
    text: $localize`:@@guide.teacher.beacon.detailEvolution.text:Las pruebas que superó en cada ejecución y cuándo pidió pistas. Pulsa un punto para ir a ese momento.`,
  },
  {
    screen: 'attempt',
    anchor: A.detailTimeline,
    title: $localize`:@@guide.teacher.beacon.detailTimeline.title:Línea temporal`,
    text: $localize`:@@guide.teacher.beacon.detailTimeline.text:Todo lo que hizo, en orden: cuándo abrió el ejercicio, cada ejecución, cada pista y lo que le respondió el tutor.`,
  },
  {
    screen: 'attempt',
    anchor: A.detailTimelineFilter,
    title: $localize`:@@guide.teacher.beacon.detailTimelineFilter.title:Filtrar la línea temporal`,
    text: $localize`:@@guide.teacher.beacon.detailTimelineFilter.text:Todo, solo las pruebas o solo el tutor.`,
  },
  {
    screen: 'attempt',
    anchor: A.detailCode,
    title: $localize`:@@guide.teacher.beacon.detailCode.title:Su código`,
    text: $localize`:@@guide.teacher.beacon.detailCode.text:El que entregó o, si sigue trabajando, el actual. Solo se lee: no se puede cambiar.`,
  },
];

const BANK: readonly GuideBeacon[] = [
  {
    screen: 'exercise-bank',
    anchor: A.bankNew,
    title: $localize`:@@guide.teacher.beacon.bankNew.title:Nuevo ejercicio`,
    text: $localize`:@@guide.teacher.beacon.bankNew.text:Escribe uno con su enunciado y sus pruebas. Lo verá todo el profesorado de sus asignaturas.`,
  },
  {
    screen: 'exercise-bank',
    anchor: A.bankSearch,
    title: $localize`:@@guide.teacher.beacon.bankSearch.title:Buscar`,
    text: $localize`:@@guide.teacher.beacon.bankSearch.text:Por título, contenido o nombre de la función.`,
  },
  {
    screen: 'exercise-bank',
    anchor: A.bankSubject,
    title: $localize`:@@guide.teacher.beacon.bankSubject.title:Asignatura`,
    text: $localize`:@@guide.teacher.beacon.bankSubject.text:Parte de las tuyas; elige otra o «Todas» para ver el resto del banco.`,
  },
  {
    screen: 'exercise-bank',
    anchor: A.bankDifficulty,
    title: $localize`:@@guide.teacher.beacon.bankDifficulty.title:Dificultad`,
    text: $localize`:@@guide.teacher.beacon.bankDifficulty.text:Inicial, media, avanzada o de ampliación.`,
  },
  {
    screen: 'exercise-bank',
    anchor: A.bankMine,
    title: $localize`:@@guide.teacher.beacon.bankMine.title:Solo los míos`,
    text: $localize`:@@guide.teacher.beacon.bankMine.text:Los que has escrito tú: los únicos que puedes cambiar. Los de otros, duplícalos para adaptarlos.`,
  },
  {
    screen: 'exercise-bank',
    anchor: A.bankArchived,
    title: $localize`:@@guide.teacher.beacon.bankArchived.title:Archivados`,
    text: $localize`:@@guide.teacher.beacon.bankArchived.text:Los que ya no se usan: salen del banco sin que nadie pierda sus intentos.`,
  },
  {
    screen: 'exercise-bank',
    anchor: A.bankCount,
    title: $localize`:@@guide.teacher.beacon.bankCount.title:Cuántos hay`,
    text: $localize`:@@guide.teacher.beacon.bankCount.text:Los que coinciden con los filtros, de todos los de las asignaturas elegidas.`,
  },
  {
    screen: 'exercise-bank',
    anchor: A.bankExercise,
    title: $localize`:@@guide.teacher.beacon.bankExercise.title:Cada ejercicio`,
    text: $localize`:@@guide.teacher.beacon.bankExercise.text:Su dificultad, sus asignaturas y su función; si es tuyo, cuántas pruebas tiene, dónde está asignado y cuántos alumnos lo han empezado.`,
  },
  {
    screen: 'exercise-bank',
    anchor: A.bankActions,
    title: $localize`:@@guide.teacher.beacon.bankActions.title:Sus acciones`,
    text: $localize`:@@guide.teacher.beacon.bankActions.text:Editarlo o verlo, duplicarlo, asignarlo a un bloque y, si es tuyo, archivarlo.`,
  },
];

const FORM: readonly GuideBeacon[] = [
  {
    screen: 'exercise-form',
    anchor: A.formBack,
    title: $localize`:@@guide.teacher.beacon.formBack.title:Volver`,
    text: $localize`:@@guide.teacher.beacon.formBack.text:Al banco. Si hay cambios sin guardar, te lo pregunta antes.`,
  },
  {
    screen: 'exercise-form',
    anchor: A.formTryout,
    title: $localize`:@@guide.teacher.beacon.formTryout.title:Probar como alumno`,
    text: $localize`:@@guide.teacher.beacon.formTryout.text:La pantalla de trabajo del alumnado, con el tutor, tal como está el ejercicio. Necesita la función y una prueba.`,
  },
  {
    screen: 'exercise-form',
    anchor: A.formStatement,
    title: $localize`:@@guide.teacher.beacon.formStatement.title:Título y enunciado`,
    text: $localize`:@@guide.teacher.beacon.formStatement.text:En el idioma en que lo escribes; cuando lo guardes, podrás traducirlo con IA a los otros dos.`,
  },
  {
    screen: 'exercise-form',
    anchor: A.formClassification,
    title: $localize`:@@guide.teacher.beacon.formClassification.title:Dificultad y asignaturas`,
    text: $localize`:@@guide.teacher.beacon.formClassification.text:Las asignaturas deciden quién lo ve en el banco.`,
  },
  {
    screen: 'exercise-form',
    anchor: A.formThresholds,
    title: $localize`:@@guide.teacher.beacon.formThresholds.title:Umbrales del tutor proactivo`,
    text: $localize`:@@guide.teacher.beacon.formThresholds.text:Cuántos fallos seguidos o minutos sin actividad esperan antes de que el tutor se ofrezca solo.`,
  },
  {
    screen: 'exercise-form',
    anchor: A.formFunction,
    title: $localize`:@@guide.teacher.beacon.formFunction.title:La función`,
    text: $localize`:@@guide.teacher.beacon.formFunction.text:Su nombre y sus parámetros, en inglés. Con ellos, el tutor da al alumno el esqueleto para empezar.`,
  },
  {
    screen: 'exercise-form',
    anchor: A.formTests,
    title: $localize`:@@guide.teacher.beacon.formTests.title:Pruebas automáticas`,
    text: $localize`:@@guide.teacher.beacon.formTests.text:Los argumentos y el resultado esperado, en JSON. Las visibles son los ejemplos del enunciado; las ocultas, los casos límite.`,
  },
  {
    screen: 'exercise-form',
    anchor: A.formCheck,
    title: $localize`:@@guide.teacher.beacon.formCheck.title:Probar mi solución`,
    text: $localize`:@@guide.teacher.beacon.formCheck.text:Escribe una solución y comprueba que las pruebas están bien. No se guarda.`,
  },
  {
    screen: 'exercise-form',
    anchor: A.formSave,
    title: $localize`:@@guide.teacher.beacon.formSave.title:Guardar`,
    text: $localize`:@@guide.teacher.beacon.formSave.text:Si falta algo, te dice qué. «Cancelar» vuelve al banco sin guardar.`,
  },
];

const BLOCKS: readonly GuideBeacon[] = [
  {
    screen: 'blocks',
    anchor: A.blocksGroup,
    title: $localize`:@@guide.teacher.beacon.blocksGroup.title:Curso y grupo`,
    text: $localize`:@@guide.teacher.beacon.blocksGroup.text:Los bloques son de cada grupo: de una asignatura en una clase.`,
  },
  {
    screen: 'blocks',
    anchor: A.blocksClosed,
    title: $localize`:@@guide.teacher.beacon.blocksClosed.title:Un curso cerrado`,
    text: $localize`:@@guide.teacher.beacon.blocksClosed.text:Sus bloques se pueden ver y copiar a un grupo de este curso, pero no cambiar.`,
  },
  {
    screen: 'blocks',
    anchor: A.blocksCopy,
    title: $localize`:@@guide.teacher.beacon.blocksCopy.title:Copiar de otro grupo`,
    text: $localize`:@@guide.teacher.beacon.blocksCopy.text:Trae los bloques de otro grupo tuyo, también de un curso anterior, con sus ejercicios.`,
  },
  {
    screen: 'blocks',
    anchor: A.blocksSelect,
    title: $localize`:@@guide.teacher.beacon.blocksSelect.title:Seleccionar`,
    text: $localize`:@@guide.teacher.beacon.blocksSelect.text:Para borrar varios bloques a la vez. Los que alguien ha empezado no se borran: ocúltalos.`,
  },
  {
    screen: 'blocks',
    anchor: A.blocksNew,
    title: $localize`:@@guide.teacher.beacon.blocksNew.title:Nuevo bloque`,
    text: $localize`:@@guide.teacher.beacon.blocksNew.text:Un tema, un repaso o una recuperación, con la fecha en que se abre si quieres.`,
  },
  {
    screen: 'blocks',
    anchor: A.blocksList,
    title: $localize`:@@guide.teacher.beacon.blocksList.title:Los bloques del grupo`,
    text: $localize`:@@guide.teacher.beacon.blocksList.text:En el orden en que los verá tu alumnado.`,
  },
  {
    screen: 'blocks',
    anchor: A.blocksDrag,
    title: $localize`:@@guide.teacher.beacon.blocksDrag.title:Ordenar`,
    text: $localize`:@@guide.teacher.beacon.blocksDrag.text:Arrastra un bloque o un ejercicio a su sitio, o usa «Subir» y «Bajar» de su menú.`,
  },
  {
    screen: 'blocks',
    anchor: A.blocksVisible,
    title: $localize`:@@guide.teacher.beacon.blocksVisible.title:Visible`,
    text: $localize`:@@guide.teacher.beacon.blocksVisible.text:Apagado, tu alumnado no ve el bloque hasta que lo enciendas.`,
  },
  {
    screen: 'blocks',
    anchor: A.blocksMenu,
    title: $localize`:@@guide.teacher.beacon.blocksMenu.title:El menú del bloque`,
    text: $localize`:@@guide.teacher.beacon.blocksMenu.text:Editarlo, añadirle ejercicios, poner una fecha de entrega a todo el bloque, moverlo o borrarlo.`,
  },
  {
    screen: 'blocks',
    anchor: A.blocksExercise,
    title: $localize`:@@guide.teacher.beacon.blocksExercise.title:Cada ejercicio`,
    text: $localize`:@@guide.teacher.beacon.blocksExercise.text:Su número en el bloque, su dificultad y cuántos alumnos lo han empezado.`,
  },
  {
    screen: 'blocks',
    anchor: A.blocksDue,
    title: $localize`:@@guide.teacher.beacon.blocksDue.title:Fecha de entrega`,
    text: $localize`:@@guide.teacher.beacon.blocksDue.text:La de este ejercicio, que tu alumnado ve en su lista. «Fecha de entrega para todo el bloque», en el menú del bloque.`,
  },
  {
    screen: 'blocks',
    anchor: A.blocksHide,
    title: $localize`:@@guide.teacher.beacon.blocksHide.title:Ocultar`,
    text: $localize`:@@guide.teacher.beacon.blocksHide.text:Oculta el ejercicio a tu alumnado sin quitarlo del bloque.`,
  },
  {
    screen: 'blocks',
    anchor: A.blocksExerciseMenu,
    title: $localize`:@@guide.teacher.beacon.blocksExerciseMenu.title:El menú del ejercicio`,
    text: $localize`:@@guide.teacher.beacon.blocksExerciseMenu.text:Subirlo, bajarlo, moverlo a otro bloque o quitarlo. Si ya lo han empezado, mejor ocultarlo.`,
  },
  {
    screen: 'blocks',
    anchor: A.blocksAdd,
    title: $localize`:@@guide.teacher.beacon.blocksAdd.title:Añadir ejercicios`,
    text: $localize`:@@guide.teacher.beacon.blocksAdd.text:Elige ejercicios del banco y se añaden al final del bloque.`,
  },
];

const GROUPS: readonly GuideBeacon[] = [
  {
    screen: 'groups',
    anchor: A.groupsYear,
    title: $localize`:@@guide.teacher.beacon.groupsYear.title:Curso`,
    text: $localize`:@@guide.teacher.beacon.groupsYear.text:Este curso o uno anterior, que ya se puede ver pero no cambiar.`,
  },
  {
    screen: 'groups',
    anchor: A.groupsClass,
    title: $localize`:@@guide.teacher.beacon.groupsClass.title:La clase`,
    text: $localize`:@@guide.teacher.beacon.groupsClass.text:Como 1.º DAW A: la comparten todos sus docentes, cada uno con sus asignaturas.`,
  },
  {
    screen: 'groups',
    anchor: A.groupsClassMenu,
    title: $localize`:@@guide.teacher.beacon.groupsClassMenu.title:El menú de la clase`,
    text: $localize`:@@guide.teacher.beacon.groupsClassMenu.text:Editarla, duplicarla para el curso que viene o eliminarla mientras no tenga asignaturas.`,
  },
  {
    screen: 'groups',
    anchor: A.groupsAddClass,
    title: $localize`:@@guide.teacher.beacon.groupsAddClass.title:Añadir clase`,
    text: $localize`:@@guide.teacher.beacon.groupsAddClass.text:Una nueva, o la de otro docente si ya existe: escribe su nombre y te lo dice.`,
  },
  {
    screen: 'groups',
    anchor: A.groupsRoster,
    title: $localize`:@@guide.teacher.beacon.groupsRoster.title:El alumnado`,
    text: $localize`:@@guide.teacher.beacon.groupsRoster.text:Quién está en la clase y en qué asignaturas.`,
  },
  {
    screen: 'groups',
    anchor: A.groupsFilter,
    title: $localize`:@@guide.teacher.beacon.groupsFilter.title:Filtrar alumnos`,
    text: $localize`:@@guide.teacher.beacon.groupsFilter.text:Por nombre o correo.`,
  },
  {
    screen: 'groups',
    anchor: A.groupsOutcomes,
    title: $localize`:@@guide.teacher.beacon.groupsOutcomes.title:Evaluación final`,
    text: $localize`:@@guide.teacher.beacon.groupsOutcomes.text:Al acabar el curso, quién promociona, repite, titula o deja los estudios.`,
  },
  {
    screen: 'groups',
    anchor: A.groupsEnroll,
    title: $localize`:@@guide.teacher.beacon.groupsEnroll.title:Matricular en la clase`,
    text: $localize`:@@guide.teacher.beacon.groupsEnroll.text:Con una lista de correos, desde otra clase o buscándolos. Entran en todas sus asignaturas, salvo los desdobles.`,
  },
  {
    screen: 'groups',
    anchor: A.groupsAddSubject,
    title: $localize`:@@guide.teacher.beacon.groupsAddSubject.title:Añadir asignatura`,
    text: $localize`:@@guide.teacher.beacon.groupsAddSubject.text:Las que das en esta clase; cada una es un grupo, con sus desdobles si los hay.`,
  },
  {
    screen: 'groups',
    anchor: A.groupsExport,
    title: $localize`:@@guide.teacher.beacon.groupsExport.title:Exportar`,
    text: $localize`:@@guide.teacher.beacon.groupsExport.text:La lista en CSV o los correos copiados, para pegarlos donde quieras.`,
  },
  {
    screen: 'groups',
    anchor: A.groupsTable,
    title: $localize`:@@guide.teacher.beacon.groupsTable.title:La tabla`,
    text: $localize`:@@guide.teacher.beacon.groupsTable.text:Una fila por alumno y una columna por asignatura, con su docente y cuántos alumnos tiene.`,
  },
  {
    screen: 'groups',
    anchor: A.groupsSubjectMenu,
    title: $localize`:@@guide.teacher.beacon.groupsSubjectMenu.title:El menú de la asignatura`,
    text: $localize`:@@guide.teacher.beacon.groupsSubjectMenu.text:Editarla, ver sus bloques, matricular solo en ella o eliminarla si nadie ha trabajado en ella.`,
  },
  {
    screen: 'groups',
    anchor: A.groupsStudentMenu,
    title: $localize`:@@guide.teacher.beacon.groupsStudentMenu.title:El menú del alumno`,
    text: $localize`:@@guide.teacher.beacon.groupsStudentMenu.text:Quitarlo de la clase y de todas sus asignaturas. Su trabajo se conserva.`,
  },
];

const HISTORY: readonly GuideBeacon[] = [
  {
    screen: 'history',
    anchor: A.historyGroup,
    title: $localize`:@@guide.teacher.beacon.historyGroup.title:Curso y grupo`,
    text: $localize`:@@guide.teacher.beacon.historyGroup.text:También de cursos anteriores, para comparar.`,
  },
  {
    screen: 'history',
    anchor: A.historyEvolution,
    title: $localize`:@@guide.teacher.beacon.historyEvolution.title:Evolución del grupo`,
    text: $localize`:@@guide.teacher.beacon.historyEvolution.text:Cuántas pistas pide de media cada alumno en cada bloque: si bajan, el grupo gana autonomía.`,
  },
  {
    screen: 'history',
    anchor: A.historyBlock,
    title: $localize`:@@guide.teacher.beacon.historyBlock.title:Cada bloque`,
    text: $localize`:@@guide.teacher.beacon.historyBlock.text:Cuántos superaron cada ejercicio, cuánto tardaron, dónde se atascaron y qué llegó a tiempo en cada fecha de entrega.`,
  },
];
