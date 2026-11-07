import { Routes } from '@angular/router';

import { environment } from '../environments/environment';
import { guestGuard } from './auth/guest-guard';
import { homeRedirect } from './auth/home-path';
import { roleGuard } from './auth/role-guard';
import { SEGMENTS } from './core/app-paths';

/**
 * Each role has its own lazily loaded area (2.2). The role guards use `canMatch`: a page of another
 * role does not match, so it ends in the not found page, and its code is never downloaded.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: homeRedirect },
  {
    path: SEGMENTS.login,
    title: $localize`:@@login.title:Acceso`,
    canMatch: [guestGuard],
    loadComponent: () => import('./auth/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: SEGMENTS.student.area,
    canMatch: [roleGuard('student')],
    loadChildren: () => import('./student/student.routes').then((m) => m.studentRoutes),
  },
  {
    path: SEGMENTS.teacher.area,
    canMatch: [roleGuard('teacher', 'admin')],
    loadChildren: () => import('./teacher/teacher.routes').then((m) => m.teacherRoutes),
  },
  {
    path: SEGMENTS.admin.area,
    canMatch: [roleGuard('admin')],
    loadChildren: () => import('./admin/admin.routes').then((m) => m.adminRoutes),
  },
  ...environment.devRoutes,
  {
    path: '**',
    title: $localize`:@@notFound.title:Página no encontrada`,
    loadComponent: () => import('./not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
