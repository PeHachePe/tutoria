import { EnvironmentInjector, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthStore } from '../../auth/auth-store';
import { GUIDE_ANCHORS } from '../../core/guide/guide-anchor';
import type {
  GuideBeacon,
  GuidePlace,
  GuideProfile,
  GuideScreen,
  GuideSideMenu,
  GuideStep,
  GuideTask,
  GuideWelcome,
} from '../../core/guide/guide-task';
import { WELCOME_VERSIONS } from '../../core/guide/welcome-versions';
import { BlockService } from '../../data/block-service';
import { ExerciseService } from '../../data/exercise-service';
import { GroupService } from '../../data/group-service';
import { teacherBeacons } from './teacher-beacons';
import { type TeacherData, teacherFacts, teacherScreen } from './teacher-facts';
import { teacherHowTos } from './teacher-how-tos';
import { NO_ATTEMPT, TEACHER_FIRST_STEPS, teacherFirstSteps } from './teacher-tasks';

const A = GUIDE_ANCHORS;

/** The screens of the teacher, the only ones their tours go through. */
type TeacherScreen = Extract<
  GuideScreen,
  'live' | 'attempt' | 'exercise-bank' | 'exercise-form' | 'blocks' | 'groups' | 'history'
>;

/** Where the tour of each screen starts. */
const SCREEN_PLACES: Readonly<Record<TeacherScreen, GuidePlace>> = {
  live: 'live',
  attempt: 'attempt',
  'exercise-bank': 'exercises',
  'exercise-form': 'newExercise',
  blocks: 'blocks',
  groups: 'groups',
  history: 'history',
};

/**
 * The steps of a tour of a screen, made of its beacons and with their texts: on phones the side
 * menu is closed, so only its entries open it; the other pieces that do not show are skipped.
 */
export function beaconSteps(beacons: readonly GuideBeacon[]): GuideStep[] {
  return beacons.map(({ anchor, title, text, inSideMenu }) => ({
    anchor,
    title,
    text,
    inSideMenu,
    optional: !inSideMenu,
  }));
}

/**
 * «Recorrer esta pantalla»: every piece of a screen, in the order of its beacons and with the same
 * texts; those of the bar and the side menu go with the live session, the home of the area, unless
 * `withBars` is false (the administration takes them to its own home).
 */
export function teacherTours(
  beacons: readonly GuideBeacon[],
  withBars = true,
): readonly GuideTask[] {
  const stepsOf = (screen: TeacherScreen): GuideStep[] => {
    const own = beacons.filter((beacon) => beacon.screen === screen);
    const bars = screen === 'live' && withBars ? beacons.filter((beacon) => !beacon.screen) : [];
    return beaconSteps([...own, ...bars]);
  };
  const tour = (
    screen: TeacherScreen,
    title: string,
    summary: string,
    unavailable?: string,
  ): GuideTask => ({
    id: `tour-${screen}`,
    tourOf: screen,
    screen,
    place: SCREEN_PLACES[screen],
    title,
    summary,
    keywords: [$localize`:@@guide.teacher.tour.keywords:conocer recorrer pantalla todo piezas`],
    unavailable,
    steps: stepsOf(screen),
  });
  return [
    tour(
      'live',
      $localize`:@@guide.teacher.tour.live.title:Conocer la sesión en vivo`,
      withBars
        ? $localize`:@@guide.teacher.tour.live.summary:Cada pieza de la sesión en vivo, de la barra y del menú.`
        : $localize`:@@guide.admin.tour.live.summary:Cada pieza de la sesión en vivo.`,
    ),
    tour(
      'attempt',
      $localize`:@@guide.teacher.tour.attempt.title:Conocer el detalle de un intento`,
      $localize`:@@guide.teacher.tour.attempt.summary:Lo que hizo un alumno en un ejercicio, paso a paso.`,
      NO_ATTEMPT,
    ),
    tour(
      'exercise-bank',
      $localize`:@@guide.teacher.tour.bank.title:Conocer el banco de ejercicios`,
      $localize`:@@guide.teacher.tour.bank.summary:Buscar, filtrar y las acciones de cada ejercicio.`,
    ),
    tour(
      'exercise-form',
      $localize`:@@guide.teacher.tour.form.title:Conocer el formulario de un ejercicio`,
      $localize`:@@guide.teacher.tour.form.summary:El enunciado, la función, las pruebas y cómo comprobarlas.`,
    ),
    tour(
      'blocks',
      $localize`:@@guide.teacher.tour.blocks.title:Conocer los bloques`,
      $localize`:@@guide.teacher.tour.blocks.summary:Los temas de un grupo y sus ejercicios, pieza a pieza.`,
    ),
    tour(
      'groups',
      $localize`:@@guide.teacher.tour.groups.title:Conocer los grupos`,
      $localize`:@@guide.teacher.tour.groups.summary:Tus clases, sus asignaturas y su alumnado.`,
    ),
    tour(
      'history',
      $localize`:@@guide.teacher.tour.history.title:Conocer el histórico`,
      $localize`:@@guide.teacher.tour.history.summary:Cómo evoluciona un grupo, bloque a bloque.`,
    ),
  ];
}

/** The first globe of a welcome of the staff, in the middle: who the tutor is. */
export function staffHello(firstName: string): GuideStep {
  return {
    title: firstName
      ? $localize`:@@guide.teacher.welcome.hello.title:¡Hola, ${firstName}:name:!`
      : $localize`:@@guide.teacher.welcome.hello.anonymous:¡Hola!`,
    text: $localize`:@@guide.teacher.welcome.hello.text:Soy el tutor de TutorIA. Te enseño en un momento dónde está cada cosa; puedes saltarlo cuando quieras.`,
  };
}

/** The bar of the staff, together and in its order, and then the side menu. */
export function staffBarSteps(): readonly GuideStep[] {
  return [
    {
      anchor: A.help,
      title: $localize`:@@guide.teacher.welcome.help.title:La ayuda`,
      text: $localize`:@@guide.teacher.welcome.help.text:Aquí la tienes siempre: tus primeros pasos, el recorrido de cada pantalla y la explicación de cada pieza.`,
    },
    {
      anchor: A.themeMenu,
      interactive: true,
      title: $localize`:@@guide.teacher.welcome.theme.title:Claro u oscuro`,
      text: $localize`:@@guide.teacher.welcome.theme.text:El tema: claro, oscuro o el de tu sistema. Pruébalo ahora si quieres.`,
    },
    {
      anchor: A.languageMenu,
      interactive: true,
      title: $localize`:@@guide.teacher.welcome.language.title:Tu idioma`,
      text: $localize`:@@guide.teacher.welcome.language.text:Español, català o English. Si prefieres otro, elígelo ahora y seguimos en él.`,
    },
    {
      anchor: A.userMenu,
      title: $localize`:@@guide.teacher.welcome.menu.title:Tu menú`,
      text: $localize`:@@guide.teacher.welcome.menu.text:Con qué cuenta has entrado y «Cerrar sesión».`,
    },
    {
      anchor: A.sideMenu,
      inSideMenu: true,
      title: $localize`:@@guide.teacher.welcome.sideMenu.title:Tus pantallas`,
      text: $localize`:@@guide.teacher.welcome.sideMenu.text:Todo lo que haces está en este menú. El botón de arriba a la izquierda lo pliega a sus iconos o, en el móvil, lo abre.`,
    },
  ];
}

/** Every entry of the section «Docencia» of the side menu, in its order (7.0b2). */
export function teachingNavSteps(): readonly GuideStep[] {
  return [
    {
      anchor: A.navLive,
      inSideMenu: true,
      title: $localize`:@@guide.teacher.welcome.live.title:En vivo`,
      text: $localize`:@@guide.teacher.welcome.live.text:Cómo va tu grupo mientras trabaja, ejercicio a ejercicio, y quién necesita ayuda.`,
    },
    {
      anchor: A.navHistory,
      inSideMenu: true,
      title: $localize`:@@guide.teacher.welcome.history.title:Histórico`,
      text: $localize`:@@guide.teacher.welcome.history.text:Cómo evoluciona cada grupo, bloque a bloque, también de cursos anteriores.`,
    },
    {
      anchor: A.navBank,
      inSideMenu: true,
      title: $localize`:@@guide.teacher.welcome.bank.title:Ejercicios`,
      text: $localize`:@@guide.teacher.welcome.bank.text:El banco común del profesorado, con sus pruebas automáticas.`,
    },
    {
      anchor: A.navBlocks,
      inSideMenu: true,
      title: $localize`:@@guide.teacher.welcome.blocks.title:Bloques`,
      text: $localize`:@@guide.teacher.welcome.blocks.text:Los temas de cada grupo y los ejercicios que les asignas, en el orden en que los verá el alumnado.`,
    },
    {
      anchor: A.navGroups,
      inSideMenu: true,
      title: $localize`:@@guide.teacher.welcome.groups.title:Grupos`,
      text: $localize`:@@guide.teacher.welcome.groups.text:Las clases, sus asignaturas y su alumnado: aquí se crean y se matricula.`,
    },
  ];
}

/**
 * The welcome of the teacher (ficha 13): the bar together and in its order, the side menu and
 * every one of its entries, and where to go on, which offers the first step pending.
 */
export function teacherWelcome(firstName: string): GuideWelcome {
  return {
    version: WELCOME_VERSIONS.teacher,
    screen: 'live',
    place: 'live',
    steps: [
      staffHello(firstName),
      ...staffBarSteps(),
      ...teachingNavSteps(),
      {
        title: $localize`:@@guide.teacher.welcome.next.title:Por dónde seguir`,
        text: $localize`:@@guide.teacher.welcome.next.text:Tus primeros pasos te llevan a preparar tu primera clase de principio a fin. Están siempre en «Ayuda».`,
      },
    ],
  };
}

/**
 * What the guided help reads of the screens of the teacher, from the queries they already make.
 * Called in an injection context; for the administration too, which reads it otherwise (D-096).
 */
export function teacherDataLoader(): () => Promise<TeacherData> {
  const auth = inject(AuthStore);
  const groups = inject(GroupService);
  const exercises = inject(ExerciseService);
  const blocks = inject(BlockService);
  const router = inject(Router);
  return async () => {
    // The profiles are only used with a session (GuideStore)
    const userId = auth.userId() as string;
    const [classes, bank, plans] = await Promise.all([
      groups.listClasses(),
      exercises.listBank({ kind: 'all' }),
      blocks
        .listGroups()
        .then((planned) =>
          Promise.all(
            planned
              .filter((group) => group.open)
              .map(async (group) => ({ group, blocks: await blocks.listBlocks(group.id) })),
          ),
        ),
    ]);
    return { userId, classes, bank: bank.exercises, plans, url: router.url };
  };
}

/**
 * The guided help of the teacher (2.12, ficha 13): the welcome, the first steps, «¿Cómo se
 * hace…?», the tour of each screen and the beacons of every piece. Called by StaffLayout, in its
 * injection context, with its side menu.
 */
export function teacherGuide(sideMenu: GuideSideMenu): GuideProfile {
  const auth = inject(AuthStore);
  const loadData = teacherDataLoader();
  const beacons = teacherBeacons();

  return {
    id: 'teacher',
    tasks: [...teacherFirstSteps(), ...teacherHowTos(), ...teacherTours(beacons)],
    firstSteps: TEACHER_FIRST_STEPS,
    welcome: teacherWelcome(auth.user()?.name.split(' ')[0] ?? ''),
    beacons,
    screenOf: teacherScreen,
    sideMenu,
    injector: inject(EnvironmentInjector),
    loadFacts: async () => teacherFacts(await loadData()),
  };
}
