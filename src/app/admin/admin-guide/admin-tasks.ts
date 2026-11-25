import { GUIDE_ANCHORS } from '../../core/guide/guide-anchor';
import type { GuideTask } from '../../core/guide/guide-task';
import { CREATE_CLASS_TASK } from '../../teacher/teacher-guide/teacher-tasks';

const A = GUIDE_ANCHORS;

/** Its id: the welcome offers it at the end. */
export const ADD_USER_TASK = 'add-user';

/**
 * The first steps of the administration, in their order (ficha 13): those of the account of the
 * examining board, which shows it the application. Creating the class is the teacher's task, with
 * its id: done once.
 */
export const ADMIN_FIRST_STEPS = [ADD_USER_TASK, CREATE_CLASS_TASK, 'test-provider', 'follow-live'];

/**
 * The first steps of the administration that are its own (2.12, ficha 13): each one that creates
 * something, or spends something, says so before. They are done by finishing them (D-096).
 */
export function adminFirstSteps(): readonly GuideTask[] {
  return [
    {
      id: ADD_USER_TASK,
      screen: 'users',
      place: 'users',
      title: $localize`:@@guide.admin.addUser.title:Dar de alta un usuario`,
      summary: $localize`:@@guide.admin.addUser.summary:Una cuenta de alumno, docente o administración.`,
      keywords: [
        $localize`:@@guide.admin.addUser.keywords:alta nuevo usuario cuenta crear alumno docente`,
      ],
      steps: [
        {
          anchor: A.usersNew,
          title: $localize`:@@guide.admin.addUser.new.title:Nuevo usuario`,
          text: $localize`:@@guide.admin.addUser.new.text:Vas a crear una cuenta de verdad. Una cuenta no se borra: si sobra, desactívala desde su menú «⋮».`,
          action: $localize`:@@guide.admin.addUser.new.action:Pulsa «Nuevo usuario»`,
        },
        {
          anchor: A.userDialogSave,
          inOverlay: true,
          savesDialog: true,
          title: $localize`:@@guide.admin.addUser.dialog.title:La cuenta`,
          text: $localize`:@@guide.admin.addUser.dialog.text:Su nombre, su correo y su rol. La contraseña la generas aquí y la entregas en persona: la aplicación no envía correos.`,
          action: $localize`:@@guide.admin.addUser.dialog.action:Rellénala y pulsa «Crear la cuenta»`,
        },
        {
          anchor: A.usersTable,
          title: $localize`:@@guide.admin.addUser.table.title:Ya puede entrar`,
          text: $localize`:@@guide.admin.addUser.table.text:Está en la lista, activa. Desde su menú «⋮» la editas, le das otra contraseña o la desactivas. Un alumno entra en una clase cuando su docente lo matricula.`,
        },
      ],
    },
    {
      id: 'test-provider',
      screen: 'system',
      place: 'system',
      title: $localize`:@@guide.admin.testProvider.title:Probar el proveedor de IA`,
      summary: $localize`:@@guide.admin.testProvider.summary:Que el tutor responde, con el modelo que tiene.`,
      keywords: [
        $localize`:@@guide.admin.testProvider.keywords:probar conexión ia proveedor modelo tutor clave`,
      ],
      steps: [
        {
          anchor: A.systemModel,
          title: $localize`:@@guide.admin.testProvider.model.title:El modelo`,
          text: $localize`:@@guide.admin.testProvider.model.text:El que responde como tutor y traduce los ejercicios, y cuánto se le espera.`,
        },
        {
          anchor: A.systemCheck,
          title: $localize`:@@guide.admin.testProvider.check.title:Probar la conexión`,
          text: $localize`:@@guide.admin.testProvider.check.text:Pregunta al principal y a cada respaldo si responden. Gasta una llamada a cada uno.`,
          action: $localize`:@@guide.admin.testProvider.check.action:Pulsa «Probar la conexión»`,
        },
        {
          anchor: A.systemResults,
          title: $localize`:@@guide.admin.testProvider.results.title:El resultado`,
          text: $localize`:@@guide.admin.testProvider.results.text:Cada modelo, con su respuesta o con su error explicado. Si cambias algo, pruébalo antes de guardar.`,
        },
      ],
    },
  ];
}

/** «¿Cómo se hace…?» of the administration (7.0b2): short, and never creating anything. */
export function adminHowTos(): readonly GuideTask[] {
  return [
    {
      id: 'add-students',
      screen: 'users',
      place: 'users',
      title: $localize`:@@guide.admin.addStudents.title:Dar de alta a varios alumnos a la vez`,
      summary: $localize`:@@guide.admin.addStudents.summary:Con la lista de secretaría.`,
      keywords: [
        $localize`:@@guide.admin.addStudents.keywords:alta varios lista secretaría excel pegar alumnos`,
      ],
      steps: [
        {
          anchor: A.usersNewStudents,
          title: $localize`:@@guide.admin.addStudents.button.title:Alta de varios`,
          text: $localize`:@@guide.admin.addStudents.button.text:Pega la lista tal como sale de la hoja de cálculo y revísala antes de crear nada. Al terminar, te da sus contraseñas para entregarlas.`,
          action: $localize`:@@guide.admin.addStudents.button.action:Pulsa «Alta de varios…»`,
        },
      ],
    },
    {
      id: 'reset-password',
      screen: 'users',
      place: 'users',
      title: $localize`:@@guide.admin.password.title:Dar otra contraseña a una cuenta`,
      summary: $localize`:@@guide.admin.password.summary:A quien la ha olvidado.`,
      keywords: [
        $localize`:@@guide.admin.password.keywords:contraseña olvidada restablecer cambiar clave`,
      ],
      steps: [
        {
          anchor: A.usersMenu,
          title: $localize`:@@guide.admin.password.menu.title:El menú de la cuenta`,
          text: $localize`:@@guide.admin.password.menu.text:Cada cuenta tiene el suyo, al final de su fila.`,
          action: $localize`:@@guide.admin.password.menu.action:Abre el menú «⋮» de una cuenta`,
        },
        {
          anchor: A.usersPassword,
          inOverlay: true,
          title: $localize`:@@guide.admin.password.reset.title:Restablecer la contraseña`,
          text: $localize`:@@guide.admin.password.reset.text:La generas y se la das en persona: la aplicación no envía correos.`,
          action: $localize`:@@guide.admin.password.reset.action:Pulsa «Restablecer la contraseña»`,
        },
      ],
    },
    {
      id: 'edit-user',
      screen: 'users',
      place: 'users',
      title: $localize`:@@guide.admin.editUser.title:Cambiar el nombre, el correo o el rol`,
      summary: $localize`:@@guide.admin.editUser.summary:De una cuenta que ya existe.`,
      keywords: [
        $localize`:@@guide.admin.editUser.keywords:editar rol correo nombre cuenta docente`,
      ],
      steps: [
        {
          anchor: A.usersMenu,
          title: $localize`:@@guide.admin.editUser.menu.title:El menú de la cuenta`,
          text: $localize`:@@guide.admin.editUser.menu.text:Cada cuenta tiene el suyo, al final de su fila.`,
          action: $localize`:@@guide.admin.editUser.menu.action:Abre el menú «⋮» de una cuenta`,
        },
        {
          anchor: A.usersEdit,
          inOverlay: true,
          title: $localize`:@@guide.admin.editUser.edit.title:Editar`,
          text: $localize`:@@guide.admin.editUser.edit.text:Si la cuenta ya tiene trabajo o clases, su rol no cambia, y el diálogo te dice por qué.`,
          action: $localize`:@@guide.admin.editUser.edit.action:Pulsa «Editar»`,
        },
      ],
    },
    {
      id: 'disable-user',
      screen: 'users',
      place: 'users',
      title: $localize`:@@guide.admin.disable.title:Desactivar o activar una cuenta`,
      summary: $localize`:@@guide.admin.disable.summary:Una cuenta no se borra: se desactiva.`,
      keywords: [
        $localize`:@@guide.admin.disable.keywords:desactivar activar borrar eliminar baja cuenta`,
      ],
      steps: [
        {
          anchor: A.usersMenu,
          title: $localize`:@@guide.admin.disable.menu.title:El menú de la cuenta`,
          text: $localize`:@@guide.admin.disable.menu.text:Cada cuenta tiene el suyo, al final de su fila. La tuya no se puede desactivar.`,
          action: $localize`:@@guide.admin.disable.menu.action:Abre el menú «⋮» de una cuenta`,
        },
        {
          anchor: A.usersDisable,
          inOverlay: true,
          title: $localize`:@@guide.admin.disable.item.title:Desactivar`,
          text: $localize`:@@guide.admin.disable.item.text:Deja de poder entrar, y su trabajo se conserva. Te pide confirmación, y desde el mismo menú se vuelve a activar: «Estado» muestra las desactivadas.`,
          action: $localize`:@@guide.admin.disable.item.action:Pulsa «Desactivar» o «Activar»`,
        },
      ],
    },
    {
      id: 'finished-students',
      screen: 'users',
      place: 'users',
      title: $localize`:@@guide.admin.finished.title:Desactivar a quien ya terminó`,
      summary: $localize`:@@guide.admin.finished.summary:Tras la evaluación final de sus docentes.`,
      keywords: [
        $localize`:@@guide.admin.finished.keywords:titulados baja fin de curso desactivar evaluación final`,
      ],
      steps: [
        {
          anchor: A.usersFinished,
          optional: true,
          title: $localize`:@@guide.admin.finished.notice.title:Siguen con la cuenta activa`,
          text: $localize`:@@guide.admin.finished.notice.text:Los que han titulado o dejado los estudios según sus docentes. «Revisar y desactivar…» los desactiva de una vez, tras revisarlos.`,
        },
        {
          anchor: A.usersSituation,
          title: $localize`:@@guide.admin.finished.situation.title:Situación del alumnado`,
          text: $localize`:@@guide.admin.finished.situation.text:Para verlos cuando quieras: «Titulados o de baja». Aparecen cuando sus docentes ponen la evaluación final.`,
        },
      ],
    },
    {
      id: 'trajectory',
      screen: 'users',
      place: 'users',
      title: $localize`:@@guide.admin.trajectory.title:Ver la trayectoria de un alumno`,
      summary: $localize`:@@guide.admin.trajectory.summary:Sus clases de cada curso y cómo acabó.`,
      keywords: [
        $localize`:@@guide.admin.trajectory.keywords:trayectoria historial clases cursos alumno`,
      ],
      steps: [
        {
          anchor: A.usersMenu,
          title: $localize`:@@guide.admin.trajectory.menu.title:El menú de la cuenta`,
          text: $localize`:@@guide.admin.trajectory.menu.text:El de alguien con clases: los demás no tienen trayectoria.`,
          action: $localize`:@@guide.admin.trajectory.menu.action:Abre el menú «⋮» de una cuenta`,
        },
        {
          anchor: A.usersTrajectory,
          inOverlay: true,
          title: $localize`:@@guide.admin.trajectory.item.title:Ver su trayectoria`,
          text: $localize`:@@guide.admin.trajectory.item.text:Cada curso, su clase y su evaluación final.`,
          action: $localize`:@@guide.admin.trajectory.item.action:Pulsa «Ver su trayectoria»`,
        },
      ],
    },
    {
      id: 'change-provider',
      screen: 'system',
      place: 'system',
      title: $localize`:@@guide.admin.provider.title:Cambiar el proveedor o el modelo de IA`,
      summary: $localize`:@@guide.admin.provider.summary:Probándolo antes de guardar.`,
      keywords: [
        $localize`:@@guide.admin.provider.keywords:proveedor modelo ia cambiar clave secreto openai gemini`,
      ],
      steps: [
        {
          anchor: A.systemPreset,
          title: $localize`:@@guide.admin.provider.preset.title:Proveedor`,
          text: $localize`:@@guide.admin.provider.preset.text:Su dirección y su formato vienen solos; «Otro», para uno compatible que no esté en la lista.`,
        },
        {
          anchor: A.systemModel,
          title: $localize`:@@guide.admin.provider.model.title:Modelo principal`,
          text: $localize`:@@guide.admin.provider.model.text:Su nombre exacto en el proveedor, y cuántos segundos se le espera.`,
        },
        {
          anchor: A.systemKeySecret,
          title: $localize`:@@guide.admin.provider.secret.title:La clave`,
          text: $localize`:@@guide.admin.provider.secret.text:No se escribe aquí: vive en los secretos del servidor, con este nombre.`,
        },
        {
          anchor: A.systemCheck,
          title: $localize`:@@guide.admin.provider.check.title:Probar antes de guardar`,
          text: $localize`:@@guide.admin.provider.check.text:Gasta una llamada a cada modelo. Si el principal no responde, no se guarda: sigue el anterior.`,
        },
        {
          anchor: A.systemSave,
          title: $localize`:@@guide.admin.provider.save.title:Guardar`,
          text: $localize`:@@guide.admin.provider.save.text:Vale desde la siguiente petición al tutor, sin reiniciar nada.`,
        },
      ],
    },
    {
      id: 'fallback-model',
      screen: 'system',
      place: 'system',
      title: $localize`:@@guide.admin.fallback.title:Añadir un modelo de respaldo`,
      summary: $localize`:@@guide.admin.fallback.summary:Para cuando el principal no responde.`,
      keywords: [
        $localize`:@@guide.admin.fallback.keywords:respaldo alternativo caída cuota modelo proveedor`,
      ],
      steps: [
        {
          anchor: A.systemFallbacks,
          title: $localize`:@@guide.admin.fallback.list.title:Modelos de respaldo`,
          text: $localize`:@@guide.admin.fallback.list.text:Si el principal falla, se prueban en este orden. Mejor uno de otro proveedor: protege también de una caída o de la cuota agotada.`,
        },
        {
          anchor: A.systemAddFallback,
          title: $localize`:@@guide.admin.fallback.add.title:Añadir un respaldo`,
          text: $localize`:@@guide.admin.fallback.add.text:Elige su proveedor y su modelo. Las flechas cambian su orden.`,
        },
        {
          anchor: A.systemCheck,
          title: $localize`:@@guide.admin.fallback.check.title:Probar y guardar`,
          text: $localize`:@@guide.admin.fallback.check.text:Como al cambiar el principal: primero la prueba, que gasta una llamada a cada uno, y después «Guardar».`,
        },
      ],
    },
    {
      id: 'subjects',
      screen: 'system',
      place: 'system',
      title: $localize`:@@guide.admin.subjects.title:Crear o traducir una asignatura`,
      summary: $localize`:@@guide.admin.subjects.summary:Las que los docentes eligen para sus clases.`,
      keywords: [
        $localize`:@@guide.admin.subjects.keywords:asignatura módulo nueva traducir nombre idioma`,
      ],
      steps: [
        {
          anchor: A.systemSubjects,
          title: $localize`:@@guide.admin.subjects.list.title:Asignaturas`,
          text: $localize`:@@guide.admin.subjects.list.text:Cada grupo es una asignatura de una clase: los docentes eligen aquí las suyas.`,
        },
        {
          anchor: A.systemNewSubject,
          title: $localize`:@@guide.admin.subjects.new.title:Nueva asignatura`,
          text: $localize`:@@guide.admin.subjects.new.text:Su nombre en el idioma en que lo escribes.`,
        },
        {
          anchor: A.systemEditSubject,
          title: $localize`:@@guide.admin.subjects.edit.title:Editar`,
          text: $localize`:@@guide.admin.subjects.edit.text:Su nombre en los otros idiomas: sin traducción, se ve el original.`,
        },
      ],
    },
  ];
}
