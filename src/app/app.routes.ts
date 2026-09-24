import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.LoginComponent),
    title: 'LightSpeak · Login',
  },
  {
    path: 'register',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/register/register').then((m) => m.RegisterComponent),
    title: 'LightSpeak · Register',
  },
  {
    path: 'app',
    canMatch: [authGuard],
    loadComponent: () => import('./features/shell/shell').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/shell/home/home').then((m) => m.HomeComponent),
        title: 'LightSpeak',
      },
      {
        path: 'settings/profile',
        redirectTo: '',
        pathMatch: 'full',
      },
      {
        path: 'servers/:serverId/settings',
        loadComponent: () =>
          import('./features/servers/server-settings/server-settings').then((m) => m.ServerSettingsComponent),
        title: 'LightSpeak · Server settings',
      },
      {
        path: 'servers/:serverId',
        loadComponent: () =>
          import('./features/servers/server-view/server-view').then((m) => m.ServerViewComponent),
        children: [
          {
            path: 'channels/:channelId',
            loadComponent: () => import('./features/chat/chat').then((m) => m.ChatComponent),
            title: 'LightSpeak · Chat',
          },
        ],
      },
      { path: '**', redirectTo: '' },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
