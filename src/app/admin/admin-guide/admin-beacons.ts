import { GUIDE_ANCHORS } from '../../core/guide/guide-anchor';
import type { GuideBeacon } from '../../core/guide/guide-task';
import { teacherBeacons } from '../../teacher/teacher-guide/teacher-beacons';

const A = GUIDE_ANCHORS;

/**
 * Every piece of every screen of the administration, in reading order (2.12, ficha 13): the bar
 * and the side menu of the staff, with its own entries after those of the teacher; its two
 * screens; and every screen of the teacher, which it also uses.
 */
export function adminBeacons(): readonly GuideBeacon[] {
  const teacher = teacherBeacons();
  const bars = teacher
    .filter((beacon) => !beacon.screen)
    .map((beacon) => (beacon.anchor === A.brand ? BRAND : beacon));
  return [...bars, ...NAV, ...USERS, ...SYSTEM, ...teacher.filter((beacon) => beacon.screen)];
}

const BRAND: GuideBeacon = {
  anchor: A.brand,
  title: $localize`:@@guide.admin.beacon.brand.title:TutorIA`,
  text: $localize`:@@guide.admin.beacon.brand.text:Desde cualquier pantalla, te lleva a Usuarios.`,
};

const NAV: readonly GuideBeacon[] = [
  {
    anchor: A.navUsers,
    inSideMenu: true,
    title: $localize`:@@guide.admin.beacon.navUsers.title:Usuarios`,
    text: $localize`:@@guide.admin.beacon.navUsers.text:Las cuentas del centro: altas, roles, contraseñas y quién ya terminó.`,
  },
  {
    anchor: A.navSystem,
    inSideMenu: true,
    title: $localize`:@@guide.admin.beacon.navSystem.title:Sistema`,
    text: $localize`:@@guide.admin.beacon.navSystem.text:El proveedor de IA que hace de tutor y las asignaturas.`,
  },
  {
    anchor: A.navShowcase,
    inSideMenu: true,
    title: $localize`:@@guide.admin.beacon.navShowcase.title:Muestrario`,
    text: $localize`:@@guide.admin.beacon.navShowcase.text:Cada pieza de la aplicación en todos sus estados, para revisarlas. Es una página de trabajo, no un fallo.`,
  },
];

const USERS: readonly GuideBeacon[] = [
  {
    screen: 'users',
    anchor: A.usersNewStudents,
    title: $localize`:@@guide.admin.beacon.usersNewStudents.title:Alta de varios`,
    text: $localize`:@@guide.admin.beacon.usersNewStudents.text:Muchos alumnos a la vez, pegando la lista de secretaría. La revisas antes de crear nada.`,
  },
  {
    screen: 'users',
    anchor: A.usersNew,
    title: $localize`:@@guide.admin.beacon.usersNew.title:Nuevo usuario`,
    text: $localize`:@@guide.admin.beacon.usersNew.text:Una cuenta de alumno, docente o administración, con su contraseña.`,
  },
  {
    screen: 'users',
    anchor: A.usersFinished,
    title: $localize`:@@guide.admin.beacon.usersFinished.title:Quién ya terminó`,
    text: $localize`:@@guide.admin.beacon.usersFinished.text:Titulados o de baja según la evaluación final de sus docentes que siguen con la cuenta activa.`,
  },
  {
    screen: 'users',
    anchor: A.usersSearch,
    title: $localize`:@@guide.admin.beacon.usersSearch.title:Buscar`,
    text: $localize`:@@guide.admin.beacon.usersSearch.text:Por nombre o correo, sin preocuparte de las tildes.`,
  },
  {
    screen: 'users',
    anchor: A.usersRole,
    title: $localize`:@@guide.admin.beacon.usersRole.title:Rol`,
    text: $localize`:@@guide.admin.beacon.usersRole.text:Alumnado, docentes o administración.`,
  },
  {
    screen: 'users',
    anchor: A.usersStatus,
    title: $localize`:@@guide.admin.beacon.usersStatus.title:Estado`,
    text: $localize`:@@guide.admin.beacon.usersStatus.text:Las activas, las desactivadas o todas. Una cuenta no se borra: se desactiva.`,
  },
  {
    screen: 'users',
    anchor: A.usersSituation,
    title: $localize`:@@guide.admin.beacon.usersSituation.title:Situación del alumnado`,
    text: $localize`:@@guide.admin.beacon.usersSituation.text:En una clase este curso, sin clase o titulados y de baja.`,
  },
  {
    screen: 'users',
    anchor: A.usersCount,
    title: $localize`:@@guide.admin.beacon.usersCount.title:Cuántas`,
    text: $localize`:@@guide.admin.beacon.usersCount.text:Las cuentas que se ven con estos filtros, de todas las del centro.`,
  },
  {
    screen: 'users',
    anchor: A.usersTable,
    title: $localize`:@@guide.admin.beacon.usersTable.title:Las cuentas`,
    text: $localize`:@@guide.admin.beacon.usersTable.text:Su nombre, su correo, su rol y sus grupos. Pulsa una cabecera para ordenar.`,
  },
  {
    screen: 'users',
    anchor: A.usersMenu,
    title: $localize`:@@guide.admin.beacon.usersMenu.title:El menú de cada cuenta`,
    text: $localize`:@@guide.admin.beacon.usersMenu.text:Editarla, darle otra contraseña, ver su trayectoria si tiene clases, y desactivarla o activarla.`,
  },
];

const SYSTEM: readonly GuideBeacon[] = [
  {
    screen: 'system',
    anchor: A.systemPreset,
    title: $localize`:@@guide.admin.beacon.systemPreset.title:Proveedor`,
    text: $localize`:@@guide.admin.beacon.systemPreset.text:De dónde viene el modelo de IA: su dirección y su formato vienen solos.`,
  },
  {
    screen: 'system',
    anchor: A.systemModel,
    title: $localize`:@@guide.admin.beacon.systemModel.title:Modelo principal`,
    text: $localize`:@@guide.admin.beacon.systemModel.text:El que responde como tutor y traduce los ejercicios, y cuánto se le espera.`,
  },
  {
    screen: 'system',
    anchor: A.systemKeySecret,
    title: $localize`:@@guide.admin.beacon.systemKeySecret.title:La clave`,
    text: $localize`:@@guide.admin.beacon.systemKeySecret.text:Solo el nombre del secreto: la clave vive en el servidor y nunca llega al navegador.`,
  },
  {
    screen: 'system',
    anchor: A.systemFallbacks,
    title: $localize`:@@guide.admin.beacon.systemFallbacks.title:Respaldos`,
    text: $localize`:@@guide.admin.beacon.systemFallbacks.text:Si el principal falla, se prueban en este orden.`,
  },
  {
    screen: 'system',
    anchor: A.systemAddFallback,
    title: $localize`:@@guide.admin.beacon.systemAddFallback.title:Añadir un respaldo`,
    text: $localize`:@@guide.admin.beacon.systemAddFallback.text:Mejor de otro proveedor: protege también de una caída o de la cuota agotada.`,
  },
  {
    screen: 'system',
    anchor: A.systemCheck,
    title: $localize`:@@guide.admin.beacon.systemCheck.title:Probar la conexión`,
    text: $localize`:@@guide.admin.beacon.systemCheck.text:Pregunta a cada modelo si responde. Gasta una llamada a cada uno.`,
  },
  {
    screen: 'system',
    anchor: A.systemSave,
    title: $localize`:@@guide.admin.beacon.systemSave.title:Guardar`,
    text: $localize`:@@guide.admin.beacon.systemSave.text:Después de probar, y solo si el principal responde. Vale desde la siguiente petición.`,
  },
  {
    screen: 'system',
    anchor: A.systemResults,
    title: $localize`:@@guide.admin.beacon.systemResults.title:El resultado`,
    text: $localize`:@@guide.admin.beacon.systemResults.text:Cada modelo, con su respuesta o con su error explicado.`,
  },
  {
    screen: 'system',
    anchor: A.systemSubjects,
    title: $localize`:@@guide.admin.beacon.systemSubjects.title:Asignaturas`,
    text: $localize`:@@guide.admin.beacon.systemSubjects.text:Las que los docentes eligen para sus clases, con su nombre en cada idioma.`,
  },
  {
    screen: 'system',
    anchor: A.systemNewSubject,
    title: $localize`:@@guide.admin.beacon.systemNewSubject.title:Nueva asignatura`,
    text: $localize`:@@guide.admin.beacon.systemNewSubject.text:Con su nombre en el idioma en que lo escribes.`,
  },
  {
    screen: 'system',
    anchor: A.systemEditSubject,
    title: $localize`:@@guide.admin.beacon.systemEditSubject.title:Editar`,
    text: $localize`:@@guide.admin.beacon.systemEditSubject.text:Su nombre y sus traducciones: sin ellas, se ve el original.`,
  },
];
