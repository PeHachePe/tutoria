import { EnvironmentInjector, inject } from '@angular/core';

import { AuthStore } from '../../auth/auth-store';
import { GUIDE_ANCHORS } from '../../core/guide/guide-anchor';
import type {
  GuideBeacon,
  GuideProfile,
  GuideSideMenu,
  GuideTask,
  GuideWelcome,
} from '../../core/guide/guide-task';
import { WELCOME_VERSIONS } from '../../core/guide/welcome-versions';
import {
  beaconSteps,
  staffBarSteps,
  staffHello,
  teacherDataLoader,
  teacherTours,
  teachingNavSteps,
} from '../../teacher/teacher-guide/teacher-guide';
import { teacherHowTos } from '../../teacher/teacher-guide/teacher-how-tos';
import { teacherFirstSteps } from '../../teacher/teacher-guide/teacher-tasks';
import { adminBeacons } from './admin-beacons';
import { adminFacts, adminScreen } from './admin-facts';
import { ADMIN_FIRST_STEPS, adminFirstSteps, adminHowTos } from './admin-tasks';

const A = GUIDE_ANCHORS;

/**
 * The welcome of the administration (ficha 13), in Usuarios: the bar and the side menu as the
 * teacher's, then the whole menu in its order: the section «Docencia» and each of its entries, its
 * two screens and the showcase, so it is not taken for a fault; and where to go on, which offers
 * «Dar de alta un usuario».
 */
export function adminWelcome(firstName: string): GuideWelcome {
  return {
    version: WELCOME_VERSIONS.admin,
    screen: 'users',
    place: 'users',
    steps: [
      staffHello(firstName),
      ...staffBarSteps(),
      {
        anchor: A.navTeaching,
        inSideMenu: true,
        title: $localize`:@@guide.admin.welcome.teaching.title:Docencia`,
        text: $localize`:@@guide.admin.welcome.teaching.text:Todas las pantallas del docente, con todos los grupos del centro: puedes preparar una clase o seguirla en vivo como cualquier docente.`,
      },
      ...teachingNavSteps(),
      {
        anchor: A.navUsers,
        inSideMenu: true,
        title: $localize`:@@guide.admin.welcome.users.title:Usuarios`,
        text: $localize`:@@guide.admin.welcome.users.text:Las cuentas del centro: altas, roles, contraseñas y quién ya terminó. Estás aquí.`,
      },
      {
        anchor: A.navSystem,
        inSideMenu: true,
        title: $localize`:@@guide.admin.welcome.system.title:Sistema`,
        text: $localize`:@@guide.admin.welcome.system.text:El proveedor de IA que hace de tutor y las asignaturas.`,
      },
      {
        anchor: A.navShowcase,
        inSideMenu: true,
        title: $localize`:@@guide.admin.welcome.showcase.title:Muestrario`,
        text: $localize`:@@guide.admin.welcome.showcase.text:Cada pieza de la aplicación en todos sus estados, para revisarlas. Es una página de trabajo, no un fallo.`,
      },
      {
        title: $localize`:@@guide.admin.welcome.next.title:Por dónde seguir`,
        text: $localize`:@@guide.admin.welcome.next.text:Tus primeros pasos te enseñan lo principal de la aplicación con datos de verdad. Están siempre en «Ayuda».`,
      },
    ],
  };
}

/** «Recorrer esta pantalla» of its two screens; the bar and the side menu go with Usuarios. */
export function adminTours(beacons: readonly GuideBeacon[]): readonly GuideTask[] {
  const keywords = [
    $localize`:@@guide.teacher.tour.keywords:conocer recorrer pantalla todo piezas`,
  ];
  return [
    {
      id: 'tour-users',
      tourOf: 'users',
      screen: 'users',
      place: 'users',
      title: $localize`:@@guide.admin.tour.users.title:Conocer Usuarios`,
      summary: $localize`:@@guide.admin.tour.users.summary:Cada pieza de Usuarios, de la barra y del menú.`,
      keywords,
      steps: beaconSteps([
        ...beacons.filter((beacon) => beacon.screen === 'users'),
        ...beacons.filter((beacon) => !beacon.screen),
      ]),
    },
    {
      id: 'tour-system',
      tourOf: 'system',
      screen: 'system',
      place: 'system',
      title: $localize`:@@guide.admin.tour.system.title:Conocer Sistema`,
      summary: $localize`:@@guide.admin.tour.system.summary:El proveedor de IA y las asignaturas, pieza a pieza.`,
      keywords,
      steps: beaconSteps(beacons.filter((beacon) => beacon.screen === 'system')),
    },
  ];
}

/**
 * The guided help of the administration (2.12, ficha 13, D-096): its welcome, its first steps
 * (those of the examining board), its own tasks and tours and every one of the teacher, whose
 * screens it uses with every group. Its tasks are done only by finishing them. The same profile on
 * every screen of the staff: crossing to those of the teacher keeps it.
 */
export function adminGuide(sideMenu: GuideSideMenu): GuideProfile {
  const auth = inject(AuthStore);
  const loadData = teacherDataLoader();
  const beacons = adminBeacons();
  const teacherTasks = [
    ...teacherFirstSteps('admin'),
    ...teacherHowTos(),
    ...teacherTours(beacons, false),
  ].map((task): GuideTask => ({ ...task, doneBy: undefined }));

  return {
    id: 'admin',
    tasks: [...adminFirstSteps(), ...adminHowTos(), ...adminTours(beacons), ...teacherTasks],
    firstSteps: ADMIN_FIRST_STEPS,
    welcome: adminWelcome(auth.user()?.name.split(' ')[0] ?? ''),
    beacons,
    screenOf: adminScreen,
    sideMenu,
    injector: inject(EnvironmentInjector),
    loadFacts: async () => adminFacts(await loadData()),
  };
}
