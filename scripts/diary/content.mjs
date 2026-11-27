// The diary's own words: what is written for an audience instead of read from docs/.
// Figures in {braces} are filled in from docs/ when the page renders, so they never go stale.

/** One per phase of the plan (the index is the phase), plus the work outside the plan. */
export const PHASES = [
  { short: 'Cimientos', icon: '🧱' },
  { short: 'El alumno', icon: '🎒' },
  { short: 'El back-end real', icon: '🗄️' },
  { short: 'La nube', icon: '☁️' },
  { short: 'El docente', icon: '🧑‍🏫' },
  { short: 'La administración', icon: '🛠️' },
  { short: 'La voz', icon: '🎙️' },
  { short: 'Ayuda y cierre', icon: '🧭' },
  { short: 'Fuera del plan', icon: '🔧' },
];

/** Captured screens without a screen spec of their own. */
export const SCREEN_NAMES = {
  '08b-ejercicio': 'Editor de un ejercicio',
  '08c-bloques': 'Bloques',
  '08c-bloques-cerrado': 'Bloques de una clase cerrada',
  '11-grupos-evaluacion': 'Evaluación final',
};

export const MANUAL_PROFILES = ['alumno', 'docente', 'administracion'];

/** The deliveries are milestones, not steps of the plan. */
export const MILESTONES = [
  {
    id: 'pec3',
    label: 'Entrega de la PEC3',
    date: '2026-12-05',
    text: 'La aplicación completa, publicada, con accesibilidad y responsive verificados.',
  },
  {
    id: 'pec4',
    label: 'Entrega de la PEC4',
    date: '2027-01-05',
    text: 'Versión 1.0 pública, memoria final y defensa.',
  },
];

/** Steps of the plan after the PEC3 (block B). Those that end before the PEC3 are not shown as pending. */
export const AFTER_PEC3 = ['6.3', '7.3', '7.4'];

/** What the tutor gained in each version of its instructions, in plain words (prompt-history.md is internal). */
export const PROMPT_TEXT = {
  v0: [
    'Un guion de prueba',
    'Antes de conectar la IA, un tutor simulado con respuestas fijas sirvió para diseñar las pantallas.',
  ],
  v1: [
    'Primer tutor con IA',
    'Habla el idioma del alumno, reacciona con emociones y humor, y tiene una regla fija: nunca escribe código.',
  ],
  v2: [
    'Más natural',
    'Tras ponerle 12 trampas: niega de formas variadas y sin etiquetar al alumno, no comenta código que aún no existe y dice claramente cuándo un código está bien.',
  ],
  v3: [
    'Ayuda de verdad',
    'No repite preguntas, nota la frustración, señala la línea que falla y puede dar el esqueleto vacío de la función.',
  ],
  v4: [
    'Consulta y actúa',
    'Puede consultar los datos del alumno, como sus intentos y sus pruebas, y actuar en la aplicación.',
  ],
  v5: [
    'Botones para el alumno',
    'Propone formatear el código, ejecutar las pruebas, entregar o corregir un despiste, y el alumno lo confirma con un botón.',
  ],
  v6: [
    'Más difícil de engañar',
    'Tras la auditoría de seguridad: no escribe código ni disimulado (en una frase, deletreado o por partes) y lo que escribe el alumno nunca son órdenes.',
  ],
  v7: [
    'Sabe por qué se acerca',
    'Cuando interviene sin que le pregunten, conoce el motivo (un fallo que se repite, un parón) y no confunde ayudar con felicitar.',
  ],
};

/** The presentation, in the order of a demo. `notes` are the speaker's notes (key N). */
export const SLIDES = [
  {
    type: 'cover',
    phase: 6,
    title: 'TutorIA',
    sub: 'Un tutor de IA que ayuda a aprender a programar sin dar nunca la solución.',
    notes: [
      'Trabajo Fin de Máster. Aplicación web para Formación Profesional, construida del {desde} al {hasta} con un agente de IA.',
      'En la demo: el alumno, el docente en clase y la administración.',
    ],
  },
  {
    type: 'points',
    phase: 4,
    kicker: 'El problema',
    title: 'La solución está a una pregunta',
    points: [
      'Un asistente de IA genérico escribe el ejercicio entero si se lo piden.',
      'El docente ve lo que se entrega, no cómo se ha llegado ahí.',
      'En un aula de 24, quien se atasca no siempre levanta la mano.',
    ],
    visual: { icon: '🤔' },
    notes: [
      'Los ejercicios autoevaluables ya dicen si el código pasa las pruebas; lo que falta es ayuda que no regale la respuesta y un docente que sepa dónde mirar.',
    ],
  },
  {
    type: 'cards',
    phase: 1,
    kicker: 'La propuesta',
    title: 'Un tutor que no hace trampas',
    rule: 'Regla absoluta: el tutor da pistas cada vez más concretas, pero nunca escribe la solución.',
    notes: [
      'Tres perfiles en la misma aplicación. El tutor es el centro: pistas en tres niveles, y un panel para el docente que describe sin etiquetar ni puntuar.',
    ],
  },
  {
    type: 'points',
    phase: 1,
    kicker: 'Demo · el alumno',
    title: 'Practicar con un tutor al lado',
    points: [
      'Pistas en tres niveles: una pregunta, la zona del problema y el paso concreto.',
      'Las pruebas se ejecutan en el navegador: un bucle infinito acaba en «Tiempo agotado» y la página sigue respondiendo.',
      'Puede hablar con el tutor por voz, y el tutor reacciona con emociones.',
    ],
    visual: { shot: '03-trabajo' },
    notes: [
      'Mostrar: pedir una pista dos veces, ejecutar con un fallo, la reacción del tutor al superar las pruebas.',
      'El código se guarda solo mientras se escribe: si se recarga, sigue ahí.',
    ],
  },
  {
    type: 'ring',
    phase: 4,
    kicker: 'La prueba de fuego',
    title: 'El tutor no da la solución, ni con trampas',
    points: [
      '{resiste} de {ataques} intentos de sacarle la solución, resistidos.',
      '{ayuda} de {controles} dudas legítimas, con ayuda.',
      'Defensas en capas: sus instrucciones, un validador en el servidor que rechaza cualquier código y el esqueleto vacío, que escribe el servidor y no la IA.',
    ],
    notes: [
      'La batería de elusión prueba {trucos} trucos habituales («el profesor me ha autorizado», pedir pseudocódigo, inyectar órdenes en un comentario…), tres veces cada uno.',
      'Y comprueba lo contrario: que una duda normal sí recibe ayuda.',
    ],
  },
  {
    type: 'points',
    phase: 2,
    kicker: 'Un tutor que ayuda de verdad',
    title: 'Ayuda en el momento oportuno',
    points: [
      'Señala la línea que falla y propone corregir un despiste («retrun → return») con un botón que pulsa el alumno.',
      'Se acerca solo cuando tiene sentido: tras varios fallos seguidos o un parón, nunca mientras se escribe.',
      'Ocho versiones de sus instrucciones, cada una con lo que aprendió de la anterior.',
    ],
    visual: { prompts: true },
    notes: [
      'La línea de versiones se puede recorrer: pulsar una versión cuenta qué ganó el tutor en ella.',
    ],
  },
  {
    type: 'points',
    phase: 4,
    kicker: 'Demo · el docente en clase',
    title: '¿A quién atiendo? ¿Lo explico a todos?',
    points: [
      'El panel en vivo responde a las dos decisiones del docente en clase.',
      'Describe lo que pasa sin etiquetar al alumno: «falla 4 veces seguidas la misma prueba».',
      'Solo avisa de lo que se resuelve mirando el código; salir de la ventana no es un motivo.',
    ],
    visual: { shot: '06-en-vivo' },
    notes: [
      'Mostrar el simulador de clase: la cola cambia en directo, igual que con datos reales.',
    ],
  },
  {
    type: 'points',
    phase: 4,
    kicker: 'El docente después de clase',
    title: 'Cómo va el grupo y cómo va cada uno',
    points: [
      'El histórico responde a una pregunta: ¿el grupo pide cada vez menos ayuda?',
      'El detalle de un intento cuenta su historia: qué pruebas fallan, desde cuándo y qué le dijo el tutor.',
      'Cada gráfica responde a una sola pregunta, y una frase la lee por el docente.',
    ],
    visual: { shot: '09-historico' },
    notes: ['Los indicadores son formativos: sin clasificaciones ni notas.'],
  },
  {
    type: 'points',
    phase: 4,
    kicker: 'Preparar las clases',
    title: 'Ejercicios, bloques y recuperaciones',
    points: [
      'El docente prueba su ejercicio en la misma pantalla que verá el alumno, con el tutor de verdad y sin dejar rastro.',
      'La IA traduce el enunciado y el servidor comprueba que no ha tocado el código.',
      'Una recuperación se prepara con antelación y aparece sola el día del examen.',
    ],
    visual: { shot: '08b-ejercicio' },
    notes: [
      'Un ejercicio con trabajo de alumnos no se borra: se archiva, y sus intentos siguen ahí.',
    ],
  },
  {
    type: 'points',
    phase: 5,
    kicker: 'La administración',
    title: 'Un centro en marcha en minutos',
    points: [
      'Alta de una clase entera de una vez, con un CSV y tiras para recortar con cada contraseña.',
      'El 1 de septiembre las clases del curso anterior se cierran solas.',
      'El proveedor de IA tiene respaldos: si uno se satura, responde otro.',
    ],
    visual: { shot: '10-usuarios' },
    notes: [
      'La cuenta del tribunal tiene su propia ayuda guiada: el primer paso le pide crear una cuenta de verdad.',
    ],
  },
  {
    type: 'points',
    phase: 7,
    kicker: 'Para todo el alumnado',
    title: 'Accesible, en tres idiomas y transparente',
    points: [
      'Cada pantalla pasa la comprobación de accesibilidad sin infracciones, en claro y en oscuro.',
      'Español, inglés y catalán, también en las respuestas del tutor.',
      'El alumno ve qué se registra de su trabajo y para qué, antes de empezar.',
    ],
    visual: { shot: '05b-datos' },
    notes: ['Ayuda guiada en cada pantalla: el manual de usuario sale de esas mismas tareas.'],
  },
  {
    type: 'compare',
    phase: 7,
    kicker: 'Antes y después',
    title: 'Así cambiaron las pantallas',
    notes: [
      'Cada pantalla se fotografía al cerrar el paso que la cambia. Arrastrar la línea para comparar.',
    ],
  },
  {
    type: 'build',
    phase: 2,
    kicker: 'Cómo se construyó',
    title: 'El agente programa; el autor guía, valida y decide',
    points: [
      '{pasos} pasos, cada uno con su plan, su bitácora y sus cifras.',
      '{decisiones} decisiones documentadas con su contexto y sus alternativas.',
      'Con IA, cada dato se comprueba en la fuente: versiones y APIs, en los paquetes publicados.',
    ],
    notes: [
      'El desarrollo guiado por la especificación: el plan es la fuente de verdad, y cada paso se cierra con tests en verde y la validación del autor.',
      'Los commits los prepara el agente y los ejecuta el autor.',
    ],
  },
  {
    type: 'points',
    phase: 5,
    kicker: 'Calidad y seguridad',
    title: 'Sin tests no se cierra un paso',
    points: [
      '{tests} tests unitarios y el 100 % de cobertura exigido en cada paso.',
      'Dos auditorías de seguridad: lo que protege una pantalla no protege la base de datos.',
      'El manual lo escribe un robot que hace las tareas en el navegador: si una deja de funcionar, no se genera.',
    ],
    visual: { stats: ['tests', 'e2e', 'capturas'] },
    notes: [
      'La auditoría encontró, por ejemplo, que una tabla aceptaba 20 000 eventos en una sola petición. Se corrigió en la base de datos.',
    ],
  },
  {
    type: 'timeline',
    phase: 3,
    kicker: 'Las cifras',
    title: '{dias} días de trabajo',
    notes: [
      'Horas del autor: {horas_autor}. Horas de trabajo del agente: {horas_claude}. Coste equivalente a precio de la API: {coste} $.',
    ],
  },
  {
    type: 'next',
    phase: 8,
    kicker: 'Lo que queda',
    title: 'Hasta la versión 1.0',
    notes: [
      'Tras la PEC3: los cambios que pida la corrección, la IA integrada en Chrome si da tiempo, paletas de color y la versión 1.0 con la cuenta del tribunal.',
    ],
  },
  {
    type: 'thanks',
    phase: 6,
    title: '¡Gracias!',
    sub: '¿Preguntas?',
    notes: [
      'Todo lo que se ve sale de la documentación del proyecto: el plan, el registro, las bitácoras, las decisiones y las capturas.',
    ],
  },
];
