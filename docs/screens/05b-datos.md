# 05b · Datos registrados

`/alumno/datos` · Alumno · Capa 1 · 1 h · Figuras 14 y 23 del TFM

## Objetivo

Que el alumno sepa qué registra TutorIA mientras trabaja, qué no registra nunca, para qué, quién lo ve y qué servicios externos intervienen (RF-07, §2.2 y §2.10), y que lo sepa antes de empezar a trabajar, como pide el RGPD citado en la memoria.

## Datos

- Contenido fijo, contrastado con los eventos que existen (`ProcessEvent`, §2.8), con el código guardado y con la conversación del tutor.
- Abrir la pantalla cuenta como haber visto el aviso (`SettingsStore.markDataNoticeSeen`).

## Contenido y disposición

Como la figura 23:

- Cabecera: `h1` «Datos registrados» y «Qué registra TutorIA mientras trabajas, para qué y quién puede verlo».
- **Se registra** (columna izquierda), con un icono por dato: cuándo trabajas, tu código, las ejecuciones de las pruebas, las pistas, la conversación con el tutor (también si pides la solución), cuándo pegas código y cuándo sales de la pantalla de trabajo y cuánto tiempo (no adónde).
- **Nunca se registra**, destacado en verde: el audio. Tampoco lo que haces fuera de TutorIA.
- **Para qué:** para aprender, no para sancionar.
- **Quién lo ve:** tu docente, solo en sus grupos, y la administración; el resto del alumnado no.
- **Servicios externos**, a todo el ancho: el proveedor de IA (recibe enunciado, código, conversación y nivel de pista, sin nombre ni correo) y el reconocimiento de voz del navegador, como la lista de lo que se registra (icono, título y detalle), con los iconos en el color secundario para separar a los terceros (2.5c).
- Abajo, el panel «Tú decides» (como el de privacidad de los ajustes): qué se elige en los ajustes, con «Ir a los ajustes» (con borde) e «Ir a los ejercicios» (relleno, con flecha) (2.5c).
- «Nunca se registra», en el color de éxito sin borde, como la enhorabuena del catálogo; los paneles, a 24 px entre sí, igual que en los ajustes (2.5c).

## Aviso de la primera vez

- Diálogo «Antes de empezar: tus datos» con un resumen de lo que se registra, «Nunca graba el audio» destacado, quién lo ve (docente y administración) y qué recibe el proveedor de IA (sin nombre ni correo), «Ver los detalles» (lleva aquí) y «Entendido».
- Lo abre el shell del alumno en cualquiera de sus páginas, también si entra directo a un ejercicio por un enlace; no en esta pantalla, que ya cuenta como vista.
- No se cierra con Esc ni pulsando fuera: hay que elegir uno de los dos botones. Se recuerda por usuario.

## Estados

Solo el de con datos.

## Accesibilidad

- Cada bloque es una región con su encabezado (`aria-labelledby`); los iconos son decorativos.
- El diálogo recibe el foco al abrirse y lo devuelve al cerrarse (Material).

## Criterios de aceptación

- [x] El aviso sale la primera vez que el alumno entra y no vuelve a salir tras «Entendido» o «Ver los detalles».
- [x] Lo registrado coincide con lo que la aplicación guarda de verdad.
- [x] Sin scroll horizontal a 375 px.

## Fuera de alcance

- Descargar o borrar los propios datos (derechos de acceso y supresión): trabajo futuro en la memoria.
- Guardar en el servidor la fecha en que el alumno vio el aviso, como prueba del consentimiento (RGPD art. 7.1).

## Pulido pendiente
