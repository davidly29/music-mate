import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoomService } from '../../../../core/services/room.service';
import { IdService } from '../../../../core/services/id.service';

@Component({
  selector: 'sw-members',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './members.component.html',
  styleUrls: ['./members.component.scss'],
})
export class MembersComponent {
  constructor(readonly roomService: RoomService, readonly id: IdService) {}
  isCurrentUser(uid: string): boolean { return this.roomService.currentUser()?.id === uid; }
  isHost(uid: string): boolean { return this.roomService.currentRoom()?.hostId === uid; }
}
