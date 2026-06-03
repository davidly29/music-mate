import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RoomService } from '../../core/services/room.service';
import { IdService } from '../../core/services/id.service';
import { SidebarTab } from '../../core/models';
import { PlayerComponent } from './components/player/player.component';
import { QueueComponent } from './components/queue/queue.component';
import { ChatComponent } from './components/chat/chat.component';
import { MembersComponent } from './components/members/members.component';
import { AddVideoComponent } from './components/add-video/add-video.component';

@Component({
  selector: 'sw-room',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, PlayerComponent, QueueComponent, ChatComponent, MembersComponent, AddVideoComponent],
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.scss'],
})
export class RoomComponent implements OnInit {
  activeTab = signal<SidebarTab>('queue');
  sidebarCollapsed = signal(false);
  readonly tabs: SidebarTab[] = ['queue', 'chat', 'members'];

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  constructor(
    readonly roomService: RoomService,
    readonly id: IdService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (!this.roomService.currentRoom() || !this.roomService.currentUser()) {
      this.router.navigate(['/']);
    }
  }

  onLeave(): void {
    this.roomService.leaveRoom();
    this.router.navigate(['/']);
  }

  setTab(tab: string): void {
    this.activeTab.set(tab as SidebarTab);
  }
}
