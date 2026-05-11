import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RoomService } from '../../core/services/room.service';

export const roomGuard: CanActivateFn = () => {
  const roomService = inject(RoomService);
  const router = inject(Router);

  if (roomService.currentRoom() && roomService.currentUser()) return true;

  router.navigate(['/']);
  return false;
};
