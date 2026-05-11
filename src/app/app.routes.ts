import { Routes } from '@angular/router';
import { roomGuard } from './features/room/room.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/lobby/lobby.component').then(m => m.LobbyComponent),
  },
  {
    path: 'room/:id',
    canActivate: [roomGuard],
    loadComponent: () => import('./features/room/room.component').then(m => m.RoomComponent),
  },
  { path: '**', redirectTo: '' },
];
