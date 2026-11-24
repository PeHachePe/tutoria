import { Component, computed, inject } from '@angular/core';
import { MatAnchor, MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { APP_PATHS } from '../../core/app-paths';
import { GUIDE_ANCHORS, GuideAnchor } from '../../core/guide/guide-anchor';
import { GuideStore } from '../../core/guide/guide-store';
import type { GuideTask } from '../../core/guide/guide-task';
import { CREATE_CLASS_TASK } from './teacher-tasks';

/**
 * «Crear tu clase», the way out of a screen that is empty because the teacher has no class yet
 * (D-093): it starts the guided task that creates one and enrolls its students, which begins at the
 * entry of Grupos in the menu. Where the area has no guided help, it is a plain link to Grupos.
 */
@Component({
  selector: 'app-create-class-button',
  imports: [MatAnchor, MatButton, MatIcon, RouterLink, GuideAnchor],
  template: `
    @if (task(); as task) {
      <button matButton="filled" type="button" [appGuideAnchor]="anchor" (click)="start(task)">
        <mat-icon aria-hidden="true">group_add</mat-icon>
        <span>{{ label }}</span>
      </button>
    } @else {
      <a matButton="filled" [routerLink]="groupsPath">
        <mat-icon aria-hidden="true">group_add</mat-icon>
        <span>{{ label }}</span>
      </a>
    }
  `,
})
export class CreateClassButton {
  private readonly guide = inject(GuideStore);

  protected readonly label = $localize`:@@createClass.button:Crear tu clase`;
  protected readonly groupsPath = APP_PATHS.teacher.groups;
  protected readonly anchor = GUIDE_ANCHORS.createClass;
  protected readonly task = computed(() =>
    this.guide.tasks().find((task) => task.id === CREATE_CLASS_TASK),
  );

  protected start(task: GuideTask): void {
    void this.guide.startTask(task);
  }
}
