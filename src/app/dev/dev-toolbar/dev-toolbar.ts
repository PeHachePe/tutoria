import { DatePipe } from '@angular/common';
import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MatButton, MatIconButton, MatMiniFabButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import {
  MatFormField,
  MatLabel,
  MatOptgroup,
  MatOption,
  MatSelect,
} from '@angular/material/select';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { provideFormFieldDefaults } from '../../core/form-field-defaults';
import type { DataErrorKind } from '../../data/data-error';
import { MockDb } from '../../data/mock/mock-db';
import { DEFAULT_LATENCY, LatencyRange, MockNetwork } from '../../data/mock/mock-network';
import type { AppUser } from '../../data/user';
import { ClassSimulator } from '../class-simulator';
import { DEV_PATHS } from '../dev-paths';
import { describeEvent } from './describe-event';
import { ToolInspector } from './tool-inspector';
import { PageReloader } from '../../core/page-reloader';

interface LatencyOption {
  readonly label: string;
  readonly range: LatencyRange;
}

const LATENCY_OPTIONS: readonly LatencyOption[] = [
  { label: 'Sin espera', range: { min: 0, max: 0 } },
  { label: 'Normal', range: DEFAULT_LATENCY },
  { label: 'Lenta', range: { min: 1500, max: 3000 } },
];

const FAILURE_OPTIONS: readonly { readonly kind: DataErrorKind; readonly label: string }[] = [
  { kind: 'network', label: 'Sin conexión' },
  { kind: 'unauthorized', label: 'Sesión caducada' },
  { kind: 'forbidden', label: 'Sin permiso' },
  { kind: 'not_found', label: 'No encontrado' },
  { kind: 'rate_limited', label: 'Demasiadas peticiones' },
  { kind: 'unavailable', label: 'Servicio no disponible' },
  { kind: 'invalid', label: 'Datos no válidos' },
  { kind: 'unknown', label: 'Error desconocido' },
];

/** The development pages of dev.routes.ts: no screen of the app links to them. */
const DEV_PAGES = [{ path: DEV_PATHS.showcase, label: 'Muestrario' }] as const;

const RECENT_EVENT_COUNT = 8;

/** Value of the "Sin sesión" and "No" options: mat-select shows an option with a null value as empty. */
const NONE = 'none';

/**
 * Development-only toolbar (4.3): sign in as any seed user, simulated latency, fail the next request,
 * reset the mock data, simulate a class for the live panel (4.1), try the tools of the screen (2.5e)
 * and watch the latest process events. Drawn by App when the environment provides it.
 */
@Component({
  selector: 'app-dev-toolbar',
  imports: [
    DatePipe,
    MatButton,
    MatIconButton,
    MatMiniFabButton,
    MatButtonToggleGroup,
    MatButtonToggle,
    MatIcon,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOptgroup,
    MatOption,
    RouterLink,
    RouterLinkActive,
    ToolInspector,
  ],
  templateUrl: './dev-toolbar.html',
  // Drawn outside the routes, so it brings the defaults of its fields itself (D-021)
  providers: [provideFormFieldDefaults()],
  host: { '(keydown.escape)': 'closeOnEscape()' },
})
export class DevToolbar {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);
  private readonly reloader = inject(PageReloader);
  private readonly router = inject(Router);
  protected readonly simulator = inject(ClassSimulator);
  private readonly toggleButton = viewChild.required('toggle', { read: ElementRef<HTMLElement> });

  protected readonly none = NONE;
  protected readonly pages = DEV_PAGES;
  protected readonly latencyOptions = LATENCY_OPTIONS;
  protected readonly failureOptions = FAILURE_OPTIONS;
  protected readonly open = signal(false);
  protected readonly currentUser = this.db.currentUser;
  protected readonly failNext = computed(() => this.network.failNext() ?? NONE);
  /** The simulator works on the block a teacher or an administrator follows live. */
  protected readonly canSimulate = computed(() => {
    const role = this.currentUser()?.role;
    return role === 'teacher' || role === 'admin';
  });

  /**
   * Active seed users, grouped as the selector shows them. Students go by class: the groups of a
   * class in several subjects share its name (2.5c), and each student shows once.
   */
  protected readonly userGroups = computed(() => {
    const { users, groups, enrollments } = this.db.tables();
    const active = users.filter((user) => user.status === 'active');
    const groupOf = (label: string, members: AppUser[]) => ({ label, users: members });
    const classes = [...new Set(groups.map((group) => group.name))];
    return [
      groupOf(
        'Administración',
        active.filter((user) => user.role === 'admin'),
      ),
      groupOf(
        'Profesorado',
        active.filter((user) => user.role === 'teacher'),
      ),
      ...classes.map((name) =>
        groupOf(
          `Alumnado de ${name}`,
          active.filter(
            (user) =>
              user.role === 'student' &&
              enrollments.some(
                (e) =>
                  e.userId === user.id &&
                  groups.some((group) => group.id === e.groupId && group.name === name),
              ),
          ),
        ),
      ),
    ];
  });

  /** The option of the current latency, if it is one of them. */
  protected readonly latencyOption = computed(() => {
    const { min, max } = this.network.latency();
    return LATENCY_OPTIONS.find(({ range }) => range.min === min && range.max === max);
  });

  protected readonly recentEvents = computed(() => {
    const { events, attempts, users } = this.db.tables();
    return [...events]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, RECENT_EVENT_COUNT)
      .map((event) => {
        const userId = attempts.find((attempt) => attempt.id === event.attemptId)?.userId;
        return {
          id: event.id,
          timestamp: event.timestamp,
          text: describeEvent(event),
          who: users.find((user) => user.id === userId)?.name ?? 'Intento desconocido',
        };
      });
  });

  protected togglePanel(): void {
    this.open.update((open) => !open);
  }

  /** Closes the panel and gives the focus back to the button that opens it. */
  protected close(): void {
    this.open.set(false);
    this.toggleButton().nativeElement.focus();
  }

  /** Escape inside the toolbar closes the panel, if it is open. */
  protected closeOnEscape(): void {
    if (this.open()) {
      this.close();
    }
  }

  /**
   * Changes the session and starts again from the home of the new role: the current page may belong
   * to another role, and every screen reads its data again as that user.
   */
  protected signInAs(userId: string): void {
    this.db.setSession(userId === NONE ? null : userId);
    this.reloader.openHome();
  }

  protected setLatency(option: LatencyOption): void {
    this.network.setLatency(option.range);
  }

  protected failNextRequest(kind: DataErrorKind | typeof NONE): void {
    this.network.failNextRequest(kind === NONE ? null : kind);
  }

  /** Starts the simulated class on the block of the live panel, or stops it. */
  protected toggleSimulation(): void {
    const target = this.simulationTarget();
    if (this.simulator.running() || !target) {
      this.simulator.stop();
    } else {
      this.simulator.start(target);
    }
  }

  protected stuckOne(): void {
    const target = this.simulationTarget();
    if (target) this.simulator.stuckOne(target);
  }

  protected patternOne(): void {
    const target = this.simulationTarget();
    if (target) this.simulator.patternOne(target);
  }

  /** The group and the block of the URL of the live panel, or those it shows by default. */
  private simulationTarget() {
    return this.simulator.targetFor(this.router.parseUrl(this.router.url).queryParamMap);
  }

  protected resetData(): void {
    this.simulator.stop();
    this.db.reset();
    this.reloader.reload();
  }
}
