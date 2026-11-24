import { GUIDE_ANCHORS } from '../../core/guide/guide-anchor';
import type { GuideTask } from '../../core/guide/guide-task';

const A = GUIDE_ANCHORS;

/** Its id: «Crear tu clase» of the empty screens starts it (D-093). */
export const CREATE_CLASS_TASK = 'create-class';

/** The first steps of the teacher, in their order (ficha 13). */
export const TEACHER_FIRST_STEPS = [
  CREATE_CLASS_TASK,
  'create-block',
  'add-exercise',
  'assign-exercise',
  'follow-live',
];

const NO_CLASS = $localize`:@@guide.teacher.unavailable.noClass:Cuando tengas una clase con una asignatura tuya`;
const NO_BLOCK = $localize`:@@guide.teacher.unavailable.noBlock:Cuando hayas creado un bloque`;
const NO_ASSIGNMENT = $localize`:@@guide.teacher.unavailable.noAssignment:Cuando hayas asignado un ejercicio a un bloque`;

/**
 * The first steps of the teacher (2.12, ficha 13): what a teacher who starts from scratch does to
 * prepare a class, on the real screens and with their own data. Each one that creates something
 * says so before, and how to undo it. Those that start from the side menu open it on phones.
 */
export function teacherFirstSteps(): readonly GuideTask[] {
  return [
    {
      id: CREATE_CLASS_TASK,
      doneBy: 'hasStudents',
      screen: 'groups',
      title: $localize`:@@guide.teacher.createClass.title:Crear tu clase y matricular a su alumnado`,
      summary: $localize`:@@guide.teacher.createClass.summary:Tu clase, las asignaturas que das en ella y su alumnado.`,
      keywords: [
        $localize`:@@guide.teacher.createClass.keywords:grupo clase asignatura matricular alumnos curso unirse`,
      ],
      steps: [
        {
          anchor: A.navGroups,
          inSideMenu: true,
          navigates: true,
          title: $localize`:@@guide.teacher.createClass.nav.title:Grupos`,
          text: $localize`:@@guide.teacher.createClass.nav.text:Tus clases, sus asignaturas y su alumnado están en Grupos.`,
          action: $localize`:@@guide.teacher.createClass.nav.action:Pulsa «Grupos»`,
        },
        {
          anchor: A.groupsAddClass,
          title: $localize`:@@guide.teacher.createClass.add.title:Añadir clase`,
          text: $localize`:@@guide.teacher.createClass.add.text:Vas a crear una clase de verdad. Si era solo para probar, después quítale las asignaturas y elimínala desde su menú «⋮».`,
          // Disabled only for a moment, while the classes load: the step waits for it
          action: $localize`:@@guide.teacher.createClass.add.action:Pulsa «Añadir clase»`,
        },
        {
          anchor: A.classDialogSave,
          inOverlay: true,
          title: $localize`:@@guide.teacher.createClass.dialog.title:La clase`,
          text: $localize`:@@guide.teacher.createClass.dialog.text:Su nombre, como 1.º DAW A, y su curso. Si ya existe porque la da otro docente, te lo dice al escribirlo: únete a ella con tus asignaturas.`,
          action: $localize`:@@guide.teacher.createClass.dialog.action:Escribe su nombre y pulsa «Crear y elegir asignaturas»`,
        },
        {
          anchor: A.subjectsDialogSave,
          inOverlay: true,
          title: $localize`:@@guide.teacher.createClass.subjects.title:Tus asignaturas`,
          text: $localize`:@@guide.teacher.createClass.subjects.text:Marca las que das en esta clase. Cada una es un grupo, con su propio alumnado y sus bloques.`,
          action: $localize`:@@guide.teacher.createClass.subjects.action:Marca tus asignaturas y pulsa «Añadir»`,
        },
        {
          anchor: A.groupsEnroll,
          title: $localize`:@@guide.teacher.createClass.enroll.title:Matricular en la clase`,
          text: $localize`:@@guide.teacher.createClass.enroll.text:El alumnado entra en la clase y en todas sus asignaturas, salvo los desdobles.`,
          action: $localize`:@@guide.teacher.createClass.enroll.action:Pulsa «Matricular en la clase»`,
        },
        {
          anchor: A.enrollDialogSave,
          inOverlay: true,
          title: $localize`:@@guide.teacher.createClass.enrollDialog.title:Elige a tu alumnado`,
          text: $localize`:@@guide.teacher.createClass.enrollDialog.text:Elígelo entre quienes no tienen clase este curso, pega sus correos, tráelo de otra clase o búscalo. Solo están las cuentas que ya existen: si falta alguien, pide a la administración que le dé de alta.`,
          action: $localize`:@@guide.teacher.createClass.enrollDialog.action:Elige al alumnado y pulsa «Matricular»`,
        },
        {
          anchor: A.groupsTable,
          title: $localize`:@@guide.teacher.createClass.table.title:Tu alumnado`,
          text: $localize`:@@guide.teacher.createClass.table.text:Una fila por alumno y una columna por asignatura. Desde el menú de cada uno, lo quitas de la clase.`,
        },
      ],
    },
    {
      id: 'create-block',
      doneBy: 'hasBlock',
      needs: 'hasClass',
      unavailable: NO_CLASS,
      screen: 'blocks',
      title: $localize`:@@guide.teacher.createBlock.title:Crear un bloque`,
      summary: $localize`:@@guide.teacher.createBlock.summary:Un tema de un grupo, que luego llenas de ejercicios.`,
      keywords: [$localize`:@@guide.teacher.createBlock.keywords:tema unidad repaso nuevo bloque`],
      steps: [
        {
          anchor: A.navBlocks,
          inSideMenu: true,
          navigates: true,
          title: $localize`:@@guide.teacher.createBlock.nav.title:Bloques`,
          text: $localize`:@@guide.teacher.createBlock.nav.text:Los temas de cada grupo están en Bloques.`,
          action: $localize`:@@guide.teacher.createBlock.nav.action:Pulsa «Bloques»`,
        },
        {
          anchor: A.blocksGroup,
          title: $localize`:@@guide.teacher.createBlock.group.title:El grupo`,
          text: $localize`:@@guide.teacher.createBlock.group.text:Cada asignatura de una clase tiene sus bloques. Elige aquí la del bloque nuevo.`,
        },
        {
          anchor: A.blocksNew,
          title: $localize`:@@guide.teacher.createBlock.new.title:Nuevo bloque`,
          text: $localize`:@@guide.teacher.createBlock.new.text:Se crea de verdad. Si era solo para probar, bórralo desde su menú «⋮» mientras nadie lo haya empezado.`,
          action: $localize`:@@guide.teacher.createBlock.new.action:Pulsa «Nuevo bloque»`,
        },
        {
          anchor: A.blockDialogSave,
          inOverlay: true,
          title: $localize`:@@guide.teacher.createBlock.dialog.title:El bloque`,
          text: $localize`:@@guide.teacher.createBlock.dialog.text:Su título, como «Tema 1: Bucles». Puedes dejarlo oculto o hacer que se abra solo un día.`,
          action: $localize`:@@guide.teacher.createBlock.dialog.action:Escribe su título y pulsa «Crear el bloque»`,
        },
        {
          anchor: A.blocksList,
          title: $localize`:@@guide.teacher.createBlock.list.title:Tus bloques`,
          text: $localize`:@@guide.teacher.createBlock.list.text:En el orden en que los verá tu alumnado. Con «Visible» decides si lo ven, y desde su menú le añades ejercicios.`,
        },
      ],
    },
    {
      id: 'add-exercise',
      doneBy: 'hasOwnExercise',
      screen: 'exercise-bank',
      title: $localize`:@@guide.teacher.addExercise.title:Añadir un ejercicio al banco`,
      summary: $localize`:@@guide.teacher.addExercise.summary:Escribir un ejercicio con su enunciado y sus pruebas.`,
      keywords: [
        $localize`:@@guide.teacher.addExercise.keywords:nuevo ejercicio crear escribir pruebas enunciado función`,
      ],
      steps: [
        {
          anchor: A.navBank,
          inSideMenu: true,
          navigates: true,
          title: $localize`:@@guide.teacher.addExercise.nav.title:Ejercicios`,
          text: $localize`:@@guide.teacher.addExercise.nav.text:El banco común de todo el profesorado está en Ejercicios.`,
          action: $localize`:@@guide.teacher.addExercise.nav.action:Pulsa «Ejercicios»`,
        },
        {
          anchor: A.bankNew,
          navigates: true,
          title: $localize`:@@guide.teacher.addExercise.new.title:Nuevo ejercicio`,
          text: $localize`:@@guide.teacher.addExercise.new.text:Antes de escribir uno, busca: quizá otro docente ya lo tiene y te basta con duplicarlo.`,
          action: $localize`:@@guide.teacher.addExercise.new.action:Pulsa «Nuevo ejercicio»`,
        },
        {
          anchor: A.formStatement,
          title: $localize`:@@guide.teacher.addExercise.statement.title:Título y enunciado`,
          text: $localize`:@@guide.teacher.addExercise.statement.text:Qué tiene que hacer la función, con ejemplos. Escribe el código entre comillas invertidas.`,
        },
        {
          anchor: A.formClassification,
          title: $localize`:@@guide.teacher.addExercise.classification.title:Dificultad y asignaturas`,
          text: $localize`:@@guide.teacher.addExercise.classification.text:Las asignaturas deciden quién lo ve en el banco.`,
        },
        {
          anchor: A.formFunction,
          title: $localize`:@@guide.teacher.addExercise.function.title:La función`,
          text: $localize`:@@guide.teacher.addExercise.function.text:Su nombre y sus parámetros, en inglés, como el código de verdad.`,
        },
        {
          anchor: A.formTests,
          title: $localize`:@@guide.teacher.addExercise.tests.title:Las pruebas`,
          text: $localize`:@@guide.teacher.addExercise.tests.text:Lo que recibe y lo que debe devolver. Deja visibles los ejemplos del enunciado y oculta los casos límite.`,
        },
        {
          anchor: A.formCheck,
          title: $localize`:@@guide.teacher.addExercise.check.title:Probar mi solución`,
          text: $localize`:@@guide.teacher.addExercise.check.text:Escribe una solución y comprueba que tus pruebas están bien antes de dárselo a tu alumnado.`,
        },
        {
          anchor: A.formSave,
          title: $localize`:@@guide.teacher.addExercise.save.title:Crear el ejercicio`,
          text: $localize`:@@guide.teacher.addExercise.save.text:Cuando esté todo, pulsa «Crear el ejercicio»: si falta algo, te dice qué. Se guarda en el banco común; si no lo quieres, archívalo o bórralo desde su menú mientras nadie lo haya empezado.`,
        },
      ],
    },
    {
      id: 'assign-exercise',
      doneBy: 'hasAssignment',
      needs: 'hasBlock',
      unavailable: NO_BLOCK,
      screen: 'blocks',
      place: 'blocks',
      title: $localize`:@@guide.teacher.assign.title:Asignar un ejercicio a un bloque`,
      summary: $localize`:@@guide.teacher.assign.summary:Llevar ejercicios del banco a un bloque de tu grupo.`,
      keywords: [
        $localize`:@@guide.teacher.assign.keywords:asignar añadir ejercicios bloque banco`,
      ],
      steps: [
        {
          anchor: A.blocksList,
          title: $localize`:@@guide.teacher.assign.list.title:Tus bloques`,
          text: $localize`:@@guide.teacher.assign.list.text:Los ejercicios se asignan a un bloque, y tu alumnado los ve en ese orden.`,
        },
        {
          anchor: A.blocksAdd,
          title: $localize`:@@guide.teacher.assign.add.title:Añadir ejercicios`,
          text: $localize`:@@guide.teacher.assign.add.text:Cada bloque tiene el suyo, al final.`,
          action: $localize`:@@guide.teacher.assign.add.action:Pulsa «Añadir ejercicios»`,
        },
        {
          anchor: A.addExercisesSave,
          inOverlay: true,
          title: $localize`:@@guide.teacher.assign.dialog.title:Elige del banco`,
          text: $localize`:@@guide.teacher.assign.dialog.text:Busca y marca los que quieras: se añaden al final del bloque. Si no hay ninguno de tu asignatura, escribe uno antes en Ejercicios.`,
          action: $localize`:@@guide.teacher.assign.dialog.action:Marca los ejercicios y pulsa «Añadir»`,
        },
        {
          anchor: A.blocksExercise,
          title: $localize`:@@guide.teacher.assign.exercise.title:Ya están asignados`,
          text: $localize`:@@guide.teacher.assign.exercise.text:Cada uno con su fecha de entrega, el ojo para ocultarlo y su menú. Si nadie lo ha empezado, «Quitar» lo saca del bloque.`,
        },
      ],
    },
    {
      id: 'follow-live',
      needs: 'hasAssignment',
      unavailable: NO_ASSIGNMENT,
      screen: 'live',
      title: $localize`:@@guide.teacher.followLive.title:Seguir la clase en vivo`,
      summary: $localize`:@@guide.teacher.followLive.summary:Ver cómo va tu grupo y quién necesita ayuda.`,
      keywords: [
        $localize`:@@guide.teacher.followLive.keywords:en vivo directo clase seguimiento atascados ayuda detalle`,
      ],
      steps: [
        {
          anchor: A.navLive,
          inSideMenu: true,
          navigates: true,
          title: $localize`:@@guide.teacher.followLive.nav.title:En vivo`,
          text: $localize`:@@guide.teacher.followLive.nav.text:Lo que hace tu grupo ahora mismo está en En vivo.`,
          action: $localize`:@@guide.teacher.followLive.nav.action:Pulsa «En vivo»`,
        },
        {
          anchor: A.liveGroup,
          title: $localize`:@@guide.teacher.followLive.group.title:Grupo y bloque`,
          text: $localize`:@@guide.teacher.followLive.group.text:Elige el grupo y, a su lado, el bloque que trabaja hoy.`,
        },
        {
          anchor: A.liveState,
          title: $localize`:@@guide.teacher.followLive.state.title:¿En directo?`,
          text: $localize`:@@guide.teacher.followLive.state.text:En directo mientras alguien trabaja; fuera de clase, lo que dejaron hecho.`,
        },
        {
          anchor: A.liveRhythm,
          optional: true,
          title: $localize`:@@guide.teacher.followLive.rhythm.title:Ritmo de la clase`,
          text: $localize`:@@guide.teacher.followLive.rhythm.text:Cuánta actividad hay minuto a minuto.`,
        },
        {
          anchor: A.liveQueue,
          optional: true,
          title: $localize`:@@guide.teacher.followLive.queue.title:Quién necesita ayuda`,
          text: $localize`:@@guide.teacher.followLive.queue.text:Quién lleva rato atascado o ha pedido muchas pistas. Cuando le ayudes, márcalo como atendido.`,
        },
        {
          anchor: A.liveClass,
          title: $localize`:@@guide.teacher.followLive.class.title:Dónde está la clase`,
          text: $localize`:@@guide.teacher.followLive.class.text:Cuántos van por cada ejercicio y cómo. Pulsa una barra para ver quiénes son.`,
        },
        {
          anchor: A.liveTabs,
          optional: true,
          title: $localize`:@@guide.teacher.followLive.tabs.title:El alumnado`,
          text: $localize`:@@guide.teacher.followLive.tabs.text:Todos, los que han empezado o los que han terminado.`,
        },
        {
          anchor: A.liveTable,
          optional: true,
          title: $localize`:@@guide.teacher.followLive.table.title:El detalle de cada uno`,
          text: $localize`:@@guide.teacher.followLive.table.text:Pulsa el nombre de un alumno para ver su código, sus pruebas y lo que le dijo el tutor.`,
        },
      ],
    },
  ];
}
