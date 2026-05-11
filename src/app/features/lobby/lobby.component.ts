import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RoomService } from '../../core/services/room.service';
import { ToastService } from '../../core/services/toast.service';
import { IdService } from '../../core/services/id.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'sw-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss'],
})
export class LobbyComponent implements OnInit {
  createName     = '';
  createRoomName = '';
  showJoinModal  = signal(false);
  joinName       = '';
  joinCode       = '';

  private _sub!: Subscription;

  constructor(
    readonly roomService: RoomService,
    private toast: ToastService,
    private id: IdService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Listen for room:state (means create/join succeeded)
    this._sub = (this.roomService as any).socket.onState$.subscribe((state: any) => {
      this.router.navigate(['/room', state.id]);
    });
  }

  ngOnDestroy(): void {
    this._sub?.unsubscribe();
  }

  onCreateRoom(): void {
    if (!this.createName.trim() || !this.createRoomName.trim()) return;
    const user = this.roomService.setUser(this.createName);
    this.roomService.createRoom(this.createRoomName, user);
  }

  onJoinRoom(): void {
    if (!this.joinName.trim() || !this.joinCode.trim()) return;
    const room = this.roomService.lobbyRooms().find(
      r => r.code === this.joinCode.trim().toUpperCase()
    );
    if (!room) { this.toast.error('Room not found — check the code'); return; }
    const user = this.roomService.setUser(this.joinName);
    this.roomService.joinRoomById(room.id, user);
    this.showJoinModal.set(false);
  }

  onClickRoom(room: any): void {
    this.joinCode = room.code;
    this.showJoinModal.set(true);
  }

  openJoinModal(): void {
    this.joinCode = '';
    this.joinName = '';
    this.showJoinModal.set(true);
  }

  closeJoinModal(): void { this.showJoinModal.set(false); }

  initials(name: string): string { return this.id.initials(name); }
}
