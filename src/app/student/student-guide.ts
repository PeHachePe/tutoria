import { inject } from '@angular/core';

import { AuthStore } from '../auth/auth-store';
import { APP_PATHS } from '../core/app-paths';
import { GUIDE_ANCHORS } from '../core/guide/guide-anchor';
import type {
  GuideBeacon,
  GuideFact,
  GuideFacts,
  GuidePlace,
  GuideProfile,
  GuideScreen,
  GuideStep,
  GuideTask,
  GuideWelcome,
} from '../core/guide/guide-task';
import { WELCOME_VERSIONS } from '../core/guide/welcome-versions';
import { IS_MAC } from '../core/is-mac';
import type { AssignedExercise } from '../data/exercise';
import { ExerciseService } from '../data/exercise-service';
import { type EditorKeys, editorKeys } from '../shared/code-editor/editor-keys';
import { currentAttempt, nextExercise } from './catalog/catalog-blocks';

const A = GUIDE_ANCHORS;
/** The first steps of the student, in their order (D-093). */
const FIRST_STEPS = ['start-exercise', 'run-tests', 'ask-hint', 'submit'];

/** The screens of the student, the only ones its tours go through. */
type StudentScreen = Extract<GuideScreen, 'catalog' | 'workspace' | 'settings' | 'registered-data'>;
const NO_EXERCISE = $localize`:@@guide.student.unavailable.noExercise:Cuando tu docente te asigne un ejercicio`;
/** Turns the voice on from the globe, to see its choices (2.11). */
const TURN_VOICE_ON = $localize`:@@guide.student.voice.turnOn:Activar la voz`;

/**
 * The tabs of the workspace on phones and the tutor folded into the mascot exist at some widths
 * only: the steps that open them are skipped where they do not show.
 */
const OPEN_CODE_TAB: GuideStep = {
  anchor: A.workspaceTabCode,
  optional: true,
  title: $localize`:@@guide.student.codeTab.title:Tu código`,
  text: $localize`:@@guide.student.codeTab.text:En el móvil, el código tiene su propia pestaña.`,
  action: $localize`:@@guide.student.codeTab.action:Abre la pestaña «Código»`,
};
const OPEN_TUTOR_TAB: GuideStep = {
  anchor: A.workspaceTabTutor,
  optional: true,
  title: $localize`:@@guide.student.hint.tab.title:El tutor`,
  text: $localize`:@@guide.student.hint.tab.text:En el móvil, el tutor tiene su propia pestaña.`,
  action: $localize`:@@guide.student.hint.tab.action:Abre la pestaña «Tutor»`,
};
const OPEN_FOLDED_TUTOR: GuideStep = {
  anchor: A.tutorToggle,
  optional: true,
  title: $localize`:@@guide.student.hint.toggle.title:El tutor`,
  text: $localize`:@@guide.student.hint.toggle.text:Con el código ampliado, o en una pantalla mediana, el tutor se recoge en la mascota.`,
  action: $localize`:@@guide.student.hint.toggle.action:Pulsa la mascota`,
};

/**
 * What the catalog says about the student (2.12): what they already did, which marks the first
 * steps as done, and the exercises where each task can start, the one the catalog suggests first.
 */
export function studentFacts(entries: readonly AssignedExercise[]): GuideFacts {
  const known = new Set<GuideFact>();
  const attempts = entries.flatMap((entry) => [
    entry.status,
    entry.practice?.status ?? 'not_started',
  ]);
  if (attempts.some((status) => status !== 'not_started')) known.add('started');
  if (attempts.some((status) => ['tests_failed', 'passed', 'submitted'].includes(status))) {
    known.add('ran');
  }
  if (entries.some((entry) => entry.hintCount > 0)) known.add('askedHint');
  if (entries.some((entry) => entry.status === 'submitted')) known.add('submitted');
  if (new Set(entries.map((entry) => entry.group.id)).size > 1) known.add('hasSeveralSubjects');

  const pathOf = (entry: AssignedExercise) => APP_PATHS.student.exercise(entry.assignmentId);
  const next = nextExercise(entries)?.entry;
  const open = entries.filter((entry) => currentAttempt(entry).status !== 'submitted');
  if (open.length > 0) known.add('hasOpenExercise');
  return {
    known,
    places: {
      catalog: [APP_PATHS.student.catalog],
      settings: [APP_PATHS.student.settings],
      registeredData: [APP_PATHS.student.data],
      openExercise: [...(next ? [next] : []), ...open.filter((entry) => entry !== next)].map(
        pathOf,
      ),
      submittedExercise: entries
        .filter((entry) => currentAttempt(entry).status === 'submitted')
        .map(pathOf),
      exerciseWithAttempts: entries.filter((entry) => entry.repetitions > 0).map(pathOf),
    },
  };
}

/** The screen of the student area a URL belongs to. */
export function studentScreen(url: string): GuideScreen | undefined {
  const path = url.split(/[?#]/)[0];
  const { catalog, settings, data } = APP_PATHS.student;
  if (path === catalog) return 'catalog';
  if (path.startsWith(APP_PATHS.student.exercise(''))) return 'workspace';
  if (path === settings) return 'settings';
  if (path === data) return 'registered-data';
  return undefined;
}

/**
 * Every piece of every screen of the student, in reading order: the beacons of «Ayuda de esta
 * pantalla» and, in the same order, the tour of «Recorrer esta pantalla». The pieces of the bars
 * (no screen) show on every screen.
 */
export function studentBeacons(keys: EditorKeys): readonly GuideBeacon[] {
  return [
    // The bar
    {
      anchor: A.brand,
      title: $localize`:@@guide.student.beacon.brand.title:TutorIA`,
      text: $localize`:@@guide.student.beacon.brand.text:Desde cualquier pantalla, te lleva a tus ejercicios.`,
    },
    {
      anchor: A.navExercises,
      title: $localize`:@@guide.student.beacon.nav.title:Ejercicios`,
      text: $localize`:@@guide.student.beacon.nav.text:Tus ejercicios de todas las asignaturas. Sigue subrayado mientras trabajas en uno.`,
    },
    {
      anchor: A.help,
      title: $localize`:@@guide.student.beacon.help.title:Ayuda`,
      text: $localize`:@@guide.student.beacon.help.text:Tus primeros pasos, cómo se hace cada cosa, la ayuda de cada pantalla y la bienvenida.`,
    },
    {
      anchor: A.themeMenu,
      title: $localize`:@@guide.student.beacon.theme.title:Tema`,
      text: $localize`:@@guide.student.beacon.theme.text:Claro, oscuro o el de tu sistema. Se aplica al momento y se recuerda en este navegador.`,
    },
    {
      anchor: A.languageMenu,
      title: $localize`:@@guide.student.beacon.language.title:Idioma`,
      text: $localize`:@@guide.student.beacon.language.text:Español, català o English. Los ejercicios también se ven en tu idioma cuando tu docente los traduce.`,
    },
    {
      anchor: A.userMenu,
      title: $localize`:@@guide.student.beacon.menu.title:Tu menú`,
      text: $localize`:@@guide.student.beacon.menu.text:Tu nombre, tus ajustes, tus datos registrados y «Cerrar sesión».`,
    },
    // Catalog
    {
      screen: 'catalog',
      anchor: A.catalogNextCard,
      title: $localize`:@@guide.student.beacon.nextCard.title:Por dónde seguir`,
      text: $localize`:@@guide.student.beacon.nextCard.text:El ejercicio que dejaste a medias o, si no hay ninguno, el siguiente que te toca, con su tema, sus contenidos y su fecha de entrega.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogNext,
      title: $localize`:@@guide.student.beacon.next.title:Empezar o continuar`,
      text: $localize`:@@guide.student.beacon.next.text:Abre ese ejercicio donde lo dejaste.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogDone,
      title: $localize`:@@guide.student.beacon.done.title:Todo entregado`,
      text: $localize`:@@guide.student.beacon.done.text:Cuando lo has entregado todo, aquí te lo dice. Puedes repasar o practicar cualquier ejercicio.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogSubjects,
      title: $localize`:@@guide.student.beacon.subjects.title:Tus asignaturas`,
      text: $localize`:@@guide.student.beacon.subjects.text:Una pestaña por asignatura, cada una con sus temas y ejercicios.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogProgress,
      title: $localize`:@@guide.student.beacon.progress.title:Tu progreso`,
      text: $localize`:@@guide.student.beacon.progress.text:Cuántos ejercicios de la asignatura has superado, de todos los que tienes.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogCounts,
      title: $localize`:@@guide.student.beacon.counts.title:Cómo van`,
      text: $localize`:@@guide.student.beacon.counts.text:Cuántos tienes listos para entregar, con fallos, en curso y ya entregados.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogBlock,
      title: $localize`:@@guide.student.beacon.block.title:Los temas`,
      text: $localize`:@@guide.student.beacon.block.text:Cada tema agrupa sus ejercicios, con un punto de color por ejercicio. Pulsa su nombre para plegarlo o desplegarlo; los temas entregados enteros empiezan plegados.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogMarker,
      title: $localize`:@@guide.student.beacon.marker.title:El orden`,
      text: $localize`:@@guide.student.beacon.marker.text:El número del ejercicio en su tema, o una marca cuando ya lo has superado.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogDifficulty,
      title: $localize`:@@guide.student.beacon.difficulty.title:La dificultad`,
      text: $localize`:@@guide.student.beacon.difficulty.text:Inicial, media, avanzada o de ampliación, para ir de menos a más.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogStatus,
      title: $localize`:@@guide.student.beacon.status.title:El estado`,
      text: $localize`:@@guide.student.beacon.status.text:Sin empezar, en curso, con fallos, superado (pasa todas las pruebas, aún sin entregar) o entregado.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogDue,
      title: $localize`:@@guide.student.beacon.due.title:La fecha de entrega`,
      text: $localize`:@@guide.student.beacon.due.text:Hasta cuándo tienes para entregarlo, si tu docente puso una fecha.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogReady,
      title: $localize`:@@guide.student.beacon.ready.title:Listo para entregar`,
      text: $localize`:@@guide.student.beacon.ready.text:Supera todas las pruebas: solo te falta entregarlo.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogHints,
      title: $localize`:@@guide.student.beacon.hints.title:Tus pistas`,
      text: $localize`:@@guide.student.beacon.hints.text:Cuántas pistas pediste al tutor en ese ejercicio y hasta qué nivel.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogRepetitions,
      title: $localize`:@@guide.student.beacon.repetitions.title:Tus repeticiones`,
      text: $localize`:@@guide.student.beacon.repetitions.text:Cuántas veces lo has practicado de nuevo después de entregarlo.`,
    },
    {
      screen: 'catalog',
      anchor: A.catalogExercise,
      title: $localize`:@@guide.student.beacon.exercise.title:Empezar, continuar o repasar`,
      text: $localize`:@@guide.student.beacon.exercise.text:Abre el ejercicio: «Empezar» si es nuevo, «Continuar» si lo tienes a medias y «Repasar» si ya lo entregaste.`,
    },
    // Workspace
    {
      screen: 'workspace',
      anchor: A.workspaceBack,
      title: $localize`:@@guide.student.beacon.back.title:Volver`,
      text: $localize`:@@guide.student.beacon.back.text:A tus ejercicios. Tu código ya está guardado.`,
    },
    {
      screen: 'workspace',
      anchor: A.workspacePlace,
      title: $localize`:@@guide.student.beacon.place.title:Dónde estás`,
      text: $localize`:@@guide.student.beacon.place.text:La asignatura y el tema del ejercicio. La asignatura te lleva a su pestaña del catálogo.`,
    },
    {
      screen: 'workspace',
      anchor: A.workspaceDifficulty,
      title: $localize`:@@guide.student.beacon.difficulty.title:La dificultad`,
      text: $localize`:@@guide.student.beacon.difficulty.text:Inicial, media, avanzada o de ampliación, para ir de menos a más.`,
    },
    {
      screen: 'workspace',
      anchor: A.workspaceStatus,
      title: $localize`:@@guide.student.beacon.workspaceStatus.title:Cómo va`,
      text: $localize`:@@guide.student.beacon.workspaceStatus.text:El estado del ejercicio y, después de ejecutar, cuántas pruebas superas.`,
    },
    {
      screen: 'workspace',
      anchor: A.attemptMenu,
      title: $localize`:@@guide.student.beacon.attempts.title:Tus intentos`,
      text: $localize`:@@guide.student.beacon.attempts.text:Si lo has practicado de nuevo, aquí vuelves a uno anterior. Los anteriores solo se leen.`,
    },
    {
      screen: 'workspace',
      anchor: A.statementToggle,
      title: $localize`:@@guide.student.beacon.statementToggle.title:Plegar el enunciado`,
      text: $localize`:@@guide.student.beacon.statementToggle.text:Pliégalo cuando ya lo tengas claro y el código ganará sitio.`,
    },
    {
      screen: 'workspace',
      anchor: A.statement,
      title: $localize`:@@guide.student.beacon.statement.title:El enunciado`,
      text: $localize`:@@guide.student.beacon.statement.text:Qué tiene que hacer tu función. Lo que va en otro formato es código.`,
    },
    {
      screen: 'workspace',
      anchor: A.statementExamples,
      title: $localize`:@@guide.student.beacon.examples.title:Los ejemplos`,
      text: $localize`:@@guide.student.beacon.examples.text:Llamadas a tu función y lo que debe devolver. Son las pruebas visibles; además hay otras ocultas.`,
    },
    {
      screen: 'workspace',
      anchor: A.statementSplitter,
      title: $localize`:@@guide.student.beacon.statementSplitter.title:Más enunciado o más código`,
      text: $localize`:@@guide.student.beacon.statementSplitter.text:Arrástralo, o usa las flechas del teclado, para repartir el alto entre el enunciado y el código.`,
    },
    {
      screen: 'workspace',
      anchor: A.saveIndicator,
      title: $localize`:@@guide.student.beacon.save.title:Guardado`,
      text: $localize`:@@guide.student.beacon.save.text:Tu código se guarda solo mientras escribes; aquí ves si ya está guardado. Si algo falla, te deja reintentarlo.`,
    },
    {
      screen: 'workspace',
      anchor: A.formatCode,
      title: $localize`:@@guide.student.beacon.format.title:Formatear el código`,
      text: $localize`:@@guide.student.beacon.format.text:Ordena las sangrías y los espacios, como un editor profesional. También con ${keys.format}:keys:.`,
    },
    {
      screen: 'workspace',
      anchor: A.expandCode,
      title: $localize`:@@guide.student.beacon.expand.title:Ampliar el código`,
      text: $localize`:@@guide.student.beacon.expand.text:Le da al código todo el alto; el tutor se recoge en la mascota. Vuelve a pulsarlo para deshacerlo.`,
    },
    {
      screen: 'workspace',
      anchor: A.editor,
      title: $localize`:@@guide.student.beacon.editor.title:El editor`,
      text: $localize`:@@guide.student.beacon.editor.text:Aquí escribes tu función. Ejecuta las pruebas con ${keys.run}:keys: sin salir de él.`,
    },
    {
      screen: 'workspace',
      anchor: A.codeSplitter,
      title: $localize`:@@guide.student.beacon.codeSplitter.title:Más código o más tutor`,
      text: $localize`:@@guide.student.beacon.codeSplitter.text:Arrástralo, o usa las flechas del teclado, para repartir el ancho entre el código y el tutor.`,
    },
    {
      screen: 'workspace',
      anchor: A.runTests,
      title: $localize`:@@guide.student.beacon.run.title:Ejecutar las pruebas`,
      text: $localize`:@@guide.student.beacon.run.text:Comprueban tu código con los ejemplos y con pruebas ocultas. Puedes ejecutarlas tantas veces como quieras.`,
    },
    {
      screen: 'workspace',
      anchor: A.submit,
      title: $localize`:@@guide.student.beacon.submit.title:Entregar`,
      text: $localize`:@@guide.student.beacon.submit.text:Se activa cuando superas todas las pruebas. Es definitivo: después ya no se puede cambiar.`,
    },
    {
      screen: 'workspace',
      anchor: A.runResults,
      title: $localize`:@@guide.student.beacon.results.title:Los resultados`,
      text: $localize`:@@guide.student.beacon.results.text:Qué pruebas pasan y, de las que fallan, qué esperaban y qué devolvió tu código. De las ocultas solo sabrás si las superas.`,
    },
    {
      screen: 'workspace',
      anchor: A.resultsAskTutor,
      title: $localize`:@@guide.student.beacon.askTutor.title:Pregúntale por un fallo`,
      text: $localize`:@@guide.student.beacon.askTutor.text:Le pregunta al tutor por esa prueba, para que te ayude a entender por qué falla.`,
    },
    {
      screen: 'workspace',
      anchor: A.practiceNote,
      title: $localize`:@@guide.student.beacon.practiceNote.title:Estás practicando`,
      text: $localize`:@@guide.student.beacon.practiceNote.text:Este intento no cuenta para la clase: tu docente sigue viendo tu primera entrega.`,
    },
    {
      screen: 'workspace',
      anchor: A.submittedNote,
      title: $localize`:@@guide.student.beacon.submittedNote.title:Entregado`,
      text: $localize`:@@guide.student.beacon.submittedNote.text:Cuándo lo entregaste. El código ya no se puede cambiar.`,
    },
    {
      screen: 'workspace',
      anchor: A.practiseAgain,
      title: $localize`:@@guide.student.beacon.practiseAgain.title:Practicar de nuevo`,
      text: $localize`:@@guide.student.beacon.practiseAgain.text:Empieza un intento nuevo para practicar, sin cambiar lo que entregaste.`,
    },
    {
      screen: 'workspace',
      anchor: A.nextExercise,
      title: $localize`:@@guide.student.beacon.nextExercise.title:Siguiente ejercicio`,
      text: $localize`:@@guide.student.beacon.nextExercise.text:El siguiente de este tema que aún no has entregado.`,
    },
    {
      screen: 'workspace',
      anchor: A.tutorToggle,
      title: $localize`:@@guide.student.beacon.toggle.title:El tutor, recogido`,
      text: $localize`:@@guide.student.beacon.toggle.text:Pulsa la mascota para abrir el tutor. Un punto te avisa de una respuesta nueva, y un bocadillo de lo que te escribe.`,
    },
    {
      screen: 'workspace',
      anchor: A.hintLevel,
      title: $localize`:@@guide.student.beacon.level.title:El nivel de las pistas`,
      text: $localize`:@@guide.student.beacon.level.text:Por qué pista vas: cada una te ayuda un poco más que la anterior, sin darte nunca la solución.`,
    },
    {
      screen: 'workspace',
      anchor: A.tutorCall,
      title: $localize`:@@guide.student.beacon.call.title:Llamar al tutor`,
      text: $localize`:@@guide.student.beacon.call.text:Habla con él por voz, como en una llamada. Nunca se graba el audio.`,
    },
    {
      screen: 'workspace',
      anchor: A.tutorDock,
      title: $localize`:@@guide.student.beacon.dock.title:Fijo o flotante`,
      text: $localize`:@@guide.student.beacon.dock.text:Deja el tutor en su columna o flotando sobre el código, como prefieras.`,
    },
    {
      screen: 'workspace',
      anchor: A.tutorMinimize,
      title: $localize`:@@guide.student.beacon.minimize.title:Minimizar`,
      text: $localize`:@@guide.student.beacon.minimize.text:Recoge el tutor en la mascota. Esc también lo recoge.`,
    },
    {
      screen: 'workspace',
      anchor: A.tutorConversation,
      title: $localize`:@@guide.student.beacon.conversation.title:La conversación`,
      text: $localize`:@@guide.student.beacon.conversation.text:Lo que hablas con el tutor en este ejercicio. A veces señala una línea de tu código o una prueba.`,
    },
    {
      screen: 'workspace',
      anchor: A.tutorSuggestions,
      title: $localize`:@@guide.student.beacon.suggestions.title:Preguntas sugeridas`,
      text: $localize`:@@guide.student.beacon.suggestions.text:Para empezar a hablar con el tutor con un solo clic.`,
    },
    {
      screen: 'workspace',
      anchor: A.tutorListen,
      title: $localize`:@@guide.student.beacon.listen.title:Escuchar`,
      text: $localize`:@@guide.student.beacon.listen.text:Te lee esa respuesta en voz alta.`,
    },
    {
      screen: 'workspace',
      anchor: A.hint,
      title: $localize`:@@guide.student.beacon.hint.title:Pedir pista`,
      text: $localize`:@@guide.student.beacon.hint.text:El tutor te da una pista para avanzar. Si no basta, pide otra: cada una ayuda un poco más.`,
    },
    {
      screen: 'workspace',
      anchor: A.tutorQuestion,
      title: $localize`:@@guide.student.beacon.question.title:Pregunta al tutor`,
      text: $localize`:@@guide.student.beacon.question.text:Escríbele tu duda con tus palabras. Intro la envía; Mayús + Intro, nueva línea.`,
    },
    {
      screen: 'workspace',
      anchor: A.tutorDictate,
      title: $localize`:@@guide.student.beacon.dictate.title:Dictar`,
      text: $localize`:@@guide.student.beacon.dictate.text:Dile tu pregunta en voz alta y se escribe sola. Nunca se graba el audio.`,
    },
    {
      screen: 'workspace',
      anchor: A.tutorSend,
      title: $localize`:@@guide.student.beacon.send.title:Enviar`,
      text: $localize`:@@guide.student.beacon.send.text:Envía tu pregunta al tutor.`,
    },
    // Settings
    {
      screen: 'settings',
      anchor: A.settingsTheme,
      title: $localize`:@@guide.student.beacon.settingsTheme.title:El tema`,
      text: $localize`:@@guide.student.beacon.settingsTheme.text:Claro, oscuro o el de tu sistema; también desde la barra.`,
    },
    {
      screen: 'settings',
      anchor: A.settingsLanguage,
      title: $localize`:@@guide.student.beacon.settingsLanguage.title:El idioma`,
      text: $localize`:@@guide.student.beacon.settingsLanguage.text:El de toda la aplicación y, cuando tu docente los traduce, el de los ejercicios.`,
    },
    {
      screen: 'settings',
      anchor: A.settingsMascot,
      title: $localize`:@@guide.student.beacon.mascot.title:La mascota`,
      text: $localize`:@@guide.student.beacon.mascot.text:Ponle o quítale los cascos y la pajarita, y elige si el puntero se vuelve un hueso sobre ella.`,
    },
    {
      screen: 'settings',
      anchor: A.settingsReactions,
      title: $localize`:@@guide.student.beacon.reactions.title:Las reacciones`,
      text: $localize`:@@guide.student.beacon.reactions.text:Cómo celebra o te anima el tutor con emojis: completas, reducidas o desactivadas.`,
    },
    {
      screen: 'settings',
      anchor: A.settingsEmojis,
      title: $localize`:@@guide.student.beacon.emojis.title:Emojis animados`,
      text: $localize`:@@guide.student.beacon.emojis.text:Sin ellos, los mismos emojis quietos: más ligeros con una conexión lenta.`,
    },
    {
      screen: 'settings',
      anchor: A.settingsTryReaction,
      title: $localize`:@@guide.student.beacon.tryReaction.title:Probar una reacción`,
      text: $localize`:@@guide.student.beacon.tryReaction.text:Para ver cómo queda lo que has elegido.`,
    },
    {
      screen: 'settings',
      anchor: A.settingsProactive,
      title: $localize`:@@guide.student.beacon.proactive.title:Que el tutor te escriba solo`,
      text: $localize`:@@guide.student.beacon.proactive.text:Si llevas un rato sin avanzar, o superas algo que se te resistía, te escribe sin que se lo pidas. Puedes desactivarlo.`,
    },
    {
      screen: 'settings',
      anchor: A.settingsVoice,
      title: $localize`:@@guide.student.beacon.voice.title:Hablar con el tutor por voz`,
      text: $localize`:@@guide.student.beacon.voice.text:Actívalo para escuchar sus respuestas, dictarle y llamarle. Al activarlo, aparecen sus opciones.`,
      turnOn: TURN_VOICE_ON,
    },
    {
      screen: 'settings',
      anchor: A.settingsTutorVoice,
      title: $localize`:@@guide.student.beacon.tutorVoice.title:La voz del tutor`,
      text: $localize`:@@guide.student.beacon.tutorVoice.text:Elige entre las voces de tu equipo y escúchalas antes. Las de mejor calidad salen primero.`,
    },
    {
      screen: 'settings',
      anchor: A.settingsSpeechRate,
      title: $localize`:@@guide.student.beacon.speechRate.title:La velocidad`,
      text: $localize`:@@guide.student.beacon.speechRate.text:Lenta, normal o rápida.`,
    },
    {
      screen: 'settings',
      anchor: A.settingsReadAloud,
      title: $localize`:@@guide.student.beacon.readAloud.title:Leer las respuestas`,
      text: $localize`:@@guide.student.beacon.readAloud.text:Te lee en voz alta cada respuesta nueva, sin pulsar «Escuchar».`,
    },
    {
      screen: 'settings',
      anchor: A.settingsInterrupt,
      title: $localize`:@@guide.student.beacon.interrupt.title:Interrumpir hablando`,
      text: $localize`:@@guide.student.beacon.interrupt.text:En una llamada, si hablas mientras el tutor habla, se calla. Mejor con auriculares.`,
    },
    {
      screen: 'settings',
      anchor: A.settingsRecognition,
      title: $localize`:@@guide.student.beacon.recognition.title:Dónde se reconoce tu voz`,
      text: $localize`:@@guide.student.beacon.recognition.text:En este equipo, sin que el audio salga de él, o en el servicio de tu navegador. Si se puede, «Reconocer la voz en este equipo» lo descarga.`,
    },
    {
      screen: 'settings',
      anchor: A.settingsPrivacy,
      title: $localize`:@@guide.student.beacon.privacy.title:Privacidad`,
      text: $localize`:@@guide.student.beacon.privacy.text:Qué se registra mientras trabajas y quién lo ve.`,
    },
    // Registered data
    {
      screen: 'registered-data',
      anchor: A.dataRecorded,
      title: $localize`:@@guide.student.beacon.dataRecorded.title:Lo que se registra`,
      text: $localize`:@@guide.student.beacon.dataRecorded.text:Cada dato que se guarda mientras trabajas, y para qué.`,
    },
    {
      screen: 'registered-data',
      anchor: A.dataNever,
      title: $localize`:@@guide.student.beacon.dataNever.title:Lo que nunca`,
      text: $localize`:@@guide.student.beacon.dataNever.text:El audio de tu voz no se graba nunca, ni lo que haces fuera de TutorIA.`,
    },
    {
      screen: 'registered-data',
      anchor: A.dataPurpose,
      title: $localize`:@@guide.student.beacon.dataPurpose.title:Para qué`,
      text: $localize`:@@guide.student.beacon.dataPurpose.text:Para ayudarte a aprender, no para sancionar.`,
    },
    {
      screen: 'registered-data',
      anchor: A.dataViewers,
      title: $localize`:@@guide.student.beacon.dataViewers.title:Quién lo ve`,
      text: $localize`:@@guide.student.beacon.dataViewers.text:Tu docente, solo en sus grupos, y la administración. Nadie más.`,
    },
    {
      screen: 'registered-data',
      anchor: A.dataServices,
      title: $localize`:@@guide.student.beacon.dataServices.title:Servicios externos`,
      text: $localize`:@@guide.student.beacon.dataServices.text:Qué reciben el proveedor de IA y el reconocimiento de voz de tu navegador.`,
    },
    {
      screen: 'registered-data',
      anchor: A.dataChoices,
      title: $localize`:@@guide.student.beacon.dataChoices.title:Tú decides`,
      text: $localize`:@@guide.student.beacon.dataChoices.text:Lo que puedes cambiar en tus ajustes.`,
    },
  ];
}

/** Where the tour of each screen starts. */
const SCREEN_PLACES: Readonly<Record<StudentScreen, GuidePlace>> = {
  catalog: 'catalog',
  workspace: 'openExercise',
  settings: 'settings',
  'registered-data': 'registeredData',
};

/**
 * «Recorrer esta pantalla»: every piece of a screen, in the order of its beacons, with the same
 * texts. Those of the bars go with the catalog, the home of the area. In the workspace, the tabs
 * and the folded tutor are opened on the way.
 */
export function screenTours(beacons: readonly GuideBeacon[]): readonly GuideTask[] {
  const stepsOf = (screen: StudentScreen): GuideStep[] => {
    const own = beacons.filter((beacon) => beacon.screen === screen);
    const bars = screen === 'catalog' ? beacons.filter((beacon) => !beacon.screen) : [];
    const steps: GuideStep[] = [...own, ...bars].map(({ anchor, title, text, turnOn }) => ({
      anchor,
      title,
      text,
      turnOn,
      optional: true,
    }));
    if (screen !== 'workspace') return steps;
    const before = (anchor: string) => steps.findIndex((step) => step.anchor === anchor);
    steps.splice(before(A.saveIndicator), 0, OPEN_CODE_TAB);
    steps.splice(before(A.tutorToggle), 0, OPEN_TUTOR_TAB);
    steps.splice(before(A.hintLevel), 0, OPEN_FOLDED_TUTOR);
    return steps;
  };
  const tour = (
    screen: StudentScreen,
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
    keywords: [$localize`:@@guide.student.tour.keywords:conocer recorrer pantalla todo piezas`],
    unavailable,
    steps: stepsOf(screen),
  });
  return [
    tour(
      'catalog',
      $localize`:@@guide.student.tour.catalog.title:Conocer tus ejercicios`,
      $localize`:@@guide.student.tour.catalog.summary:Cada pieza del catálogo y de la barra, una a una.`,
    ),
    tour(
      'workspace',
      $localize`:@@guide.student.tour.workspace.title:Conocer la pantalla de trabajo`,
      $localize`:@@guide.student.tour.workspace.summary:El enunciado, el editor, las pruebas y el tutor, pieza a pieza.`,
      NO_EXERCISE,
    ),
    tour(
      'settings',
      $localize`:@@guide.student.tour.settings.title:Conocer tus ajustes`,
      $localize`:@@guide.student.tour.settings.summary:El tema, el idioma, la mascota, las reacciones y la voz.`,
    ),
    tour(
      'registered-data',
      $localize`:@@guide.student.tour.data.title:Conocer tus datos registrados`,
      $localize`:@@guide.student.tour.data.summary:Qué se guarda, para qué y quién lo ve.`,
    ),
  ];
}

/** The tasks of «¿Cómo se hace…?» besides the first steps and the tours of the screens. */
function studentTasks(keys: EditorKeys): readonly GuideTask[] {
  return [
    {
      id: 'start-exercise',
      doneBy: 'started',
      needs: 'hasOpenExercise',
      unavailable: NO_EXERCISE,
      screen: 'catalog',
      place: 'catalog',
      title: $localize`:@@guide.student.start.title:Empezar un ejercicio`,
      summary: $localize`:@@guide.student.start.summary:Abrir un ejercicio y saber dónde se escribe.`,
      keywords: [$localize`:@@guide.student.start.keywords:abrir comenzar nuevo enunciado editor`],
      steps: [
        {
          anchor: A.catalogNext,
          navigates: true,
          title: $localize`:@@guide.student.start.next.title:Tu siguiente ejercicio`,
          text: $localize`:@@guide.student.start.next.text:El catálogo te propone siempre por dónde seguir.`,
          action: $localize`:@@guide.student.start.next.action:Pulsa «Empezar» o «Continuar»`,
        },
        {
          anchor: A.statement,
          title: $localize`:@@guide.student.start.statement.title:El enunciado`,
          text: $localize`:@@guide.student.start.statement.text:Qué tiene que hacer tu función, con ejemplos de lo que recibe y lo que devuelve.`,
        },
        OPEN_CODE_TAB,
        {
          anchor: A.editor,
          title: $localize`:@@guide.student.start.editor.title:Aquí escribes`,
          text: $localize`:@@guide.student.start.editor.text:Tu código se guarda solo mientras escribes. Cuando quieras, ejecuta las pruebas.`,
        },
      ],
    },
    {
      id: 'run-tests',
      doneBy: 'ran',
      unavailable: NO_EXERCISE,
      screen: 'workspace',
      place: 'openExercise',
      title: $localize`:@@guide.student.run.title:Ejecutar las pruebas`,
      summary: $localize`:@@guide.student.run.summary:Comprobar tu código con los ejemplos y las pruebas ocultas.`,
      keywords: [$localize`:@@guide.student.run.keywords:comprobar probar resultados fallos atajo`],
      steps: [
        OPEN_CODE_TAB,
        {
          anchor: A.runTests,
          title: $localize`:@@guide.student.run.button.title:Ejecutar las pruebas`,
          text: $localize`:@@guide.student.run.button.text:Comprueban tu código con los ejemplos y con otras pruebas ocultas. Desde el editor, también con ${keys.run}:keys:.`,
          action: $localize`:@@guide.student.run.button.action:Pulsa «Ejecutar pruebas»`,
          whenDisabled: {
            title: $localize`:@@guide.student.run.busy.title:Ahora no se pueden ejecutar`,
            text: $localize`:@@guide.student.run.busy.text:Espera a que acabe lo que está en marcha y vuelve a intentarlo.`,
          },
        },
        {
          anchor: A.runResults,
          title: $localize`:@@guide.student.run.results.title:Los resultados`,
          text: $localize`:@@guide.student.run.results.text:Cada prueba dice si pasa y, si falla, qué esperaba. De las ocultas solo sabrás si las superas.`,
        },
      ],
    },
    {
      id: 'ask-hint',
      doneBy: 'askedHint',
      unavailable: NO_EXERCISE,
      screen: 'workspace',
      place: 'openExercise',
      title: $localize`:@@guide.student.hint.title:Pedir una pista al tutor`,
      summary: $localize`:@@guide.student.hint.summary:Pedir ayuda sin que te den la solución.`,
      keywords: [$localize`:@@guide.student.hint.keywords:ayuda tutor duda pregunta nivel`],
      steps: [
        OPEN_TUTOR_TAB,
        OPEN_FOLDED_TUTOR,
        {
          anchor: A.hint,
          title: $localize`:@@guide.student.hint.button.title:Pedir una pista`,
          text: $localize`:@@guide.student.hint.button.text:El tutor te ayuda a avanzar sin darte nunca la solución.`,
          action: $localize`:@@guide.student.hint.button.action:Pulsa «Pedir pista»`,
        },
        {
          anchor: A.hintLevel,
          title: $localize`:@@guide.student.hint.level.title:De menos a más`,
          text: $localize`:@@guide.student.hint.level.text:Cada pista te ayuda un poco más que la anterior. Aquí ves por cuál vas.`,
        },
        {
          anchor: A.tutorQuestion,
          title: $localize`:@@guide.student.hint.question.title:Pregúntale`,
          text: $localize`:@@guide.student.hint.question.text:También puedes escribirle tu duda con tus palabras, o pedirle que te explique un error.`,
        },
      ],
    },
    {
      id: 'submit',
      doneBy: 'submitted',
      unavailable: NO_EXERCISE,
      screen: 'workspace',
      place: 'openExercise',
      title: $localize`:@@guide.student.submit.title:Entregar`,
      summary: $localize`:@@guide.student.submit.summary:Entregar un ejercicio cuando supera todas las pruebas.`,
      keywords: [$localize`:@@guide.student.submit.keywords:enviar terminar acabar definitivo`],
      steps: [
        OPEN_CODE_TAB,
        {
          anchor: A.submit,
          title: $localize`:@@guide.student.submit.button.title:Entregar`,
          text: $localize`:@@guide.student.submit.button.text:Cuando tu código supera todas las pruebas, se lo entregas a tu docente. Es definitivo: después ya no se puede cambiar.`,
          action: $localize`:@@guide.student.submit.button.action:Pulsa «Entregar»`,
          whenDisabled: {
            title: $localize`:@@guide.student.submit.notYet.title:Aún no puedes entregar`,
            text: $localize`:@@guide.student.submit.notYet.text:«Entregar» se activa cuando tu código supera todas las pruebas. Vuelve aquí entonces.`,
          },
        },
        {
          anchor: A.submitDialog,
          inOverlay: true,
          title: $localize`:@@guide.student.submit.confirm.title:Confírmalo`,
          text: $localize`:@@guide.student.submit.confirm.text:Si aún quieres repasarlo, «Seguir revisando» te deja seguir trabajando.`,
          action: $localize`:@@guide.student.submit.confirm.action:Pulsa «Entregar» para confirmarlo`,
        },
        {
          anchor: A.submittedNote,
          title: $localize`:@@guide.student.submit.done.title:¡Entregado!`,
          text: $localize`:@@guide.student.submit.done.text:Tu docente ya lo ve. Si quieres, puedes practicarlo de nuevo sin cambiar lo entregado.`,
        },
      ],
    },
    {
      id: 'change-language',
      screen: 'catalog',
      title: $localize`:@@guide.student.language.title:Cambiar el idioma`,
      summary: $localize`:@@guide.student.language.summary:Español, català o English, desde la barra.`,
      keywords: [
        $localize`:@@guide.student.language.keywords:idioma lengua catalán inglés traducción`,
      ],
      steps: [
        {
          anchor: A.languageMenu,
          interactive: true,
          title: $localize`:@@guide.student.language.step.title:El idioma`,
          text: $localize`:@@guide.student.language.step.text:Pulsa aquí y elige el tuyo: la aplicación se vuelve a abrir en él. Los ejercicios también se ven en tu idioma cuando tu docente los traduce.`,
        },
      ],
    },
    {
      id: 'change-theme',
      screen: 'catalog',
      title: $localize`:@@guide.student.theme.title:Cambiar el tema: claro u oscuro`,
      summary: $localize`:@@guide.student.theme.summary:Desde la barra, en cualquier pantalla.`,
      keywords: [
        $localize`:@@guide.student.theme.keywords:tema oscuro claro modo noche colores apariencia`,
      ],
      steps: [
        {
          anchor: A.themeMenu,
          interactive: true,
          title: $localize`:@@guide.student.theme.step.title:El tema`,
          text: $localize`:@@guide.student.theme.step.text:Pulsa aquí y elige claro, oscuro o el de tu sistema. Se aplica al momento. También está en Ajustes.`,
        },
      ],
    },
    {
      id: 'change-subject',
      screen: 'catalog',
      place: 'catalog',
      needs: 'hasSeveralSubjects',
      unavailable: $localize`:@@guide.student.unavailable.oneSubject:Cuando tengas ejercicios de más de una asignatura`,
      title: $localize`:@@guide.student.subject.title:Cambiar de asignatura`,
      summary: $localize`:@@guide.student.subject.summary:Ver los ejercicios de otra asignatura.`,
      keywords: [$localize`:@@guide.student.subject.keywords:asignatura pestaña materia módulo`],
      steps: [
        {
          anchor: A.catalogSubjects,
          interactive: true,
          title: $localize`:@@guide.student.subject.step.title:Tus asignaturas`,
          text: $localize`:@@guide.student.subject.step.text:Pulsa una pestaña para ver sus temas y ejercicios. Tu siguiente ejercicio, arriba, es el de cualquiera de ellas.`,
        },
      ],
    },
    {
      id: 'failing-test',
      screen: 'workspace',
      place: 'openExercise',
      unavailable: NO_EXERCISE,
      title: $localize`:@@guide.student.failing.title:Ver por qué falla una prueba`,
      summary: $localize`:@@guide.student.failing.summary:Qué esperaba, qué devolvió y cómo preguntarle al tutor.`,
      keywords: [
        $localize`:@@guide.student.failing.keywords:error fallo prueba resultado esperado devuelve`,
      ],
      steps: [
        OPEN_CODE_TAB,
        {
          anchor: A.runTests,
          title: $localize`:@@guide.student.failing.run.title:Ejecuta las pruebas`,
          text: $localize`:@@guide.student.failing.run.text:Primero, comprueba tu código.`,
          action: $localize`:@@guide.student.failing.run.action:Pulsa «Ejecutar pruebas»`,
          whenDisabled: {
            title: $localize`:@@guide.student.run.busy.title:Ahora no se pueden ejecutar`,
            text: $localize`:@@guide.student.run.busy.text:Espera a que acabe lo que está en marcha y vuelve a intentarlo.`,
          },
        },
        {
          anchor: A.runResults,
          title: $localize`:@@guide.student.failing.results.title:Cada prueba`,
          text: $localize`:@@guide.student.failing.results.text:La llamada a tu función y, si falla, lo que esperaba y lo que devolvió. De las ocultas solo sabrás si las superas.`,
        },
        {
          anchor: A.resultsAskTutor,
          optional: true,
          title: $localize`:@@guide.student.failing.ask.title:Pregúntale por ella`,
          text: $localize`:@@guide.student.failing.ask.text:Le pregunta al tutor por esa prueba, para que te ayude a entender el fallo sin darte la solución.`,
        },
      ],
    },
    {
      id: 'ask-question',
      screen: 'workspace',
      place: 'openExercise',
      unavailable: NO_EXERCISE,
      title: $localize`:@@guide.student.question.title:Preguntar al tutor con tus palabras`,
      summary: $localize`:@@guide.student.question.summary:Escribirle, dictarle o usar una pregunta sugerida.`,
      keywords: [
        $localize`:@@guide.student.question.keywords:preguntar duda escribir chat sugerencias`,
      ],
      steps: [
        OPEN_TUTOR_TAB,
        OPEN_FOLDED_TUTOR,
        {
          anchor: A.tutorSuggestions,
          optional: true,
          title: $localize`:@@guide.student.question.suggestions.title:Preguntas sugeridas`,
          text: $localize`:@@guide.student.question.suggestions.text:Para empezar con un clic, si no sabes cómo preguntarle.`,
        },
        {
          anchor: A.tutorQuestion,
          title: $localize`:@@guide.student.question.field.title:Tu pregunta`,
          text: $localize`:@@guide.student.question.field.text:Escríbele tu duda como se la dirías a un profesor. Intro la envía; Mayús + Intro, nueva línea.`,
        },
        {
          anchor: A.tutorDictate,
          optional: true,
          title: $localize`:@@guide.student.question.dictate.title:O díctasela`,
          text: $localize`:@@guide.student.question.dictate.text:Con la voz activada, dila en voz alta y se escribe sola.`,
        },
      ],
    },
    {
      id: 'talk',
      screen: 'workspace',
      place: 'openExercise',
      unavailable: NO_EXERCISE,
      title: $localize`:@@guide.student.talk.title:Escuchar, dictar o llamar al tutor`,
      summary: $localize`:@@guide.student.talk.summary:Usar la voz en un ejercicio.`,
      keywords: [
        $localize`:@@guide.student.talk.keywords:voz escuchar dictar llamar llamada micrófono hablar`,
      ],
      steps: [
        OPEN_TUTOR_TAB,
        OPEN_FOLDED_TUTOR,
        {
          anchor: A.tutorListen,
          optional: true,
          title: $localize`:@@guide.student.talk.listen.title:Escuchar`,
          text: $localize`:@@guide.student.talk.listen.text:En cada respuesta: el tutor te la lee en voz alta.`,
        },
        {
          anchor: A.tutorDictate,
          optional: true,
          title: $localize`:@@guide.student.talk.dictate.title:Dictar`,
          text: $localize`:@@guide.student.talk.dictate.text:Dile tu pregunta y se escribe sola.`,
        },
        {
          anchor: A.tutorCall,
          optional: true,
          title: $localize`:@@guide.student.talk.call.title:Llamar al tutor`,
          text: $localize`:@@guide.student.talk.call.text:Habla con él como en una llamada.`,
        },
        {
          title: $localize`:@@guide.student.talk.end.title:Nunca se graba el audio`,
          text: $localize`:@@guide.student.talk.end.text:Si no ves estos botones, activa «Hablar con el tutor por voz» en Ajustes.`,
        },
      ],
    },
    {
      id: 'voice',
      screen: 'settings',
      place: 'settings',
      title: $localize`:@@guide.student.voice.title:Configurar la voz del tutor`,
      summary: $localize`:@@guide.student.voice.summary:Activarla, elegir su voz y su velocidad, y dónde se reconoce la tuya.`,
      keywords: [
        $localize`:@@guide.student.voice.keywords:voz hablar escuchar dictar llamar micrófono velocidad local equipo`,
      ],
      steps: [
        {
          anchor: A.settingsVoice,
          interactive: true,
          turnOn: TURN_VOICE_ON,
          title: $localize`:@@guide.student.voice.toggle.title:Hablar con el tutor por voz`,
          text: $localize`:@@guide.student.voice.toggle.text:Para escuchar sus respuestas, dictarle y llamarle. Actívala y te enseño sus opciones; puedes desactivarla cuando quieras.`,
        },
        {
          anchor: A.settingsTutorVoice,
          optional: true,
          title: $localize`:@@guide.student.voice.choice.title:La voz del tutor`,
          text: $localize`:@@guide.student.voice.choice.text:Elige entre las voces de tu equipo; escúchalas antes de quedarte con una.`,
        },
        {
          anchor: A.settingsSpeechRate,
          optional: true,
          title: $localize`:@@guide.student.voice.rate.title:La velocidad`,
          text: $localize`:@@guide.student.voice.rate.text:Lenta, normal o rápida.`,
        },
        {
          anchor: A.settingsReadAloud,
          optional: true,
          title: $localize`:@@guide.student.voice.readAloud.title:Leer las respuestas`,
          text: $localize`:@@guide.student.voice.readAloud.text:Te lee en voz alta cada respuesta nueva, sin pulsar «Escuchar».`,
        },
        {
          anchor: A.settingsInterrupt,
          optional: true,
          title: $localize`:@@guide.student.voice.interrupt.title:Interrumpir hablando`,
          text: $localize`:@@guide.student.voice.interrupt.text:En una llamada, si hablas mientras el tutor habla, se calla. Mejor con auriculares.`,
        },
        {
          anchor: A.settingsRecognition,
          optional: true,
          title: $localize`:@@guide.student.voice.recognition.title:Dónde se reconoce tu voz`,
          text: $localize`:@@guide.student.voice.recognition.text:En este equipo, sin que el audio salga de él, o en el servicio de tu navegador. Si se puede, «Reconocer la voz en este equipo» lo descarga.`,
        },
        {
          title: $localize`:@@guide.student.voice.where.title:En cada ejercicio`,
          text: $localize`:@@guide.student.voice.where.text:Con la voz activada, junto al tutor tienes «Escuchar», «Dictar» y «Llamar al tutor». Nunca se graba el audio.`,
        },
      ],
    },
    {
      id: 'reactions',
      screen: 'settings',
      place: 'settings',
      title: $localize`:@@guide.student.reactions.title:Cambiar las reacciones del tutor`,
      summary: $localize`:@@guide.student.reactions.summary:Más, menos o ningún emoji en sus respuestas.`,
      keywords: [
        $localize`:@@guide.student.reactions.keywords:reacciones emojis animaciones efectos confeti`,
      ],
      steps: [
        {
          anchor: A.settingsReactions,
          interactive: true,
          title: $localize`:@@guide.student.reactions.choice.title:Las reacciones`,
          text: $localize`:@@guide.student.reactions.choice.text:Completas, reducidas o desactivadas.`,
        },
        {
          anchor: A.settingsEmojis,
          interactive: true,
          title: $localize`:@@guide.student.reactions.emojis.title:Emojis animados`,
          text: $localize`:@@guide.student.reactions.emojis.text:Sin ellos, los mismos emojis quietos, más ligeros.`,
        },
        {
          anchor: A.settingsTryReaction,
          interactive: true,
          title: $localize`:@@guide.student.reactions.try.title:Pruébalo`,
          text: $localize`:@@guide.student.reactions.try.text:Para ver cómo queda.`,
        },
      ],
    },
    {
      id: 'mascot',
      screen: 'settings',
      place: 'settings',
      title: $localize`:@@guide.student.mascot.title:Vestir a la mascota`,
      summary: $localize`:@@guide.student.mascot.summary:Los cascos, la pajarita y el puntero de hueso.`,
      keywords: [$localize`:@@guide.student.mascot.keywords:mascota perro cascos pajarita hueso`],
      steps: [
        {
          anchor: A.settingsMascot,
          interactive: true,
          title: $localize`:@@guide.student.mascot.step.title:La mascota`,
          text: $localize`:@@guide.student.mascot.step.text:Ponle o quítale los cascos y la pajarita, y elige si el puntero se vuelve un hueso sobre ella.`,
        },
      ],
    },
    {
      id: 'proactive',
      screen: 'settings',
      place: 'settings',
      title: $localize`:@@guide.student.proactive.title:Que el tutor te escriba solo, o no`,
      summary: $localize`:@@guide.student.proactive.summary:Cuando llevas un rato sin avanzar o superas algo difícil.`,
      keywords: [
        $localize`:@@guide.student.proactive.keywords:proactivo avisos mensajes molestar escribe solo`,
      ],
      steps: [
        {
          anchor: A.settingsProactive,
          interactive: true,
          title: $localize`:@@guide.student.proactive.step.title:El tutor te escribe`,
          text: $localize`:@@guide.student.proactive.step.text:Si llevas un rato sin avanzar, o superas algo que se te resistía, te escribe sin que se lo pidas. Desactívalo si prefieres que solo te conteste.`,
        },
      ],
    },
    {
      id: 'arrange-workspace',
      screen: 'workspace',
      place: 'openExercise',
      unavailable: NO_EXERCISE,
      title: $localize`:@@guide.student.arrange.title:Ajustar la pantalla de trabajo`,
      summary: $localize`:@@guide.student.arrange.summary:Más sitio para el código, el enunciado o el tutor.`,
      keywords: [
        $localize`:@@guide.student.arrange.keywords:tamaño ampliar plegar mover tutor flotante pantalla`,
      ],
      steps: [
        {
          title: $localize`:@@guide.student.arrange.intro.title:A tu medida`,
          text: $localize`:@@guide.student.arrange.intro.text:Reparte la pantalla como te vaya mejor; se recuerda para la próxima vez.`,
        },
        {
          anchor: A.statementToggle,
          optional: true,
          title: $localize`:@@guide.student.beacon.statementToggle.title:Plegar el enunciado`,
          text: $localize`:@@guide.student.beacon.statementToggle.text:Pliégalo cuando ya lo tengas claro y el código ganará sitio.`,
        },
        {
          anchor: A.statementSplitter,
          optional: true,
          title: $localize`:@@guide.student.beacon.statementSplitter.title:Más enunciado o más código`,
          text: $localize`:@@guide.student.beacon.statementSplitter.text:Arrástralo, o usa las flechas del teclado, para repartir el alto entre el enunciado y el código.`,
        },
        {
          anchor: A.codeSplitter,
          optional: true,
          title: $localize`:@@guide.student.beacon.codeSplitter.title:Más código o más tutor`,
          text: $localize`:@@guide.student.beacon.codeSplitter.text:Arrástralo, o usa las flechas del teclado, para repartir el ancho entre el código y el tutor.`,
        },
        {
          anchor: A.expandCode,
          optional: true,
          title: $localize`:@@guide.student.beacon.expand.title:Ampliar el código`,
          text: $localize`:@@guide.student.beacon.expand.text:Le da al código todo el alto; el tutor se recoge en la mascota. Vuelve a pulsarlo para deshacerlo.`,
        },
        {
          anchor: A.tutorDock,
          optional: true,
          title: $localize`:@@guide.student.beacon.dock.title:Fijo o flotante`,
          text: $localize`:@@guide.student.beacon.dock.text:Deja el tutor en su columna o flotando sobre el código, como prefieras.`,
        },
      ],
    },
    {
      id: 'format-code',
      screen: 'workspace',
      place: 'openExercise',
      unavailable: NO_EXERCISE,
      title: $localize`:@@guide.student.format.title:Ordenar tu código`,
      summary: $localize`:@@guide.student.format.summary:Las sangrías y los espacios, de un clic.`,
      keywords: [
        $localize`:@@guide.student.format.keywords:formatear sangría ordenar atajo teclado`,
      ],
      steps: [
        OPEN_CODE_TAB,
        {
          anchor: A.formatCode,
          interactive: true,
          title: $localize`:@@guide.student.beacon.format.title:Formatear el código`,
          text: $localize`:@@guide.student.beacon.format.text:Ordena las sangrías y los espacios, como un editor profesional. También con ${keys.format}:keys:.`,
        },
      ],
    },
    {
      id: 'practise-again',
      screen: 'workspace',
      place: 'submittedExercise',
      unavailable: $localize`:@@guide.student.unavailable.noSubmitted:Cuando hayas entregado un ejercicio`,
      title: $localize`:@@guide.student.practise.title:Practicar de nuevo un ejercicio entregado`,
      summary: $localize`:@@guide.student.practise.summary:Repetirlo sin cambiar lo que ve tu docente.`,
      keywords: [$localize`:@@guide.student.practise.keywords:repetir repasar otra vez intento`],
      steps: [
        {
          anchor: A.practiseAgain,
          title: $localize`:@@guide.student.practise.button.title:Practicar de nuevo`,
          text: $localize`:@@guide.student.practise.button.text:Empiezas un intento nuevo para practicar. Lo que entregaste no cambia.`,
          action: $localize`:@@guide.student.practise.button.action:Pulsa «Practicar de nuevo»`,
        },
        {
          anchor: A.practiceNote,
          title: $localize`:@@guide.student.practise.note.title:Estás practicando`,
          text: $localize`:@@guide.student.practise.note.text:Este intento no cuenta para la clase: tu docente sigue viendo tu primera entrega.`,
        },
      ],
    },
    {
      id: 'previous-attempt',
      screen: 'workspace',
      place: 'exerciseWithAttempts',
      unavailable: $localize`:@@guide.student.unavailable.noAttempts:Cuando hayas practicado de nuevo un ejercicio`,
      title: $localize`:@@guide.student.attempts.title:Volver a un intento anterior`,
      summary: $localize`:@@guide.student.attempts.summary:Releer lo que entregaste antes de practicar.`,
      keywords: [$localize`:@@guide.student.attempts.keywords:intentos historial entrega anterior`],
      steps: [
        {
          anchor: A.attemptMenu,
          title: $localize`:@@guide.student.attempts.menu.title:Tus intentos`,
          text: $localize`:@@guide.student.attempts.menu.text:Cada vez que practicas un ejercicio de nuevo, empiezas un intento. Aquí los tienes todos.`,
          action: $localize`:@@guide.student.attempts.menu.action:Abre la lista de intentos`,
        },
        {
          anchor: A.attemptChoices,
          inOverlay: true,
          navigates: true,
          title: $localize`:@@guide.student.attempts.choice.title:Elige uno`,
          text: $localize`:@@guide.student.attempts.choice.text:Los anteriores solo se leen; en el último puedes seguir trabajando.`,
          action: $localize`:@@guide.student.attempts.choice.action:Elige un intento`,
        },
      ],
    },
    {
      id: 'next-exercise',
      screen: 'workspace',
      place: 'submittedExercise',
      unavailable: $localize`:@@guide.student.unavailable.noSubmitted:Cuando hayas entregado un ejercicio`,
      title: $localize`:@@guide.student.nextExercise.title:Pasar al siguiente ejercicio`,
      summary: $localize`:@@guide.student.nextExercise.summary:Seguir con el tema sin volver al catálogo.`,
      keywords: [$localize`:@@guide.student.nextExercise.keywords:siguiente continuar seguir tema`],
      steps: [
        {
          anchor: A.submittedNote,
          title: $localize`:@@guide.student.beacon.submittedNote.title:Entregado`,
          text: $localize`:@@guide.student.beacon.submittedNote.text:Cuándo lo entregaste. El código ya no se puede cambiar.`,
        },
        {
          anchor: A.nextExercise,
          optional: true,
          title: $localize`:@@guide.student.beacon.nextExercise.title:Siguiente ejercicio`,
          text: $localize`:@@guide.student.beacon.nextExercise.text:El siguiente de este tema que aún no has entregado.`,
        },
      ],
    },
    {
      id: 'registered-data',
      screen: 'registered-data',
      title: $localize`:@@guide.student.data.title:Ver qué datos se registran`,
      summary: $localize`:@@guide.student.data.summary:Saber qué se guarda, para qué y quién lo ve.`,
      keywords: [$localize`:@@guide.student.data.keywords:privacidad datos información registro`],
      steps: [
        {
          anchor: A.userMenu,
          title: $localize`:@@guide.student.data.menu.title:Tu menú`,
          text: $localize`:@@guide.student.data.menu.text:Aquí tienes tus ajustes, tus datos y la salida.`,
          action: $localize`:@@guide.student.data.menu.action:Abre tu menú`,
        },
        {
          anchor: A.menuRegisteredData,
          inOverlay: true,
          navigates: true,
          title: $localize`:@@guide.student.data.link.title:Datos registrados`,
          text: $localize`:@@guide.student.data.link.text:Te dice qué se guarda mientras trabajas, para qué y quién lo ve.`,
          action: $localize`:@@guide.student.data.link.action:Pulsa «Datos registrados»`,
        },
        {
          anchor: A.dataRecorded,
          title: $localize`:@@guide.student.data.recorded.title:Lo que se registra`,
          text: $localize`:@@guide.student.data.recorded.text:Tu código, las pruebas, las pistas y la conversación con el tutor, entre otras cosas.`,
        },
        {
          anchor: A.dataNever,
          title: $localize`:@@guide.student.data.never.title:Lo que nunca`,
          text: $localize`:@@guide.student.data.never.text:El audio de tu voz no se graba nunca.`,
        },
        {
          anchor: A.dataViewers,
          title: $localize`:@@guide.student.data.viewers.title:Quién lo ve`,
          text: $localize`:@@guide.student.data.viewers.text:Tu docente, solo en sus grupos, y la administración. Nadie más.`,
        },
      ],
    },
    {
      id: 'sign-out',
      screen: 'catalog',
      title: $localize`:@@guide.student.signOut.title:Cerrar sesión`,
      summary: $localize`:@@guide.student.signOut.summary:Salir, sobre todo en un ordenador compartido.`,
      keywords: [
        $localize`:@@guide.student.signOut.keywords:salir cerrar sesión desconectar cuenta`,
      ],
      steps: [
        {
          anchor: A.userMenu,
          title: $localize`:@@guide.student.signOut.menu.title:Tu menú`,
          text: $localize`:@@guide.student.signOut.menu.text:Arriba a la derecha, en cualquier pantalla.`,
          action: $localize`:@@guide.student.data.menu.action:Abre tu menú`,
        },
        {
          anchor: A.menuSignOut,
          inOverlay: true,
          title: $localize`:@@guide.student.signOut.item.title:Cerrar sesión`,
          text: $localize`:@@guide.student.signOut.item.text:Púlsalo cuando acabes. Tu código ya está guardado.`,
        },
      ],
    },
  ];
}

/**
 * The guided help of the student (2.12, ficha 13): the welcome, the first steps, the tasks of
 * «¿Cómo se hace…?», the tour of each screen and the beacons of every piece. Called by the student
 * layout, in its injection context.
 */
export function studentGuide(): GuideProfile {
  const auth = inject(AuthStore);
  const exercises = inject(ExerciseService);
  const keys = editorKeys(inject(IS_MAC));
  const firstName = auth.user()?.name.split(' ')[0] ?? '';
  const beacons = studentBeacons(keys);
  const tasks = studentTasks(keys);
  const [firstSteps, howTo] = [
    tasks.filter((task) => FIRST_STEPS.includes(task.id)),
    tasks.filter((task) => !FIRST_STEPS.includes(task.id)),
  ];

  const welcome: GuideWelcome = {
    version: WELCOME_VERSIONS.student,
    screen: 'catalog',
    place: 'catalog',
    // After the notice on the registered data, which comes first (RF-07)
    when: auth.privacyNoticeSeen,
    steps: [
      {
        title: firstName
          ? $localize`:@@guide.student.welcome.hello.title:¡Hola, ${firstName}:name:!`
          : $localize`:@@guide.student.welcome.hello.anonymous:¡Hola!`,
        text: $localize`:@@guide.student.welcome.hello.text:Soy el tutor de TutorIA. Te enseño en un momento dónde está cada cosa; puedes saltarlo cuando quieras.`,
      },
      // The buttons of the bar, together and in their order, from left to right
      {
        anchor: A.help,
        title: $localize`:@@guide.student.welcome.help.title:La ayuda`,
        text: $localize`:@@guide.student.welcome.help.text:Aquí la tienes siempre: los primeros pasos, cómo se hace cada cosa y el recorrido de cada pantalla, pieza a pieza.`,
      },
      {
        anchor: A.themeMenu,
        interactive: true,
        title: $localize`:@@guide.student.welcome.theme.title:Claro u oscuro`,
        text: $localize`:@@guide.student.welcome.theme.text:El tema: claro, oscuro o el de tu sistema. Pruébalo ahora si quieres.`,
      },
      {
        anchor: A.languageMenu,
        interactive: true,
        title: $localize`:@@guide.student.welcome.language.title:Tu idioma`,
        text: $localize`:@@guide.student.welcome.language.text:Español, català o English. Si prefieres otro, elígelo ahora y seguimos en él.`,
      },
      {
        anchor: A.userMenu,
        title: $localize`:@@guide.student.welcome.menu.title:Tu menú`,
        text: $localize`:@@guide.student.welcome.menu.text:Tus ajustes (la mascota, las reacciones, la voz del tutor), tus datos registrados y «Cerrar sesión».`,
      },
      // Then the page, ending where the work starts: its last globe offers the first step
      {
        anchor: A.catalogSubjects,
        optional: true,
        title: $localize`:@@guide.student.welcome.subjects.title:Tus asignaturas`,
        text: $localize`:@@guide.student.welcome.subjects.text:Cada una tiene sus ejercicios, ordenados por temas.`,
      },
      {
        anchor: A.catalogNext,
        optional: true,
        title: $localize`:@@guide.student.welcome.next.title:Por dónde seguir`,
        text: $localize`:@@guide.student.welcome.next.text:Aquí tienes siempre tu siguiente ejercicio, o el que dejaste a medias.`,
      },
    ],
  };

  return {
    id: 'student',
    tasks: [...firstSteps, ...screenTours(beacons), ...howTo],
    firstSteps: FIRST_STEPS,
    welcome,
    beacons,
    screenOf: studentScreen,
    loadFacts: async () => {
      const userId = auth.userId();
      return studentFacts(userId ? await exercises.listAssigned(userId) : []);
    },
  };
}
