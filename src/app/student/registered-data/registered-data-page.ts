import { Component, inject } from '@angular/core';
import { MatAnchor } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../../auth/auth-store';
import { APP_PATHS } from '../../core/app-paths';

/** An item of the lists of the page: an icon, what it is and a line of detail. */
interface DataItem {
  readonly icon: string;
  readonly title: string;
  readonly detail: string;
}

/** What the app records while the student works (2.8): each item, in plain words. */
const RECORDED: readonly DataItem[] = [
  {
    icon: 'schedule',
    title: $localize`:@@myData.recorded.time:Cuándo trabajas en cada ejercicio`,
    detail: $localize`:@@myData.recorded.time.detail:Cuándo empiezas, guardas, ejecutas las pruebas y entregas.`,
  },
  {
    icon: 'code',
    title: $localize`:@@myData.recorded.code:Tu código`,
    detail: $localize`:@@myData.recorded.code.detail:Se guarda automáticamente mientras escribes, para que no lo pierdas y tu docente pueda verlo.`,
  },
  {
    icon: 'checklist',
    title: $localize`:@@myData.recorded.runs:Las ejecuciones de las pruebas`,
    detail: $localize`:@@myData.recorded.runs.detail:Cuántas pruebas pasan y cuáles fallan.`,
  },
  {
    icon: 'lightbulb',
    title: $localize`:@@myData.recorded.hints:Las pistas que pides`,
    detail: $localize`:@@myData.recorded.hints.detail:Cuántas y de qué nivel.`,
  },
  {
    icon: 'chat',
    title: $localize`:@@myData.recorded.chat:La conversación con el tutor`,
    detail: $localize`:@@myData.recorded.chat.detail:El texto de lo que le escribes y de lo que te responde, también si le pides la solución.`,
  },
  {
    icon: 'content_paste',
    title: $localize`:@@myData.recorded.paste:Cuándo pegas código`,
    detail: $localize`:@@myData.recorded.paste.detail:Cuándo pegas texto en el editor y cuánto.`,
  },
  {
    icon: 'tab',
    title: $localize`:@@myData.recorded.away:Cuándo sales de la pantalla de trabajo`,
    detail: $localize`:@@myData.recorded.away.detail:Cuándo cambias de pestaña o de ventana y cuánto tiempo estás fuera, pero no adónde vas.`,
  },
];

/** The external services that take part, and what each one receives. */
const SERVICES: readonly DataItem[] = [
  {
    icon: 'smart_toy',
    title: $localize`:@@myData.services.ai.title:El modelo de IA del tutor`,
    detail: $localize`:@@myData.services.ai:Las respuestas del tutor las redacta un modelo de inteligencia artificial de un proveedor externo. Recibe el enunciado, tu código, la conversación y el nivel de pista, pero no tu nombre ni tu correo.`,
  },
  {
    icon: 'mic',
    title: $localize`:@@myData.services.voice.title:El reconocimiento de voz`,
    detail: $localize`:@@myData.services.voice:Cuando uses la voz, el reconocimiento lo hace tu navegador, que puede enviar el audio a un servicio externo para transcribirlo (Chrome, a Google). Si prefieres evitarlo, puedes escribir siempre.`,
  },
];

/**
 * What the app records, what it never records, what for and who sees it (/alumno/datos, ficha 05b,
 * RF-07), as in the prototype (figure 23). Reading it also counts as seeing the first-time notice.
 */
@Component({
  selector: 'app-registered-data-page',
  imports: [MatAnchor, MatIcon, RouterLink],
  templateUrl: './registered-data-page.html',
})
export class RegisteredDataPage {
  protected readonly recorded = RECORDED;
  protected readonly services = SERVICES;
  protected readonly catalogPath = APP_PATHS.student.catalog;
  protected readonly settingsPath = APP_PATHS.student.settings;

  constructor() {
    void inject(AuthStore).markPrivacyNoticeSeen();
  }
}
